import { makeBoardFen, parseFen } from 'chessops/fen';
import { makeSquare, parseSquare } from 'chessops/util';

export type Color = 'white' | 'black';
export type Role = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Removable = 'any' | 'pieces' | 'pawns';

export interface Position {
  /** Lichess puzzle id. */
  id: string;
  fen: string;
  /** Number of pieces on the board, kings included. */
  pieces: number;
}

export interface Target {
  /** Algebraic square name, e.g. "e4". */
  square: string;
  color: Color;
  role: Role;
}

function removableRole(role: Role, removable: Removable): boolean {
  if (role === 'king') return false;
  if (removable === 'pawns') return role === 'pawn';
  if (removable === 'pieces') return role !== 'pawn';
  return true;
}

/** Pieces that may be removed from the position. Kings never qualify. */
export function eligibleTargets(fen: string, removable: Removable): Target[] {
  const setup = parseFen(fen);
  if (setup.isErr) return [];
  const targets: Target[] = [];
  for (const [square, piece] of setup.value.board) {
    if (removableRole(piece.role, removable)) {
      targets.push({ square: makeSquare(square), color: piece.color, role: piece.role });
    }
  }
  return targets;
}

/** The board field of the FEN with the piece on `square` taken off. */
export function boardFenWithout(fen: string, square: string): string {
  const board = parseFen(fen).unwrap().board.clone();
  const sq = parseSquare(square);
  if (sq !== undefined) board.take(sq);
  return makeBoardFen(board);
}

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/** Where a position falls in a session: the 0-based index and the number of positions. */
export interface Step {
  index: number;
  total: number;
}

/**
 * The piece count a session's position should have, so that positions get harder (more pieces)
 * evenly from the fewest pieces in the range to the most.
 */
export function targetPieces(range: { minPieces: number; maxPieces: number }, step: Step): number {
  if (step.total <= 1) return range.minPieces;
  const share = Math.min(1, Math.max(0, step.index / (step.total - 1)));
  return Math.round(range.minPieces + share * (range.maxPieces - range.minPieces));
}

/**
 * Picks an unused position that fits the filter, and a piece to remove from it.
 * With a `step`, it picks among the positions whose piece count is closest to the step's target.
 */
export function pickRound(
  pool: readonly Position[],
  filter: { minPieces: number; maxPieces: number; removable: Removable },
  usedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
  step?: Step,
): { position: Position; target: Target } | null {
  let candidates = pool.filter(
    (p) =>
      p.pieces >= filter.minPieces &&
      p.pieces <= filter.maxPieces &&
      !usedIds.has(p.id) &&
      eligibleTargets(p.fen, filter.removable).length > 0,
  );
  if (candidates.length === 0) return null;
  if (step) {
    const target = targetPieces(filter, step);
    const distance = (p: Position) => Math.abs(p.pieces - target);
    const nearest = Math.min(...candidates.map(distance));
    candidates = candidates.filter((p) => distance(p) === nearest);
  }
  const position = pickFrom(candidates, rng);
  const target = pickFrom(eligibleTargets(position.fen, filter.removable), rng);
  return { position, target };
}

let poolPromise: Promise<Position[]> | null = null;

/** Loads the bundled position pool once. A failed load can be retried. */
export function loadPositions(): Promise<Position[]> {
  poolPromise ??= fetch(`${import.meta.env.BASE_URL}positions.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load positions (HTTP ${res.status})`);
      return res.json() as Promise<Position[]>;
    })
    .catch((err: unknown) => {
      poolPromise = null;
      throw err;
    });
  return poolPromise;
}
