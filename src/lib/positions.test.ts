import { expect, test } from 'vitest';
import { boardFenWithout, eligibleTargets, pickRound } from './positions';

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

test('pickRound stays in range when rng returns its upper edge', () => {
  const r = pickRound(pool, { minPieces: 3, maxPieces: 32, removable: 'any' }, new Set(), () => 0.999999);
  expect(r?.position.id).toBe('k');
  expect(r?.target.square).toBe('e3');
});
