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
