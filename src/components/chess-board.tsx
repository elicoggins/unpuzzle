"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import type { PieceDropHandlerArgs, PieceHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";
import { loadPieceSetKey, buildPiecesObject, PIECE_SET_CHANGE_EVENT } from "@/lib/board-settings";

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
  onPieceDrag?: (args: PieceHandlerArgs) => void;
  onSquareMouseDown?: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onSquareClick?: (args: SquareHandlerArgs) => void;
  onSquareMouseUp?: (args: SquareHandlerArgs, e: React.MouseEvent) => void;
  onArrowsChange?: (args: { arrows: Arrow[] }) => void;
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
  onPieceDrag,
  onSquareMouseDown,
  onSquareClick,
  onSquareMouseUp,
  onArrowsChange,
  boardOrientation = "white",
  allowDragging = true,
  animationDurationInMs = 200,
  arrows,
  squareStyles,
  boardKey,
}: ChessBoardProps) {
  const [dragActivationDistance, setDragActivationDistance] = useState(0);
  const [pieceSetKey, setPieceSetKey] = useState<string>("cburnett");

  useEffect(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) setDragActivationDistance(8);
    setPieceSetKey(loadPieceSetKey());

    function handlePieceSetChange(e: Event) {
      setPieceSetKey((e as CustomEvent).detail.key);
    }
    window.addEventListener(PIECE_SET_CHANGE_EVENT, handlePieceSetChange);
    return () => window.removeEventListener(PIECE_SET_CHANGE_EVENT, handlePieceSetChange);
  }, []);

  const pieces = useMemo(() => buildPiecesObject(pieceSetKey), [pieceSetKey]);

  return (
    <div data-component="chess-board" className="rounded-lg overflow-hidden shadow-2xl shadow-black/50 w-full aspect-square">
      <Board
        key={boardKey}
        options={{
          id: "unpuzzle-board",
          position,
          pieces,
          onPieceDrop,
          onPieceDrag,
          onSquareMouseDown,
          onSquareClick,
          onSquareMouseUp,
          onArrowsChange,
          boardOrientation,
          allowDragging,
          animationDurationInMs,
          dragActivationDistance,
          arrows: arrows ?? [],
          clearArrowsOnClick: true,
          clearArrowsOnPositionChange: true,
          squareStyles: squareStyles ?? {},
          boardStyle: {
            borderRadius: "0",
          },
          darkSquareStyle: {
            backgroundColor: "var(--color-board-dark)",
            backgroundImage: "var(--board-texture)",
            backgroundSize: "128px 128px",
            backgroundRepeat: "repeat",
          },
          lightSquareStyle: {
            backgroundColor: "var(--color-board-light)",
            backgroundImage: "var(--board-texture)",
            backgroundSize: "128px 128px",
            backgroundRepeat: "repeat",
          },
          darkSquareNotationStyle: {
            color: "var(--color-board-notation-dark)",
          },
          lightSquareNotationStyle: {
            color: "var(--color-board-notation-light)",
          },
          dropSquareStyle: {},
          draggingPieceStyle: {
            transform: "scale(1)",
          },
        }}
      />
    </div>
  );
}
