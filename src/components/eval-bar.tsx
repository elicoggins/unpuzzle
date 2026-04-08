"use client";

import { EVAL_BAR_WIDTH } from "@/lib/constants";

interface EvalBarProps {
  /** Centipawn eval from white's perspective */
  eval: number;
  isMate: boolean;
  mateIn: number | null;
  /** Height to match the board */
  height: number;
  /** Which side is at the bottom of the board */
  orientation: "white" | "black";
  /** When false, show 50/50 with a dash instead of the real eval */
  revealed?: boolean;
}

function evalToWhiteFraction(cp: number, isMate: boolean, mateIn: number | null): number {
  if (isMate && mateIn != null) {
    return mateIn > 0 ? 1 : 0;
  }
  // Sigmoid mapping: maps centipawns to 0..1 range for white
  // At 0 cp -> 0.5, at +400 cp -> ~0.88, at -400 cp -> ~0.12
  return 1 / (1 + Math.pow(10, -cp / 400));
}

function formatEvalLabel(cp: number, isMate: boolean, mateIn: number | null): string {
  if (isMate && mateIn != null) {
    return `M${Math.abs(mateIn)}`;
  }
  const abs = Math.abs(cp) / 100;
  return abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
}

export function EvalBar({ eval: cp, isMate, mateIn, height, orientation, revealed = true }: EvalBarProps) {
  const whiteFraction = revealed ? evalToWhiteFraction(cp, isMate, mateIn) : 0.5;
  const whitePercent = whiteFraction * 100;

  const isWhiteAdvantage = revealed && (isMate ? (mateIn != null && mateIn > 0) : cp > 0);
  const isBlackAdvantage = revealed && (isMate ? (mateIn != null && mateIn < 0) : cp < 0);
  const isEven = !revealed || (!isMate && cp === 0);

  const label = revealed ? formatEvalLabel(cp, isMate, mateIn) : "–";

  // Fill white from the side of the board where white sits:
  // normal (white at bottom) → fill from bottom; flipped (black at bottom) → fill from top
  const fillFromTop = orientation === "black";

  // Label position: always on the advantaged side
  const showLabelOnBottom = orientation === "white"
    ? (isWhiteAdvantage || isEven)
    : (isBlackAdvantage || isEven);

  // Text color must contrast with the zone behind the label
  // White zone: bottom when normal, top when flipped → use dark text
  // Dark zone: top when normal, bottom when flipped → use light text
  const labelInWhiteZone = orientation === "white" ? showLabelOnBottom : !showLabelOnBottom;

  return (
    <div
      className="relative flex-shrink-0 rounded overflow-hidden"
      style={{ width: EVAL_BAR_WIDTH, height }}
    >
      {/* Dark background (entire bar) */}
      <div className="absolute inset-0 bg-[var(--color-eval-black)]" />

      {/* White fill from the white side of the board */}
      <div
        className={`absolute ${fillFromTop ? "top-0" : "bottom-0"} left-0 right-0 bg-[var(--color-eval-white)] transition-all duration-500 ease-out`}
        style={{ height: `${whitePercent}%` }}
      />

      {/* Eval label */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-mono)] select-none h-5 ${
          showLabelOnBottom ? "bottom-0" : "top-0"
        } ${labelInWhiteZone ? "text-[var(--color-eval-black)]" : "text-[var(--color-eval-white)]"}`}
      >
        {label}
      </div>
    </div>
  );
}
