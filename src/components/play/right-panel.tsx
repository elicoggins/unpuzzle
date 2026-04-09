"use client";

import { EngineLines } from "@/components/engine-lines";
import { ScoreReveal } from "@/components/score-reveal";
import { MoveExplanation } from "@/components/move-explanation";
import { loadDepth } from "@/app/settings/page";
import type { Position, EvalFeedback } from "@/lib/types";
import type { EngineLine, DepthUpdate } from "@/lib/chess-engine";
import type { GameState } from "@/lib/game-state";

interface RightPanelProps {
  boardSize: number;
  gameState: GameState;
  position: Position | null;
  feedback: EvalFeedback | null;
  engineDepth: DepthUpdate | null;
  engineLines: EngineLine[];
  pendingMove: { uci: string; san: string } | null;
  puzzleMoveNumber: number;
  onEngineLineMoveClick: (lineIdx: number, moveIdx: number) => void;
  onBestLineClick: (moveIdx: number) => void;
  onRefutationLineClick: (moveIdx: number) => void;
  onConfirm: () => void;
  onUndo: () => void;
  /** Content to render in the scored state action area (below ScoreReveal). */
  scoredActions: React.ReactNode;
}

export function RightPanel({
  boardSize,
  gameState,
  position,
  feedback,
  engineDepth,
  engineLines,
  pendingMove,
  puzzleMoveNumber,
  onEngineLineMoveClick,
  onBestLineClick,
  onRefutationLineClick,
  onConfirm,
  onUndo,
  scoredActions,
}: RightPanelProps) {
  return (
    <div
      data-component="right-panel"
      className="flex flex-col gap-3 w-full md:w-[260px]"
      style={{ height: boardSize }}
    >
      {/* Engine lines (always visible) */}
      <div>
        {(gameState === "evaluating" || gameState === "scored") && engineLines.length > 0 && position ? (
          <EngineLines
            fen={position.fen}
            lines={engineLines}
            depth={engineDepth?.depth ?? feedback?.evalBefore ? 16 : 0}
            isSearching={gameState === "evaluating"}
            onMoveClick={onEngineLineMoveClick}
          />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border bg-bg-secondary flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                engine
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                  <span className="text-[11px] font-bold font-[family-name:var(--font-mono)] min-w-[44px] text-center rounded px-1 py-0.5 text-text-muted/30">
                    —
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Move explanation */}
      <div className="flex-1 min-h-0">
        {gameState === "scored" && feedback ? (
          <MoveExplanation
            centipawnLoss={feedback.centipawnLoss}
            evalBefore={feedback.evalBefore}
            evalAfterPlayed={feedback.evalAfterPlayed}
            sideToMove={position?.sideToMove ?? "w"}
            bestMoveSan={feedback.bestMoveSan}
            bestLine={feedback.bestLine}
            refutationLine={feedback.refutationLine}
            isMateBefore={feedback.isMateBefore}
            mateInBefore={feedback.mateInBefore}
            isMateAfterPlayed={feedback.isMateAfterPlayed}
            show={true}
            onBestLineClick={onBestLineClick}
            onRefutationLineClick={onRefutationLineClick}
          />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden h-full">
            <div className="px-3 py-1.5 border-b border-border bg-bg-secondary">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                analysis
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm text-text-muted/50 italic">Make a move to see analysis.</p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback panel */}
      <div className="border border-border rounded-lg p-4 flex flex-col items-center justify-center shrink-0" style={{ height: 230 }}>
        {gameState === "playing" && (
          <div className="text-center space-y-2">
            <div className="text-sm font-medium text-text-secondary">
              Your turn
            </div>
            <div className="text-xs text-text-muted">
              Find the best move for{" "}
              {position?.sideToMove === "w" ? "white" : "black"}.
            </div>
          </div>
        )}

        {gameState === "confirming" && pendingMove && (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="text-lg font-bold font-[family-name:var(--font-mono)] text-text-primary">
              {puzzleMoveNumber}. {pendingMove.san}
            </div>
            <button
              onClick={onConfirm}
              className="w-full px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
            >
              confirm
            </button>
            <button
              onClick={onUndo}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            >
              undo
            </button>
          </div>
        )}

        {gameState === "evaluating" && (
          <div className="text-center space-y-3">
            <div className="text-sm text-text-secondary">analyzing...</div>
            {engineDepth && (
              <div className="text-xs font-[family-name:var(--font-mono)] text-text-muted space-y-1">
                <div>
                  depth {engineDepth.depth}
                  {" · "}
                  {engineDepth.isMate
                    ? `M${Math.abs(engineDepth.mateIn ?? 0)}`
                    : `${engineDepth.eval >= 0 ? "+" : ""}${(engineDepth.eval / 100).toFixed(1)}`}
                </div>
                <div className="w-full bg-border/30 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-accent/60 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (engineDepth.depth / loadDepth()) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === "scored" && feedback && (
          <div className="flex flex-col items-center gap-3 w-full">
            <ScoreReveal
              centipawnLoss={feedback.centipawnLoss}
              bestMoveSan={feedback.bestMoveSan}
              category={position?.category}
              evalAfterBest={feedback.evalAfterBest}
              evalAfterPlayed={feedback.evalAfterPlayed}
              isMateBefore={feedback.isMateBefore}
              mateInBefore={feedback.mateInBefore}
              isMateAfterPlayed={feedback.isMateAfterPlayed}
              sideToMove={position?.sideToMove ?? "w"}
              show={true}
            />
            {scoredActions}
          </div>
        )}

        {gameState === "loading" && (
          <div className="text-sm text-text-muted animate-pulse">loading...</div>
        )}
      </div>
    </div>
  );
}
