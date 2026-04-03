import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-6xl font-bold tracking-tight">
          un<span className="text-accent">puzzle</span>
        </h1>

        <p className="text-xl text-text-secondary leading-relaxed">
          real positions
        </p>


        <div className="flex flex-col items-center gap-4 pt-4">
          <Link
            href="/play"
            className="px-10 py-4 text-lg font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200"
          >
            play
          </Link>
          <p className="text-sm text-text-muted">
            no account needed to start
          </p>
        </div>

        {/* How scoring works */}
        <div className="border border-border rounded-lg p-6 text-left space-y-4 mt-12">
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
            how it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold font-[family-name:var(--font-mono)] text-score-perfect">
                0
              </div>
              <div className="text-sm text-text-secondary">
                You played the engine&apos;s best move. Perfect.
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-[family-name:var(--font-mono)] text-score-good">
                −15
              </div>
              <div className="text-sm text-text-secondary">
                A good alternative. 15 centipawns from the best.
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-[family-name:var(--font-mono)] text-score-blunder">
                −120
              </div>
              <div className="text-sm text-text-secondary">
                A blunder. You gave away over a pawn&apos;s worth.
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted pt-2">
            Your <span className="font-[family-name:var(--font-mono)]">ACPL</span>{" "}
            (Average Centipawn Loss) tracks your overall accuracy. Lower is better.
            Under 10 is elite.
          </p>
        </div>
      </div>
    </div>
  );
}
