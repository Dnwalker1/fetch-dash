# Wix backend pieces for Fetch Dash

The goodwookie.com backend (Velo, on the Wix site) is edited and published by
Don. Its other files (`appBackend.js`, `http-functions.js`, `dypSettings.js`
and the rest) live only on the Wix site, not in this public repo.

| File | On the Wix site | What it does |
| --- | --- | --- |
| `backend/fetchDashPets.js` | `backend/fetchDashPets.js` | The free-portrait rule: 3 per pet name, up to 3 pets, 9 in all. Plain functions; no Wix imports. `appBackend.js` uses it to count and refuse (`limit_pet`, `limit_pets`, `limit_game`) and to build the game's allowance. |

`petKey` here and in `src/hero/store.ts` must stay the same, and so must the
numbers. How the game uses all this is in `docs/hero-portraits.md`.
