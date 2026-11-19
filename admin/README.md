# infunion: admin dashboard

The web dashboard where each community's team runs its community, and where infunion runs the platform (the superadmin section). React 19 + Vite + TypeScript. See the [root README](../README.md) for the whole picture.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b + vite build: run it before merging, it is the type check
```

It talks to the API at `VITE_API_URL` (default `http://localhost:3000`). The Home page's phone preview is the member app's web version at `VITE_APP_PREVIEW_URL` (default `http://localhost:8081`), so run the app too for it to show. Demo login: `admin@carmen.example` / `demo1234`.

## Where things are

- `src/layout/DashboardLayout.tsx`: the menu (Dashboard, Home page, Members, one page per active module, Community website, QR code to join, Plans & modules) and the community switcher.
- `src/pages/`: one file per page. Settings no longer exists: old links redirect to Home page or Dashboard.
- `src/superadmin/`: infunion's own section (Overview, Community requests, Communities, Accounts, Member questions, Technical health, Journal).
- `src/components/`: shared pieces, including Undo, the welcome tour and page tips, the how-to video player, the admin assistant, the phone preview and the logo.
- `src/i18n/translations.ts`: every string, in English, Spanish, French, Catalan, Valencian, Galician and Portuguese. A new string needs all seven.
- `public/modules/`: the "Learn more" screenshots of each module. Retake them when a module's screen changes.
- `public/walkthrough/`: the how-to videos, recorded by [`walkthrough/`](walkthrough/README.md).

Vite's dependency cache is kept in the OS temp directory (`vite.config.ts`), because sync clients such as Dropbox lock files inside a synced folder.
