import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { formatNotes, saveNote, takePending } from './feedback-inbox.mjs';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'feedback-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const note = (text) => ({
  url: 'http://localhost:4321/exercises/missing-piece',
  title: 'Missing piece',
  note: text,
  viewport: { width: 1100, height: 900 },
  colorScheme: 'light',
  element: {
    tag: 'button',
    selector: '.mp-actions > button',
    text: 'Start',
    rect: { x: 634, y: 802, width: 84, height: 42 },
    source: null,
  },
});
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('takePending returns nothing when there is no inbox', () => {
  expect(takePending(dir)).toEqual([]);
});

test('saveNote stores the note with an id, a time and its screenshot', () => {
  const saved = saveNote(dir, note('Make it bigger'), PNG);
  expect(saved.id).toMatch(/^\d{8}-\d{6}-[a-z0-9]{4}$/);
  expect(saved.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(saved.screenshot).toBe(join(dir, `${saved.id}.png`));
  expect(readFileSync(saved.screenshot)).toEqual(Buffer.from('iVBORw0KGgo=', 'base64'));
});

test('saveNote without a screenshot stores none', () => {
  expect(saveNote(dir, note('x'), null).screenshot).toBeNull();
});

test('takePending hands each note over exactly once, in order', () => {
  saveNote(dir, note('first'), null);
  saveNote(dir, note('second'), null);
  expect(takePending(dir).map((n) => n.note)).toEqual(['first', 'second']);
  expect(takePending(dir)).toEqual([]);
  saveNote(dir, note('third'), null);
  expect(takePending(dir).map((n) => n.note)).toEqual(['third']);
});

test('handed-over notes are kept in done.jsonl', () => {
  saveNote(dir, note('first'), null);
  takePending(dir);
  expect(existsSync(join(dir, 'inbox.jsonl'))).toBe(false);
  const done = readFileSync(join(dir, 'done.jsonl'), 'utf8').trim().split('\n');
  expect(done.map((l) => JSON.parse(l).note)).toEqual(['first']);
});

test('a corrupt line is skipped, not fatal', () => {
  saveNote(dir, note('good'), null);
  appendFileSync(join(dir, 'inbox.jsonl'), '{not json\n');
  expect(takePending(dir).map((n) => n.note)).toEqual(['good']);
});

test('formatNotes is empty for no notes and readable otherwise', () => {
  expect(formatNotes([])).toBe('');
  const text = formatNotes([{ ...note('Make it bigger'), id: 'a', createdAt: 't', screenshot: '/x/a.png' }]);
  expect(text).toContain('1 UI note');
  expect(text).toContain('Make it bigger');
  expect(text).toContain('.mp-actions > button');
  expect(text).toContain('"Start"');
  expect(text).toContain('/exercises/missing-piece');
  expect(text).toContain('/x/a.png');
});
