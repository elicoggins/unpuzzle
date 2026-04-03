"use client";

import { useState, useEffect } from "react";

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

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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
    new CustomEvent("accent-change", { detail: { accent, accentHover } })
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

  useEffect(() => {
    setChoice(loadChoice());
    setSelectedDepth(loadDepth());
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
      new CustomEvent("font-change", { detail: { fontVar: cssVar } })
    );
  }

  function selectDepth(depth: EngineDepthOption) {
    setSelectedDepth(depth);
    localStorage.setItem(DEPTH_KEY, String(depth));
  }

  const currentAccent = resolveAccent(choice).accent;

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-6 py-6">
      <div className="max-w-4xl w-full space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">settings</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Accent Color */}
          <div className="border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
              accent color
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

          {/* Font */}
          <div className="border border-border rounded-lg p-5 space-y-4">
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
          <div className="border border-border rounded-lg p-5 space-y-4">
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
