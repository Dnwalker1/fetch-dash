"""The game's pets as pictures: every layer of a look, tinted and stacked the
way the game draws them (multiply by the tint, then the layer's own alpha),
cut into cells per pose. Reads rig.json (made by export-rig.mjs).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


@lru_cache(maxsize=1)
def rig() -> dict:
    return json.loads((HERE / 'rig.json').read_text())


def poses() -> dict:
    return rig()['poses']


def looks() -> list[dict]:
    return rig()['looks']


def look_by_id(look_id: str) -> dict:
    for lk in looks():
        if lk['id'] == look_id:
            return lk
    raise SystemExit(f'No look called {look_id!r}. Run "mypet.py looks" for the list.')


def _hex(c: str) -> np.ndarray:
    c = c.lstrip('#')
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


@lru_cache(maxsize=512)
def _layer(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32) / 255.0


def layer_file(look: dict, layer: str, pose: str) -> Path:
    return ROOT / look['dir'] / f'{layer}-{pose}.webp'


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    """src drawn over dst (straight alpha, float RGBA)."""
    sa, da = src[..., 3:4], dst[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = np.where(oa > 0, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6), 0)
    return np.concatenate([rgb, oa], axis=-1)


def compose(look: dict, pose: str, only: str | None = None, skip: str | None = None) -> np.ndarray:
    """The whole strip for a pose as float RGBA. only/skip pick out one layer (e.g. 'detail')."""
    out = None
    for l in look['layers']:
        if only and l['layer'] != only:
            continue
        if skip and l['layer'] == skip:
            continue
        img = _layer(str(layer_file(look, l['layer'], pose))).copy()
        if l.get('tint'):
            img[..., :3] *= _hex(l['tint'])
        if l.get('alpha') is not None:
            img[..., 3] *= l['alpha']
        out = img if out is None else over(out, img)
    if out is None:
        p = poses()[pose]
        out = np.zeros((p['h'], p['w'] * p['n'], 4), dtype=np.float32)
    return out


def cells(strip: np.ndarray, pose: str) -> list[np.ndarray]:
    p = poses()[pose]
    return [strip[:, i * p['w']:(i + 1) * p['w']] for i in range(p['n'])]


def strip_of(cell_list: list[np.ndarray]) -> np.ndarray:
    return np.concatenate(cell_list, axis=1)


def to_image(a: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def missing_files() -> list[str]:
    """Layer files rig.json names that aren't in public/art (should be none)."""
    gone = []
    for lk in looks():
        for l in lk['layers']:
            for pose in poses():
                f = layer_file(lk, l['layer'], pose)
                if not f.exists():
                    gone.append(str(f.relative_to(ROOT)))
    return sorted(set(gone))
