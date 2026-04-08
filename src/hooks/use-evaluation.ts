"use client";

import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import { getEngine, type EvalResult, type DepthUpdate, type EngineLine } from "@/lib/chess-engine";
import { uciPvToSan, parseUciMove, hadMateAvailable } from "@/lib/chess-utils";
import { playGoodSound, playBadSound } from "@/lib/sounds";
import { loadDepth } from "@/app/settings/page";
import type { Position, EvalFeedback } from "@/lib/types";
import type { GameState } from "@/lib/game-state";

export interface EvalBarState {
  eval: number;
  isMate: boolean;
  mateIn: number | null;
}

export interface UseEvaluationReturn {
  engineDepth: DepthUpdate | null;
  engineLines: EngineLine[];
  evalForBar: EvalBarState;
  feedback: EvalFeedback | null;
  lastPlayedUci: string | null;
  evaluateMove: (uciMove: string, playedSan: string) => Promise<void>;
  resetEvaluation: () => void;
}

/**
 * Encapsulates the full engine evaluation pipeline:
 *   1. Evaluate original position (with MultiPV)
 *   2. Get best move SAN + best continuation
 *   3. Evaluate post-user-move position
 *   4. Evaluate post-best-move position (for CPL reference)
 *   5. Compute CPL, feedback, and play sound
 */
export function useEvaluation(
  position: Position | null,
  setGameState: (s: GameState) => void,
  setTimerRunning: (r: boolean) => void,
  onScored?: (centipawnLoss: number) => void,
): UseEvaluationReturn {
  const [engineDepth, setEngineDepth] = useState<DepthUpdate | null>(null);
  const [engineLines, setEngineLines] = useState<EngineLine[]>([]);
  const [evalForBar, setEvalForBar] = useState<EvalBarState>({ eval: 0, isMate: false, mateIn: null });
  const [feedback, setFeedback] = useState<EvalFeedback | null>(null);
  const [lastPlayedUci, setLastPlayedUci] = useState<string | null>(null);

  const resetEvaluation = useCallback(() => {
    setEngineDepth(null);
    setEngineLines([]);
    setFeedback(null);
    setLastPlayedUci(null);
  }, []);

  const evaluateMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (uciMove: string, _playedSan: string) => {
      if (!position) return;

      setTimerRunning(false);
      setGameState("evaluating");
      setEngineDepth(null);
      setEngineLines([]);
      setLastPlayedUci(uciMove);

      const originalFen = position.fen;
      const sideToMove = position.sideToMove;

      // 1. Evaluate the original position with MultiPV for engine lines display
      const evalBefore: EvalResult = await getEngine().evaluate(originalFen, loadDepth(), (update) => {
        setEngineDepth(update);
        const whiteEval = sideToMove === "w" ? update.eval : -update.eval;
        const whiteMate = sideToMove === "w" ? update.mateIn : (update.mateIn != null ? -update.mateIn : null);
        setEvalForBar({ eval: whiteEval, isMate: update.isMate, mateIn: whiteMate });
        setEngineLines(update.lines);
      }, 3);

      setEngineLines(evalBefore.lines);

      // 2. Get the best move in SAN and full best continuation
      const tmpGame = new Chess(originalFen);
      let bestMoveSan = evalBefore.bestMove || "—";
      const bestLineUci = evalBefore.pv.slice(0, 8);
      let bestLine: string[] = [];
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4) {
        const parsed = parseUciMove(evalBefore.bestMove);
        if (parsed) {
          try {
            const bestMoveResult = tmpGame.move(parsed);
            if (bestMoveResult) bestMoveSan = bestMoveResult.san;
          } catch { /* fallback to UCI notation */ }
        }
        bestLine = uciPvToSan(originalFen, bestLineUci);
      }

      // 3. Apply the user's move to get the resulting FEN
      const afterGame = new Chess(originalFen);
      const userParsed = parseUciMove(uciMove);
      if (userParsed) afterGame.move(userParsed);
      const afterFen = afterGame.fen();

      // 4. Evaluate the position after the user's move
      setEngineDepth(null);
      const evalAfter: EvalResult = await getEngine().evaluate(afterFen, loadDepth(), (update) => {
        setEngineDepth(update);
      });

      const refutationLineUci = evalAfter.pv.slice(0, 6);
      const refutationLine = uciPvToSan(afterFen, refutationLineUci);

      // 5. Compute post-move eval from original side's perspective
      const evalAfterFromOrigPerspective = -evalAfter.eval;

      // 6. Evaluate position after the best move (for accurate CPL reference)
      let evalAfterBestCp = evalAfterFromOrigPerspective;
      if (evalBefore.bestMove && evalBefore.bestMove.length >= 4 && evalBefore.bestMove !== uciMove) {
        const bestGame = new Chess(originalFen);
        const bestParsed = parseUciMove(evalBefore.bestMove);
        if (bestParsed) bestGame.move(bestParsed);
        const bestFen = bestGame.fen();
        const evalAfterBestResult = await getEngine().evaluate(bestFen, loadDepth());
        evalAfterBestCp = -evalAfterBestResult.eval;
      }

      // 7. CPL = best achievable outcome minus actual outcome
      const centipawnLoss = Math.max(0, evalAfterBestCp - evalAfterFromOrigPerspective);

      // Update eval bar for post-move position
      const postMoveWhiteEval = sideToMove === "w" ? evalAfterFromOrigPerspective : -evalAfterFromOrigPerspective;
      setEvalForBar({ eval: postMoveWhiteEval, isMate: evalAfter.isMate, mateIn: evalAfter.mateIn != null ? -evalAfter.mateIn : null });

      // Convert to white's perspective for display
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

      // Feedback sound
      const youHadMate = hadMateAvailable(evalBefore.isMate, evalBefore.mateIn, sideToMove);
      const youFoundMate = youHadMate && centipawnLoss === 0;
      if (!result.isMateAfterPlayed && (youFoundMate || centipawnLoss <= 50)) {
        playGoodSound();
      } else {
        playBadSound();
      }

      onScored?.(centipawnLoss);

      setGameState("scored");
      setEngineDepth(null);
    },
    [position, setGameState, setTimerRunning, onScored]
  );

  return {
    engineDepth,
    engineLines,
    evalForBar,
    feedback,
    lastPlayedUci,
    evaluateMove,
    resetEvaluation,
  };
}
