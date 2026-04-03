"use client";

import dynamic from "next/dynamic";
import type { PieceDropHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";

const Board = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg overflow-hidden shadow-2xl shadow-black/50 w-full aspect-square bg-bg-secondary animate-pulse" />
    ),
  }
);

interface ChessBoardProps {
  position: string;
  onPieceDrop?: (args: PieceDropHandlerArgs) => boolean;
  onSquareMouseDown?: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onSquareClick?: (args: SquareHandlerArgs) => void;
  boardOrientation?: "white" | "black";
  allowDragging?: boolean;
  animationDurationInMs?: number;
  arrows?: Arrow[];
  squareStyles?: Record<string, React.CSSProperties>;
  boardKey?: string | number;
}

export function ChessBoard({
  position,
  onPieceDrop,
  onSquareMouseDown,
  onSquareClick,
  boardOrientation = "white",
  allowDragging = true,
  animationDurationInMs = 200,
  arrows,
  squareStyles,
  boardKey,
}: ChessBoardProps) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl shadow-black/50 w-full aspect-square">
      <Board
        key={boardKey}
        options={{
          id: "unpuzzle-board",
          position,
          onPieceDrop,
          onSquareMouseDown,
          onSquareClick,
          boardOrientation,
          allowDragging,
          animationDurationInMs,
          dragActivationDistance: 0,
          arrows: arrows ?? [],
          clearArrowsOnClick: true,
          clearArrowsOnPositionChange: true,
          squareStyles: squareStyles ?? {},
          boardStyle: {
            borderRadius: "0",
          },
          darkSquareStyle: {
            backgroundColor: "#2e2e2e",
          },
          lightSquareStyle: {
            backgroundColor: "#424242",
          },
          darkSquareNotationStyle: {
            color: "#666666",
          },
          lightSquareNotationStyle: {
            color: "#555555",
          },
          dropSquareStyle: {},
        }}
      />
    </div>
  );
}
