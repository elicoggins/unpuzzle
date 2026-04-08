import { describe, it, expect } from "vitest";
import {
  getScoreLabel,
  getScoreGlyph,
  getScoreColor,
  getScoreArrowColor,
  computeACPL,
  computeCentipawnLoss,
  computeMoveAccuracy,
} from "./scoring";

describe("getScoreLabel", () => {
  it("returns correct labels at boundaries", () => {
    expect(getScoreLabel(0)).toBe("Perfect");
    expect(getScoreLabel(15)).toBe("Excellent");
    expect(getScoreLabel(50)).toBe("Good");
    expect(getScoreLabel(90)).toBe("Inaccuracy");
    expect(getScoreLabel(150)).toBe("Mistake");
    expect(getScoreLabel(200)).toBe("Blunder");
  });
});

describe("getScoreGlyph", () => {
  it("returns correct glyphs", () => {
    expect(getScoreGlyph(0)).toBe("!!");
    expect(getScoreGlyph(10)).toBe("!");
    expect(getScoreGlyph(30)).toBe("");
    expect(getScoreGlyph(80)).toBe("?!");
    expect(getScoreGlyph(120)).toBe("?");
    expect(getScoreGlyph(200)).toBe("??");
  });
});

describe("getScoreColor / getScoreArrowColor", () => {
  it("returns a non-empty string for any CPL", () => {
    for (const cpl of [0, 10, 50, 90, 150, 300]) {
      expect(getScoreColor(cpl)).toBeTruthy();
      expect(getScoreArrowColor(cpl)).toBeTruthy();
    }
  });
});

describe("computeACPL", () => {
  it("returns 0 for empty array", () => {
    expect(computeACPL([])).toBe(0);
  });

  it("computes average rounded to 1 decimal", () => {
    expect(computeACPL([10, 20, 30])).toBe(20);
    expect(computeACPL([15, 25])).toBe(20);
    expect(computeACPL([11, 22, 33])).toBe(22);
  });

  it("handles single value", () => {
    expect(computeACPL([42])).toBe(42);
  });
});

describe("computeCentipawnLoss", () => {
  it("white: best 100, played 60 → loss 40", () => {
    expect(computeCentipawnLoss(100, 60, "w")).toBe(40);
  });

  it("white: played better than best → 0 (clamped)", () => {
    expect(computeCentipawnLoss(100, 120, "w")).toBe(0);
  });

  it("black: best -200, played -100 → loss 100", () => {
    // For black, a lower (more negative) eval is better
    // Loss = playedEval - bestEval = -100 - (-200) = 100
    expect(computeCentipawnLoss(-200, -100, "b")).toBe(100);
  });

  it("black: played same as best → 0", () => {
    expect(computeCentipawnLoss(-200, -200, "b")).toBe(0);
  });

  it("returns 0 for perfect move", () => {
    expect(computeCentipawnLoss(50, 50, "w")).toBe(0);
    expect(computeCentipawnLoss(-50, -50, "b")).toBe(0);
  });
});

describe("computeMoveAccuracy", () => {
  it("returns 100 for perfect move (same eval)", () => {
    expect(computeMoveAccuracy(100, 100, "w")).toBe(100);
  });

  it("returns 0 or close to 0 for huge blunder", () => {
    // Best: +500, Played: -500 (massive blunder for white)
    const acc = computeMoveAccuracy(500, -500, "w");
    expect(acc).toBeLessThanOrEqual(5);
  });

  it("returns value between 0–100", () => {
    for (const [best, played] of [[200, 100], [0, -100], [300, 50]]) {
      const acc = computeMoveAccuracy(best, played, "w");
      expect(acc).toBeGreaterThanOrEqual(0);
      expect(acc).toBeLessThanOrEqual(100);
    }
  });

  it("accuracy decreases as eval loss increases", () => {
    const acc1 = computeMoveAccuracy(200, 190, "w");
    const acc2 = computeMoveAccuracy(200, 100, "w");
    const acc3 = computeMoveAccuracy(200, -100, "w");
    expect(acc1).toBeGreaterThan(acc2);
    expect(acc2).toBeGreaterThan(acc3);
  });

  it("handles black perspective correctly", () => {
    // Best eval -200 (black winning), Played eval -200 (same) → 100
    expect(computeMoveAccuracy(-200, -200, "b")).toBe(100);
  });
});
