import { describe, it, expect } from "vitest";
import { hexToHsl, hslToHex } from "./color-utils";

describe("hexToHsl", () => {
  it("converts black", () => {
    const [h, s, l] = hexToHsl("#000000");
    expect(l).toBeCloseTo(0);
  });

  it("converts white", () => {
    const [, , l] = hexToHsl("#ffffff");
    expect(l).toBeCloseTo(1);
  });

  it("converts pure red", () => {
    const [h, s, l] = hexToHsl("#ff0000");
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts pure green", () => {
    const [h, s, l] = hexToHsl("#00ff00");
    expect(h).toBeCloseTo(1 / 3, 2);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts pure blue", () => {
    const [h, s, l] = hexToHsl("#0000ff");
    expect(h).toBeCloseTo(2 / 3, 2);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  it("converts a gray", () => {
    const [h, s, l] = hexToHsl("#808080");
    expect(s).toBeCloseTo(0);
    expect(l).toBeCloseTo(0.5, 1);
  });
});

describe("hslToHex", () => {
  it("converts black", () => {
    expect(hslToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts white", () => {
    expect(hslToHex(0, 0, 1)).toBe("#ffffff");
  });

  it("converts pure red", () => {
    expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
  });

  it("converts 50% gray", () => {
    expect(hslToHex(0, 0, 0.5).toLowerCase()).toBe("#808080");
  });
});

describe("hexToHsl → hslToHex roundtrip", () => {
  const colors = ["#39ff14", "#ff6600", "#ff0040", "#ffff00", "#333333", "#e8e8e8"];

  for (const hex of colors) {
    it(`roundtrips ${hex}`, () => {
      const [h, s, l] = hexToHsl(hex);
      const result = hslToHex(h, s, l);
      expect(result.toLowerCase()).toBe(hex.toLowerCase());
    });
  }
});
