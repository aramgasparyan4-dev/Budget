# Star Companion for the phone

The same star and the same lists as on the PC, as a web app you install from
Chrome on Android. Once installed it has its own icon, opens full screen,
and works with no internet.

## Turn the website on (once)

The app is a small website that GitHub hosts for free. Switch it on:

1. Open the repo on github.com and click **Settings** (top right of the repo).
2. In the left menu click **Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Set **Branch** to `gh-pages` and the folder to `/ (root)`. Click **Save**.
5. Wait about a minute, then reload the page. It shows the address, which is
   https://aramgasparyan4-dev.github.io/Budget/

## Install it on your phone

1. Open that address in **Chrome** on the phone.
2. Tap the three dots, then **Add to Home screen**, then **Install**.
   (Or open the app's Settings tab and tap "Install on this phone".)
3. Open it from the new star icon.

Tip: press and hold the star icon and tap **Quick add**. That opens the app
with the keyboard already up, so adding homework is: type, Enter.

## What it does

- Quick add at the top: "maths hw fri", "chem exam 20 nov", "goal read more".
- Today, Exams, Goals and Settings, with the star's face at the top.
- Focus timer. It logs the session by itself, and buzzes when time is up if
  the app is open.
- Works with no internet. Your data is saved on the phone.

## What it does not do yet

- **It does not share data with the PC.** That needs the sync step (a free
  Supabase account). Until then the phone and the PC each keep their own list.
- **No reminders.** A web app cannot wake itself up to send a notification
  while it is closed. Reminders need the same sync step.

## For changing the code

    npm run dev -w @star/phone        run it at http://localhost:1430
    npm run test:e2e -w @star/phone   browser checks on a pretend Pixel 7

`src/main.tsx` is the whole app: it gives the shared `CompanionApp` screen
(from `packages/ui`) a place to keep data (`src/storage.ts`). The offline
support is a service worker written by `vite.config.ts` at build time.
Every push rebuilds the site (`.github/workflows/phone.yml`).
