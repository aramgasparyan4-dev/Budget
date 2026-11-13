# Star Companion

A study buddy shown as a star with a pixel face. Its mood follows whether the
user keeps up with homework, exams and goals. Runs on a Windows 11 PC, an
Android phone (Chrome), and later a 3D printed desk robot.

The user is a high school student. Write to them in plain English with no
emojis, and explain setup steps simply.

## How we work

- Phases: 1 core, 2 desktop, 3 Supabase sync and login, 4 phone PWA and
  notifications, 5 robot endpoint and docs. Stop at the end of each phase, show
  what works, and wait.
- Commit after each working step.
- Run the tests and the app before saying something works. Take a screenshot
  of every mood (`npm run faces:preview`). Say plainly what could not be tested.
- The user said changes, additions and improvements are welcome without
  asking first. Still tell them what changed and why.

## Status

- Phase 1 (core) is done.
- The old Electron prototype (`star-companion/`, with `companion-data.json`)
  was never added to this repo. Still owed once the user provides it: the data
  importer, any parser cases the prototype handled beyond the listed ones, and
  matching its exact colours and face art.

## Layout

    packages/core        data model, parser, mood engine, faces. Tests in test/.
    packages/star-view   draws the star as an SVG string (browser and Node)
    tools/               scripts, for example the mood preview
    docs/moods/          screenshots of every mood
    apps/desktop         (phase 2) Tauri 2 app
    apps/phone           (phase 4) PWA
    supabase/            (phase 3, 5) schema and edge functions

npm workspaces. `npm test` runs Vitest, `npm run typecheck` runs tsc.

## Decisions

Core
- Plain TypeScript. No UI, no storage, no clock: `now`, ids and timestamps
  are passed in. Everything else imports core; core imports nothing.
- Imports use `.ts` extensions and only erasable syntax (no enums), so the
  same files run in Vite, Vitest, Node and Deno (Supabase functions) unbuilt.
- Dates are plain strings: `2026-11-20` and `2026-11-20T16:45:00` (wall clock,
  no time zone). No `Date` objects inside the logic.
- Every record has `updatedAt` (ms) and deletes are kept as markers
  (`deletedAt`). Sync is "newest edit wins" per record.
- All changes go through the functions in `actions.ts` and `revision.ts`.

Mood engine (`evaluateMood(tasks, sessions, settings, now)`)
- First match wins: focus, celebrate, sleepy, afterglow, grumpy, worried,
  happy or proud, neutral. The rules are listed at the top of `mood.ts`.
- Principle: react more to doing than to not doing. Never guilt about
  something two weeks away. Messages are short and name the task and date.
- Changes from the user's starting rules, all agreed as "improve if better":
  1. Afterglow: for 30 minutes after finishing anything the star stays happy
     or proud, whatever else is due.
  2. Overdue homework plus something done today gives worried, not grumpy.
  3. On the day of an exam it says good luck instead of asking for revision.
  4. A day off with work done anyway shows happy or proud, not sleepy.
  5. Only overdue homework makes it grumpy. A goal or revision day past its
     date gets a neutral "pick a new date?".
  6. The result includes `nextCheckAt`, so apps set one timer and do not poll.
- Revision counts from a finished focus session or a manual log (the user
  asked for both). A session on the exam, on its revision days, or on any task
  of the same subject counts as revision for that exam.
- A focus session stopped before 10 minutes is thrown away.

Parser
- Day first dates (20.11 is 20 November). A weekday name means the next one,
  never today. A date without a year that has passed means next year.
- A bare number like 4.2 or 3/4 is only a date at the very start or end of the
  line, and never after words like ex, page, q, chapter.
- Exam words (exam, test, mock, quiz, final...) lose to homework words (hw,
  draft, essay, revise, corrections...).

Faces
- `packages/core/src/faces.json` is the single source. 16 by 16, one bit per
  pixel: `.` off, `#` on, `o` on and part of an eye (apps may shift eyes by one
  pixel to follow the mouse). One colour per mood.
- Lit pixels must stay inside the circle; `validateFaces` checks this.
- `frameToHex` packs a frame into 64 hex characters for the robot.
- Look: dark rounded star, round dot matrix screen, glow in the mood colour.

Desktop (phase 2, planned)
- Tauri 2, Windows 11 first. Click-through is done by tracking the cursor and
  switching it on and off, since Tauri has no per-pixel click-through.
- GitHub Actions builds the Windows installer, so the user installs nothing
  to get the app. Building locally stays possible (Node and Rust).

Phone and backend (planned)
- PWA for Chrome on Android, sharing core and star-view.
- Supabase for login, storage, sync, push reminders and the robot endpoint.
