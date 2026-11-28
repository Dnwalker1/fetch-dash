# My Pet prototype

Phase 1 of Elon's "Build Your Own Pet" plan (Track B): a player's own pet,
painted onto the game's own frames, so every pose lines up with the hit box
and the sloth seat. Internal test only: nothing here is in the game, on the
Wix site or in the phone app.

## How it works

1. **Match** (`/v1/responses`, `gpt-6-luna`, `store: false`). Reads the photo:
   is it a real dog or cat, is a person in it, and which of the game's looks
   (`rig.json`: every breed, coat, ear and tail option and the cat's palettes)
   is closest. Stops if there is no pet or there is a person.
2. **Paint** (`/v1/images/edits`, pinned `gpt-image-2.5-sunburst-2026-09-08`,
   the same model as the game's portraits). The matched look's 25 cells
   (run 8, jump, slide, ready 4, catch 4, swim 6, dive) are drawn at 2x, each
   in its own 448 x 352 box on a transparent background, in one 2240 x 1760
   picture (`--layout two` splits it in two). The model gets that picture and
   the photo and repaints the coat to match the pet, keeping every outline.
   A second picture does the 25 views from behind, with the painted side
   views as a third reference so the markings match (`--back keep` skips it
   and keeps the matched look from behind).
3. **Clean** (code only, `clean.py`). For each cell: find the pet, line it back
   up with the rig's outline (image models nudge and resize), shrink to game
   size, keep exactly the rig's outline, fill gaps, take off green fringe,
   pull colors toward run frame 2 so markings keep their shade, and put the
   rig's eyes and nose back on top.
4. **Check** every cell: fit to the outline, holes (outline left unpainted,
   the one that matters most), spill, how much the model resized it, and
   color drift between frames. Limits are in `clean.py` and were loosened
   after the first real runs: the model paints a little past the outline,
   which is trimmed off.

## First real runs (28 Nov 2026)

- Transparent background, not green: on green the model painted a dark,
  glowing background, and the pets couldn't be found.
- The model shrinks the pets to about 75 to 80% in their boxes; the line-up
  undoes it.
- A tabby cat: side and extra poses $0.04, views from behind $0.05, photo
  reading $0.016, so about $0.11 per pet at medium quality.

`--reuse` cleans the pictures saved from the last run again at no cost.

Output per pet in `out/<name>/`: `sprites/custom-<pose>.webp` (game sizes,
same cells as `public/art/pets/`), `preview.png` (every pose, matched look
above the painted one), `run.gif`, the grids sent and returned, and
`report.json` (checks, tokens, cost). `batch` also writes `out/summary.html`.

## Running it

```
pip install -r tools/mypet/requirements.txt
node tools/mypet/export-rig.mjs                 # only after breeds or cats change

python tools/mypet/mypet.py looks
python tools/mypet/mypet.py dry-run --look gsd/black-and-tan/ears-up   # free
python tools/mypet/mypet.py paint --photo photos/rex.jpg               # paid
python tools/mypet/mypet.py batch --photos tools/mypet/photos/         # paid
```

`dry-run` costs nothing: a stand-in for the model paints another coat of the
same breed, moves and resizes each pet a little, blurs and adds noise, and the
clean-up has to undo it. It reports how far off the line-up was.

Paid commands need the OpenAI key, from `OPENAI_API_KEY` or from a network
proxy that adds it for api.openai.com. Every call's real token use and cost
goes in `out/spend.json`, and `--budget` (default $40) stops before a call
that could pass it. Image rates are $5 text in, $8 image in, $30 out per 1M
tokens (OpenAI's page as read on 27 Nov 2026); the check model's rates were
not looked up and are set high on purpose. Check them on the pricing page.

Photos: dogs and cats only, no people, not committed (the repo is public).
Photos go only to OpenAI, with the same models and settings as the portraits.

## What the test should answer

- How many pets pass every check the first time (plan's goal: 70% or more).
- Real cost per pet from `usage` (goal: under $1).
- Whether the result looks like the pet, and whether Don likes the look.
- Whether `2240x1760` is accepted (if not it falls back to `size=auto` and
  says so; try `--layout two`), and whether `quality=low` is good enough.
