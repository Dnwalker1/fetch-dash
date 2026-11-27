"""Turns the model's picture back into game-ready cells.

For each cell:
 1. find the pet in its slot (everything that isn't the green background),
 2. line it back up with the rig's outline (image models nudge and resize
    what they repaint), first from the centers and sizes, then by a small
    search,
 3. shrink to game size and keep only the rig's outline (paws, nose and hit
    box stay exactly where the game expects them),
 4. fill any gaps from nearby fur, take green fringe off the edges,
 5. optionally pull each frame's colors toward the reference frame
    (run frame 2, "contact") so a marking can't change shade frame to frame,
 6. put the rig's eyes and nose layer back on top,
 7. measure it (the checks below).
"""
from __future__ import annotations

import numpy as np
from PIL import Image

import grid as G
import rig

CHECKS = {
    'fit': 0.90,        # overlap of the repainted pet with the rig outline (IoU), at least
    'holes': 0.05,      # share of the outline the model left empty, at most
    'spill': 0.08,      # share of the repainted pet outside the outline, at most
    'scale': 0.12,      # how far the model resized the pet (|scale - 1|), at most
    'drift': 28.0,      # frame's average color distance from the reference frame (0-441), at most
}
REF = ('run', 2)


def segment(rgb: np.ndarray) -> np.ndarray:
    """True where the pet is: not the flat green background, which the model may shift a little."""
    border = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3), rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenish = (g - np.maximum(r, b)) > 0.35
    return (dist > 0.25) & ~greenish


def _moments(m: np.ndarray) -> tuple[float, float, float]:
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return 0.0, 0.0, 0.0
    return float(xs.mean()), float(ys.mean()), float(len(xs))


def _warp_nearest(m: np.ndarray, s: float, ox: float, oy: float) -> np.ndarray:
    """m sampled at (ox + s*x, oy + s*y) for each pixel (x, y) of the result."""
    H, W = m.shape
    xs = np.clip(np.rint(ox + s * np.arange(W)).astype(int), 0, W - 1)
    ys = np.clip(np.rint(oy + s * np.arange(H)).astype(int), 0, H - 1)
    inside_x = (ox + s * np.arange(W) >= 0) & (ox + s * np.arange(W) <= W - 1)
    inside_y = (oy + s * np.arange(H) >= 0) & (oy + s * np.arange(H) <= H - 1)
    return m[np.ix_(ys, xs)] & inside_y[:, None] & inside_x[None, :]


def align(mask: np.ndarray, target: np.ndarray) -> tuple[float, float, float, float]:
    """(scale, ox, oy, iou): rig pixel (x, y) is at (ox + s*x, oy + s*y) in the model's slot."""
    t = target > 0.5
    mx, my, ma = _moments(mask)
    tx, ty, ta = _moments(t)
    if ma == 0 or ta == 0:
        return 1.0, 0.0, 0.0, 0.0
    s0 = float(np.sqrt(ma / ta))
    best = (-1.0, s0, mx - s0 * tx, my - s0 * ty)
    tsum = t.sum()

    def iou(s, ox, oy):
        w = _warp_nearest(mask, s, ox, oy)
        inter = (w & t).sum()
        return inter / (w.sum() + tsum - inter + 1e-6)

    # coarse, then fine
    for step_s, step_p, reach in ((0.02, 3, 3), (0.005, 1, 2)):
        _, s_c, ox_c, oy_c = best
        for ds in np.arange(-reach, reach + 1) * step_s:
            s = s_c + ds
            # keep the center fixed while the scale changes
            cx, cy = ox_c + s_c * tx, oy_c + s_c * ty
            for dx in np.arange(-reach, reach + 1) * step_p:
                for dy in np.arange(-reach, reach + 1) * step_p:
                    ox, oy = cx - s * tx + dx, cy - s * ty + dy
                    v = iou(s, ox, oy)
                    if v > best[0]:
                        best = (v, s, ox, oy)
    v, s, ox, oy = best
    return s, ox, oy, float(v)


def _fill(rgb: np.ndarray, have: np.ndarray, need: np.ndarray, steps: int = 24) -> tuple[np.ndarray, np.ndarray]:
    """Fills pixels in need but not have from their neighbors, a ring at a time."""
    rgb, have = rgb.copy(), have.copy()
    for _ in range(steps):
        todo = need & ~have
        if not todo.any():
            break
        acc = np.zeros_like(rgb)
        n = np.zeros(have.shape, dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                h = np.roll(np.roll(have, dy, 0), dx, 1)
                c = np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc += c * h[..., None]
                n += h
        grow = todo & (n > 0)
        rgb[grow] = acc[grow] / n[grow][:, None]
        have |= grow
    return rgb, have


def despill(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    out = rgb.copy()
    out[..., 1] = np.minimum(g, np.maximum(r, b) + 0.04)
    return out


def _stats(rgb: np.ndarray, a: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    m = a > 0.5
    if m.sum() < 10:
        return np.zeros(3), np.ones(3), 0.0
    px = rgb[m]
    return px.mean(0), px.std(0) + 1e-3, float(m.sum())


def clean_grid(out_rgb: np.ndarray, grid: dict, rig_cells: dict) -> dict:
    """Cleans every cell of one grid. Returns {(pose, i): {'cell': RGBA float, 'm': measures}}."""
    res = {}
    for c in grid['cells']:
        pose, i = c['pose'], c['i']
        rc = rig_cells[pose][i]
        sx, sy, sw, sh = c['slot']
        slot = out_rgb[sy:sy + sh, sx:sx + sw]
        mask = segment(slot)
        target = G.rig_alpha_in_slot(rc, c)
        s, ox, oy, iou = align(mask, target)
        # the slot, resampled into rig coordinates (smooth), then to game size
        im = Image.fromarray(np.clip(slot * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')
        aligned = im.transform((sw, sh), Image.AFFINE, (s, 0, ox, 0, s, oy), resample=Image.BICUBIC)
        mk = Image.fromarray((mask * 255).astype(np.uint8), 'L').transform((sw, sh), Image.AFFINE, (s, 0, ox, 0, s, oy), resample=Image.BILINEAR)
        x, y, w, h = c['box']
        box = (x - sx, y - sy, x - sx + w, y - sy + h)
        gw, gh = w // G.UP, h // G.UP
        rgb = np.asarray(aligned.crop(box).resize((gw, gh), Image.LANCZOS), dtype=np.float32) / 255.0
        got = np.asarray(mk.crop(box).resize((gw, gh), Image.BILINEAR), dtype=np.float32) / 255.0 > 0.5
        alpha = rc[..., 3]
        inside = alpha > 0.02
        body = alpha > 0.5
        holes = float((body & ~got).sum() / max(body.sum(), 1))
        spill = float((got & ~body).sum() / max(got.sum(), 1))
        rgb = despill(rgb)
        rgb, have = _fill(rgb, got & inside, inside)
        # anything still empty takes the matched look's own color
        rgb[inside & ~have] = rc[..., :3][inside & ~have]
        res[(pose, i)] = {'rgb': rgb, 'alpha': alpha, 'm': {
            'fit': round(iou, 4), 'holes': round(holes, 4), 'spill': round(spill, 4),
            'scale': round(float(abs(s - 1)), 4), 'shift': [round(float(ox), 1), round(float(oy), 1)],
        }}
    return res


def finish(all_cells: dict, detail_cells: dict, steady: float) -> dict:
    """Color steadiness, eyes and nose on top, and the checks, across every repainted cell."""
    ref = all_cells.get(REF) or next(iter(all_cells.values()))
    rmean, rstd, rarea = _stats(ref['rgb'], ref['alpha'])
    out = {}
    for key, v in all_cells.items():
        rgb, a = v['rgb'], v['alpha']
        mean, std, area = _stats(rgb, a)
        drift0 = float(np.linalg.norm((mean - rmean) * 255))
        same_view = rarea > 0 and 0.6 <= area / rarea <= 1.6
        if steady > 0 and same_view:
            moved = (rgb - mean) / std * rstd + rmean
            rgb = np.clip(rgb * (1 - steady) + moved * steady, 0, 1)
        mean2, _, _ = _stats(rgb, a)
        drift = float(np.linalg.norm((mean2 - rmean) * 255)) if same_view else 0.0
        cell = np.concatenate([rgb, a[..., None]], axis=-1)
        d = detail_cells[key[0]][key[1]]
        cell = rig.over(cell, d)  # the outline is the rig's (body plus eyes, nose, whiskers)
        m = dict(v['m'], drift=round(drift, 1), drift_before=round(drift0, 1))
        fails = []
        if m['fit'] < CHECKS['fit']: fails.append('fit')
        if m['holes'] > CHECKS['holes']: fails.append('holes')
        if m['spill'] > CHECKS['spill']: fails.append('spill')
        if m['scale'] > CHECKS['scale']: fails.append('scale')
        if m['drift'] > CHECKS['drift']: fails.append('drift')
        m['fails'] = fails
        out[key] = {'cell': cell, 'm': m}
    return out
