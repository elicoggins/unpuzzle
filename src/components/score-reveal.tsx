"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getScoreLabel, getScoreColor, getScoreGlyph } from "@/lib/scoring";

interface ScoreRevealProps {
  centipawnLoss: number;
  bestMoveSan: string;
  evalBefore: number;
  evalAfterPlayed: number;
  isMateBefore: boolean;
  mateInBefore: number | null;
  show: boolean;
}

function formatEval(cp: number, isMate?: boolean, mateIn?: number | null): string {
  if (isMate && mateIn != null) {
    return `M${Math.abs(mateIn)}`;
  }
  const sign = cp >= 0 ? "+" : "";
  return `${sign}${(cp / 100).toFixed(1)}`;
}

export function ScoreReveal({
  centipawnLoss,
  bestMoveSan,
  evalBefore,
  evalAfterPlayed,
  isMateBefore,
  mateInBefore,
  show,
}: ScoreRevealProps) {
  const label = getScoreLabel(centipawnLoss);
  const color = getScoreColor(centipawnLoss);
  const glyph = getScoreGlyph(centipawnLoss);

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
          {/* Centipawn loss headline */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="text-3xl font-bold font-[family-name:var(--font-mono)]"
            style={{ color }}
          >
            −{(centipawnLoss / 100).toFixed(2)}
            {glyph && (
              <span className="text-lg ml-1 opacity-80">{glyph}</span>
            )}
          </motion.div>

          {/* Label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color }}
          >
            {label}
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
              {formatEval(evalAfterPlayed)}
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
