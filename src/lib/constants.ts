import type { PositionCategory } from "./types";

// ── CPL thresholds & score tier configuration ────────────────────────────

export const CPL_THRESHOLDS = {
  perfect: 0,
  excellent: 15,
  good: 50,
  inaccuracy: 90,
  mistake: 150,
} as const;

export interface ScoreTier {
  label: string;
  glyph: string;
  color: string;
  arrowColor: string;
}

/**
 * Ordered array of score tiers. Walk from top to find the first tier whose
 * `maxCpl` is ≥ the centipawn loss. The last entry is the catch-all (Blunder).
 */
export const SCORE_TIERS: { maxCpl: number; tier: ScoreTier }[] = [
  {
    maxCpl: CPL_THRESHOLDS.perfect,
    tier: {
      label: "Perfect",
      glyph: "!!",
      color: "var(--color-score-perfect)",
      arrowColor: "rgba(57, 255, 20, 0.75)",   // neon green
    },
  },
  {
    maxCpl: CPL_THRESHOLDS.excellent,
    tier: {
      label: "Excellent",
      glyph: "!",
      color: "var(--color-score-perfect)",
      arrowColor: "rgba(57, 255, 20, 0.75)",   // neon green
    },
  },
  {
    maxCpl: CPL_THRESHOLDS.good,
    tier: {
      label: "Good",
      glyph: "",
      color: "var(--color-score-good)",
      arrowColor: "rgba(57, 255, 20, 0.55)",   // neon green (softer)
    },
  },
  {
    maxCpl: CPL_THRESHOLDS.inaccuracy,
    tier: {
      label: "Inaccuracy",
      glyph: "?!",
      color: "var(--color-score-inaccuracy)",
      arrowColor: "rgba(255, 255, 0, 0.7)",    // neon yellow
    },
  },
  {
    maxCpl: CPL_THRESHOLDS.mistake,
    tier: {
      label: "Mistake",
      glyph: "?",
      color: "var(--color-score-mistake)",
      arrowColor: "rgba(255, 102, 0, 0.7)",    // neon orange
    },
  },
];

/** Fallback tier when CPL exceeds all thresholds. */
export const BLUNDER_TIER: ScoreTier = {
  label: "Blunder",
  glyph: "??",
  color: "var(--color-score-blunder)",
  arrowColor: "rgba(255, 0, 64, 0.75)",        // neon red
};

/** Look up the score tier for a given centipawn loss. */
export function getScoreTier(centipawnLoss: number): ScoreTier {
  for (const { maxCpl, tier } of SCORE_TIERS) {
    if (centipawnLoss <= maxCpl) return tier;
  }
  return BLUNDER_TIER;
}

// ── Engine constants ─────────────────────────────────────────────────────

/** Sentinel centipawn value used to represent forced mate in engine output. */
export const MATE_EVAL_SENTINEL = 100_000;

/**
 * Coefficient for the centipawn → win-probability sigmoid.
 * Formula: winPct = 100 / (1 + e^(-k * cp))
 * Derived from Lichess analysis of millions of games.
 */
export const WIN_PROBABILITY_COEFFICIENT = 0.00368208;

// ── Display limits ───────────────────────────────────────────────────────

/** Max moves shown in engine PV lines. */
export const ENGINE_LINE_MAX_MOVES = 8;

/** Max moves shown in the "best line" section of move explanation. */
export const BEST_LINE_MAX_MOVES = 6;

/** Max moves shown in the "threat/refutation" section of move explanation. */
export const THREAT_LINE_MAX_MOVES = 5;

/** Width in px of the evaluation bar. */
export const EVAL_BAR_WIDTH = 28;

// ── Position sampling weights ────────────────────────────────────────────

export const CATEGORY_WEIGHTS: Record<PositionCategory, number> = {
  tactical: 0.20,
  balanced: 0.25,
  critical: 0.20,
  tricky: 0.15,
  endgame: 0.20,
};
