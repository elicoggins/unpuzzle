#!/usr/bin/env node
/**
 * Fetches real chess positions from Lichess APIs and writes per-category
 * TypeScript source files into src/lib/positions/.
 *
 * Run from the project root:
 *   node scripts/fetch-positions.mjs
 *
 * Output files (DO NOT HAND-EDIT — they will be overwritten):
 *   src/lib/positions/tactical.ts
 *   src/lib/positions/balanced.ts
 *   src/lib/positions/critical.ts
 *   src/lib/positions/tricky.ts
 *   src/lib/positions/endgame.ts
 */

import { Chess } from "chess.js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const DELAY_MS = 1400;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "lib", "positions");

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
  if (mat <= 26) return "endgame";
  if (mat <= 46) return "middlegame";
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

// ── 1. Lichess puzzle/next (random) ─────────────────────────────────────────

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
    puzzleRating: data.puzzle?.rating ?? null,
  };
}

// ── 1b. Themed tactical puzzles ─────────────────────────────────────────────

const TACTICAL_THEMES = [
  "mate", "mateIn2", "mateIn3", "fork", "pin", "skewer",
  "discoveredAttack", "doubleCheck", "hangingPiece", "attraction",
  "clearance", "backRankMate", "smotheredMate", "arabianMate",
];

async function fetchThemedPuzzle(theme, category) {
  const res = await safeFetch(
    `https://lichess.org/api/puzzle/next?angle=${theme}`,
    { headers: { Accept: "application/json" } },
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
    category,
    puzzleRating: data.puzzle?.rating ?? null,
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
    { headers: { Accept: "application/x-ndjson" } },
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
const TRICKY_THEMES = [
  "equality", "advantage", "sacrifice", "trapping",
  "deflection", "decoy", "interference", "zugzwang",
  "quietMove", "defensiveMove", "underPromotion",
  "enPassant", "xRayAttack", "intermezzo",
];

// ── player lists ────────────────────────────────────────────────────────────

const GM_MIDDLEGAME = [
  "nihalsarin", "DanielNaroditsky", "penguingim1", "AnishGiri", "FabianoCaruana",
  "alireza2003", "DrNykterstein", "vincentkeymer", "BogdanDeac", "RaunakSadhwani",
  "JGBT", "lovlas", "LyonBeast", "GMHikaru", "Nodirbek",
  "Zhigalko_Sergei", "MateusCFernandes",
];

const GM_ENDGAME = [
  "DanielNaroditsky", "AnishGiri", "alireza2003", "DrNykterstein",
  "lovlas", "GMHikaru", "Nodirbek", "Zhigalko_Sergei",
  "nihalsarin", "penguingim1", "BogdanDeac", "RaunakSadhwani",
  "LyonBeast", "MateusCFernandes", "RebeccaHarris",
  "JGBT", "vincentkeymer", "FabianoCaruana",
];

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const allPositions = [];
  const seen = new Set();

  function add(items) {
    let added = 0;
    for (const p of (Array.isArray(items) ? items : [items])) {
      if (!p?.fen || seen.has(p.fen)) continue;
      try { new Chess(p.fen); } catch { continue; }
      seen.add(p.fen);
      allPositions.push(p);
      added++;
    }
    return added;
  }

  // ── Tactical puzzles (random) ─────────────────────────────────────────
  process.stderr.write("Fetching tactical puzzles (random)…\n");
  for (let i = 0; i < 100; i++) {
    add(await fetchOnePuzzle());
    await delay(DELAY_MS);
  }
  process.stderr.write(`After random puzzles: ${allPositions.length}\n`);

  // ── Tactical puzzles (themed — high-yield tactical themes) ────────────
  process.stderr.write("Fetching tactical puzzles (themed)…\n");
  for (let round = 0; round < 8; round++) {
    for (const theme of TACTICAL_THEMES) {
      add(await fetchThemedPuzzle(theme, "tactical"));
      await delay(DELAY_MS);
    }
  }
  process.stderr.write(`After themed tactical: ${allPositions.length}\n`);

  // ── Middlegame positions from master games ────────────────────────────
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

  // ── Late middlegame / critical positions ──────────────────────────────
  process.stderr.write("Fetching critical/sharp middlegame positions…\n");
  for (const player of GM_MIDDLEGAME) {
    const games = await fetchUserGames(player, 18, "rapid,classical");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 18)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 40) continue;
      for (const ply of [35, 39, 43, 47]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos) add({ ...pos, category: "critical" });
      }
    }
  }
  process.stderr.write(`After critical: ${allPositions.length}\n`);

  // ── Endgame positions from classical/rapid master games ───────────────
  process.stderr.write("Fetching GM endgame positions…\n");
  for (const player of GM_ENDGAME) {
    const games = await fetchUserGames(player, 20, "classical,rapid");
    await delay(DELAY_MS);
    for (const game of games.slice(0, 18)) {
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 52) continue;
      for (const ply of [51, 55, 63, 71, 81, 91]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos && materialCount(pos.fen) <= 38) add({ ...pos, category: "endgame" });
      }
    }
    process.stderr.write(`  ${player} → ${allPositions.length} total\n`);
  }
  process.stderr.write(`After endgames: ${allPositions.length}\n`);

  // ── Tricky positions from Lichess puzzle themes ──────────────────────
  process.stderr.write("Fetching tricky/thematic puzzles…\n");
  for (let round = 0; round < 8; round++) {
    for (const theme of TRICKY_THEMES) {
      add(await fetchThemedPuzzle(theme, "tricky"));
      await delay(DELAY_MS);
    }
  }
  process.stderr.write(`After tricky: ${allPositions.length}\n`);

  // ── Summary ───────────────────────────────────────────────────────────
  const cats = { tactical: [], balanced: [], critical: [], tricky: [], endgame: [] };
  for (const p of allPositions) {
    (cats[p.category] ?? []).push(p);
  }

  process.stderr.write(`\nTotal unique positions: ${allPositions.length}\n`);
  for (const [cat, positions] of Object.entries(cats)) {
    process.stderr.write(`  ${cat}: ${positions.length}\n`);
  }

  // ── Write per-category TypeScript files ────────────────────────────────
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [cat, positions] of Object.entries(cats)) {
    const constName = `${cat.toUpperCase()}_POSITIONS`;
    const lines = [
      `import type { CuratedPosition } from "./index";`,
      ``,
      `// DO NOT EDIT BY HAND — regenerate with: node scripts/fetch-positions.mjs`,
      ``,
      `export const ${constName}: CuratedPosition[] = [`,
    ];
    for (const p of positions) {
      const ratingPart = p.puzzleRating != null ? `, puzzleRating: ${p.puzzleRating}` : "";
      lines.push(`  { fen: ${JSON.stringify(p.fen)}, sideToMove: "${p.sideToMove}", opening: ${JSON.stringify(p.opening)}, phase: "${p.phase}", moveNumber: ${p.moveNumber}, category: "${p.category}"${ratingPart} },`);
    }
    lines.push(`];`);
    lines.push(``);

    const outPath = join(OUT_DIR, `${cat}.ts`);
    writeFileSync(outPath, lines.join("\n"));
    process.stderr.write(`Wrote ${outPath} (${positions.length} positions)\n`);
  }

  process.stderr.write("\nDone! Per-category files written to src/lib/positions/\n");
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
