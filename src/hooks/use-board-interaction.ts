"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { getScoreArrowColor } from "@/lib/scoring";
import { walkUciPath } from "@/lib/chess-utils";
import { playMoveSound, playCaptureSound } from "@/lib/sounds";
import type { Position, EvalFeedback } from "@/lib/types";
import type { EngineLine } from "@/lib/chess-engine";
import type { PieceDropHandlerArgs, PieceHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";
import type { GameState } from "@/lib/game-state";

export interface UseBoardInteractionReturn {
  fen: string;
  boardOrientation: "white" | "black";
  moveHistory: string[];
  pendingMove: { uci: string; san: string } | null;
  browsePath: { san: string; fen: string }[];
  browseIdx: number | null;
  setBrowsePath: React.Dispatch<React.SetStateAction<{ san: string; fen: string }[]>>;
  setBrowseIdx: React.Dispatch<React.SetStateAction<number | null>>;
  selectedSquare: string | null;
  highlightedSquares: Set<string>;
  gameRef: React.MutableRefObject<Chess>;
  // Derived display values
  displayFen: string;
  displayArrows: Arrow[];
  displaySquareStyles: Record<string, React.CSSProperties>;
  // Handlers
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onPieceDrag: (args: PieceHandlerArgs) => void;
  onSquareMouseDown: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onSquareClick: (args: SquareHandlerArgs) => void;
  onSquareMouseUp: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onArrowsChange: (args: { arrows: Arrow[] }) => void;
  onEngineLineMoveClick: (lineIdx: number, moveIdx: number) => void;
  onBestLineClick: (moveIdx: number) => void;
  onRefutationLineClick: (moveIdx: number) => void;
  confirmMove: () => void;
  undoMove: () => void;
  // Initialization
  initBoard: (data: Position) => void;
  resetBrowse: () => void;
}

/**
 * Encapsulates all board interaction logic shared by play and sort pages:
 * - Click-to-move and drag-and-drop
 * - Arrow drawing and square highlighting
 * - Move history
 * - Browse mode (engine lines, best line, refutation line)
 * - Confirm/undo pending moves
 */
export function useBoardInteraction(
  position: Position | null,
  gameState: GameState,
  feedback: EvalFeedback | null,
  lastPlayedUci: string | null,
  engineLines: EngineLine[],
  evaluateMove: (uci: string, san: string) => void,
  setGameState: (s: GameState) => void,
): UseBoardInteractionReturn {
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [pendingMove, setPendingMove] = useState<{ uci: string; san: string } | null>(null);
  const [browsePath, setBrowsePath] = useState<{ san: string; fen: string }[]>([]);
  const [browseIdx, setBrowseIdx] = useState<number | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<Set<string>>(new Set());

  const selectedSquareRef = useRef<string | null>(null);
  const wasAlreadySelectedRef = useRef(false);
  const justSelectedRef = useRef(false);
  const rightDownSquareRef = useRef<string | null>(null);
  const gameRef = useRef<Chess>(new Chess());

  /** Initialize board for a new position. */
  const initBoard = useCallback((data: Position) => {
    const game = new Chess(data.fen);
    gameRef.current = game;
    setFen(data.fen);
    setBoardOrientation(data.sideToMove === "w" ? "white" : "black");
    setMoveHistory([]);
    setPendingMove(null);
    setBrowsePath([]);
    setBrowseIdx(null);
    setLegalMoveSquares([]);
    setSelectedSquare(null);
    selectedSquareRef.current = null;
    justSelectedRef.current = false;
    setHighlightedSquares(new Set());
  }, []);

  const resetBrowse = useCallback(() => {
    setBrowsePath([]);
    setBrowseIdx(null);
  }, []);

  /** Execute a move on the board (shared logic for all move input methods). */
  const executeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const game = gameRef.current;
      try {
        const moveResult = game.move({ from, to, promotion: promotion || "q" });
        if (!moveResult) return false;

        if (moveResult.captured) { playCaptureSound(); } else { playMoveSound(); }

        setFen(game.fen());
        setMoveHistory((prev) => [...prev, moveResult.san]);
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;

        const uciMove = from + to + (moveResult.promotion || "");
        setPendingMove({ uci: uciMove, san: moveResult.san });
        setGameState("confirming");
        return true;
      } catch {
        return false;
      }
    },
    [setGameState]
  );

  // ── Move input handlers ──────────────────────────────────────────────

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (gameState !== "playing") return false;

      if (sourceSquare === targetSquare || !targetSquare) {
        if (wasAlreadySelectedRef.current) {
          setLegalMoveSquares([]);
          setSelectedSquare(null);
          selectedSquareRef.current = null;
        }
        wasAlreadySelectedRef.current = false;
        return false;
      }

      const promotion = piece.pieceType?.[1]?.toLowerCase() === "p" ? "q" : undefined;
      return executeMove(sourceSquare, targetSquare || sourceSquare, promotion);
    },
    [gameState, executeMove]
  );

  const onSquareMouseDown = useCallback(
    ({ piece, square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (e.button === 2) {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        rightDownSquareRef.current = square;
        return;
      }
      if (gameState !== "playing") {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        wasAlreadySelectedRef.current = false;
        return;
      }
      // If a piece is already selected and this square is a legal destination (capture):
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        if (piece) {
          executeMove(selectedSquareRef.current, square);
          return;
        }
        wasAlreadySelectedRef.current = false;
        return;
      }
      wasAlreadySelectedRef.current = selectedSquareRef.current === square;
      const game = gameRef.current;
      const moves = game.moves({ square: square as Square, verbose: true });
      if (moves.length > 0 && piece) {
        // Always re-select: keeps legalMoveSquares fresh and marks justSelectedRef
        // so onSquareClick (which may fire after mousedown on some platforms) skips
        // double-handling and lets onPieceDrop's wasAlreadySelectedRef do deselect.
        setLegalMoveSquares(moves.map((m) => m.to));
        setSelectedSquare(square);
        selectedSquareRef.current = square;
        justSelectedRef.current = true;
      } else {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        wasAlreadySelectedRef.current = false;
      }
    },
    [gameState, legalMoveSquares, executeMove]
  );

  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (gameState !== "playing") return;
      const game = gameRef.current;

      // Execute move if a legal destination is tapped/clicked
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        executeMove(selectedSquareRef.current, square);
        return;
      }

      // On desktop, onSquareMouseDown fires first and freshly selects the piece.
      // justSelectedRef prevents us from immediately undoing that selection here.
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      const moves = game.moves({ square: square as Square, verbose: true });
      if (moves.length > 0 && piece) {
        if (selectedSquareRef.current === square) {
          // Re-tapping the already-selected piece → deselect
          setLegalMoveSquares([]);
          setSelectedSquare(null);
          selectedSquareRef.current = null;
        } else {
          // New selection (mobile first-tap, or desktop clicking a different own piece)
          setLegalMoveSquares(moves.map((m) => m.to));
          setSelectedSquare(square);
          selectedSquareRef.current = square;
        }
      } else {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
      }
    },
    [gameState, legalMoveSquares, executeMove]
  );

  const onPieceDrag = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (gameState !== "playing" || !square) return;
      const game = gameRef.current;
      const moves = game.moves({ square: square as Square, verbose: true });
      if (moves.length > 0) {
        // Only update legalMoveSquares for the dots overlay — do NOT touch
        // selectedSquareRef.current here. onPieceDrag fires during pointerdown,
        // which is BEFORE mousedown, so modifying selectedSquareRef would cause
        // onSquareMouseDown to think the piece was already selected (wasAlreadySelectedRef
        // would be set to true), making onPieceDrop clear the selection.
        setLegalMoveSquares(moves.map((m) => m.to));
      }
    },
    [gameState]
  );

  const onSquareMouseUp = useCallback(({ square }: SquareHandlerArgs, e: React.MouseEvent) => {
    if (e.button !== 2) return;
    if (rightDownSquareRef.current === square) {
      setHighlightedSquares((prev) => {
        const next = new Set(prev);
        if (next.has(square)) { next.delete(square); } else { next.add(square); }
        return next;
      });
    }
    rightDownSquareRef.current = null;
  }, []);

  const onArrowsChange = useCallback(({ arrows }: { arrows: Arrow[] }) => {
    if (arrows.length === 0) {
      setHighlightedSquares(new Set());
    }
  }, []);

  // ── Confirm / undo ───────────────────────────────────────────────────

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;
    evaluateMove(pendingMove.uci, pendingMove.san);
    setPendingMove(null);
  }, [pendingMove, evaluateMove]);

  const undoMove = useCallback(() => {
    if (!position) return;
    const game = new Chess(position.fen);
    gameRef.current = game;
    setFen(position.fen);
    setMoveHistory([]);
    setPendingMove(null);
    setBrowsePath([]);
    setBrowseIdx(null);
    setLegalMoveSquares([]);
    setSelectedSquare(null);
    selectedSquareRef.current = null;
    setGameState("playing");
  }, [position, setGameState]);

  // ── Browse mode (click into engine/best/refutation lines) ────────────

  const onEngineLineMoveClick = useCallback(
    (lineIdx: number, moveIdx: number) => {
      if (!position || !engineLines[lineIdx] || gameState !== "scored") return;
      const path = walkUciPath(position.fen, engineLines[lineIdx].pv, moveIdx);
      if (path.length > 0) {
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      }
    },
    [position, engineLines, gameState]
  );

  const onBestLineClick = useCallback(
    (moveIdx: number) => {
      if (!position || !feedback || gameState !== "scored") return;
      const path = walkUciPath(position.fen, feedback.bestLineUci, moveIdx);
      if (path.length > 0) {
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      }
    },
    [position, feedback, gameState]
  );

  const onRefutationLineClick = useCallback(
    (moveIdx: number) => {
      if (!position || !feedback || !lastPlayedUci || gameState !== "scored") return;
      // Start from the position after the user's move
      const afterGame = new Chess(position.fen);
      try {
        const userMove = afterGame.move({
          from: lastPlayedUci.slice(0, 2),
          to: lastPlayedUci.slice(2, 4),
          promotion: lastPlayedUci.length > 4 ? lastPlayedUci[4] : undefined,
        });
        if (!userMove) return;
        const userEntry = { san: userMove.san, fen: afterGame.fen() };
        const refPath = walkUciPath(afterGame.fen(), feedback.refutationLineUci, moveIdx);
        const path = [userEntry, ...refPath];
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      } catch { /* ignore */ }
    },
    [position, feedback, lastPlayedUci, gameState]
  );

  // ── Derived display values ───────────────────────────────────────────

  const boardArrows = useMemo<Arrow[]>(() => {
    if (gameState !== "scored" || !feedback || !lastPlayedUci) return [];
    const arrows: Arrow[] = [];
    if (feedback.bestMoveUci && feedback.bestMoveUci.length >= 4 && feedback.bestMoveUci !== lastPlayedUci) {
      arrows.push({
        startSquare: feedback.bestMoveUci.slice(0, 2),
        endSquare: feedback.bestMoveUci.slice(2, 4),
        color: "rgba(57, 255, 20, 0.75)",
      });
    }
    if (lastPlayedUci.length >= 4) {
      arrows.push({
        startSquare: lastPlayedUci.slice(0, 2),
        endSquare: lastPlayedUci.slice(2, 4),
        color: getScoreArrowColor(feedback.centipawnLoss),
      });
    }
    return arrows;
  }, [gameState, feedback, lastPlayedUci]);

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const game = gameRef.current;
    for (const sq of legalMoveSquares) {
      const hasPiece = !!game.get(sq as Square);
      styles[sq] = hasPiece
        ? {
            borderRadius: "50%",
            boxShadow: "inset 0 0 0 4px color-mix(in srgb, var(--color-accent) var(--board-highlight-strong, 50%), transparent)",
            cursor: "pointer",
          }
        : {
            background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) var(--board-highlight-mid, 40%), transparent) 25%, transparent 25%)",
            borderRadius: "50%",
            cursor: "pointer",
          };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "color-mix(in srgb, var(--color-accent) var(--board-highlight-soft, 30%), transparent)",
      };
    }
    if (gameState === "scored" && feedback && lastPlayedUci && lastPlayedUci.length >= 4) {
      const targetSquare = lastPlayedUci.slice(2, 4);
      styles[targetSquare] = {
        boxShadow: `inset 0 0 0 3px ${getScoreArrowColor(feedback.centipawnLoss)}`,
        borderRadius: "50%",
      };
    }
    return styles;
  }, [legalMoveSquares, selectedSquare, gameState, feedback, lastPlayedUci]);

  const displayFen = useMemo(() => {
    if (browseIdx === null) return fen;
    if (browseIdx < 0) return position?.fen ?? fen;
    return browsePath[browseIdx]?.fen ?? fen;
  }, [browseIdx, browsePath, fen, position]);

  const displayArrows = useMemo(() => browseIdx !== null ? [] : boardArrows, [browseIdx, boardArrows]);

  const displaySquareStyles = useMemo(() => {
    if (browseIdx !== null) return {};
    if (highlightedSquares.size === 0) return squareStyles;
    const merged = { ...squareStyles };
    for (const sq of highlightedSquares) {
      if (!merged[sq]) {
        merged[sq] = { backgroundColor: "rgba(235, 97, 80, 0.6)" };
      }
    }
    return merged;
  }, [browseIdx, squareStyles, highlightedSquares]);

  return {
    fen,
    boardOrientation,
    moveHistory,
    pendingMove,
    browsePath,
    browseIdx,
    setBrowsePath,
    setBrowseIdx,
    selectedSquare,
    highlightedSquares,
    gameRef,
    displayFen,
    displayArrows,
    displaySquareStyles,
    onPieceDrop,
    onPieceDrag,
    onSquareMouseDown,
    onSquareClick,
    onSquareMouseUp,
    onArrowsChange,
    onEngineLineMoveClick,
    onBestLineClick,
    onRefutationLineClick,
    confirmMove,
    undoMove,
    initBoard,
    resetBrowse,
  };
}
