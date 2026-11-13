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

- Phase 1 (core) and phase 2 (desktop, local data) are built.
- The desktop app has only been run on Linux (virtual screen) and in a browser.
  Nobody has run it on Windows yet: the user has a checklist in
  `docs/desktop/windows-checklist.md`. Ask for their results before building on
  top of the Windows-only parts.
- The user chose to skip the old Electron prototype. There is no data import
  and the look is our own design. Do not ask for the prototype again.

## Layout

    packages/core        data model, parser, mood engine, faces. Tests in test/.
    packages/star-view   draws the star (SVG text, and a live DOM version)
    packages/ui          Preact screens shared by the desktop list and the phone
    apps/desktop         Tauri 2 app. Rust in src-tauri/, three pages in src/
    apps/phone           (phase 4) PWA
    supabase/            (phase 3, 5) schema and edge functions
    tools/               scripts, for example the mood preview
    docs/                screenshots and the Windows checklist

npm workspaces. From the repo root:

    npm test                             core unit tests (Vitest)
    npm run typecheck                    core without DOM types, then the rest
    npm run test:e2e -w @star/desktop    32 browser checks, screenshots to docs/desktop
    cd apps/desktop/src-tauri && cargo test
    cargo check --target x86_64-pc-windows-msvc    type-checks the Windows-only code

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
  line. It is never a date after a reference word (ex, page, q, chapter, unit,
  also joined like chap/unit), after a study verb (study, read, do, revise...),
  or inside a list of numbers that follows one ("q 3.1 and 3.2"). The user
  asked for this: "study chap/unit 5.2" must not get a date.
- Exam words (exam, test, mock, quiz, final...) lose to homework words (hw,
  draft, essay, revise, corrections...).

Faces
- `packages/core/src/faces.json` is the single source. 16 by 16, one bit per
  pixel: `.` off, `#` on, `o` on and part of an eye (apps may shift eyes by one
  pixel to follow the mouse). One colour per mood.
- Lit pixels must stay inside the circle; `validateFaces` checks this.
- `frameToHex` packs a frame into 64 hex characters for the robot.
- Look: dark rounded star, round dot matrix screen, glow in the mood colour.

Desktop
- Tauri 2, not Electron: far less memory for an app that runs all day, and
  the native calls (full screen detection, cursor position) are plain Rust.
  The cost is no built-in per-pixel click-through, so we do it ourselves.
- One star window, larger than the star, with see-through room above and below
  for the speech bubble. A Rust thread (the watcher) reads the mouse position
  25 times a second (5 when the mouse is still), switches click-through off
  only while the mouse is on the star's shape, and sends the eye direction to
  the page only when it changes. The page itself runs no loops: one timer for
  the next animation frame, one for `nextCheckAt` (capped at a minute).
- Windows: showing a hidden window gives it keyboard focus. So the star is
  built visible with `focused(false)`, and for a full screen app it is parked
  off screen (`park_for_fullscreen`) instead of hidden. Do not replace that
  with hide/show.
- Linux: `set_ignore_cursor_events` panics on a window that was never shown.
  Call it only after the window is visible.
- The list and quick add windows are created on first use, on a separate
  thread (creating a window from a menu or shortcut handler can freeze on
  Windows), then kept hidden for fast reopening.
- Data: the Rust side keeps the JSON text and writes `data.json` atomically.
  Windows read and write it whole and get a `data-changed` event.
  `Store.apply` re-reads before every change so two windows cannot overwrite
  each other. This PC's own settings (size, position, sound, hide on full
  screen) are in `desktop-prefs.json` and are never synced.
- `apps/desktop/src/platform.ts` is the only file that talks to Tauri. In a
  plain browser it swaps in a stand-in (localStorage and BroadcastChannel),
  which is what the test bench and the e2e checks use.
- `color-scheme: dark` goes on the screens, never on `:root`, or a see-through
  window can get an opaque background.
- Adding a task always gets a plain "Added." bubble, even if the mood turns
  grumpy at the same moment. No bubble when the mood turns sleepy by itself.
- GitHub Actions (`.github/workflows/desktop.yml`) builds the Windows
  installer on every push and republishes it as the `desktop-latest`
  prerelease. Building locally stays possible (Node and Rust).

Phone and backend (planned)
- PWA for Chrome on Android, sharing core, star-view and ui. `CompanionApp` in
  packages/ui is the whole list screen; give it a `Store` with a phone
  `Backend`.
- Supabase for login, storage, sync, push reminders and the robot endpoint.
