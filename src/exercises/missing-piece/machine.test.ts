import { expect, test } from 'vitest';
import { correctCount, initialState, isCorrect, reduce, sessionTotal, type Action, type NewRound, type State } from './machine';
import { PRESETS } from './settings';

const FEN = 'rnbqkbnr/pppppppp/8/8/4N3/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
const nr = (id: string): NewRound => ({
  position: { id, fen: FEN, pieces: 32 },
  target: { square: 'e4', color: 'white', role: 'knight' },
  orientation: 'white',
});
const play = (state: State, ...actions: Action[]) => actions.reduce(reduce, state);
const KNIGHT = { color: 'white', role: 'knight' } as const;

const start = (settings = PRESETS.medium) => play(initialState(settings), { type: 'start', round: nr('a') });
const toGuess = (settings = PRESETS.medium) =>
  play(start(settings), { type: 'ready', now: 0 }, { type: 'maskDone', now: 1000 });
const toResult = (settings = PRESETS.medium) =>
  play(toGuess(settings), { type: 'clickSquare', square: 'e4' }, { type: 'submitPiece', guess: KNIGHT, now: 4000 });

test('initial state is idle with no round', () => {
  expect(initialState(PRESETS.easy)).toEqual({
    phase: 'idle',
    settings: PRESETS.easy,
    round: null,
    roundIndex: 0,
    history: [],
    usedIds: [],
  });
});

test('setSettings replaces settings in idle', () => {
  const s = reduce(initialState(PRESETS.easy), { type: 'setSettings', settings: PRESETS.hard });
  expect(s.settings).toEqual(PRESETS.hard);
  expect(s.phase).toBe('idle');
});

test('start enters memorise with a fresh round', () => {
  const s = start();
  expect(s.phase).toBe('memorise');
  expect(s.roundIndex).toBe(0);
  expect(s.usedIds).toEqual(['a']);
  expect(s.round).toMatchObject({ wrongSquares: [], revealed: false, guessStartedAt: null, guess: null, score: null });
});

test('ready enters the mask, and maskDone starts the guess clock', () => {
  const masked = reduce(start(), { type: 'ready', now: 0 });
  expect(masked.phase).toBe('mask');
  const guessing = reduce(masked, { type: 'maskDone', now: 1000 });
  expect(guessing.phase).toBe('guessSquare');
  expect(guessing.round?.guessStartedAt).toBe(1000);
});

test('maskMs 0 skips the mask', () => {
  const s = reduce(start({ ...PRESETS.medium, maskMs: 0 }), { type: 'ready', now: 7 });
  expect(s.phase).toBe('guessSquare');
  expect(s.round?.guessStartedAt).toBe(7);
});

test('the right square moves on to the piece guess', () => {
  const s = reduce(toGuess(), { type: 'clickSquare', square: 'e4' });
  expect(s.phase).toBe('guessPiece');
  expect(s.round?.revealed).toBe(false);
});

test('a wrong square is recorded once and costs an attempt', () => {
  const once = reduce(toGuess(), { type: 'clickSquare', square: 'a1' });
  expect(once.phase).toBe('guessSquare');
  expect(once.round?.wrongSquares).toEqual(['a1']);
  expect(reduce(once, { type: 'clickSquare', square: 'a1' })).toBe(once);
});

test('attempts exhausted reveals the square and still asks for the piece', () => {
  const s = reduce(toGuess(PRESETS.hard), { type: 'clickSquare', square: 'a1' });
  expect(s.phase).toBe('guessPiece');
  expect(s.round?.revealed).toBe(true);
  const done = reduce(s, { type: 'submitPiece', guess: KNIGHT, now: 1000 });
  expect(done.round?.score).toEqual({ square: 0, piece: 50, bonus: 0, total: 50 });
});

test('running out of time to find the square reveals it and asks for the piece', () => {
  const s = reduce(toGuess(), { type: 'guessTimeout' });
  expect(s.phase).toBe('guessPiece');
  expect(s.round?.revealed).toBe(true);
  const done = reduce(s, { type: 'submitPiece', guess: KNIGHT, now: 9000 });
  expect(done.round?.score).toEqual({ square: 0, piece: 50, bonus: 0, total: 50 });
});

test('a guess timeout outside the square guess is ignored', () => {
  const memorise = start();
  expect(reduce(memorise, { type: 'guessTimeout' })).toBe(memorise);
  const guessPiece = reduce(toGuess(), { type: 'clickSquare', square: 'e4' });
  expect(reduce(guessPiece, { type: 'guessTimeout' })).toBe(guessPiece);
});

test('full correct round on medium scores 150', () => {
  const s = toResult();
  expect(s.phase).toBe('result');
  expect(s.round?.guess).toEqual(KNIGHT);
  expect(s.round?.score?.total).toBe(150);
});

test('a wrong guess before the right square lowers the square score', () => {
  const s = play(
    toGuess(),
    { type: 'clickSquare', square: 'a1' },
    { type: 'clickSquare', square: 'e4' },
    { type: 'submitPiece', guess: { color: 'black', role: 'knight' }, now: 4000 },
  );
  expect(s.round?.score).toEqual({ square: 50, piece: 25, bonus: 0, total: 75 });
});

test('the speed bonus uses time since the guess started', () => {
  const s = play(
    toGuess(PRESETS.hard),
    { type: 'clickSquare', square: 'e4' },
    { type: 'submitPiece', guess: KNIGHT, now: 6000 },
  );
  expect(s.round?.score).toEqual({ square: 100, piece: 50, bonus: 25, total: 175 });
});

test('next starts the following round and records the finished one', () => {
  const s = reduce(toResult(), { type: 'next', round: nr('b') });
  expect(s.phase).toBe('memorise');
  expect(s.roundIndex).toBe(1);
  expect(s.usedIds).toEqual(['a', 'b']);
  expect(s.history).toHaveLength(1);
  expect(s.round?.position.id).toBe('b');
  expect(s.round?.score).toBeNull();
});

test('session ends after settings.rounds rounds', () => {
  const settings = { ...PRESETS.medium, rounds: 5, maskMs: 0 };
  let s = start(settings);
  for (let i = 0; i < 5; i++) {
    s = play(
      s,
      { type: 'ready', now: 0 },
      { type: 'clickSquare', square: 'e4' },
      { type: 'submitPiece', guess: KNIGHT, now: 0 },
      { type: 'next', round: nr(`r${i}`) },
    );
  }
  expect(s.phase).toBe('summary');
  expect(s.history).toHaveLength(5);
  expect(s.round).toBeNull();
  expect(sessionTotal(s)).toBe(750);
});

test('sessionTotal includes the round in progress once it is scored', () => {
  expect(sessionTotal(toResult())).toBe(150);
  expect(sessionTotal(toGuess())).toBe(0);
});

test('next with a null round ends the session early', () => {
  const s = reduce(toResult(), { type: 'next', round: null });
  expect(s.phase).toBe('summary');
  expect(s.history).toHaveLength(1);
});

test('start from summary resets the session', () => {
  const summary = reduce(toResult(), { type: 'next', round: null });
  const s = reduce(summary, { type: 'start', round: nr('z') });
  expect(s.phase).toBe('memorise');
  expect(s.history).toEqual([]);
  expect(s.usedIds).toEqual(['z']);
  expect(s.roundIndex).toBe(0);
});

test('out-of-phase actions return the same state object', () => {
  const idle = initialState(PRESETS.medium);
  const memorise = start();
  const mask = reduce(memorise, { type: 'ready', now: 0 });
  const guessSquare = toGuess();
  const guessPiece = reduce(guessSquare, { type: 'clickSquare', square: 'e4' });
  const cases: [State, Action][] = [
    [idle, { type: 'ready', now: 0 }],
    [idle, { type: 'clickSquare', square: 'e4' }],
    [idle, { type: 'next', round: nr('b') }],
    [mask, { type: 'ready', now: 0 }],
    [memorise, { type: 'clickSquare', square: 'e4' }],
    [mask, { type: 'clickSquare', square: 'e4' }],
    [memorise, { type: 'maskDone', now: 0 }],
    [guessSquare, { type: 'maskDone', now: 0 }],
    [guessSquare, { type: 'ready', now: 0 }],
    [guessSquare, { type: 'submitPiece', guess: KNIGHT, now: 0 }],
    [memorise, { type: 'start', round: nr('b') }],
    [memorise, { type: 'setSettings', settings: PRESETS.easy }],
    [guessPiece, { type: 'next', round: nr('b') }],
    [guessPiece, { type: 'clickSquare', square: 'a1' }],
    [toResult(), { type: 'submitPiece', guess: KNIGHT, now: 0 }],
  ];
  for (const [state, action] of cases) expect(reduce(state, action)).toBe(state);
});

test('isCorrect: square found and the whole piece right', () => {
  expect(isCorrect(toResult().round!)).toBe(true);
  const wrongColour = play(toGuess(), { type: 'clickSquare', square: 'e4' }, { type: 'submitPiece', guess: { color: 'black', role: 'knight' }, now: 0 });
  expect(isCorrect(wrongColour.round!)).toBe(false);
  const timedOut = play(toGuess(), { type: 'guessTimeout' }, { type: 'submitPiece', guess: KNIGHT, now: 0 });
  expect(isCorrect(timedOut.round!)).toBe(false);
  const afterAMiss = play(toGuess(), { type: 'clickSquare', square: 'a1' }, { type: 'clickSquare', square: 'e4' }, { type: 'submitPiece', guess: KNIGHT, now: 0 });
  expect(isCorrect(afterAMiss.round!)).toBe(true);
  expect(isCorrect(toGuess().round!)).toBe(false);
});

test('correctCount counts finished rounds and a round still on screen', () => {
  const s = reduce(toResult(), { type: 'next', round: nr('b') });
  expect(correctCount(s)).toBe(1);
  expect(correctCount(toResult())).toBe(1);
  expect(correctCount(toGuess())).toBe(0);
});

test('quit returns to idle and keeps settings', () => {
  expect(reduce(toGuess(PRESETS.hard), { type: 'quit' })).toEqual(initialState(PRESETS.hard));
});
