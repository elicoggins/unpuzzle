import { describe, it, expect } from "vitest";
import {
  getScoreTier,
  CPL_THRESHOLDS,
  BLUNDER_TIER,
  SCORE_TIERS,
  MATE_EVAL_SENTINEL,
  WIN_PROBABILITY_COEFFICIENT,
} from "./constants";

describe("getScoreTier", () => {
  it("returns Perfect for 0 CPL", () => {
    expect(getScoreTier(0).label).toBe("Perfect");
    expect(getScoreTier(0).glyph).toBe("!!");
  });

  it("returns Excellent for CPL ≤ 15", () => {
    expect(getScoreTier(1).label).toBe("Excellent");
    expect(getScoreTier(15).label).toBe("Excellent");
    expect(getScoreTier(15).glyph).toBe("!");
  });

  it("returns Good for CPL ≤ 50", () => {
    expect(getScoreTier(16).label).toBe("Good");
    expect(getScoreTier(50).label).toBe("Good");
    expect(getScoreTier(50).glyph).toBe("");
  });

  it("returns Inaccuracy for CPL ≤ 90", () => {
    expect(getScoreTier(51).label).toBe("Inaccuracy");
    expect(getScoreTier(90).label).toBe("Inaccuracy");
    expect(getScoreTier(90).glyph).toBe("?!");
  });

  it("returns Mistake for CPL ≤ 150", () => {
    expect(getScoreTier(91).label).toBe("Mistake");
    expect(getScoreTier(150).label).toBe("Mistake");
    expect(getScoreTier(150).glyph).toBe("?");
  });

  it("returns Blunder for CPL > 150", () => {
    expect(getScoreTier(151)).toBe(BLUNDER_TIER);
    expect(getScoreTier(500).label).toBe("Blunder");
    expect(getScoreTier(500).glyph).toBe("??");
  });

  it("SCORE_TIERS are sorted by maxCpl ascending", () => {
    for (let i = 1; i < SCORE_TIERS.length; i++) {
      expect(SCORE_TIERS[i].maxCpl).toBeGreaterThan(SCORE_TIERS[i - 1].maxCpl);
    }
  });
});

describe("CPL_THRESHOLDS", () => {
  it("has expected boundary values", () => {
    expect(CPL_THRESHOLDS.perfect).toBe(0);
    expect(CPL_THRESHOLDS.excellent).toBe(15);
    expect(CPL_THRESHOLDS.good).toBe(50);
    expect(CPL_THRESHOLDS.inaccuracy).toBe(90);
    expect(CPL_THRESHOLDS.mistake).toBe(150);
  });
});

describe("engine constants", () => {
  it("MATE_EVAL_SENTINEL is 100000", () => {
    expect(MATE_EVAL_SENTINEL).toBe(100_000);
  });

  it("WIN_PROBABILITY_COEFFICIENT is the expected value", () => {
    expect(WIN_PROBABILITY_COEFFICIENT).toBeCloseTo(0.00368208, 6);
  });
});
