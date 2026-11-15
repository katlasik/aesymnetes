# Repeat the Moves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second exercise: watch a middle-game move sequence from a real Lichess game, then replay it for both sides; the first wrong move ends the attempt.

**Architecture:** A one-time script turns the games behind the puzzle CSV into `public/sequences.json`. The exercise is a page plus a folder like Missing piece, driven by a pure reducer. UI parts both exercises share (countdown, settings drawer, progress bar, verdict, Next button) move into `src/components/` and Missing piece switches to them. The Board component gains a move mode.

**Tech Stack:** as the project: Astro, React, Mantine, chessground, chessops, Vitest; headless checks with playwright-core from `tmp/e2e/`.

**Spec:** `docs/superpowers/specs/2026-11-15-repeat-moves-design.md`

## Global Constraints

- Sequence data: 18 UCI moves per sequence, starting at ply ≥ 20, ending just before the puzzle's ply; stored in `public/sequences.json`, loaded lazily.
- Lichess API: `POST https://lichess.org/api/games/export/_ids`, ≤ 300 IDs per request, one request at a time, wait 60 s on HTTP 429, generic User-Agent, no personal data.
- Presets: Easy / Medium / Hard = 3 / 6 / 9 moves per side; coordinates on / on / off; everything else as the spec's settings table.
- First wrong move ends the attempt. Only legal moves can be played.
- No points anywhere; verdict green/red; Next auto after 4 s; no End session; countdown instead of Ready.
- Storage keys: `aesymnetes:repeat-moves:settings`, `aesymnetes:repeat-moves:best-correct`.
- Temporary files under `tmp/`. Commits carry no Claude attribution.
- Do not start on UI notes while notes are still arriving (see `CLAUDE.md`).

## Review Focus

1. **A sequence whose moves don't replay from its FEN** (corrupt data): the picker skips it, the app does not crash. → Task 1 validates at build time; Task 4 picker test.
2. **Promotion during replay**: the expected piece is used; a promotion to another piece never shows a picker. → Task 4 reducer test.
3. **Clicks and drags outside replay** (during look/watch/result): the board does not move pieces. → Task 3 check.
4. **Missing piece regressions after the shared components move**: its 47 browser checks still pass. → Tasks 2, 3 and 5.
5. **`sequences.json` fails to load / nothing fits the settings**: error with Try again / message, as in Missing piece. → Task 5 browser check.

---

### Task 1: Sequence data

**Files:** Create `scripts/build-sequences.mjs`, `scripts/build-sequences.test.mjs`, `public/sequences.json`

**Interfaces — produces:**
```js
parseGameUrl(url: string): { gameId: string, ply: number } | null
cutSequence(sanMoves: string[], puzzlePly: number, length = 18, minStartPly = 20):
  { fen: string, moves: string[] /* UCI */, ply: number /* first move's ply index */, pieces: number } | null
// sequences.json: { id: string /* gameId-ply */, gameId, ply, fen, moves, pieces }[]
```

- [ ] **Step 1: Failing tests**
```js
test('parseGameUrl reads the id and ply', () => {
  expect(parseGameUrl('https://lichess.org/game/787zsVup/black#48')).toEqual({ gameId: '787zsVup', ply: 48 });
  expect(parseGameUrl('https://lichess.org/game/F8M8OS71#53')).toEqual({ gameId: 'F8M8OS71', ply: 53 });
  expect(parseGameUrl('nonsense')).toBeNull();
});
// A 40-ply legal game in SAN (any real game; keep it in the test file as a constant).
test('cutSequence takes the 18 moves that end just before the puzzle ply', () => {
  const s = cutSequence(GAME_40, 40);
  expect(s.ply).toBe(22); expect(s.moves).toHaveLength(18);
  // replaying s.moves from s.fen with chessops reaches the same position as GAME_40's first 40 plies
});
test('cutSequence refuses windows that start before ply 20', () => {
  expect(cutSequence(GAME_40, 30)).toBeNull();
});
test('cutSequence refuses games with an illegal move', () => {
  expect(cutSequence([...GAME_40.slice(0, 10), 'Qxz9'], 40)).toBeNull();
});
```
- [ ] **Step 2:** Run `npm test` — Expected: FAIL (module missing).
- [ ] **Step 3:** Implement with `parseSan`/`makeUci` from chessops; `fen` via `makeFen`; `pieces` = occupied squares at the start.
- [ ] **Step 4:** Run `npm test` — Expected: PASS.
- [ ] **Step 5:** CLI part: reads the CSV on stdin, collects up to 2,400 game IDs (one per puzzle, unique), fetches in batches of 300 (`Accept: application/x-ndjson`, `moves` field is SAN separated by spaces, skip `variant !== 'standard'` and games with `initialFen`), cuts one sequence per game, caps 60 per piece count, prints JSON. Run it on `tmp/` copies of the CSV; Expected: 1,000–1,700 sequences. Spot-check one `gameId`/`ply` against lichess.org by eye in the summary.
- [ ] **Step 6:** Commit `feat: add move sequences from the games behind Lichess puzzles`.

### Task 2: Shared exercise components (Missing piece moves onto them)

**Files:** Create `src/components/exercise/useCountdown.ts`, `ProgressStatus.tsx`, `NextButton.tsx`, `SettingsDrawer.tsx`, `GearIcon.tsx`, `exercise.css`. Modify `src/exercises/missing-piece/MissingPiece.tsx`, `MissingPiece.css`.

**Interfaces — produces:**
```ts
useCountdown(active: { key: string; seconds: number; onDone: () => void } | null): number | null // ms left
ProgressStatus(p: { done: number; current: number; total: number })
NextButton(p: { label: string; msLeft: number | null; seconds: number; busy: boolean; onClick: () => void })
SettingsDrawer(p: { opened: boolean; onClose: () => void; intro: string; best?: string; children: ReactNode })
GearIcon()
// exercise.css: .ex-clock, .ex-verdict.is-right/.is-wrong, .ex-start, .ex-next, .ex-lichess
```
- [ ] **Step 1:** Move the code out of MissingPiece without behaviour changes; class names in Missing piece switch to the `ex-` ones.
- [ ] **Step 2:** Run `npm test`, `npx tsc --noEmit`, `npm run build`, then `node tmp/e2e/exercise.mjs` (update its selectors to the new class names only). Expected: all pass, 47/47.
- [ ] **Step 3:** Commit `refactor: share exercise UI parts`.

### Task 3: Board move mode

**Files:** Modify `src/components/Board.tsx`, `Board.css`.

**Interfaces — produces (added props):**
```ts
movable?: { color: 'white' | 'black'; dests: Map<string, string[]> } // absent = view-only, as today
onMove?: (orig: string, dest: string) => void
lastMove?: [string, string]
arrows?: { orig: string; dest: string; brush: 'green' | 'red' }[]
animate?: boolean // default false (Missing piece must not animate)
```
- [ ] **Step 1:** With `movable`, set `viewOnly: false`, `movable: { free: false, color, dests, showDests: true, events: { after } }`, `draggable/selectable` on; without it keep today's view-only config and click handling. Arrows via `drawable.autoShapes` (drawing by the user stays off).
- [ ] **Step 2:** Browser check (temporary page under `src/pages/`, deleted before commit): only legal moves are accepted; `onMove` fires once per move; arrows and last-move highlight render; without `movable`, dragging does nothing. Run Missing piece's `exercise.mjs` and `touch.mjs`: still pass.
- [ ] **Step 3:** Commit `feat: board move mode`.

### Task 4: Repeat-moves settings and reducer

**Files:** Create `src/exercises/repeat-moves/settings.ts`, `settings.test.ts`, `machine.ts`, `machine.test.ts`; `src/lib/sequences.ts`, `sequences.test.ts`.

**Interfaces — produces:**
```ts
// settings.ts
type Side = 'toMove' | 'white' | 'black' | 'random'
interface Settings { movesPerSide: number /*1–9*/; lookSeconds: number /*0–10*/; moveMs: number /*500–3000, step 250*/;
  side: Side; coordinates: boolean; rounds: number /*5–50*/; minPieces: number; maxPieces: number /*4–32*/ }
PRESETS: Record<'easy'|'medium'|'hard', Settings>; LIMITS; matchPreset(s); sanitize(raw)
// sequences.ts
interface Sequence { id: string; gameId: string; ply: number; fen: string; moves: string[]; pieces: number }
loadSequences(): Promise<Sequence[]>
pickSequence(pool, filter: { minPieces; maxPieces }, used: ReadonlySet<string>, rng?, step?: Step): Sequence | null
// uses targetPieces from src/lib/positions.ts; skips sequences whose moves do not replay from fen
// machine.ts
type Phase = 'idle' | 'look' | 'watch' | 'replay' | 'result' | 'summary'
interface NewRound { sequence: Sequence; orientation: 'white' | 'black' }
interface Round extends NewRound { plies: number; shown: number; played: string[]; wrongMove: string | null }
type Action = { type: 'setSettings'; settings } | { type: 'start'; round: NewRound } | { type: 'lookDone' }
  | { type: 'watchStep' } | { type: 'watchDone' } | { type: 'move'; uci: string } | { type: 'next'; round: NewRound | null } | { type: 'quit' }
initialState, reduce, isCorrect(round), correctCount(state), expectedMove(round): string | null
```
Transitions: `start` → look (plies = movesPerSide × 2); `lookDone` → watch; `watchStep` increments `shown` up to `plies`; `watchDone` (only when `shown === plies`) → replay; `move` in replay: equal to the expected move (from+to match; promotion piece taken from the expected move) → appended, and when all played → result; otherwise `wrongMove` set → result; `next`/`quit`/`setSettings` as in Missing piece. Out-of-phase actions return the same state object.

- [ ] **Step 1: Failing tests** — one per transition above, plus: presets match the spec table; sanitize clamps every field and repairs min > max; wrong move ends the attempt and `isCorrect` is false; a promotion move counts when from/to match; `pickSequence` follows `targetPieces` order and skips a sequence whose moves are illegal from its FEN.
- [ ] **Step 2:** Run `npm test` — Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` — Expected: PASS.
- [ ] **Step 5:** Commit `feat: repeat-moves settings, reducer and picker`.

### Task 5: Repeat-moves UI

**Files:** Create `src/exercises/repeat-moves/RepeatMoves.tsx`, `SettingsPanel.tsx`, `RepeatMoves.css`, `src/pages/exercises/repeat-moves.astro`. Modify `src/pages/index.astro` (add the exercise).

- [ ] **Step 1:** Build the screen per the spec's flow table using Task 2's components and Task 3's move mode:
  - look: countdown (`ex-clock`) then `lookDone`;
  - watch: an interval of `moveMs` dispatches `watchStep`, the board shows `fen` + first `shown` moves with `lastMove`, animation on; after the last move wait `moveMs`, then `watchDone`;
  - replay: board at `fen` + `played`, `movable` for the side to move with chessops `chessgroundDests`, "Move N of M";
  - result: on a wrong move show the board after the wrong move with a red arrow for it and a green arrow for the expected move; verdict text names the expected move in SAN ("Wrong. The move was Nf3."); `NextButton` 4 s; "View on Lichess" → `https://lichess.org/{gameId}#{ply}`.
  - orientation `toMove` = the side to move at `fen`.
- [ ] **Step 2:** Run `npm test`, `npx tsc --noEmit`, `npm run build` — Expected: pass.
- [ ] **Step 3:** Browser check `tmp/e2e/repeat.mjs`: a correct replay reads the moves from the watch phase (record the `lastMove` squares) and plays them back → green; a wrong first move → red with two arrows; Next auto-advances; settings drawer and preset label; phone width has no horizontal scroll; load failure shows Try again; index lists both exercises. Run Missing piece's checks again.
- [ ] **Step 4:** Commit `feat: add repeat-the-moves exercise`.
