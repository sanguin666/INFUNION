# infunion: backend

The NestJS API behind the member app, the admin dashboard, the community websites (`/c/<slug>`) and the public pages linked from emails (`/m/…`). See the [root README](../README.md) for the whole picture, local setup and deployment.

## Quick start

```bash
cp .env.example .env
npm install
npm run start:dev     # http://localhost:3000
npm run seed          # demo communities, safe to re-run
```

It needs PostgreSQL reachable with the credentials in `.env` (see `docker-compose.yml` at the repo root). Every optional service has a local fallback, so no keys are needed to run it: see the comments in `.env.example`.

## Structure

Each feature is its own NestJS module under `src/`:

| Folder | What it holds |
| --- | --- |
| `auth`, `users`, `user-pois` | Sign-in (members by email or phone code, admins by password, the superadmin's second factor), accounts, memberships and the guards |
| `pois`, `poi-settings`, `poi-page`, `poi-badges`, `home-versions` | Communities, their settings, home page, badges and saved home page versions |
| `active-modules` | Plans, billing, the free month and which modules a community has (`billing-rules.ts`, `module-places.ts`) |
| `events`, `announcements`, `livestreams`, `prayer-requests`, `community`, `daily-readings` | Content modules (`community` is Our group) |
| `service-requests`, `mass-intentions`, `member-messages` | Requests, Mass intentions and messages between the team and one member |
| `donations` | Contributions, Stripe Checkout and Connect, Bizum, payment links, projects, receipts, modelo 182 |
| `contacts` | Imported members, Write to members, the `/m/…` pages (email buttons, payment links, opt-out) |
| `notifications` | Push notifications (Expo) and event reminders |
| `translations`, `assistant` | AI translation and the member and admin assistants |
| `places-map`, `community-site` | The map of communities and each community's public website |
| `registrations` | Community registration from the landing page, approved by the superadmin |
| `superadmin`, `dashboard`, `moderation` | The superadmin section, the admin dashboard's figures and counts, moderation |
| `privacy`, `place-closure` | Consent, data export, retention, and closing a community |
| `app-updates`, `private-files`, `public-files` | Over-the-air app updates and file serving (local disk or R2) |
| `common` | Shared pieces: email layout and senders, storage, signed URLs, locks, enums |
| `migrations` | The checked-in schema |

## Scripts

- `npm run start:dev`: dev server with hot reload
- `npm run build`: production build (`dist/`)
- `npm run seed`: demo communities Nuestra Señora del Carmen (`DEMO-CARMEN`, `admin@carmen.example` / `demo1234`) and Crecer Juntos (`DEMO-CRECER-JUNTOS`, `admin@crecerjuntos.example` / `demo1234`), older demos and map neighbours
- `npm test`: unit tests
- `npm run test:e2e`: end-to-end tests against a real Postgres (`infunion_test`, emptied between tests)
- `npm run lint`: oxlint
- `npm run migration:generate -- src/migrations/Name`, `migration:run`, `migration:revert`
