// Cuts move sequences out of the real games behind the Lichess puzzles.
//
//   node scripts/build-sequences.mjs < tmp/puzzles.csv > public/sequences.json
//
// Reads the puzzle CSV on stdin, takes each puzzle's source game from its GameUrl
// (https://lichess.org/game/<id>[/black]#<ply>), downloads the games from Lichess in batches,
// and keeps the 18 moves that end just before the puzzle position.
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { Chess } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { makeUci } from 'chessops/util';

export const SEQUENCE_LENGTH = 18;
export const MIN_START_PLY = 20;
const BATCH = 300;
const MAX_GAMES = 2400;
const CAP_PER_PIECE_COUNT = 60;
const EXPORT_URL = 'https://lichess.org/api/games/export/_ids?moves=true&clocks=false&evals=false&opening=false';

/** The game id and ply from a puzzle's GameUrl, or null. */
export function parseGameUrl(url) {
  const m = /^https:\/\/lichess\.org\/(?:game\/)?([A-Za-z0-9]{8})(?:\/(?:white|black))?#(\d+)$/.exec(url ?? '');
  return m ? { gameId: m[1], ply: Number(m[2]) } : null;
}

/**
 * The `length` moves that end just before ply `puzzlePly`, as UCI from the position where they start.
 * Null if the window starts before `minStartPly`, the game is too short, or a move is illegal.
 */
export function cutSequence(sanMoves, puzzlePly, length = SEQUENCE_LENGTH, minStartPly = MIN_START_PLY) {
  const start = puzzlePly - length;
  if (start < minStartPly || sanMoves.length < puzzlePly) return null;
  const pos = Chess.default();
  let fen = null;
  let pieces = 0;
  const moves = [];
  for (let i = 0; i < puzzlePly; i++) {
    if (i === start) {
      fen = makeFen(pos.toSetup());
      pieces = pos.board.occupied.size();
    }
    const move = parseSan(pos, sanMoves[i]);
    if (!move) return null;
    if (i >= start) moves.push(makeUci(move));
    pos.play(move);
  }
  return { fen, moves, ply: start, pieces };
}

async function fetchGames(ids) {
  for (;;) {
    const res = await fetch(EXPORT_URL, {
      method: 'POST',
      headers: { Accept: 'application/x-ndjson', 'Content-Type': 'text/plain', 'User-Agent': 'chess-exercises-sampler' },
      body: ids.join(','),
    });
    if (res.status === 429) {
      process.stderr.write('Rate limited by Lichess; waiting 60 s\n');
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }
    if (!res.ok) throw new Error(`Lichess export failed: HTTP ${res.status}`);
    const text = await res.text();
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }
}

async function main() {
  const wanted = new Map();
  for await (const line of createInterface({ input: process.stdin })) {
    if (wanted.size >= MAX_GAMES) break;
    const url = line.split(',')[8];
    const parsed = parseGameUrl(url);
    if (parsed && !wanted.has(parsed.gameId)) wanted.set(parsed.gameId, parsed.ply);
  }
  const ids = [...wanted.keys()];
  const perCount = new Map();
  const out = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const games = await fetchGames(ids.slice(i, i + BATCH));
    process.stderr.write(`Fetched ${Math.min(i + BATCH, ids.length)}/${ids.length} games\n`);
    for (const game of games) {
      if (game.variant !== 'standard' || game.initialFen || typeof game.moves !== 'string') continue;
      const ply = wanted.get(game.id);
      const seq = cutSequence(game.moves.split(' '), ply);
      if (!seq) continue;
      const kept = perCount.get(seq.pieces) ?? 0;
      if (kept >= CAP_PER_PIECE_COUNT) continue;
      perCount.set(seq.pieces, kept + 1);
      out.push({ id: `${game.id}-${seq.ply}`, gameId: game.id, ...seq });
    }
  }
  process.stdout.write(JSON.stringify(out));
  process.stderr.write(`Kept ${out.length} sequences\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
