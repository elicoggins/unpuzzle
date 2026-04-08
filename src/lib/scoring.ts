import { getScoreTier, WIN_PROBABILITY_COEFFICIENT } from "./constants";

export function getScoreLabel(centipawnLoss: number): string {
  return getScoreTier(centipawnLoss).label;
}

export function getScoreGlyph(centipawnLoss: number): string {
  return getScoreTier(centipawnLoss).glyph;
}

export function getScoreColor(centipawnLoss: number): string {
  return getScoreTier(centipawnLoss).color;
}

export function getScoreArrowColor(centipawnLoss: number): string {
  return getScoreTier(centipawnLoss).arrowColor;
}

export function computeACPL(losses: number[]): number {
  if (losses.length === 0) return 0;
  const sum = losses.reduce((a, b) => a + b, 0);
  return Math.round((sum / losses.length) * 10) / 10;
}

export function computeCentipawnLoss(
  bestEval: number,
  playedEval: number,
  sideToMove: "w" | "b"
): number {
  // Evals are always from white's perspective
  // centipawn loss = how much worse the played move is vs the best
  if (sideToMove === "w") {
    return Math.max(0, bestEval - playedEval);
  } else {
    // For black, a lower (more negative) eval is better
    return Math.max(0, playedEval - bestEval);
  }
}

/** Maps centipawns (white perspective) to win probability 0–100. */
function cpToWinPercent(cp: number): number {
  return 100 / (1 + Math.exp(-WIN_PROBABILITY_COEFFICIENT * cp));
}

/**
 * Computes single-move accuracy 0–100%.
 * Uses win-probability sigmoid: a 50pp drop in win% = 0% accuracy.
 * Both evals are from white's perspective.
 */
export function computeMoveAccuracy(
  bestEval: number,
  playedEval: number,
  sideToMove: "w" | "b"
): number {
  // Flip to side-to-move perspective so "positive = you're winning"
  const bestCp = sideToMove === "b" ? -bestEval : bestEval;
  const playedCp = sideToMove === "b" ? -playedEval : playedEval;

  const wpBest = cpToWinPercent(bestCp);
  const wpPlayed = cpToWinPercent(playedCp);

  // Win-probability loss in percentage points (0–~50)
  const wpLoss = Math.max(0, wpBest - wpPlayed);

  // Scale: 0pp loss = 100%, 50pp loss = 0%
  return Math.max(0, Math.min(100, Math.round(100 - 2 * wpLoss)));
}
