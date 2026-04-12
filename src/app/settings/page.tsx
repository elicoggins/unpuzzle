"use client";

import { useState, useEffect } from "react";
import { ACCENT_CHANGE_EVENT, FONT_CHANGE_EVENT } from "@/components/accent-provider";
import { hexToHsl, hslToHex } from "@/lib/color-utils";
import {
  BOARD_THEMES,
  PIECE_SETS,
  SQUARE_TEXTURES,
  loadBoardThemeChoice,
  saveBoardTheme,
  resolveTheme,
  loadPieceSetKey,
  savePieceSet,
  loadSquareTextureKey,
  saveSquareTexture,
  resolveTexture,
  pieceSrc,
  type BoardThemeChoice,
} from "@/lib/board-settings";

const STORAGE_KEY = "accent-color";
const FONT_KEY = "heading-font";
export const DEPTH_KEY = "engine-depth";
export const DEPTH_OPTIONS = [18, 20, 24] as const;
export type EngineDepthOption = typeof DEPTH_OPTIONS[number];

export function loadDepth(): EngineDepthOption {
  try {
    const raw = localStorage.getItem(DEPTH_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if ((DEPTH_OPTIONS as readonly number[]).includes(n)) return n as EngineDepthOption;
    }
  } catch {}
  return 18;
}

const PRESETS = [
  { name: "Green", accent: "#39ff14", accentHover: "#6fff52" },
  { name: "Gold", accent: "#ffd700", accentHover: "#ffe44d" },
  { name: "Pink", accent: "#ff2d95", accentHover: "#ff6db5" },
];

const FONT_OPTIONS = [
  { name: "Orbitron", cssVar: "--font-orbitron" },
  { name: "Space Grotesk", cssVar: "--font-space-grotesk" },
  { name: "Audiowide", cssVar: "--font-audiowide" },
  { name: "Press Start 2P", cssVar: "--font-press-start" },
];

function deriveHover(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(1, l + 0.12));
}

type AccentChoice =
  | { type: "preset"; index: number }
  | { type: "custom"; color: string };

function resolveAccent(choice: AccentChoice): {
  accent: string;
  accentHover: string;
} {
  if (choice.type === "preset") {
    const p = PRESETS[choice.index];
    return { accent: p.accent, accentHover: p.accentHover };
  }
  return { accent: choice.color, accentHover: deriveHover(choice.color) };
}

function loadChoice(): AccentChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.choice) return parsed.choice;
    }
  } catch {
    // ignore
  }
  return { type: "preset", index: 0 };
}

function saveAndApply(choice: AccentChoice) {
  const { accent, accentHover } = resolveAccent(choice);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accent, accentHover, choice })
  );
  window.dispatchEvent(
    new CustomEvent(ACCENT_CHANGE_EVENT, { detail: { accent, accentHover } })
  );
}

export default function SettingsPage() {
  const [choice, setChoice] = useState<AccentChoice>({
    type: "preset",
    index: 0,
  });
  const [mounted, setMounted] = useState(false);
  const [selectedFont, setSelectedFont] = useState("--font-orbitron");
  const [selectedDepth, setSelectedDepth] = useState<EngineDepthOption>(18);
  const [boardThemeChoice, setBoardThemeChoice] = useState<BoardThemeChoice>({
    type: "preset",
    index: 0,
  });
  const [selectedPieceSet, setSelectedPieceSet] = useState(PIECE_SETS[0].key);
  const [selectedTexture, setSelectedTexture] = useState(SQUARE_TEXTURES[0].key);

  useEffect(() => {
    // Accent color
    setChoice(loadChoice());

    // Engine depth
    setSelectedDepth(loadDepth());

    // Board theme
    setBoardThemeChoice(loadBoardThemeChoice());

    // Piece set
    setSelectedPieceSet(loadPieceSetKey());

    // Square texture
    setSelectedTexture(loadSquareTextureKey());

    // Heading font
    try {
      const storedFont = localStorage.getItem(FONT_KEY);
      if (storedFont) {
        try {
          const parsed = JSON.parse(storedFont);
          setSelectedFont(parsed.cssVar);
        } catch {
          setSelectedFont(storedFont);
        }
      }
    } catch {
      // ignore
    }

    setMounted(true);
  }, []);

  function selectPreset(index: number) {
    const next: AccentChoice = { type: "preset", index };
    setChoice(next);
    saveAndApply(next);
  }

  function selectCustom(color: string) {
    const next: AccentChoice = { type: "custom", color };
    setChoice(next);
    saveAndApply(next);
  }

  function selectFont(cssVar: string) {
    setSelectedFont(cssVar);
    localStorage.setItem(FONT_KEY, JSON.stringify({ cssVar }));
    window.dispatchEvent(
      new CustomEvent(FONT_CHANGE_EVENT, { detail: { fontVar: cssVar } })
    );
  }

  function selectDepth(depth: EngineDepthOption) {
    setSelectedDepth(depth);
    localStorage.setItem(DEPTH_KEY, String(depth));
  }

  function selectBoardTheme(choice: BoardThemeChoice) {
    setBoardThemeChoice(choice);
    saveBoardTheme(choice);
  }

  function selectPieceSet(key: string) {
    setSelectedPieceSet(key);
    savePieceSet(key);
  }

  function selectTexture(key: string) {
    setSelectedTexture(key);
    saveSquareTexture(key);
  }

  const currentAccent = resolveAccent(choice).accent;
  const currentBoardTheme = resolveTheme(boardThemeChoice);
  const currentTexture = resolveTexture(selectedTexture);

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-6 py-4">
      <div className="max-w-4xl w-full space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">settings</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Accent Color */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
              theme
            </h2>

            {/* Presets */}
            <div className="space-y-2">
              <div className="text-xs text-text-secondary">presets</div>
              <div className="flex items-center gap-3">
                {PRESETS.map((preset, i) => {
                  const isActive =
                    choice.type === "preset" && choice.index === i;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => selectPreset(i)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer"
                      style={{
                        borderColor: isActive
                          ? preset.accent
                          : "var(--color-border)",
                        background: isActive
                          ? `${preset.accent}15`
                          : "transparent",
                      }}
                    >
                      <span
                        className="w-5 h-5 rounded-full shrink-0"
                        style={{
                          background: preset.accent,
                          boxShadow: isActive
                            ? `0 0 0 2px var(--color-bg-primary), 0 0 0 3px ${preset.accent}`
                            : "none",
                        }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isActive
                            ? preset.accent
                            : "var(--color-text-primary)",
                        }}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom */}
            <div className="space-y-2">
              <div className="text-xs text-text-secondary">custom</div>
              <div className="flex items-center gap-3">
                <div
                  className="relative w-8 h-8 rounded-lg overflow-hidden border transition-colors"
                  style={{
                    borderColor:
                      choice.type === "custom"
                        ? currentAccent
                        : "var(--color-border)",
                    boxShadow:
                      choice.type === "custom"
                        ? `0 0 0 2px var(--color-bg-primary), 0 0 0 3px ${currentAccent}`
                        : "none",
                  }}
                >
                  <input
                    type="color"
                    value={choice.type === "custom" ? choice.color : "#d4a843"}
                    onChange={(e) => selectCustom(e.target.value)}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        choice.type === "custom"
                          ? choice.color
                          : "var(--color-bg-tertiary)",
                    }}
                  />
                </div>
                {mounted && choice.type === "custom" && (
                  <span className="text-sm font-[family-name:var(--font-mono)] text-text-secondary">
                    {choice.color}
                  </span>
                )}
                {mounted && choice.type !== "custom" && (
                  <span className="text-sm text-text-muted">
                    pick any color
                  </span>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-xs text-text-secondary">preview</div>
              <div className="flex items-center gap-3">
                <span
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest border-2 rounded-lg transition-colors"
                  style={{
                    borderColor: currentAccent,
                    color: currentAccent,
                  }}
                >
                  button
                </span>
                <span
                  className="text-base font-bold"
                  style={{ color: currentAccent }}
                >
                  accent text
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: currentAccent }}
                />
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="border border-border rounded-lg p-4 space-y-3 relative">
            {/* 4×4 mini preview — positioned in top-right over header/label whitespace */}
            <div
              className="absolute top-3 right-4 z-10 inline-grid rounded overflow-hidden border border-border"
              style={{
                gridTemplateColumns: "repeat(4, 24px)",
                gridTemplateRows: "repeat(4, 24px)",
              }}
            >
              {Array.from({ length: 16 }).map((_, idx) => {
                const row = Math.floor(idx / 4);
                const col = idx % 4;
                const isDark = (row + col) % 2 === 1;
                const previewPieces: Record<number, string> = {
                  1: "bQ",
                  3: "bK",
                  4: "bP",
                  6: "bP",
                  9: "wN",
                  11: "wB",
                  12: "wR",
                  15: "wK",
                };
                const piece = previewPieces[idx];
                return (
                  <div
                    key={idx}
                    className="relative flex items-center justify-center"
                    style={{
                      backgroundColor: isDark
                        ? currentBoardTheme.dark
                        : currentBoardTheme.light,
                      backgroundImage: currentTexture.overlay,
                      backgroundSize: "128px 128px",
                    }}
                  >
                    {piece && (
                      <img
                        src={pieceSrc(selectedPieceSet, piece as "wK")}
                        alt={piece}
                        className="w-4 h-4"
                        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
              board
            </h2>

            {/* Board theme */}
            <div className="space-y-2">
              <div className="text-xs text-text-secondary">theme</div>
              <div
                className="flex items-center gap-2 overflow-x-auto max-w-[60%]"
                style={{
                  maskImage: "linear-gradient(to right, black 80%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to right, black 80%, transparent 100%)",
                }}
              >
                  {BOARD_THEMES.map((theme, i) => {
                    const isActive =
                      boardThemeChoice.type === "preset" &&
                      boardThemeChoice.index === i;
                    return (
                      <button
                        key={theme.name}
                        onClick={() =>
                          selectBoardTheme({ type: "preset", index: i })
                        }
                        className="flex flex-col items-center gap-1 cursor-pointer group"
                        title={theme.name}
                      >
                        <div
                          className="flex rounded overflow-hidden border-2 transition-colors"
                          style={{
                            borderColor: isActive
                              ? currentAccent
                              : "transparent",
                            boxShadow: isActive
                              ? `0 0 0 1px ${currentAccent}`
                              : "none",
                          }}
                        >
                          <span
                            className="w-5 h-5"
                            style={{ background: theme.light }}
                          />
                          <span
                            className="w-5 h-5"
                            style={{ background: theme.dark }}
                          />
                        </div>
                        <span
                          className="text-[10px] leading-none"
                          style={{
                            color: isActive
                              ? currentAccent
                              : "var(--color-text-muted)",
                          }}
                        >
                          {theme.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom board theme */}
                  <button
                    className="flex flex-col items-center gap-1 cursor-pointer group"
                    title="Custom"
                    onClick={() => {
                      if (boardThemeChoice.type !== "custom") {
                        selectBoardTheme({
                          type: "custom",
                          dark: currentBoardTheme.dark,
                          light: currentBoardTheme.light,
                        });
                      }
                    }}
                  >
                    <div
                      className="flex rounded overflow-hidden border-2 transition-colors relative"
                      style={{
                        borderColor:
                          boardThemeChoice.type === "custom"
                            ? currentAccent
                            : "transparent",
                        boxShadow:
                          boardThemeChoice.type === "custom"
                            ? `0 0 0 1px ${currentAccent}`
                            : "none",
                      }}
                    >
                      <span className="w-5 h-5 bg-bg-tertiary flex items-center justify-center text-[10px] text-text-muted">
                        ✎
                      </span>
                      <span className="w-5 h-5 bg-bg-tertiary flex items-center justify-center text-[10px] text-text-muted">
                        ✎
                      </span>
                    </div>
                    <span
                      className="text-[10px] leading-none"
                      style={{
                        color:
                          boardThemeChoice.type === "custom"
                            ? currentAccent
                            : "var(--color-text-muted)",
                      }}
                    >
                      Custom
                    </span>
                  </button>
              </div>

              {/* Custom color pickers */}
              {boardThemeChoice.type === "custom" && (
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">light</span>
                    <div
                      className="relative w-6 h-6 rounded border border-border overflow-hidden"
                      style={{ background: boardThemeChoice.light }}
                    >
                      <input
                        type="color"
                        value={boardThemeChoice.light}
                        onChange={(e) =>
                          selectBoardTheme({
                            type: "custom",
                            dark: boardThemeChoice.dark,
                            light: e.target.value,
                          })
                        }
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      />
                    </div>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">dark</span>
                    <div
                      className="relative w-6 h-6 rounded border border-border overflow-hidden"
                      style={{ background: boardThemeChoice.dark }}
                    >
                      <input
                        type="color"
                        value={boardThemeChoice.dark}
                        onChange={(e) =>
                          selectBoardTheme({
                            type: "custom",
                            dark: e.target.value,
                            light: boardThemeChoice.light,
                          })
                        }
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      />
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Pieces + Texture side by side */}
            <div className="flex gap-4 overflow-x-auto">
              {/* Piece set */}
              <div className="space-y-1.5">
                <div className="text-xs text-text-secondary">pieces</div>
                <div className="flex items-center gap-2.5">
                  {PIECE_SETS.map((set) => {
                    const isActive = selectedPieceSet === set.key;
                    return (
                      <button
                        key={set.key}
                        onClick={() => selectPieceSet(set.key)}
                        className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer"
                        style={{
                          borderColor: isActive
                            ? currentAccent
                            : "var(--color-border)",
                          background: isActive
                            ? `${currentAccent}15`
                            : "transparent",
                        }}
                      >
                        <img
                          src={pieceSrc(set.key, "wN")}
                          alt={set.name}
                          className="w-8 h-8"
                          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
                        />
                        <span
                          className="text-[11px] font-medium leading-none"
                          style={{
                            color: isActive
                              ? currentAccent
                              : "var(--color-text-primary)",
                          }}
                        >
                          {set.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vertical divider */}
              <div className="border-l border-border" />

              {/* Square texture */}
              <div className="space-y-1.5">
                <div className="text-xs text-text-secondary">texture</div>
                <div className="flex items-center gap-2.5">
                  {SQUARE_TEXTURES.map((tex) => {
                    const isActive = selectedTexture === tex.key;
                    return (
                      <button
                        key={tex.key}
                        onClick={() => selectTexture(tex.key)}
                        className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer"
                        style={{
                          borderColor: isActive
                            ? currentAccent
                            : "var(--color-border)",
                          background: isActive
                            ? `${currentAccent}15`
                            : "transparent",
                        }}
                      >
                        {/* 2×2 mini swatch showing texture on current board colors */}
                        <div
                          className="inline-grid rounded overflow-hidden"
                          style={{
                            gridTemplateColumns: "repeat(2, 16px)",
                            gridTemplateRows: "repeat(2, 16px)",
                          }}
                        >
                          {[false, true, true, false].map((isDark, i) => (
                            <div
                              key={i}
                              style={{
                                backgroundColor: isDark
                                  ? currentBoardTheme.dark
                                  : currentBoardTheme.light,
                                backgroundImage: tex.overlay,
                                backgroundSize: "128px 128px",
                              }}
                            />
                          ))}
                        </div>
                        <span
                          className="text-[11px] font-medium leading-none"
                          style={{
                            color: isActive
                              ? currentAccent
                              : "var(--color-text-primary)",
                          }}
                        >
                          {tex.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Font */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
              font
            </h2>
            <div className="flex flex-col gap-2">
              {FONT_OPTIONS.map((font) => {
                const isActive = selectedFont === font.cssVar;
                return (
                  <button
                    key={font.cssVar}
                    onClick={() => selectFont(font.cssVar)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer text-left"
                    style={{
                      borderColor: isActive
                        ? currentAccent
                        : "var(--color-border)",
                      background: isActive
                        ? `${currentAccent}15`
                        : "transparent",
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: `var(${font.cssVar})`,
                        color: isActive
                          ? currentAccent
                          : "var(--color-text-primary)",
                      }}
                    >
                      {font.name}
                    </span>
                    <span
                      className="text-xs text-text-muted truncate"
                      style={{
                        fontFamily: `var(${font.cssVar})`,
                        fontSize: font.cssVar === "--font-press-start" ? "0.5rem" : undefined,
                      }}
                    >
                      the quick brown fox
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engine Depth */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
              engine depth
            </h2>
            <div className="flex flex-col gap-2">
              {DEPTH_OPTIONS.map((d) => {
                const isActive = selectedDepth === d;
                const label = d === 18 ? "Fast" : d === 20 ? "Balanced" : "Deep";
                const desc = d === 18 ? "~3–5s per move" : d === 20 ? "~8–12s per move" : "~20–30s per move";
                return (
                  <button
                    key={d}
                    onClick={() => selectDepth(d)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer text-left"
                    style={{
                      borderColor: isActive ? currentAccent : "var(--color-border)",
                      background: isActive ? `${currentAccent}15` : "transparent",
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: isActive ? currentAccent : "var(--color-text-primary)" }}>
                      d{d} · {label}
                    </span>
                    <span className="text-xs text-text-muted">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
