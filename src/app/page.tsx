import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* ── Hero ── */}
        <div className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tight">
            un<span className="text-accent">puzzle</span>
          </h1>
          <p className="text-xl text-text-secondary leading-relaxed">
            You play differently when you know it&apos;s a puzzle.
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Link
            href="/play"
            className="px-10 py-4 text-lg font-bold uppercase tracking-widest border-2 border-accent text-accent hover:bg-accent hover:text-bg-primary rounded-lg transition-all duration-200"
          >
            play
          </Link>
          <p className="text-sm text-text-muted">no account needed</p>
        </div>

        {/* ── How It Works ── */}
        <div className="border border-border rounded-lg p-5 text-left space-y-4 mt-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
            how it works
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center space-y-2">
              {/* 4x4 checkerboard */}
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
                <rect x="2" y="2" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
                {/* Row 1: dark on cols 1,3 */}
                <rect x="2"  y="2"  width="7" height="7" fill="currentColor" opacity="0.3" />
                <rect x="16" y="2"  width="7" height="7" fill="currentColor" opacity="0.3" />
                {/* Row 2: dark on cols 2,4 */}
                <rect x="9"  y="9"  width="7" height="7" fill="currentColor" opacity="0.3" />
                <rect x="23" y="9"  width="7" height="7" fill="currentColor" opacity="0.3" />
                {/* Row 3: dark on cols 1,3 */}
                <rect x="2"  y="16" width="7" height="7" fill="currentColor" opacity="0.3" />
                <rect x="16" y="16" width="7" height="7" fill="currentColor" opacity="0.3" />
                {/* Row 4: dark on cols 2,4 */}
                <rect x="9"  y="23" width="7" height="7" fill="currentColor" opacity="0.3" />
                <rect x="23" y="23" width="7" height="7" fill="currentColor" opacity="0.3" />
              </svg>
              <div className="text-sm font-bold text-text-primary">See a position</div>
              <div className="text-xs text-text-secondary">
                There might be a tactic, there might not.
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              {/* Knight piece — standard chess knight silhouette */}
              <svg width="32" height="32" viewBox="0 0 45 45" fill="none" className="text-accent">
                <path
                  d="M 22 10 C 32.5 11 38.5 18 38 39 L 15 39 C 15 30 25 32.5 23 18"
                  stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <path
                  d="M 24 18 C 24.38 20.91 18.45 25.37 16 27 C 13 29 13.18 31.34 11 31 C 9.958 30.06 12.41 27.96 11 28 C 10 28 11.19 29.23 10 30 C 9 30 5.997 31 6 26 C 6 24 12 14 12 14 C 12 14 13.89 12.1 14 10.5 C 13.27 9.506 13.5 8.5 13.5 7.5 C 14.5 6.5 16.5 10 16.5 10 L 18.5 10 C 18.5 10 19.28 8.008 21 7 C 22 7 22 10 22 10"
                  stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15"
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx="12" cy="14" r="1" fill="currentColor" />
              </svg>
              <div className="text-sm font-bold text-text-primary">Make your move</div>
              <div className="text-xs text-text-secondary">
                Study the board. Pick a move. Confirm it.
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              {/* Target / bullseye */}
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                <circle cx="16" cy="16" r="3" fill="currentColor" />
              </svg>
              <div className="text-sm font-bold text-text-primary">Get scored</div>
              <div className="text-xs text-text-secondary">
                Stockfish compares your choice to the best move.
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted pt-2">
            Your ACPL (Average Centipawn Loss) tracks accuracy across a session. Lower is better — under 20 is elite.
          </p>
        </div>
      </div>
    </div>
  );
}
