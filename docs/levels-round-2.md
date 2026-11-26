# Levels, round 2 (25 November)

Seven new levels and four new ways to play, with the whole trail reordered so
the same way of playing never comes twice in a row. 19 levels in all.

## The order

| # | Level | Plays as | New? |
|---|---|---|---|
| 1 | Park Trail | Trail run (first-run tutorial) | |
| 2 | Hilltop Trail | Climbing ledges | |
| 3 | Sunset Beach | Trail run | |
| 4 | Open Meadow | Run to the horizon | new |
| 5 | Main Street | Trail run | |
| 6 | Lake Crossing | Swimming (most of the run) | new |
| 7 | Rainy Riverside | Dig spots and tunnels | |
| 8 | Desert Canyon | Climbing ledges | |
| 9 | Snowy Night | Trail run | |
| 10 | Jungle Falls | Swimming stretches | swimming added |
| 11 | Sunflower Road | Run to the horizon | new |
| 12 | Sunny Farm | Dig spots and tunnels | |
| 13 | Autumn Orchard | Trail run | |
| 14 | Mountain Switchbacks | Tall climbing ledges | new |
| 15 | Thunderstorm Trail | Swimming stretches, lightning | new |
| 16 | Blossom Garden | Trail run | |
| 17 | Night Woods | Dark: the pet's light shows the way | new |
| 18 | Fireworks Pier | Trail run | |
| 19 | Moon Run | Low gravity, space helmet, moon-cheese ball | new |

Backyard Toss comes after levels 3, 6, 9, 12 and 15.

A level's length and speed now come from its place in the order (600 m at
level 1 up to 1,575 m at level 19), so the game still gets steadily harder.
Each level keeps its art number (`art` in `src/levels.ts`), which names its
pictures, so reordering never moves art around. Saved progress from the old
order is moved over once (stars, best scores and finished levels follow each
level to its new place).

## How the new ways to play work

- **Run to the horizon** (`horizon`, `src/scenes/horizon.ts`): the trail turns
  toward a vanishing point for a long stretch. Three lanes: swipe or arrow
  left and right to change lanes, tap or Space to jump. Obstacles start as
  dots on the horizon and grow. Tuning in `HORIZON` (config.ts).
- **Swimming** (`swim`): stretches where the trail turns into water. The pet
  swims low in it and slows down. Tap hops over floating logs, crates and lily
  pads; swipe down dives under footbridges. Tuning in `SWIM`.
- **Night Woods** (`dark`): everything outside the pet's light is dark, with
  fireflies. Tuning in `NIGHT`.
- **Moon Run** (`gravity: 0.45`): jumps go higher and float down slowly, and
  obstacles are spaced farther apart to match. The pet wears a glass helmet.
- **Mountain Switchbacks** (`climb.tall`): five steps up to a ridge a full jump
  above the usual one (`CLIMB_TALL`).

## Cats

The new levels play the same for cats, bent by `SPECIES` in config.ts: cats
swim slower (0.72 vs 0.85 of running speed) but hop higher out of the water,
and change lanes faster (120 vs 170 ms) and jump higher on horizon runs. The
full cat profile (speed, jump, slide, ledges, tunnels) is the next round.

## Painted art (Elon, 26 November)

Everything in the two tables below is painted and wired in: the backgrounds in
`public/art/l13` to `l19` (each level's `layers` in `src/levels.ts`), the
sprites in `public/art/props` and `public/art/critters` (listed in
`src/art/artFiles.ts`). The code in `src/art/round2.ts` paints a stand-in only
if a file fails to load. The tables stay as the size reference for repaints.
Same rules as `docs/art-specs.md`: WebP, transparent background, 2x game size.

### Backgrounds (one folder each: `public/art/l<art>/`)

Same sizes as the existing levels: `sky` 1280 x 720 (fills the screen), `far`
about 1170 wide, `mid` about 1184 wide, both tiling left to right, keyed on
magenta like the others.

| Folder | Level | sky | far | mid | Before 26 November |
|---|---|---|---|---|---|
| l13 | Open Meadow | bright summer sky | distant blue hills | wildflower meadow with a few round trees | l9 sky, l10 far (tinted), l1 far |
| l14 | Sunflower Road | warm late-summer sky | rolling farm fields | rows of sunflowers | l7 sky, l9 far, code-painted sunflowers |
| l15 | Lake Crossing | soft morning sky | mountains across a lake | the far shore: willows and reeds (no water along the bottom, the game draws the water) | l10 sky, l2 far, l5 mid |
| l16 | Thunderstorm Trail | dark storm clouds | hills in the rain | wind-bent pines | l5 sky, l5 far + l2 mid (tinted grey) |
| l17 | Mountain Switchbacks | clear high-altitude sky | snowy peaks (no snowfield along the bottom) | alpine meadow with boulders | l2 sky, l6 far, l2 mid |
| l18 | Night Woods | moonlit sky | a dark ridge | dense woods, in night colors | l6 sky, l5 far + l2 mid (tinted blue) |
| l19 | Moon Run | black starry space | grey moon ridges | a parked rocket and a lander on the horizon (Chewy's rocket) | l12 sky, code-painted Earth and ridges |

### Sprites (2x game size)

| Key | File size (px) | What it is | Where it goes |
|---|---|---|---|
| `water` | 512 x 220 | water strip, tiles left to right; surface line 16 px from the top | public/art/props |
| `water-cap` | 300 x 220 | the water's end at a bank: the shore curves away (water starts farther right lower down), foam along the edge | public/art/props |
| `lily` | 108 x 36 | lily pad with a flower, flat on the water | public/art/props |
| `footbridge` | 340 x 48 | plank footbridge deck with a hand rail (posts reuse `wood-post`) | public/art/props |
| `hz-bush`, `hz-flowers`, `hz-tree`, `hz-sunflower`, `hz-post` | 180 x 112, 128 x 56, 240 x 340, 88 x 240, 24 x 88 | scenery beside the horizon runs, standing on the bottom edge, seen straight on | public/art/props |
| `moon-rock` | 100 x 72 | grey moon boulder | public/art/props |
| `crater` | 200 x 48 | crater lying flat on the trail (jump it) | public/art/props |
| `moon-flag` | 72 x 124 | flag on a pole with a paw print | public/art/props |
| `space-arch` + `space-pole` | 300 x 44, 16 x 180 | solar panel on two legs (slide under) | public/art/props |
| `moon-ball` | 56 x 56 | the moon-cheese ball at the finish | public/art/props |
| `moonbug` | 72 x 52 | glowing moon bug that skitters past (the Moon's squirrel) | public/art/critters |
| `ufo-0`, `ufo-1` | 132 x 64 | flying saucer, lights blinking (two frames) | public/art/critters |
| `helmet` | 128 x 128 | glass space helmet placed over the pet's head | public/art/props |
| `earth-rise` | 2048 x 280 | Earth hanging in the sky, clear around it | public/art/l19 |
| `firefly` | 16 x 16 | a soft glowing dot | public/art/props |

### Later, nice to have

- A swim frame for each pet sheet (today the run frames are used with the
  water line across the body).
- A three-quarter back view run cycle for the horizon runs (today the pet is
  shown side-on, angled toward the vanishing point).
- Space-suit versions of the pet sheets, replacing the helmet overlay.
