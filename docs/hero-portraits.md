# Hero portraits: Design Your Pet's Arcade Hero

The game asks the goodwookie.com backend for the player's portrait, the same
way the Design Your Pet app does (see `docs/backend-api.md` in
createyourpetappo). The style is **Arcade Hero** (added 24 Nov 2026): the pet
in a mid-air dash across a sunny meadow after the paw-print ball, inside a
navy "Player Select" card with a gold keyline, and a name plate with five gold
stars and the pet's name in chunky slanted orange letters. The player can
choose to bring the Goodwookie sloth along, riding on the pet's head.

The client is `src/hero/api.ts`; the card is `openSetup` / `makeHero` in
`src/ui/cards.ts`.

## 1. Build settings

Put these in `.env.local` (git ignores it) or in the hosting build settings:

| Setting | Value |
| --- | --- |
| `VITE_DYP_API_BASE` | `https://www.goodwookie.com` |
| `VITE_DYP_APP_KEY` | the `DESIGN_APP_KEY` secret from the Wix Secrets Manager |
| `VITE_DYP_HERO_STYLE` | not needed. Defaults to `arcade`; the backend makes the Arcade Hero for the game whatever is sent. |

Without the first two, the game makes a stand-in portrait on the device
(`src/hero/demo.ts`) and labels it "Preview art".

Anything built into a web page can be read out of it, so the key only keeps
out casual callers. The backend's real limits (below) don't depend on it.

## 2. How the backend treats the game

Every call carries `X-Client: fetch-dash` beside `X-Device-Id` and
`X-App-Key`. The backend (`appBackend.js`, `http-functions.js` on the Wix
site) then:

- stores the game's designs as `game_<device id>`, apart from the app's
  `app_<device id>`, so they never touch the app's 5 a day;
- always makes the **Arcade Hero** style;
- gives a clean 1024 px portrait with **no watermark** (the 4K print file
  stays private, as for the app);
- gives **3 free portraits per pet, for up to 3 pets: 9 per player** (see
  "Free portraits" below), counted in the `FetchDashPlayers` collection,
  which the 7-day clean-up doesn't touch. Only portraits that came out count;
- still applies the daily tries limit and the site-wide hourly limit;
- lets the game use only `allowance`, `uploadUrl`, `designs`, `designs/<id>`
  and `report`. Previews, checkout and orders answer `not_for_game`;
- answers the browser's CORS checks (`options_…` functions, and
  `Access-Control-Allow-Origin: *` on every answer), so both the web page and
  the phone app's WebView (which has no web address) can call it.

## 2a. Free portraits: 3 per pet, 9 per player (25 Nov 2026)

Don's rule. **A pet is its name**, the one lettered on the portrait:
`Chewy`, `chewy ` and `CHEWY!` are one pet (lower case, letters and digits
only: `petKey` in `src/hero/store.ts` and `wix-backend/backend/fetchDashPets.js`
must match). Renaming one pet can reach 9 for it; the 9 cap is what holds the
cost.

| Asked for | Server answers |
| --- | --- |
| a 4th portrait of one pet | `limit_pet` |
| a 4th pet name | `limit_pets` |
| anything after 9 | `limit_game` |

`POST /designs` gets `pet` (the name) in its body; an older game build that
doesn't send it is counted by `text`. `GET /allowance` and a ready
`GET /designs/<id>` send
`allowance: { portraitsLeft, portraitsUsed, perPet, maxPets, total, pets: [{ name, used, left }] }`.
The game takes the server's `pets` over its own tally. When the free portraits
run out, the game shows a pop-up with links to the Design Your Pet app (Google
Play on Android, the App Store on iPhone) and goodwookie.com.

The rule's numbers live in `wix-backend/backend/fetchDashPets.js` (paste into
the Wix site) and `src/hero/store.ts`; change both together.

### Which ID is counted

| Where | `X-Device-Id` | Survives |
| --- | --- | --- |
| Android app | UUID made from a SHA-256 of the Android ID (`mobile/playerId.ts`) | uninstall, clearing storage. Resets on a factory reset. |
| iPhone app | random UUID kept in the Keychain, this device only | deleting the app. Resets when the phone is erased. |
| Web page | random UUID in the browser's storage | nothing: clearing site data, a private window or another browser start again |

Before this, the app also used the browser-storage ID, so a reinstall gave 3
fresh portraits. The app now also sends that older ID as `?legacyId=` (with
`?idKind=android-id|ios-keychain|web`) on `/allowance` and `POST /designs`, so
the server can carry a phone's earlier count over to its new ID.

Google Play: the Android ID is used only to stop abuse of the free
portraits, never for ads or tracking, and only its one-way hash leaves the
phone. List it in the Data safety form as "Device or other IDs", collected,
not shared, purpose "Fraud prevention, security, and compliance".

The header is sent by the game, so anyone holding the app key could send a
made-up ID. The daily tries limit and the site-wide hourly limit are the
backstop for that.

## 3. What the game does

1. `POST /uploadUrl` → `PUT` the photo (shrunk to 1600 px, JPEG)
2. `POST /designs { fileId, style: "arcade", text: NAME, pet: Name, sloth }`, retrying
   `upload_not_ready`
3. Polls `GET /designs/<id>` every 2 s for up to 10 minutes (most take 1 to 3;
   after 4 it says "Still painting…"). A dropped connection mid-wait just
   tries again.
4. Copies `previewUrl` onto the device as a JPEG data URL, because the
   server deletes unordered designs after 7 days. Shows it on the "Meet your
   hero" card and the end card.
5. "Report picture" on the end card calls `POST /report` (Google Play's
   AI-content rule), only for live portraits.

Errors (`no_pet`, `photo_rejected`, limits, busy) come back to the photo
card in plain language, and a failed portrait isn't counted. The free-portrait
limits (`limit_pet`, `limit_pets`, `limit_game`) open the Design Your Pet
pop-up instead.

The photo card has a "Your pets" row once a pet has a portrait: tapping one
brings back its name, look and portrait (kept on the device), and "+ New pet"
starts another while there's room.

## 4. Still to do

- The stand-in portrait in `src/hero/demo.ts` still draws the Anime Hero
  layout. It only shows when the live settings are missing.
- Don pastes the per-pet backend into Wix and publishes (files and steps were
  delivered 25 Nov 2026). Until then, the server still counts 3 per ID in
  total, and the game shows the pop-up when it refuses.
