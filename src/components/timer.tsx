"use client";

import { useState, useEffect, useCallback } from "react";

interface TimerProps {
  isRunning: boolean;
  avgTime?: string | null;
}

export function Timer({ isRunning, avgTime }: TimerProps) {
  const [mode, setMode] = useState<"cur" | "avg">("cur");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;
  const curFormatted = `${minutes}:${displaySeconds.toString().padStart(2, "0")}`;

  const label = mode === "cur" ? "cur time" : "avg time";
  const value = mode === "cur" ? curFormatted : (avgTime ?? "—");

  return (
    <>
      <button
        onClick={() => setMode((m) => (m === "cur" ? "avg" : "cur"))}
        className="text-xs cursor-pointer transition-colors text-text-muted hover:text-accent"
        title={mode === "cur" ? "Switch to avg time" : "Switch to cur time"}
      >
        {label}
      </button>
      <span className="font-[family-name:var(--font-mono)] text-text-secondary tabular-nums">
        {value}
      </span>
    </>
  );
}

export function useTimerControl() {
  const [isRunning, setIsRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setResetKey((k) => k + 1);
    setIsRunning(false);
  }, []);

  return { isRunning, start, stop, reset, resetKey };
}
