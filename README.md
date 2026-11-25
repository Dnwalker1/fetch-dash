# Fetch Dash

A pet runner game from Goodwookie Productions. It will tie into the Design Your Pet app and goodwookie.com.

Your pet runs on its own. You keep it out of trouble and on task:

| Action | Phone | Keyboard |
| --- | --- | --- |
| Jump | Tap | Space |
| Slide (and fast-fall in the air) | Swipe down | Down arrow |
| Keep your pet on task (call it back) | Swipe up | Up arrow |
| Stop (and go again when you let go) | Hold a finger down | Hold the left arrow |
| Pause | Pause button | P or Esc |

## Your pet is the hero

1. **Make your hero.** On the first visit, name your pet, choose dog or cat, and add a photo. The game picks the closest in-game coat color from the photo (tap another to change it), then makes a hero portrait in Design Your Pet's "Anime Hero" style with your pet's name on it. Each player gets 3 free portraits. You can skip the photo and just play.
2. **Pick a trail.** The home card is a trail map: a small picture of your hero at the top, and a winding trail with a stop for each level. Tap a stop to see its name, stars and best score, then press Play.
3. **Play.** In the run your pet is the drawn character that matches its breed type, size and coat.
4. **End card.** Win or lose, the full portrait comes back with your score, a button to the Design Your Pet shop, and "Save picture" (the portrait with your result, ready to share).

Until the live generator is switched on, the game makes a stand-in portrait on the device so the whole flow can be played. See [docs/hero-portraits.md](docs/hero-portraits.md) to switch on the real one.

## Levels

The order mixes the ways of playing so the same kind never comes twice in a row (see `docs/levels-round-2.md`). Lengths and speeds follow each level's place in the order.

| Level | Trail | Length | What's new |
| --- | --- | --- | --- |
| 1 | Park Trail | 600 m | Fences, puddles, low branches. Squirrels (dogs) and birds (cats). |
| 2 | Hilltop Trail | 750 m | Rolling hills and climbing ledges. Logs and rocks to jump. Bunnies to chase. |
| 3 | Sunset Beach | 900 m | Gentle dunes at sunset. Sandcastles, driftwood, beach umbrellas to slide under. Crabs and seagulls. |
| 4 | Open Meadow | 950 m | **Run to the horizon:** the trail turns into the screen; swipe left and right to change lanes. |
| 5 | Main Street | 1000 m | Downtown at dusk. Trash cans, hydrants, signs, awnings. A cat (dogs) or a dog (cats), pigeons, neighbors with treats. |
| 6 | Lake Crossing | 1025 m | **Swimming** for most of the run: tap to hop over floating logs, swipe down to dive under footbridges. |
| 7 | Rainy Riverside | 1075 m | Rain, willows, dig spots and tunnels. Frogs and ducks. |
| 8 | Desert Canyon | 1125 m | Red rock mesas and climbing ledges. Cacti, tumbleweeds, stone arches. Lizards and hawks. |
| 9 | Snowy Night | 1150 m | Moonlight and falling snow. Snowmen, sleds, snowy branches. A fox or a cardinal, and owls. |
| 10 | Jungle Falls | 1200 m | Waterfalls and swimming stretches. Vines to slide under. Monkeys and parrots. |
| 11 | Sunflower Road | 1250 m | **Run to the horizon** down a country road through the sunflowers. |
| 12 | Sunny Farm | 1275 m | Barn, windmill, dig spots and tunnels. A chicken or mice, and the farmer waves. |
| 13 | Autumn Orchard | 1325 m | Falling leaves. Hay bales, pumpkins, autumn branches. Chipmunks, mice, crows. |
| 14 | Mountain Switchbacks | 1375 m | **Tall climbing ledges** up to a high ridge. |
| 15 | Thunderstorm Trail | 1400 m | Lightning, rain and **swimming stretches** where the trail floods. |
| 16 | Blossom Garden | 1450 m | Falling petals. Stone lanterns, koi ponds, blossom branches. |
| 17 | Night Woods | 1500 m | **Dark:** only the pet's little light shows the trail ahead. Fireflies, owls, a fox. |
| 18 | Fireworks Pier | 1525 m | Night on the boardwalk with fireworks. Crates, barrels, banners. |
| 19 | Moon Run | 1575 m | **Low gravity** in a space helmet: floaty jumps over craters and moon rocks, a moon-cheese ball, flying saucers. |

Finishing a level opens the next one. Best scores are kept per level on the device. Levels are defined in `src/levels.ts`. Levels use painted backgrounds made in Grok (`public/art/l<art>`: sky, far and mid strips, keyed and made seamless). The round 2 levels borrow other levels' paintings until theirs are painted; `docs/levels-round-2.md` lists what's needed.

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
- **First run tutorial.** The first time you play Level 1, the game stops at a fence, a branch and a squirrel, with a hand showing the tap, the swipe down and the swipe up. "Replay tutorial" on the home card shows it again.
- **Neighbors with treats** (levels 5, 12 and 18). A neighbor stands by the trail holding out a treat. Hold to stop on the glowing patch beside them for +75 and a treat. Stop a little short and your pet walks up to them. Nothing bad happens if you run past.
- **Climbing** (levels 2, 8 and 14). Stone ledges in steps lead up to a ridge with treats and a golden treat (+100). You can jump up through a ledge from below. The trail underneath has its own obstacles. Layout: `CLIMB` in `src/config.ts`; art: `src/art/ledges.ts`.
- **Dig spots and tunnels** (levels 7 and 12). Swipe down on a dig spot to dig into a tunnel: a low ceiling, stones to jump, roots to slide under, lines of buried bones and a golden one (+100) before you pop back out. Tuning: `TUNNEL` in `src/config.ts`; art: `src/art/tunnel.ts`.
- **Runs to the horizon** (levels 4 and 11). Swipe (or arrow) left and right to change lanes, tap to jump. Tuning: `HORIZON`; code: `src/scenes/horizon.ts`.
- **Swimming** (levels 6, 10 and 15). Tap hops out of the water, swipe down dives. The pet is slower in the water (cats more so: `SPECIES`). Tuning: `SWIM`.
- **Debug overlay.** Add `?debug=1` to the address for frames per second, the touch or mouse position, and the speed with its multipliers.

## Bonus round: Backyard Toss

After levels 3, 6, 9, 12 and 15 the end card offers a 60-second bonus round (or skip it), and each one can be replayed from its 🎾 stop on the trail map once that level is done. The camera looks down a backyard lawn at an angle: things farther up the screen are smaller, drawn behind nearer things, and move more slowly.

- **Throw:** swipe up from the bottom half of the screen. The direction aims; a longer, faster swipe throws farther. A dotted arc shows the throw while you drag. On a computer, drag up with the mouse, or hold Space to charge and aim with ← →.
- **Fetch:** the pet dashes after the ball for a moment, then you steer. On a phone, put your thumb anywhere and drag: a joystick appears under it, the pet runs the way you drag, and an arrow ahead of the pet shows where it's headed. With a mouse, hold the button where it should run, or use the arrow keys / WASD.
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

## Art specs

Every obstacle and gopher-hole picture, with its size, placement and hit box, is listed in [docs/art-specs.md](docs/art-specs.md), so painted replacements drop in without code changes.

## Phone app

The iPhone and Android app lives in [mobile/](mobile/README.md). It is an Expo app that ships this game inside a WebView and builds with EAS.
