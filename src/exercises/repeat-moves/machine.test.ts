import { expect, test } from 'vitest';
import type { Sequence } from '../../lib/sequences';
import { correctCount, expectedMove, initialState, isCorrect, reduce, type Action, type NewRound, type State } from './machine';
import { PRESETS } from './settings';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Ruy Lopez, 9 moves per side, as long as a real sequence.
const LINE = [
  'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1',
  'f8e7', 'f1e1', 'b7b5', 'a4b3', 'd7d6', 'c2c3', 'e8g8', 'h2h3', 'c6a5',
];
const sequence = (id: string): Sequence => ({ id, gameId: id, ply: 20, fen: START, moves: LINE, pieces: 32 });
const nr = (id: string): NewRound => ({ sequence: sequence(id), orientation: 'white' });
const play = (state: State, ...actions: Action[]) => actions.reduce(reduce, state);

const easy = PRESETS.easy; // 3 moves per side = 6 moves
const started = (settings = easy) => play(initialState(settings), { type: 'start', round: nr('a') });
const watching = (settings = easy) => reduce(started(settings), { type: 'lookDone' });
const steps = (n: number): Action[] => Array.from({ length: n }, () => ({ type: 'watchStep' }) as Action);
const replaying = (settings = easy) =>
  play(watching(settings), ...steps(settings.movesPerSide * 2), { type: 'watchDone' });
const moves = (...ucis: string[]): Action[] => ucis.map((uci) => ({ type: 'move', uci }));

test('start enters look with the number of moves from the settings', () => {
  const s = started();
  expect(s.phase).toBe('look');
  expect(s.round).toMatchObject({ plies: 6, shown: 0, played: [], wrongMove: null });
  expect(started(PRESETS.hard).round?.plies).toBe(18);
  expect(s.usedIds).toEqual(['a']);
});

test('lookDone starts the watch', () => {
  expect(watching().phase).toBe('watch');
});

test('a sequence shorter than the setting is cut to its own length', () => {
  const short: Sequence = { ...sequence('s'), moves: LINE.slice(0, 4) };
  const s = reduce(initialState(PRESETS.hard), { type: 'start', round: { sequence: short, orientation: 'white' } });
  expect(s.round?.plies).toBe(4);
});

test('watchStep shows one more move, up to the number of moves', () => {
  const s = play(watching(), ...steps(3));
  expect(s.round?.shown).toBe(3);
  const all = play(watching(), ...steps(10));
  expect(all.round?.shown).toBe(6);
});

test('watchDone only moves on once every move has been shown', () => {
  const early = play(watching(), ...steps(5));
  expect(reduce(early, { type: 'watchDone' })).toBe(early);
  expect(replaying().phase).toBe('replay');
});

test('expectedMove is the next move to replay', () => {
  expect(expectedMove(replaying().round!)).toBe('e2e4');
  const s = play(replaying(), ...moves('e2e4', 'e7e5'));
  expect(expectedMove(s.round!)).toBe('g1f3');
});

test('replaying every move correctly ends the round as correct', () => {
  const s = play(replaying(), ...moves(...LINE.slice(0, 6)));
  expect(s.phase).toBe('result');
  expect(s.round?.played).toEqual(LINE.slice(0, 6));
  expect(isCorrect(s.round!)).toBe(true);
});

test('the first wrong move ends the round as wrong', () => {
  const s = play(replaying(), ...moves('e2e4', 'd7d5'));
  expect(s.phase).toBe('result');
  expect(s.round?.wrongMove).toBe('d7d5');
  expect(s.round?.played).toEqual(['e2e4']);
  expect(isCorrect(s.round!)).toBe(false);
});

test('a promotion counts when the from and to squares match the expected move', () => {
  const promo: Sequence = { id: 'p', gameId: 'p', ply: 20, fen: '8/P6k/8/8/8/8/6K1/8 w - - 0 1', moves: ['a7a8q', 'h7h6'], pieces: 3 };
  const settings = { ...easy, movesPerSide: 1 };
  const s = play(
    initialState(settings),
    { type: 'start', round: { sequence: promo, orientation: 'white' } },
    { type: 'lookDone' },
    ...steps(2),
    { type: 'watchDone' },
    ...moves('a7a8', 'h7h6'),
  );
  expect(isCorrect(s.round!)).toBe(true);
  expect(s.round?.played).toEqual(['a7a8q', 'h7h6']);
});

test('next records the round and starts the following one', () => {
  const done = play(replaying(), ...moves(...LINE.slice(0, 6)));
  const s = reduce(done, { type: 'next', round: nr('b') });
  expect(s.phase).toBe('look');
  expect(s.history).toHaveLength(1);
  expect(s.roundIndex).toBe(1);
  expect(s.usedIds).toEqual(['a', 'b']);
  expect(correctCount(s)).toBe(1);
});

test('next ends the session after the last round, or when no round is left', () => {
  const settings = { ...easy, rounds: 5 };
  let s = play(initialState(settings), { type: 'start', round: nr('r0') });
  for (let i = 0; i < 5; i++) {
    s = play(s, { type: 'lookDone' }, ...steps(6), { type: 'watchDone' }, ...moves('a2a3'), { type: 'next', round: nr(`r${i + 1}`) });
  }
  expect(s.phase).toBe('summary');
  expect(s.history).toHaveLength(5);
  const early = reduce(play(replaying(), ...moves('a2a3')), { type: 'next', round: null });
  expect(early.phase).toBe('summary');
});

test('out-of-phase actions return the same state object', () => {
  const idle = initialState(easy);
  const look = started();
  const watch = watching();
  const replay = replaying();
  const result = play(replaying(), ...moves('a2a3'));
  const cases: [State, Action][] = [
    [idle, { type: 'lookDone' }],
    [idle, { type: 'move', uci: 'e2e4' }],
    [look, { type: 'watchStep' }],
    [look, { type: 'move', uci: 'e2e4' }],
    [watch, { type: 'move', uci: 'e2e4' }],
    [watch, { type: 'lookDone' }],
    [replay, { type: 'watchStep' }],
    [replay, { type: 'next', round: nr('b') }],
    [result, { type: 'move', uci: 'e2e4' }],
    [look, { type: 'start', round: nr('b') }],
    [watch, { type: 'setSettings', settings: PRESETS.hard }],
  ];
  for (const [state, action] of cases) expect(reduce(state, action)).toBe(state);
});

test('quit returns to idle and keeps settings', () => {
  expect(reduce(replaying(PRESETS.hard), { type: 'quit' })).toEqual(initialState(PRESETS.hard));
});
