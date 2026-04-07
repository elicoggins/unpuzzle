#!/usr/bin/env node
/**
 * Removes positions marked as "delete" in sort-decisions.json from the
 * per-category TypeScript source files in src/lib/positions/.
 *
 * Usage:
 *   node scripts/remove-deleted.mjs                    # reads ./sort-decisions.json
 *   node scripts/remove-deleted.mjs path/to/file.json  # reads a custom path
 *
 * After running, the deleted positions are gone from the source files.
 * Positions marked "keep" (or not in the file at all) remain untouched.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSITIONS_DIR = join(__dirname, "..", "src", "lib", "positions");

const CATEGORIES = ["tactical", "balanced", "critical", "tricky", "endgame"];
const CONST_NAMES = {
  tactical: "TACTICAL_POSITIONS",
  balanced: "BALANCED_POSITIONS",
  critical: "CRITICAL_POSITIONS",
  tricky: "TRICKY_POSITIONS",
  endgame: "ENDGAME_POSITIONS",
};

// ── Load decisions ──────────────────────────────────────────────────────────

const decisionsPath = process.argv[2] || join(__dirname, "..", "sort-decisions.json");
let decisions;
try {
  decisions = JSON.parse(readFileSync(decisionsPath, "utf-8"));
} catch (e) {
  process.stderr.write(`Error: could not read ${decisionsPath}\n`);
  process.stderr.write(`  ${e.message}\n\n`);
  process.stderr.write(`Make sure you've exported sort-decisions.json from the /sort page\n`);
  process.stderr.write(`and placed it in the project root (or pass a custom path as argument).\n`);
  process.exit(1);
}

const toDelete = new Set(
  Object.entries(decisions)
    .filter(([, v]) => v === "delete")
    .map(([k]) => k)
);

const toKeep = new Set(
  Object.entries(decisions)
    .filter(([, v]) => v === "keep")
    .map(([k]) => k)
);

process.stderr.write(`Loaded ${Object.keys(decisions).length} decisions from ${decisionsPath}\n`);
process.stderr.write(`  ${toKeep.size} keep, ${toDelete.size} delete\n\n`);

if (toDelete.size === 0) {
  process.stderr.write("Nothing to delete. Exiting.\n");
  process.exit(0);
}

// ── Process each category file ──────────────────────────────────────────────

let totalBefore = 0;
let totalAfter = 0;

for (const cat of CATEGORIES) {
  const filePath = join(POSITIONS_DIR, `${cat}.ts`);
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    process.stderr.write(`  Skipping ${cat}.ts (file not found)\n`);
    continue;
  }

  // Parse: extract individual position lines between the array brackets
  const lines = content.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(`${CONST_NAMES[cat]}: CuratedPosition[]`));
  if (startIdx === -1) {
    process.stderr.write(`  Skipping ${cat}.ts (could not find array declaration)\n`);
    continue;
  }

  // Collect position lines (lines that start with "  { id:")
  const header = lines.slice(0, startIdx + 1);
  const positionLines = [];
  const footer = [];
  let inArray = true;

  for (let i = startIdx + 1; i < lines.length; i++) {
    if (inArray && lines[i].trimStart().startsWith("{ id:")) {
      positionLines.push(lines[i]);
    } else if (inArray && lines[i].trim() === "];") {
      inArray = false;
      footer.push(lines[i]);
    } else if (!inArray) {
      footer.push(lines[i]);
    }
  }

  const before = positionLines.length;
  totalBefore += before;

  // Filter out deleted positions
  const kept = positionLines.filter((line) => {
    const match = line.match(/id:\s*"([^"]+)"/);
    if (!match) return true; // keep lines we can't parse
    return !toDelete.has(match[1]);
  });

  const after = kept.length;
  totalAfter += after;
  const removed = before - after;

  // Rewrite file
  const output = [...header, ...kept, ...footer].join("\n");
  writeFileSync(filePath, output);

  process.stderr.write(`  ${cat}: ${before} → ${after} (removed ${removed})\n`);
}

process.stderr.write(`\nDone! ${totalBefore} → ${totalAfter} total (removed ${totalBefore - totalAfter})\n`);
