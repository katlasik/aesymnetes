import { expect, type Page } from '@playwright/test';

/**
 * Shared setup for the end-to-end tests.
 *
 * The real position and sequence pools are random, so the tests swap them for small fixtures
 * whose answers are known. Time runs on Playwright's clock, so countdowns can be skipped.
 */

/**
 * Missing piece and Hanging pieces share the position pool; their piece-count settings keep
 * them apart.
 *
 * Missing piece (4 pieces): kings, a rook and a pawn. With "pawns only", the pawn on e2 is always
 * the missing piece. Nothing hangs, so Hanging pieces never picks these.
 *
 * Hanging pieces (5 pieces): the black knight on a5 is attacked by the rook on a1 and not
 * defended. It is the only hanging piece.
 */
const MISSING_PIECE_FEN = '4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1';
const HANGING_PIECES_FEN = '4k3/8/8/n7/8/8/7P/R3K3 w - - 0 1';
export const POSITIONS = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `missing${i}`, fen: MISSING_PIECE_FEN, pieces: 4 })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `hanging${i}`, fen: HANGING_PIECES_FEN, pieces: 5 })),
];

/** 1. e4 e5 from the starting position. */
export const SEQUENCES = Array.from({ length: 5 }, (_, i) => ({
  id: `fixture-${i}`,
  gameId: 'fixture',
  ply: 0,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
  pieces: 32,
}));

export const MISSING_PIECE_SETTINGS = {
  memoriseSeconds: 3,
  guessSeconds: 5,
  maskMs: 0,
  minPieces: 4,
  maxPieces: 4,
  removable: 'pawns',
  side: 'white',
  coordinates: true,
  attempts: 2,
  speedBonus: false,
  rounds: 5,
};

export const REPEAT_MOVES_SETTINGS = {
  movesPerSide: 1,
  lookSeconds: 0,
  moveMs: 500,
  side: 'white',
  coordinates: true,
  rounds: 5,
  minPieces: 4,
  maxPieces: 32,
};

export const HANGING_PIECES_SETTINGS = {
  seconds: 10,
  minPieces: 5,
  maxPieces: 5,
  side: 'white',
  coordinates: true,
  rounds: 5,
};

/** Fixture data, short settings and a controllable clock. Call before the first `goto`. */
export async function prepare(page: Page) {
  await page.clock.install();
  await page.route('**/positions.json', (route) => route.fulfill({ json: POSITIONS }));
  await page.route('**/sequences.json', (route) => route.fulfill({ json: SEQUENCES }));
  const settings = {
    'aesymnetes:missing-piece:settings': MISSING_PIECE_SETTINGS,
    'aesymnetes:repeat-moves:settings': REPEAT_MOVES_SETTINGS,
    'aesymnetes:hanging-pieces:settings': HANGING_PIECES_SETTINGS,
  };
  await page.addInitScript((entries) => {
    // Only on the first load of a test, so a reload keeps whatever the page saved.
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, Object.entries(settings).map(([k, v]) => [k, JSON.stringify(v)]));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { errors };
}

/** Clicks the middle of `square` on the board, whichever side is at the bottom. */
export async function clickSquare(page: Page, square: string) {
  const wrap = page.locator('.cg-wrap').filter({ has: page.locator('cg-board') });
  const flipped = ((await wrap.getAttribute('class')) ?? '').includes('orientation-black');
  const box = await page.locator('cg-board').boundingBox();
  if (!box) throw new Error('board not visible');
  const size = box.width / 8;
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  await page.mouse.click(box.x + size * (col + 0.5), box.y + size * (row + 0.5));
}

/** Plays a move by clicking its two squares. */
export async function playMove(page: Page, uci: string) {
  await clickSquare(page, uci.slice(0, 2));
  await clickSquare(page, uci.slice(2, 4));
}

/** One Missing piece position: wait out the memorise time, find e2, name the piece. */
export async function answerMissingPiece(page: Page, piece = 'white pawn') {
  await expect(page.getByRole('timer', { name: 'Seconds left to memorise' })).toBeVisible();
  await page.clock.fastForward(MISSING_PIECE_SETTINGS.memoriseSeconds * 1000);
  await expect(page.getByText('One piece is gone. Click the square it stood on.')).toBeVisible();
  await clickSquare(page, 'e2');
  const picker = page.getByRole('dialog', { name: 'Yes, e2. Which piece was it?' });
  await picker.getByRole('button', { name: piece, exact: true }).click();
  await picker.getByRole('button', { name: 'Confirm piece' }).click();
  await expect(picker).toBeHidden();
}

/** One Repeat the moves round, replaying 1. e4 e5 correctly. */
export async function answerRepeatMoves(page: Page) {
  await expect(page.getByText('Play the moves again. White to move.')).toBeVisible();
  await playMove(page, 'e2e4');
  await expect(page.getByText('Play the moves again. Black to move.')).toBeVisible();
  await playMove(page, 'e7e5');
  await expect(page.getByRole('status')).toHaveText('Correct: all 2 moves.');
}

/** One Hanging pieces position, answered right: pick the knight on a5, then Done. */
export async function answerHangingPieces(page: Page) {
  await expect(page.getByText('0 pieces picked.')).toBeVisible();
  await clickSquare(page, 'a5');
  await expect(page.getByText('1 piece picked.')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Correct: the one hanging piece.');
}

/** The button that leaves a result: "Next position" or, after the last one, "See summary". */
export function nextButton(page: Page) {
  return page.getByRole('button', { name: /^(Next position|See summary)/ });
}

/** Fails if the page scrolls sideways. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
