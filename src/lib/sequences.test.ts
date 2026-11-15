import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { expect, test } from 'vitest';
import { displaySquares, pickSequence, replayable, userMoveUci, type Sequence } from './sequences';

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
  expect(pickSequence(pool, range, new Set(), () => 0.99, { index: 0, total: 3 }, 1)?.id).toBe('few');
  expect(pickSequence(pool, range, new Set(), () => 0.99, { index: 1, total: 3 }, 1)?.id).toBe('mid');
  expect(pickSequence(pool, range, new Set(), () => 0, { index: 2, total: 3 }, 1)?.id).toBe('many');
});

const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const castlingPos = () => Chess.fromSetup(parseFen(CASTLING).unwrap()).unwrap();

test('userMoveUci writes castling the way the data stores it, whichever square the king is dropped on', () => {
  expect(userMoveUci(castlingPos(), 'e1', 'g1')).toBe('e1h1');
  expect(userMoveUci(castlingPos(), 'e1', 'h1')).toBe('e1h1');
  expect(userMoveUci(castlingPos(), 'e1', 'c1')).toBe('e1a1');
  expect(userMoveUci(castlingPos(), 'a1', 'a5')).toBe('a1a5');
});

test('displaySquares shows castling as the king moving two squares', () => {
  expect(displaySquares(castlingPos(), 'e1h1')).toEqual(['e1', 'g1']);
  expect(displaySquares(castlingPos(), 'e1a1')).toEqual(['e1', 'c1']);
  expect(displaySquares(castlingPos(), 'a1a5')).toEqual(['a1', 'a5']);
});

test('pickSequence widens a thin piece count to at least minChoices nearby sequences', () => {
  const pool = [seq('five', 5), ...Array.from({ length: 30 }, (_, i) => seq(`seven${i}`, 7))];
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const r = (i + 0.5) / 40;
    picks.add(pickSequence(pool, range, new Set(), () => r, { index: 0, total: 10 }, 20)!.id);
  }
  expect(picks.size).toBeGreaterThan(10);
  // With a single exact match allowed, the order stays strict.
  expect(pickSequence(pool, range, new Set(), () => 0.99, { index: 0, total: 10 }, 1)?.id).toBe('five');
});

test('pickSequence skips a sequence whose moves do not replay', () => {
  const pool = [seq('broken', 4, ['e2e5']), seq('fine', 6)];
  expect(pickSequence(pool, range, new Set(), () => 0, { index: 0, total: 3 }, 1)?.id).toBe('fine');
});
