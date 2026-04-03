import type { Position } from "./types";
import { getWeightedRandomPosition } from "./curated-positions";

// Legacy re-export — delegates to curated-positions.ts which is sourced from real Lichess games.
export function getRandomPosition(): Position {
  return getWeightedRandomPosition();
}
