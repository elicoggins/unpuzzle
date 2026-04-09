"use client";

import type { GameState } from "@/lib/game-state";

interface MoveHistoryProps {
  position: { sideToMove: "w" | "b"; moveNumber: number } | null;
  gameState: GameState;
  fen: string;
  moveHistory: string[];
  browsePath: { san: string; fen: string }[];
  browseIdx: number | null;
  setBrowsePath: React.Dispatch<React.SetStateAction<{ san: string; fen: string }[]>>;
  setBrowseIdx: React.Dispatch<React.SetStateAction<number | null>>;
}

export function MoveHistory({
  position,
  gameState,
  fen,
  moveHistory,
  browsePath,
  browseIdx,
  setBrowsePath,
  setBrowseIdx,
}: MoveHistoryProps) {
  const puzzleMoveNumber = position?.moveNumber ?? 1;

  return (
    <div data-component="move-history" className="border border-border rounded-lg flex-col overflow-hidden flex flex-1 min-h-0">
      <div className="px-3 py-1.5 border-b border-border bg-bg-secondary">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
          moves
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {position && (
          <div
            className={`text-xs font-[family-name:var(--font-mono)] italic px-2 py-1 transition-colors ${
              gameState === "scored" || browseIdx !== null
                ? "text-text-muted cursor-pointer hover:text-text-secondary"
                : "text-text-muted"
            }`}
            onClick={() => {
              if (browseIdx === -1) {
                setBrowseIdx(null);
              } else if (browseIdx !== null || gameState === "scored") {
                setBrowsePath([]);
                setBrowseIdx(-1);
              }
            }}
          >
            position at move {puzzleMoveNumber}
          </div>
        )}

        {/* Current move (when not browsing) */}
        {browseIdx === null && moveHistory.length > 0 && (
          <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-0.5 px-2 py-1 items-center">
            <span className="text-xs font-[family-name:var(--font-mono)] text-text-muted">
              {puzzleMoveNumber}.
            </span>
            {position?.sideToMove === "w" ? (
              <>
                <span
                  className={`text-sm font-[family-name:var(--font-mono)] text-text-primary bg-accent/15 rounded px-1.5 py-0.5 transition-colors ${
                    gameState === "scored" ? "cursor-pointer hover:bg-accent/25" : ""
                  }`}
                  onClick={() => {
                    if (gameState !== "scored") return;
                    setBrowsePath([{ san: moveHistory[0], fen }]);
                    setBrowseIdx(0);
                  }}
                >
                  {moveHistory[0]}
                </span>
                <span />
              </>
            ) : (
              <>
                <span />
                <span
                  className={`text-sm font-[family-name:var(--font-mono)] text-text-primary bg-accent/15 rounded px-1.5 py-0.5 transition-colors ${
                    gameState === "scored" ? "cursor-pointer hover:bg-accent/25" : ""
                  }`}
                  onClick={() => {
                    if (gameState !== "scored") return;
                    setBrowsePath([{ san: moveHistory[0], fen }]);
                    setBrowseIdx(0);
                  }}
                >
                  {moveHistory[0]}
                </span>
              </>
            )}
          </div>
        )}

        {/* Browse mode rows */}
        {browseIdx !== null && (() => {
          const rows: { moveNum: number; white: number | null; black: number | null }[] = [];
          if (position?.sideToMove === "w") {
            for (let i = 0; i < browsePath.length; i += 2) {
              rows.push({
                moveNum: puzzleMoveNumber + Math.floor(i / 2),
                white: i,
                black: i + 1 < browsePath.length ? i + 1 : null,
              });
            }
          } else {
            if (browsePath.length > 0) rows.push({ moveNum: puzzleMoveNumber, white: null, black: 0 });
            for (let i = 1; i < browsePath.length; i += 2) {
              rows.push({
                moveNum: puzzleMoveNumber + Math.ceil(i / 2),
                white: i,
                black: i + 1 < browsePath.length ? i + 1 : null,
              });
            }
          }
          return rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-0.5 px-2 py-1 items-center">
              <span className="text-xs font-[family-name:var(--font-mono)] text-text-muted">
                {row.moveNum}.
              </span>
              {row.white !== null ? (
                <span
                  className={`text-sm font-[family-name:var(--font-mono)] rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                    row.white === browseIdx
                      ? "text-text-primary bg-accent/15 hover:bg-accent/25"
                      : "text-text-secondary hover:bg-border/30"
                  }`}
                  onClick={() => {
                    setBrowsePath((prev) => prev.slice(0, row.white! + 1));
                    setBrowseIdx(row.white!);
                  }}
                >
                  {browsePath[row.white].san}
                </span>
              ) : <span />}
              {row.black !== null ? (
                <span
                  className={`text-sm font-[family-name:var(--font-mono)] rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                    row.black === browseIdx
                      ? "text-text-primary bg-accent/15 hover:bg-accent/25"
                      : "text-text-secondary hover:bg-border/30"
                  }`}
                  onClick={() => {
                    setBrowsePath((prev) => prev.slice(0, row.black! + 1));
                    setBrowseIdx(row.black!);
                  }}
                >
                  {browsePath[row.black!].san}
                </span>
              ) : <span />}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
