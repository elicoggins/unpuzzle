"use client";

import { useEffect } from "react";

const ACCENT_KEY = "accent-color";
const FONT_KEY = "heading-font";

function applyAccent(accent: string, accentHover: string) {
  document.documentElement.style.setProperty("--color-accent", accent);
  document.documentElement.style.setProperty("--color-accent-hover", accentHover);
}

function applyFont(fontVar: string, scale: number) {
  document.documentElement.style.setProperty("--font-heading", `var(${fontVar})`);
  document.documentElement.style.setProperty("--font-scale", String(scale));
}

export function AccentProvider() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACCENT_KEY);
      if (stored) {
        const { accent, accentHover } = JSON.parse(stored);
        if (accent && accentHover) {
          applyAccent(accent, accentHover);
        }
      }
    } catch {
      // ignore malformed storage
    }

    try {
      const fontRaw = localStorage.getItem(FONT_KEY);
      if (fontRaw) {
        try {
          const parsed = JSON.parse(fontRaw);
          applyFont(parsed.cssVar, parsed.scale ?? 1);
        } catch {
          applyFont(fontRaw, 1);
        }
      }
    } catch {
      // ignore
    }

    function handleAccentChange(e: Event) {
      const { accent, accentHover } = (e as CustomEvent).detail;
      applyAccent(accent, accentHover);
    }

    function handleFontChange(e: Event) {
      const { fontVar, scale } = (e as CustomEvent).detail;
      applyFont(fontVar, scale ?? 1);
    }

    window.addEventListener("accent-change", handleAccentChange);
    window.addEventListener("font-change", handleFontChange);
    return () => {
      window.removeEventListener("accent-change", handleAccentChange);
      window.removeEventListener("font-change", handleFontChange);
    };
  }, []);

  return null;
}
