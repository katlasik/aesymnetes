import { afterEach, expect, test, vi } from 'vitest';
import { readJson, writeJson } from './storage';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

test('round-trips JSON', () => {
  vi.stubGlobal('localStorage', fakeStorage());
  writeJson('k', { a: 1 });
  expect(readJson('k')).toEqual({ a: 1 });
});

test('readJson returns null for a missing key and for invalid JSON', () => {
  const s = fakeStorage();
  s.setItem('bad', '{oops');
  vi.stubGlobal('localStorage', s);
  expect(readJson('missing')).toBeNull();
  expect(readJson('bad')).toBeNull();
});

test('readJson returns null and writeJson does not throw when localStorage throws', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  });
  expect(readJson('k')).toBeNull();
  expect(() => writeJson('k', 1)).not.toThrow();
});

test('both work when localStorage is undefined', () => {
  vi.stubGlobal('localStorage', undefined);
  expect(readJson('k')).toBeNull();
  expect(() => writeJson('k', 1)).not.toThrow();
});
