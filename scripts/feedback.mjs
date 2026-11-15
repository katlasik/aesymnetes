// UI notes from the dev toolbar's Feedback tool.
//
//   node scripts/feedback.mjs pending   prints unread notes and marks them read; prints nothing when there are none
//   node scripts/feedback.mjs pending --if-quiet
//                                       the same, but only once no new note has arrived for 2 minutes
//   node scripts/feedback.mjs wait      waits quietly until unread notes exist and no new note has arrived
//                                       for 2 minutes, then prints one line and exits
//                                       (does not mark anything read; run `pending` afterwards)
import { fileURLToPath } from 'node:url';
import { formatNotes, inboxQuietFor, takePending } from './feedback-inbox.mjs';

const dir = fileURLToPath(new URL('../tmp/feedback/', import.meta.url));
const POLL_MS = 3000;
// The owner sends notes in bursts; wait until a burst is over before starting work.
const QUIET_MS = 2 * 60 * 1000;
const command = process.argv[2] ?? 'pending';

if (command === 'pending') {
  // --if-quiet: hand notes over only once no new note has arrived for 2 minutes (used by the hook).
  if (process.argv.includes('--if-quiet') && !inboxQuietFor(dir, QUIET_MS)) process.exit(0);
  const text = formatNotes(takePending(dir));
  if (text) process.stdout.write(text + '\n');
} else if (command === 'wait') {
  const timer = setInterval(() => {
    if (inboxQuietFor(dir, QUIET_MS)) {
      clearInterval(timer);
      process.stdout.write('UI notes are waiting: run `node scripts/feedback.mjs pending`\n');
    }
  }, POLL_MS);
} else {
  process.stderr.write(`Unknown command "${command}". Use: pending | wait\n`);
  process.exit(1);
}
