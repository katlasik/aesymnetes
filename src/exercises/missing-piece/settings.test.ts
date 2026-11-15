import { expect, test } from 'vitest';
import { PRESETS, matchPreset, sanitize } from './settings';

test('matchPreset names each preset and reports custom after a change', () => {
  expect(matchPreset(PRESETS.easy)).toBe('easy');
  expect(matchPreset(PRESETS.medium)).toBe('medium');
  expect(matchPreset(PRESETS.hard)).toBe('hard');
  expect(matchPreset({ ...PRESETS.medium, attempts: 4 })).toBe('custom');
});

test('sanitize returns easy for junk', () => {
  for (const junk of [null, 'x', 42, [], {}]) expect(sanitize(junk)).toEqual(PRESETS.easy);
});

test('sanitize keeps valid settings unchanged', () => {
  expect(sanitize(PRESETS.hard)).toEqual(PRESETS.hard);
});

test('sanitize clamps numbers, rounds them, and repairs min > max', () => {
  const s = sanitize({
    ...PRESETS.easy,
    memoriseSeconds: 999,
    maskMs: -5,
    minPieces: 30,
    maxPieces: 8,
    attempts: 2.6,
    rounds: 1000,
  });
  expect(s).toMatchObject({
    memoriseSeconds: 120,
    maskMs: 0,
    minPieces: 8,
    maxPieces: 30,
    attempts: 3,
    rounds: 50,
  });
});

test('sanitize replaces wrong-typed fields with the easy value', () => {
  const s = sanitize({
    ...PRESETS.hard,
    removable: 'queens',
    side: 5,
    coordinates: 'yes',
    memoriseSeconds: 'ten',
    guessSeconds: 'soon',
    attempts: Number.NaN,
  });
  expect(s).toMatchObject({
    removable: 'any',
    side: 'white',
    coordinates: true,
    memoriseSeconds: 10,
    guessSeconds: 5,
    attempts: 3,
  });
});

test('every preset counts down 10 seconds to memorise and gives 5 seconds to find the square', () => {
  for (const p of Object.values(PRESETS)) {
    expect(p.memoriseSeconds).toBe(10);
    expect(p.guessSeconds).toBe(5);
  }
});

test('sanitize turns the old untimed setting into the default countdown', () => {
  expect(sanitize({ ...PRESETS.easy, memoriseSeconds: null }).memoriseSeconds).toBe(10);
});

test('sanitize clamps the time to find the square', () => {
  expect(sanitize({ ...PRESETS.easy, guessSeconds: 0 }).guessSeconds).toBe(2);
  expect(sanitize({ ...PRESETS.easy, guessSeconds: 99 }).guessSeconds).toBe(30);
});
