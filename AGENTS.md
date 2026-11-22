# Aesymnetes

Chess exercises site: Astro + React, Mantine, chessground, chessops. Static, no backend.

## Working rules

- Put temporary files (scratch scripts, downloads, screenshots, throwaway installs) in `tmp/` inside this project, not in system temp directories. `tmp/` is git-ignored.

## UI feedback from the owner

- In `npm run dev`, the dev toolbar has a "Feedback for Claude" tool: the owner clicks an element, types a note and sends it. Notes land in `tmp/feedback/` with a screenshot of the element.
- `node scripts/feedback.mjs pending` prints unread notes and marks them read. A `UserPromptSubmit` hook in `.claude/settings.json` runs it with `--if-quiet` on every message, so notes may arrive attached to an unrelated prompt: act on them.
- The owner sends notes in bursts. Never start implementing while notes are still arriving: begin only after no new note has arrived for 2 minutes. `wait` and `pending --if-quiet` enforce this; when running `pending` by hand, check the newest note's time first.
- For each note, read the screenshot path, change the frontend, verify, and say in one line what changed.
- The owner wants notes picked up without being asked, and without check messages cluttering the chat. In a session that works on the frontend, run `node scripts/feedback.mjs wait` as a background command: it stays silent and exits only when a note arrives. Then run `pending`, apply the notes, and start `wait` again. Do not use a recurring cron check; it posts a message every time it runs.

## Commands

- `npm run dev` — dev server
- `npm run build` — static build into `dist/`
- `npm test` — Vitest
- `npm run test:e2e` — Playwright, desktop and phone, against a fresh build served by `astro preview` on port 4329. Tests in `e2e/` swap `positions.json` and `sequences.json` for fixtures with known answers and skip countdowns with Playwright's clock. Reports and traces go to `tmp/playwright/`. First time on a machine: `npx playwright install chromium`.
