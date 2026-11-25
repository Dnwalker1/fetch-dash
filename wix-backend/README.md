# Wix backend pieces for Fetch Dash

The goodwookie.com backend (Velo, on the Wix site) is edited and published by
Don. The game-related files that came before this folder (`appBackend.js`,
`http-functions.js`, `dypSettings.js`, the `FetchDashPlayers` collection) live
only on the Wix site.

| File | Paste into Wix as | What it does |
| --- | --- | --- |
| `backend/fetchDashPets.js` | `backend/fetchDashPets.js` (new file) | The free-portrait rule: 3 per pet name, up to 3 pets, 9 in all. Plain functions; no Wix imports. |

How the game uses it is in `docs/hero-portraits.md` ("Free portraits").
