import { describe, it, expect } from "vitest";
import {
  parseUciMove,
  uciPvToSan,
  walkUciPath,
  hadMateAvailable,
} from "./chess-utils";

// Standard starting position
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Italian game after 1.e4 e5 2.Nf3 Nc6 3.Bc4
const ITALIAN_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";

describe("parseUciMove", () => {
  it("parses standard 4-char move", () => {
    expect(parseUciMove("e2e4")).toEqual({ from: "e2", to: "e4", promotion: undefined });
  });

  it("parses promotion move", () => {
    expect(parseUciMove("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
  });

  it("returns null for too-short string", () => {
    expect(parseUciMove("e2")).toBeNull();
    expect(parseUciMove("")).toBeNull();
    expect(parseUciMove("abc")).toBeNull();
  });
});

describe("uciPvToSan", () => {
  it("converts opening moves from starting position", () => {
    const result = uciPvToSan(START_FEN, ["e2e4", "e7e5", "g1f3"]);
    expect(result).toEqual(["e4", "e5", "Nf3"]);
  });

  it("returns empty array for empty PV", () => {
    expect(uciPvToSan(START_FEN, [])).toEqual([]);
  });

  it("stops at invalid move", () => {
    const result = uciPvToSan(START_FEN, ["e2e4", "xxxx", "g1f3"]);
    expect(result).toEqual(["e4"]);
  });

  it("converts from mid-game position", () => {
    const result = uciPvToSan(ITALIAN_FEN, ["g8f6"]);
    expect(result).toEqual(["Nf6"]);
  });
});

describe("walkUciPath", () => {
  it("returns SAN and FEN for each step", () => {
    const result = walkUciPath(START_FEN, ["e2e4", "e7e5"], 1);
    expect(result).toHaveLength(2);
    expect(result[0].san).toBe("e4");
    expect(result[1].san).toBe("e5");
    // Each FEN should be a valid position string
    expect(result[0].fen).toContain("rnbqkbnr");
    expect(result[1].fen).toContain("rnbqkbnr");
  });

  it("respects upToIndex limit", () => {
    const result = walkUciPath(START_FEN, ["e2e4", "e7e5", "g1f3"], 0);
    expect(result).toHaveLength(1);
    expect(result[0].san).toBe("e4");
  });

  it("returns empty for empty moves", () => {
    expect(walkUciPath(START_FEN, [], 0)).toEqual([]);
  });
});

describe("hadMateAvailable", () => {
  it("white had mate: mateIn > 0", () => {
    expect(hadMateAvailable(true, 3, "w")).toBe(true);
  });

  it("black had mate: mateIn < 0", () => {
    expect(hadMateAvailable(true, -2, "b")).toBe(true);
  });

  it("returns false when isMateBefore is false", () => {
    expect(hadMateAvailable(false, 3, "w")).toBe(false);
  });

  it("returns false when mateIn is null", () => {
    expect(hadMateAvailable(true, null, "w")).toBe(false);
  });

  it("returns false when mate favors the other side (white to move, mateIn < 0)", () => {
    expect(hadMateAvailable(true, -2, "w")).toBe(false);
  });

  it("returns false when mate favors the other side (black to move, mateIn > 0)", () => {
    expect(hadMateAvailable(true, 2, "b")).toBe(false);
  });
});
