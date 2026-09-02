# Chess

A two-player chess web app — one board, two friends, complete rules.

## Stack

React 19 · TypeScript · Tailwind CSS v4 · SCSS · Vite. State lives in `localStorage`;
there is no backend.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle into dist/
```

## Rules

The engine in [`src/engine/`](src/engine/) implements the full FIDE move set:

- Sliding, stepping and pawn moves, with pins and discovered checks handled by
  filtering every pseudo-legal move through a self-check test.
- Castling — king- and queen-side, including the "not out of, through, or into
  check" restrictions and loss of rights when a king or rook moves or a rook is captured.
- En passant, including the one-move window in which it is available.
- Promotion to queen, rook, bishop or knight, chosen from a dialog.
- Checkmate and stalemate.
- Draws: fifty-move rule, threefold repetition, and insufficient material.
- Standard Algebraic Notation with correct disambiguation (`Nbd2`, `R1e2`) and
  check/mate suffixes.

Move generation is verified against the standard perft suite — five reference
positions to depth 3–4, all matching published node counts.

## Playing the computer

Pick **Computer** in the Opponent panel, choose a difficulty, and pick your colour.
The engine is a negamax search with alpha-beta pruning, a quiescence search so it
never evaluates in the middle of a trade, MVV-LVA move ordering, and piece-square
tables that switch to an endgame king table once material thins out.

| Level  | Depth | Behaviour                                      |
| ------ | ----- | ---------------------------------------------- |
| Easy   | 1     | Often picks a weaker move on purpose           |
| Medium | 3     | Occasionally errs                              |
| Hard   | 4     | Always plays the best move it finds            |

It runs in a Web Worker, so the board never freezes while it thinks — the worst
case (the opening position on Hard) is around 0.9s. Even on Easy it will not throw
away a forced mate.

## Sound

Every sound is synthesised at runtime with the Web Audio API — there are no audio
files to download. Moves and captures are a filtered noise burst plus a shaped
tone; castling is two knocks; check, promotion, win and draw each have their own
motif. The speaker button mutes everything, and the preference persists.

## Features

- Click a piece to see its legal moves; a dot marks a quiet move, a ring a capture.
- Board flip, plus auto-flip to keep the side to move at the bottom for hot-seat play.
- Move list you can click to review any earlier position; `←`/`→` step, `↓` returns
  to the live game, `F` flips.
- Undo, resign, and draw by agreement. Against the computer, undo steps back over
  its reply so it is your turn again.
- Editable player names, captured-piece tally and material advantage.
- The game in progress and the last 20 finished games persist across reloads.

## Layout

```
src/
  engine/     board.ts (FEN, coordinates) · moves.ts (generation) · game.ts (rules, SAN)
              ai.ts (search + evaluation) · ai.worker.ts (off-thread search)
  hooks/      useChessGame.ts — game state, selection, persistence
              useChessAi.ts — worker lifecycle, stale-reply handling
  components/ Board · Piece · MoveList · PlayerCard · StatusBanner
              GameSetup · SoundToggle
  styles/     main.scss + _variables/_board/_panel partials
  utils/      storage.ts — localStorage guards · sound.ts — Web Audio synthesis
```
