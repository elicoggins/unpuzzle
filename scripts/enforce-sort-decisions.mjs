#!/usr/bin/env node
/**
 * Enforces sort decisions from sort-decisions.json on the per-category
 * TypeScript source files in src/lib/positions/:
 *
 *   - "delete" → removes the position from its file
 *   - "keep"   → sets markedKeeper: true on the position
 *
 * Usage:
 *   node scripts/enforce-sort-decisions.mjs                    # reads ./sort-decisions.json
 *   node scripts/enforce-sort-decisions.mjs path/to/file.json  # reads a custom path
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

if (toDelete.size === 0 && toKeep.size === 0) {
  process.stderr.write("No decisions to enforce. Exiting.\n");
  process.exit(0);
}

// ── Process each category file ──────────────────────────────────────────────

let totalBefore = 0;
let totalAfter = 0;
let totalMarked = 0;

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

  let markedInFile = 0;

  // Apply decisions: delete removed, set markedKeeper: true for keepers
  const processed = positionLines
    .filter((line) => {
      const match = line.match(/id:\s*"([^"]+)"/);
      if (!match) return true; // keep lines we can't parse
      return !toDelete.has(match[1]);
    })
    .map((line) => {
      const match = line.match(/id:\s*"([^"]+)"/);
      if (!match) return line;
      const id = match[1];
      if (!toKeep.has(id)) return line;

      // Set markedKeeper: true
      let updated;
      if (/markedKeeper:\s*(true|false)/.test(line)) {
        updated = line.replace(/markedKeeper:\s*(true|false)/, "markedKeeper: true");
      } else {
        // Field missing — insert before closing }
        updated = line.replace(/ \},\s*$/, ", markedKeeper: true },");
      }
      if (updated !== line) markedInFile++;
      return updated;
    });

  const after = processed.length;
  totalAfter += after;
  totalMarked += markedInFile;
  const removed = before - after;

  // Rewrite file
  const output = [...header, ...processed, ...footer].join("\n");
  writeFileSync(filePath, output);

  const parts = [];
  if (removed > 0) parts.push(`removed ${removed}`);
  if (markedInFile > 0) parts.push(`marked ${markedInFile} keeper${markedInFile !== 1 ? "s" : ""}`);
  const summary = parts.length > 0 ? ` (${parts.join(", ")})` : " (no changes)";
  process.stderr.write(`  ${cat}: ${before} → ${after}${summary}\n`);
}

process.stderr.write(`\nDone!\n`);
if (toDelete.size > 0) process.stderr.write(`  Positions removed: ${totalBefore - totalAfter}\n`);
if (toKeep.size > 0) process.stderr.write(`  Positions marked as keeper: ${totalMarked}\n`);
