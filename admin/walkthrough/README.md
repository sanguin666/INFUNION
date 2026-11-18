# How-to clips

The admin's how-to clips (one per menu page, 14 to 19 seconds each) are
recorded from the real admin running locally on the demo community,
Nuestra Señora del Carmen. Nothing is paid for: Playwright drives the
admin, `recorder.mjs` draws the cursor, click ripples and captions, takes
one screenshot per frame (time is virtual, so nothing stutters) and pipes
them to ffmpeg.

The admin plays them on the first sign-in (instead of the welcome tour),
from each page's tip ("Watch how"), and from Dashboard › Account. A
language with no clips keeps the welcome tour.

## Record

Needs ffmpeg, a Chromium-based browser and, running locally with the demo
seed: the API (3000), the admin (5173) and the app's web preview (8081,
shown in the phone on the home page).

```bash
npm install
node record.mjs es                  # every clip in Spanish
node record.mjs es events members   # only these
```

It writes `../public/walkthrough/<lang>/<clip>.mp4` and `.jpg` (poster),
and the titles and durations to `../public/walkthrough/manifest.json`,
which the admin reads at run time.

Environment: `BROWSER` (default Brave), `ADMIN_URL`, `API_URL`,
`SITE_URL` (the public address shown on the website page),
`WALKTHROUGH_EMAIL`, `WALKTHROUGH_PASSWORD` (default: the demo seed's).

## Another language

1. Copy `captions/es.json` to `captions/<lang>.json` and translate it
   (`title` is the clip's name in the player; `sample` is text typed on
   screen).
2. `node record.mjs <lang>`. The script picks elements by structure, not
   by their words, so it runs unchanged in every language.

The scripts never save anything: forms are opened and filled, never sent.
