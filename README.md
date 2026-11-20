# Fetch Dash

A pet runner game from Goodwookie Productions. It will tie into the Design Your Pet app and goodwookie.com.

Your pet runs on its own. You keep it out of trouble and on task:

| Action | Phone | Keyboard |
| --- | --- | --- |
| Jump | Tap | Space |
| Slide (and fast-fall in the air) | Swipe down | Down arrow |
| Keep your pet on task (call it back) | Swipe up | Up arrow |
| Pause | Pause button | P or Esc |

## Your pet is the hero

1. **Make your hero.** On the first visit, name your pet, choose dog or cat, and add a photo. The game picks the closest in-game coat color from the photo (tap another to change it), then makes a hero portrait in Design Your Pet's "Anime Hero" style with your pet's name on it. Each player gets 3 free portraits. You can skip the photo and just play.
2. **Pick a trail.** The home card is a trail map: a small picture of your hero at the top, and a winding trail with a stop for each level. Tap a stop to see its name, stars and best score, then press Play.
3. **Play.** In the run your pet is the drawn character that matches its breed type, size and coat.
4. **End card.** Win or lose, the full portrait comes back with your score, a button to the Design Your Pet shop, and "Save picture" (the portrait with your result, ready to share).

Until the live generator is switched on, the game makes a stand-in portrait on the device so the whole flow can be played. See [docs/hero-portraits.md](docs/hero-portraits.md) to switch on the real one.

## Levels

| Level | Trail | Length | What's new |
| --- | --- | --- | --- |
| 1 | Park Trail | 600 m | Fences, puddles, low branches. Squirrels (dogs) and birds (cats). |
| 2 | Hilltop Trail | 800 m | Rolling hills. Logs and rocks to jump. Bunnies to chase. |
| 3 | Sunset Beach | 1000 m | Gentle dunes at sunset. Sandcastles, driftwood, beach umbrellas to slide under. Crabs and seagulls. |
| 4 | Main Street | 1000 m | Downtown at dusk under the street lamps. Trash cans, hydrants and sidewalk signs to jump, shop awnings to slide under. Dogs chase a cat, cats run from a dog, pigeons fly over, and neighbors wave hello (dogs only). |
| 5 | Rainy Riverside | 1100 m | Rain, willows and a river. Stumps and creeks to jump. Frogs hop past, ducks fly over. |
| 6 | Snowy Night | 1200 m | Moonlight, stars and falling snow. Snowmen and sleds to jump, snowy branches to slide under. A fox (dogs) or a cardinal (cats), and owls overhead. |
| 7 | Autumn Orchard | 1250 m | Falling leaves. Hay bales and pumpkins to jump, autumn branches to slide under. Chipmunks (dogs), mice (cats), crows. |
| 8 | Desert Canyon | 1300 m | Red rock mesas. Cacti and rolling tumbleweeds to jump, stone arches to slide under. Lizards and hawks. |
| 9 | Sunny Farm | 1350 m | Red barn and windmill. Hay bales and water troughs to jump, clotheslines to slide under. A chicken (dogs), mice (cats), the farmer waves. |
| 10 | Blossom Garden | 1400 m | Falling petals. Stone lanterns and koi ponds to jump, blossom branches to slide under. |
| 11 | Jungle Falls | 1450 m | Big hills and waterfalls. Creeks, logs and stumps to jump, hanging vines to slide under. Monkeys (dogs) and parrots (cats). |
| 12 | Fireworks Pier | 1500 m | The finale at night on the boardwalk, with fireworks. Crates and barrels to jump, flag banners to slide under. Seagulls and balloons. |

Finishing a level opens the next one. Best scores are kept per level on the device. Levels are defined in `src/levels.ts`. Levels 1 to 6 use painted backgrounds made in Grok (`public/art/l1` to `l6`: sky, far and mid strips, keyed and made seamless); the other levels, and all the critters and obstacles, are drawn in code in `src/art/`.

## How to play

- The pet speeds up over time. Reach the ball at the end of the trail to finish the level.
- **Three paws per run.** The first two bumps make your pet stumble and slow down for a moment (and it can't be bumped again for 1.5 seconds). The third bump ends the run. Running off after a critter still ends it right away.
- **Forgiving controls.** Obstacles' hit areas are a little smaller than their pictures. A jump pressed just before landing happens on landing, and a jump just after running off a hilltop still works.
- **Pause** with the button next to the speaker, or P / Esc. The game pauses by itself if you switch apps or tabs.
- **Stars.** Each level has three: catch the ball, grab at least 70% of the treats, and finish with no bumps. Your best stars show on the level map.
- Low obstacles need a jump. Branches and umbrellas need a slide (or a well-timed jump).
- Treats are worth 10 points each.
- Distractions show up every 8 to 13 seconds. Swipe up during the warning ("!" or "?") for a +50 focus bonus.
- Up and down together (either order, or holding down) calls the pet back and slides right away; a space press just before up does the same with a jump. Distractions also wait until the pet has cleared any obstacle right ahead.
  - Something on the trail (squirrel, bunny, crab, bird): if you wait, your pet turns around, the run slows down, and your pet runs back after it. If it gets too far back, the run ends.
  - Something out of reach (a bird or gull overhead, a den hole, a butterfly): your pet stops to stare and the run slows down until you call it back.
- On the end card, Enter or Space starts the next run.

## Bonus round: Backyard Toss

After levels 3, 6 and 9 the end card offers a 60-second bonus round (or skip it), and each one can be replayed from its 🎾 stop on the trail map once that level is done. The camera looks down a backyard lawn at an angle: things farther up the screen are smaller, drawn behind nearer things, and move more slowly.

- **Throw:** swipe up from the bottom half of the screen. The direction aims; a longer, faster swipe throws farther. A dotted arc shows the throw while you drag. On a computer, drag up with the mouse, or hold Space to charge and aim with ← →.
- **Fetch:** the pet dashes after the ball for a moment, then you steer: hold a finger (or the mouse button) where it should run, or use the arrow keys / WASD.
- **Bring it back** to the glowing circle at the bottom for the next throw. Catching it before it touches the ground is an air catch.
- **Treats:** 3 for each ball brought back, 3 more for an air catch, 1 for each golden treat on the lawn (3 to a pile, mostly in the far half), and 5 for three air-caught returns in a row. After 3 returns each throw launches 2 balls, and after 6, 3 balls. The sprinkler turns on now and then and pushes the ball. You can't lose.
- **Cats** get a ball of yarn: it bounces less, rolls farther and leaves a thread that fades.
- The round's treats go into the **treat jar** (shown on the map), which is kept on the device.

To jump straight into it, open the game with `?bonus=1` on the address (for example http://localhost:5173/?bonus=1). The code is `src/scenes/BonusScene.ts`, its numbers are the `BONUS` block in `src/config.ts`, its painted art (Elon's v1) is in `public/art/bonus/`, and `src/art/bonusArt.ts` paints stand-ins for any picture that fails to load. The list of its pictures and their sizes is at the top of `BonusScene.ts`.

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
