"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Timer } from "@/components/timer";
import { BoardCenter } from "@/components/play/board-center";
import { RightPanel } from "@/components/play/right-panel";
import { MoveHistory } from "@/components/play/move-history";
import { ScoreReveal } from "@/components/score-reveal";
import { MoveExplanation } from "@/components/move-explanation";
import { loadDepth } from "@/app/settings/page";
import { getEngine } from "@/lib/chess-engine";
import { getRandomPosition, getAllPositions } from "@/lib/positions";
import { useEvaluation } from "@/hooks/use-evaluation";
import { useBoardInteraction } from "@/hooks/use-board-interaction";
import { useBoardSize } from "@/hooks/use-board-size";
import { CPL_THRESHOLDS } from "@/lib/constants";
import type { GameState } from "@/lib/game-state";
import type { Position } from "@/lib/types";

export default function PlayPage() {
  const [position, setPosition] = useState<Position | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  // ── Session stats ──
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [sessionTimes, setSessionTimes] = useState<number[]>([]);
  const startTimeRef = useRef<number>(0);

  // ── Streak tracking ──
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [streakShowBest, setStreakShowBest] = useState(false);
  const streakRef = useRef(0);

  // ── Seen positions ──
  const seenIdsRef = useRef<Set<string>>(new Set());

  const onScored = useCallback((centipawnLoss: number) => {
    // Mark the current position as seen
    setPosition((prev) => {
      if (prev) {
        const next = new Set(seenIdsRef.current);
        next.add(prev.id);
        // Pool exhausted — reset seen set (minus what we just added, so we still track current)
        if (next.size >= getAllPositions().length) {
          seenIdsRef.current = new Set([prev.id]);
          try { localStorage.setItem("seen-positions", JSON.stringify([prev.id])); } catch {}
        } else {
          seenIdsRef.current = next;
          try { localStorage.setItem("seen-positions", JSON.stringify([...next])); } catch {}
        }
      }
      return prev;
    });
    setSessionScores((prev) => {
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
    if (centipawnLoss <= CPL_THRESHOLDS.good) {
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setCurrentStreak(newStreak);
      setBestStreak((prev) => Math.max(prev, newStreak));
      if ([5, 10, 15, 20].includes(newStreak)) {
        setStreakMilestone(newStreak);
      }
    } else {
      streakRef.current = 0;
      setCurrentStreak(0);
    }
  }, []);

  // ── Auto-clear streak milestone banner ──
  useEffect(() => {
    if (streakMilestone === null) return;
    const id = setTimeout(() => setStreakMilestone(null), 7500);
    return () => clearTimeout(id);
  }, [streakMilestone]);

  // ── Hooks ──
  const { boardSize, boardContainerRef, handleResizeStart } = useBoardSize();
  const {
    engineDepth, engineLines, evalForBar, feedback, lastPlayedUci,
    evaluateMove, resetEvaluation,
  } = useEvaluation(position, setGameState, setTimerRunning, onScored);
  const board = useBoardInteraction(
    position, gameState, feedback, lastPlayedUci, engineLines,
    evaluateMove, setGameState,
  );

  // ── Engine init ──
  useEffect(() => {
    const engine = getEngine();
    engine.init().then(() => setEngineReady(true));
  }, []);

  // ── Load session from localStorage ──
  useEffect(() => {
    try {
      const storedSeen = localStorage.getItem("seen-positions");
      if (storedSeen) {
        seenIdsRef.current = new Set(JSON.parse(storedSeen));
      }
    } catch {}
    try {
      const stored = localStorage.getItem("session-scores");
      if (stored) {
        const scores: number[] = JSON.parse(stored);
        setSessionScores(scores);
        // Restore current streak (count back from end while CPL ≤ good)
        let cur = 0;
        for (let i = scores.length - 1; i >= 0; i--) {
          if (scores[i] <= CPL_THRESHOLDS.good) cur++;
          else break;
        }
        streakRef.current = cur;
        setCurrentStreak(cur);
        // Restore best streak
        let best = 0, run = 0;
        for (const s of scores) {
          if (s <= CPL_THRESHOLDS.good) { run++; best = Math.max(best, run); }
          else run = 0;
        }
        setBestStreak(best);
      }
    } catch {}
    try {
      const stored = localStorage.getItem("session-times");
      if (stored) setSessionTimes(JSON.parse(stored));
    } catch {}
  }, []);

  // ── Position loading ──
  const loadPosition = useCallback(() => {
    setGameState("loading");
    resetEvaluation();
    setTimerKey((k) => k + 1);

    const data = getRandomPosition(seenIdsRef.current);
    setPosition(data);
    board.initBoard(data);

    setGameState("playing");
    setTimerRunning(true);
    startTimeRef.current = Date.now();
  }, [resetEvaluation, board.initBoard]);

  useEffect(() => {
    if (engineReady) loadPosition();
  }, [engineReady, loadPosition]);

  // ── Computed values ──
  const puzzleMoveNumber = position?.moveNumber ?? 1;

  const sessionACPL =
    sessionScores.length > 0
      ? Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length)
      : null;

  const avgTime =
    sessionTimes.length > 0
      ? Math.round(sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length)
      : null;

  const avgTimeFormatted =
    avgTime !== null
      ? `${Math.floor(avgTime / 60)}:${(avgTime % 60).toString().padStart(2, "0")}`
      : null;

  return (
    <>
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

      {/* ── Mobile Session Stats (persistent, above board) ── */}
      <div className="flex md:hidden items-center justify-between w-full max-w-[calc(100vw-2rem)] border border-border rounded-lg px-3 py-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-text-muted">puzzles</span>
          <span className="font-[family-name:var(--font-mono)] text-text-secondary">{sessionScores.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-muted">ACPL</span>
          <span className="font-[family-name:var(--font-mono)] text-text-secondary">{sessionACPL ?? 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStreakShowBest((s) => !s)}
            className="text-text-muted cursor-pointer hover:text-accent transition-colors"
          >
            {streakShowBest ? "best" : "streak"}
          </button>
          <span
            className={`font-[family-name:var(--font-mono)] transition-colors ${
              !streakShowBest && streakMilestone !== null ? "text-accent" : "text-text-secondary"
            }`}
          >
            {streakShowBest ? bestStreak : currentStreak}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-muted">avg</span>
          <span className="font-[family-name:var(--font-mono)] text-text-secondary">{avgTimeFormatted ?? "0:00"}</span>
        </div>
      </div>

      {/* ── Left Panel ── */}
      <div
        className="hidden md:flex flex-col gap-3"
        style={{ width: 220, height: boardSize }}
      >
        {/* Puzzle info */}
        <div className="border border-border rounded-lg p-4 space-y-3">
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
            <button
              onClick={() => setStreakShowBest((s) => !s)}
              className="text-xs cursor-pointer transition-colors text-text-muted hover:text-accent"
              title={streakShowBest ? "Switch to current streak" : "Switch to best streak"}
            >
              {streakShowBest ? "best streak" : "streak"}
            </button>
            <span
              className={`font-[family-name:var(--font-mono)] transition-colors ${
                !streakShowBest && streakMilestone !== null ? "text-accent" : "text-text-secondary"
              }`}
            >
              {streakShowBest ? bestStreak : currentStreak}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <Timer key={timerKey} isRunning={timerRunning} avgTime={avgTimeFormatted} />
          </div>
          {sessionScores.length > 0 && (
            <button
              onClick={() => {
                setSessionScores([]);
                setSessionTimes([]);
                setCurrentStreak(0);
                setBestStreak(0);
                streakRef.current = 0;
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
        onPieceDrag={board.onPieceDrag}
        onSquareMouseDown={board.onSquareMouseDown}
        onSquareClick={board.onSquareClick}
        onSquareMouseUp={board.onSquareMouseUp}
        onArrowsChange={board.onArrowsChange}
        onUndoMove={board.undoMove}
        onResizeStart={handleResizeStart}
        boardContainerRef={boardContainerRef}
      />

      {/* ── Mobile Feedback (below board, mobile only) ── */}
      <div className="flex md:hidden flex-col gap-3 w-full max-w-[calc(100vw-2rem)]">
        {gameState === "playing" && (
          <div className="border border-border rounded-lg p-4 text-center space-y-2">
            <div className="text-sm font-medium text-text-secondary">Your turn</div>
            <div className="text-xs text-text-muted">
              Find the best move for {position?.sideToMove === "w" ? "white" : "black"}.
            </div>
          </div>
        )}

        {gameState === "confirming" && board.pendingMove && (
          <div className="border border-border rounded-lg p-4 flex flex-col items-center gap-3">
            <div className="text-lg font-bold font-[family-name:var(--font-mono)] text-text-primary">
              {puzzleMoveNumber}. {board.pendingMove.san}
            </div>
            <button
              onClick={board.confirmMove}
              className="w-full px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
            >
              confirm
            </button>
            <button
              onClick={board.undoMove}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            >
              undo
            </button>
          </div>
        )}

        {gameState === "evaluating" && (
          <div className="border border-border rounded-lg p-4 text-center space-y-3">
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
          <>
            <div className="border border-border rounded-lg p-4 flex flex-col items-center gap-3">
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
              <button
                onClick={loadPosition}
                className="w-full mt-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
              >
                next
              </button>
            </div>
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
              onBestLineClick={board.onBestLineClick}
              onRefutationLineClick={board.onRefutationLineClick}
            />
          </>
        )}

        {gameState === "loading" && (
          <div className="border border-border rounded-lg p-4 text-center">
            <div className="text-sm text-text-muted animate-pulse">loading...</div>
          </div>
        )}
      </div>

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
          <button
            onClick={loadPosition}
            className="w-full mt-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200 cursor-pointer"
          >
            next
          </button>
        }
      />
    </div>
    </>
  );
}
