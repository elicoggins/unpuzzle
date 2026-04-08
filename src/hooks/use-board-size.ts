"use client";

import { useState, useEffect, useCallback, useRef } from "react";

function computeMaxBoardSize(): number {
  if (typeof window === "undefined") return 400;
  const navHeight = 57;
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    const maxWidth = window.innerWidth - 64;
    const maxHeight = window.innerHeight - navHeight - 260;
    return Math.max(200, Math.min(maxHeight, maxWidth));
  }
  const padding = 72;
  const maxHeight = window.innerHeight - navHeight - padding;
  const horizontalChrome = 220 + 260 + 28 + 64;
  const maxWidth = window.innerWidth - horizontalChrome;
  return Math.max(280, Math.min(maxHeight, maxWidth));
}

export function useBoardSize() {
  const [boardSize, setBoardSize] = useState(400);
  const resizingRef = useRef(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBoardSize(computeMaxBoardSize());
    function handleResize() {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setBoardSize(computeMaxBoardSize());
      } else {
        setBoardSize((prev) => {
          const max = computeMaxBoardSize();
          return prev > max ? max : prev;
        });
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = boardSize;

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const delta = Math.max(dx, dy);
        const newSize = Math.max(280, startSize + delta);
        setBoardSize(newSize);
      };

      const handleMouseUp = () => {
        resizingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [boardSize]
  );

  return { boardSize, boardContainerRef, handleResizeStart };
}
