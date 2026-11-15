# Aesymnetes

Chess exercises site: Astro + React, Mantine, chessground, chessops. Static, no backend.

## Working rules

- Put temporary files (scratch scripts, downloads, screenshots, throwaway installs) in `tmp/` inside this project, not in system temp directories. `tmp/` is git-ignored.

## UI feedback from the owner

- In `npm run dev`, the dev toolbar has a "Feedback for Claude" tool: the owner clicks an element, types a note and sends it. Notes land in `tmp/feedback/` with a screenshot of the element.
- `node scripts/feedback.mjs pending` prints unread notes and marks them read. A `UserPromptSubmit` hook in `.claude/settings.json` runs it on every message, so notes may arrive attached to an unrelated prompt: act on them.
- For each note, read the screenshot path, change the frontend, verify, and say in one line what changed.
- The owner wants a check for new notes every 2 minutes while a session is open: at the start of a session that works on the frontend, schedule one (session cron, `*/2 * * * *`) that runs the command above and ends silently when it prints nothing.

## Commands

- `npm run dev` — dev server
- `npm run build` — static build into `dist/`
- `npm test` — Vitest
