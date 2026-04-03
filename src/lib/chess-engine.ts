// Stockfish 18 WASM (lite single-threaded) — client-side engine
// Evaluates positions in a Web Worker, returns eval + bestmove via UCI protocol

export interface EngineLine {
  /** Centipawn eval from side-to-move's perspective */
  eval: number;
  isMate: boolean;
  mateIn: number | null;
  /** Principal variation moves in UCI format */
  pv: string[];
  /** MultiPV index (1-based) */
  multipv: number;
}

export interface EvalResult {
  /** Centipawn eval from the side-to-move's perspective */
  eval: number;
  /** Is this a mate score? */
  isMate: boolean;
  /** Mate in N (positive = side to move mates, negative = gets mated) */
  mateIn: number | null;
  /** Best move in UCI format (e.g. "e2e4") */
  bestMove: string;
  /** Depth reached */
  depth: number;
  /** Principal variation (best line) in UCI moves */
  pv: string[];
  /** All MultiPV lines at final depth */
  lines: EngineLine[];
  /** Where this result came from */
  source: "lichess" | "local";
}

export interface DepthUpdate {
  depth: number;
  eval: number;
  isMate: boolean;
  mateIn: number | null;
  /** Principal variation for this depth */
  pv: string[];
  /** All MultiPV lines at this depth */
  lines: EngineLine[];
}

type DepthCallback = (update: DepthUpdate) => void;

class StockfishEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private pendingResolve: ((value: EvalResult) => void) | null = null;
  private currentEval = 0;
  private currentIsMate = false;
  private currentMateIn: number | null = null;
  private currentBestMove = "";
  private currentDepth = 0;
  private currentPv: string[] = [];
  private currentLines: Map<number, EngineLine> = new Map();
  private currentMultiPv = 1;
  private onDepthUpdate: DepthCallback | null = null;

  async init(): Promise<void> {
    if (this.worker && this.isReady) return;

    return new Promise((resolve, reject) => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        this.worker = new Worker(`${basePath}/stockfish/stockfish-18-lite-single.js`);

        this.worker.onmessage = (event) => {
          const line = event.data;
          this.handleMessage(line);

          if (line === "readyok") {
            this.isReady = true;
            resolve();
          }
        };

        this.worker.onerror = (error) => {
          reject(error);
        };

        this.worker.postMessage("uci");
        this.worker.postMessage("isready");
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(line: string) {
    if (typeof line !== "string") return;

    // Parse UCI info lines
    if (line.startsWith("info") && line.includes(" score ")) {
      const depthMatch = line.match(/\bdepth (\d+)/);
      // Track MultiPV line index (default to 1 for single-PV mode)
      const pvIndexMatch = line.match(/\bmultipv (\d+)/);
      const pvIndex = pvIndexMatch ? parseInt(pvIndexMatch[1], 10) : 1;
      // Skip seldepth-only or non-score lines
      if (!depthMatch) return;

      const depth = parseInt(depthMatch[1], 10);

      // Parse PV moves
      const pvMatch = line.match(/ pv (.+)$/);
      const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

      let lineEval = 0;
      let lineIsMate = false;
      let lineMateIn: number | null = null;

      if (line.includes("score cp ")) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        if (cpMatch) {
          lineEval = parseInt(cpMatch[1], 10);
        }
      } else if (line.includes("score mate ")) {
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          lineMateIn = parseInt(mateMatch[1], 10);
          lineIsMate = true;
          lineEval = lineMateIn > 0 ? 100000 : -100000;
        }
      }

      // Store this line in our MultiPV map
      this.currentLines.set(pvIndex, {
        eval: lineEval,
        isMate: lineIsMate,
        mateIn: lineMateIn,
        pv,
        multipv: pvIndex,
      });

      // Update primary line state (PV 1)
      if (pvIndex === 1) {
        this.currentEval = lineEval;
        this.currentIsMate = lineIsMate;
        this.currentMateIn = lineMateIn;
        this.currentDepth = depth;
        this.currentPv = pv;
      }

      // Fire depth callback for live updates (only on primary line updates)
      if (pvIndex === 1 && this.onDepthUpdate) {
        const lines = Array.from(this.currentLines.values()).sort(
          (a, b) => a.multipv - b.multipv
        );
        this.onDepthUpdate({
          depth: this.currentDepth,
          eval: this.currentEval,
          isMate: this.currentIsMate,
          mateIn: this.currentMateIn,
          pv: this.currentPv,
          lines,
        });
      }
    }

    // Parse bestmove (search complete)
    if (line.startsWith("bestmove")) {
      const moveMatch = line.match(/bestmove (\S+)/);
      if (moveMatch && moveMatch[1] !== "(none)") {
        this.currentBestMove = moveMatch[1];
      }

      if (this.pendingResolve) {
        const lines = Array.from(this.currentLines.values()).sort(
          (a, b) => a.multipv - b.multipv
        );
        this.pendingResolve({
          eval: this.currentEval,
          isMate: this.currentIsMate,
          mateIn: this.currentMateIn,
          bestMove: this.currentBestMove,
          depth: this.currentDepth,
          pv: this.currentPv,
          lines,
          source: "local",
        });
        this.pendingResolve = null;
        this.onDepthUpdate = null;
      }
    }
  }

  async evaluate(
    fen: string,
    depth: number = 20,
    onDepth?: DepthCallback,
    multiPv: number = 1
  ): Promise<EvalResult> {
    if (!this.worker || !this.isReady) {
      await this.init();
    }

    // Reset state
    this.currentEval = 0;
    this.currentIsMate = false;
    this.currentMateIn = null;
    this.currentBestMove = "";
    this.currentDepth = 0;
    this.currentPv = [];
    this.currentLines.clear();
    this.currentMultiPv = multiPv;
    this.onDepthUpdate = onDepth ?? null;

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      if (multiPv > 1) {
        this.worker!.postMessage(`setoption name MultiPV value ${multiPv}`);
      } else {
        this.worker!.postMessage("setoption name MultiPV value 1");
      }
      this.worker!.postMessage("position fen " + fen);
      this.worker!.postMessage("go depth " + depth);
    });
  }

  stop() {
    if (this.worker && this.isReady) {
      this.worker.postMessage("stop");
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.postMessage("quit");
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton
let engineInstance: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!engineInstance) {
    engineInstance = new StockfishEngine();
  }
  return engineInstance;
}

export function destroyEngine() {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}

export type { StockfishEngine };
