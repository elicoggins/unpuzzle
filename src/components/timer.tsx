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
    <div className="flex items-center gap-3">
      {visible && (
        <span className="font-[family-name:var(--font-mono)] text-lg text-text-secondary tabular-nums">
          {formatTime()}
        </span>
      )}
      <button
        onClick={() => setVisible(!visible)}
        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
        title={visible ? "Hide timer" : "Show timer"}
      >
        {visible ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" opacity="0.3" />
            <polyline points="12 6 12 12 16 14" opacity="0.3" />
            <line x1="4" y1="4" x2="20" y2="20" />
          </svg>
        )}
      </button>
    </div>
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
