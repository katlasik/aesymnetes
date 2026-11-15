import { Chess, normalizeMove, type Position } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSquare, makeUci, parseUci, squareFile, squareFromCoords, squareRank } from 'chessops/util';
import { targetPieces, type Step } from './positions';

/** A run of moves from a real game, starting at `fen` (see scripts/build-sequences.mjs). */
export interface Sequence {
  /** `${gameId}-${ply}` */
  id: string;
  gameId: string;
  /** Plies played in the game before the sequence starts. */
  ply: number;
  fen: string;
  /** UCI moves; the exercise uses the first 2 × movesPerSide. */
  moves: string[];
  /** Pieces on the board at the start. */
  pieces: number;
}

/** True when every move of the sequence is legal from its starting position. */
export function replayable(seq: Sequence): boolean {
  const setup = parseFen(seq.fen);
  if (setup.isErr) return false;
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return false;
  for (const uci of seq.moves) {
    const move = parseUci(uci);
    if (!move || !pos.value.isLegal(move)) return false;
    pos.value.play(move);
  }
  return true;
}

/**
 * The user's move as the data stores it. Castling is stored king-to-rook (e1h1), but the board
 * reports the square the king was dropped on, which may be two squares over (e1g1).
 */
export function userMoveUci(pos: Position, orig: string, dest: string): string {
  const move = parseUci(orig + dest);
  if (!move) return orig + dest;
  return makeUci(normalizeMove(pos, move));
}

/** The squares to highlight for a stored move: castling shows the king's real destination. */
export function displaySquares(pos: Position, uci: string): [string, string] {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const move = parseUci(uci);
  if (!move || !('from' in move)) return [from, to];
  const piece = pos.board.get(move.from);
  const target = pos.board.get(move.to);
  const castles = piece?.role === 'king' && target?.role === 'rook' && target.color === piece.color;
  if (!castles) return [from, to];
  const kingside = squareFile(move.to) > squareFile(move.from);
  return [from, makeSquare(squareFromCoords(kingside ? 6 : 2, squareRank(move.from))!)];
}

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/**
 * Below this many sequences at the target piece count, the choice widens to nearby counts.
 * Some piece counts have only a handful of sequences; without this, every session would open
 * with the same few positions.
 */
export const MIN_CHOICES = 20;

/**
 * An unused sequence in the piece-count range. With a `step`, one whose piece count is closest
 * to that step's target (widened to at least `minChoices` sequences), so a session goes from the
 * fewest pieces to the most. Sequences whose moves do not replay are skipped.
 */
export function pickSequence(
  pool: readonly Sequence[],
  filter: { minPieces: number; maxPieces: number },
  usedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
  step?: Step,
  minChoices = MIN_CHOICES,
): Sequence | null {
  let candidates = pool.filter(
    (s) => s.pieces >= filter.minPieces && s.pieces <= filter.maxPieces && !usedIds.has(s.id),
  );
  while (candidates.length > 0) {
    let choice = candidates;
    if (step) {
      const target = targetPieces(filter, step);
      const distance = (s: Sequence) => Math.abs(s.pieces - target);
      const distances = [...new Set(candidates.map(distance))].sort((a, b) => a - b);
      // Take whole distance bands, nearest first, until there are enough to choose from.
      let reach = distances[0]!;
      for (const d of distances) {
        reach = d;
        if (candidates.filter((s) => distance(s) <= d).length >= minChoices) break;
      }
      choice = candidates.filter((s) => distance(s) <= reach);
    }
    const picked = pickFrom(choice, rng);
    if (replayable(picked)) return picked;
    candidates = candidates.filter((s) => s !== picked);
  }
  return null;
}

let poolPromise: Promise<Sequence[]> | null = null;

/** Loads the bundled sequences once. A failed load can be retried. */
export function loadSequences(): Promise<Sequence[]> {
  poolPromise ??= fetch(`${import.meta.env.BASE_URL}sequences.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load sequences (HTTP ${res.status})`);
      return res.json() as Promise<Sequence[]>;
    })
    .catch((err: unknown) => {
      poolPromise = null;
      throw err;
    });
  return poolPromise;
}
