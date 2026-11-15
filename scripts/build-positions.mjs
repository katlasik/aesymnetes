// Samples positions from the Lichess puzzle CSV (CC0).
//
//   curl -sL https://database.lichess.org/lichess_db_puzzle.csv.zst \
//     | zstd -dc | head -n 300000 \
//     | node scripts/build-positions.mjs > public/positions.json
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseFen } from 'chessops/fen';

const MIN_PIECES = 4;
const MAX_PIECES = 32;

/**
 * @param {Iterable<string>} lines CSV rows: PuzzleId,FEN,...
 * @param {number} capPerCount maximum positions kept for each piece count
 * @returns {{ id: string, fen: string, pieces: number }[]}
 */
export function samplePositions(lines, capPerCount) {
  const perCount = new Map();
  const out = [];
  for (const line of lines) {
    const [id, fen] = line.split(',');
    if (!id || !fen || id === 'PuzzleId') continue;
    if (parseFen(fen).isErr) continue;
    const pieces = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
    if (pieces < MIN_PIECES || pieces > MAX_PIECES) continue;
    const kept = perCount.get(pieces) ?? 0;
    if (kept >= capPerCount) continue;
    perCount.set(pieces, kept + 1);
    out.push({ id, fen, pieces });
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = [];
  for await (const line of createInterface({ input: process.stdin })) lines.push(line);
  process.stdout.write(JSON.stringify(samplePositions(lines, 140)));
}
