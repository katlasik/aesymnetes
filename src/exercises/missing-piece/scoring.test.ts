import { expect, test } from 'vitest';
import { piecePoints, scoreRound, speedBonus, squarePoints } from './scoring';

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
  const base = {
    wrongGuesses: 0,
    attempts: 2,
    revealed: false,
    guess: { color: 'white', role: 'knight' },
    target,
    elapsedMs: 0,
    speedBonusEnabled: true,
  } as const;
  expect(scoreRound(base)).toEqual({ square: 100, piece: 50, bonus: 50, total: 200 });
  expect(scoreRound({ ...base, speedBonusEnabled: false }).bonus).toBe(0);
  expect(scoreRound({ ...base, wrongGuesses: 2, revealed: true })).toEqual({
    square: 0,
    piece: 50,
    bonus: 0,
    total: 50,
  });
  expect(scoreRound({ ...base, guess: { color: 'black', role: 'knight' } }).bonus).toBe(0);
});
