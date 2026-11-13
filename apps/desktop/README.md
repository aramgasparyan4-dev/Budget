# Star Companion for the desktop

The floating star. It sits on top of your other windows, clicks pass through
everything except the star itself, and it hides while a game or video is full
screen.

## Install it (Windows 11)

1. Go to the repo's **Releases** page on GitHub and open
   "Star Companion for Windows (latest build)".
2. Download the file ending in `-setup.exe` and run it.
3. Windows shows a blue box saying it protected your PC. That is because the
   app is not signed by a company. Click **More info**, then **Run anyway**.
4. Click through the installer. The star appears in the bottom right corner.

To update, download the newest installer and run it again. Your data is kept.

## Use it

| Do this | What happens |
| --- | --- |
| Click the star | Opens your list: quick add, Today, Exams, Goals, Settings |
| Drag the star | Moves it. It remembers the spot |
| Hover over the star | Shows what it has to say |
| Right click the star | Menu: snooze, day off, size, start at login, quit |
| Ctrl+Shift+A, anywhere | Quick add box. Type, press Enter |
| Star icon near the clock | Same menu. Left click opens the list |

In the list, click a task's name to edit it or change its date. "Focus"
starts a timer on that task. When the timer ends the session is logged by
itself; a session stopped before 10 minutes does not count.

Your data is one file. Settings shows the folder it is in
(`%APPDATA%\dev.starcompanion.desktop\data.json`).

## Build it yourself (optional)

You only need this if you want to change the code and see it straight away.

1. Install Node.js (LTS) from https://nodejs.org.
2. Install Rust from https://rustup.rs. When it asks, let it install the
   Visual Studio C++ build tools.
3. In the project folder run `npm install`, then `npm run desktop`.

The first build takes several minutes. After that, changes show up in seconds.

There is also a test bench that runs the three windows in a normal browser,
with no Rust needed: `npm run dev -w @star/desktop`, then open
http://localhost:1420.

## How it is put together

    src-tauri/src/lib.rs         windows, tray, shortcut, the mouse watcher
    src-tauri/src/geometry.rs    star shape hit test, eye direction, bubble placement
    src-tauri/src/fullscreen.rs  "is a full screen app in front?" per system
    src-tauri/src/storage.rs     the data file and this PC's preferences
    src/star.ts                  the star window: face, bubble, clicks
    src/panel.tsx                the list window
    src/quickadd.tsx             the Ctrl+Shift+A window
    src/platform.ts              the one place that talks to the Rust side

All study logic (parser, moods, timer rules) is in `packages/core`, and the
screens are in `packages/ui`, so the phone app can share both.

Tests: `npm run test:e2e -w @star/desktop` runs 32 checks in a browser and
saves screenshots to `docs/desktop/`. `cargo test` in `src-tauri` checks the
maths and the file handling.
