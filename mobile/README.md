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

## iPhone builds and TestFlight

The `testflight` profile in `eas.json` is the App Store build with Google's
test ads (it extends `production` and sets `EXPO_PUBLIC_REAL_ADS=0`), so
TestFlight testers can tap ads safely. The `production` profile is for the
App Store release itself.

**First time only** (from a computer, because Apple asks to sign in):

```bash
cd mobile
npm ci
npx eas-cli@latest build --platform ios --profile testflight --auto-submit
```

Answer yes to signing in to Apple, reuse the existing distribution
certificate (Design Your Pet's, same Apple team), let EAS make a new
provisioning profile, say no to push notifications, and let EAS make an App
Store Connect API key for submissions. EAS keeps all of these, so later
builds need no Apple sign-in.

**After that**, from GitHub: Actions tab, "iOS TestFlight build", "Run
workflow" (`.github/workflows/ios-testflight-build.yml`). It needs the app's
Apple ID (App Store Connect > App Information > Apple ID) in `eas.json` as
`submit.testflight.ios.ascAppId`. Each build number goes up by itself.

When Apple finishes processing a build (10 to 30 minutes), it shows under
TestFlight in App Store Connect. Internal testers (people on the App Store
Connect team) can install it right away from the TestFlight app; external
testers need Apple's beta review once per version.

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

## Ads (Google AdMob)

Ads run natively through `react-native-google-mobile-ads` (`ads.ts`), never
inside the WebView, so the game's page never loads ad code.

- **Where:** one full-screen (interstitial) ad when the player taps on from
  the end-of-run or bonus card (next level, run again, map, toss again). The
  game calls `adBreak()` (`src/ads.ts`) and waits for the app to say the ad
  closed before the next run starts, so an ad never covers a run. On the web
  every break carries straight on.
- **How often:** `AD_RULES` in `ads.ts`: none in the first 2 breaks each time
  the app opens, then at most one every 3 minutes. No banners.
- **Content:** a standard 13+ app (not Families), ads rated PG at most. If the
  player's age answer (`hero/age.ts`) is under 18, ads are non-personalised
  and tagged as under the age of consent; under 13 also tags them as
  child-directed with a G rating.
- **Consent:** Google's UMP form shows on first launch where the law needs it
  (EEA, UK, some US states). It's set up in AdMob under Privacy & messaging.
  Where Google says players must be able to change their choice, the map card
  shows a "Privacy choices" button.
- **iPhone tracking question (ATT):** Apple's "Allow Fetch Dash to track
  your activity?" is asked once, only of players whose age answer is 18+,
  at the title screen after Google's consent form (`askTracking()` in
  `ads.ts`). Players under 18, or who haven't answered, are never asked. Do
  not turn on AdMob's "IDFA explainer" message in Privacy & messaging: it
  would show Apple's question to every player, children included.
  `app.json` carries the question's wording and Google's SKAdNetwork IDs
  (Google plus its 49 third-party buyers, from Google's list of
  27 Nov 2026).
- **Test ads:** every build except the `production` profile shows Google's
  test ads (`EXPO_PUBLIC_REAL_ADS=1` is set only there in `eas.json`), so
  testers can tap them safely. Never tap real ads in your own app.
- **IDs:** the AdMob App IDs are in `app.json` (the plugin entry): Fetch
  Dash's own for Android (`~3604702384`), Google's test one for iOS until an
  iOS app is added in AdMob. The "Between runs" ad unit IDs are
  `BETWEEN_RUNS_UNIT` in `ads.ts`; a platform with an empty one shows no ads
  in store builds. Test builds use the real App ID with Google's test ad
  unit, which is how Google says to test.

## Not done yet

- "Save picture" on the end card is a browser download, which a WebView
  ignores. It needs a small bridge to the phone's share sheet.
- No purchases yet. iOS store ads still need Fetch Dash's own iOS App ID and
  "Between runs" unit from AdMob before an App Store release (TestFlight
  builds use test ads, so they don't need them).
