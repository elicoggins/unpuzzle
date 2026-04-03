"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { EvalBar } from "@/components/eval-bar";
import { EngineLines } from "@/components/engine-lines";
import { Timer } from "@/components/timer";
import { ScoreReveal } from "@/components/score-reveal";
import { getEngine, type EvalResult, type DepthUpdate, type EngineLine } from "@/lib/chess-engine";
import { getScoreArrowColor } from "@/lib/scoring";
import type { Position, EvalFeedback } from "@/lib/types";
import type { PieceDropHandlerArgs, Arrow } from "react-chessboard";

type GameState = "loading" | "playing" | "evaluating" | "scored";

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
  const [boardSize, setBoardSize] = useState(400);
  const [engineDepth, setEngineDepth] = useState<DepthUpdate | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [evalForBar, setEvalForBar] = useState<{ eval: number; isMate: boolean; mateIn: number | null }>({ eval: 0, isMate: false, mateIn: null });
  const [engineLines, setEngineLines] = useState<EngineLine[]>([]);
  const [lastPlayedUci, setLastPlayedUci] = useState<string | null>(null);
  const gameRef = useRef<Chess>(new Chess());
  const startTimeRef = useRef<number>(0);
  const resizingRef = useRef(false);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Initialize engine on mount
  useEffect(() => {
    const engine = getEngine();
    engine.init().then(() => setEngineReady(true));
  }, []);

  const loadPosition = useCallback(async () => {
    setGameState("loading");
    setFeedback(null);
    setMoveHistory([]);
    setEngineDepth(null);
    setEngineLines([]);
    setLastPlayedUci(null);
    setTimerKey((k) => k + 1);

    try {
      const res = await fetch("/api/positions/next");
      const data: Position = await res.json();

      setPosition(data);

      const game = new Chess(data.fen);
      gameRef.current = game;

      setFen(data.fen);
      setBoardOrientation(data.sideToMove === "w" ? "white" : "black");
      setGameState("playing");
      setTimerRunning(true);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error("Failed to load position:", err);
    }
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
        const newSize = Math.max(280, Math.min(600, startSize + delta));
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

      const engine = getEngine();
      const originalFen = position.fen;
      const sideToMove = position.sideToMove;

      // 1. Evaluate the original position with MultiPV for engine lines display
      const evalBefore: EvalResult = await engine.evaluate(originalFen, 16, (update) => {
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
      const evalAfter: EvalResult = await engine.evaluate(afterFen, 16, (update) => {
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
        const evalAfterBest = await engine.evaluate(bestFen, 16);
        // Negate because perspective flips after a move
        evalAfterBestCp = -evalAfterBest.eval;
      }

      // 6. Compute centipawn loss
      const evalAfterFromOrigPerspective = -evalAfter.eval;
      const centipawnLoss = Math.max(0, evalBefore.eval - evalAfterFromOrigPerspective);

      // Update eval bar to reflect post-move position
      const postMoveWhiteEval = sideToMove === "w" ? evalAfterFromOrigPerspective : -evalAfterFromOrigPerspective;
      setEvalForBar({ eval: postMoveWhiteEval, isMate: evalAfter.isMate, mateIn: evalAfter.mateIn != null ? -evalAfter.mateIn : null });

      const result: EvalFeedback = {
        centipawnLoss,
        evalBefore: evalBefore.eval,
        evalAfterPlayed: evalAfterFromOrigPerspective,
        evalAfterBest: evalAfterBestCp,
        bestMoveUci: evalBefore.bestMove,
        bestMoveSan,
        isMateBefore: evalBefore.isMate,
        mateInBefore: evalBefore.mateIn,
      };

      setFeedback(result);
      setSessionScores((prev) => [...prev, centipawnLoss]);
      setGameState("scored");
      setEngineDepth(null);
    },
    [position]
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (gameState !== "playing") return false;

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

        const uciMove =
          sourceSquare + (targetSquare || "") + (moveResult.promotion || "");
        evaluateMove(uciMove, moveResult.san);

        return true;
      } catch {
        return false;
      }
    },
    [gameState, evaluateMove]
  );

  const sessionACPL =
    sessionScores.length > 0
      ? Math.round(
          (sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length) * 10
        ) / 10
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
        color: "rgba(74, 222, 128, 0.75)",
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
    if (gameState !== "scored" || !feedback || !lastPlayedUci || lastPlayedUci.length < 4) return {};
    const targetSquare = lastPlayedUci.slice(2, 4);
    return {
      [targetSquare]: {
        boxShadow: `inset 0 0 0 3px ${getScoreArrowColor(feedback.centipawnLoss)}`,
        borderRadius: "50%",
      },
    };
  }, [gameState, feedback, lastPlayedUci]);

  return (
    <div className="flex-1 flex items-center justify-center p-4 gap-4">
      {/* ── Left Panel ── */}
      <div
        className="flex flex-col gap-3 self-stretch justify-center"
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
          {sessionACPL !== null && (
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-text-muted">ACPL</span>
              <span className="font-[family-name:var(--font-mono)] text-text-secondary">
                {sessionACPL}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <Timer key={timerKey} isRunning={timerRunning} />
          </div>
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
        />
        <div
          className="relative flex-shrink-0"
          ref={boardContainerRef}
          style={{ width: boardSize, height: boardSize }}
        >
          <ChessBoard
            position={fen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            allowDragging={gameState === "playing"}
            arrows={boardArrows}
            squareStyles={squareStyles}
          />

          {/* Loading overlay */}
          {gameState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 rounded-lg">
              <div className="text-text-muted animate-pulse">loading...</div>
            </div>
          )}

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 group"
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
        className="flex flex-col gap-3 self-stretch justify-center"
        style={{ width: 240 }}
      >
        {/* Move history */}
        <div className="border border-border rounded-lg flex flex-col overflow-hidden flex-1 max-h-[50%]">
          <div className="px-4 py-2 border-b border-border bg-bg-secondary">
            <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
              moves
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {position && (
              <div className="text-xs font-[family-name:var(--font-mono)] text-text-muted italic px-2 py-1">
                position at move {puzzleMoveNumber}
              </div>
            )}
            {moveHistory.length > 0 && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-2 py-1">
                <span className="text-xs font-[family-name:var(--font-mono)] text-text-muted">
                  {puzzleMoveNumber}.
                </span>
                <span className="text-sm font-[family-name:var(--font-mono)] text-text-primary bg-accent/15 rounded px-1.5 py-0.5 -my-0.5">
                  {moveHistory[0]}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Engine lines */}
        {(gameState === "evaluating" || gameState === "scored") && engineLines.length > 0 && position && (
          <EngineLines
            fen={position.fen}
            lines={engineLines}
            depth={engineDepth?.depth ?? feedback?.evalBefore ? 16 : 0}
            isSearching={gameState === "evaluating"}
          />
        )}

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
                      style={{ width: `${Math.min(100, (engineDepth.depth / 16) * 100)}%` }}
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
                show={true}
              />
              <button
                onClick={loadPosition}
                className="w-full mt-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200"
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
