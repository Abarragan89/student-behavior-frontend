# Marketing captures

Records the phone videos and screenshots on the marketing site
(`site/src/captures.ts`) from the real app, with made-up demo data.

```sh
npm run capture -- --publish    # record everything, copy into site/src/assets/captures/
```

Re-run it whenever a screen shown on the site changes. Look at the results in
`scripts/capture/.out/` before committing them.

## What it does

1. Starts a throwaway backend in Docker (`compose.yml`): Postgres and Redis in
   memory, and the API built from the Go repo. It uses fresh random keys every
   run and never touches your dev database.
2. Builds the app pointed at it and serves it on http://localhost:3100.
3. Runs each scene in `scenes/`. A scene seeds a new demo teacher (Ms. Lee and
   her made-up class, in `lib/fixtures.ts`), then drives a phone-sized Chrome
   with real touch events. A grey dot shows where the finger is.
4. Turns the frames into H.264 MP4s (`lib/encode.ts`). It also writes each
   video's first frame as a poster and its step times as `*.chapters.json`.
   The site shows the steps under the video.

## Needs

- Docker, ffmpeg (`brew install ffmpeg`) and Node 24.
- The backend repo next to this one, or `BACKEND_DIR=/path/to/student-behavior-go-backend`.
- Internet: the API fetches Google's sign-in settings when it starts.
- Free ports 18080 and 3100.
- Chromium for Playwright: `npx playwright install chromium` if it's missing.

## When it can run

The app is shown at 10:15 on a school morning. The page's clock can only run
behind the real one, since the backend turns future mark times into "now".
So the run needs a US time zone where it's a weekday between 10:30 AM and
11:15 PM; it picks Los Angeles, Denver, Chicago or New York. The student page
and the report print the zone name, so other zones are a last resort.

## While working on a scene

```sh
npm run capture -- --scene hero --keep-up   # one scene; leave the backend running
npm run capture -- --scene hero --reuse     # reuse it (and an app on :3100)
npm run capture -- --scene hero --headed    # watch the browser
```

Scenes: `stills`, `hero`, `classes`, `editor`, `sub`, `family`,
`teacher-conference`, and `smoke` (a quick check that sign-in works).

Tips:

- Start swipes away from buttons. A short drag reads as a tap (`scrollBy`
  skips drags under 48px).
- Keep takes under about 60 seconds, so the clock in the app stays at 10:15
  like the phone frame's status bar.
