import type { Position, PositionCategory } from "../types";
import { CATEGORY_WEIGHTS } from "../constants";
// Position is used by getRandomPosition return type
import { TACTICAL_POSITIONS } from "./tactical";
import { BALANCED_POSITIONS } from "./balanced";
import { CRITICAL_POSITIONS } from "./critical";
import { TRICKY_POSITIONS } from "./tricky";
import { ENDGAME_POSITIONS } from "./endgame";

export type { PositionCategory };

export interface CuratedPosition {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  opening: string | null;
  phase: "opening" | "middlegame" | "endgame";
  moveNumber: number;
  category: PositionCategory;
  puzzleRating?: number | null;
  markedKeeper?: boolean;
}

const CATEGORY_POOLS: Record<PositionCategory, CuratedPosition[]> = {
  tactical: TACTICAL_POSITIONS,
  balanced: BALANCED_POSITIONS,
  critical: CRITICAL_POSITIONS,
  tricky: TRICKY_POSITIONS,
  endgame: ENDGAME_POSITIONS,
};

export function getWeightedRandomPosition(): CuratedPosition {
  const roll = Math.random();
  let cum = 0;
  let cat: PositionCategory = "balanced";
  for (const [c, w] of Object.entries(CATEGORY_WEIGHTS) as [PositionCategory, number][]) {
    cum += w; if (roll < cum) { cat = c; break; }
  }
  const pool = CATEGORY_POOLS[cat];
  const i = Math.floor(Math.random() * pool.length);
  return pool[i];
}

export function getRandomPosition(): Position {
  return getWeightedRandomPosition();
}

/** Flat array of every position across all categories. */
export function getAllPositions(): CuratedPosition[] {
  return Object.values(CATEGORY_POOLS).flat();
}

/** Per-category position counts. */
export function getPositionCounts(): Record<PositionCategory, number> {
  const counts = {} as Record<PositionCategory, number>;
  for (const [cat, pool] of Object.entries(CATEGORY_POOLS) as [PositionCategory, CuratedPosition[]][]) {
    counts[cat] = pool.length;
  }
  return counts;
}

/** Pick a random position whose id is NOT in `decisions`. Returns null when all are sorted. */
export function getUnsortedPosition(decisions: Record<string, string>): CuratedPosition | null {
  const unsorted = getAllPositions().filter((p) => !(p.id in decisions));
  if (unsorted.length === 0) return null;
  return unsorted[Math.floor(Math.random() * unsorted.length)];
}
