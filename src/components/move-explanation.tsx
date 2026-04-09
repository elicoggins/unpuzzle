"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getScoreColor } from "@/lib/scoring";
import { CPL_THRESHOLDS, BEST_LINE_MAX_MOVES, THREAT_LINE_MAX_MOVES } from "@/lib/constants";
import { hadMateAvailable } from "@/lib/chess-utils";

interface MoveExplanationProps {
  centipawnLoss: number;
  evalBefore: number;
  evalAfterPlayed: number;
  sideToMove: "w" | "b";
  bestMoveSan: string;
  bestLine: string[];
  refutationLine: string[];
  isMateBefore: boolean;
  mateInBefore: number | null;
  isMateAfterPlayed: boolean;
  show: boolean;
  onBestLineClick?: (moveIdx: number) => void;
  onRefutationLineClick?: (moveIdx: number) => void;
}

function describePosition(cp: number): string {
  if (cp > 500) return "completely winning";
  if (cp > 200) return "winning";
  if (cp > 75) return "better";
  if (cp >= -75) return "roughly equal";
  if (cp >= -200) return "slightly worse";
  if (cp >= -500) return "clearly worse";
  return "losing";
}

function describeShift(before: number, after: number): string {
  const bd = describePosition(before);
  const ad = describePosition(after);
  if (bd === ad) return "This weakens your position.";
  return `The position goes from ${bd} to ${ad}.`;
}

function describeMoveType(san: string): string {
  if (san.includes("#")) return ", delivering checkmate";
  if (san.includes("x") && san.includes("+")) return ", winning material with check";
  if (san.includes("x")) return ", winning material";
  if (san.includes("+")) return " with check";
  return "";
}

function generateExplanation({
  centipawnLoss,
  evalBefore,
  evalAfterPlayed,
  sideToMove,
  bestMoveSan,
  refutationLine,
  isMateBefore,
  mateInBefore,
  isMateAfterPlayed,
}: {
  centipawnLoss: number;
  evalBefore: number;
  evalAfterPlayed: number;
  sideToMove: "w" | "b";
  bestMoveSan: string;
  refutationLine: string[];
  isMateBefore: boolean;
  mateInBefore: number | null;
  isMateAfterPlayed: boolean;
}): string {
  // Convert white-perspective evals to player's perspective
  const before = sideToMove === "w" ? evalBefore : -evalBefore;
  const after = sideToMove === "w" ? evalAfterPlayed : -evalAfterPlayed;

  const youHadMate = hadMateAvailable(isMateBefore, mateInBefore, sideToMove);

  // Mate special cases
  if (isMateAfterPlayed) {
    return "Your move allows a forced checkmate.";
  }
  if (youHadMate && centipawnLoss > 0) {
    const n = mateInBefore != null ? Math.abs(mateInBefore) : null;
    const suffix = n != null && n > 1 ? ` in ${n}` : "";
    return `There was checkmate${suffix}, but you missed it. ${bestMoveSan} starts the mating sequence.`;
  }

  // Normal cases by CPL bracket
  if (centipawnLoss === 0) {
    return "You found the best move in the position.";
  }
  if (centipawnLoss <= CPL_THRESHOLDS.excellent) {
    return `Strong move. ${bestMoveSan} was marginally more precise.`;
  }
  if (centipawnLoss <= CPL_THRESHOLDS.good) {
    return `A solid choice. The engine preferred ${bestMoveSan}.`;
  }

  // Inaccuracy and worse — describe the eval shift + refutation
  const shift = describeShift(before, after);
  const refFirst = refutationLine[0];

  if (centipawnLoss <= CPL_THRESHOLDS.inaccuracy) {
    if (refFirst) {
      const threat = describeMoveType(refFirst);
      return `${shift} After your move, ${refFirst}${threat} is the key response.`;
    }
    return `${shift} ${bestMoveSan} was more accurate.`;
  }

  if (centipawnLoss <= CPL_THRESHOLDS.mistake) {
    if (refFirst) {
      const threat = describeMoveType(refFirst);
      return `${shift} Your opponent punishes with ${refFirst}${threat}.`;
    }
    return `${shift} ${bestMoveSan} was critical here.`;
  }

  // Blunder
  if (refFirst) {
    const threat = describeMoveType(refFirst);
    return `${shift} The refutation is ${refFirst}${threat}.`;
  }
  return `${shift} ${bestMoveSan} was the only move to hold the position.`;
}

export function MoveExplanation({
  centipawnLoss,
  evalBefore,
  evalAfterPlayed,
  sideToMove,
  bestMoveSan,
  bestLine,
  refutationLine,
  isMateBefore,
  mateInBefore,
  isMateAfterPlayed,
  show,
  onBestLineClick,
  onRefutationLineClick,
}: MoveExplanationProps) {
  const explanation = generateExplanation({
    centipawnLoss,
    evalBefore,
    evalAfterPlayed,
    sideToMove,
    bestMoveSan,
    refutationLine,
    isMateBefore,
    mateInBefore,
    isMateAfterPlayed,
  });

  const color = getScoreColor(centipawnLoss);
  const showRefutation = centipawnLoss > 50 && refutationLine.length > 0;
  const showBestLine = centipawnLoss > 0 && bestLine.length > 0;

  return (
    <div
      data-component="move-explanation"
      className="border border-border rounded-lg overflow-hidden h-full flex flex-col"
      style={{ borderLeftWidth: 2, borderLeftColor: color }}
    >
      <div className="px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
          analysis
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 pt-3 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {show && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm text-text-secondary leading-relaxed">
                  {explanation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(showBestLine || showRefutation) && (
          <AnimatePresence>
            {show && (
              <motion.div
                key="lines"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-3 pb-3 pt-2 space-y-1.5 shrink-0 border-t border-border/50 mt-2"
              >
                {showBestLine && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                      best
                    </span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-text-secondary flex gap-x-1.5 overflow-x-auto min-w-0">
                      {bestLine.slice(0, BEST_LINE_MAX_MOVES).map((san, i) => (
                        <span
                          key={i}
                          className={`shrink-0${onBestLineClick ? " cursor-pointer hover:text-accent transition-colors" : ""}`}
                          onClick={() => onBestLineClick?.(i)}
                        >
                          {san}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {showRefutation && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                      threat
                    </span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-text-secondary flex gap-x-1.5 overflow-x-auto min-w-0">
                      {refutationLine.slice(0, THREAT_LINE_MAX_MOVES).map((san, i) => (
                        <span
                          key={i}
                          className={`shrink-0${onRefutationLineClick ? " cursor-pointer hover:text-accent transition-colors" : ""}`}
                          onClick={() => onRefutationLineClick?.(i)}
                        >
                          {san}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
