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

/** Picks an unused position that fits the filter, and a piece to remove from it. */
export function pickRound(
  pool: readonly Position[],
  filter: { minPieces: number; maxPieces: number; removable: Removable },
  usedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
): { position: Position; target: Target } | null {
  const candidates = pool.filter(
    (p) =>
      p.pieces >= filter.minPieces &&
      p.pieces <= filter.maxPieces &&
      !usedIds.has(p.id) &&
      eligibleTargets(p.fen, filter.removable).length > 0,
  );
  if (candidates.length === 0) return null;
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
