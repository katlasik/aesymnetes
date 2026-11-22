import { describe, expect, it } from 'vitest';
import { correctCount, grade, initialState, isCorrect, reduce, type NewRound, type State } from './machine';
import { PRESETS } from './settings';

function newRound(id: string): NewRound {
  return {
    position: { id, fen: 'n6k/8/8/8/8/8/8/R6K w - - 0 1', pieces: 4 },
    orientation: 'white',
    hanging: [{ square: 'a8', attacker: 'a1' }],
    pickable: new Set(['a1', 'a8']),
  };
}

const started = (rounds = 2): State =>
  reduce(initialState({ ...PRESETS.easy, rounds }), { type: 'start', round: newRound('p1') });

describe('reduce', () => {
  it('starts in the find phase', () => {
    const s = started();
    expect(s.phase).toBe('find');
    expect(s.usedIds).toEqual(['p1']);
  });

  it('toggles picks on occupied squares only', () => {
    let s = started();
    s = reduce(s, { type: 'toggle', square: 'a8' });
    s = reduce(s, { type: 'toggle', square: 'a1' });
    expect(s.round!.picked).toEqual(['a8', 'a1']);
    s = reduce(s, { type: 'toggle', square: 'a1' });
    expect(s.round!.picked).toEqual(['a8']);
    expect(reduce(s, { type: 'toggle', square: 'e4' })).toBe(s);
    expect(reduce(s, { type: 'toggle', square: 'h1' })).toBe(s);
  });

  it('grades a submitted round', () => {
    let s = reduce(started(), { type: 'toggle', square: 'a8' });
    s = reduce(s, { type: 'submit' });
    expect(s.phase).toBe('result');
    expect(isCorrect(s.round!)).toBe(true);
    expect(correctCount(s)).toBe(1);
    expect(reduce(s, { type: 'toggle', square: 'a1' })).toBe(s);
  });

  it('ends the round when time runs out', () => {
    let s = reduce(started(), { type: 'toggle', square: 'a1' });
    s = reduce(s, { type: 'timeUp' });
    expect(s.phase).toBe('result');
    expect(s.round!.timedOut).toBe(true);
    expect(grade(s.round!)).toEqual({ found: [], wrong: ['a1'], missed: ['a8'] });
    expect(isCorrect(s.round!)).toBe(false);
  });

  it('ignores a late timeout after submitting', () => {
    const s = reduce(started(), { type: 'submit' });
    expect(reduce(s, { type: 'timeUp' })).toBe(s);
  });

  it('moves to the next position, then to the summary', () => {
    let s = reduce(started(2), { type: 'submit' });
    s = reduce(s, { type: 'next', round: newRound('p2') });
    expect(s.phase).toBe('find');
    expect(s.roundIndex).toBe(1);
    expect(s.round!.picked).toEqual([]);
    s = reduce(s, { type: 'submit' });
    s = reduce(s, { type: 'next', round: newRound('p3') });
    expect(s.phase).toBe('summary');
    expect(s.history).toHaveLength(2);
  });

  it('ends the session when no position is left', () => {
    const s = reduce(reduce(started(5), { type: 'submit' }), { type: 'next', round: null });
    expect(s.phase).toBe('summary');
  });
});
