import { describe, expect, it } from 'vitest';
import { hangingPieces, pickableSquares, pickPosition } from './hanging';

const squares = (fen: string) => hangingPieces(fen).map((h) => h.square);

describe('hangingPieces', () => {
  it('finds an attacked, undefended piece', () => {
    // White rook a1 attacks the black knight a8; nothing defends it.
    expect(hangingPieces('n6k/8/8/8/8/8/8/R6K w - - 0 1')).toEqual([{ square: 'a8', attacker: 'a1' }]);
  });

  it('ignores a defended piece', () => {
    // The black rook b8 defends the knight a8.
    expect(squares('nr5k/8/8/8/8/8/8/R6K w - - 0 1')).toEqual([]);
  });

  it('finds pieces of both colours', () => {
    // Rook a1 hits knight a8, and bishop h8 (black) hits the white rook a1 along the long diagonal.
    expect(squares('n6b/8/8/8/8/8/8/R3K2k w - - 0 1')).toEqual(['a1', 'a8']);
  });

  it('never counts kings', () => {
    expect(squares('k7/8/8/8/8/8/8/R6K w - - 0 1')).toEqual([]);
  });

  it('does not see through pieces', () => {
    // The white pawn a4 blocks the rook a1 from the knight a8; the pawn itself is not attacked.
    expect(squares('n6k/8/8/8/P7/8/8/R6K w - - 0 1')).toEqual([]);
  });

  it('counts the king as a defender against one attacker only', () => {
    // Knight g7 is next to the black king h8. One white attacker: defended.
    expect(squares('7k/6n1/8/8/8/8/8/6RK w - - 0 1')).toEqual([]);
    // Two white attackers (rook g1 and bishop a1): the king cannot take back, so it hangs.
    expect(squares('7k/6n1/8/8/8/8/8/B5RK w - - 0 1')).toEqual(['g7']);
  });

  it('names the cheapest attacker', () => {
    // Black rook e5 attacked by the white pawn d4 and the white queen h2.
    expect(hangingPieces('7k/8/8/4r3/3P4/8/7Q/7K w - - 0 1')).toEqual([{ square: 'e5', attacker: 'd4' }]);
  });
});

describe('pickableSquares', () => {
  it('lists squares that hold a piece other than a king', () => {
    expect([...pickableSquares('n6k/8/8/8/8/8/8/R6K w - - 0 1')].sort()).toEqual(['a1', 'a8']);
  });
});

describe('pickPosition', () => {
  const pool = [
    { id: 'none', fen: 'nr5k/8/8/8/8/8/8/R6K w - - 0 1', pieces: 4 },
    { id: 'one', fen: 'n6k/8/8/8/8/8/8/R6K w - - 0 1', pieces: 4 },
    { id: 'big', fen: 'n6k/8/8/8/8/8/8/R6K w - - 0 1', pieces: 20 },
  ];

  it('skips positions with no hanging piece, used ones, and those outside the range', () => {
    expect(pickPosition(pool, { minPieces: 4, maxPieces: 10 }, new Set())?.id).toBe('one');
    expect(pickPosition(pool, { minPieces: 4, maxPieces: 10 }, new Set(['one']))).toBeNull();
  });

  it('follows the step towards more pieces', () => {
    const range = { minPieces: 4, maxPieces: 20 };
    expect(pickPosition(pool, range, new Set(), Math.random, { index: 0, total: 2 })?.id).toBe('one');
    expect(pickPosition(pool, range, new Set(), Math.random, { index: 1, total: 2 })?.id).toBe('big');
  });
});
