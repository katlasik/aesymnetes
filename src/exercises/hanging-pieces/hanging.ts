import { attacks } from 'chessops/attacks';
import type { Board } from 'chessops/board';
import { parseFen } from 'chessops/fen';
import { makeSquare, opposite } from 'chessops/util';
import type { Color, Role, Square } from 'chessops/types';
import { targetPieces, type Position, type Step } from '../../lib/positions';

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };

export interface Hanging {
  /** Square of the hanging piece. */
  square: string;
  /** Square of its cheapest attacker, to draw an arrow from. */
  attacker: string;
}

/** Squares holding pieces of `color` that attack `target`, by direct line of sight (no x-rays). */
function attackersOf(board: Board, target: Square, color: Color): Square[] {
  const found: Square[] = [];
  for (const sq of board[color]) {
    const piece = board.get(sq)!;
    if (attacks(piece, sq, board.occupied).has(target)) found.push(sq);
  }
  return found;
}

/**
 * The hanging pieces in a position, of both colours: pieces other than kings that the opponent
 * attacks and that no piece of their own defends.
 *
 * A king defends only when a single enemy piece attacks the square: against two, it could not
 * take back. Pins and x-rays are not looked at.
 */
export function hangingPieces(fen: string): Hanging[] {
  const setup = parseFen(fen);
  if (setup.isErr) return [];
  const board = setup.value.board;
  const result: Hanging[] = [];
  for (const [sq, piece] of board) {
    if (piece.role === 'king') continue;
    const enemies = attackersOf(board, sq, opposite(piece.color));
    if (enemies.length === 0) continue;
    const defenders = attackersOf(board, sq, piece.color).filter(
      (d) => board.get(d)!.role !== 'king' || enemies.length === 1,
    );
    if (defenders.length > 0) continue;
    const cheapest = enemies.reduce((a, b) => (VALUE[board.get(b)!.role] < VALUE[board.get(a)!.role] ? b : a));
    result.push({ square: makeSquare(sq), attacker: makeSquare(cheapest) });
  }
  return result.sort((a, b) => a.square.localeCompare(b.square));
}

/** Squares the user may pick: those with a piece other than a king. */
export function pickableSquares(fen: string): Set<string> {
  const setup = parseFen(fen);
  if (setup.isErr) return new Set();
  const board = setup.value.board;
  return new Set([...board.occupied.diff(board.king)].map(makeSquare));
}

const counts = new Map<string, number>();

function hangingCount(p: Position): number {
  let n = counts.get(p.id);
  if (n === undefined) {
    n = hangingPieces(p.fen).length;
    counts.set(p.id, n);
  }
  return n;
}

export const MAX_HANGING = 4;

/**
 * Picks an unused position in the piece range with 1 to MAX_HANGING hanging pieces.
 * With a `step`, it picks among the positions whose piece count is closest to the step's target.
 */
export function pickPosition(
  pool: readonly Position[],
  filter: { minPieces: number; maxPieces: number },
  usedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
  step?: Step,
): Position | null {
  let candidates = pool.filter((p) => {
    if (p.pieces < filter.minPieces || p.pieces > filter.maxPieces || usedIds.has(p.id)) return false;
    const n = hangingCount(p);
    return n >= 1 && n <= MAX_HANGING;
  });
  if (candidates.length === 0) return null;
  if (step) {
    const target = targetPieces(filter, step);
    const distance = (p: Position) => Math.abs(p.pieces - target);
    const nearest = Math.min(...candidates.map(distance));
    candidates = candidates.filter((p) => distance(p) === nearest);
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]!;
}
