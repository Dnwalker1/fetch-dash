# The sloth rider

Don chose (26 Nov 2026) to let the Goodwookie sloth ride on any pet. When a
player ticks "Bring the sloth along" on the setup card, the sloth rides on
their pet in the game, and Design Your Pet paints it into the hero portrait.

## How the game places him

The sloth is its own picture, drawn over whatever picture the pet is showing.
For every frame of every pose, the game finds the top of the pet's head from
the picture's outline:

- side-on poses: the highest point of the front 40% of the body;
- from behind: the highest point of the middle half.

It puts the sloth's "seat" on that point, a little way into the head, and
tilts him with the pet. So one sloth fits all six breeds and the cat, in
every pose. Elon does not paint the sloth once per breed.

He is sized from the pet's standing height: 36% of it for dogs, 42% for the
cat. The numbers are in `SLOTH` in `src/art/rider.ts`.

Chewy is painted with the sloth already on, so he never gets a second one.

## What Elon paints

All pictures have a transparent background and face right, like the pets.

| File | Canvas | Seat (head-top point) | Used for | Needed? |
| --- | --- | --- | --- | --- |
| `public/art/sloth/side.webp` | 256 x 256 | x 154, y 154 | run, jump, ready, catch, swim, slide, dive | yes |
| `public/art/sloth/back.webp` | 256 x 256 | x 128, y 184 | the runs into the screen (pet seen from behind) | yes |
| `flat.webp` | 256 x 256 | x 154, y 154 | slide: lying flat, holding on tight | nice to have |
| `dive.webp` | 256 x 256 | x 154, y 154 | dive: cheeks puffed, holding his breath | nice to have |
| `jump.webp` | 256 x 256 | x 154, y 154 | jump: arms up, wheee | nice to have |

What each picture shows:

- **side.webp:** the sloth lying over the top of a head and hugging it, as on
  Chewy's card. Paint only the sloth, with no dog under him. The seat is where
  the top of the pet's head touches his belly. His arms and paws hang down past
  the seat on both sides, as if wrapped around a head.
- **back.webp:** the same sloth seen from behind (his back and the back of his
  head), arms hanging down either side of the pet's head.

The seat point is how the game lines him up. Put it at the spot given in the
table, or say where it ended up and the numbers can be changed in `SLOTH.seat`.

For now, `side.webp` is a stand-in cut from Chewy's card. Until `back.webp`
arrives, the runs into the screen show the side picture.

### Chewy without the sloth (later)

If a player unticks the box with Chewy chosen, Chewy keeps his sloth, because
it is painted into his pictures. To let the box take it off, Chewy needs a
second set without the sloth:

- run, jump, slide;
- ready, catch, swim, dive;
- back-run, back-jump, back-lean-left, back-lean-right;
- card.

## Adding the pictures

1. Drop each file into `public/art/sloth/`.
2. Add its key to `PAINTED` in `src/art/rider.ts`. Only listed files are
   loaded, so a missing file never shows as an error.
3. The flat, dive and jump variants also need a line in `syncSloth`
   (`src/scenes/GameScene.ts`) to pick them for the matching pose.

The Backyard Toss bonus round, the end card and the share picture don't show
the sloth yet.
