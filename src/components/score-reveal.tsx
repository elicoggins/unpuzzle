"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getScoreLabel, getScoreColor, getScoreGlyph, computeMoveAccuracy } from "@/lib/scoring";

interface ScoreRevealProps {
  centipawnLoss: number;
  bestMoveSan: string;
  evalBefore: number;
  evalAfterBest: number;
  evalAfterPlayed: number;
  isMateBefore: boolean;
  mateInBefore: number | null;
  isMateAfterPlayed: boolean;
  mateInAfterPlayed: number | null;
  sideToMove: "w" | "b";
  show: boolean;
}

function formatEval(cp: number, isMate?: boolean, mateIn?: number | null): string {
  if (isMate && mateIn != null) {
    const sign = mateIn > 0 ? "+" : "-";
    return `${sign}M${Math.abs(mateIn)}`;
  }
  const sign = cp >= 0 ? "+" : "";
  return `${sign}${(cp / 100).toFixed(1)}`;
}

export function ScoreReveal({
  centipawnLoss,
  bestMoveSan,
  evalBefore,
  evalAfterBest,
  evalAfterPlayed,
  isMateBefore,
  mateInBefore,
  isMateAfterPlayed,
  mateInAfterPlayed,
  sideToMove,
  show,
}: ScoreRevealProps) {
  // Detect mate scenarios
  const youHadMate = isMateBefore && mateInBefore != null &&
    ((sideToMove === "w" && mateInBefore > 0) || (sideToMove === "b" && mateInBefore < 0));
  const youBlunderedMate = isMateAfterPlayed;

  const isMateCase = youHadMate || youBlunderedMate;

  const label = getScoreLabel(centipawnLoss);
  const color = getScoreColor(centipawnLoss);
  const glyph = getScoreGlyph(centipawnLoss);

  const accuracy = isMateCase
    ? 0
    : computeMoveAccuracy(evalAfterBest, evalAfterPlayed, sideToMove);

  const headline = youBlunderedMate
    ? "You blundered mate!"
    : youHadMate
    ? "You missed mate!"
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
              className="text-xl font-bold font-[family-name:var(--font-mono)] text-center"
              style={{ color }}
            >
              {headline}
            </span>
            {glyph && !isMateCase && (
              <span
                className="text-sm font-bold font-[family-name:var(--font-mono)] rounded-full border-2 w-8 h-8 flex items-center justify-center shrink-0"
                style={{ color, borderColor: color }}
              >
                {glyph}
              </span>
            )}
          </motion.div>

          {/* Two metric chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-6 mt-1"
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
          </motion.div>

          {/* Eval bar: before → after */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 text-xs font-[family-name:var(--font-mono)] mt-1"
          >
            <span className="text-text-secondary">
              {formatEval(evalBefore, isMateBefore, mateInBefore)}
            </span>
            <span className="text-text-muted">→</span>
            <span className="text-text-secondary">
              {formatEval(evalAfterPlayed, isMateAfterPlayed, mateInAfterPlayed)}
            </span>
          </motion.div>

          {/* Best move — always shown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="text-xs text-text-muted mt-0.5"
          >
            best:{" "}
            <span className="text-text-secondary font-[family-name:var(--font-mono)] font-medium">
              {bestMoveSan}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
