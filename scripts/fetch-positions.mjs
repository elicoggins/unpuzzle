#!/usr/bin/env node
/**
 * Fetches real chess positions from Lichess APIs and writes per-category
 * TypeScript source files into src/lib/positions/.
 *
 * By default APPENDS to existing position files. Use --rebuild to replace.
 *
 * Usage:
 *   node scripts/fetch-positions.mjs --categories tactical:60,tricky:60
 *   node scripts/fetch-positions.mjs --categories tactical,tricky
 *   node scripts/fetch-positions.mjs                        # append to all, using default targets
 *   node scripts/fetch-positions.mjs --rebuild               # full rebuild of all categories
 *   node scripts/fetch-positions.mjs --rebuild --categories tactical
 *   node scripts/fetch-positions.mjs --delay 3000            # custom delay (ms) between requests
 *
 * Output files:
 *   src/lib/positions/tactical.ts
 *   src/lib/positions/balanced.ts
 *   src/lib/positions/critical.ts
 *   src/lib/positions/tricky.ts
 *   src/lib/positions/endgame.ts
 */

import { Chess } from "chess.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createReadStream } from "fs";
import { createInterface } from "readline";

// ── constants ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "lib", "positions");
const CACHE_DIR = join(__dirname, "..", ".puzzle-cache");
const PUZZLE_CSV_ZST = join(CACHE_DIR, "lichess_db_puzzle.csv.zst");
const PUZZLE_CSV = join(CACHE_DIR, "lichess_db_puzzle.csv");
const PUZZLE_DB_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst";

const DEFAULT_DELAY_MS = 2500;
const MAX_RETRIES = 3;

const ALL_CATEGORIES = ["tactical", "balanced", "critical", "tricky", "endgame"];

/** Default target totals when no explicit count is given. */
const DEFAULT_TARGETS = {
  tactical: 80,
  balanced: 120,
  critical: 80,
  tricky: 80,
  endgame: 100,
};

const TACTICAL_THEMES = [
  "mate", "mateIn2", "mateIn3", "fork", "pin", "skewer",
  "discoveredAttack", "doubleCheck", "hangingPiece", "attraction",
  "clearance", "backRankMate", "smotheredMate", "arabianMate",
];

const TRICKY_THEMES = [
  "equality", "advantage", "sacrifice", "trapping",
  "deflection", "decoy", "interference", "zugzwang",
  "quietMove", "defensiveMove", "underPromotion",
  "enPassant", "xRayAttack", "intermezzo",
];

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

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { rebuild: false, categories: null, delay: DEFAULT_DELAY_MS };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rebuild") {
      result.rebuild = true;
    } else if (args[i] === "--categories" && args[i + 1]) {
      result.categories = {};
      for (const part of args[++i].split(",")) {
        const [name, count] = part.split(":");
        result.categories[name.trim()] = count ? parseInt(count, 10) : null;
      }
    } else if (args[i] === "--delay" && args[i + 1]) {
      result.delay = parseInt(args[++i], 10);
    } else if (args[i] === "--help" || args[i] === "-h") {
      process.stderr.write(
        `Usage: node scripts/fetch-positions.mjs [options]\n\n` +
        `Options:\n` +
        `  --categories cat1:N,cat2:N   Categories to fetch (with optional target totals)\n` +
        `  --rebuild                     Replace existing positions (default: append)\n` +
        `  --delay MS                    Delay between API requests in ms (default: ${DEFAULT_DELAY_MS})\n` +
        `\nCategories: ${ALL_CATEGORIES.join(", ")}\n` +
        `\nExamples:\n` +
        `  node scripts/fetch-positions.mjs --categories tactical:60,tricky:60\n` +
        `  node scripts/fetch-positions.mjs --rebuild --categories tactical\n` +
        `  node scripts/fetch-positions.mjs --delay 3000\n`,
      );
      process.exit(0);
    }
  }

  return result;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** FNV-1a 32-bit hash → 8-char hex */
function fnvHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const CAT_PREFIX = { tactical: "tac", balanced: "bal", critical: "crt", tricky: "tri", endgame: "end" };
function positionId(fen, category) {
  return `${CAT_PREFIX[category] ?? "unk"}_${fnvHash(fen)}`;
}

function sideFromFen(fen) { return fen.split(" ")[1] ?? "w"; }
function moveNumFromFen(fen) { return parseInt(fen.split(" ")[5] ?? "1", 10); }
function phaseFromMoveNum(n) {
  if (n <= 10) return "opening";
  if (n <= 28) return "middlegame";
  return "endgame";
}

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
  return "middlegame";
}

function fenFromSanMoves(sanMovesStr) {
  const chess = new Chess();
  const moves = sanMovesStr.trim().split(/\s+/);
  for (const san of moves) {
    try { if (!chess.move(san)) break; } catch { break; }
  }
  return chess.fen();
}

// ── rate-limited fetch with backoff ──────────────────────────────────────────

async function safeFetch(url, opts = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), ...opts });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") ?? "60", 10);
        const waitSec = Math.max(retryAfter, 60) * (attempt + 1);
        process.stderr.write(`  ⏳ 429 rate-limited — waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})…\n`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        process.stderr.write(`  HTTP ${res.status}: ${url}\n`);
        return null;
      }
      return res;
    } catch (e) {
      process.stderr.write(`  Error: ${e.message} — ${url}\n`);
      if (attempt < MAX_RETRIES) await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}

// ── read existing positions from TS files ────────────────────────────────────

function readExistingFile(category) {
  const filePath = join(OUT_DIR, `${category}.ts`);
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  const positions = [];

  for (const line of content.split("\n")) {
    if (!line.trim().startsWith("{")) continue;

    const id = line.match(/id:\s*"([^"]+)"/)?.[1];
    const fen = line.match(/fen:\s*"([^"]+)"/)?.[1];
    if (!id || !fen) continue;

    const sideToMove = line.match(/sideToMove:\s*"([wb])"/)?.[1] ?? "w";
    const openingMatch = line.match(/opening:\s*(?:"([^"]*)"|null)/);
    const opening = openingMatch?.[1] ?? null;
    const phase = line.match(/phase:\s*"([^"]+)"/)?.[1] ?? "middlegame";
    const moveNumber = parseInt(line.match(/moveNumber:\s*(\d+)/)?.[1] ?? "1", 10);
    const cat = line.match(/category:\s*"([^"]+)"/)?.[1] ?? category;
    const ratingMatch = line.match(/puzzleRating:\s*(\d+)/);
    const puzzleRating = ratingMatch ? parseInt(ratingMatch[1], 10) : null;
    const keeperMatch = line.match(/markedKeeper:\s*(true|false)/);
    const markedKeeper = keeperMatch?.[1] === "true";

    positions.push({ id, fen, sideToMove, opening, phase, moveNumber, category: cat, puzzleRating, markedKeeper });
  }

  return positions;
}

// ── Puzzle database (offline CSV — no API calls) ─────────────────────────────

/**
 * Download + decompress the Lichess puzzle CSV if not already cached.
 * Requires `zstd` CLI (brew install zstd).
 */
async function ensurePuzzleDb() {
  mkdirSync(CACHE_DIR, { recursive: true });

  if (existsSync(PUZZLE_CSV)) {
    process.stderr.write(`Puzzle DB already cached at ${PUZZLE_CSV}\n`);
    return;
  }

  if (!existsSync(PUZZLE_CSV_ZST)) {
    process.stderr.write(`Downloading puzzle database (~250 MB compressed)…\n`);
    process.stderr.write(`  From: ${PUZZLE_DB_URL}\n`);
    execSync(`curl -L -o "${PUZZLE_CSV_ZST}" "${PUZZLE_DB_URL}"`, { stdio: "inherit" });
    process.stderr.write(`Download complete.\n`);
  }

  process.stderr.write(`Decompressing puzzle database (this takes a moment)…\n`);
  execSync(`zstd -d "${PUZZLE_CSV_ZST}" -o "${PUZZLE_CSV}"`, { stdio: "inherit" });
  process.stderr.write(`Decompression complete.\n`);
}

/**
 * Stream-read the puzzle CSV and collect candidates matching any of the given
 * themes. Returns a shuffled array of parsed puzzle rows.
 *
 * CSV cols: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Per Lichess docs: FEN is BEFORE the opponent's move. The position to present
 * is after applying the FIRST move in the Moves field.
 */
async function loadPuzzleCandidates(themeSet, { minRating = 1200, maxRating = 2400, minPopularity = 70, maxCandidates = 5000 } = {}) {
  const candidates = [];

  const rl = createInterface({
    input: createReadStream(PUZZLE_CSV, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // header

    const cols = line.split(",");
    if (cols.length < 8) continue;

    const rating = parseInt(cols[3], 10);
    const popularity = parseInt(cols[5], 10);
    const themes = cols[7].trim().split(/\s+/);

    if (rating < minRating || rating > maxRating) continue;
    if (popularity < minPopularity) continue;

    const hasMatch = themes.some((t) => themeSet.has(t));
    if (!hasMatch) continue;

    candidates.push({
      puzzleId: cols[0],
      fen: cols[1],           // FEN before opponent's move
      moves: cols[2],         // UCI moves
      rating,
      themes,
    });

    // Collect a generous pool, then stop scanning
    if (candidates.length >= maxCandidates) break;
  }

  // Shuffle (Fisher-Yates)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}

/**
 * Apply the first move from the puzzle's UCI move list to get the position
 * that should be presented to the player.
 */
function puzzleToPosition(puzzle, category) {
  const uciMoves = puzzle.moves.trim().split(/\s+/);
  if (uciMoves.length < 1) return null;

  try {
    const game = new Chess(puzzle.fen);
    const firstUci = uciMoves[0];
    const m = game.move({
      from: firstUci.slice(0, 2),
      to: firstUci.slice(2, 4),
      promotion: firstUci.length > 4 ? firstUci[4] : undefined,
    });
    if (!m) return null;

    const fen = game.fen();
    const moveNum = moveNumFromFen(fen);
    return {
      fen,
      sideToMove: sideFromFen(fen),
      opening: null,
      phase: phaseFromMoveNum(moveNum),
      moveNumber: moveNum,
      category,
      puzzleRating: puzzle.rating,
    };
  } catch {
    return null;
  }
}

/**
 * Pick positions from the local puzzle DB for a puzzle-based category
 * (tactical or tricky). Zero API calls.
 */
async function fetchPuzzleCategoryFromDb(needed, seen, existing, themes, category) {
  await ensurePuzzleDb();

  const themeSet = new Set(themes);
  const maxCandidates = Math.max(needed * 20, 2000);

  process.stderr.write(`  Loading puzzle candidates for ${category} (themes: ${themes.join(", ")})…\n`);
  const candidates = await loadPuzzleCandidates(themeSet, { maxCandidates });
  process.stderr.write(`  Found ${candidates.length} candidate puzzles\n`);

  const newPositions = [];
  let whiteCount = existing.filter((p) => p.sideToMove === "w").length;
  let blackCount = existing.filter((p) => p.sideToMove === "b").length;
  let scanned = 0;

  for (const puzzle of candidates) {
    if (newPositions.length >= needed) break;
    scanned++;

    const pos = puzzleToPosition(puzzle, category);
    if (!pos || seen.has(pos.fen)) continue;

    // Validate FEN
    try { new Chess(pos.fen); } catch { continue; }

    // Soft color balance: if one side is >62%, probabilistically skip
    const total = whiteCount + blackCount;
    if (total >= 6) {
      const sideCount = pos.sideToMove === "w" ? whiteCount : blackCount;
      if (sideCount / total > 0.62 && Math.random() < 0.6) continue;
    }

    seen.add(pos.fen);
    newPositions.push(pos);
    if (pos.sideToMove === "w") whiteCount++;
    else blackCount++;

    if (newPositions.length % 10 === 0 || newPositions.length === needed) {
      process.stderr.write(
        `  ${category}: +${newPositions.length}/${needed} (W:${whiteCount} B:${blackCount})\n`,
      );
    }
  }

  if (newPositions.length < needed) {
    process.stderr.write(`  ⚠ Only got ${newPositions.length}/${needed} from ${scanned} scanned candidates\n`);
  }

  process.stderr.write(
    `  ${category} final balance: W:${whiteCount} B:${blackCount} ` +
    `(${Math.round((whiteCount / (whiteCount + blackCount)) * 100)}% / ` +
    `${Math.round((blackCount / (whiteCount + blackCount)) * 100)}%)\n`,
  );

  return newPositions;
}

// ── game-based fetchers (balanced, critical, endgame) ────────────────────────

async function fetchUserGames(username, max, perfType, delayMs) {
  const params = new URLSearchParams({
    max: String(max),
    opening: "true",
    pgnInJson: "true",
    rated: "true",
    perfType,
    moves: "true",
  });
  process.stderr.write(`    Fetching games for ${username}…\n`);
  const res = await safeFetch(
    `https://lichess.org/api/games/user/${username}?${params}`,
    { headers: { Accept: "application/x-ndjson" } },
  );
  if (!res) return [];
  const text = await res.text();
  await sleep(delayMs);
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
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

async function fetchBalancedPositions(needed, seen, _existing, opts) {
  const newPositions = [];
  for (const player of GM_MIDDLEGAME) {
    if (newPositions.length >= needed) break;
    const games = await fetchUserGames(player, 18, "blitz,rapid,classical", opts.delay);
    for (const game of games.slice(0, 15)) {
      if (newPositions.length >= needed) break;
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 30) continue;
      for (const ply of [24, 25, 32, 33, 40, 41]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos && pos.phase === "middlegame" && !seen.has(pos.fen)) {
          try { new Chess(pos.fen); } catch { continue; }
          seen.add(pos.fen);
          newPositions.push({ ...pos, category: "balanced" });
        }
      }
    }
    process.stderr.write(`  balanced: +${newPositions.length}/${needed} (after ${player})\n`);
  }
  return newPositions;
}

async function fetchCriticalPositions(needed, seen, _existing, opts) {
  const newPositions = [];
  for (const player of GM_MIDDLEGAME) {
    if (newPositions.length >= needed) break;
    const games = await fetchUserGames(player, 18, "rapid,classical", opts.delay);
    for (const game of games.slice(0, 18)) {
      if (newPositions.length >= needed) break;
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 40) continue;
      for (const ply of [34, 35, 38, 39, 42, 43, 46, 47]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos && !seen.has(pos.fen)) {
          try { new Chess(pos.fen); } catch { continue; }
          seen.add(pos.fen);
          newPositions.push({ ...pos, category: "critical" });
        }
      }
    }
    process.stderr.write(`  critical: +${newPositions.length}/${needed} (after ${player})\n`);
  }
  return newPositions;
}

async function fetchEndgamePositions(needed, seen, _existing, opts) {
  const newPositions = [];
  for (const player of GM_ENDGAME) {
    if (newPositions.length >= needed) break;
    const games = await fetchUserGames(player, 20, "classical,rapid", opts.delay);
    for (const game of games.slice(0, 18)) {
      if (newPositions.length >= needed) break;
      const moves = (game.moves ?? "").trim().split(/\s+/);
      if (moves.length < 52) continue;
      for (const ply of [50, 51, 54, 55, 62, 63, 70, 71, 80, 81, 90, 91]) {
        if (ply >= moves.length) continue;
        const pos = extractPositionFromGame(game, ply);
        if (pos && materialCount(pos.fen) <= 38 && !seen.has(pos.fen)) {
          try { new Chess(pos.fen); } catch { continue; }
          seen.add(pos.fen);
          newPositions.push({ ...pos, category: "endgame" });
        }
      }
    }
    process.stderr.write(`  endgame: +${newPositions.length}/${needed} (after ${player})\n`);
  }
  return newPositions;
}

// ── file writer ──────────────────────────────────────────────────────────────

function writeCategory(category, positions) {
  mkdirSync(OUT_DIR, { recursive: true });
  const constName = `${category.toUpperCase()}_POSITIONS`;
  const lines = [
    `import type { CuratedPosition } from "./index";`,
    ``,
    `// DO NOT EDIT BY HAND — regenerate with: node scripts/fetch-positions.mjs`,
    ``,
    `export const ${constName}: CuratedPosition[] = [`,
  ];
  for (const p of positions) {
    const id = positionId(p.fen, p.category);
    const ratingPart = p.puzzleRating != null ? `, puzzleRating: ${p.puzzleRating}` : "";
    const keeperPart = p.markedKeeper ? `, markedKeeper: true` : `, markedKeeper: false`;
    lines.push(
      `  { id: "${id}", fen: ${JSON.stringify(p.fen)}, sideToMove: "${p.sideToMove}", opening: ${JSON.stringify(p.opening)}, phase: "${p.phase}", moveNumber: ${p.moveNumber}, category: "${p.category}"${ratingPart}${keeperPart} },`,
    );
  }
  lines.push(`];`);
  lines.push(``);

  const outPath = join(OUT_DIR, `${category}.ts`);
  writeFileSync(outPath, lines.join("\n"));
  process.stderr.write(`Wrote ${outPath} (${positions.length} positions)\n`);
}

// ── main ─────────────────────────────────────────────────────────────────────

const CATEGORY_FETCHERS = {
  tactical: (needed, seen, existing, _opts) =>
    fetchPuzzleCategoryFromDb(needed, seen, existing, TACTICAL_THEMES, "tactical"),
  tricky: (needed, seen, existing, _opts) =>
    fetchPuzzleCategoryFromDb(needed, seen, existing, TRICKY_THEMES, "tricky"),
  balanced: fetchBalancedPositions,
  critical: fetchCriticalPositions,
  endgame: fetchEndgamePositions,
};

async function main() {
  const opts = parseArgs();

  const categoriesToProcess = opts.categories
    ? Object.keys(opts.categories)
    : ALL_CATEGORIES;

  // Validate
  for (const cat of categoriesToProcess) {
    if (!ALL_CATEGORIES.includes(cat)) {
      process.stderr.write(`Unknown category: "${cat}". Valid: ${ALL_CATEGORIES.join(", ")}\n`);
      process.exit(1);
    }
  }

  process.stderr.write(`Mode: ${opts.rebuild ? "REBUILD" : "APPEND"}\n`);
  process.stderr.write(`Categories: ${categoriesToProcess.join(", ")}\n`);
  process.stderr.write(`Delay: ${opts.delay}ms\n\n`);

  // Load existing positions (always load ALL categories for global dedup)
  const existingByCategory = {};
  const seen = new Set();

  for (const cat of ALL_CATEGORIES) {
    if (opts.rebuild && categoriesToProcess.includes(cat)) {
      existingByCategory[cat] = [];
    } else {
      const existing = readExistingFile(cat);
      existingByCategory[cat] = existing;
      for (const p of existing) seen.add(p.fen);
    }
  }

  process.stderr.write(`Loaded ${seen.size} existing positions (across all categories)\n\n`);

  // Fetch per category
  for (const cat of categoriesToProcess) {
    const existing = existingByCategory[cat];
    const explicitTarget = opts.categories?.[cat];
    const target = explicitTarget ?? DEFAULT_TARGETS[cat];
    const needed = Math.max(0, target - existing.length);

    if (needed === 0) {
      process.stderr.write(`${cat}: already at ${existing.length} (target: ${target}), skipping\n\n`);
      continue;
    }

    process.stderr.write(`${cat}: have ${existing.length}, targeting ${target} → need ${needed} more\n`);

    const fetcher = CATEGORY_FETCHERS[cat];
    const newPositions = await fetcher(needed, seen, existing, opts);
    existingByCategory[cat].push(...newPositions);

    process.stderr.write(`\n`);
  }

  // Write files only for categories we processed
  process.stderr.write(`── Writing files ──\n`);
  for (const cat of categoriesToProcess) {
    writeCategory(cat, existingByCategory[cat]);
  }

  // Summary
  process.stderr.write(`\n── Summary ──\n`);
  for (const cat of categoriesToProcess) {
    const positions = existingByCategory[cat];
    const w = positions.filter((p) => p.sideToMove === "w").length;
    const b = positions.filter((p) => p.sideToMove === "b").length;
    process.stderr.write(`  ${cat}: ${positions.length} positions (W:${w} B:${b})\n`);
  }
  process.stderr.write(`\nDone!\n`);
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
