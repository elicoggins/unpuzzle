import type { Position, PositionCategory } from "../types";
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
}

const CATEGORY_POOLS: Record<PositionCategory, CuratedPosition[]> = {
  tactical: TACTICAL_POSITIONS,
  balanced: BALANCED_POSITIONS,
  critical: CRITICAL_POSITIONS,
  tricky: TRICKY_POSITIONS,
  endgame: ENDGAME_POSITIONS,
};

const WEIGHTS: Record<PositionCategory, number> = {
  tactical: 0.10, balanced: 0.30, critical: 0.25, tricky: 0.10, endgame: 0.25,
};

export function getWeightedRandomPosition(): CuratedPosition {
  const roll = Math.random();
  let cum = 0;
  let cat: PositionCategory = "balanced";
  for (const [c, w] of Object.entries(WEIGHTS) as [PositionCategory, number][]) {
    cum += w; if (roll < cum) { cat = c; break; }
  }
  const pool = CATEGORY_POOLS[cat];
  const i = Math.floor(Math.random() * pool.length);
  return pool[i];
}

export function getRandomPosition(): Position {
  return getWeightedRandomPosition();
}
