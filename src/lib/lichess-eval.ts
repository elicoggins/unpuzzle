import type { EvalResult, EngineLine } from "./chess-engine";

const LICHESS_EVAL_URL = "https://lichess.org/api/cloud-eval";

interface LichessPv {
  moves?: string;
  cp?: number;
  mate?: number;
}

interface LichessCloudEvalResponse {
  fen: string;
  knodes: number;
  depth: number;
  pvs: LichessPv[];
}

/**
 * Fetches a position evaluation from the Lichess cloud eval API.
 * Evals are returned from the side-to-move's perspective (matching local engine convention).
 * Returns null on any failure (404, rate limit, network error, etc.).
 */
export async function fetchLichessEval(
  fen: string,
  multiPv: number = 1
): Promise<EvalResult | null> {
  // Parse side to move from FEN (second space-separated field)
  const sideToMove = (fen.split(" ")[1] ?? "w") as "w" | "b";

  try {
    const params = new URLSearchParams({ fen, multiPv: String(multiPv) });
    const res = await fetch(`${LICHESS_EVAL_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data: LichessCloudEvalResponse = await res.json();
    if (!data.pvs || data.pvs.length === 0) return null;

    const lines: EngineLine[] = data.pvs.map((pv, i) => {
      const uciMoves = pv.moves ? pv.moves.trim().split(/\s+/) : [];
      let lineEval = 0;
      let lineIsMate = false;
      let lineMateIn: number | null = null;

      if (pv.mate != null) {
        lineIsMate = true;
        // Lichess: positive mate = white mates; convert to side-to-move perspective
        lineMateIn = sideToMove === "w" ? pv.mate : -pv.mate;
        lineEval = lineMateIn > 0 ? 100000 : -100000;
      } else if (pv.cp != null) {
        // Lichess: cp is white's perspective; convert to side-to-move
        lineEval = sideToMove === "w" ? pv.cp : -pv.cp;
      }

      return {
        eval: lineEval,
        isMate: lineIsMate,
        mateIn: lineMateIn,
        pv: uciMoves,
        multipv: i + 1,
      } satisfies EngineLine;
    });

    const best = lines[0];
    const bestMove = best.pv[0] ?? "";

    return {
      eval: best.eval,
      isMate: best.isMate,
      mateIn: best.mateIn,
      bestMove,
      depth: data.depth ?? 0,
      pv: best.pv,
      lines,
      source: "lichess",
    };
  } catch {
    return null;
  }
}
