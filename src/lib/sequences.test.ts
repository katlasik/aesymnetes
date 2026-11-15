import { expect, test } from 'vitest';
import { pickSequence, replayable, type Sequence } from './sequences';

// A real opening line from the start position, used as a stand-in sequence.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LINE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
const seq = (id: string, pieces: number, moves = LINE): Sequence => ({ id, gameId: id, ply: 20, fen: START, moves, pieces });

test('replayable accepts a legal line and rejects an illegal one', () => {
  expect(replayable(seq('a', 32))).toBe(true);
  expect(replayable(seq('b', 32, ['e2e4', 'e2e4']))).toBe(false);
  expect(replayable({ ...seq('c', 32), fen: 'not a fen' })).toBe(false);
});

const range = { minPieces: 4, maxPieces: 32 };

test('pickSequence respects the piece-count range and skips used ones', () => {
  const pool = [seq('a', 10), seq('b', 20)];
  expect(pickSequence(pool, { minPieces: 15, maxPieces: 32 }, new Set())?.id).toBe('b');
  expect(pickSequence(pool, range, new Set(['a', 'b']))).toBeNull();
});

test('pickSequence follows the easiest-to-hardest order when given a step', () => {
  const pool = [seq('few', 4), seq('mid', 18), seq('many', 32)];
  expect(pickSequence(pool, range, new Set(), () => 0.99, { index: 0, total: 3 })?.id).toBe('few');
  expect(pickSequence(pool, range, new Set(), () => 0.99, { index: 1, total: 3 })?.id).toBe('mid');
  expect(pickSequence(pool, range, new Set(), () => 0, { index: 2, total: 3 })?.id).toBe('many');
});

test('pickSequence skips a sequence whose moves do not replay', () => {
  const pool = [seq('broken', 4, ['e2e5']), seq('fine', 6)];
  expect(pickSequence(pool, range, new Set(), () => 0, { index: 0, total: 3 })?.id).toBe('fine');
});
