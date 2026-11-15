# Missing Piece Exercise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Astro + React site with one chess memory exercise: memorise a real position, find the square of the removed piece, name the piece, earn points.

**Architecture:** One Astro page per exercise, each mounting one client-only React component wrapped in its own Mantine provider. Game logic is a pure reducer plus pure scoring, settings and position-picking modules; randomness and the clock are passed in through actions. Positions come from a committed JSON file sampled from the Lichess puzzle CSV.

**Tech Stack:** Astro, `@astrojs/react`, React, TypeScript (strict), Mantine (`@mantine/core`, `@mantine/hooks`), `chessground`, `chessops`, Vitest. Node 22, npm.

**Spec:** `docs/superpowers/specs/2026-11-15-missing-piece-design.md`

## Global Constraints

- Licence GPL-3.0; a `LICENSE` file with the full GPL-3.0 text and `"license": "GPL-3.0-or-later"` in `package.json`.
- Static site, no server code at runtime.
- Board rendering only through `chessground`; FEN parsing and board contents only through `chessops`.
- The king is never a removal target.
- `src/exercises/missing-piece/machine.ts`, `scoring.ts`, `settings.ts` and the pure parts of `src/lib/positions.ts` import no React and touch no DOM.
- No Tailwind, no shadcn. Mantine with a custom theme; light and dark modes.
- The board is usable at 360 px viewport width.
- `localStorage` keys: `aesymnetes:missing-piece:settings`, `aesymnetes:missing-piece:best`.
- Commits: one per task, made only after the owner has approved this plan. No pull requests.

## Review Focus

1. **Corrupted or outdated saved settings** (wrong types, min > max, values out of range): the app starts with valid settings, never crashes. → Task 4, `sanitize` tests.
2. **`localStorage` unavailable or throwing** (private mode): the app works, just without persistence. → Task 3, `storage` tests.
3. **No position fits the settings** (e.g. pawns only with a narrow size range), or the pool is exhausted: the user sees a message and stays on the settings screen. → Task 3, `pickRound` returns `null`; Task 7 handles it.
4. **Clicks and timers arriving in the wrong state** (double click on Ready, a square click during the mask, a countdown firing after Ready): ignored, state unchanged. → Task 5, reducer tests.
5. **`positions.json` fails to load:** an error message with a retry button, not a blank page. → Task 7, manual check with the file renamed.

## File Structure

```
LICENSE
package.json, astro.config.mjs, tsconfig.json, vitest.config.ts
scripts/build-positions.mjs        CSV on stdin → JSON on stdout; exports samplePositions
scripts/build-positions.test.mjs
public/positions.json              generated, committed
src/layouts/Base.astro             page frame, header, nav
src/pages/index.astro              exercise list
src/pages/exercises/missing-piece.astro
src/components/Board.tsx           chessground wrapper
src/lib/storage.ts                 safe localStorage JSON helpers
src/lib/positions.ts               pool loader, target finder, round picker
src/exercises/missing-piece/
  settings.ts, scoring.ts, machine.ts
  MissingPiece.tsx, SettingsPanel.tsx, PiecePicker.tsx
  theme.ts                         Mantine theme
tests live beside sources as *.test.ts
```

---

### Task 1: Project scaffold and app shell

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `src/layouts/Base.astro`, `src/pages/index.astro`

**Interfaces:**
- Produces: `Base.astro` with props `{ title: string }` and a default slot; npm scripts `dev`, `build`, `test` (`vitest run --passWithNoTests`).

- [ ] **Step 1:** `git init`. Create `package.json` by hand (name `aesymnetes`, private, `"type": "module"`, licence as in Global Constraints). The folder is not empty, so do not use `npm create astro`.
- [ ] **Step 2:** Install: `npm install astro @astrojs/react react react-dom @mantine/core @mantine/hooks chessground chessops` and `npm install -D typescript vitest @types/react @types/react-dom`.
- [ ] **Step 3:** Write `astro.config.mjs` (react integration), `tsconfig.json` (extends `astro/tsconfigs/strict`, `jsx: react-jsx`), `vitest.config.ts` (node environment, include `src/**/*.test.ts` and `scripts/**/*.test.mjs`), `.gitignore` (`node_modules`, `dist`, `.astro`).
- [ ] **Step 4:** Write `LICENSE` with the GPL-3.0 text (copy from `node_modules/chessground/LICENSE`).
- [ ] **Step 5:** Write `Base.astro` (html frame, header with the site name linking to `/`, slot) and `index.astro` (a list with one entry, "Missing piece", linking to `/exercises/missing-piece`). Plain Astro and CSS, no React.
- [ ] **Step 6:** Verify. Run `npm run build` — expected: exits 0 and `dist/index.html` exists. Run `npm test` — expected: exits 0.
- [ ] **Step 7:** Commit: `chore: scaffold Astro app shell`.

---

### Task 2: Position data

**Files:**
- Create: `scripts/build-positions.mjs`, `scripts/build-positions.test.mjs`, `public/positions.json`

**Interfaces:**
- Produces: `samplePositions(lines: Iterable<string>, capPerCount: number): { id: string; fen: string; pieces: number }[]`; `public/positions.json` as an array of that shape.

- [ ] **Step 1: Write the failing test** in `scripts/build-positions.test.mjs`:

```js
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KPK = '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1';
const row = (id, fen) => `${id},${fen},e2e4,1500,80,90,100,theme,https://lichess.org/x,`;

test('parses id, fen and piece count, skipping the header and positions under 4 pieces', () => {
  const out = samplePositions(['PuzzleId,FEN,Moves', row('a1', START), row('b2', KPK)], 10);
  expect(out).toEqual([{ id: 'a1', fen: START, pieces: 32 }]);
});
test('caps positions per piece count', () => {
  const out = samplePositions([row('a', START), row('b', START), row('c', START)], 2);
  expect(out.map(p => p.id)).toEqual(['a', 'b']);
});
test('skips rows whose FEN chessops rejects', () => {
  expect(samplePositions([row('bad', 'not a fen')], 10)).toEqual([]);
});
```

- [ ] **Step 2:** Run `npm test` — expected: FAIL, `samplePositions` not exported.
- [ ] **Step 3:** Implement `samplePositions` in `scripts/build-positions.mjs`. Piece count = number of letters in the FEN board field; keep counts 4–32 only; validate with `parseFen` from `chessops/fen`. When the file is run directly, read stdin line by line, call `samplePositions` with cap 140, write JSON to stdout.
- [ ] **Step 4:** Run `npm test` — expected: PASS.
- [ ] **Step 5:** Generate the data. Check `zstd --version`; if missing, `brew install zstd`. Then run:

```bash
curl -sL https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | head -n 300000 | node scripts/build-positions.mjs > public/positions.json
```

Expected: a JSON array of roughly 3,000–4,100 entries. Check the length and the number of distinct `pieces` values with a one-line `node -e`. If any count from 6 to 32 has fewer than 20 entries, raise the `head` limit and re-run.
- [ ] **Step 6:** Commit: `feat: add sampled Lichess positions`.

---

### Task 3: Position picking and storage helpers

**Files:**
- Create: `src/lib/positions.ts`, `src/lib/positions.test.ts`, `src/lib/storage.ts`, `src/lib/storage.test.ts`

**Interfaces:**
- Produces, from `src/lib/positions.ts`:

```ts
export type Color = 'white' | 'black';
export type Role = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Removable = 'any' | 'pieces' | 'pawns';
export interface Position { id: string; fen: string; pieces: number }
export interface Target { square: string; color: Color; role: Role }   // square like 'e4'
export function eligibleTargets(fen: string, removable: Removable): Target[];
export function boardFenWithout(fen: string, square: string): string;   // board field only
export function pickRound(
  pool: readonly Position[],
  filter: { minPieces: number; maxPieces: number; removable: Removable },
  usedIds: ReadonlySet<string>,
  rng?: () => number,            // default Math.random
): { position: Position; target: Target } | null;
export function loadPositions(): Promise<Position[]>;  // fetches `${import.meta.env.BASE_URL}positions.json`, caches the promise, clears the cache on failure
```

- Produces, from `src/lib/storage.ts`: `readJson(key: string): unknown` (returns `null` on a missing key, bad JSON, or a throwing `localStorage`) and `writeJson(key: string, value: unknown): void` (never throws).

- [ ] **Step 1: Write the failing tests.** In `positions.test.ts`, with `START` and `KPK` as in Task 2:

```ts
test('eligibleTargets excludes kings', () => {
  expect(eligibleTargets(START, 'any')).toHaveLength(30);
  expect(eligibleTargets(START, 'pieces')).toHaveLength(14);
  expect(eligibleTargets(START, 'pawns')).toHaveLength(16);
  expect(eligibleTargets(KPK, 'any')).toEqual([{ square: 'e3', color: 'white', role: 'pawn' }]);
  expect(eligibleTargets(KPK, 'pieces')).toEqual([]);
});
test('boardFenWithout removes one piece', () => {
  expect(boardFenWithout(START, 'e2')).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR');
});
const pool = [{ id: 's', fen: START, pieces: 32 }, { id: 'k', fen: KPK, pieces: 3 }];
test('pickRound respects the size range', () => {
  const r = pickRound(pool, { minPieces: 20, maxPieces: 32, removable: 'any' }, new Set());
  expect(r?.position.id).toBe('s');
});
test('pickRound skips used positions and positions with no eligible target', () => {
  expect(pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'pieces' }, new Set(['s']))).toBeNull();
});
test('pickRound returns null when nothing fits', () => {
  expect(pickRound(pool, { minPieces: 10, maxPieces: 12, removable: 'any' }, new Set())).toBeNull();
});
test('pickRound is deterministic for a given rng', () => {
  const r = pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'any' }, new Set(), () => 0);
  expect(r?.position.id).toBe('s');
  expect(eligibleTargets(START, 'any')[0]).toEqual(r?.target);
});
```

In `storage.test.ts`, stub `globalThis.localStorage` with `vi.stubGlobal`:

```ts
test('round-trips JSON', () => { /* writeJson('k', {a:1}); expect(readJson('k')).toEqual({a:1}) */ });
test('readJson returns null for a missing key and for invalid JSON', () => {});
test('readJson returns null and writeJson does not throw when localStorage throws', () => {});
test('both work when localStorage is undefined', () => {});
```

- [ ] **Step 2:** Run `npm test` — expected: FAIL, modules not found.
- [ ] **Step 3:** Implement both modules. Use `parseFen` and `makeBoardFen` from `chessops/fen` and `makeSquare`/`parseSquare` from `chessops/util`; iterate the `Board` to list pieces. `pickRound` filters the pool first (range, unused, at least one eligible target), then picks a position and a target with `rng`.
- [ ] **Step 4:** Run `npm test` — expected: PASS.
- [ ] **Step 5:** Commit: `feat: add position picker and storage helpers`.

---

### Task 4: Settings and scoring

**Files:**
- Create: `src/exercises/missing-piece/settings.ts`, `settings.test.ts`, `scoring.ts`, `scoring.test.ts`

**Interfaces:**
- Consumes: `Removable`, `Color`, `Role`, `Target` from `src/lib/positions.ts`.
- Produces, from `settings.ts`:

```ts
export type Side = 'white' | 'black' | 'random';
export interface Settings {
  memoriseSeconds: number | null;  // null = untimed; otherwise 3–120
  maskMs: number;                  // 0–3000
  minPieces: number;               // 4–32
  maxPieces: number;               // 4–32, >= minPieces
  removable: Removable;
  side: Side;
  coordinates: boolean;
  attempts: number;                // 1–5
  speedBonus: boolean;
  rounds: number;                  // 5–50
}
export type PresetName = 'easy' | 'medium' | 'hard';
export const LIMITS: { memoriseSeconds: [3, 120]; maskMs: [0, 3000]; pieces: [4, 32]; attempts: [1, 5]; rounds: [5, 50] };
export const PRESETS: Record<PresetName, Settings>;
export function matchPreset(s: Settings): PresetName | 'custom';
export function sanitize(raw: unknown): Settings;
```

Preset values:

| | easy | medium | hard |
|---|---|---|---|
| memoriseSeconds | null | 20 | 10 |
| maskMs | 1000 | 1000 | 1000 |
| minPieces–maxPieces | 4–10 | 10–20 | 20–32 |
| removable | any | any | any |
| side | white | random | random |
| coordinates | true | true | false |
| attempts | 3 | 2 | 1 |
| speedBonus | false | false | true |
| rounds | 10 | 10 | 10 |

- Produces, from `scoring.ts`:

```ts
export interface PieceGuess { color: Color; role: Role }
export interface RoundScore { square: number; piece: number; bonus: number; total: number }
export function squarePoints(wrongGuesses: number, attempts: number, revealed: boolean): number;
export function piecePoints(guess: PieceGuess, target: Target): number;
export function speedBonus(elapsedMs: number): number;
export function scoreRound(a: {
  wrongGuesses: number; attempts: number; revealed: boolean;
  guess: PieceGuess; target: Target; elapsedMs: number; speedBonusEnabled: boolean;
}): RoundScore;
```

- [ ] **Step 1: Write the failing tests.**

```ts
// settings.test.ts
test('matchPreset names each preset and reports custom after a change', () => {
  expect(matchPreset(PRESETS.medium)).toBe('medium');
  expect(matchPreset({ ...PRESETS.medium, attempts: 4 })).toBe('custom');
});
test('sanitize returns easy for junk', () => {
  for (const junk of [null, 'x', 42, [], {}]) expect(sanitize(junk)).toEqual(PRESETS.easy);
});
test('sanitize keeps valid settings unchanged', () => {
  expect(sanitize(PRESETS.hard)).toEqual(PRESETS.hard);
});
test('sanitize clamps numbers, rounds them, and repairs min > max', () => {
  const s = sanitize({ ...PRESETS.easy, memoriseSeconds: 999, maskMs: -5, minPieces: 30, maxPieces: 8, attempts: 2.6, rounds: 1000 });
  expect(s).toMatchObject({ memoriseSeconds: 120, maskMs: 0, minPieces: 8, maxPieces: 30, attempts: 3, rounds: 50 });
});
test('sanitize replaces wrong-typed fields with the easy value', () => {
  const s = sanitize({ ...PRESETS.hard, removable: 'queens', side: 5, coordinates: 'yes', memoriseSeconds: 'ten' });
  expect(s).toMatchObject({ removable: 'any', side: 'white', coordinates: true, memoriseSeconds: null });
});

// scoring.test.ts
const target = { square: 'e4', color: 'white', role: 'knight' } as const;
test('squarePoints', () => {
  expect(squarePoints(0, 3, false)).toBe(100);
  expect(squarePoints(1, 3, false)).toBe(67);
  expect(squarePoints(2, 3, false)).toBe(33);
  expect(squarePoints(0, 1, false)).toBe(100);
  expect(squarePoints(3, 3, true)).toBe(0);
});
test('piecePoints', () => {
  expect(piecePoints({ color: 'white', role: 'knight' }, target)).toBe(50);
  expect(piecePoints({ color: 'white', role: 'bishop' }, target)).toBe(25);
  expect(piecePoints({ color: 'black', role: 'knight' }, target)).toBe(25);
  expect(piecePoints({ color: 'black', role: 'bishop' }, target)).toBe(0);
});
test('speedBonus', () => {
  expect([0, 5000, 10000, 20000].map(speedBonus)).toEqual([50, 25, 0, 0]);
});
test('scoreRound adds the bonus only when enabled, not revealed, and the piece is fully right', () => {
  const base = { wrongGuesses: 0, attempts: 2, revealed: false, guess: { color: 'white', role: 'knight' }, target, elapsedMs: 0, speedBonusEnabled: true } as const;
  expect(scoreRound(base)).toEqual({ square: 100, piece: 50, bonus: 50, total: 200 });
  expect(scoreRound({ ...base, speedBonusEnabled: false }).bonus).toBe(0);
  expect(scoreRound({ ...base, wrongGuesses: 2, revealed: true })).toEqual({ square: 0, piece: 50, bonus: 0, total: 50 });
  expect(scoreRound({ ...base, guess: { color: 'black', role: 'knight' } }).bonus).toBe(0);
});
```

- [ ] **Step 2:** Run `npm test` — expected: FAIL.
- [ ] **Step 3:** Implement both modules. `squarePoints` is `Math.round(100 * (attempts - wrongGuesses) / attempts)`, zero if revealed. `speedBonus` is `Math.round(50 * Math.max(0, 1 - elapsedMs / 10000))`.
- [ ] **Step 4:** Run `npm test` — expected: PASS.
- [ ] **Step 5:** Commit: `feat: add settings, presets and scoring`.

---

### Task 5: Exercise state machine

**Files:**
- Create: `src/exercises/missing-piece/machine.ts`, `machine.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 4), `Position`, `Target`, `Color` (Task 3), `PieceGuess`, `RoundScore`, `scoreRound` (Task 4).
- Produces:

```ts
export type Phase = 'idle' | 'memorise' | 'mask' | 'guessSquare' | 'guessPiece' | 'result' | 'summary';
export interface NewRound { position: Position; target: Target; orientation: Color }
export interface Round extends NewRound {
  wrongSquares: string[];
  revealed: boolean;
  guessStartedAt: number | null;
  guess: PieceGuess | null;
  score: RoundScore | null;
}
export interface State {
  phase: Phase;
  settings: Settings;
  round: Round | null;
  roundIndex: number;        // 0-based
  history: Round[];          // finished rounds of this session
  usedIds: string[];
}
export type Action =
  | { type: 'setSettings'; settings: Settings }
  | { type: 'start'; round: NewRound }
  | { type: 'ready'; now: number }
  | { type: 'maskDone'; now: number }
  | { type: 'clickSquare'; square: string }
  | { type: 'submitPiece'; guess: PieceGuess; now: number }
  | { type: 'next'; round: NewRound | null }
  | { type: 'quit' };
export function initialState(settings: Settings): State;
export function reduce(state: State, action: Action): State;
export function sessionTotal(state: State): number;
```

Transitions (anything not listed returns the same state object):

| Phase | Action | Result |
|---|---|---|
| idle, summary | setSettings | settings replaced |
| idle, summary | start | memorise; round 0; history and usedIds reset, then the position id added |
| memorise | ready | `mask` if `maskMs > 0`, else `guessSquare` with `guessStartedAt = now` |
| mask | maskDone | guessSquare, `guessStartedAt = now` |
| guessSquare | clickSquare, right square | guessPiece |
| guessSquare | clickSquare, wrong, already in `wrongSquares` | unchanged |
| guessSquare | clickSquare, wrong, new | appended; if `wrongSquares.length === settings.attempts` then `revealed = true` and guessPiece |
| guessPiece | submitPiece | result; `guess` and `score` set via `scoreRound` with `elapsedMs = now - guessStartedAt` |
| result | next | round pushed to history; `summary` if `roundIndex + 1 >= settings.rounds` or `round === null`; otherwise memorise with the new round, `roundIndex + 1`, id added to usedIds |
| any | quit | `initialState(state.settings)` |

- [ ] **Step 1: Write the failing tests** in `machine.test.ts`. Build helpers `nr(id)` returning a `NewRound` with target `{ square: 'e4', color: 'white', role: 'knight' }`, and `play(state, ...actions)` folding `reduce`. One test per row of the table, plus:

```ts
test('full correct round on medium scores 150', () => {
  const s = play(initialState(PRESETS.medium), { type: 'start', round: nr('a') }, { type: 'ready', now: 0 },
    { type: 'maskDone', now: 1000 }, { type: 'clickSquare', square: 'e4' },
    { type: 'submitPiece', guess: { color: 'white', role: 'knight' }, now: 4000 });
  expect(s.phase).toBe('result');
  expect(s.round?.score?.total).toBe(150);
});
test('attempts exhausted reveals the square and still asks for the piece', () => {
  // hard preset (1 attempt): clickSquare 'a1' → phase guessPiece, revealed true
});
test('maskMs 0 skips the mask', () => {});
test('session ends after settings.rounds rounds', () => {
  // rounds: 5 → after the 5th 'next', phase summary, history length 5, sessionTotal = sum of totals
});
test('next with a null round ends the session early', () => {});
test('out-of-phase actions return the same state object', () => {
  // ready in idle; second ready in mask; clickSquare in memorise and mask; maskDone in guessSquare;
  // submitPiece in guessSquare; start in memorise; setSettings in memorise; next in guessPiece
  // each: expect(reduce(s, a)).toBe(s)
});
test('quit returns to idle and keeps settings', () => {});
```

- [ ] **Step 2:** Run `npm test` — expected: FAIL.
- [ ] **Step 3:** Implement `machine.ts` as a `switch` on `action.type` guarded by phase. No `Date.now()`, no `Math.random()`.
- [ ] **Step 4:** Run `npm test` — expected: PASS.
- [ ] **Step 5:** Commit: `feat: add missing-piece state machine`.

---

### Task 6: Board component

**Files:**
- Create: `src/components/Board.tsx`

**Interfaces:**
- Produces:

```ts
export interface BoardProps {
  fen: string;                                   // board FEN or full FEN
  orientation: 'white' | 'black';
  coordinates: boolean;
  hidden?: boolean;                              // true during the mask: no pieces visible
  marks?: Record<string, 'wrong' | 'answer'>;    // square → mark
  onSquareClick?: (square: string) => void;      // absent = clicks ignored
}
export default function Board(props: BoardProps): JSX.Element;
```

- [ ] **Step 1:** Implement. Create the chessground instance once in an effect on a ref'd div and destroy it on unmount; push prop changes with `api.set(...)`. Import `chessground/assets/chessground.base.css`, `chessground.brown.css`, `chessground.cburnett.css`. Config: no dragging, no moves, no selection highlight, animation off (a removed piece must not fade out). Report clicks through `events.select`; if that does not fire with moves disabled, use a click listener on the wrapper and `api.getKeyAtDomPos`. Render marks with chessground's custom square highlight classes and two CSS classes (`wrong`, `answer`). When `hidden`, show the empty board (`fen` `8/8/8/8/8/8/8/8`). The wrapper is a square sized `min(100%, 560px)` and stays square at 360 px.
- [ ] **Step 2:** Verify in the browser. Add a temporary page `src/pages/board-check.astro` mounting `Board` with `client:only="react"`, the start position, marks on `e4` (wrong) and `d5` (answer), and an `onSquareClick` that logs. Run `npm run dev` and check: pieces render, both marks show, a click logs the right square for both orientations, pieces cannot be dragged, layout holds at 360 px. Delete the temporary page.
- [ ] **Step 3:** Run `npm run build` — expected: exits 0.
- [ ] **Step 4:** Commit: `feat: add chessground board component`.

---

### Task 7: Exercise UI

**Files:**
- Create: `src/exercises/missing-piece/MissingPiece.tsx`, `SettingsPanel.tsx`, `PiecePicker.tsx`, `theme.ts`, `src/pages/exercises/missing-piece.astro`
- Modify: `src/layouts/Base.astro` (styling to match the theme)

**Interfaces:**
- Consumes: everything produced by Tasks 3–6.
- Produces:

```ts
// SettingsPanel.tsx
export default function SettingsPanel(p: { settings: Settings; onChange: (s: Settings) => void }): JSX.Element;
// PiecePicker.tsx
export default function PiecePicker(p: { onSubmit: (g: PieceGuess) => void }): JSX.Element;
// MissingPiece.tsx
export default function MissingPiece(): JSX.Element;   // includes its own MantineProvider
```

- [ ] **Step 1:** Load the `frontend-design:frontend-design` skill and settle the visual direction within the Global Constraints: a quiet, tool-like look, the board as the centre, its own typeface and a restrained palette. Write `theme.ts`.
- [ ] **Step 2:** `SettingsPanel`: a preset control (Easy / Medium / Hard / Custom, value from `matchPreset`; picking a preset calls `onChange(PRESETS[name])`; Custom is selectable only by editing) and one control per `Settings` field using `LIMITS`: untimed switch plus seconds slider, mask slider, range slider for pieces, segmented controls for removable and side, switches for coordinates and speed bonus, number inputs for attempts and rounds.
- [ ] **Step 3:** `PiecePicker`: a white/black toggle, six piece-type buttons showing the piece image in the chosen colour (king included, so the picker does not leak the rule), and a Confirm button enabled once a type is chosen.
- [ ] **Step 4:** `MissingPiece`: `useReducer(reduce, …)` with initial settings from `sanitize(readJson(settingsKey))`. Behaviour per phase:
  - **idle:** `SettingsPanel`, best score for the current preset, Start. Settings changes dispatch `setSettings` and are saved with `writeJson`. Start awaits `loadPositions()`, calls `pickRound`, resolves `orientation` (`random` → coin flip), dispatches `start`. If `pickRound` returns `null`, show "No position fits these settings." If loading fails, show an error with a Retry button.
  - **memorise:** full position; countdown when `memoriseSeconds` is set; Ready button. One effect owns the timer and clears it on phase change, so Ready and the timeout cannot both fire.
  - **mask:** `Board hidden`; a timeout of `maskMs` dispatches `maskDone`.
  - **guessSquare:** `boardFenWithout(fen, target.square)`; `onSquareClick` dispatches `clickSquare`; wrong squares marked; attempts left shown.
  - **guessPiece:** target square marked `answer`; `PiecePicker`.
  - **result:** full position, target marked; points for square, piece and bonus; link "View on Lichess" to `https://lichess.org/training/{id}`; Next button picks the next round (`null` if the pool is exhausted) and dispatches `next`.
  - **summary:** total, per-round table, best score for the preset (updated and saved when beaten; not for custom), Play again.
  - Round counter, running score and a Quit control are visible from memorise through result. `Date.now()` and `Math.random()` are called only here.
- [ ] **Step 5:** `missing-piece.astro`: `Base` layout with `<MissingPiece client:only="react" />`. Import `@mantine/core/styles.css` in `MissingPiece.tsx`. Board beside the controls from 900 px up, stacked below that.
- [ ] **Step 6:** Run `npm test` and `npm run build` — expected: both exit 0.
- [ ] **Step 7:** Manual run-through with `npm run dev`:
  - Play a full session on each preset; confirm the scores shown match the scoring rules for one right-first-time round and one revealed round.
  - Change a setting → the preset shows Custom; reload → settings restored.
  - Set `aesymnetes:missing-piece:settings` to `"garbage"` in dev tools, reload → Easy loads.
  - Pawns only with size 4–4 → the "no position fits" message appears, or a round starts with a pawn target.
  - Temporarily rename `public/positions.json` → error and Retry appear; restore it → Retry works.
  - Click Ready twice quickly and click squares during the mask → nothing breaks.
  - 360 px width and dark mode both look right.
- [ ] **Step 8:** Commit: `feat: add missing-piece exercise`.
