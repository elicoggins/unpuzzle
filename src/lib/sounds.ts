const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function preload(file: string, volume: number): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const audio = new Audio(`${BASE}/sounds/${file}`);
  audio.volume = volume;
  audio.load();
  return audio;
}

const moveAudio    = preload("Move.mp3",    0.5);
const captureAudio = preload("Capture.mp3", 0.5);
const goodAudio    = preload("Good.mp3",    0.4);
const badAudio     = preload("Bad.mp3",     0.4);

function play(audio: HTMLAudioElement | null) {
  if (!audio) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playMoveSound()    { play(moveAudio); }
export function playCaptureSound() { play(captureAudio); }
export function playGoodSound()    { play(goodAudio); }
export function playBadSound()     { play(badAudio); }
