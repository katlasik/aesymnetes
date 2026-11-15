// UI notes from the dev toolbar's Feedback tool.
//
//   node scripts/feedback.mjs pending   prints unread notes and marks them read; prints nothing when there are none
//   node scripts/feedback.mjs wait      waits quietly until an unread note exists, then prints one line and exits
//                                       (does not mark anything read; run `pending` afterwards)
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNotes, takePending } from './feedback-inbox.mjs';

const dir = fileURLToPath(new URL('../tmp/feedback/', import.meta.url));
const inbox = join(dir, 'inbox.jsonl');
const POLL_MS = 2000;
const command = process.argv[2] ?? 'pending';

const hasPending = () => existsSync(inbox) && statSync(inbox).size > 0;

if (command === 'pending') {
  const text = formatNotes(takePending(dir));
  if (text) process.stdout.write(text + '\n');
} else if (command === 'wait') {
  const timer = setInterval(() => {
    if (hasPending()) {
      clearInterval(timer);
      process.stdout.write('UI notes are waiting: run `node scripts/feedback.mjs pending`\n');
    }
  }, POLL_MS);
} else {
  process.stderr.write(`Unknown command "${command}". Use: pending | wait\n`);
  process.exit(1);
}
