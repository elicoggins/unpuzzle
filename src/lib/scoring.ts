export function getScoreLabel(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "Perfect";
  if (centipawnLoss <= 15) return "Excellent";
  if (centipawnLoss <= 50) return "Good";
  if (centipawnLoss <= 90) return "Inaccuracy";
  if (centipawnLoss <= 150) return "Mistake";
  return "Blunder";
}

export function getScoreGlyph(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "!!";
  if (centipawnLoss <= 15) return "!";
  if (centipawnLoss <= 50) return "";
  if (centipawnLoss <= 90) return "?!";
  if (centipawnLoss <= 150) return "?";
  return "??";
}

export function getScoreColor(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "var(--color-score-perfect)";
  if (centipawnLoss <= 15) return "var(--color-score-perfect)";
  if (centipawnLoss <= 50) return "var(--color-score-good)";
  if (centipawnLoss <= 90) return "var(--color-score-inaccuracy)";
  if (centipawnLoss <= 150) return "var(--color-score-mistake)";
  return "var(--color-score-blunder)";
}

export function getScoreArrowColor(centipawnLoss: number): string {
  if (centipawnLoss <= 15) return "rgba(57, 255, 20, 0.75)";    // neon green
  if (centipawnLoss <= 50) return "rgba(57, 255, 20, 0.55)";    // neon green (softer)
  if (centipawnLoss <= 90) return "rgba(255, 255, 0, 0.7)";     // neon yellow
  if (centipawnLoss <= 150) return "rgba(255, 102, 0, 0.7)";    // neon orange
  return "rgba(255, 0, 64, 0.75)";                               // neon red
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
  return 100 / (1 + Math.exp(-0.00368208 * cp));
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
