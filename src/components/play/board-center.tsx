"use client";

import { ChessBoard } from "@/components/chess-board";
import { EvalBar } from "@/components/eval-bar";
import type { PieceDropHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";
import type { GameState } from "@/lib/game-state";

interface BoardCenterProps {
  displayFen: string;
  boardSize: number;
  boardOrientation: "white" | "black";
  gameState: GameState;
  evalForBar: { eval: number; isMate: boolean; mateIn: number | null };
  displayArrows: Arrow[];
  displaySquareStyles: Record<string, React.CSSProperties>;
  positionId?: string;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  onSquareMouseDown: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onSquareClick: (args: SquareHandlerArgs) => void;
  onSquareMouseUp?: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onArrowsChange?: (args: { arrows: Arrow[] }) => void;
  onUndoMove: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  boardContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function BoardCenter({
  displayFen,
  boardSize,
  boardOrientation,
  gameState,
  evalForBar,
  displayArrows,
  displaySquareStyles,
  positionId,
  onPieceDrop,
  onSquareMouseDown,
  onSquareClick,
  onSquareMouseUp,
  onArrowsChange,
  onUndoMove,
  onResizeStart,
  boardContainerRef,
}: BoardCenterProps) {
  return (
    <div data-component="board-center" className="flex items-center gap-1 flex-shrink-0">
      <EvalBar
        eval={evalForBar.eval}
        isMate={evalForBar.isMate}
        mateIn={evalForBar.mateIn}
        height={boardSize}
        orientation={boardOrientation}
        revealed={gameState === "scored"}
      />
      <div
        className="relative flex-shrink-0"
        ref={boardContainerRef}
        style={{ width: boardSize, height: boardSize }}
      >
        <ChessBoard
          position={displayFen}
          onPieceDrop={onPieceDrop}
          onSquareMouseDown={onSquareMouseDown}
          onSquareClick={onSquareClick}
          onSquareMouseUp={onSquareMouseUp}
          onArrowsChange={onArrowsChange}
          boardOrientation={boardOrientation}
          allowDragging={gameState === "playing"}
          arrows={displayArrows}
          squareStyles={displaySquareStyles}
          boardKey={positionId}
        />

        {/* Loading overlay */}
        {gameState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 rounded-lg">
            <div className="text-text-muted animate-pulse">loading...</div>
          </div>
        )}

        {/* Click-to-undo overlay during confirming */}
        {gameState === "confirming" && (
          <div
            className="absolute inset-0 z-[5] cursor-default"
            onMouseDown={onUndoMove}
          />
        )}

        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-10 group hidden md:block"
          title="Drag to resize"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-full h-full text-text-muted/40 group-hover:text-text-muted transition-colors"
          >
            <path d="M14 14L8 14L14 8Z" fill="currentColor" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
