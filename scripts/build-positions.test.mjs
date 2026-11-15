import { expect, test } from 'vitest';
import { samplePositions } from './build-positions.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KPK = '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1';
const row = (id, fen) => `${id},${fen},e2e4,1500,80,90,100,theme,https://lichess.org/x,`;

test('parses id, fen and piece count, skipping the header and positions under 4 pieces', () => {
  const out = samplePositions(['PuzzleId,FEN,Moves', row('a1', START), row('b2', KPK)], 10);
  expect(out).toEqual([{ id: 'a1', fen: START, pieces: 32 }]);
});

test('caps positions per piece count', () => {
  const out = samplePositions([row('a', START), row('b', START), row('c', START)], 2);
  expect(out.map((p) => p.id)).toEqual(['a', 'b']);
});

test('skips rows whose FEN chessops rejects', () => {
  expect(samplePositions([row('bad', 'not a fen')], 10)).toEqual([]);
});
