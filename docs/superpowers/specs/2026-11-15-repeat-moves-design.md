# Repeat the moves — design

Date: 2026-11-15
Status: awaiting approval

Items marked **(call)** were decided by Claude, not the owner, and are open to correction.

## Intent

A second exercise. The user sees a position from the middle of a real game, watches a sequence of moves play out, then the board goes back to the start of the sequence and the user plays the same moves again, for both sides.

| Preset | Moves per side | Moves in total |
|---|---|---|
| Easy | 3 | 6 |
| Medium | 6 | 12 |
| Hard | 9 | 18 |

## Decisions made by the owner

- Sequences start in the middle of a game, not from the opening.
- The first wrong move ends the attempt: it is marked red, the right move is shown, and the position counts as wrong.
- Moves come from the real games behind the Lichess puzzles in the puzzle CSV.

## Goals

- A playable exercise with presets and settings, built the same way as Missing piece: settings in a drawer, big Start button, countdown instead of a Ready button, progress bar, green/red verdict, big Next button that moves on after 4 seconds, no points.
- Real move sequences from real games, bundled as a file; no network needed while playing.

## Non-goals

- Variants, puzzle solving, engine evaluation.
- Sequences from the opening.

## Approaches

1. **Games behind the puzzles, fetched once by a script (chosen by the owner).** Each puzzle row's `GameUrl` holds the game ID and a move number (`https://lichess.org/game/787zsVup/black#48`). A script sends batches of up to 300 IDs to `POST https://lichess.org/api/games/export/_ids` (no account), cuts one sequence per game, and writes a JSON file to the project.
2. Sampling a Lichess monthly games file: same result without the API, but the owner chose 1.
3. Fetching games live per round: needs the network while playing and is rate-limited.

## Data

- **Script** `scripts/build-sequences.mjs`, reading the puzzle CSV (same download as for positions).
  - Take game IDs from `GameUrl`; keep the move number after `#`.
  - Request games in batches of 300 with `Accept: application/x-ndjson`, one request at a time. On HTTP 429 wait 60 s and retry (Lichess's documented rule). Send no personal data; use a generic User-Agent.
  - For each game: replay its moves with chessops from the standard start; take the 18 moves (9 per side) that end just before the puzzle position, so the sequence is middle-game play. Skip games where that window would start before move 10 (ply 20), and games that are not standard chess.
  - Store `{ id, gameId, ply, fen, moves, pieces }`: `fen` is the position before the first move, `moves` are 18 UCI moves, `pieces` the piece count at the start.
  - Target about 1,500 sequences, spread over piece counts as evenly as the data allows **(call)**.
- **Output** `public/sequences.json`, committed, loaded lazily on Start like `positions.json`.
- Easy, Medium and Hard use the first 6, 12 or 18 moves of each sequence.

## Exercise flow

| State | What the user sees | Leaves when |
|---|---|---|
| `idle` | Board, big Start, "Settings: Easy" | Start |
| `look` | The start position and a countdown (3 s default) **(call)** | Countdown ends |
| `watch` | The moves play one by one, about 1 s apart, last move highlighted | Last move played, plus a short pause |
| `replay` | The board back at the start position; the user plays the moves for both sides; "Move 4 of 12" | All moves played right, or a wrong move |
| `result` | Verdict in green or red; on a wrong move, that move marked red and the right move shown as an arrow; big Next (4 s auto); small "View on Lichess" | Next or 4 s |
| `summary` | "7/10 correct", list of positions with Correct/Wrong, Play again, Settings | Play again |

- Only legal moves can be made (chessops supplies legal destinations; chessground enforces them).
- Promotion: the expected promotion piece is used automatically when the user makes the promotion move **(call)**.
- No time limit while replaying **(call)**.
- Positions in a session go from fewest pieces to most, as in Missing piece.

## Settings

| Setting | Values | Default (Easy / Medium / Hard) |
|---|---|---|
| Moves per side | 1–9 | 3 / 6 / 9 |
| Time to look before the moves | 0–10 s | 3 s |
| Time between moves | 0.5–3 s | 1 s |
| Side at the bottom | side to move, white, black, random | side to move |
| Show coordinates | on/off | on / on / off |
| Positions per session | 5–50 | 10 |
| Pieces on the board | 4–32 range | 4–32 **(call)** |

Saved settings and best result per preset use their own storage keys, sanitised the same way as Missing piece.

## Structure

```
scripts/build-sequences.mjs (+ test)       sampling and cutting sequences (pure parts tested)
public/sequences.json
src/pages/exercises/repeat-moves.astro
src/exercises/repeat-moves/
  settings.ts, machine.ts (+ tests)        presets, sanitize, reducer, isCorrect
  RepeatMoves.tsx, SettingsPanel.tsx
src/components/
  Board.tsx                                gains a move mode: legal destinations, onMove, last-move highlight, arrows
  ExerciseShell pieces                     progress bar, settings drawer, verdict, Next-with-countdown, useCountdown;
                                           Missing piece is moved onto them so both exercises behave the same
src/lib/sequences.ts (+ test)              loader and picker (unused, piece-count range, easiest to hardest)
src/pages/index.astro                      lists both exercises
```

## Risks

- **Touch:** in replay the board must react to touches to move pieces, so a gesture that starts on the board will not scroll the page during replay. Outside replay the board stays view-only.
- **Lichess API:** the script runs once, not in the app; if it is rate-limited it waits and retries.

## Testing

- Unit: sequence cutting (window position, middle-game rule, UCI conversion), sanitize and presets, reducer transitions (including wrong move ends the attempt), picker.
- Browser (headless Chrome): watch a sequence, replay it correctly, replay with a wrong move, settings drawer, phone width, Missing piece still passing its checks after the shared components move.
