# Painted pet sprites

The in-game pet can be drawn from a painted sheet instead of the code-drawn
pet. The first one is Chewy, a golden retriever with a sloth riding on its back.
The code for it is in `src/art/sheets.ts`.

## The plan

A library of run sheets by body type, picked to match the photo and tinted to
the pet's colors:

- Dogs (about 11): retriever (feathered), lab (smooth), shepherd, husky,
  small fluffy, small smooth, doodle, bulldog or pit, dachshund, hound, spaniel.
- Cats (about 4): short-hair, long-hair, chunky, slim.

Each is painted in a light, neutral coat so the game can tint it. Markings
(white chest, socks, tabby stripes) are painted as separate layers that can be
turned on or off. Colors that don't tint well (black, dark brown) get a dark
version of the sheet.

Design Your Pet already looks at the photo, so it can return a body type and
the main colors with the portrait. The game then picks the sheet
(`sheetForBodyType`) and the tint, and the player can change either on the
hero card.

A character sheet like Chewy is one pet painted in its own colors. It's
shown as painted, without a tint.

## What each sheet needs

Put the files in `public/art/pets/<id>/`:

| File | What |
| --- | --- |
| `run.webp` | All run frames in one row, same size cells |
| `jump.webp` | The jump pose |
| `slide.webp` | The slide pose |
| `run-<marking>.webp`, `jump-<marking>.webp`, `slide-<marking>.webp` | One set per marking layer: the same cells, transparent except the marking |

- Paint at 2x the in-game size: the pet is 56 px tall in the game, so a run
  cell is 112 px tall.
- Paws on the bottom edge of each cell and the nose toward the right.
- Transparent background, with the body fully opaque. Chewy's first sprites
  came out partly see-through (about 80% opaque), so the scenery showed through
  the fur. I made them solid when adding them. Check the alpha on new sheets.
- 8 run frames worked well for Chewy (extend, front-land, contact, gather-a,
  gather-b, push, back-drive, reach), at 16 frames per second.

Then add an entry to `SHEETS` in `src/art/sheets.ts` with the cell size, frame
count, `coat` ('tint' or 'fixed'), any `markings`, the `dark` variant id, and
`fit` and `originX`. `fit` sets the size next to the drawn pets. `originX` sets
where the hit box sits across the picture. Long dogs sit back so the nose
doesn't reach far past it.

## Extra poses

Beyond run, jump and slide, each layer (and Chewy's sheet, and the cat) can
have these, named `<layer>-<pose>.webp` (Chewy: `<pose>.webp`). They load per
level (see `posesFor` in `GameScene.ts`) and each is used only once every
layer of it has loaded; otherwise the game falls back to the run, jump and
slide pictures.

| Pose | Cell | Frames | Used for |
| --- | --- | --- | --- |
| `back-run`, `back-lean-left`, `back-lean-right` | 189 x 112 | 8 | runs into the screen |
| `back-jump` | single | 1 | runs into the screen, in the air |
| `ready` | 189 x 150 | 4 (tail wag) | waiting to start, standing still |
| `catch` | 189 x 150 | 4 | the finish: 0-1 trot with the ball, 2-3 brake and stand |
| `swim` | 189 x 112 | 6 | paddling (water line 38 px above the bottom) |
| `dive` | single | 1 | diving under (same water line) |

Card pictures (512 x 512, fully painted, not tinted) are `card-<coat>.webp`,
plus `-<group>-<option>` for a shape that isn't the breed's first (for
example `card-blue-merle-ears-prick.webp`). Chewy's is `card.webp` and the
cat's `card-<palette>.webp`. The hero card and the photo box show them when
the player has no portrait.
