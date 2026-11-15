import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSanAndPlay } from 'chessops/san';
import { parseUci } from 'chessops/util';
import { expect, test } from 'vitest';
import { cutSequence, parseGameUrl } from './build-sequences.mjs';

// A legal game, generated so the test does not depend on a game copied from memory:
// each side always plays the legal move that comes first in a fixed order.
function syntheticGame(plies) {
  const pos = Chess.default();
  const sans = [];
  for (let i = 0; i < plies; i++) {
    const moves = [];
    for (const [from, dests] of pos.allDests()) {
      for (const to of dests) {
        // A pawn reaching the last rank must name its promotion piece.
        const promotes = pos.board.get(from)?.role === 'pawn' && (to >> 3 === 0 || to >> 3 === 7);
        moves.push(promotes ? { from, to, promotion: 'queen' } : { from, to });
      }
    }
    moves.sort((a, b) => a.from - b.from || a.to - b.to);
    // Alternate between the first and last move so the pieces actually travel.
    const move = moves[i % 2 === 0 ? i % moves.length : moves.length - 1 - (i % moves.length)];
    sans.push(makeSanAndPlay(pos, move));
  }
  return { sans, fen: makeFen(pos.toSetup()) };
}
const GAME_40 = syntheticGame(40);

test('the synthetic test game is 40 legal plies', () => {
  expect(GAME_40.sans).toHaveLength(40);
});

test('parseGameUrl reads the game id and ply', () => {
  expect(parseGameUrl('https://lichess.org/game/787zsVup/black#48')).toEqual({ gameId: '787zsVup', ply: 48 });
  expect(parseGameUrl('https://lichess.org/game/F8M8OS71#53')).toEqual({ gameId: 'F8M8OS71', ply: 53 });
  expect(parseGameUrl('https://lichess.org/F8M8OS71#53')).toEqual({ gameId: 'F8M8OS71', ply: 53 });
  expect(parseGameUrl('nonsense')).toBeNull();
  expect(parseGameUrl('https://lichess.org/game/F8M8OS71')).toBeNull();
});

test('cutSequence takes the 18 moves that end just before the puzzle ply', () => {
  const s = cutSequence(GAME_40.sans, 40);
  expect(s.ply).toBe(22);
  expect(s.moves).toHaveLength(18);
  expect(s.moves.every((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))).toBe(true);
  // Replaying the sequence from its start reaches the game's position after 40 plies.
  const pos = Chess.fromSetup(parseFen(s.fen).unwrap()).unwrap();
  for (const uci of s.moves) pos.play(parseUci(uci));
  expect(makeFen(pos.toSetup())).toBe(GAME_40.fen);
});

test('cutSequence counts the pieces at the start of the sequence', () => {
  const s = cutSequence(GAME_40.sans, 40);
  const board = parseFen(s.fen).unwrap().board;
  expect(s.pieces).toBe(board.occupied.size());
});

test('cutSequence refuses windows that start before ply 20', () => {
  expect(cutSequence(GAME_40.sans, 30)).toBeNull();
  expect(cutSequence(GAME_40.sans, 37)).toBeNull();
  expect(cutSequence(GAME_40.sans, 38).ply).toBe(20);
});

test('cutSequence refuses a game that is too short for the puzzle ply', () => {
  expect(cutSequence(GAME_40.sans.slice(0, 30), 40)).toBeNull();
});

test('cutSequence refuses games with an illegal move', () => {
  expect(cutSequence([...GAME_40.sans.slice(0, 10), 'Qxz9', ...GAME_40.sans.slice(11)], 40)).toBeNull();
});
