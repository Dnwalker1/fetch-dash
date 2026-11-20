# Painted props and critters

The treats, the things on the trail (fences, logs, branches, umbrellas and so
on), the critters and the dens are painted pictures, one file per texture key:

- props in `public/art/props/<key>.webp`
- critters and dens in `public/art/critters/<key>.webp`
- the Backyard Toss bonus round in `public/art/bonus/<key>.webp` (its keys and sizes are listed at the top of `src/scenes/BonusScene.ts` and in `BONUS_ART` in `src/art/artFiles.ts`). Elon's v1 set is in: sky with the back fence, lawn, hedge, ring, treat piles, yarn, sprinkler, drop and the ball's shadow. Their props stand on the bottom edge of the picture; the sprinkler's spray comes from its top cap.

The code is in `src/art/artFiles.ts`. (The pets have their own sheets; see
`docs/painted-pets.md`.)

## How it works

- `artFiles.ts` lists the keys that have a file. The game loads only the
  files the current level uses: its obstacles with their trees or poles, the
  treats and the ball, both pets' chasers, its gawks and its den.
- A key with a file is never painted in code. If its file fails to load, the
  code-painted version is made instead, so the game still runs. A two-frame
  critter falls back as a pair, so both frames match.
- A key that isn't listed is painted in code, as before (the leaf and petal
  specks, for one).
- Hit areas and ground shadows of obstacles are measured from the painted
  part of the picture (`artBox`), not the whole picture, so a prop that sits
  in clear space gets a hit area that fits it. The hit area is 72% of the
  painted width and 80% of its height for things to jump over, and its full
  height for things to slide under, so the bottom edge stays put. An obstacle
  can set its own share with `hit` in `OBSTACLES` (`src/scenes/GameScene.ts`).
- Flap animations are made once both pictures exist, since a level loads only
  the critters it uses.

## What each picture needs

- Exactly 2x the size the code paints that key (a 24x14 bone is 48x28). The
  sizes are the `paint(scene, '<key>', w, h, ...)` calls in `src/art/props.ts`,
  `props2.ts`, `critters.ts` and `critters2.ts`.
- Transparent background, the item centered, standing on the bottom edge if
  it stands on the ground. Critters face left (they run and fly right to left).
- The body fully opaque. Check the alpha: the first blossom canopy, blossom
  branch, umbrella and banner came out partly see-through where they're pale
  (the keyer took some of the white). They were made solid before adding.
- Two-frame critters (`-0` wings up or arm up, `-1` down): the body must sit
  in the same place in both frames. The first painted birds were centered
  frame by frame, so the body jumped up to 14 px each flap; they were lined up
  before adding (the canvas grew a little where the wings needed room).
- Poles (`umbrella-pole`, `arch-leg`, `wood-post`, `pier-pole`) are stretched
  to their size in the game, and the awning uses the umbrella pole tinted dark.
- Tree canopies are scenery only; the branch is what the pet slides under.

## Fences

The two fences cross the trail at an angle, near end at the lower left, each
on its own patch of grass: the white picket `fence` (Park Trail and Hilltop
Trail) and the split-rail `fence-rail` (Autumn Orchard and Sunny Farm). Both
are 88x72 in the game (176x144 pictures). They sit 2 px into the trail, have
no shadow (the grass patch is their ground), and their hit area is 55% of
the painted width and 60% of its height, centered and on the ground, because
the angle leaves the top corners empty. The code-drawn stand-ins are angled
fences of the same size.

## Dens

One painted mound per kind of earth instead of one per level: `den-dirt`,
`den-sand`, `den-snow`, each with a `-lip` picture drawn in front of the
gopher. The earth comes from the level's `tufts` (snow, sand, anything else is
dirt). `PAINTED_HOLES` in `src/art/props2.ts` says where each hole is (measured
from the pictures), and the gopher is cut off at the hole's lower edge, with
the lip covering the seam.

To add or replace a picture, drop the webp in its folder and make sure its key
is listed in `artFiles.ts`.
