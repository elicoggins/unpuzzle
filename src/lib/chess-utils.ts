import { Chess } from "chess.js";

/** Parse a UCI move string into from/to/promotion components. */
export function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/** Convert a UCI PV to SAN moves, starting from a given FEN. */
export function uciPvToSan(fen: string, uciMoves: string[]): string[] {
  const sans: string[] = [];
  try {
    const g = new Chess(fen);
    for (const uci of uciMoves) {
      const parsed = parseUciMove(uci);
      if (!parsed) break;
      const m = g.move(parsed);
      if (!m) break;
      sans.push(m.san);
    }
  } catch { /* partial conversion is fine */ }
  return sans;
}

/**
 * Walk a UCI PV on a board and return the SAN + FEN at each step.
 * Commonly used for browse-mode (clicking into engine/best/refutation lines).
 */
export function walkUciPath(
  fen: string,
  uciMoves: string[],
  upToIndex: number
): { san: string; fen: string }[] {
  const path: { san: string; fen: string }[] = [];
  const game = new Chess(fen);
  for (let i = 0; i <= upToIndex && i < uciMoves.length; i++) {
    const parsed = parseUciMove(uciMoves[i]);
    if (!parsed) break;
    try {
      const m = game.move(parsed);
      if (!m) break;
      path.push({ san: m.san, fen: game.fen() });
    } catch { break; }
  }
  return path;
}

/**
 * Detect whether the side to move had a forced mate available.
 */
export function hadMateAvailable(
  isMateBefore: boolean,
  mateInBefore: number | null,
  sideToMove: "w" | "b"
): boolean {
  return (
    isMateBefore &&
    mateInBefore != null &&
    ((sideToMove === "w" && mateInBefore > 0) || (sideToMove === "b" && mateInBefore < 0))
  );
}
