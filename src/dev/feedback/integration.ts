import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
// @ts-expect-error plain JS module shared with scripts/feedback.mjs
import { saveNote } from '../../../scripts/feedback-inbox.mjs';

export const SEND_EVENT = 'aesymnetes-feedback:send';
export const SAVED_EVENT = 'aesymnetes-feedback:saved';

/** Dev-only: a toolbar tool for pointing at elements and leaving UI notes in tmp/feedback/. */
export default function feedback(): AstroIntegration {
  return {
    name: 'aesymnetes-feedback',
    hooks: {
      'astro:config:setup': ({ command, addDevToolbarApp }) => {
        if (command !== 'dev') return;
        addDevToolbarApp({
          id: 'aesymnetes-feedback',
          name: 'Feedback for Claude',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
          entrypoint: fileURLToPath(new URL('./app.ts', import.meta.url)),
        });
      },
      'astro:server:setup': ({ toolbar, logger }) => {
        const dir = fileURLToPath(new URL('../../../tmp/feedback/', import.meta.url));
        toolbar.on(SEND_EVENT, (payload: { note: unknown; png: string | null; clientId: string }) => {
          try {
            const stored = saveNote(dir, payload.note, payload.png);
            logger.info(`UI note saved: ${stored.id}`);
            toolbar.send(SAVED_EVENT, { clientId: payload.clientId, ok: true, id: stored.id });
          } catch (err) {
            logger.error(`Could not save UI note: ${String(err)}`);
            toolbar.send(SAVED_EVENT, { clientId: payload.clientId, ok: false });
          }
        });
      },
    },
  };
}
