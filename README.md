<h1><img src="./src/app/icon.svg" width="36" height="36" alt="" style="vertical-align:middle; margin-right:8px" />unpuzzle</h1>

Chess puzzle apps suffer a common problem. Users know they're grinding puzzles, so they calculate tactics and sacrifices far more willingly than they would in a standard timed game.

This app addresses that issue by presenting an unmarked position. Sometimes, it will be a puzzle with a tactic present. Sometimes, it might be a sharp position with a couple winning moves. Sometimes it will be completely balanced and a simple developing move is advisable. 

Study the position, determine what you think is a good move. Stockfish evaluates your choice and scores it against the best move in the position.

## How it works

1. A position is shown. It can be a puzzle, a balanced middlegame, endgame, etc.
2. You make a move
3. Stockfish evaluates both your move and the best move
4. You get a score: **Perfect · Excellent · Good · Inaccuracy · Mistake · Blunder**

Your session ACPL (Average Centipawn Loss) tracks accuracy over time. Lower is better. 0 is perfect.

## Running locally

```bash
pnpm install
pnpm dev
```

## Stack

- **Next.js** (App Router, static export)
- **TypeScript** + **Tailwind CSS v4**
- **Stockfish 18** lite WASM — runs entirely in the browser, no server needed
- **chess.js** · **react-chessboard v5** · **framer-motion**

## Deployment

Hosted on GitHub Pages at **https://elicoggins.github.io/unpuzzle/**. Deploys automatically on every push to `main` via GitHub Actions.
