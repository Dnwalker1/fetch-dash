# Hero portraits: switching on Design Your Pet

The game asks the goodwookie.com backend for the portrait, the same way the
Design Your Pet app does (see `docs/backend-api.md` in createyourpetappo).
It uses the existing **Anime Hero** style (`style: "hero"`) with the pet's
name as the lettering. The client is `src/hero/api.ts`.

## 1. Build settings

Put these in `.env.local` (git ignores it) or in the hosting build settings:

| Setting | Value |
| --- | --- |
| `VITE_DYP_API_BASE` | `https://www.goodwookie.com` |
| `VITE_DYP_APP_KEY` | the `DESIGN_APP_KEY` secret from the Wix Secrets Manager |
| `VITE_DYP_HERO_STYLE` | optional; defaults to `hero`. Set it to a new style key if you add a game-specific "video game hero" style. |

Without the first two, the game makes a stand-in portrait on the device
(`src/hero/demo.ts`) and labels it "Preview art".

As with the app, anything built into a web page can be read out of it, so the
key only keeps out casual callers.

## 2. Backend changes needed on the Wix site

1. **Let the game's web page call the functions (CORS).** The browser sends a
   preflight `OPTIONS` request first. Each function the game uses
   (`uploadUrl`, `designs`, `designs/<id>`, `report`) needs an `options_…`
   handler, and every answer needs these headers:
   - `Access-Control-Allow-Origin: https://www.goodwookie.com` (plus the
     game's own address if it's hosted elsewhere)
   - `Access-Control-Allow-Headers: Content-Type, X-App-Key, X-Device-Id`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   The upload URL (`PUT` to Wix media) must also accept the game's origin.
   If the game page lives on goodwookie.com itself (not in an iframe from
   another domain), the functions are same-origin and no CORS is needed.
2. **Count the game's 3 free portraits separately.** Today the game counts
   them on the device. To keep them separate from the app's 5 designs and to
   stop people clearing their browser to get more, have `POST /designs`
   accept `source: "fetch-dash"` and apply a game allowance of 3 per device.
   The game doesn't send `source` yet so it can't break the live backend;
   add it in `generateLive()` once the backend accepts it.

## 3. What the game does

1. `POST /uploadUrl` → `PUT` the photo (shrunk to 1600 px, JPEG)
2. `POST /designs { fileId, style: "hero", text: NAME }`, retrying
   `upload_not_ready`
3. Polls `GET /designs/<id>` every 2 s for up to 3 minutes
4. Shows `previewUrl` on the "Meet your hero" card and the end card
5. "Report picture" on the end card calls `POST /report` (Google Play's
   AI-content rule), only for live portraits

Errors (`no_pet`, `photo_rejected`, limits, busy) come back to the photo card
in plain language, and a failed portrait isn't counted.
