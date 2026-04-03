"use client";

import dynamic from "next/dynamic";
import type { PieceDropHandlerArgs, Arrow } from "react-chessboard";

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
  boardOrientation?: "white" | "black";
  allowDragging?: boolean;
  animationDurationInMs?: number;
  arrows?: Arrow[];
  squareStyles?: Record<string, React.CSSProperties>;
}

export function ChessBoard({
  position,
  onPieceDrop,
  boardOrientation = "white",
  allowDragging = true,
  animationDurationInMs = 200,
  arrows,
  squareStyles,
}: ChessBoardProps) {
  return (
    <div className="rounded-lg overflow-hidden shadow-2xl shadow-black/50 w-full aspect-square">
      <Board
        options={{
          id: "unpuzzle-board",
          position,
          onPieceDrop,
          boardOrientation,
          allowDragging,
          animationDurationInMs,
          arrows: arrows ?? [],
          clearArrowsOnClick: false,
          clearArrowsOnPositionChange: true,
          squareStyles: squareStyles ?? {},
          boardStyle: {
            borderRadius: "0",
          },
          darkSquareStyle: {
            backgroundColor: "#2a2a3a",
          },
          lightSquareStyle: {
            backgroundColor: "#3d3d50",
          },
          dropSquareStyle: {
            boxShadow: "inset 0 0 1px 6px rgba(124, 111, 240, 0.5)",
          },
        }}
      />
    </div>
  );
}
