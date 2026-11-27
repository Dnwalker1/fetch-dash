"""Lays a pet's cells out in one picture for the image model, and cuts the
model's picture back into the same cells.

Every cell sits centered in its own slot on a flat green background, drawn
at 2x so the model has room for detail. The slot is a little bigger than the
largest cell so there is background all round each pet.
"""
from __future__ import annotations

import numpy as np

import rig

# The poses the model repaints. The back views use the matched look as is.
PAINT_POSES = ['run', 'jump', 'slide', 'ready', 'catch', 'swim', 'dive']
BACK_POSES = ['back-run', 'back-lean-left', 'back-lean-right', 'back-jump']

UP = 2                      # cells are drawn at 2x in the grid
SLOT = (224, 176)           # slot size at 1x; 2x is 448 x 352 (multiples of 16)
BG = (0, 255, 0)            # flat green background

LAYOUTS = {
    # all 25 cells in one picture: best for keeping markings the same across frames
    'one': [{'poses': PAINT_POSES, 'cols': 5, 'rows': 5}],
    # two pictures, in case a 2240 x 1760 picture is refused or too dear
    'two': [
        {'poses': ['run', 'jump', 'slide', 'ready'], 'cols': 4, 'rows': 4},
        {'poses': ['catch', 'swim', 'dive'], 'cols': 4, 'rows': 3},
    ],
}


def plan(layout: str) -> list[dict]:
    """Each grid's size and, for every cell, its pose, index and box (x, y, w, h) at 2x."""
    sw, sh = SLOT[0] * UP, SLOT[1] * UP
    out = []
    for g in LAYOUTS[layout]:
        slots = [(p, i) for p in g['poses'] for i in range(rig.poses()[p]['n'])]
        assert len(slots) <= g['cols'] * g['rows'], g
        cells = []
        for k, (p, i) in enumerate(slots):
            col, row = k % g['cols'], k // g['cols']
            w, h = rig.poses()[p]['w'] * UP, rig.poses()[p]['h'] * UP
            x = col * sw + (sw - w) // 2
            y = row * sh + (sh - h) // 2
            cells.append({'pose': p, 'i': i, 'box': (x, y, w, h), 'slot': (col * sw, row * sh, sw, sh)})
        out.append({'size': (g['cols'] * sw, g['rows'] * sh), 'cells': cells})
    return out


def _up(cell: np.ndarray) -> np.ndarray:
    from PIL import Image
    im = rig.to_image(cell)
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def build(look_cells: dict[str, list[np.ndarray]], grid: dict) -> np.ndarray:
    """The grid picture (RGB float) with each cell drawn over the green background."""
    W, H = grid['size']
    img = np.zeros((H, W, 3), dtype=np.float32)
    img[...] = np.array(BG, dtype=np.float32) / 255.0
    for c in grid['cells']:
        x, y, w, h = c['box']
        up = _up(look_cells[c['pose']][c['i']])
        a = up[..., 3:4]
        img[y:y + h, x:x + w] = up[..., :3] * a + img[y:y + h, x:x + w] * (1 - a)
    return img


def rig_alpha_in_slot(cell: np.ndarray, c: dict) -> np.ndarray:
    """The rig cell's alpha at 2x, placed in its slot (slot-sized float array)."""
    sx, sy, sw, sh = c['slot']
    x, y, w, h = c['box']
    out = np.zeros((sh, sw), dtype=np.float32)
    out[y - sy:y - sy + h, x - sx:x - sx + w] = _up(cell)[..., 3]
    return out
