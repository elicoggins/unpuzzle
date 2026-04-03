"use client";

import { useEffect } from "react";

const STORAGE_KEY = "accent-color";

function applyAccent(accent: string, accentHover: string) {
  document.documentElement.style.setProperty("--color-accent", accent);
  document.documentElement.style.setProperty("--color-accent-hover", accentHover);
}

export function AccentProvider() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { accent, accentHover } = JSON.parse(stored);
        if (accent && accentHover) {
          applyAccent(accent, accentHover);
        }
      }
    } catch {
      // ignore malformed storage
    }

    function handleAccentChange(e: Event) {
      const { accent, accentHover } = (e as CustomEvent).detail;
      applyAccent(accent, accentHover);
    }

    window.addEventListener("accent-change", handleAccentChange);
    return () => window.removeEventListener("accent-change", handleAccentChange);
  }, []);

  return null;
}
