"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getScoreLabel, getScoreColor, getScoreGlyph, computeMoveAccuracy } from "@/lib/scoring";
import { hadMateAvailable } from "@/lib/chess-utils";

interface ScoreRevealProps {
  centipawnLoss: number;
  bestMoveSan: string;
  category?: string;
  evalAfterBest: number;
  evalAfterPlayed: number;
  isMateBefore: boolean;
  mateInBefore: number | null;
  isMateAfterPlayed: boolean;
  sideToMove: "w" | "b";
  show: boolean;
}

export function ScoreReveal({
  centipawnLoss,
  category,
  evalAfterBest,
  evalAfterPlayed,
  isMateBefore,
  mateInBefore,
  isMateAfterPlayed,
  sideToMove,
  show,
}: ScoreRevealProps) {
  // Detect mate scenarios
  const youHadMate = hadMateAvailable(isMateBefore, mateInBefore, sideToMove);
  const youBlunderedMate = isMateAfterPlayed;
  const youFoundMate = youHadMate && centipawnLoss === 0;

  const isMateCase = (youHadMate && !youFoundMate) || youBlunderedMate;

  const label = getScoreLabel(centipawnLoss);
  const color = getScoreColor(centipawnLoss);
  const glyph = getScoreGlyph(centipawnLoss);

  const accuracy = isMateCase
    ? 0
    : computeMoveAccuracy(evalAfterBest, evalAfterPlayed, sideToMove);

  // Build mate headline with "in N" (omit for mate in 1)
  const mateN = mateInBefore != null ? Math.abs(mateInBefore) : null;
  const mateSuffix = mateN != null && mateN > 1 ? ` in ${mateN}` : "";

  const headline = youBlunderedMate
    ? "You blundered mate!"
    : youFoundMate
    ? `You found mate${mateSuffix}!`
    : youHadMate
    ? `You missed mate${mateSuffix}!`
    : label;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-2 w-full"
        >
          {/* Headline */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="flex items-center gap-2"
          >
            <span
              className="text-xl font-bold font-[family-name:var(--font-heading)] text-center"
              style={{ color }}
            >
              {headline}
            </span>
            {glyph && !isMateCase && (
              <span
                className="text-sm font-bold font-[family-name:var(--font-heading)] rounded-full border-2 w-8 h-8 flex items-center justify-center shrink-0"
                style={{ color, borderColor: color }}
              >
                {glyph}
              </span>
            )}
          </motion.div>

          {/* Metrics + best/category — shared grid for alignment */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 w-full mt-1 gap-y-2"
          >
            {/* Pawn Loss */}
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-2xl font-bold font-[family-name:var(--font-mono)]"
                style={{ color }}
              >
                {isMateCase ? "—" : (centipawnLoss / 100).toFixed(2)}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-text-muted">
                pawn loss
              </span>
            </div>

            {/* Accuracy */}
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-2xl font-bold font-[family-name:var(--font-mono)]"
                style={{ color }}
              >
                {accuracy}%
              </span>
              <span className="text-[10px] uppercase tracking-widest text-text-muted">
                accuracy
              </span>
            </div>

            {/* Category */}
            {category && (
              <div className="col-span-2 flex justify-center mt-1">
                <span className="text-[10px] uppercase tracking-widest text-text-muted border border-border rounded-full px-2 py-0.5">
                  {category}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
