import { describe, expect, it } from 'vitest';
import { initialState, pickSquare, reduce, SQUARES } from './machine';

const started = () => reduce(initialState(), { type: 'start', orientation: 'black', target: 'e4' });

describe('pickSquare', () => {
  it('returns a board square other than the one to avoid', () => {
    for (let i = 0; i < 200; i++) {
      const s = pickSquare(Math.random, 'e4');
      expect(SQUARES).toContain(s);
      expect(s).not.toBe('e4');
    }
  });

  it('covers both ends of the board', () => {
    expect(pickSquare(() => 0)).toBe('a1');
    expect(pickSquare(() => 0.9999)).toBe('h8');
  });
});

describe('reduce', () => {
  it('starts a run with the given side and square, scores at zero', () => {
    const s = started();
    expect(s).toMatchObject({ phase: 'run', orientation: 'black', target: 'e4', correct: 0, wrong: 0, feedback: null });
  });

  it('counts a right click and moves to the next square', () => {
    const s = reduce(started(), { type: 'click', square: 'e4', next: 'a8' });
    expect(s).toMatchObject({ correct: 1, wrong: 0, target: 'a8', feedback: { clicked: 'e4', answer: 'e4', right: true } });
  });

  it('counts a wrong click, remembers the right square and moves on', () => {
    const s = reduce(started(), { type: 'click', square: 'd4', next: 'a8' });
    expect(s).toMatchObject({ correct: 0, wrong: 1, target: 'a8', feedback: { clicked: 'd4', answer: 'e4', right: false } });
  });

  it('ignores clicks outside a run', () => {
    const idle = initialState();
    expect(reduce(idle, { type: 'click', square: 'e4', next: 'a8' })).toBe(idle);
    const done = reduce(started(), { type: 'timeUp' });
    expect(reduce(done, { type: 'click', square: 'e4', next: 'a8' })).toBe(done);
  });

  it('ends the run when time is up, keeping the scores', () => {
    const s = reduce(reduce(started(), { type: 'click', square: 'e4', next: 'a8' }), { type: 'timeUp' });
    expect(s).toMatchObject({ phase: 'summary', correct: 1, wrong: 0, feedback: null });
  });

  it('clears feedback on request', () => {
    const s = reduce(reduce(started(), { type: 'click', square: 'e4', next: 'a8' }), { type: 'clearFeedback' });
    expect(s.feedback).toBeNull();
  });

  it('starts again from the summary with fresh scores', () => {
    const done = reduce(reduce(started(), { type: 'click', square: 'e4', next: 'a8' }), { type: 'timeUp' });
    const again = reduce(done, { type: 'start', orientation: 'white', target: 'h1' });
    expect(again).toMatchObject({ phase: 'run', orientation: 'white', target: 'h1', correct: 0, wrong: 0, run: 2 });
  });
});
