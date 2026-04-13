// Board theme presets & piece set registry
// Piece SVGs sourced from lichess/lila (AGPL-3.0) — https://github.com/lichess-org/lila

import { hexToHsl, hslToHex } from "@/lib/color-utils";

// ── Board color themes ──────────────────────────────────────────────

export interface BoardTheme {
  name: string;
  dark: string;
  light: string;
  notationDark: string;
  notationLight: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    name: "Default",
    dark: "#2e2e2e",
    light: "#424242",
    notationDark: "#666666",
    notationLight: "#555555",
  },
  {
    name: "Forest",
    dark: "#4a7a4a",
    light: "#8ab88a",
    notationDark: "#a0d0a0",
    notationLight: "#3a6a3a",
  },
  {
    name: "Ocean",
    dark: "#2b4764",
    light: "#5a7a8a",
    notationDark: "#7a9aaa",
    notationLight: "#3a5a6a",
  },
  {
    name: "Walnut",
    dark: "#4a3f3a",
    light: "#a89888",
    notationDark: "#c0b0a0",
    notationLight: "#635850",
  },
];

// ── Piece sets ──────────────────────────────────────────────────────

export interface PieceSet {
  name: string;
  key: string;
}

export const PIECE_SETS: PieceSet[] = [
  { name: "Neo", key: "cburnett" },
  { name: "Merida", key: "merida" },
  { name: "Staunty", key: "staunty" },
];

export const PIECE_KEYS = [
  "wK", "wQ", "wR", "wB", "wN", "wP",
  "bK", "bQ", "bR", "bB", "bN", "bP",
] as const;

export type PieceKey = (typeof PIECE_KEYS)[number];

// ── Theme choice types ──────────────────────────────────────────────

export type BoardThemeChoice =
  | { type: "preset"; index: number }
  | { type: "custom"; dark: string; light: string };

// ── Asset base path ─────────────────────────────────────────────────

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// ── Square textures ─────────────────────────────────────────────────

export interface SquareTexture {
  name: string;
  key: string;
  overlay: string;
}

const texturePath = (file: string) =>
  `url('${basePath}/textures/${file}')`;

export const SQUARE_TEXTURES: SquareTexture[] = [
  {
    name: "None",
    key: "none",
    overlay: "none",
  },
  {
    name: "Grain",
    key: "grain",
    overlay: texturePath("grain.png"),
  },
  {
    name: "Wood",
    key: "wood",
    overlay: texturePath("wood.png"),
  },
];

// ── localStorage keys & events ──────────────────────────────────────

const BOARD_THEME_KEY = "board-theme";
const PIECE_SET_KEY = "piece-set";
const SQUARE_TEXTURE_KEY = "square-texture";

export const BOARD_THEME_CHANGE_EVENT = "board-theme-change";
export const PIECE_SET_CHANGE_EVENT = "piece-set-change";
export const SQUARE_TEXTURE_CHANGE_EVENT = "square-texture-change";

// ── Board theme persistence ─────────────────────────────────────────

export function resolveTheme(choice: BoardThemeChoice): BoardTheme {
  if (choice.type === "preset") {
    return BOARD_THEMES[choice.index] ?? BOARD_THEMES[0];
  }
  return {
    name: "Custom",
    dark: choice.dark,
    light: choice.light,
    notationDark: deriveNotation(choice.dark, true),
    notationLight: deriveNotation(choice.light, false),
  };
}

/** Derive notation color: lighten dark squares, darken light squares */
function deriveNotation(hex: string, lighten: boolean): string {
  const [h, s, l] = hexToHsl(hex);
  const shift = lighten ? 0.2 : -0.2;
  return hslToHex(h, s, Math.max(0, Math.min(1, l + shift)));
}

export function loadBoardThemeChoice(): BoardThemeChoice {
  try {
    const raw = localStorage.getItem(BOARD_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.choice) return parsed.choice as BoardThemeChoice;
    }
  } catch {}
  return { type: "preset", index: 0 };
}

export function saveBoardTheme(choice: BoardThemeChoice) {
  const theme = resolveTheme(choice);
  localStorage.setItem(
    BOARD_THEME_KEY,
    JSON.stringify({ theme, choice })
  );
  window.dispatchEvent(
    new CustomEvent(BOARD_THEME_CHANGE_EVENT, { detail: theme })
  );
}

// ── Piece set persistence ───────────────────────────────────────────

export function loadPieceSetKey(): string {
  try {
    const raw = localStorage.getItem(PIECE_SET_KEY);
    if (raw && PIECE_SETS.some((s) => s.key === raw)) return raw;
  } catch {}
  return PIECE_SETS[0].key;
}

export function savePieceSet(key: string) {
  localStorage.setItem(PIECE_SET_KEY, key);
  window.dispatchEvent(
    new CustomEvent(PIECE_SET_CHANGE_EVENT, { detail: { key } })
  );
}

// ── Square texture persistence ───────────────────────────────────────

export function loadSquareTextureKey(): string {
  try {
    const raw = localStorage.getItem(SQUARE_TEXTURE_KEY);
    if (raw && SQUARE_TEXTURES.some((t) => t.key === raw)) return raw;
  } catch {}
  return SQUARE_TEXTURES[0].key;
}

export function resolveTexture(key: string): SquareTexture {
  return SQUARE_TEXTURES.find((t) => t.key === key) ?? SQUARE_TEXTURES[0];
}

export function saveSquareTexture(key: string) {
  localStorage.setItem(SQUARE_TEXTURE_KEY, key);
  const texture = resolveTexture(key);
  window.dispatchEvent(
    new CustomEvent(SQUARE_TEXTURE_CHANGE_EVENT, { detail: texture })
  );
}

// ── Piece object builder ────────────────────────────────────────────

export function pieceSrc(setKey: string, piece: PieceKey): string {
  return `${basePath}/pieces/${setKey}/${piece}.svg`;
}

export function buildPiecesObject(
  setKey: string
): Record<string, () => React.JSX.Element> {
  const pieces: Record<string, () => React.JSX.Element> = {};
  for (const piece of PIECE_KEYS) {
    const src = pieceSrc(setKey, piece);
    pieces[piece] = () => (
      <img
        src={src}
        alt={piece}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  return pieces;
}
