import { expect, test } from 'vitest';
import { LIMITS, PRESETS, matchPreset, sanitize } from './settings';

test('presets follow the spec: 3, 6 and 9 moves per side', () => {
  expect(PRESETS.easy).toEqual({
    movesPerSide: 3, lookSeconds: 3, moveMs: 1000, side: 'toMove', coordinates: true, rounds: 10, minPieces: 4, maxPieces: 32,
  });
  expect(PRESETS.medium).toEqual({ ...PRESETS.easy, movesPerSide: 6 });
  expect(PRESETS.hard).toEqual({ ...PRESETS.easy, movesPerSide: 9, coordinates: false });
});

test('matchPreset names each preset and reports custom after a change', () => {
  expect(matchPreset(PRESETS.easy)).toBe('easy');
  expect(matchPreset(PRESETS.medium)).toBe('medium');
  expect(matchPreset(PRESETS.hard)).toBe('hard');
  expect(matchPreset({ ...PRESETS.hard, moveMs: 1500 })).toBe('custom');
});

test('sanitize returns easy for junk', () => {
  for (const junk of [null, 'x', 42, [], {}]) expect(sanitize(junk)).toEqual(PRESETS.easy);
});

test('sanitize keeps valid settings unchanged', () => {
  expect(sanitize(PRESETS.hard)).toEqual(PRESETS.hard);
});

test('sanitize clamps every number and repairs min > max', () => {
  const s = sanitize({
    ...PRESETS.easy, movesPerSide: 40, lookSeconds: -3, moveMs: 99999, rounds: 1, minPieces: 30, maxPieces: 6,
  });
  expect(s).toMatchObject({ movesPerSide: 9, lookSeconds: 0, moveMs: 3000, rounds: 5, minPieces: 6, maxPieces: 30 });
});

test('sanitize snaps the time between moves to steps of 250 ms', () => {
  expect(sanitize({ ...PRESETS.easy, moveMs: 1130 }).moveMs).toBe(1250);
  expect(LIMITS.moveMs).toEqual([500, 3000]);
});

test('sanitize replaces wrong-typed fields with the easy value', () => {
  const s = sanitize({ ...PRESETS.hard, side: 'left', coordinates: 'yes', movesPerSide: 'many' });
  expect(s).toMatchObject({ side: 'toMove', coordinates: true, movesPerSide: 3 });
});
