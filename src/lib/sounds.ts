const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function play(file: string, volume = 1) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(pointer: coarse)").matches) return;
  const audio = new Audio(`${BASE}/sounds/${file}`);
  audio.volume = volume;
  audio.play().catch(() => {});
}

export function playMoveSound()    { play("Move.mp3",    0.5); }
export function playCaptureSound() { play("Capture.mp3", 0.5); }
export function playGoodSound()    { play("Good.mp3",    0.4); }
export function playBadSound()     { play("Bad.mp3",     0.4); }
