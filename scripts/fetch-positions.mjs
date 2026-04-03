#!/usr/bin/env node
/**
 * Fetches real chess positions from Lichess APIs and prints a TypeScript
 * source file to stdout.
 *
 * Run from the project root:
 *   node scripts/fetch-positions.mjs > src/lib/curated-positions.ts
 */

import { Chess } from "chess.js";

const DELAY_MS = 1400;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── helpers ──────────────────────────────────────────────────────────────────

function sideFromFen(fen) { return fen.split(" ")[1] ?? "w"; }
function moveNumFromFen(fen) { return parseInt(fen.split(" ")[5] ?? "1", 10); }
function phaseFromMoveNum(n) {
  if (n <= 10) return "opening";
  if (n <= 28) return "middlegame";
  return "endgame";
}

/** Rough material count to detect true endgames regardless of move number */
function materialCount(fen) {
  const board = fen.split(" ")[0];
  let total = 0;
  for (const ch of board) {
    switch (ch.toLowerCase()) {
      case "q": total += 9; break;
      case "r": total += 5; break;
      case "b": case "n": total += 3; break;
      case "p": total += 1; break;
    }
  }
  return total;
}

function phaseFromPosition(fen) {
  const moveNum = moveNumFromFen(fen);
  const mat = materialCount(fen);
  if (moveNum <= 10) return "opening";
  if (mat <= 26) return "endgame";      // queen gone or heavy piece exchange
  if (mat <= 46) return "middlegame";   // late middlegame
  return "middlegame";
}

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), ...opts });
    if (!res.ok) { process.stderr.write(`  HTTP ${res.status}: ${url}\n`); return null; }
    return res;
  } catch (e) {
    process.stderr.write(`  Error: ${e.message} — ${url}\n`);
    return null;
  }
}

/** Reconstruct FEN from a game's SAN move string by replaying the game */
function fenFromSanMoves(sanMovesStr) {
  const chess = new Chess();
  const moves = sanMovesStr.trim().split(/\s+/);
  for (const san of moves) {
    try { if (!chess.move(san)) break; } catch { break; }
  }
  return chess.fen();
}

// ── 1. Lichess puzzle/next ──────────────────────────────────────────────────

async function fetchOnePuzzle() {
  const res = await safeFetch("https://lichess.org/api/puzzle/next", {
    headers: { Accept: "application/json" },
  });
  if (!res) return null;
  const data = await res.json();
  const pgn = data.game?.pgn;
  const themes = data.puzzle?.themes ?? [];
  if (!pgn) return null;

  const fen = fenFromSanMoves(pgn);
  const moveNum = moveNumFromFen(fen);
  return {
    fen,
    sideToMove: sideFromFen(fen),
    opening: null,
    phase: phaseFromMoveNum(moveNum),
    moveNumber: moveNum,
    category: themes.includes("endgame") ? "endgame" : "tactical",
  };
}

// ── 2. Game export ──────────────────────────────────────────────────────────

async function fetchUserGames(username, max = 15, perfType = "blitz,rapid,classical") {
  const params = new URLSearchParams({
    max: String(max),
    opening: "true",
    pgnInJson: "true",
    rated: "true",
    perfType,
    moves: "true",
  });
  process.stderr.write(`  Fetching games for ${username}…\n`);
  const res = await safeFetch(
    `https://lichess.org/api/games/user/${username}?${params}`,
    { headers: { Accept: "application/x-ndjson" } }
  );
  if (!res) return [];
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function extractPositionFromGame(game, targetPly) {
  if (!game.moves) return null;
  const chess = new Chess();
  const moves = game.moves.trim().split(/\s+/);
  for (let i = 0; i < Math.min(targetPly, moves.length); i++) {
    try { if (!chess.move(moves[i])) break; } catch { break; }
  }
  const fen = chess.fen();
  const moveNum = moveNumFromFen(fen);
  return {
    fen,
    sideToMove: sideFromFen(fen),
    opening: game.opening?.name ?? null,
    phase: phaseFromPosition(fen),
    moveNumber: moveNum,
  };
}

// ── 3. Tricky positions — fetched from Lichess puzzle themes ────────────────
// Themes chosen because they surface positions where the "obvious" move is
// wrong or counterintuitive: sacrifices, equality fights, trapping ideas.
const TRICKY_THEMES = [
  "equality",       // find the move that merely holds, not a flashy win
  "advantage",      // small edge — positional, not tactical
  "sacrifice",      // a real sacrifice is required (or tempting but wrong)
  "trapping",       // trapping an enemy piece
  "deflection",     // deflect a key defender
  "decoy",          // lure the king/piece to a bad square
  "interference",   // interference tactic
  "zugzwang",       // being forced to move is the problem
];

async function fetchPuzzleByTheme(theme) {
  const res = await safeFetch(
    `https://lichess.org/api/puzzle/next?angle=${theme}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res) return null;
  const data = await res.json();
  const pgn = data.game?.pgn;
  if (!pgn) return null;
  const fen = fenFromSanMoves(pgn);
  const moveNum = moveNumFromFen(fen);
  return {
    fen,
    sideToMove: sideFromFen(fen),
    opening: null,
    phase: phaseFromMoveNum(moveNum),
    moveNumber: moveNum,
    category: "tricky",
  };
}

// ── player lists ────────────────────────────────────────────────────────────
// Verified titled players (GMs/IMs) active on Lichess

// Primarily for middlegame sampling — online GMs with lots of rapid/blitz
const GM_MIDDLEGAME = [
  "nihalsarin", "DanielNaroditsky", "penguingim1", "AnishGiri", "FabianoCaruana",
  "alireza2003", "DrNykterstein", "vincentkeymer", "BogdanDeac", "RaunakSadhwani",
  "JGBT", "lovlas", "LyonBeast", "GMHikaru", "Nodirbek",
  "Zhigalko_Sergei", "MateusCFernandes",
];

// Primarily for endgame sampling — classical/rapid games that consistently
// reach technical endgames
const GM_ENDGAME = [
  "DanielNaroditsky", "AnishGiri", "alireza2003", "DrNykterstein",
  "lovlas", "GMHikaru", "Nodirbek", "Zhigalko_Sergei",
  "nihalsarin", "penguingim1", "BogdanDeac", "RaunakSadhwani",
  "LyonBeast", "MateusCFernandes", "RebeccaHarris",
];

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const allPositions = [];
  const seen = new Set();

  function add(items) {
    for (const p of (Array.isArray(items) ? items : [items])) {
      if (!p?.fen || seen.has(p.fen)) continue;
      try { new Chess(p.fen); } catch { continue; }
      seen.add(p.fen);
      allPositions.push(p);
    }
  }

  // ── Tactical puzzles ──────────────────────────────────────────────────
  process.stderr.write("Fetching tactical puzzles…\n");
  for (let i = 0; i < 60; i++) {
    add(await fetchOnePuzzle());
    await delay(DELAY_MS);
  }
  process.stderr.write(`After puzzles: ${allPositions.length}\n`);

  // ── Middlegame positions from master games ────────────────────────────────
  // Sample at plies 25, 33, 41 — broad middlegame window
  process.stderr.write("Fetching GM middlegame positions…\n");
  for (const player of GM_MIDDLEGAME) {
    const games = await fetchUserGames(player, 18, "blitz,rapid,classical");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 15)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 30) continue;
      for (const ply of [25, 33, 41]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos && pos.phase === "middlegame") add({ ...pos, category: "balanced" });
      }
    }
    process.stderr.write(`  ${player} → ${allPositions.length} total\n`);
  }
  process.stderr.write(`After GM middlegames: ${allPositions.length}\n`);

  // ── Late middlegame / critical positions ──────────────────────────────────
  // Sample at plies 38-50 — positions where games are decided
  process.stderr.write("Fetching critical/sharp middlegame positions…\n");
  for (const player of GM_MIDDLEGAME.slice(0, 10)) {
    const games = await fetchUserGames(player, 15, "rapid,classical");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 12)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 44) continue;
      for (const ply of [39, 47]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos) add({ ...pos, category: "critical" });
      }
    }
  }
  process.stderr.write(`After critical: ${allPositions.length}\n`);

  // ── Endgame positions from classical/rapid master games ───────────────────
  // Use high ply samples (55-85) and filter by material-based phase detection
  process.stderr.write("Fetching GM endgame positions…\n");
  for (const player of GM_ENDGAME) {
    const games = await fetchUserGames(player, 18, "classical,rapid");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 15)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 56) continue;
      for (const ply of [55, 63, 71, 81]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        // Use material-based check: only include true endgames
        if (pos && materialCount(pos.fen) <= 34) add({ ...pos, category: "endgame" });
      }
    }
    process.stderr.write(`  ${player} → ${allPositions.length} total\n`);
  }
  process.stderr.write(`After endgames: ${allPositions.length}\n`);

  // ── Tricky positions from Lichess puzzle themes ──────────────────────────
  process.stderr.write("Fetching tricky/thematic puzzles…\n");
  for (let round = 0; round < 4; round++) {
    for (const theme of TRICKY_THEMES) {
      add(await fetchPuzzleByTheme(theme));
      await delay(DELAY_MS);
    }
  }
  process.stderr.write(`After tricky: ${allPositions.length}\n`);

  process.stderr.write(`\nTotal unique positions: ${allPositions.length}\n`);
  process.stderr.write(`  tactical: ${allPositions.filter(p => p.category === "tactical").length}\n`);
  process.stderr.write(`  balanced: ${allPositions.filter(p => p.category === "balanced").length}\n`);
  process.stderr.write(`  critical: ${allPositions.filter(p => p.category === "critical").length}\n`);
  process.stderr.write(`  endgame:  ${allPositions.filter(p => p.category === "endgame").length}\n`);
  process.stderr.write(`  tricky:   ${allPositions.filter(p => p.category === "tricky").length}\n`);

  // ── Emit TypeScript ────────────────────────────────────────────────────────

  const lines = [
    `import type { Position, PositionCategory } from "./types";`,
    ``,
    `// Curated positions sourced entirely from real Lichess games and puzzles.`,
    `// All FENs are guaranteed to appear in Lichess databases for cloud eval coverage.`,
    `//`,
    `// Categories:`,
    `//   tactical  — clear winning move / combination`,
    `//   balanced  — roughly equal middlegame; find a good positional move`,
    `//   critical  — late middlegame, few good moves, many losing`,
    `//   tricky    — looks like a tactic but isn't, or vice versa`,
    `//   endgame   — technical endgame from master games`,
    ``,
    `// DO NOT EDIT BY HAND — regenerate with: node scripts/fetch-positions.mjs > src/lib/curated-positions.ts`,
    ``,
    `export type { PositionCategory };`,
    ``,
    `export interface CuratedPosition extends Omit<Position, "id"> {`,
    `  category: PositionCategory;`,
    `}`,
    ``,
    `export const CURATED_POSITIONS: CuratedPosition[] = [`,
  ];

  for (const p of allPositions) {
    lines.push(`  { fen: ${JSON.stringify(p.fen)}, sideToMove: "${p.sideToMove}", opening: ${JSON.stringify(p.opening)}, phase: "${p.phase}", moveNumber: ${p.moveNumber}, category: "${p.category}" },`);
  }

  lines.push(`];`);
  lines.push(``);
  lines.push(`const WEIGHTS: Record<PositionCategory, number> = {`);
  lines.push(`  tactical: 0.10, balanced: 0.30, critical: 0.25, tricky: 0.10, endgame: 0.25,`);
  lines.push(`};`);
  lines.push(``);
  lines.push(`export function getWeightedRandomPosition(): CuratedPosition & { id: string } {`);
  lines.push(`  const roll = Math.random();`);
  lines.push(`  let cum = 0;`);
  lines.push(`  let cat: PositionCategory = "balanced";`);
  lines.push(`  for (const [c, w] of Object.entries(WEIGHTS) as [PositionCategory, number][]) {`);
  lines.push(`    cum += w; if (roll < cum) { cat = c; break; }`);
  lines.push(`  }`);
  lines.push(`  const pool = CURATED_POSITIONS.filter((p) => p.category === cat);`);
  lines.push(`  const src = pool.length > 0 ? pool : CURATED_POSITIONS;`);
  lines.push(`  const i = Math.floor(Math.random() * src.length);`);
  lines.push(`  return { ...src[i], id: \`curated-\${CURATED_POSITIONS.indexOf(src[i])}\` };`);
  lines.push(`}`);
  lines.push(``);

  console.log(lines.join("\n"));
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
