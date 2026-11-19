# infunion: member app

The app members use to follow their communities. Expo SDK 57 / React Native, built for Android (APK) and the web (`web.infunion.app`, also the admin's phone preview). See the [root README](../README.md) for the whole picture.

## Quick start

```bash
cp .env.example .env    # EXPO_PUBLIC_API_URL: your computer's LAN IP on a phone
npm install
npm run start           # scan the QR code with Expo Go
npm run web             # or in a browser, http://localhost:8081
npm test                # pure logic tests (vitest)
npm run typecheck
```

`EXPO_PUBLIC_*` values are inlined at build time: restart with `npx expo start --clear` after changing them.

## Where things are

- `App.tsx`: the app shell and navigation between screens.
- `src/components/PoiShell.tsx` and `src/screens/PoiHubScreen.tsx`: a community's frame, home and bottom menu.
- `src/screens/`: one file per screen (welcome and sign-in, the community's modules, Donate, the map, the assistant, More…).
- `src/components/`: shared pieces. `AccessibleText`, `AccessibleButton` and `Screen` are the base of every screen; reuse them.
- `src/theme/`: colours, light and dark appearance, and the accent of each kind of community (`placeKinds.ts`, kept in step with `admin/src/placeKinds.ts`).
- `src/i18n/`: every string in seven languages.
- `src/notifications/`: push notifications and event reminders.
- `src/updates/`: over-the-air updates and the "new APK available" check.
- `src/preview/`: the mode the admin's live phone preview uses (`?preview=<community id>`).

## Builds

The Android APK is built by the GitHub workflow **Demo APK** (on `production`) and published on the `demo-apk` release. JavaScript changes reach installed APKs over the air through the **App update** workflow; native changes (a new native package, a permission, the icon, `app.json`) need a new APK. Details in the root README.
