// Inbox for UI notes sent from the dev toolbar's Feedback tool.
// Shared by the Astro integration (writes) and scripts/feedback.mjs (reads).
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INBOX = 'inbox.jsonl';
const DONE = 'done.jsonl';

function newId(now) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;
}

/**
 * Appends a note to the inbox. `png` is a data URL or null.
 * @returns the stored note, with `id`, `createdAt` and `screenshot` (a path or null)
 */
export function saveNote(dir, note, png) {
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  const id = newId(now);
  let screenshot = null;
  const match = typeof png === 'string' ? /^data:image\/png;base64,(.+)$/.exec(png) : null;
  if (match) {
    screenshot = join(dir, `${id}.png`);
    writeFileSync(screenshot, Buffer.from(match[1], 'base64'));
  }
  const stored = { ...note, id, createdAt: now.toISOString(), screenshot };
  appendFileSync(join(dir, INBOX), JSON.stringify(stored) + '\n');
  return stored;
}

/**
 * Returns unread notes and marks them read. The inbox is renamed before reading,
 * so a note written meanwhile goes to a fresh inbox and is never lost or handed over twice.
 */
export function takePending(dir) {
  const inbox = join(dir, INBOX);
  if (!existsSync(inbox)) return [];
  const claimed = join(dir, `claimed-${process.pid}-${Date.now()}.jsonl`);
  try {
    renameSync(inbox, claimed);
  } catch {
    return [];
  }
  const raw = readFileSync(claimed, 'utf8');
  const notes = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      notes.push(JSON.parse(line));
    } catch {
      // A torn or hand-edited line: skip it rather than lose the rest.
    }
  }
  if (raw) appendFileSync(join(dir, DONE), raw.endsWith('\n') ? raw : raw + '\n');
  rmSync(claimed);
  return notes;
}

/**
 * True when unread notes exist and none has arrived for `quietMs`
 * (each note appends to the inbox, so its modification time is the latest note's time).
 */
export function inboxQuietFor(dir, quietMs, now = Date.now()) {
  const inbox = join(dir, INBOX);
  if (!existsSync(inbox)) return false;
  const { size, mtimeMs } = statSync(inbox);
  return size > 0 && now - mtimeMs >= quietMs;
}

/** Readable text for Claude; empty string when there are no notes. */
export function formatNotes(notes) {
  if (notes.length === 0) return '';
  const lines = [`${notes.length} UI note${notes.length === 1 ? '' : 's'} from the Feedback tool in the dev toolbar:`];
  notes.forEach((n, i) => {
    const el = n.element ?? {};
    const r = el.rect;
    lines.push('');
    lines.push(`${i + 1}. "${n.note}"`);
    lines.push(`   Page: ${n.url} (${n.viewport?.width}x${n.viewport?.height}, ${n.colorScheme} mode)`);
    lines.push(`   Element: <${el.tag}> ${el.selector}${el.text ? ` with text "${el.text}"` : ''}`);
    if (r) lines.push(`   Position: x ${r.x}, y ${r.y}, ${r.width}x${r.height}`);
    if (el.source) lines.push(`   Source: ${el.source}`);
    if (n.screenshot) lines.push(`   Screenshot: ${n.screenshot}`);
  });
  return lines.join('\n');
}
