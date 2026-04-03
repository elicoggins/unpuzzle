"use client";

import { useMemo } from "react";
import { Chess } from "chess.js";
import type { EngineLine } from "@/lib/chess-engine";

interface EngineLinesProps {
  /** Current position FEN (for converting UCI to SAN) */
  fen: string;
  /** Engine lines to display */
  lines: EngineLine[];
  /** Current search depth */
  depth: number;
  /** Whether the engine is currently searching */
  isSearching: boolean;
  /** Called when a move notation is clicked */
  onMoveClick?: (lineIdx: number, moveIdx: number) => void;
}

function formatEval(cp: number, isMate: boolean, mateIn: number | null): string {
  if (isMate && mateIn != null) {
    const sign = mateIn > 0 ? "+" : "-";
    return `${sign}M${Math.abs(mateIn)}`;
  }
  const sign = cp >= 0 ? "+" : "";
  return `${sign}${(cp / 100).toFixed(1)}`;
}

function uciToSan(fen: string, uciMoves: string[]): string[] {
  const sanMoves: string[] = [];
  try {
    const game = new Chess(fen);
    for (const uci of uciMoves) {
      if (uci.length < 4) break;
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!move) break;
      sanMoves.push(move.san);
    }
  } catch {
    // If conversion fails at some point, return what we have
  }
  return sanMoves;
}

export function EngineLines({ fen, lines, depth, isSearching, onMoveClick }: EngineLinesProps) {
  const displayLines = useMemo(() => {
    return lines.map((line) => {
      const sanMoves = uciToSan(fen, line.pv);
      return {
        ...line,
        sanMoves,
      };
    });
  }, [fen, lines]);

  if (lines.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-bg-secondary flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
          engine
        </span>
        <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-muted">
          {isSearching && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse mr-1.5" />
          )}
          d{depth}
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {displayLines.map((line, i) => {
          const evalColor =
            line.isMate && line.mateIn != null
              ? line.mateIn > 0
                ? "text-white bg-white/10"
                : "text-text-muted bg-black/20"
              : line.eval > 50
                ? "text-white bg-white/10"
                : line.eval < -50
                  ? "text-text-muted bg-black/20"
                  : "text-text-secondary bg-white/5";

          return (
            <div key={i} className="flex items-start gap-2 px-3 py-1.5">
              <span
                className={`text-[11px] font-bold font-[family-name:var(--font-mono)] min-w-[44px] text-center rounded px-1 py-0.5 ${evalColor}`}
              >
                {formatEval(line.eval, line.isMate, line.mateIn)}
              </span>
              <span className="text-xs font-[family-name:var(--font-mono)] text-text-secondary flex gap-x-1.5 overflow-hidden min-w-0">
                {line.sanMoves.length > 0
                  ? line.sanMoves.slice(0, 8).map((san, j) => (
                      <span
                        key={j}
                        className={`shrink-0${onMoveClick ? " cursor-pointer hover:text-text-primary transition-colors" : ""}`}
                        onClick={() => onMoveClick?.(i, j)}
                      >
                        {san}
                      </span>
                    ))
                  : <span>...</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
