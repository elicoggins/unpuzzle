export function getScoreLabel(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "Perfect";
  if (centipawnLoss <= 10) return "Excellent";
  if (centipawnLoss <= 25) return "Good";
  if (centipawnLoss <= 50) return "Inaccuracy";
  if (centipawnLoss <= 100) return "Mistake";
  return "Blunder";
}

export function getScoreGlyph(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "!!";
  if (centipawnLoss <= 10) return "!";
  if (centipawnLoss <= 25) return "";
  if (centipawnLoss <= 50) return "?!";
  if (centipawnLoss <= 100) return "?";
  return "??";
}

export function getScoreColor(centipawnLoss: number): string {
  if (centipawnLoss === 0) return "var(--color-score-perfect)";
  if (centipawnLoss <= 10) return "var(--color-score-perfect)";
  if (centipawnLoss <= 25) return "var(--color-score-good)";
  if (centipawnLoss <= 50) return "var(--color-score-inaccuracy)";
  if (centipawnLoss <= 100) return "var(--color-score-mistake)";
  return "var(--color-score-blunder)";
}

export function getScoreArrowColor(centipawnLoss: number): string {
  if (centipawnLoss <= 10) return "rgba(74, 222, 128, 0.7)";   // green
  if (centipawnLoss <= 25) return "rgba(163, 230, 53, 0.7)";   // lime
  if (centipawnLoss <= 50) return "rgba(250, 204, 21, 0.7)";   // yellow
  if (centipawnLoss <= 100) return "rgba(249, 115, 22, 0.7)";  // orange
  return "rgba(239, 68, 68, 0.7)";                              // red
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
