# Aesymnetes

A small website for chess training exercises. It is a static site: there is no backend, and settings and scores are kept in the browser.

## Exercises

### Missing piece

1. A position from a real game is shown. Memorise it.
2. The board is hidden for a moment and one piece is removed.
3. Click the square the piece stood on.
4. Pick the colour and type of the piece.
5. Points are awarded for the square and for the piece.

Everything is configurable, and three presets bundle the settings:

| | Easy | Medium | Hard |
|---|---|---|---|
| Pieces on the board | 4–10 | 10–20 | 20–32 |
| Time to memorise | no limit | 20 s | 10 s |
| Tries at the square | 3 | 2 | 1 |
| Side at the bottom | White | random | random |
| Coordinates | shown | shown | hidden |
| Speed bonus | off | off | on |

Other settings: how long the board stays hidden, which pieces can go missing (any, no pawns, pawns only), and the number of positions per session. The king is never removed.

Scoring per position:

- **Square:** 100 points on the first try, less for each wrong guess, 0 if the square had to be revealed.
- **Piece:** 25 for the right colour and 25 for the right type.
- **Speed bonus** (when on): up to 50 points, falling to 0 over ten seconds, if both answers are right.

The best session score is saved for each preset.

## Getting started

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:4321.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Builds the static site into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm test` | Runs the unit tests (Vitest) |

## Positions

Positions come from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). About 4,000 of them, spread evenly over piece counts from 4 to 32, are stored in `public/positions.json` and loaded when an exercise starts.

To regenerate the file you need the `zstd` command-line tool. Download and decompress the start of the puzzle file, then feed it to the sampling script:

```bash
curl -L -r 0-29999999 -o tmp/puzzles.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
zstd -dc tmp/puzzles.csv.zst | head -n 300000 > tmp/puzzles.csv
node scripts/build-positions.mjs < tmp/puzzles.csv > public/positions.json
```

`zstd` reports an error at the end of the partial download; that is expected.

## Project layout

```
scripts/build-positions.mjs     samples positions from the Lichess CSV
public/positions.json           the sampled positions
src/
  layouts/Base.astro            page frame
  pages/                        one page per exercise, plus the exercise list
  components/Board.tsx          display-only chessground board that reports clicks
  lib/                          position picking and browser storage, shared by exercises
  exercises/missing-piece/      settings, scoring, state machine and UI for this exercise
docs/superpowers/               design and implementation plan
```

A new exercise is a new page under `src/pages/exercises/`, a new folder under `src/exercises/`, and an entry in the list in `src/pages/index.astro`.

## Built with

- [Astro](https://astro.build) and [React](https://react.dev)
- [Mantine](https://mantine.dev) for the controls
- [chessground](https://github.com/lichess-org/chessground) for the board and [chessops](https://github.com/niklasf/chessops) for chess logic, both from Lichess

## Licence

GPL-3.0-or-later, as required by chessground and chessops. See [LICENSE](LICENSE).
