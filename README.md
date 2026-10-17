# ANSAE

Mobile + web app for churches and other points of interest: donations, events, and future modules, with a strong focus on accessibility for a mostly elderly audience.

## Repo structure

```
backend/   NestJS API (Node.js + TypeORM + PostgreSQL)
app/       Expo / React Native app (+ React Native Web) — the congregant-facing app
admin/     React (Vite) admin dashboard for community staff
landing/   Static marketing site (no build step) advertising ANSAE to churches
docker-compose.yml   Local PostgreSQL for development
```

## Base data model

- `users` — either a congregant (identified by phone number, signing in with a code sent by SMS) or a community admin (identified by email + password, used by the admin dashboard); each has a `language` (`en`/`es`/`fr`) for their own UI
- `pois` — a point of interest a user can join, with a name, `type` (only `church` for now — the name stays generic since other kinds of venues/organizations may be supported later), `language` (the language this POI publishes content in), address, and the QR code token used for onboarding
- `user_pois` — many-to-many join table: a user can belong to several POIs, with a `role` (`member` or `admin`) per POI — an admin user can manage several churches this way
- `active_modules` — the product modules subscribed to by a POI (e.g. `donations`, `events`), with subscription status and expiration date

## Local demo (no cost)

**Windows:** there are two one-click launchers at the root of the repo.

| | `start.bat` | `start-demo.bat` |
|---|---|---|
| For | working at home | demoing anywhere |
| Phone runs | Expo Go, via the QR code | the installed APK |
| Phone needs | the same Wi-Fi as this PC | any internet connection |
| Starts | Postgres, backend, admin, Expo | Postgres, backend, ngrok tunnel |

`start.bat` also rewrites `EXPO_PUBLIC_API_URL` in `app/.env` to this PC's current network IP every time it runs, so Expo Go always points at the right place. Re-run either file any time for a clean restart — each closes the windows it opened last time. Otherwise, follow the manual steps below.

### 1. PostgreSQL database

With Docker (recommended):

```bash
docker compose up -d
```

This starts a local Postgres on `localhost:5432` (database `ansae`, user `ansae` / password `ansae`).

> **Coming from the old `mypeople` database?** Postgres only creates the
> database and role named in `docker-compose.yml` the first time its volume
> is initialised, so an existing volume still holds `mypeople` and the
> backend won't be able to connect. Run `docker compose down -v` once, then
> `docker compose up -d` and re-run the seed below — everything in there is
> demo data, so nothing real is lost.

> No Docker handy? A local PostgreSQL install (`apt install postgresql`) also works: create an `ansae` user and database matching `backend/.env.example`.

### 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

The API starts on `http://localhost:3000`. In development, tables are created/synced automatically from the entities (`synchronize: true`) — no migration to run for the demo.

Seed two demo POIs (with all modules active and sample content) so the app has something real to show:

```bash
npm run seed
```

Safe to re-run — it only creates what's missing. The default demo is "Nuestra Señora del Carmen" (L'Eliana, Spain, QR token `DEMO-CARMEN`) with a full week of Masses, office hours, giving, requests and Mass intentions. Its admin login:

```
email:    admin@carmen.example
password: demo1234
```

In the app, "sign in" goes straight into the demo member (María García, +34600000001) with no code, as long as the backend has no SMS sender and is not in production. Set `DEMO_LOGIN=off` to get the normal phone login back, or `DEMO_LOGIN=on` to keep the demo sign-in on a production server with no SMS sender, like the Railway demo.

The older demo places are still there ("St. Mary's Community" and "Holy Trinity Chapel"), managed by `admin@stmarys.example` / `demo1234`.

### 3. Mobile app (Expo Go)

```bash
cd app
cp .env.example .env
npm install
npm run start
```

Scan the QR code shown in the terminal with the **Expo Go** app (Android/iOS) to launch the app on your phone, no app store submission needed.

To test in a browser: `npm run web`.

From the home screen, **"My places"** opens the place you were in last (or the seeded demo POI on a fresh device). **"Scan a place's QR code"** is a real scanner: tap **Use the camera**, point it at a flyer printed from the admin dashboard's **My QR** page, and it opens that place. **Simulate scan** is still there for when there's no flyer to hand, and the code under the QR can always be typed in instead. All three land on the same hub, with real Donations, Events, Announcements, Prayer Requests, and Livestream screens. From Announcements, the **+** button opens a compose screen where you can type a message and/or record a voice message (tap the microphone, speak, tap Stop, then Post) — works in `npm run web` too, with a normal browser microphone permission prompt.

### 4. Admin dashboard (community staff)

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Opens on `http://localhost:5173`. Sign in with the demo admin account above. If the account manages more than one POI (like the demo one), a switcher appears in the sidebar. From there: schedule Events, publish and edit Announcements, schedule Livestreams, moderate Prayer Requests and Community posts/replies (remove anything inappropriate), print a QR flyer from **My QR**, and manage **Settings** — active modules plus the community's own info (description, picture) shown in the app.

Its dependency cache is deliberately kept in the OS temp directory rather than
in `admin/node_modules/.vite` (see `admin/vite.config.ts`). Inside a synced
folder — Dropbox, OneDrive, Google Drive — the sync client holds the cache files
open, Vite's rename of them fails with `EBUSY: resource busy or locked`, and the
dashboard serves a blank page. Losing that temp cache only costs one
re-optimisation on the next start.

Content that's meant to come from community staff requires this admin login: posting, editing and deleting announcements and livestreams, scheduling events, moderating prayer requests and community posts, and toggling modules. What a congregant can post with an ordinary session (see the phone login below) is a prayer request, a "praying" tap, and community posts and replies. Reading needs no account at all.

### 5. Access from a physical phone

The app needs to reach the backend's API. On the same Wi-Fi network, edit `app/.env` and set `EXPO_PUBLIC_API_URL` to your dev machine's LAN IP (e.g. `http://192.168.1.23:3000`) — a phone can't resolve `localhost` as your computer. See the comments in `app/.env.example` for how to find your IP. `EXPO_PUBLIC_*` is inlined when the bundle is built, so restart Expo (`npx expo start --clear`) after changing it.

That covers development. For a demo away from your own network, build an APK instead — see below.

### Environments

The whole stack runs in three places, and every change goes through them in order:

| | Where | Branch | Database |
|---|---|---|---|
| **Development** | this PC, via `start.bat` | `dev` | local PostgreSQL |
| **Staging** | Railway, "staging" environment | `staging` | its own, demo data |
| **Production** | Railway, "production" environment | `production` | its own, demo data for now |

1. Finished work is merged into `dev` (the default branch). Check out `dev` and run `start.bat` to try it on this PC.
2. Once it works in development, `staging` is fast-forwarded to `dev`. Railway deploys it to `ansae-api-staging`, `ansae-admin-staging` and `ansae-app-staging` (`.up.railway.app`).
3. After sign-off on staging, `production` is fast-forwarded to `staging`. Railway deploys it to `ansae-api`, `ansae-admin` and `ansae-app`, which is what the demo APK uses.

Nothing skips a step: `staging` only ever receives what is on `dev`, and `production` only what is on `staging`. CI runs on pushes to all three branches and on pull requests.

### 6. Demo APK (Android, no laptop needed)

For showing the app to someone off your network, a standalone build beats Expo Go: the JavaScript ships inside the APK, so there's no Metro dev server, no QR code and no Expo Go login involved. The only thing that still has to be reachable is the backend.

1. The APK talks to the backend hosted on [Railway](https://railway.com) (EU West), at `https://ansae-api.up.railway.app`. That URL is in the `preview` profile's `env` block in `app/eas.json`, which is what gets baked into the build. Railway redeploys it on every push to `production`, so this PC doesn't need to be on. See "Environments" below.

   The Railway service builds from the `backend/` folder (Root Directory `/backend`), with build command `npm run build`, pre-deploy command `npx typeorm migration:run -d dist/data-source.js && node dist/seed.js`, start command `npm run start:prod`, a PostgreSQL database in the same project, and a volume mounted at `/data` for uploads. Its variables are `NODE_ENV=production`, `DEMO_LOGIN=on`, `JWT_SECRET`, `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` taken from the database's `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`, `UPLOADS_DIR=/data/uploads` and `PRIVATE_UPLOADS_DIR=/data/private`.

   The admin dashboard is a second Railway service in the same project, at `https://ansae-admin.up.railway.app`: Root Directory `/admin`, no build or start command (Railway serves the Vite build itself), and the variables `VITE_API_URL=https://ansae-api.up.railway.app` and `VITE_DONATION_CURRENCY=EUR`, which are read at build time. The backend's `CORS_ORIGINS` lists the admin's address and `http://localhost:5173`.

   The app's web version, which the admin's phone preview shows, is a third Railway service at `https://ansae-app.up.railway.app`: Root Directory `/app`, no build or start command (`npm run build` runs `expo export --platform web`, and Railway serves the result), and `EXPO_PUBLIC_API_URL=https://ansae-api.up.railway.app`. The admin's `VITE_APP_PREVIEW_URL` points at it, and the backend's `CORS_ORIGINS` lists it too.

2. To demo against this PC instead, `start-demo.bat` still exposes the local backend through ngrok. Put its `NGROK_DOMAIN` URL back in `app/eas.json` and rebuild.
3. Build and install:

   ```bash
   cd app
   npm install --global eas-cli
   eas login
   eas init          # adds your Expo project id to app.json
   eas build --profile preview --platform android
   ```

   EAS returns a download link when the build finishes. Open it on the phone to install the APK.

   **If the build fails on a git check** — either "git command not found", or the self-contradicting "git found, but `git --help` exited with status undefined" — build with version control disabled instead:

   ```powershell
   $env:EAS_NO_VCS=1
   eas build --profile preview --platform android
   ```

   EAS only uses git to read the branch name and commit hash for build metadata. With `EAS_NO_VCS=1` it still respects `.gitignore`, so `node_modules` stays out of the upload and the resulting APK is the same.

   **Free alternative when the Expo build allowance is used up:** GitHub builds the same APK on its own machines. On github.com, open the repo's **Actions** tab, pick **Demo APK**, press **Run workflow** (keep `production`), and wait for the green tick (about 15–20 minutes). The APK is then at [releases/tag/demo-apk](https://github.com/sanguin666/SOMOS/releases/tag/demo-apk): open that page on the phone and tap `ansae.apk`. It is signed with the same key as the EAS builds, so it installs over the existing app. One-time setup: create a token at expo.dev > Account settings > Access tokens, then add it on GitHub under Settings > Secrets and variables > Actions > New repository secret, named `EXPO_TOKEN`. The workflow is `.github/workflows/demo-apk.yml`.

On the day, just open the app on the phone. Nothing to start, scan or type.

Re-run the build only when the app code changes. Backend changes need nothing rebuilt, as long as the backend URL stays the same.

> **iOS:** the same flow needs a paid Apple Developer account to install on a physical device, so this route is Android-only for now.

### Tunnelling the dev server instead (fiddly)

If you really need live reload on a phone off your network, note that `ngrok http 3000` exposes only the **backend**. The QR code comes from the Expo dev server, a separate process on port 8081, which needs its own tunnel. Two things to know:

- `npx expo start --tunnel` routes through a shared ngrok account run by Expo that carries no uptime guarantee and frequently fails. Prefer your own tunnel and point Expo at it with `EXPO_PACKAGER_PROXY_URL=https://<tunnel-host>`, then use **Enter URL manually** in Expo Go.
- Don't put both services behind one ngrok URL with `--pooling-enabled`. Pooled endpoints are load balanced per request, so calls land on whichever of the two servers ngrok picks and the app breaks intermittently. Give each service its own hostname, using a second provider if needed (`cloudflared tunnel --url http://localhost:8081`).

## Scanning a place's QR code

The flyer encodes a link to the landing site (`https://<landing>/?token=<qrCodeToken>#join`), not the bare token, so that someone scanning it with their phone's own camera app lands on a page explaining what Ansae is. The in-app scanner (`app/src/screens/ScanQRScreen.tsx`) pulls the token back out of that link — see `app/src/qr.ts`, which also accepts a bare token and rejects QR codes that aren't ours rather than sending them to the backend as a lookup.

Scanning uses `expo-camera`'s `CameraView` with `barcodeScannerEnabled` set in `app.json`. Permission is asked for on the screen itself, by a button, rather than on app start — an audience that mostly doesn't trust permission prompts should see what it's for first. A refused permission is not a dead end: typing the code printed under the QR does the same job, and that path is on the screen whether or not the camera works.

## Accessibility (app)

The accessibility foundations live in `app/src/theme` and `app/src/components`:

- `theme.ts` — high-contrast palette and a deliberately large text size scale
- `AccessibleText` — never disables the system text scaling (`allowFontScaling`)
- `AccessibleButton` — large touch target (≥64px), large text, no complex gestures
- `Screen` — layout with generous margins and safe area (notch/system bars) support

Every new screen should reuse these components instead of raw `Text`/`Pressable`.

`app/src/theme/poiThemes.ts` layers a per-POI-`type` accent color and wording on top of that base theme (e.g. for the hub screen's hero banner) — it only ever changes brand color/imagery, never text size, contrast, or touch target sizing, which stay fixed regardless of POI type.

## Product modules

Each POI activates modules à la carte (`active_modules`). Currently built:

- **Donations** — in-app donations through Stripe Checkout (see [Donations & Stripe](#donations--stripe) below); without a Stripe key the screen falls back to a demo confirmation that records the gift without taking a payment
- **Events** — Masses, baptisms, weddings, funerals, communions, etc. (`backend/src/events`); scheduling/editing is admin-only, the app only reads them (a reminder toggle per event is a local, device-only preference — there's no account yet to attach it to)
- **Announcements** — bulletin/newsletter-style posts (`src/announcements`), optionally recorded as a voice message instead of typed; admin-only throughout, since an announcement is the community speaking to its members. The app's compose screen and its voice recording are there for a signed-in admin; everyone else sees the list without a **+** button
- **Prayer Requests** — community prayer requests with a "praying" counter (`src/prayer-requests`); posting and the counter need a signed-in congregant, moderation (removal) is admin-only from the dashboard
- **Livestream** — links out to livestreamed/recorded services on an external platform (`src/livestreams`); scheduling/editing is admin-only
- **Community** — a discussion board: posts with flat (non-nested) comment replies (`src/community`); posting and replying need a signed-in congregant, moderation is admin-only from the dashboard
- **Celebration times** — part of Events: an event has a kind (Mass, confession, adoration, prayer, office hours, other) and can repeat every week, with an optional end time and last date. The app works out each week's occurrences on the phone (`app/src/utils/schedule.ts`), shows a timetable at the top of the events screen and a short "next Mass" block on the place's home page (`celebration_times` page block)
- **Requests** — a member asks the office for a baptism, a wedding, a funeral, a certificate, a meeting… (`src/service-requests`), then follows it in the app: status, appointment, the documents the office asks for (sent as photos or PDFs) and a conversation with the office. Files go to `uploads-private/` (`PRIVATE_UPLOADS_DIR`), never served as-is: they open through short-lived signed links (`common/signed-url`). Needs a signed-in member; the dashboard side is admin-only
- **Mass intentions** — a member asks for a Mass to be said for someone, for one of the coming Masses or "whenever the community can", paying the community's offering through the same Stripe flow as a gift (`src/mass-intentions`). The dashboard keeps the register grouped by celebration, printable for the celebrant, and takes intentions given at the office

Every place's home page opens with small tiles, its **badges** (`src/poi-badges`, `pois/:poiId/badges`): next Mass, office open or closed, next confessions and a campaign's progress, all worked out on the phone (`app/src/utils/badges.ts`), plus short messages the office writes (40 characters, an important one in orange, an optional last day and a module a tap opens). The dashboard's Home page adds as many as the place wants, switches them on and off and sets their order; a place that never touched them shows the next Mass and the office hours.

The dashboard's Home page shows the place's home page in a phone beside the editor, updated as you type, before anything is saved (unsaved badges and sections are outlined in dashes). The phone is the real app: its web version, opened with `?preview=<poi id>` (`app/src/preview/`), which the dashboard feeds its editor's content through `postMessage`. It loads from `VITE_APP_PREVIEW_URL` (default `http://localhost:8081`, where `npm run start` in `app/` serves the web version), so the app has to be running for the preview to show.

Donations also gained campaigns with a goal (`pois/:poiId/campaigns`), the Sunday collection as a purpose, monthly gifts (Stripe subscriptions, signed-in givers only, stoppable from the app) and yearly tax receipts: a printable receipt per giver and a CSV export for the treasurer (in Spain, the starting point of the modelo 182). The community's legal details for the receipts are set on the dashboard's Donations page.

More modules can be added following the same pattern (an entry in `ModuleType`, its own tables, its own NestJS module).

## Donations & Stripe

The donate screen sends people to **Stripe Checkout** — Stripe's own hosted
payment page, opened in the phone's browser — rather than collecting card
details in the app. Nothing sensitive touches our code, and it works in Expo
Go, in the APK and on the web target alike.

Stripe is optional. With no `STRIPE_SECRET_KEY` in `backend/.env` the donate
screen says "Demo mode · No payment will be taken" and records the gift
anyway, so a fresh clone still demos end to end and the admin dashboard's
graph has data.

To take real (test) payments:

1. Create a Stripe account and copy the **test** secret key (`sk_test_…`) from
   the dashboard — test mode costs nothing and needs no account activation.
2. Put it in `backend/.env` as `STRIPE_SECRET_KEY`, and restart the backend
   (the key is read at startup).
3. Donate from the app and pay with a [Stripe test card](https://docs.stripe.com/testing):
   `4242 4242 4242 4242`, any future expiry, any CVC.

Amounts are charged in `DONATION_CURRENCY` (`eur` by default); the admin
dashboard formats its figures with `VITE_DONATION_CURRENCY`, which has to
match.

How a gift moves through the system:

- `POST /pois/:poiId/donations/checkout` creates the `donations` row as
  `pending` and returns Stripe's checkout URL (or `mode: 'demo'`).
- The payer finishes on Stripe and lands on `/donations/return`, a plain page
  telling them to go back to the app — Stripe only redirects to http(s) URLs,
  so it can't reopen the app itself.
- The app polls `GET /pois/:poiId/donations/:donationId/status`, which
  re-checks the session with Stripe, and shows the thank-you screen once the
  payment lands.
- Only `completed` gifts count towards the admin dashboard's totals, so an
  abandoned checkout never inflates a community's figures.
- `POST /stripe/webhook` does the same job from Stripe's side. It needs a
  publicly reachable backend and `STRIPE_WEBHOOK_SECRET`, so the local demo
  doesn't use it — polling covers that case.

Going live later means swapping the test key for a live one; Stripe's fee in
Spain is 1.5% + &euro;0.25 per European card.

## Languages

The app and admin dashboard UI (menus, buttons, labels, error messages — everything that isn't content posted by a POI) is available in English, Spanish, and French.

- **POI language** (`pois.language`) — the language a POI's own staff publish content in (announcements, prayer requests, community posts, livestream titles, etc.). Set from the admin dashboard's Settings page ("Content language" card); it's metadata only for now — posted content is stored and shown exactly as written, in that language, to every reader regardless of their own UI language.
- **User language** (`users.language`) — each person's own UI language preference. In the app, a language pill switcher on the home screen sets it (device-local, via AsyncStorage, since there's no real congregant account/session yet). In the admin dashboard, it's set from the login screen or the sidebar switcher, stored locally, and synced to the signed-in admin's account (`PATCH /auth/me/language`) so it follows them across devices/browsers.
- **Not built yet:** automatic translation of POI-authored content into each reader's own language. The `language` fields above lay the groundwork for this (an AI translation service could use the POI's source language and the reader's target language) but for now a POI's posts are shown as-is, in the POI's language, to everyone.

## Admin auth

The admin dashboard (`admin/`) uses a real email + password login (`POST /auth/login`, JWT), separate from the congregant app's phone login below. A `PoiAdminGuard` (`backend/src/auth/guards`) checks the caller has an `admin` `user_pois` row for the `:poiId` in the URL before allowing an admin-only action — see `backend/src/auth` for the guard and `backend/src/user-pois/user-pois.service.ts` for the membership lookups it uses.

## Superadmin

ANSAE's own section of the admin (Seb, 17 Oct 2026): the whole app's figures (revenue of the month, members, donations), every community (create, edit, admins, modules, offering a module, suspending, deleting), every account, server health and a Journal of who did what.

How it is locked:

- **One account, named by the server.** `SUPERADMIN_EMAIL` on the backend is the superadmin. On every boot `SuperadminBootstrap` flags that account and unflags any other; nothing in the API can set the flag, and every check also compares the email to the variable, so the database alone can't make someone superadmin.
- **First sign-in.** If the account doesn't exist, it is created with `SUPERADMIN_INITIAL_PASSWORD` (12 characters or more). Remove that variable once signed in and the password changed (Santé technique shows a warning while it is set).
- **Password, then a six-digit code.** After the ordinary sign-in, the admin asks for a code from an authenticator app (Google Authenticator, 1Password...). Setting up the app asks for the password again. The code buys a separate superadmin token (`aud: ansae-superadmin`) good for one hour, kept in the browser tab's session storage only. Ordinary tokens never pass `SuperadminGuard`. Each code works once.
- **Lost phone.** Set `SUPERADMIN_RESET_2FA=yes`, restart, set the app up again, then remove the variable.
- **Guessing.** Five wrong passwords on an admin address, or five wrong superadmin codes, lock it for 15 minutes.
- **Seeing a community's admin.** `PoiAdminGuard` lets the superadmin in only with a superadmin token, and every change made that way goes in the Journal (`audit_log`), as do admin sign-ins, failed ones included.
- The authenticator secret is stored encrypted (AES-256-GCM, key from `SUPERADMIN_SECRET_KEY` or else `JWT_SECRET`). Superadmin answers carry `Cache-Control: no-store`.

## Who can call what

Every write route is behind something now. The rules, in one place:

| Route | Who |
| --- | --- |
| `GET` on places, events, announcements, prayer requests, community, livestreams, page blocks | anyone |
| `POST` a prayer request, a "praying" tap, a community post or reply | any signed-in congregant |
| `POST` an announcement | an admin of that place — an announcement is the community speaking |
| creating a community (`POST /superadmin/pois`) and everything else under `/superadmin` | the superadmin only, with a superadmin token (see below) |
| `PATCH`/`DELETE` a place, its modules, its settings, its page, and all moderation | an admin of *that* place (`PoiAdminGuard`) |
| anything under `/users/:id` or `/users/:userId/pois` | that user, and only that user (`SelfGuard`) |
| `POST` a donation, and the Stripe webhook | anyone (a gift doesn't need an account; the webhook verifies Stripe's signature) |
| a monthly gift, and the member's own monthly gifts and receipts | a signed-in member, for their own only |
| `POST` a request, and reading, answering, cancelling or sending documents for it | the signed-in member who made it (anyone else gets a 404) |
| the office's side of requests, the intentions register, campaigns and receipt exports | an admin of that place |
| `POST` a Mass intention | anyone (signed in or not) |
| `GET /private-files/…`, `GET /receipts/…` | whoever holds a signed link, until it expires (about an hour) |

Three things changed shape rather than just gaining a guard:

- `GET /users` (which returned every account, password hashes included, to anyone who asked) and `POST /users` are **gone**. Accounts are created by signing in, and nothing in the app or dashboard ever called either route.
- `User.passwordHash` is now `select: false`, so no query returns it unless it asks by name — only `UsersService.findByEmailForLogin` does.
- The guards live in `auth/auth-guards.module.ts` rather than `AuthModule`, and `PoiAdminGuard` reads the `user_pois` table directly. `AuthModule` needs `users`, `user-pois` and `pois`, so guards living there made every guarded module's imports circular.

## Congregant login (phone + SMS code)

The app signs someone in with a phone number and a 6-digit code — no password, which is deliberate for an audience that mostly doesn't want to manage one.

- `POST /auth/phone/request-code` `{ phone }` — sends a code, valid 10 minutes. One code per number per minute, five per hour, five wrong guesses before the code is burnt. Only a bcrypt hash of the code is stored (`phone_verification_codes`).
- `POST /auth/phone/verify` `{ phone, code, firstName? }` — returns `{ accessToken }` (the same 7-day JWT the admin dashboard uses). A number that verifies for the first time gets an account right there; `firstName` is only written on that first sign-in.
- `GET /auth/me` now also returns `phone` and `pois` (every place the person belongs to), so "my places" follows the account instead of the device.
- `POST /auth/me/pois` / `DELETE /auth/me/pois/:poiId` — join or leave a place as whoever the token belongs to. The app calls join every time a signed-in person opens a place.

**There is no SMS account wired up.** `ConsoleSmsSender` (`backend/src/auth/sms/sms-sender.ts`) logs the code instead of sending it, and because nothing is really delivered the request endpoint hands the code back as `devCode` — the login screen displays it, so the flow is usable on a laptop with no phone involved. Both of those stop the moment a real sender is configured, and `devCode` is never returned when `NODE_ENV=production`. Adding Twilio is a new `SmsSender` subclass and one line in `auth.module.ts`; nothing else in the flow changes.

## Settings & the QR flyer

The admin dashboard's **Settings** page (`admin/src/pages/SettingsPage.tsx`, `PATCH /pois/:poiId/profile`) combines the active-module toggles with the POI's own public info — a description and a picture (pasted in as a URL for now; the upload pipeline used for announcement voice messages could be reused for direct uploads later) — plus the content-language picker.

The **My QR** page (`admin/src/pages/MyQrPage.tsx`) generates a printable flyer for the community's entrance: a QR code (via the `qrcode` package) encoding a link to the landing site's `#join` section (`/?token=<poi token>#join`), an editable headline/subtext (`qrFlyerHeadline`/`qrFlyerSubtext` on `Poi`, defaulting to generic copy if left blank), and a "Print / Save as PDF" button that uses the browser's own print dialog with a dedicated print stylesheet — no PDF library needed.

## Tests and CI

```bash
cd backend && npm test        # unit tests, no database needed
cd backend && npm run test:e2e   # boots the real app against Postgres
cd app && npm test            # pure logic (QR parsing); npm run typecheck for the rest
cd admin && npm run build     # tsc -b, so this is the typecheck too
```

The e2e tests use the database named by `DB_NAME`, defaulting to `ansae_test`, and **truncate every table between tests** — never point them at your development database. Create it once with `createdb ansae_test` (or `docker compose exec db createdb -U ansae ansae_test`). They run one file at a time for that reason.

What's covered is the part that can break quietly: the login flow (one-shot codes, expiry, throttling, a number spelled two ways), and the access-control table above, as tests that call the real endpoints. A guard that stops applying is not something a type checker or a lint rule notices.

`.github/workflows/ci.yml` runs all of it on every push and pull request, with Postgres as a service container. It also applies the checked-in migrations to an empty database and asks TypeORM whether the entities still match — an entity changed without a migration fails the build, because that combination is a deploy that breaks on boot.

## Going to production

The demo defaults are deliberately convenient, and each one is a different setting in production rather than something to remember:

| | Development | Production (`NODE_ENV=production`) |
| --- | --- | --- |
| Schema | `synchronize: true` — built from the entities on every start | migrations only, applied on boot (`migrationsRun`), `synchronize` off |
| `JWT_SECRET` | falls back to a fixed development secret | **required** — the app refuses to start without it |
| CORS | any origin, so a phone on the LAN and a browser both work | only the origins listed in `CORS_ORIGINS`, and none if it's unset |
| Login codes | returned in the response as `devCode`, since nothing is sent | never returned; configure a real `SmsSender` |
| Uploads | `./uploads` next to the backend | still local disk — set `UPLOADS_DIR` to a mounted volume, or swap in S3 |

### Migrations

`src/migrations/` holds the schema as checked-in migrations, and `src/data-source.ts` is what the TypeORM CLI loads. They point at the compiled output, so each script builds first:

```bash
npm run migration:generate -- src/migrations/WhatChanged   # after editing an entity
npm run migration:run                                      # apply
npm run migration:revert                                   # undo the last one
```

Development doesn't need any of this — it still builds the schema straight from the entities, so an entity edit shows up on the next save. Generate a migration when you change an entity so production has a path from the old shape to the new one; `synchronize` against real data is how a renamed column silently becomes a dropped one.

### Still open

Uploads are the real remaining gap: local disk is fine for one small server with a persistent volume, and wrong for anything that replaces its disk between deploys or runs more than one instance. Every caller already goes through `common/upload/multer-storage.ts`, so this is a change of storage engine, not a change to the modules that upload.

## Marketing landing page

`landing/` is a small static site (plain HTML/CSS/JS, no build step, no framework) advertising ANSAE to churches — open `landing/index.html` directly in a browser, or serve the folder with any static file server (e.g. `npx serve landing`). It's one scrolling page: features, pricing, and the "join" flow are all sections of `index.html` (`#pricing`, `#join`), not separate pages. The `#join` section is what the QR flyer's code links to: today it explains how to get the app (the store links are placeholders — the app isn't published yet) and displays the scanned POI token for manual entry as a fallback (`landing/assets/main.js` reads it from the URL's `?token=` query param). Text is in Spanish by default, switchable to English/French via the header pills (`landing/assets/i18n.js`, persisted in `localStorage`). It is hosted on Railway like the rest (Root Directory `/landing`, no build or start command: Railway serves the folder as it is) at `https://ansae-landing.up.railway.app`, with `ansae-landing-staging` for staging. The admin's `VITE_LANDING_URL` (what the QR flyer opens) is left at its `https://ansae.app` default for now. A real domain can later be attached to that service in Railway.
