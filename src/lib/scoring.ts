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
  if (centipawnLoss <= 10) return "rgba(57, 255, 20, 0.75)";    // neon green
  if (centipawnLoss <= 25) return "rgba(57, 255, 20, 0.55)";    // neon green (softer)
  if (centipawnLoss <= 50) return "rgba(255, 255, 0, 0.7)";     // neon yellow
  if (centipawnLoss <= 100) return "rgba(255, 102, 0, 0.7)";    // neon orange
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
