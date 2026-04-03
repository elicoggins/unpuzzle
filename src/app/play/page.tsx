"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { EvalBar } from "@/components/eval-bar";
import { EngineLines } from "@/components/engine-lines";
import { Timer } from "@/components/timer";
import { ScoreReveal } from "@/components/score-reveal";
import { getEngine, type EvalResult, type DepthUpdate, type EngineLine } from "@/lib/chess-engine";
import { evaluateWithFallback } from "@/lib/eval";
import { getScoreArrowColor } from "@/lib/scoring";
import { getRandomPosition } from "@/lib/sample-positions";
import { loadDepth } from "@/app/settings/page";
import type { Position, EvalFeedback } from "@/lib/types";
import type { PieceDropHandlerArgs, Arrow, SquareHandlerArgs } from "react-chessboard";

type GameState = "loading" | "playing" | "confirming" | "evaluating" | "scored";

function computeMaxBoardSize(): number {
  if (typeof window === "undefined") return 400;
  const navHeight = 57;
  const padding = 72;
  const maxHeight = window.innerHeight - navHeight - padding;
  // Left panel 220 + right panel 240 + eval bar 28 + gaps (4 * 16)
  const horizontalChrome = 220 + 240 + 28 + 64;
  const maxWidth = window.innerWidth - horizontalChrome;
  return Math.max(280, Math.min(maxHeight, maxWidth));
}

export default function PlayPage() {
  const [position, setPosition] = useState<Position | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [feedback, setFeedback] = useState<EvalFeedback | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [sessionTimes, setSessionTimes] = useState<number[]>([]);
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

  // Initialize engine on mount
  useEffect(() => {
    const engine = getEngine();
    engine.init().then(() => setEngineReady(true));
  }, []);

  // Load session data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("session-scores");
      if (stored) setSessionScores(JSON.parse(stored));
    } catch {}
    try {
      const stored = localStorage.getItem("session-times");
      if (stored) setSessionTimes(JSON.parse(stored));
    } catch {}
  }, []);

  // Set initial board size on mount and recalculate on window resize
  useEffect(() => {
    setBoardSize(computeMaxBoardSize());
    function handleResize() {
      setBoardSize((prev) => {
        const max = computeMaxBoardSize();
        return prev > max ? max : prev;
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadPosition = useCallback(() => {
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

    const data = getRandomPosition();

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

      // 1. Evaluate the original position with MultiPV for engine lines display
      const evalBefore: EvalResult = await evaluateWithFallback(originalFen, loadDepth(), (update) => {
        setEngineDepth(update);
        // Update eval bar with live eval (convert from side-to-move to white's perspective)
        const whiteEval = sideToMove === "w" ? update.eval : -update.eval;
        const whiteMate = sideToMove === "w" ? update.mateIn : (update.mateIn != null ? -update.mateIn : null);
        setEvalForBar({ eval: whiteEval, isMate: update.isMate, mateIn: whiteMate });
        setEngineLines(update.lines);
      }, 3);

      // Store final engine lines from the pre-move evaluation
      setEngineLines(evalBefore.lines);

      // 2. Get the best move in SAN
      const tmpGame = new Chess(originalFen);
      let bestMoveSan = evalBefore.bestMove || "—";
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4) {
        try {
          const bestMoveResult = tmpGame.move({
            from: evalBefore.bestMove.slice(0, 2),
            to: evalBefore.bestMove.slice(2, 4),
            promotion: evalBefore.bestMove.length > 4 ? evalBefore.bestMove[4] : undefined,
          });
          if (bestMoveResult) bestMoveSan = bestMoveResult.san;
        } catch {
          // fallback to UCI notation
        }
      }

      // 3. Apply the user's move to get the resulting FEN
      const afterGame = new Chess(originalFen);
      afterGame.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.length > 4 ? uciMove[4] : undefined,
      });
      const afterFen = afterGame.fen();

      // 4. Evaluate the position after the user's move (single PV, no live updates needed)
      setEngineDepth(null);
      const evalAfter: EvalResult = await evaluateWithFallback(afterFen, loadDepth(), (update) => {
        setEngineDepth(update);
      });

      // 5. Also evaluate position after the best move (if different from user's move)
      let evalAfterBestCp = evalBefore.eval; // default: same as position eval
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4 && evalBefore.bestMove !== uciMove) {
        const bestGame = new Chess(originalFen);
        bestGame.move({
          from: evalBefore.bestMove.slice(0, 2),
          to: evalBefore.bestMove.slice(2, 4),
          promotion: evalBefore.bestMove.length > 4 ? evalBefore.bestMove[4] : undefined,
        });
        const bestFen = bestGame.fen();
        const evalAfterBestResult = await evaluateWithFallback(bestFen, loadDepth());
        // Negate because perspective flips after a move
        evalAfterBestCp = -evalAfterBestResult.eval;
      }

      // 6. Compute centipawn loss
      const evalAfterFromOrigPerspective = -evalAfter.eval;
      const centipawnLoss = Math.max(0, evalBefore.eval - evalAfterFromOrigPerspective);

      // Update eval bar to reflect post-move position
      const postMoveWhiteEval = sideToMove === "w" ? evalAfterFromOrigPerspective : -evalAfterFromOrigPerspective;
      setEvalForBar({ eval: postMoveWhiteEval, isMate: evalAfter.isMate, mateIn: evalAfter.mateIn != null ? -evalAfter.mateIn : null });

      // Convert to white's perspective for display (+ = white winning, − = black winning)
      const toWhite = (cp: number) => sideToMove === "w" ? cp : -cp;
      const mateInBeforeWhite = evalBefore.mateIn != null && sideToMove === "b" ? -evalBefore.mateIn : evalBefore.mateIn;
      // evalAfter STM is opponent of user. mateIn from opponent's STM perspective → white's perspective:
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
        isMateAfterPlayed: evalAfter.isMate,
        mateInAfterPlayed: mateInAfterWhite,
      };

      setFeedback(result);
      setSessionScores((prev) => {
        // Cap at 300cp for ACPL purposes — mate scores (~100000) would otherwise destroy the average
        const next = [...prev, Math.min(centipawnLoss, 300)];
        try { localStorage.setItem("session-scores", JSON.stringify(next)); } catch {}
        return next;
      });
      setSessionTimes((prev) => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        const next = [...prev, elapsed];
        try { localStorage.setItem("session-times", JSON.stringify(next)); } catch {}
        return next;
      });
      setGameState("scored");
      setEngineDepth(null);
    },
    [position]
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (gameState !== "playing") return false;

      // Dropped on same square — deselect if it was already selected before this drag
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

  const sessionACPL =
    sessionScores.length > 0
      ? Math.round(
          sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
        )
      : null;

  const avgTime =
    sessionTimes.length > 0
      ? Math.round(sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length)
      : null;

  const puzzleMoveNumber = position?.moveNumber ?? 1;

  // Compute board arrows for scored state
  const boardArrows = useMemo<Arrow[]>(() => {
    if (gameState !== "scored" || !feedback || !lastPlayedUci) return [];
    const arrows: Arrow[] = [];

    // Best move arrow (green) — show if different from played
    if (feedback.bestMoveUci && feedback.bestMoveUci.length >= 4 && feedback.bestMoveUci !== lastPlayedUci) {
      arrows.push({
        startSquare: feedback.bestMoveUci.slice(0, 2),
        endSquare: feedback.bestMoveUci.slice(2, 4),
        color: "rgba(57, 255, 20, 0.75)",
      });
    }

    // Player's move arrow (color-coded by quality)
    if (lastPlayedUci.length >= 4) {
      arrows.push({
        startSquare: lastPlayedUci.slice(0, 2),
        endSquare: lastPlayedUci.slice(2, 4),
        color: getScoreArrowColor(feedback.centipawnLoss),
      });
    }

    return arrows;
  }, [gameState, feedback, lastPlayedUci]);

  // Compute square highlight for the destination of the player's move
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Legal move dots (empty squares) and capture rings (occupied squares)
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

    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
      };
    }

    // Scored state: highlight played move destination
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
    ({ piece, square }: SquareHandlerArgs) => {
      if (gameState !== "playing") {
        setLegalMoveSquares([]);
        setSelectedSquare(null);
        selectedSquareRef.current = null;
        wasAlreadySelectedRef.current = false;
        return;
      }
      // If a piece is already selected and this square is a legal destination:
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        if (piece) {
          // Capture square: dnd-kit's drag (dragActivationDistance=0) will eat the
          // subsequent click event, so execute the capture here on mousedown.
          const from = selectedSquareRef.current;
          const game = gameRef.current;
          try {
            const moveResult = game.move({ from, to: square, promotion: "q" });
            if (moveResult) {
              setFen(game.fen());
              setMoveHistory((prev) => [...prev, moveResult.san]);
              setLegalMoveSquares([]);
              setSelectedSquare(null);
              selectedSquareRef.current = null; // cleared sync so onSquareClick won't double-fire
              const uciMove = from + square + (moveResult.promotion || "");
              setPendingMove({ uci: uciMove, san: moveResult.san });
              setGameState("confirming");
            }
          } catch {
            // not a legal move — fall through
          }
          return;
        }
        // Empty destination square: let onSquareClick handle it
        wasAlreadySelectedRef.current = false;
        return;
      }
      // Track if this piece was already selected before this mousedown
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

      // If a piece is already selected and this square is a legal destination, move there
      if (selectedSquareRef.current && legalMoveSquares.includes(square)) {
        const from = selectedSquareRef.current;
        try {
          const moveResult = game.move({ from, to: square, promotion: "q" });
          if (moveResult) {
            setFen(game.fen());
            setMoveHistory((prev) => [...prev, moveResult.san]);
            setLegalMoveSquares([]);
            setSelectedSquare(null);
            selectedSquareRef.current = null;
            const uciMove = from + square + (moveResult.promotion || "");
            setPendingMove({ uci: uciMove, san: moveResult.san });
            setGameState("confirming");
          }
        } catch {
          // not a legal move, fall through to selection logic
        }
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

  return (
    <div className="flex-1 flex items-start justify-center p-4 pt-4 gap-4">
      {/* ── Left Panel ── */}
      <div
        className="flex flex-col gap-3"
        style={{ width: 220 }}
      >
        {/* Puzzle info */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          {position?.opening && (
            <div className="text-sm font-medium text-text-primary">
              {position.opening}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {position && (
              <>
                <span>move {position.moveNumber}</span>
                <span className="text-border">·</span>
                <span>{position.phase}</span>
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
        </div>

        {/* Session stats */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
            session
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-muted">puzzles</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {sessionScores.length}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-muted">ACPL</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {sessionACPL ?? 0}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-muted">avg time</span>
            <span className="font-[family-name:var(--font-mono)] text-text-secondary">
              {avgTime !== null
                ? `${Math.floor(avgTime / 60)}:${(avgTime % 60).toString().padStart(2, "0")}`
                : "0:00"}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <Timer key={timerKey} isRunning={timerRunning} />
          </div>
          {sessionScores.length > 0 && (
            <button
              onClick={() => {
                setSessionScores([]);
                setSessionTimes([]);
                try { localStorage.removeItem("session-scores"); } catch {}
                try { localStorage.removeItem("session-times"); } catch {}
              }}
              className="w-full text-xs text-text-muted hover:text-text-secondary border border-border hover:border-border-hover rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              reset session
            </button>
          )}
        </div>

        {/* Engine status */}
        {!engineReady && (
          <div className="border border-border rounded-lg p-3 text-center">
            <div className="text-xs text-text-muted animate-pulse">
              loading engine...
            </div>
          </div>
        )}
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

          {/* Loading overlay */}
          {gameState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 rounded-lg">
              <div className="text-text-muted animate-pulse">loading...</div>
            </div>
          )}

          {/* Click-to-undo overlay during confirming */}
          {gameState === "confirming" && (
            <div
              className="absolute inset-0 z-[5] cursor-default"
              onMouseDown={undoMove}
            />
          )}

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-10 group"
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
        className="flex flex-col gap-3"
        style={{ width: 280 }}
      >
        {/* Move history */}
        <div className="border border-border rounded-lg flex flex-col overflow-hidden" style={{ height: 200 }}>
          <div className="px-4 py-2 border-b border-border bg-bg-secondary">
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

        {/* Engine lines (always visible) */}
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

        {/* Feedback panel */}
        <div className="border border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[180px]">
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
                evalBefore={feedback.evalBefore}
                evalAfterPlayed={feedback.evalAfterPlayed}
                isMateBefore={feedback.isMateBefore}
                mateInBefore={feedback.mateInBefore}
                isMateAfterPlayed={feedback.isMateAfterPlayed}
                mateInAfterPlayed={feedback.mateInAfterPlayed}
                sideToMove={position?.sideToMove ?? "w"}
                show={true}
              />
              <button
                onClick={loadPosition}
                className="w-full mt-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
              >
                next
              </button>
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
