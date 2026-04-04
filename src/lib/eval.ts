import { getEngine, type EvalResult, type DepthUpdate } from "./chess-engine";

type DepthCallback = (update: DepthUpdate) => void;

export function evaluateWithFallback(
  fen: string,
  depth: number,
  onDepth?: DepthCallback,
  multiPv: number = 1
): Promise<EvalResult> {
  return getEngine().evaluate(fen, depth, onDepth, multiPv);
}
