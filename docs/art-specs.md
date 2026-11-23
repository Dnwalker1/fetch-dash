# Fetch Dash art drop-in specs

Every obstacle and gopher-hole sprite, so painted replacements drop in without code changes.

## Rules for every replacement

- **Same file name, same folder, WebP with a transparent background.** Obstacles go in `public/art/props/`, holes and critters in `public/art/critters/`.
- **Paint at 2× game size.** One game pixel is 2 file pixels. Keep the file size in the tables below, or close to it. The game measures each picture.
- **The hit box follows the painted part.** The game finds the painted part (pixels at least 25% opaque) and builds the hit box from it. So a different shape is fine. Do keep stray specks and soft glows off the edges, because they stretch the box.
- **Things that stand on the ground** sit on the bottom edge of the picture, centered left to right. The game places the picture's center a set height above the trail line ("Placement" below), so keep the bottom of the object where the current file has it.
- **Flat water** (puddle, creek, pond) lies on the trail. Only a thin band at the ground line bumps the pet.
- If a file fails to load, the game falls back to its code-painted version, so a bad file never breaks a level.

## Obstacles

| Sprite (file) | File size (px) | Painted part (x, y, w, h) | How it's beaten | Placement (anchor) | Hit box (in file px) |
|---|---|---|---|---|---|
| `fence` (public/art/props/fence.webp) | 176 × 144 | 0, 0, 172, 144 | Jump (brings its own grass, no shadow) | center (0.5, 0.5); center sits 34 game px (68 file px) above the ground line | 95 × 86 (55% wide, 60% high, bottom-aligned), at x 38, y 58 |
| `fence-rail` (public/art/props/fence-rail.webp) | 176 × 144 | 5, 0, 166, 144 | Jump (brings its own grass, no shadow) | center (0.5, 0.5); center sits 34 game px (68 file px) above the ground line | 91 × 86 (55% wide, 60% high, bottom-aligned), at x 43, y 58 |
| `puddle` (public/art/props/puddle.webp) | 192 × 52 | 16, 0, 159, 52 | Jump (flat, lies on the trail) | center (0.5, 0.5); center sits -7 game px (-14 file px) above the ground line | 114 × 20, centered across the painted part, its bottom 12 px from the top (a thin band at the ground line) |
| `log` (public/art/props/log.webp) | 128 × 68 | 0, 7, 128, 61 | Jump | center (0.5, 0.5); center sits 17 game px (34 file px) above the ground line | 92 × 49 (72% wide, 80% high, bottom-aligned), at x 18, y 19 |
| `rock` (public/art/props/rock.webp) | 92 × 76 | 2, 0, 88, 76 | Jump | center (0.5, 0.5); center sits 19 game px (38 file px) above the ground line | 63 × 61 (72% wide, 80% high, bottom-aligned), at x 14, y 15 |
| `sandcastle` (public/art/props/sandcastle.webp) | 100 × 104 | 0, 20, 100, 84 | Jump | center (0.5, 0.5); center sits 26 game px (52 file px) above the ground line | 72 × 67 (72% wide, 80% high, bottom-aligned), at x 14, y 37 |
| `driftwood` (public/art/props/driftwood.webp) | 156 × 52 | 14, 0, 128, 52 | Jump | center (0.5, 0.5); center sits 13 game px (26 file px) above the ground line | 92 × 42 (72% wide, 80% high, bottom-aligned), at x 32, y 10 |
| `branch` (public/art/props/branch.webp) | 220 × 100 | 0, 1, 220, 98 | Slide under (with `trunk` + `canopy`) | center (0.5, 0.5); center sits 65 game px (130 file px) above the ground line | 158 × 98 (72% of the painted width, full painted height), at x 31, y 1 |
| `umbrella` (public/art/props/umbrella.webp) | 248 × 92 | 0, 18, 247, 74 | Slide under (with `umbrella-pole` posts) | center (0.5, 0.5); center sits 66 game px (132 file px) above the ground line | 178 × 74 (72% of the painted width, full painted height), at x 34, y 18 |
| `trashcan` (public/art/props/trashcan.webp) | 68 × 92 | 2, 0, 64, 92 | Jump | center (0.5, 0.5); center sits 23 game px (46 file px) above the ground line | 46 × 74 (72% wide, 80% high, bottom-aligned), at x 11, y 18 |
| `hydrant` (public/art/props/hydrant.webp) | 56 × 76 | 5, 0, 45, 76 | Jump | center (0.5, 0.5); center sits 19 game px (38 file px) above the ground line | 32 × 61 (72% wide, 80% high, bottom-aligned), at x 11, y 15 |
| `sign` (public/art/props/sign.webp) | 72 × 88 | 2, 0, 68, 88 | Jump | center (0.5, 0.5); center sits 22 game px (44 file px) above the ground line | 49 × 70 (72% wide, 80% high, bottom-aligned), at x 12, y 18 |
| `awning` (public/art/props/awning.webp) | 248 × 84 | 0, 0, 247, 83 | Slide under (with `umbrella-pole` posts) | center (0.5, 0.5); center sits 64 game px (128 file px) above the ground line | 178 × 83 (72% of the painted width, full painted height), at x 34, y 0 |
| `stump` (public/art/props/stump.webp) | 84 × 72 | 0, 0, 84, 72 | Jump | center (0.5, 0.5); center sits 18 game px (36 file px) above the ground line | 60 × 58 (72% wide, 80% high, bottom-aligned), at x 12, y 14 |
| `creek` (public/art/props/creek.webp) | 312 × 60 | 1, 3, 310, 57 | Jump (flat, lies on the trail) | center (0.5, 0.5); center sits -8 game px (-16 file px) above the ground line | 223 × 20, centered across the painted part, its bottom 14 px from the top (a thin band at the ground line) |
| `snowman` (public/art/props/snowman.webp) | 84 × 116 | 1, 14, 83, 102 | Jump | center (0.5, 0.5); center sits 29 game px (58 file px) above the ground line | 60 × 82 (72% wide, 80% high, bottom-aligned), at x 13, y 34 |
| `sled` (public/art/props/sled.webp) | 124 × 52 | 9, 0, 105, 52 | Jump | center (0.5, 0.5); center sits 13 game px (26 file px) above the ground line | 76 × 42 (72% wide, 80% high, bottom-aligned), at x 23, y 10 |
| `snowbranch` (public/art/props/snowbranch.webp) | 220 × 100 | 0, 1, 220, 98 | Slide under (with `trunk` + `snowcanopy`) | center (0.5, 0.5); center sits 65 game px (130 file px) above the ground line | 158 × 98 (72% of the painted width, full painted height), at x 31, y 1 |
| `haybale` (public/art/props/haybale.webp) | 112 × 80 | 9, 0, 92, 80 | Jump | center (0.5, 0.5); center sits 20 game px (40 file px) above the ground line | 66 × 64 (72% wide, 80% high, bottom-aligned), at x 22, y 16 |
| `pumpkin` (public/art/props/pumpkin.webp) | 80 × 68 | 5, 0, 70, 68 | Jump | center (0.5, 0.5); center sits 17 game px (34 file px) above the ground line | 50 × 54 (72% wide, 80% high, bottom-aligned), at x 15, y 14 |
| `autumnbranch` (public/art/props/autumnbranch.webp) | 220 × 100 | 0, 1, 220, 98 | Slide under (with `trunk` + `canopy-autumn`) | center (0.5, 0.5); center sits 65 game px (130 file px) above the ground line | 158 × 98 (72% of the painted width, full painted height), at x 31, y 1 |
| `cactus` (public/art/props/cactus.webp) | 68 × 104 | 0, 8, 68, 96 | Jump | center (0.5, 0.5); center sits 26 game px (52 file px) above the ground line | 49 × 77 (72% wide, 80% high, bottom-aligned), at x 10, y 27 |
| `tumbleweed` (public/art/props/tumbleweed.webp) | 80 × 76 | 2, 2, 75, 74 | Jump | center (0.5, 0.5); center sits 19 game px (38 file px) above the ground line | 54 × 59 (72% wide, 80% high, bottom-aligned), at x 12, y 17 |
| `arch` (public/art/props/arch.webp) | 260 × 88 | 0, 17, 260, 71 | Slide under (with `arch-leg` posts) | center (0.5, 0.5); center sits 64 game px (128 file px) above the ground line | 187 × 71 (72% of the painted width, full painted height), at x 36, y 17 |
| `trough` (public/art/props/trough.webp) | 140 × 52 | 8, 0, 123, 52 | Jump | center (0.5, 0.5); center sits 13 game px (26 file px) above the ground line | 89 × 42 (72% wide, 80% high, bottom-aligned), at x 25, y 10 |
| `clothesline` (public/art/props/clothesline.webp) | 260 × 88 | 0, 1, 260, 87 | Slide under (with `wood-post` posts) | center (0.5, 0.5); center sits 64 game px (128 file px) above the ground line | 187 × 87 (72% of the painted width, full painted height), at x 36, y 1 |
| `lantern` (public/art/props/lantern.webp) | 60 × 92 | 0, 10, 60, 82 | Jump | center (0.5, 0.5); center sits 23 game px (46 file px) above the ground line | 43 × 66 (72% wide, 80% high, bottom-aligned), at x 8, y 26 |
| `pond` (public/art/props/pond.webp) | 312 × 60 | 1, 1, 310, 59 | Jump (flat, lies on the trail) | center (0.5, 0.5); center sits -8 game px (-16 file px) above the ground line | 223 × 20, centered across the painted part, its bottom 14 px from the top (a thin band at the ground line) |
| `blossombranch` (public/art/props/blossombranch.webp) | 220 × 100 | 0, 0, 220, 100 | Slide under (with `trunk` + `canopy-blossom`) | center (0.5, 0.5); center sits 65 game px (130 file px) above the ground line | 158 × 100 (72% of the painted width, full painted height), at x 31, y 0 |
| `vines` (public/art/props/vines.webp) | 220 × 112 | 0, 0, 220, 111 | Slide under (with `trunk` + `canopy-jungle`) | center (0.5, 0.5); center sits 68 game px (136 file px) above the ground line | 158 × 111 (72% of the painted width, full painted height), at x 31, y 0 |
| `crate` (public/art/props/crate.webp) | 80 × 80 | 1, 0, 77, 80 | Jump | center (0.5, 0.5); center sits 20 game px (40 file px) above the ground line | 55 × 64 (72% wide, 80% high, bottom-aligned), at x 12, y 16 |
| `barrel` (public/art/props/barrel.webp) | 68 × 88 | 1, 0, 65, 88 | Jump | center (0.5, 0.5); center sits 22 game px (44 file px) above the ground line | 47 × 70 (72% wide, 80% high, bottom-aligned), at x 10, y 18 |
| `banner` (public/art/props/banner.webp) | 260 × 80 | 0, 3, 260, 77 | Slide under (with `pier-pole` posts) | center (0.5, 0.5); center sits 63 game px (126 file px) above the ground line | 187 × 77 (72% of the painted width, full painted height), at x 36, y 3 |

## Gopher holes

Each earth has two pictures: the mound behind the critter and a lip in front of it. The critter pops up between them and is cut off at the hole's lower edge, so the hole's spot in the picture matters. If a new painting moves the hole, send its center (in file px from the left, and up from the bottom) and I'll update `PAINTED_HOLES` in `src/art/props2.ts`. That's a one-line change.

| Hole sprite (file) | File size (px) | Painted part (x, y, w, h) | Placement (anchor) | Hole (file px) |
|---|---|---|---|---|
| `den-dirt` (public/art/critters/den-dirt.webp), mound (behind the critter) | 168 × 84 | 0, 1, 168, 83 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 82 px from the left, 28 px up from the bottom; critter cut off 10 px up from the bottom |
| `den-dirt-lip` (public/art/critters/den-dirt-lip.webp), front lip (drawn in front of the critter) | 168 × 84 | 17, 72, 132, 12 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 82 px from the left, 28 px up from the bottom; critter cut off 10 px up from the bottom |
| `den-sand` (public/art/critters/den-sand.webp), mound (behind the critter) | 168 × 84 | 3, 1, 161, 83 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 83 px from the left, 26 px up from the bottom; critter cut off 14 px up from the bottom |
| `den-sand-lip` (public/art/critters/den-sand-lip.webp), front lip (drawn in front of the critter) | 168 × 84 | 16, 68, 138, 16 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 83 px from the left, 26 px up from the bottom; critter cut off 14 px up from the bottom |
| `den-snow` (public/art/critters/den-snow.webp), mound (behind the critter) | 168 × 84 | 0, 0, 168, 84 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 82 px from the left, 26 px up from the bottom; critter cut off 16 px up from the bottom |
| `den-snow-lip` (public/art/critters/den-snow-lip.webp), front lip (drawn in front of the critter) | 168 × 84 | 9, 66, 153, 18 | bottom center (0.5, 1), 16 game px above the trail line, shown at 1.1× | hole center 82 px from the left, 26 px up from the bottom; critter cut off 16 px up from the bottom |
| `gopher` (public/art/critters/gopher.webp), the critter | 52 × 56 | 4, 0, 43, 56 | center, pops up out of the hole | no hit box (out of reach) |


## Painted in code (no file yet)

- **Climbing ledges:** `ledge-rock-<width>`, `ledge-sandstone-<width>`, plus the pillars `ledge-pillar-rock` and `ledge-pillar-sandstone` (`src/art/ledges.ts`). Ledges come in many widths, so painted ones would be a left end, a middle that repeats, and a right end. The standing surface sits 4 game px below the top of the picture.
