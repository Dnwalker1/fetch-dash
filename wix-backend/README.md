# Wix backend pieces for Fetch Dash

The goodwookie.com backend (Velo, on the Wix site) is edited and published by
Don. Its other files (`appBackend.js`, `http-functions.js`, `dypSettings.js`
and the rest) live only on the Wix site, not in this public repo.

| File | On the Wix site | What it does |
| --- | --- | --- |
| `backend/fetchDashPets.js` | `backend/fetchDashPets.js` | The free-portrait rule: 3 per pet name, up to 3 pets, 9 in all. Plain functions; no Wix imports. `appBackend.js` uses it to count and refuse (`limit_pet`, `limit_pets`, `limit_game`) and to build the game's allowance. |

| `backend/fetchDashRetention.js` | `backend/fetchDashRetention.js` | How long a player's data is kept: 30 days after last seen, then just the count for a year. Plain functions; no Wix imports. |
| `backend/fetchDashOpenAI.js` | `backend/fetchDashOpenAI.js` | Game portraits on OpenAI instead of Gemini. `aiDesign.web.js` gets a game design's key from `designKeyFor()`, and its `callGemini` hands those calls to `callOpenAIAsGemini()`. `testOpenAIPortrait(url)` tries one picture from the Code panel. Needs the `OPENAI_API_KEY` secret. |
| `backend/fetchDashAge.js` | `backend/fetchDashAge.js` | The age rule: the first band a player sends counts, and only `18+` makes portraits for now. `appBackend.js` checks it before `/uploadUrl` and `/designs`. |
| `backend/fetchDashCleanup.js` | `backend/fetchDashCleanup.js` | The nightly job (`deleteStaleInstalls`, run from `jobs.config`): permanently deletes finished portraits' photos and print files, and stale players' designs and files. `dryRunFetchDashCleanup()` reports without changing anything. `deleteGamePlayerData(code)` handles a player's deletion request (dry run unless `{ dryRun: false }`; see `docs/data-retention.md`). |

`petKey` here and in `src/hero/store.ts` must stay the same, and so must the
numbers. How the game uses all this is in `docs/hero-portraits.md`.

What is kept and for how long: `docs/data-retention.md`.

## Tests

`npm run test:wix` runs these files under Node against a pretend Wix database
and Media Manager (`test/fakes/`). No Wix site is touched.
