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
- allows **3 portraits per install, in total** (`GAME_PORTRAITS_TOTAL` in
  `backend/dypSettings.js`), counted in the `FetchDashPlayers` collection,
  which the 7-day clean-up doesn't touch. A 4th is refused with
  `limit_game`. Only portraits that came out count;
- still applies the daily tries limit and the site-wide hourly limit;
- lets the game use only `allowance`, `uploadUrl`, `designs`, `designs/<id>`
  and `report`. Previews, checkout and orders answer `not_for_game`;
- answers the browser's CORS checks (`options_…` functions, and
  `Access-Control-Allow-Origin: *` on every answer), so both the web page and
  the phone app's WebView (which has no web address) can call it.

To change the number of free portraits, change `GAME_PORTRAITS_TOTAL` on the
Wix site and `FREE_PORTRAITS` in `src/hero/store.ts` to match. The server's
count wins: the card asks `GET /allowance` once per visit and after each
portrait.

## 3. What the game does

1. `POST /uploadUrl` → `PUT` the photo (shrunk to 1600 px, JPEG)
2. `POST /designs { fileId, style: "arcade", text: NAME, sloth }`, retrying
   `upload_not_ready`
3. Polls `GET /designs/<id>` every 2 s for up to 10 minutes (most take 1 to 3;
   after 4 it says "Still painting…"). A dropped connection mid-wait just
   tries again.
4. Copies `previewUrl` onto the device as a JPEG data URL, because the
   server deletes unordered designs after 7 days. Shows it on the "Meet your
   hero" card and the end card.
5. "Report picture" on the end card calls `POST /report` (Google Play's
   AI-content rule), only for live portraits.

Errors (`no_pet`, `photo_rejected`, `limit_game`, limits, busy) come back to
the photo card in plain language, and a failed portrait isn't counted.

## 4. Still to do

- The stand-in portrait in `src/hero/demo.ts` still draws the Anime Hero
  layout. It only shows when the live settings are missing.
