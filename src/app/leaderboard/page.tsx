export default function LeaderboardPage() {
  // Placeholder data for the leaderboard skeleton
  const placeholderEntries = [
    { rank: 1, name: "—", acpl: "—", puzzles: "—" },
    { rank: 2, name: "—", acpl: "—", puzzles: "—" },
    { rank: 3, name: "—", acpl: "—", puzzles: "—" },
  ];

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">leaderboard</h1>
          <span className="text-xs text-text-muted border border-border rounded-lg px-3 py-1">
            min 20 puzzles
          </span>
        </div>

        {/* Leaderboard table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-secondary">
                <th className="text-left text-xs font-bold uppercase tracking-widest text-text-muted px-4 py-3 w-16">
                  #
                </th>
                <th className="text-left text-xs font-bold uppercase tracking-widest text-text-muted px-4 py-3">
                  player
                </th>
                <th className="text-right text-xs font-bold uppercase tracking-widest text-text-muted px-4 py-3 w-24">
                  ACPL
                </th>
                <th className="text-right text-xs font-bold uppercase tracking-widest text-text-muted px-4 py-3 w-24">
                  puzzles
                </th>
              </tr>
            </thead>
            <tbody>
              {placeholderEntries.map((entry) => (
                <tr
                  key={entry.rank}
                  className="border-b border-border last:border-b-0 hover:bg-bg-hover transition-colors"
                >
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-text-muted">
                    {entry.rank}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {entry.name}
                  </td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-text-secondary">
                    {entry.acpl}
                  </td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-text-muted">
                    {entry.puzzles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center text-sm text-text-muted">
          leaderboard will populate once users are playing
        </div>
      </div>
    </div>
  );
}
