import { fetchLichessEval } from "./lichess-eval";
import { getEngine, type EvalResult, type DepthUpdate } from "./chess-engine";

type DepthCallback = (update: DepthUpdate) => void;

/**
 * Evaluates a position using the Lichess cloud eval API first.
 * Falls back to the local Stockfish WASM engine if the cloud eval is unavailable.
 *
 * The returned EvalResult.source indicates which was used: "lichess" or "local".
 */
export async function evaluateWithFallback(
  fen: string,
  depth: number,
  onDepth?: DepthCallback,
  multiPv: number = 1
): Promise<EvalResult> {
  const lichessResult = await fetchLichessEval(fen, multiPv);

  if (lichessResult) {
    // Fire the depth callback once with the final result so live UI (eval bar,
    // engine lines) updates the same way it does during a local search.
    if (onDepth) {
      onDepth({
        depth: lichessResult.depth,
        eval: lichessResult.eval,
        isMate: lichessResult.isMate,
        mateIn: lichessResult.mateIn,
        pv: lichessResult.pv,
        lines: lichessResult.lines,
      });
    }
    return lichessResult;
  }

  // Cloud eval unavailable — fall back to local engine
  return getEngine().evaluate(fen, depth, onDepth, multiPv);
}
