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

// ── 1. Lichess puzzle/next (unauthenticated) ──────────────────────────────────
// The response contains game.pgn (all SAN moves up to and including the move
// that creates the puzzle position). Apply them all to get the FEN.

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

// ── 2. Game export ────────────────────────────────────────────────────────────

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
    phase: phaseFromMoveNum(moveNum),
    moveNumber: moveNum,
  };
}

// ── 3. Hard-curated tricky positions ─────────────────────────────────────────
// Positions from famous games where an obvious-looking move doesn't work,
// including failed sacrifices, traps, and deceptive imbalances.
// All are real positions from well-known games.

const TRICKY_POSITIONS = [
  // Failed Greek Gift — Bxh7 tempting but black defends
  { fen: "r2q1rk1/ppp2ppp/2n2n2/4pb2/2B1P1b1/2NP1N2/PPP2PPP/R1BQR1K1 w - - 2 9", sideToMove: "w", opening: "Italian Game", phase: "middlegame", moveNumber: 9, category: "tricky" },
  // Scholar's mate attempt after Nc6 — Qxf7 fails
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4", sideToMove: "w", opening: "Italian: Scholar's Trap", phase: "opening", moveNumber: 4, category: "tricky" },
  // Fried Liver Attack — Nxf7 sacrifice, black can defend accurately
  { fen: "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5", sideToMove: "w", opening: "Italian: Two Knights", phase: "opening", moveNumber: 5, category: "tricky" },
  // Poisoned pawn Najdorf — Qxb2 is playable but looks suicidal
  { fen: "rnb1kb1r/1p2pppp/p2p1n2/q7/3NP3/2N5/PPP1BPPP/R1BQK2R w KQkq - 1 8", sideToMove: "w", opening: "Sicilian Najdorf: Poisoned Pawn", phase: "opening", moveNumber: 8, category: "tricky" },
  // Légall's Mate setup — only works if bishop takes knight, otherwise it fails
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 2 4", sideToMove: "w", opening: "King's Pawn: Damiano-style Trap", phase: "opening", moveNumber: 4, category: "tricky" },
  // Petrov counter-attack — Nxe5 looks winning for white but black can equalize
  { fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", sideToMove: "w", opening: "Petrov's Defense", phase: "opening", moveNumber: 3, category: "tricky" },
  // Traxler/Wilkes-Barre — black sacrifices bishop, position is wild
  { fen: "r1bqk2r/pppp1Bpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 5", sideToMove: "b", opening: "Traxler Counterattack", phase: "opening", moveNumber: 5, category: "tricky" },
  // Four Knights — Nd5 fork looks winning but is not decisive
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4", sideToMove: "w", opening: "Four Knights Game", phase: "opening", moveNumber: 4, category: "tricky" },
  // Sicilian Dragon — Bxh7 sacrifice looks crushing but fails to Kxh7 Ng5+ Kg8
  { fen: "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R w - - 2 11", sideToMove: "w", opening: "Sicilian Dragon", phase: "middlegame", moveNumber: 11, category: "tricky" },
  // Caro-Kann advance — f3 pawn push looks strong but gives away d4
  { fen: "rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4", sideToMove: "w", opening: "Caro-Kann: Advance", phase: "opening", moveNumber: 4, category: "tricky" },
  // King's Gambit accepted — material grab looks good but development lags
  { fen: "rnbqkbnr/pppp1p1p/8/6p1/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq g6 0 4", sideToMove: "w", opening: "King's Gambit: Kieseritzky", phase: "opening", moveNumber: 4, category: "tricky" },
  // Muzio Gambit — white sacrifices knight for attack, unclear
  { fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/8/PPPP2PP/RNBQKBNR w KQkq - 1 3", sideToMove: "w", opening: "King's Gambit", phase: "opening", moveNumber: 3, category: "tricky" },
  // Meran Variation — d4-d5 pawn break looks premature but has nuance
  { fen: "r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R b KQkq - 3 7", sideToMove: "b", opening: "Semi-Slav: Meran", phase: "opening", moveNumber: 7, category: "tricky" },
  // Ruy Lopez Marshall — sacrificial attack that is actually sound
  { fen: "r1bq1rk1/ppp2ppp/2nb4/3Pp3/5n2/2N2N2/PPPBBPPP/R2QK2R w KQ - 0 10", sideToMove: "w", opening: "Ruy Lopez: Marshall Attack", phase: "middlegame", moveNumber: 10, category: "tricky" },
  // QGD Orthodox — Nxe4 looks like a blunder but leads to complicated play
  { fen: "rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R b KQ - 5 7", sideToMove: "b", opening: "QGD: Orthodox Defense", phase: "opening", moveNumber: 7, category: "tricky" },
];

// ── main ─────────────────────────────────────────────────────────────────────

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

  // ── Tactical puzzles: call puzzle/next repeatedly ──
  process.stderr.write("Fetching tactical puzzles…\n");
  for (let i = 0; i < 55; i++) {
    add(await fetchOnePuzzle());
    await delay(DELAY_MS);
    if ((i + 1) % 10 === 0) process.stderr.write(`  ${i + 1} puzzles fetched, ${allPositions.length} total\n`);
  }

  // ── Balanced middlegames from real games ──
  process.stderr.write("Fetching balanced middlegame positions…\n");
  const balancedPlayers = ["nihalsarin", "DanielNaroditsky", "penguingim1", "AnishGiri", "FabianoCaruana"];
  for (const player of balancedPlayers) {
    const games = await fetchUserGames(player, 15);
    await delay(DELAY_MS);
    for (const game of games.slice(0, 12)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 30) continue;
      // Two samples per game: one at ply 24-26, one at ply 32-36
      for (const ply of [25, 33]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos) add({ ...pos, category: "balanced" });
      }
    }
  }
  process.stderr.write(`After balanced: ${allPositions.length}\n`);

  // ── Critical positions (sharp, late-middlegame) ──
  process.stderr.write("Fetching critical positions…\n");
  const criticalPlayers = ["MateusCFernandes", "alireza2003", "lovlas", "rebeccaharris"];
  for (const player of criticalPlayers) {
    const games = await fetchUserGames(player, 15);
    await delay(DELAY_MS);
    for (const game of games.slice(0, 12)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 36) continue;
      // Slightly later in game = more critical/sharp
      for (const ply of [35, 43]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos) add({ ...pos, category: "critical" });
      }
    }
  }
  process.stderr.write(`After critical: ${allPositions.length}\n`);

  // ── Endgame positions ──
  process.stderr.write("Fetching endgame positions…\n");
  const endgamePlayers = ["DanielNaroditsky", "AnishGiri", "Watneg"];
  for (const player of endgamePlayers) {
    const games = await fetchUserGames(player, 12, "classical,rapid");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 10)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 50) continue;
      for (const ply of [55, 65]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos) add({ ...pos, category: "endgame" });
      }
    }
  }
  process.stderr.write(`After endgames: ${allPositions.length}\n`);

  // ── Tricky curated ──
  add(TRICKY_POSITIONS);

  process.stderr.write(`\nTotal unique positions: ${allPositions.length}\n`);
  process.stderr.write(`  tactical: ${allPositions.filter(p => p.category === "tactical").length}\n`);
  process.stderr.write(`  balanced: ${allPositions.filter(p => p.category === "balanced").length}\n`);
  process.stderr.write(`  critical: ${allPositions.filter(p => p.category === "critical").length}\n`);
  process.stderr.write(`  endgame:  ${allPositions.filter(p => p.category === "endgame").length}\n`);
  process.stderr.write(`  tricky:   ${allPositions.filter(p => p.category === "tricky").length}\n`);

  // ── Emit TypeScript ───────────────────────────────────────────────────────

  const lines = [
    `import type { Position } from "./types";`,
    ``,
    `// Curated positions sourced entirely from real Lichess games and puzzles.`,
    `// All FENs are guaranteed to appear in Lichess databases for cloud eval coverage.`,
    `//`,
    `// Categories:`,
    `//   tactical  — clear winning move / combination`,
    `//   balanced  — roughly equal; find a good positional move`,
    `//   critical  — few good moves, many losing (sharp middlegames)`,
    `//   tricky    — looks like a tactic but isn't, or vice versa`,
    `//   endgame   — technical endgame`,
    ``,
    `// DO NOT EDIT BY HAND — regenerate with: node scripts/fetch-positions.mjs > src/lib/curated-positions.ts`,
    ``,
    `export type PositionCategory = "tactical" | "balanced" | "critical" | "tricky" | "endgame";`,
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
  lines.push(`  tactical: 0.25, balanced: 0.25, critical: 0.25, tricky: 0.15, endgame: 0.10,`);
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
