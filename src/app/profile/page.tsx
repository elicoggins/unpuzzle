export default function ProfilePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">profile</h1>

        {/* Placeholder for auth */}
        <div className="border border-border rounded-lg p-8 text-center space-y-4">
          <div className="text-text-muted">
            sign in to track your stats across sessions
          </div>
          <button
            disabled
            className="px-8 py-3 text-sm font-bold uppercase tracking-widest border-2 border-border text-text-muted rounded-lg cursor-not-allowed opacity-50"
          >
            coming soon
          </button>
        </div>

        {/* Stats preview (will be populated once auth + DB are wired) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="ACPL" value="—" />
          <StatCard label="puzzles" value="0" />
          <StatCard label="streak" value="0" />
          <StatCard label="best session" value="—" />
        </div>

        {/* Recent attempts placeholder */}
        <div className="border border-border rounded-lg p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted">
            recent attempts
          </h2>
          <div className="text-text-muted text-sm">
            play some puzzles to see your history here
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-1">
      <div className="text-xs text-text-muted uppercase tracking-widest">
        {label}
      </div>
      <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">
        {value}
      </div>
    </div>
  );
}
