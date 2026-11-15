# Chess exercises app — first exercise: "Missing piece"

Date: 2026-11-15
Status: awaiting approval

Items marked **(call)** were decided by the designer, not the owner, and are open to correction.

## Intent

A small website for chess training exercises. Several exercises will be added over time; this design covers the app shell and the first exercise, a memory drill:

1. The user sees a real chess position and memorises it.
2. One piece is removed.
3. The user clicks the square the piece was on.
4. The user picks the colour and type of the missing piece.
5. Correct answers earn points.

Everything about the drill is configurable, and named presets bundle the settings.

## Goals

- A playable "Missing piece" exercise with settings, presets, and scoring.
- An app shell where a new exercise is a new page plus a new folder, with no changes to existing exercises.
- Positions taken from real games.
- Lichess libraries for the board and chess logic; nothing chess-related is hand-rolled.
- A UI that does not look like a default AI-generated site.

## Non-goals

- Backend, accounts, server-side score storage.
- Removing more than one piece per round.
- Further exercises (only the room for them).
- Translations.

## Anti-goals

- The default shadcn/Tailwind look: purple gradients, glassy cards, emoji headings.
- Hand-written board rendering or FEN parsing.
- An exercise the user can solve by watching the piece vanish (see "Mask" below).

## Constraints

- Astro + React on the frontend (owner's decision).
- Lichess libraries (owner's decision): `chessground` for the board, `chessops` for FEN parsing and board contents. Both are GPL-3.0, so the project is licensed GPL-3.0 and carries a `LICENSE` file.
- Static site: no server code at runtime.
- Node 22, npm.

## Approaches

1. **Static site with bundled positions — chosen by the owner.** One Astro page per exercise, each hosting one React component. Positions are sampled once from the Lichess puzzle CSV into a JSON file with piece counts pre-computed. Settings and scores live in `localStorage`. Works offline, no rate limits, and the position-size setting can filter instantly. The pool is fixed until the sampling script is re-run.
2. **Positions fetched live from the Lichess API.** Always fresh, but one puzzle per request, rate-limited, and no way to filter by piece count without fetching and discarding.
3. **One React single-page app inside one Astro page.** No benefit while exercises share no live state, and it makes Astro pointless.

UI library: **Mantine** with a custom theme (owner approved alongside approach 1). It has the sliders, segmented controls and number inputs the settings panel needs.

## Stack

- Astro (latest stable) with `@astrojs/react`, React, TypeScript (strict).
- Mantine core + hooks, custom theme.
- `chessground`, `chessops`.
- Vitest for logic tests **(call)**.

## Position data

- Source: the Lichess puzzle database, `https://database.lichess.org/lichess_db_puzzle.csv.zst` (CC0). Columns include `PuzzleId` and `FEN`.
- `scripts/build-positions.mjs` streams the start of the file (it needs the `zstd` command-line tool), counts the pieces in each FEN, and keeps up to a fixed number of positions per piece count so that every count from 4 to 32 is covered as evenly as the data allows. Target: about 4,000 positions in total **(call)**.
- Output: a JSON array of `{ id, fen, pieces }`, committed to the repository so the app builds without running the script. It is loaded lazily when an exercise starts, not bundled into the page script.
- The result screen links to `https://lichess.org/training/{id}` **(call)**.

## Exercise flow

States, driven by a single reducer:

| State | What the user sees | Leaves when |
|---|---|---|
| `idle` | Settings summary, preset picker, Start button | Start is clicked |
| `memorise` | Full position; a countdown if timed; a Ready button always | The countdown ends or Ready is clicked |
| `mask` | Board hidden | The gap elapses |
| `guessSquare` | Position without the piece; prompt to click the square | The right square is clicked, or attempts run out |
| `guessPiece` | Correct square highlighted; colour toggle and six piece-type buttons | An answer is submitted |
| `result` | Full position with the piece restored and highlighted; points for the round; Next button | Next is clicked |
| `summary` | Total score, per-round breakdown, best score for this preset | Play again |

Details:

- **Mask (call):** between `memorise` and `guessSquare` the board is hidden for a short gap. Without it the user simply watches the piece disappear and the drill tests nothing.
- A wrong square is marked on the board and costs one attempt. When attempts run out the correct square is revealed, the square scores zero, and the user still gets to guess the piece.
- The piece guess gets one try **(call)**.
- The king is never removed **(call)**: every position has both kings, so the answer would be obvious.
- A position is not repeated within a session. If a chosen position has no piece eligible for removal under the current settings, another is drawn.
- The board is display-only: no dragging, no moves. Square clicks are captured only in `guessSquare`.

## Settings

| Setting | Values | Notes |
|---|---|---|
| Memorise time | untimed, or 3–120 s | Ready button is always available |
| Mask gap | 0–3 s | **(call)**, default 1 s |
| Position size | min and max piece count, 4–32 | range slider |
| Removable pieces | any, pieces only (no pawns), pawns only | king excluded in all cases |
| Board side | white, black, random | which colour is at the bottom |
| Coordinates | on, off | |
| Attempts | 1–5 | wrong square guesses allowed |
| Speed bonus | on, off | |
| Rounds per session | 5–50 | **(call)**, default 10 |

### Presets (call)

| | Easy | Medium | Hard |
|---|---|---|---|
| Memorise time | untimed | 20 s | 10 s |
| Mask gap | 1 s | 1 s | 1 s |
| Position size | 4–10 | 10–20 | 20–32 |
| Removable | any | any | any |
| Board side | white | random | random |
| Coordinates | on | on | off |
| Attempts | 3 | 2 | 1 |
| Speed bonus | off | off | on |
| Rounds | 10 | 10 | 10 |

Choosing a preset fills every setting. Changing any setting afterwards switches the preset label to "Custom". The last-used settings are saved in `localStorage` and restored on load.

## Scoring (call)

Per round:

- **Square:** 100 points on the first attempt, reduced in equal steps per wrong guess (with 3 attempts: 100, 67, 33). Zero if revealed.
- **Piece:** 25 for the right colour, 25 for the right type.
- **Speed bonus,** if enabled and both the square (not revealed) and the piece are right: up to 50 points, falling linearly to zero over 10 seconds measured from the start of `guessSquare` to submitting the piece.

Session score is the sum of rounds. The best session score per preset is kept in `localStorage`; Custom sessions are not ranked.

## Structure

```
scripts/build-positions.mjs
src/
  layouts/Base.astro               page frame, header, nav
  pages/index.astro                list of exercises
  pages/exercises/missing-piece.astro
  components/Board.tsx             thin React wrapper around chessground
  lib/storage.ts                   typed localStorage helpers
  lib/positions.ts                 lazy loader and picker for the position pool
  exercises/missing-piece/
    MissingPiece.tsx               the React component mounted on the page
    machine.ts                     reducer and state types
    settings.ts                    settings type, limits, presets
    scoring.ts
    SettingsPanel.tsx
    PiecePicker.tsx
```

- Each exercise page mounts its React component client-side only, with its own Mantine provider. The header and exercise list are plain Astro.
- `Board.tsx` and `lib/` are shared across future exercises; everything under `exercises/missing-piece/` is private to this one.
- `machine.ts`, `scoring.ts`, `settings.ts` and the position picker contain no React and no DOM access, so they are testable in isolation.

## Look and feel

- The board is the centre of the page; controls sit beside it on wide screens and below it on phones. The board must be usable at phone width.
- Quiet, tool-like styling with a custom Mantine theme: its own type choice and a restrained palette. Light and dark modes.
- Standard Lichess board and piece set shipped with chessground.

## Testing

- Unit tests for the reducer (every transition in the table above), scoring, preset/custom switching, and the position picker (size filter, removable filter, no repeats).
- Manual run-through in the browser for each preset before the work is called done.

## Left to the builder

- Exact versions, theme details, fonts, copy.
- How the mask looks (blank board, cover, fade).
- How chessground is configured to be display-only while still reporting square clicks.
- The per-count cap in the sampling script.
