# What Fetch Dash keeps, and for how long

Written 26 Nov 2026 from Elon's CMS spec and a check of the live backend code.
The numbers live in `wix-backend/backend/fetchDashRetention.js`; the nightly
job is `wix-backend/backend/fetchDashCleanup.js`. Both are pasted into the
goodwookie.com Velo backend by Don (steps are delivered beside the PR, not in
this public repo).

## On the server (goodwookie.com)

| What | Where | Kept until |
| --- | --- | --- |
| The pet photo the player uploads | Media Manager, `app-uploads` | **Permanently deleted** as soon as the portrait is done or fails, or the next night if the game was closed mid-wait (or the design is still stuck a day later). A refused photo was already deleted by the design code. |
| The 4K print file | Media Manager, `pet-designs` | **Permanently deleted** with the photo. The game can't order, so it never needs it. |
| The 1024 px portrait | Media Manager, `pet-designs` | The site's 7-day clean-up (`cleanup.js` / `petDesigns.js`), same as every unordered design. The game keeps its own copy on the phone. |
| The design row (`PetDesigns`, `visitorId` `game_<id>`) | CMS | The same 7-day clean-up. |
| The player row (`FetchDashPlayers`): design IDs, pet names, older IDs | CMS | 30 days after the game last called the server. Then cut down to the count. |
| The bare count (how many of the 9 free portraits this phone used) | CMS | 365 days after last seen, so a reinstall doesn't hand out a fresh 9. Then the row is removed. |

Every file delete is permanent (`bulkDeleteFiles` with `permanent: true`).
Trashed Media Manager files are still kept and can still be served, so the
Trash is never used.

`lastSeen` is written when the game asks for its allowance or a design, at most
once a day.

## When a player asks for their data to be deleted

The game's photo screen shows a game code (the first 8 characters of its ID)
and says to email info@goodwookie.com with it. Then, in the Velo Code panel:

1. `deleteGamePlayerData('AB12CD34')` is a dry run: it says how many design
   rows, files and player rows it would delete, and how many designs on an
   order it keeps.
2. `deleteGamePlayerData('AB12CD34', { dryRun: false })` deletes them, files
   permanently.

It removes the player row too, count included, so that phone gets its free
portraits again. A code that matches two players is refused; ask for the
full ID. It logs counts only.

## Sent to OpenAI

The game's portraits are painted by OpenAI (27 Nov 2026). For each portrait
the server sends the pet photo, the brand's style examples and the prompt,
which has the pet's name in it. No device or game ID is sent. OpenAI doesn't
train on API data; it keeps requests up to 30 days to check for abuse until
zero data retention is switched on for the project (Don asks OpenAI). Only
players who said they are 18 or over can make portraits until then. Their
age band (`under13`, `13-17`, `18+`) is kept on the player row with the count,
never the birth date.

## On the phone

The game keeps the player's portraits, pet names and progress in its own
storage. It turns each portrait into a picture on the phone (three tries); if
that fails it tells the player to use Save picture, because the server's copy
goes after 7 days. They stay until the game is deleted (or, on the web, until site data
is cleared). The server can't see or delete these.

## Which ID

See `docs/hero-portraits.md`, "Which ID is counted". The Android app sends a
one-way hash of the app-scoped Android ID, and the iPhone app a Keychain ID, so
the count survives a reinstall (Don's rule, 25 Nov 2026). If that changes to a
random per-install ID, set `COUNT_KEEP_DAYS` to 0 (or anything not above
`DESIGNS_KEEP_DAYS`) and the count is removed with the rest at 30 days.

## For the privacy policy

The current policy says: "Designs you don't order, and the photos they came
from, are deleted automatically after 7 days." For the game this becomes
stronger for photos (deleted once the portrait is made) and adds the player
row:

> Fetch Dash: the photo you upload is deleted as soon as your hero portrait is
> made. The portrait is deleted from our servers after 7 days; the game keeps
> its copy on your device. We keep your pet names and portrait count for 30
> days after you last play, and after that only the number of free portraits
> used on your device, for one year, to stop the free portraits being claimed
> again.
