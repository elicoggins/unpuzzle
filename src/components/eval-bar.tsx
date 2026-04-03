"use client";

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
  // If board is flipped (black on bottom), we invert the bar so black's advantage fills from the bottom
  const fillFromBottom = orientation === "white" ? whiteFraction : 1 - whiteFraction;
  const whitePercent = fillFromBottom * 100;

  const isWhiteAdvantage = revealed && (isMate ? (mateIn != null && mateIn > 0) : cp > 0);
  const isBlackAdvantage = revealed && (isMate ? (mateIn != null && mateIn < 0) : cp < 0);
  const isEven = !revealed || (!isMate && cp === 0);

  // Show label on the advantaged side
  const label = revealed ? formatEvalLabel(cp, isMate, mateIn) : "–";

  // Determine which side the label goes on (top = black zone, bottom = white zone)
  // In default orientation (white at bottom): bottom is white, top is black
  const showLabelOnBottom =
    orientation === "white" ? isWhiteAdvantage || isEven : isBlackAdvantage || isEven;

  return (
    <div
      className="relative flex-shrink-0 rounded overflow-hidden"
      style={{ width: 28, height }}
    >
      {/* Black background (entire bar) */}
      <div className="absolute inset-0 bg-[#333333]" />

      {/* White fill from bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#e8e8e8] transition-all duration-500 ease-out"
        style={{ height: `${whitePercent}%` }}
      />

      {/* Eval label */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-mono)] select-none ${
          showLabelOnBottom
            ? "bottom-0 text-[#333333] h-5"
            : "top-0 text-[#e8e8e8] h-5"
        }`}
      >
        {label}
      </div>
    </div>
  );
}
