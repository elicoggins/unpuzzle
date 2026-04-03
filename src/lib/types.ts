export interface Position {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  opening: string | null;
  phase: "opening" | "middlegame" | "endgame";
  moveNumber: number;
}

export interface EvalFeedback {
  /** Centipawn loss from the user's move vs best move */
  centipawnLoss: number;
  /** Eval of the position before the user's move (from side-to-move perspective) */
  evalBefore: number;
  /** Eval after the user's move (from original side-to-move perspective) */
  evalAfterPlayed: number;
  /** Eval after the best move (from original side-to-move perspective) */
  evalAfterBest: number;
  /** The engine's best move in UCI */
  bestMoveUci: string;
  /** The engine's best move in SAN */
  bestMoveSan: string;
  /** Is the "before" eval a mate? */
  isMateBefore: boolean;
  /** Mate in N for "before" position (white's perspective: + = white mates) */
  mateInBefore: number | null;
  /** Is the position after the played move a forced mate? */
  isMateAfterPlayed: boolean;
  /** Mate in N after the played move (white's perspective) */
  mateInAfterPlayed: number | null;
}
