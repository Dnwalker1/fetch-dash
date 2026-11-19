# Fetch Dash

A pet runner game from Goodwookie Productions. It will tie into the Design Your Pet app and goodwookie.com.

Your pet runs on its own. You keep it out of trouble and on task:

| Action | Phone | Keyboard |
| --- | --- | --- |
| Jump | Tap | Space |
| Slide (and fast-fall in the air) | Swipe down | Down arrow |
| Keep your pet on task (call it back) | Swipe up | Up arrow |

## Your pet is the hero

1. **Make your hero.** On the first visit, name your pet, choose dog or cat, and add a photo. The game picks the closest in-game coat color from the photo (tap another to change it), then makes a hero portrait in Design Your Pet's "Anime Hero" style with your pet's name on it. Each player gets 3 free portraits. You can skip the photo and just play.
2. **Meet your hero.** The portrait appears next to the in-game version of your pet, with the level map.
3. **Play.** In the run your pet is the drawn character that matches its breed type, size and coat.
4. **End card.** Win or lose, the full portrait comes back with your score, a button to the Design Your Pet shop, and "Save picture" (the portrait with your result, ready to share).

Until the live generator is switched on, the game makes a stand-in portrait on the device so the whole flow can be played. See [docs/hero-portraits.md](docs/hero-portraits.md) to switch on the real one.

## Levels

| Level | Trail | Length | What's new |
| --- | --- | --- | --- |
| 1 | Park Trail | 600 m | Fences, puddles, low branches. Squirrels (dogs) and birds (cats). |
| 2 | Hilltop Trail | 800 m | Rolling hills. Logs and rocks to jump. Bunnies to chase. |
| 3 | Sunset Beach | 1000 m | Gentle dunes at sunset. Sandcastles, driftwood, beach umbrellas to slide under. Crabs and seagulls. |

Finishing a level opens the next one. Best scores are kept per level on the device. Levels are defined in `src/levels.ts`; their art is in `src/art/levelArt.ts`.

## How to play

- The pet speeds up over time. Reach the ball at the end of the trail to finish the level.
- Low obstacles need a jump. Branches and umbrellas need a slide (or a well-timed jump).
- Treats are worth 10 points each.
- Distractions show up every 8 to 13 seconds. Swipe up during the warning ("!" or "?") for a +50 focus bonus.
- Up and down together (either order, or holding down) calls the pet back and slides right away; a space press just before up does the same with a jump. Distractions also wait until the pet has cleared any obstacle right ahead.
  - Something on the trail (squirrel, bunny, crab, bird): if you wait, your pet turns around, the run slows down, and your pet runs back after it. If it gets too far back, the run ends.
  - Something out of reach (a bird or gull overhead, a den hole, a butterfly): your pet stops to stare and the run slows down until you call it back.
- On the end card, Enter or Space starts the next run.

Pet art lives in `src/art/pets.ts`. All the numbers that control how the game feels are in `src/config.ts`.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints, usually http://localhost:5173. To try it on your phone, run `npm run dev -- --host` and open the "Network" address on a phone that is on the same Wi-Fi.

`npm run build` checks the code and makes a web-ready copy of the game in `dist/`.

## Tech

[Phaser 3](https://phaser.io) with TypeScript, built with [Vite](https://vite.dev). Later, the web build gets wrapped in an Expo app for iOS and Android.
