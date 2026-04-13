"use client";

import { useEffect } from "react";
import {
  loadBoardThemeChoice,
  resolveTheme,
  BOARD_THEME_CHANGE_EVENT,
  loadSquareTextureKey,
  resolveTexture,
  SQUARE_TEXTURE_CHANGE_EVENT,
  boardHighlightPcts,
  type BoardTheme,
  type SquareTexture,
} from "@/lib/board-settings";

const ACCENT_KEY = "accent-color";
const FONT_KEY = "heading-font";
export const ACCENT_CHANGE_EVENT = "accent-change";
export const FONT_CHANGE_EVENT = "font-change";

function applyAccent(accent: string, accentHover: string) {
  document.documentElement.style.setProperty("--color-accent", accent);
  document.documentElement.style.setProperty("--color-accent-hover", accentHover);
}

function applyFont(fontVar: string) {
  document.documentElement.style.setProperty("--font-heading", `var(${fontVar})`);
}

function applyBoardTheme(theme: BoardTheme) {
  const s = document.documentElement.style;
  s.setProperty("--color-board-dark", theme.dark);
  s.setProperty("--color-board-light", theme.light);
  s.setProperty("--color-board-notation-dark", theme.notationDark);
  s.setProperty("--color-board-notation-light", theme.notationLight);
  const pcts = boardHighlightPcts(theme);
  s.setProperty("--board-highlight-soft", pcts.soft);
  s.setProperty("--board-highlight-mid", pcts.mid);
  s.setProperty("--board-highlight-strong", pcts.strong);
}

function applySquareTexture(texture: SquareTexture) {
  const s = document.documentElement.style;
  s.setProperty("--board-texture", texture.overlay);
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

    // Board theme
    try {
      const choice = loadBoardThemeChoice();
      applyBoardTheme(resolveTheme(choice));
    } catch {
      // ignore
    }

    // Square texture
    try {
      applySquareTexture(resolveTexture(loadSquareTextureKey()));
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

    function handleBoardThemeChange(e: Event) {
      applyBoardTheme((e as CustomEvent).detail as BoardTheme);
    }

    function handleSquareTextureChange(e: Event) {
      applySquareTexture((e as CustomEvent).detail as SquareTexture);
    }

    window.addEventListener(ACCENT_CHANGE_EVENT, handleAccentChange);
    window.addEventListener(FONT_CHANGE_EVENT, handleFontChange);
    window.addEventListener(BOARD_THEME_CHANGE_EVENT, handleBoardThemeChange);
    window.addEventListener(SQUARE_TEXTURE_CHANGE_EVENT, handleSquareTextureChange);
    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, handleAccentChange);
      window.removeEventListener(FONT_CHANGE_EVENT, handleFontChange);
      window.removeEventListener(BOARD_THEME_CHANGE_EVENT, handleBoardThemeChange);
      window.removeEventListener(SQUARE_TEXTURE_CHANGE_EVENT, handleSquareTextureChange);
    };
  }, []);

  return null;
}
