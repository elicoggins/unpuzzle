"use client";

import { useEffect } from "react";

const ACCENT_KEY = "accent-color";
const FONT_KEY = "heading-font";

function applyAccent(accent: string, accentHover: string) {
  document.documentElement.style.setProperty("--color-accent", accent);
  document.documentElement.style.setProperty("--color-accent-hover", accentHover);
}

function applyFont(fontVar: string) {
  document.documentElement.style.setProperty("--font-heading", `var(${fontVar})`);
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
          applyFont(parsed.cssVar);
        } catch {
          applyFont(fontRaw);
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
      const { fontVar } = (e as CustomEvent).detail;
      applyFont(fontVar);
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
