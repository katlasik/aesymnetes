import { expect, test } from 'vitest';
import { boardFenWithout, eligibleTargets, pickRound, targetPieces } from './positions';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KPK = '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1';

test('eligibleTargets excludes kings', () => {
  expect(eligibleTargets(START, 'any')).toHaveLength(30);
  expect(eligibleTargets(START, 'pieces')).toHaveLength(14);
  expect(eligibleTargets(START, 'pawns')).toHaveLength(16);
  expect(eligibleTargets(KPK, 'any')).toEqual([{ square: 'e3', color: 'white', role: 'pawn' }]);
  expect(eligibleTargets(KPK, 'pieces')).toEqual([]);
});

test('eligibleTargets returns nothing for an invalid FEN', () => {
  expect(eligibleTargets('not a fen', 'any')).toEqual([]);
});

test('boardFenWithout removes one piece', () => {
  expect(boardFenWithout(START, 'e2')).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR');
});

const pool = [
  { id: 's', fen: START, pieces: 32 },
  { id: 'k', fen: KPK, pieces: 3 },
];

test('pickRound respects the size range', () => {
  const r = pickRound(pool, { minPieces: 20, maxPieces: 32, removable: 'any' }, new Set());
  expect(r?.position.id).toBe('s');
});

test('pickRound skips used positions and positions with no eligible target', () => {
  expect(
    pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'pieces' }, new Set(['s'])),
  ).toBeNull();
});

test('pickRound returns null when nothing fits', () => {
  expect(pickRound(pool, { minPieces: 10, maxPieces: 12, removable: 'any' }, new Set())).toBeNull();
});

test('pickRound is deterministic for a given rng', () => {
  const r = pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'any' }, new Set(), () => 0);
  expect(r?.position.id).toBe('s');
  expect(eligibleTargets(START, 'any')[0]).toEqual(r?.target);
});

test('targetPieces climbs evenly from the fewest pieces to the most over a session', () => {
  const range = { minPieces: 4, maxPieces: 10 };
  expect([0, 1, 2, 3, 4, 5, 6].map((i) => targetPieces(range, { index: i, total: 7 }))).toEqual([4, 5, 6, 7, 8, 9, 10]);
  expect(targetPieces(range, { index: 0, total: 10 })).toBe(4);
  expect(targetPieces(range, { index: 9, total: 10 })).toBe(10);
  expect(targetPieces(range, { index: 0, total: 1 })).toBe(4);
  expect(targetPieces({ minPieces: 6, maxPieces: 6 }, { index: 3, total: 10 })).toBe(6);
});

test('targetPieces never goes down from one position to the next', () => {
  const range = { minPieces: 20, maxPieces: 32 };
  const t = Array.from({ length: 50 }, (_, i) => targetPieces(range, { index: i, total: 50 }));
  for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]!);
});

const byCount = (n: number, id = `p${n}`) => ({ id, fen: START, pieces: n });

test('pickRound with a step picks a position with the target piece count', () => {
  const graded = [byCount(4), byCount(7), byCount(10)];
  const filter = { minPieces: 4, maxPieces: 10, removable: 'any' as const };
  expect(pickRound(graded, filter, new Set(), () => 0.99, { index: 0, total: 3 })?.position.id).toBe('p4');
  expect(pickRound(graded, filter, new Set(), () => 0.99, { index: 1, total: 3 })?.position.id).toBe('p7');
  expect(pickRound(graded, filter, new Set(), () => 0, { index: 2, total: 3 })?.position.id).toBe('p10');
});

test('pickRound with a step falls back to the nearest piece count', () => {
  const graded = [byCount(4), byCount(9)];
  const filter = { minPieces: 4, maxPieces: 10, removable: 'any' as const };
  expect(pickRound(graded, filter, new Set(), () => 0, { index: 2, total: 3 })?.position.id).toBe('p9');
  expect(pickRound(graded, filter, new Set(['p9']), () => 0, { index: 2, total: 3 })?.position.id).toBe('p4');
});

test('pickRound stays in range when rng returns its upper edge', () => {
  const r = pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'any' }, new Set(), () => 0.999999);
  expect(r?.position.id).toBe('k');
  expect(r?.target.square).toBe('e3');
});
