# Painted props

The treats and the things on the trail (fences, logs, branches, umbrellas
and so on) are painted pictures, one file per texture key in
`public/art/props/<key>.webp`. The code is in `src/art/propArt.ts`.

## How it works

- `PROP_FILES` lists the keys that have a file. The game loads only the
  files the current level uses (its obstacles, their trees or poles, the
  treats and the ball).
- A key with a file is never painted in code. If its file fails to load,
  the code-painted version is made instead, so the game still runs.
- A key that isn't listed is painted in code, as before.
- Hit areas and ground shadows are measured from the painted part of the
  picture (`artBox`), not the whole picture. That's how the fence, which
  fills only the lower part of its picture, gets a low hit area. The hit area
  is 72% of the painted width and 80% of its height for things to jump over,
  and its full height for things to slide under, so the bottom edge stays put.

## What each picture needs

- Exactly 2x the size the code paints that key (a 24x14 bone is 48x28). The
  sizes are the `paint(scene, '<key>', w, h, ...)` calls in `src/art/props.ts`
  and `src/art/props2.ts`.
- Transparent background, the item centered and standing on the bottom edge.
- The body fully opaque. Check the alpha: the first blossom canopy, blossom
  branch, umbrella and banner came out partly see-through where they're pale
  (the keyer took some of the white). They were made solid before adding.
- Poles (`umbrella-pole`, `arch-leg`, `wood-post`, `pier-pole`) are stretched
  to their size in the game, and the awning uses the umbrella pole tinted dark.
- Tree canopies are scenery only; the branch is what the pet slides under.

To add or replace one, drop the webp in `public/art/props/` and make sure its
key is in `PROP_FILES`.
