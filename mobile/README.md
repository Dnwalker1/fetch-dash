# Fetch Dash phone app (Expo)

The iPhone and Android app for Fetch Dash. It wraps the web game from the
repo root in a full-screen WebView, and the whole game ships inside the app,
so it plays offline.

- Expo project: [@goodwookies-team/fetch-dash](https://expo.dev/accounts/goodwookies-team/projects/fetch-dash)
  (project ID `6e3c7ef2-1962-46e4-b00f-6f63757d99ee`, linked to this GitHub repo)
- App IDs: `com.goodwookie.fetchdash` on both stores
- Expo SDK 58, landscape only

## How it works

1. `npm run game` (`scripts/bundle-game.mjs`) builds the game with
   `vite build --mode app` (one classic script instead of a module, because
   phones won't run module scripts from files) and packs every file into
   `mobile/game/` with a generated `manifest.ts`. That folder isn't committed.
2. On first launch (and after each game update) `prepareGame.ts` copies the
   game into the app's documents folder.
3. `App.tsx` opens `game/index.html` from there in a WebView. Web links, like
   the Design Your Pet shop, open in the phone's browser.

Changes to the game itself still happen in the repo root (`src/`, `public/`);
the app picks them up on its next build.

## Run it

You need Node 20 or newer. From this folder:

```bash
npm install
npm start          # builds the game, then starts Expo
```

The app uses `react-native-webview`, so test it in a development build
(`eas build --profile development`) rather than Expo Go.

## Build with EAS

```bash
npx eas-cli@latest build --profile preview --platform android   # installable APK for testing
npx eas-cli@latest build --profile production --platform all    # store builds
```

The easiest way to get a test APK is from GitHub: Actions tab, "Android test
build", "Run workflow", and pick the branch. It starts the preview build on
EAS with the `EXPO_TOKEN` secret from the repo's GitHub environment, and the
run summary links the APK when it's done
(`.github/workflows/android-test-build.yml`).

Each profile in `eas.json` names its Expo environment (development, preview,
production), so the `VITE_DYP_*` variables set on expo.dev are loaded the
same way whether a build starts from GitHub, the command line or expo.dev.

EAS runs `eas-build-post-install`, which builds and packs the game before
bundling. On expo.dev the GitHub link uses `mobile` as the base directory, so
builds can also start from GitHub.

## Icon and splash

- `assets/icon.png`: the 1024 px app icon (iOS, and the Android fallback).
- `assets/android-icon-foreground.png`: the same art for Android's shaped
  icons. It's full bleed, with the painting inside the middle 70/108 and a
  soft extension around it, so circles and rounded squares crop only sky
  and grass. `android-icon-monochrome.png` is the dog-and-ball silhouette
  for Android's themed icons.
- `assets/splash-logo.png`: the logo on the launch screen, set up through the
  `expo-splash-screen` plugin in `app.json`. Android 12+ shows it inside a
  circle, so it stays 180 dp wide there.
- `assets/logo.webp`: the logo on the app's own "Getting the trail ready" screen.

The web game's favicons, home-screen icons and `site.webmanifest` live in
`public/` and are left out of the app bundle.

## Not done yet

- "Save picture" on the end card is a browser download, which a WebView
  ignores. It needs a small bridge to the phone's share sheet.
- No ads, purchases or store listing yet.
