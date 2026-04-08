"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { EvalBar } from "@/components/eval-bar";
import { EngineLines } from "@/components/engine-lines";
import { Timer } from "@/components/timer";
import { ScoreReveal } from "@/components/score-reveal";
import { MoveExplanation } from "@/components/move-explanation";
import { getEngine, type EvalResult, type DepthUpdate, type EngineLine } from "@/lib/chess-engine";
import { evaluateWithFallback } from "@/lib/eval";
import { getScoreArrowColor } from "@/lib/scoring";
import { getAllPositions, type CuratedPosition } from "@/lib/positions";
import { playMoveSound, playCaptureSound, playGoodSound, playBadSound } from "@/lib/sounds";
import { loadDepth } from "@/app/settings/page";
import type { Position, EvalFeedback, PositionCategory } from "@/lib/types";
import type { PieceDropHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";

type GameState = "loading" | "playing" | "confirming" | "evaluating" | "scored";

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
  prefs: CategoryPref[]
): CuratedPosition | null {
  const enabledCats = new Set(prefs.filter((p) => p.enabled).map((p) => p.cat));
  const candidates = getAllPositions().filter(
    (p) => !(p.id in decisions) && enabledCats.has(p.category as PositionCategory)
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

/** Convert a UCI PV to SAN moves, starting from a given FEN. */
function uciPvToSan(fen: string, uciMoves: string[]): string[] {
  const sans: string[] = [];
  try {
    const g = new Chess(fen);
    for (const uci of uciMoves) {
      if (uci.length < 4) break;
      const m = g.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!m) break;
      sans.push(m.san);
    }
  } catch { /* partial conversion is fine */ }
  return sans;
}

function computeMaxBoardSize(): number {
  if (typeof window === "undefined") return 400;
  const navHeight = 57;
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    const maxWidth = window.innerWidth - 64;
    const maxHeight = window.innerHeight - navHeight - 260;
    return Math.max(200, Math.min(maxHeight, maxWidth));
  }
  const padding = 72;
  const maxHeight = window.innerHeight - navHeight - padding;
  const horizontalChrome = 220 + 260 + 28 + 64;
  const maxWidth = window.innerWidth - horizontalChrome;
  return Math.max(280, Math.min(maxHeight, maxWidth));
}

export default function SortPage() {
  // ── Auth gate ──
  const [authed, setAuthed] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // ── Sort decisions ──
  const [decisions, setDecisions] = useState<Record<string, "keep" | "delete">>({});

  // ── Game state (mirrors PlayPage) ──
  const [position, setPosition] = useState<Position | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [feedback, setFeedback] = useState<EvalFeedback | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardSize, setBoardSize] = useState(400);
  const [engineDepth, setEngineDepth] = useState<DepthUpdate | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [evalForBar, setEvalForBar] = useState<{ eval: number; isMate: boolean; mateIn: number | null }>({ eval: 0, isMate: false, mateIn: null });
  const [engineLines, setEngineLines] = useState<EngineLine[]>([]);
  const [lastPlayedUci, setLastPlayedUci] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ uci: string; san: string } | null>(null);
  const [browsePath, setBrowsePath] = useState<{ san: string; fen: string }[]>([]);
  const [browseIdx, setBrowseIdx] = useState<number | null>(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const selectedSquareRef = useRef<string | null>(null);
  const wasAlreadySelectedRef = useRef(false);
  const gameRef = useRef<Chess>(new Chess());
  const startTimeRef = useRef<number>(0);
  const resizingRef = useRef(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [allDone, setAllDone] = useState(false);

  // ── Category prefs ──
  const [categoryPrefs, setCategoryPrefs] = useState<CategoryPref[]>(() =>
    ALL_SORT_CATEGORIES.map((cat) => ({ cat, enabled: true }))
  );

  // ── Stats (scoped to enabled categories) ──
  const enabledCats = useMemo(
    () => new Set(categoryPrefs.filter((p) => p.enabled).map((p) => p.cat)),
    [categoryPrefs]
  );
  const allPositionsFlat = useMemo(() => getAllPositions(), []);
  const positionsInScope = useMemo(
    () => allPositionsFlat.filter((p) => enabledCats.has(p.category as PositionCategory)),
    [allPositionsFlat, enabledCats]
  );
  const totalPositions = positionsInScope.length;
  const keptCount = useMemo(
    () => positionsInScope.filter((p) => decisions[p.id] === "keep").length,
    [positionsInScope, decisions]
  );
  const deletedCount = useMemo(
    () => positionsInScope.filter((p) => decisions[p.id] === "delete").length,
    [positionsInScope, decisions]
  );
  const remaining = totalPositions - keptCount - deletedCount;
  const unsortedCountByCat = useMemo(() => {
    const counts = {} as Record<PositionCategory, number>;
    for (const cat of ALL_SORT_CATEGORIES) {
      counts[cat] = allPositionsFlat.filter((p) => p.category === cat && !(p.id in decisions)).length;
    }
    return counts;
  }, [allPositionsFlat, decisions]);

  // ── Auth check ──
  useEffect(() => {
    if (!SORT_SECRET) return; // no secret configured — stays locked
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    if (!authed) return;
    const engine = getEngine();
    engine.init().then(() => setEngineReady(true));
  }, [authed]);

  // Load decisions and category prefs from localStorage on mount
  useEffect(() => {
    setDecisions(loadDecisions());
    setCategoryPrefs(loadCategoryPrefs());
  }, []);

  // Set initial board size on mount and recalculate on window resize
  useEffect(() => {
    setBoardSize(computeMaxBoardSize());
    function handleResize() {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setBoardSize(computeMaxBoardSize());
      } else {
        setBoardSize((prev) => {
          const max = computeMaxBoardSize();
          return prev > max ? max : prev;
        });
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadPosition = useCallback(() => {
    const currentDecisions = loadDecisions();
    setDecisions(currentDecisions);

    setGameState("loading");
    setFeedback(null);
    setMoveHistory([]);
    setEngineDepth(null);
    setEngineLines([]);
    setLastPlayedUci(null);
    setPendingMove(null);
    setBrowsePath([]);
    setBrowseIdx(null);
    setLegalMoveSquares([]);
    setSelectedSquare(null);
    selectedSquareRef.current = null;
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

    const game = new Chess(data.fen);
    gameRef.current = game;

    setFen(data.fen);
    setBoardOrientation(data.sideToMove === "w" ? "white" : "black");
    setGameState("playing");
    setTimerRunning(true);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (engineReady) {
      loadPosition();
    }
  }, [engineReady, loadPosition]);

  // Board resize handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = boardSize;

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const delta = Math.max(dx, dy);
        const newSize = Math.max(280, startSize + delta);
        setBoardSize(newSize);
      };

      const handleMouseUp = () => {
        resizingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [boardSize]
  );

  const evaluateMove = useCallback(
    async (uciMove: string, playedSan: string) => {
      if (!position) return;

      setTimerRunning(false);
      setGameState("evaluating");
      setEngineDepth(null);
      setEngineLines([]);
      setLastPlayedUci(uciMove);

      const originalFen = position.fen;
      const sideToMove = position.sideToMove;

      const evalBefore: EvalResult = await evaluateWithFallback(originalFen, loadDepth(), (update) => {
        setEngineDepth(update);
        const whiteEval = sideToMove === "w" ? update.eval : -update.eval;
        const whiteMate = sideToMove === "w" ? update.mateIn : (update.mateIn != null ? -update.mateIn : null);
        setEvalForBar({ eval: whiteEval, isMate: update.isMate, mateIn: whiteMate });
        setEngineLines(update.lines);
      }, 3);

      setEngineLines(evalBefore.lines);

      const tmpGame = new Chess(originalFen);
      let bestMoveSan = evalBefore.bestMove || "—";
      const bestLineUci = evalBefore.pv.slice(0, 8);
      let bestLine: string[] = [];
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4) {
        try {
          const bestMoveResult = tmpGame.move({
            from: evalBefore.bestMove.slice(0, 2),
            to: evalBefore.bestMove.slice(2, 4),
            promotion: evalBefore.bestMove.length > 4 ? evalBefore.bestMove[4] : undefined,
          });
          if (bestMoveResult) bestMoveSan = bestMoveResult.san;
        } catch {}
        bestLine = uciPvToSan(originalFen, bestLineUci);
      }

      const afterGame = new Chess(originalFen);
      afterGame.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] : undefined,
      });
      const afterFen = afterGame.fen();

      setEngineDepth(null);
      const evalAfter: EvalResult = await evaluateWithFallback(afterFen, loadDepth(), (update) => {
        setEngineDepth(update);
      });

      const refutationLineUci = evalAfter.pv.slice(0, 6);
      const refutationLine = uciPvToSan(afterFen, refutationLineUci);

      const evalAfterFromOrigPerspective = -evalAfter.eval;

      let evalAfterBestCp = evalAfterFromOrigPerspective;
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4 && evalBefore.bestMove !== uciMove) {
        const bestGame = new Chess(originalFen);
        bestGame.move({
          from: evalBefore.bestMove.slice(0, 2),
          to: evalBefore.bestMove.slice(2, 4),
          promotion: evalBefore.bestMove.length > 4 ? evalBefore.bestMove[4] : undefined,
        });
        const bestFen = bestGame.fen();
        const evalAfterBestResult = await evaluateWithFallback(bestFen, loadDepth());
        evalAfterBestCp = -evalAfterBestResult.eval;
      }

      const centipawnLoss = Math.max(0, evalAfterBestCp - evalAfterFromOrigPerspective);

      const postMoveWhiteEval = sideToMove === "w" ? evalAfterFromOrigPerspective : -evalAfterFromOrigPerspective;
      setEvalForBar({ eval: postMoveWhiteEval, isMate: evalAfter.isMate, mateIn: evalAfter.mateIn != null ? -evalAfter.mateIn : null });

      const toWhite = (cp: number) => sideToMove === "w" ? cp : -cp;
      const mateInBeforeWhite = evalBefore.mateIn != null && sideToMove === "b" ? -evalBefore.mateIn : evalBefore.mateIn;
      const mateInAfterWhite = evalAfter.mateIn != null
        ? (sideToMove === "w" ? -evalAfter.mateIn : evalAfter.mateIn)
        : null;

      const result: EvalFeedback = {
        centipawnLoss,
        evalBefore: toWhite(evalBefore.eval),
        evalAfterPlayed: toWhite(evalAfterFromOrigPerspective),
        evalAfterBest: toWhite(evalAfterBestCp),
        bestMoveUci: evalBefore.bestMove,
        bestMoveSan,
        isMateBefore: evalBefore.isMate,
        mateInBefore: mateInBeforeWhite,
        isMateAfterPlayed: evalAfter.isMate && !afterGame.isCheckmate() && evalAfter.mateIn != null && evalAfter.mateIn > 0,
        mateInAfterPlayed: mateInAfterWhite,
        bestLine,
        bestLineUci,
        refutationLine,
        refutationLineUci,
      };

      setFeedback(result);

      const isMateBefore = evalBefore.isMate;
      const youHadMate = isMateBefore && evalBefore.mateIn != null &&
        ((sideToMove === "w" && evalBefore.mateIn > 0) || (sideToMove === "b" && evalBefore.mateIn < 0));
      const youFoundMate = youHadMate && centipawnLoss === 0;
      if (!result.isMateAfterPlayed && (youFoundMate || centipawnLoss <= 50)) {
        playGoodSound();
      } else {
        playBadSound();
      }
      setGameState("scored");
      setEngineDepth(null);
    },
    [position]
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (gameState !== "playing") return false;

      if (sourceSquare === targetSquare || !targetSquare) {
        if (wasAlreadySelectedRef.current) {
          setLegalMoveSquares([]);
          setSelectedSquare(null);
          selectedSquareRef.current = null;
        }
        wasAlreadySelectedRef.current = false;
        return false;
      }

      const game = gameRef.current;

      try {
        const moveResult = game.move({
          from: sourceSquare,
          to: targetSquare || sourceSquare,
          promotion: piece.pieceType?.[1]?.toLowerCase() === "p" ? "q" : undefined,
        });

        if (!moveResult) return false;

        if (moveResult.captured) { playCaptureSound(); } else { playMoveSound(); }

        setFen(game.fen());
        setMoveHistory((prev) => [...prev, moveResult.san]);
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;

        const uciMove =
          sourceSquare + (targetSquare || "") + (moveResult.promotion || "");
        setPendingMove({ uci: uciMove, san: moveResult.san });
        setGameState("confirming");

        return true;
      } catch {
        return false;
      }
    },
    [gameState]
  );

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;
    evaluateMove(pendingMove.uci, pendingMove.san);
    setPendingMove(null);
  }, [pendingMove, evaluateMove]);

  const undoMove = useCallback(() => {
    if (!position) return;
    const game = new Chess(position.fen);
    gameRef.current = game;
    setFen(position.fen);
    setMoveHistory([]);
    setPendingMove(null);
    setBrowsePath([]);
    setBrowseIdx(null);
    setLegalMoveSquares([]);
    setSelectedSquare(null);
    selectedSquareRef.current = null;
    setGameState("playing");
  }, [position]);

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

  const onEngineLineMoveClick = useCallback(
    (lineIdx: number, moveIdx: number) => {
      if (!position || !engineLines[lineIdx] || gameState !== "scored") return;
      const pv = engineLines[lineIdx].pv;
      const path: { san: string; fen: string }[] = [];
      const game = new Chess(position.fen);
      for (let i = 0; i <= moveIdx && i < pv.length; i++) {
        const uci = pv[i];
        if (uci.length < 4) break;
        try {
          const m = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
          if (!m) break;
          path.push({ san: m.san, fen: game.fen() });
        } catch { break; }
      }
      if (path.length > 0) {
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      }
    },
    [position, engineLines, gameState]
  );

  const onBestLineClick = useCallback(
    (moveIdx: number) => {
      if (!position || !feedback || gameState !== "scored") return;
      const uciMoves = feedback.bestLineUci;
      const path: { san: string; fen: string }[] = [];
      const game = new Chess(position.fen);
      for (let i = 0; i <= moveIdx && i < uciMoves.length; i++) {
        const uci = uciMoves[i];
        if (uci.length < 4) break;
        try {
          const m = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
          if (!m) break;
          path.push({ san: m.san, fen: game.fen() });
        } catch { break; }
      }
      if (path.length > 0) {
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      }
    },
    [position, feedback, gameState]
  );

  const onRefutationLineClick = useCallback(
    (moveIdx: number) => {
      if (!position || !feedback || !lastPlayedUci || gameState !== "scored") return;
      const afterGame = new Chess(position.fen);
      const userMove = afterGame.move({
        from: lastPlayedUci.slice(0, 2),
        to: lastPlayedUci.slice(2, 4),
        promotion: lastPlayedUci.length > 4 ? lastPlayedUci[4] : undefined,
      });
      if (!userMove) return;
      const path: { san: string; fen: string }[] = [{ san: userMove.san, fen: afterGame.fen() }];
      const uciMoves = feedback.refutationLineUci;
      for (let i = 0; i <= moveIdx && i < uciMoves.length; i++) {
        const uci = uciMoves[i];
        if (uci.length < 4) break;
        try {
          const m = afterGame.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
          if (!m) break;
          path.push({ san: m.san, fen: afterGame.fen() });
        } catch { break; }
      }
      if (path.length > 0) {
        setBrowsePath(path);
        setBrowseIdx(path.length - 1);
      }
    },
    [position, feedback, lastPlayedUci, gameState]
  );

  const puzzleMoveNumber = position?.moveNumber ?? 1;

  const boardArrows = useMemo<Arrow[]>(() => {
    if (gameState !== "scored" || !feedback || !lastPlayedUci) return [];
    const arrows: Arrow[] = [];
    if (feedback.bestMoveUci && feedback.bestMoveUci.length >= 4 && feedback.bestMoveUci !== lastPlayedUci) {
      arrows.push({
        startSquare: feedback.bestMoveUci.slice(0, 2),
        endSquare: feedback.bestMoveUci.slice(2, 4),
        color: "rgba(57, 255, 20, 0.75)",
      });
    }
    if (lastPlayedUci.length >= 4) {
      arrows.push({
        startSquare: lastPlayedUci.slice(0, 2),
        endSquare: lastPlayedUci.slice(2, 4),
        color: getScoreArrowColor(feedback.centipawnLoss),
      });
    }
    return arrows;
  }, [gameState, feedback, lastPlayedUci]);

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const sq of legalMoveSquares) {
      const hasPiece = !!gameRef.current.get(sq as any);
      styles[sq] = hasPiece
        ? {
            borderRadius: "50%",
            boxShadow: "inset 0 0 0 4px color-mix(in srgb, var(--color-accent) 50%, transparent)",
            cursor: "pointer",
          }
        : {
            background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 40%, transparent) 25%, transparent 25%)",
            borderRadius: "50%",
            cursor: "pointer",
          };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
      };
    }
    if (gameState === "scored" && feedback && lastPlayedUci && lastPlayedUci.length >= 4) {
      const targetSquare = lastPlayedUci.slice(2, 4);
      styles[targetSquare] = {
        boxShadow: `inset 0 0 0 3px ${getScoreArrowColor(feedback.centipawnLoss)}`,
        borderRadius: "50%",
      };
    }
    return styles;
  }, [legalMoveSquares, selectedSquare, gameState, feedback, lastPlayedUci]);

  const displayFen = useMemo(() => {
    if (browseIdx === null) return fen;
    if (browseIdx < 0) return position?.fen ?? fen;
    return browsePath[browseIdx]?.fen ?? fen;
  }, [browseIdx, browsePath, fen, position]);

  const displayArrows = useMemo(() => browseIdx !== null ? [] : boardArrows, [browseIdx, boardArrows]);
  const displaySquareStyles = useMemo(() => browseIdx !== null ? {} : squareStyles, [browseIdx, squareStyles]);

  const onSquareMouseDown = useCallback(
    ({ piece, square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (e.button === 2) {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        return;
      }
      if (gameState !== "playing") {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        wasAlreadySelectedRef.current = false;
        return;
      }
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        if (piece) {
          const from = selectedSquareRef.current;
          const game = gameRef.current;
          try {
            const moveResult = game.move({ from, to: square, promotion: "q" });
            if (moveResult) {
              if (moveResult.captured) { playCaptureSound(); } else { playMoveSound(); }
              setFen(game.fen());
              setMoveHistory((prev) => [...prev, moveResult.san]);
              setLegalMoveSquares([]);
              setSelectedSquare(null);
              selectedSquareRef.current = null;
              const uciMove = from + square + (moveResult.promotion || "");
              setPendingMove({ uci: uciMove, san: moveResult.san });
              setGameState("confirming");
            }
          } catch {}
          return;
        }
        wasAlreadySelectedRef.current = false;
        return;
      }
      wasAlreadySelectedRef.current = selectedSquareRef.current === square;
      const game = gameRef.current;
      const moves = game.moves({ square: square as any, verbose: true });
      if (moves.length > 0 && piece) {
        setLegalMoveSquares(moves.map((m) => m.to));
        setSelectedSquare(square);
        selectedSquareRef.current = square;
      } else {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        wasAlreadySelectedRef.current = false;
      }
    },
    [gameState, legalMoveSquares]
  );

  const onSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (gameState !== "playing") return;
      const game = gameRef.current;
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        const from = selectedSquareRef.current;
        try {
          const moveResult = game.move({ from, to: square, promotion: "q" });
          if (moveResult) {
            if (moveResult.captured) { playCaptureSound(); } else { playMoveSound(); }
            setFen(game.fen());
            setMoveHistory((prev) => [...prev, moveResult.san]);
            setLegalMoveSquares([]);
            setSelectedSquare(null);
            selectedSquareRef.current = null;
            const uciMove = from + square + (moveResult.promotion || "");
            setPendingMove({ uci: uciMove, san: moveResult.san });
            setGameState("confirming");
          }
        } catch {}
        return;
      }
      const moves = game.moves({ square: square as any, verbose: true });
      if (moves.length === 0) {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
      }
    },
    [gameState, legalMoveSquares]
  );

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
          {totalPositions} total · {keptCount} kept · {deletedCount} deleted
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

      {/* ── Left Panel ── */}
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
                    ▲
                  </button>
                  <button
                    onClick={() => moveCatDown(idx)}
                    disabled={idx === categoryPrefs.length - 1}
                    className="text-[8px] text-text-muted/40 hover:text-text-secondary disabled:opacity-20 disabled:cursor-not-allowed leading-none cursor-pointer"
                  >
                    ▼
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
                <span className="text-border">·</span>
                <span>{position.phase}</span>
                {position.category && (
                  <>
                    <span className="text-border">·</span>
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
        <div className="border border-border rounded-lg flex-col overflow-hidden flex flex-1 min-h-0">
          <div className="px-3 py-1.5 border-b border-border bg-bg-secondary">
            <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
              moves
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {position && (
              <div
                className={`text-xs font-[family-name:var(--font-mono)] italic px-2 py-1 transition-colors ${
                  gameState === "scored" || browseIdx !== null
                    ? "text-text-muted cursor-pointer hover:text-text-secondary"
                    : "text-text-muted"
                }`}
                onClick={() => {
                  if (browseIdx === -1) {
                    setBrowseIdx(null);
                  } else if (browseIdx !== null || gameState === "scored") {
                    setBrowsePath([]);
                    setBrowseIdx(-1);
                  }
                }}
              >
                position at move {puzzleMoveNumber}
              </div>
            )}
            {browseIdx === null && moveHistory.length > 0 && (
              <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-0.5 px-2 py-1 items-center">
                <span className="text-xs font-[family-name:var(--font-mono)] text-text-muted">
                  {puzzleMoveNumber}.
                </span>
                {position?.sideToMove === "w" ? (
                  <>
                    <span
                      className={`text-sm font-[family-name:var(--font-mono)] text-text-primary bg-accent/15 rounded px-1.5 py-0.5 transition-colors ${
                        gameState === "scored" ? "cursor-pointer hover:bg-accent/25" : ""
                      }`}
                      onClick={() => {
                        if (gameState !== "scored") return;
                        setBrowsePath([{ san: moveHistory[0], fen }]);
                        setBrowseIdx(0);
                      }}
                    >
                      {moveHistory[0]}
                    </span>
                    <span />
                  </>
                ) : (
                  <>
                    <span />
                    <span
                      className={`text-sm font-[family-name:var(--font-mono)] text-text-primary bg-accent/15 rounded px-1.5 py-0.5 transition-colors ${
                        gameState === "scored" ? "cursor-pointer hover:bg-accent/25" : ""
                      }`}
                      onClick={() => {
                        if (gameState !== "scored") return;
                        setBrowsePath([{ san: moveHistory[0], fen }]);
                        setBrowseIdx(0);
                      }}
                    >
                      {moveHistory[0]}
                    </span>
                  </>
                )}
              </div>
            )}
            {browseIdx !== null && (() => {
              const rows: { moveNum: number; white: number | null; black: number | null }[] = [];
              if (position?.sideToMove === "w") {
                for (let i = 0; i < browsePath.length; i += 2) {
                  rows.push({
                    moveNum: puzzleMoveNumber + Math.floor(i / 2),
                    white: i,
                    black: i + 1 < browsePath.length ? i + 1 : null,
                  });
                }
              } else {
                if (browsePath.length > 0) rows.push({ moveNum: puzzleMoveNumber, white: null, black: 0 });
                for (let i = 1; i < browsePath.length; i += 2) {
                  rows.push({
                    moveNum: puzzleMoveNumber + Math.ceil(i / 2),
                    white: i,
                    black: i + 1 < browsePath.length ? i + 1 : null,
                  });
                }
              }
              return rows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-0.5 px-2 py-1 items-center">
                  <span className="text-xs font-[family-name:var(--font-mono)] text-text-muted">
                    {row.moveNum}.
                  </span>
                  {row.white !== null ? (
                    <span
                      className={`text-sm font-[family-name:var(--font-mono)] rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                        row.white === browseIdx
                          ? "text-text-primary bg-accent/15 hover:bg-accent/25"
                          : "text-text-secondary hover:bg-border/30"
                      }`}
                      onClick={() => {
                        setBrowsePath((prev) => prev.slice(0, row.white! + 1));
                        setBrowseIdx(row.white!);
                      }}
                    >
                      {browsePath[row.white].san}
                    </span>
                  ) : <span />}
                  {row.black !== null ? (
                    <span
                      className={`text-sm font-[family-name:var(--font-mono)] rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                        row.black === browseIdx
                          ? "text-text-primary bg-accent/15 hover:bg-accent/25"
                          : "text-text-secondary hover:bg-border/30"
                      }`}
                      onClick={() => {
                        setBrowsePath((prev) => prev.slice(0, row.black! + 1));
                        setBrowseIdx(row.black!);
                      }}
                    >
                      {browsePath[row.black!].san}
                    </span>
                  ) : <span />}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ── Eval Bar + Board (center) ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <EvalBar
          eval={evalForBar.eval}
          isMate={evalForBar.isMate}
          mateIn={evalForBar.mateIn}
          height={boardSize}
          orientation={boardOrientation}
          revealed={gameState === "scored"}
        />
        <div
          className="relative flex-shrink-0"
          ref={boardContainerRef}
          style={{ width: boardSize, height: boardSize }}
        >
          <ChessBoard
            position={displayFen}
            onPieceDrop={onPieceDrop}
            onSquareMouseDown={onSquareMouseDown}
            onSquareClick={onSquareClick}
            boardOrientation={boardOrientation}
            allowDragging={gameState === "playing"}
            arrows={displayArrows}
            squareStyles={displaySquareStyles}
            boardKey={position?.id}
          />

          {gameState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 rounded-lg">
              <div className="text-text-muted animate-pulse">loading...</div>
            </div>
          )}

          {gameState === "confirming" && (
            <div
              className="absolute inset-0 z-[5] cursor-default"
              onMouseDown={undoMove}
            />
          )}

          <div
            onMouseDown={handleResizeStart}
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-10 group hidden md:block"
            title="Drag to resize"
          >
            <svg
              viewBox="0 0 16 16"
              className="w-full h-full text-text-muted/40 group-hover:text-text-muted transition-colors"
            >
              <path d="M14 14L8 14L14 8Z" fill="currentColor" />
              <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div
        className="flex flex-col gap-3 w-full md:w-[260px]"
        style={{ height: boardSize }}
      >
        {/* Engine lines */}
        <div>
          {(gameState === "evaluating" || gameState === "scored") && engineLines.length > 0 && position ? (
            <EngineLines
              fen={position.fen}
              lines={engineLines}
              depth={engineDepth?.depth ?? feedback?.evalBefore ? 16 : 0}
              isSearching={gameState === "evaluating"}
              onMoveClick={onEngineLineMoveClick}
            />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border bg-bg-secondary flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  engine
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="text-[11px] font-bold font-[family-name:var(--font-mono)] min-w-[44px] text-center rounded px-1 py-0.5 text-text-muted/30">
                      —
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Move explanation */}
        <div className="flex-1 min-h-0">
          {gameState === "scored" && feedback ? (
            <MoveExplanation
              centipawnLoss={feedback.centipawnLoss}
              evalBefore={feedback.evalBefore}
              evalAfterPlayed={feedback.evalAfterPlayed}
              sideToMove={position?.sideToMove ?? "w"}
              bestMoveSan={feedback.bestMoveSan}
              bestLine={feedback.bestLine}
              refutationLine={feedback.refutationLine}
              isMateBefore={feedback.isMateBefore}
              mateInBefore={feedback.mateInBefore}
              isMateAfterPlayed={feedback.isMateAfterPlayed}
              show={true}
              onBestLineClick={onBestLineClick}
              onRefutationLineClick={onRefutationLineClick}
            />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden h-full">
              <div className="px-3 py-1.5 border-b border-border bg-bg-secondary">
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  analysis
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm text-text-muted/50 italic">Make a move to see analysis.</p>
              </div>
            </div>
          )}
        </div>

        {/* Feedback panel — KEEP / DELETE instead of NEXT */}
        <div className="border border-border rounded-lg p-4 flex flex-col items-center justify-center shrink-0" style={{ height: 230 }}>
          {gameState === "playing" && (
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-text-secondary">
                Your turn
              </div>
              <div className="text-xs text-text-muted">
                Find the best move for{" "}
                {position?.sideToMove === "w" ? "white" : "black"}.
              </div>
            </div>
          )}

          {gameState === "confirming" && pendingMove && (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="text-lg font-bold font-[family-name:var(--font-mono)] text-text-primary">
                {puzzleMoveNumber}. {pendingMove.san}
              </div>
              <button
                onClick={confirmMove}
                className="w-full px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
              >
                confirm
              </button>
              <button
                onClick={undoMove}
                className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
              >
                undo
              </button>
            </div>
          )}

          {gameState === "evaluating" && (
            <div className="text-center space-y-3">
              <div className="text-sm text-text-secondary">analyzing...</div>
              {engineDepth && (
                <div className="text-xs font-[family-name:var(--font-mono)] text-text-muted space-y-1">
                  <div>
                    depth {engineDepth.depth}
                    {" · "}
                    {engineDepth.isMate
                      ? `M${Math.abs(engineDepth.mateIn ?? 0)}`
                      : `${engineDepth.eval >= 0 ? "+" : ""}${(engineDepth.eval / 100).toFixed(1)}`}
                  </div>
                  <div className="w-full bg-border/30 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-accent/60 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (engineDepth.depth / loadDepth()) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {gameState === "scored" && feedback && (
            <div className="flex flex-col items-center gap-3 w-full">
              <ScoreReveal
                centipawnLoss={feedback.centipawnLoss}
                bestMoveSan={feedback.bestMoveSan}
                category={position?.category}
                evalAfterBest={feedback.evalAfterBest}
                evalAfterPlayed={feedback.evalAfterPlayed}
                isMateBefore={feedback.isMateBefore}
                mateInBefore={feedback.mateInBefore}
                isMateAfterPlayed={feedback.isMateAfterPlayed}
                sideToMove={position?.sideToMove ?? "w"}
                show={true}
              />
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
            </div>
          )}

          {gameState === "loading" && (
            <div className="text-sm text-text-muted animate-pulse">loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
