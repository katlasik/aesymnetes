# Visual feedback tool — short design

Date: 2026-11-15

## Intent

The owner wants to point at things in the running app and say what to change, without describing locations in words and without copy-pasting anything into the terminal. Notes should reach Claude on their own.

## Goals

- Click an element in the running dev site, type a note, press Send.
- Notes land in the project and reach Claude without the owner pasting them.
- Nothing of this ships in the built site.

## Non-goals

- Feedback from other people or from the deployed site.
- Threads, replies or statuses in the browser.

## Approaches

1. **Astro dev toolbar app + inbox file + delivery by hook, watcher and schedule (chosen).** The toolbar app sends each note to the dev server, which writes it to `tmp/feedback/`. Claude picks notes up three ways: a watcher while Claude is working, a check every 2 minutes while the session is open (owner's request), and a prompt hook that adds unread notes to the owner's next message.
2. A separate page with the app in a frame: cannot see which element was clicked, because the frame is a different origin.
3. Notes appearing in the chat with no trigger at all: not possible; Claude Code starts a turn only on a message, a finished task or a scheduled prompt.

## Design

- **Integration** `src/dev/feedback/integration.ts`, registered in `astro.config.mjs`. Active only for `astro dev`. Adds a toolbar app and listens for `aesymnetes-feedback:send`.
- **Toolbar app** `src/dev/feedback/app.ts`. When switched on: hovering outlines elements, clicking one opens a note box (Send / Cancel), Escape leaves pick mode. Several notes can be sent in a row. Each note carries:
  - page URL and title, viewport size, colour scheme;
  - element tag, selector, visible text (trimmed), position and size;
  - Astro source file and line when the element has them;
  - a PNG of the element as it looks at that moment (via `html-to-image`, a dev dependency), so mid-exercise states are captured.
- **Inbox** `scripts/feedback-inbox.mjs` (plain JS, shared by the integration and the CLI):
  - `saveNote(dir, note, png)` appends to `inbox.jsonl` and writes `<id>.png`;
  - `takePending(dir)` atomically renames the inbox, returns its notes and moves them to `done.jsonl`, so each note is handed over exactly once.
- **CLI** `scripts/feedback.mjs pending` prints unread notes as readable text (with screenshot paths) and marks them read; prints nothing when there are none.
- **Delivery**
  - Project hook (`.claude/settings.json`, `UserPromptSubmit`) runs the CLI, so notes join the owner's next message.
  - A session schedule runs the check every 2 minutes; with no notes the turn ends at once. Scheduled checks fire only while Claude is idle, so notes sent mid-task are picked up right after. The schedule lives only in the Claude Code session that created it and expires after 7 days.
  - A separate file watcher was dropped: the schedule already covers the idle case, and mid-task notes are handled when the task ends.
- `CLAUDE.md` gets a short section describing the workflow.

## Calls made by Claude

- `html-to-image` for screenshots (dev dependency; never loaded by the built site).
- Notes live in `tmp/feedback/`, which is already git-ignored.
- Tests: unit tests for the inbox module; a headless Chrome check that a note sent from the toolbar lands in the inbox with a screenshot.
