// Prints unread UI notes from the dev toolbar's Feedback tool and marks them read.
// Prints nothing when there are none.
//
//   node scripts/feedback.mjs pending
import { fileURLToPath } from 'node:url';
import { formatNotes, takePending } from './feedback-inbox.mjs';

const dir = fileURLToPath(new URL('../tmp/feedback/', import.meta.url));
const command = process.argv[2] ?? 'pending';

if (command === 'pending') {
  const text = formatNotes(takePending(dir));
  if (text) process.stdout.write(text + '\n');
} else {
  process.stderr.write(`Unknown command "${command}". Use: node scripts/feedback.mjs pending\n`);
  process.exit(1);
}
