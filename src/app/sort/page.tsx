"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Timer } from "@/components/timer";
import { BoardCenter } from "@/components/play/board-center";
import { RightPanel } from "@/components/play/right-panel";
import { MoveHistory } from "@/components/play/move-history";
import { getEngine } from "@/lib/chess-engine";
import { getAllPositions, type CuratedPosition } from "@/lib/positions";
import { useEvaluation } from "@/hooks/use-evaluation";
import { useBoardInteraction } from "@/hooks/use-board-interaction";
import { useBoardSize } from "@/hooks/use-board-size";
import type { GameState } from "@/lib/game-state";
import type { Position, PositionCategory } from "@/lib/types";

// ── Sort-specific constants & helpers ────────────────────────────────

const SORT_STORAGE_KEY = "sort-decisions";
const SORT_SECRET = process.env.NEXT_PUBLIC_SORT_SECRET ?? "";

function loadDecisions(): Record<string, "keep" | "delete"> {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveDecisions(d: Record<string, "keep" | "delete">) {
  localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(d));
}

type CategoryPref = { cat: PositionCategory; enabled: boolean };
const ALL_SORT_CATEGORIES: PositionCategory[] = ["tactical", "balanced", "critical", "tricky", "endgame"];
const SORT_CAT_PREFS_KEY = "sort-category-prefs";

function loadCategoryPrefs(): CategoryPref[] {
  try {
    const raw = localStorage.getItem(SORT_CAT_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CategoryPref[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((p) => ALL_SORT_CATEGORIES.includes(p.cat))) {
        const existing = new Set(parsed.map((p) => p.cat));
        const extra = ALL_SORT_CATEGORIES.filter((c) => !existing.has(c)).map((c) => ({ cat: c, enabled: true }));
        return [...parsed, ...extra];
      }
    }
  } catch {}
  return ALL_SORT_CATEGORIES.map((cat) => ({ cat, enabled: true }));
}

function saveCategoryPrefs(prefs: CategoryPref[]) {
  localStorage.setItem(SORT_CAT_PREFS_KEY, JSON.stringify(prefs));
}

function pickWeightedUnsorted(
  decisions: Record<string, string>,
  prefs: CategoryPref[],
): CuratedPosition | null {
  const enabledCats = new Set(prefs.filter((p) => p.enabled).map((p) => p.cat));
  const candidates = getAllPositions().filter(
    (p) => !(p.id in decisions) && enabledCats.has(p.category as PositionCategory),
  );
  if (candidates.length === 0) return null;
  const enabledPrefs = prefs.filter((p) => p.enabled);
  const numEnabled = enabledPrefs.length;
  const weightByCat = new Map<string, number>();
  enabledPrefs.forEach((p, idx) => weightByCat.set(p.cat, numEnabled - idx));
  const totalWeight = candidates.reduce((sum, p) => sum + (weightByCat.get(p.category!) ?? 1), 0);
  let roll = Math.random() * totalWeight;
  for (const pos of candidates) {
    roll -= weightByCat.get(pos.category!) ?? 1;
    if (roll <= 0) return pos;
  }
  return candidates[candidates.length - 1];
}

// ── Component ────────────────────────────────────────────────────────

export default function SortPage() {
  // ── Auth gate ──
  const [authed, setAuthed] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // ── Sort decisions ──
  const [decisions, setDecisions] = useState<Record<string, "keep" | "delete">>({});
  const [allDone, setAllDone] = useState(false);

  // ── Game state ──
  const [position, setPosition] = useState<Position | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  // ── Category prefs ──
  const [categoryPrefs, setCategoryPrefs] = useState<CategoryPref[]>(() =>
    ALL_SORT_CATEGORIES.map((cat) => ({ cat, enabled: true })),
  );

  // ── Stats ──
  const enabledCats = useMemo(
    () => new Set(categoryPrefs.filter((p) => p.enabled).map((p) => p.cat)),
    [categoryPrefs],
  );
  const allPositionsFlat = useMemo(() => getAllPositions(), []);
  const positionsInScope = useMemo(
    () => allPositionsFlat.filter((p) => enabledCats.has(p.category as PositionCategory)),
    [allPositionsFlat, enabledCats],
  );
  const totalPositions = positionsInScope.length;
  const keptCount = useMemo(
    () => positionsInScope.filter((p) => decisions[p.id] === "keep").length,
    [positionsInScope, decisions],
  );
  const deletedCount = useMemo(
    () => positionsInScope.filter((p) => decisions[p.id] === "delete").length,
    [positionsInScope, decisions],
  );
  const remaining = totalPositions - keptCount - deletedCount;
  const unsortedCountByCat = useMemo(() => {
    const counts = {} as Record<PositionCategory, number>;
    for (const cat of ALL_SORT_CATEGORIES) {
      counts[cat] = allPositionsFlat.filter((p) => p.category === cat && !(p.id in decisions)).length;
    }
    return counts;
  }, [allPositionsFlat, decisions]);

  // ── Hooks ──
  const { boardSize, boardContainerRef, handleResizeStart } = useBoardSize();
  const {
    engineDepth, engineLines, evalForBar, feedback, lastPlayedUci,
    evaluateMove, resetEvaluation,
  } = useEvaluation(position, setGameState, setTimerRunning);
  const board = useBoardInteraction(
    position, gameState, feedback, lastPlayedUci, engineLines,
    evaluateMove, setGameState,
  );

  // ── Engine init (only after auth) ──
  useEffect(() => {
    if (!authed) return;
    const engine = getEngine();
    engine.init().then(() => setEngineReady(true));
  }, [authed]);

  // ── Load decisions and category prefs from localStorage ──
  useEffect(() => {
    setDecisions(loadDecisions());
    setCategoryPrefs(loadCategoryPrefs());
  }, []);

  // ── Position loading ──
  const loadPosition = useCallback(() => {
    const currentDecisions = loadDecisions();
    setDecisions(currentDecisions);

    setGameState("loading");
    resetEvaluation();
    setTimerKey((k) => k + 1);

    const currentPrefs = loadCategoryPrefs();
    setCategoryPrefs(currentPrefs);
    const data = pickWeightedUnsorted(currentDecisions, currentPrefs);

    if (!data) {
      setAllDone(true);
      setGameState("loading");
      return;
    }

    setAllDone(false);
    setPosition(data);
    board.initBoard(data);

    setGameState("playing");
    setTimerRunning(true);
  }, [resetEvaluation, board.initBoard]);

  useEffect(() => {
    if (engineReady) loadPosition();
  }, [engineReady, loadPosition]);

  // ── Sort actions ──
  const handleKeep = useCallback(() => {
    if (!position) return;
    const next = { ...loadDecisions(), [position.id]: "keep" as const };
    saveDecisions(next);
    setDecisions(next);
    loadPosition();
  }, [position, loadPosition]);

  const handleDelete = useCallback(() => {
    if (!position) return;
    const next = { ...loadDecisions(), [position.id]: "delete" as const };
    saveDecisions(next);
    setDecisions(next);
    loadPosition();
  }, [position, loadPosition]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(loadDecisions(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sort-decisions.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClear = useCallback(() => {
    if (!confirm("Clear all sort decisions? This cannot be undone.")) return;
    localStorage.removeItem(SORT_STORAGE_KEY);
    setDecisions({});
    loadPosition();
  }, [loadPosition]);

  const moveCatUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setCategoryPrefs((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      saveCategoryPrefs(next);
      return next;
    });
  }, []);

  const moveCatDown = useCallback((idx: number) => {
    setCategoryPrefs((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      saveCategoryPrefs(next);
      return next;
    });
  }, []);

  const toggleCat = useCallback((idx: number) => {
    setCategoryPrefs((prev) => {
      const next = prev.map((p, i) => (i === idx ? { ...p, enabled: !p.enabled } : p));
      saveCategoryPrefs(next);
      return next;
    });
  }, []);

  const puzzleMoveNumber = position?.moveNumber ?? 1;

  // ── Auth gate render ──
  if (!SORT_SECRET) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted text-sm">Sort mode is not available in this build.</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (authInput === SORT_SECRET) {
              setAuthed(true);
              setAuthError(false);
            } else {
              setAuthError(true);
            }
          }}
          className="flex flex-col items-center gap-3"
        >
          <label className="text-sm text-text-secondary">Enter sort password</label>
          <input
            type="password"
            value={authInput}
            onChange={(e) => setAuthInput(e.target.value)}
            className="px-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
            autoFocus
          />
          {authError && <span className="text-xs text-red-400">Wrong password</span>}
          <button
            type="submit"
            className="px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
          >
            unlock
          </button>
        </form>
      </div>
    );
  }

  // ── All sorted render ──
  if (allDone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-xl font-bold font-[family-name:var(--font-heading)] text-accent">All positions sorted!</div>
        <div className="text-sm text-text-muted">
          {totalPositions} total &middot; {keptCount} kept &middot; {deletedCount} deleted
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
          >
            export
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2 text-sm font-bold uppercase tracking-widest border-2 border-red-500/60 text-red-400 hover:bg-red-500/20 rounded-lg transition-all duration-200 cursor-pointer"
          >
            clear all
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row items-center md:items-start justify-start md:justify-center p-4 pt-2 md:pt-4 gap-4">
      {/* ── Mobile Info Bar ── */}
      <div className="flex md:hidden items-center justify-between w-full max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block w-3 h-3 rounded-full border ${
              position?.sideToMove === "w"
                ? "bg-white border-gray-400"
                : "bg-gray-800 border-gray-500"
            }`}
          />
          <span className="text-text-secondary">
            {position?.sideToMove === "w" ? "White" : "Black"} to move
          </span>
        </div>
        <Timer key={timerKey} isRunning={timerRunning} />
      </div>

      {/* ── Left Panel (sort-specific) ── */}
      <div
        className="hidden md:flex flex-col gap-3"
        style={{ width: 220, height: boardSize }}
      >
        {/* Sort stats */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
            sort progress
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-muted">total</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">{totalPositions}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-muted">remaining</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">{remaining}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-green-400">kept</span>
            <span className="font-[family-name:var(--font-mono)] text-green-400">{keptCount}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-red-400">deleted</span>
            <span className="font-[family-name:var(--font-mono)] text-red-400">{deletedCount}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-border/30 rounded-full h-1.5 overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-green-400/70 transition-all duration-300"
                style={{ width: `${(keptCount / totalPositions) * 100}%` }}
              />
              <div
                className="bg-red-400/70 transition-all duration-300"
                style={{ width: `${(deletedCount / totalPositions) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Category queue */}
        <div className="border border-border rounded-lg p-3">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">queue</div>
          <div className="space-y-0.5">
            {categoryPrefs.map((pref, idx) => (
              <div
                key={pref.cat}
                className={`flex items-center gap-1.5 rounded px-1 py-0.5 transition-opacity ${
                  pref.enabled ? "opacity-100" : "opacity-40"
                }`}
              >
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-muted/50 w-3 text-right shrink-0">
                  {idx + 1}
                </span>
                <button
                  onClick={() => toggleCat(idx)}
                  title={pref.enabled ? "Disable" : "Enable"}
                  className="w-3 h-3 rounded-full border transition-colors shrink-0 cursor-pointer"
                  style={{
                    borderColor: pref.enabled ? "var(--color-accent)" : "var(--color-border)",
                    backgroundColor: pref.enabled ? "var(--color-accent)" : "transparent",
                  }}
                />
                <span
                  className={`flex-1 text-xs capitalize ${
                    pref.enabled ? "text-text-secondary" : "text-text-muted/40"
                  }`}
                >
                  {pref.cat}
                </span>
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-text-muted/50 w-5 text-right shrink-0">
                  {unsortedCountByCat[pref.cat] ?? 0}
                </span>
                <div className="flex flex-col shrink-0 -space-y-0.5">
                  <button
                    onClick={() => moveCatUp(idx)}
                    disabled={idx === 0}
                    className="text-[8px] text-text-muted/40 hover:text-text-secondary disabled:opacity-20 disabled:cursor-not-allowed leading-none cursor-pointer"
                  >
                    &#x25B2;
                  </button>
                  <button
                    onClick={() => moveCatDown(idx)}
                    disabled={idx === categoryPrefs.length - 1}
                    className="text-[8px] text-text-muted/40 hover:text-text-secondary disabled:opacity-20 disabled:cursor-not-allowed leading-none cursor-pointer"
                  >
                    &#x25BC;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Puzzle info */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {position && (
              <>
                <span>move {position.moveNumber}</span>
                <span className="text-border">&middot;</span>
                <span>{position.phase}</span>
                {position.category && (
                  <>
                    <span className="text-border">&middot;</span>
                    <span>{position.category}</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block w-3 h-3 rounded-full border ${
                position?.sideToMove === "w"
                  ? "bg-white border-gray-400"
                  : "bg-gray-800 border-gray-500"
              }`}
            />
            <span className="text-text-secondary">
              {position?.sideToMove === "w" ? "White" : "Black"} to move
            </span>
          </div>
          {position && (
            <div className="text-[10px] font-[family-name:var(--font-mono)] text-text-muted/50 break-all">
              {position.id}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border border-border rounded-lg p-3 space-y-2">
          <button
            onClick={handleExport}
            className="w-full text-xs text-text-muted hover:text-text-secondary border border-border hover:border-border-hover rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
          >
            export decisions
          </button>
          <button
            onClick={handleClear}
            className="w-full text-xs text-red-400/60 hover:text-red-400 border border-border hover:border-red-500/40 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
          >
            clear all
          </button>
        </div>

        {/* Engine status */}
        {!engineReady && (
          <div className="border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-text-muted animate-pulse">
              loading engine...
            </div>
          </div>
        )}

        {/* Move history */}
        <MoveHistory
          position={position}
          gameState={gameState}
          fen={board.fen}
          moveHistory={board.moveHistory}
          browsePath={board.browsePath}
          browseIdx={board.browseIdx}
          setBrowsePath={board.setBrowsePath}
          setBrowseIdx={board.setBrowseIdx}
        />
      </div>

      {/* ── Board Center ── */}
      <BoardCenter
        displayFen={board.displayFen}
        boardSize={boardSize}
        boardOrientation={board.boardOrientation}
        gameState={gameState}
        evalForBar={evalForBar}
        displayArrows={board.displayArrows}
        displaySquareStyles={board.displaySquareStyles}
        positionId={position?.id}
        onPieceDrop={board.onPieceDrop}
        onSquareMouseDown={board.onSquareMouseDown}
        onSquareClick={board.onSquareClick}
        onSquareMouseUp={board.onSquareMouseUp}
        onArrowsChange={board.onArrowsChange}
        onUndoMove={board.undoMove}
        onResizeStart={handleResizeStart}
        boardContainerRef={boardContainerRef}
      />

      {/* ── Right Panel ── */}
      <RightPanel
        boardSize={boardSize}
        gameState={gameState}
        position={position}
        feedback={feedback}
        engineDepth={engineDepth}
        engineLines={engineLines}
        pendingMove={board.pendingMove}
        puzzleMoveNumber={puzzleMoveNumber}
        onEngineLineMoveClick={board.onEngineLineMoveClick}
        onBestLineClick={board.onBestLineClick}
        onRefutationLineClick={board.onRefutationLineClick}
        onConfirm={board.confirmMove}
        onUndo={board.undoMove}
        scoredActions={
          <div className="flex gap-2 w-full mt-2">
            <button
              onClick={handleKeep}
              className="flex-1 px-4 py-3 text-sm font-bold uppercase tracking-widest border-2 border-green-500/60 text-green-400 hover:bg-green-500/20 rounded-lg transition-all duration-200 cursor-pointer"
            >
              keep
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-3 text-sm font-bold uppercase tracking-widest border-2 border-red-500/60 text-red-400 hover:bg-red-500/20 rounded-lg transition-all duration-200 cursor-pointer"
            >
              delete
            </button>
          </div>
        }
      />
    </div>
  );
}

