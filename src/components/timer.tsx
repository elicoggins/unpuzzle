"use client";

import { useState, useEffect, useCallback } from "react";

interface TimerProps {
  isRunning: boolean;
  onReset?: () => void;
}

export function Timer({ isRunning, onReset }: TimerProps) {
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (onReset) {
      setElapsed(0);
    }
  }, [onReset]);

  const reset = useCallback(() => {
    setElapsed(0);
  }, []);

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;

  const formatTime = () => {
    return `${minutes}:${displaySeconds.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <button
        onClick={() => setVisible(!visible)}
        className={`text-xs cursor-pointer transition-colors ${
          visible
            ? "text-text-muted hover:text-text-secondary"
            : "text-text-muted/40 hover:text-text-muted line-through"
        }`}
        title={visible ? "Hide timer" : "Show timer"}
      >
        cur time
      </button>
      <span className="font-[family-name:var(--font-mono)] text-text-secondary tabular-nums">
        {visible ? formatTime() : "—"}
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
