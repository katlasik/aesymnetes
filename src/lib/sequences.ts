import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
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

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/**
 * An unused sequence in the piece-count range. With a `step`, one whose piece count is closest
 * to that step's target, so a session goes from the fewest pieces to the most.
 * Sequences whose moves do not replay are skipped.
 */
export function pickSequence(
  pool: readonly Sequence[],
  filter: { minPieces: number; maxPieces: number },
  usedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
  step?: Step,
): Sequence | null {
  let candidates = pool.filter(
    (s) => s.pieces >= filter.minPieces && s.pieces <= filter.maxPieces && !usedIds.has(s.id),
  );
  while (candidates.length > 0) {
    let choice = candidates;
    if (step) {
      const target = targetPieces(filter, step);
      const distance = (s: Sequence) => Math.abs(s.pieces - target);
      const nearest = Math.min(...candidates.map(distance));
      choice = candidates.filter((s) => distance(s) === nearest);
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
