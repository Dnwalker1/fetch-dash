"""My Pet prototype: a player's own pet, painted onto the game's frames.

  python tools/mypet/mypet.py looks                      list the looks the photo can match
  python tools/mypet/mypet.py grid --look lab/yellow     the picture the model would get (free)
  python tools/mypet/mypet.py dry-run --look lab/yellow  the whole clean-up on a fake repaint (free)
  python tools/mypet/mypet.py match --photo rex.jpg      step 1 only: closest look (about 1 cent)
  python tools/mypet/mypet.py paint --photo rex.jpg      steps 1-3 (OpenAI, budget-capped)
  python tools/mypet/mypet.py batch --photos folder/     paint every photo, then a summary page

Results go to tools/mypet/out/<name>/ (never committed). See README.md.
"""
from __future__ import annotations

import argparse
import html
import io
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

import clean as C
import grid as G
import rig

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'

MATCH_PROMPT = """You help a pet game pick the closest ready-made sprite for a player's pet photo.

First decide:
- is_pet_photo: true only if the photo clearly shows a real dog or cat.
- has_person: true if any person or human body part is visible.

Then pick look_id: the one look from this list whose body shape, ears, tail and coat pattern are closest to the pet (colors are repainted later, so shape and pattern matter most):
{looks}

Answer with JSON:
{{"is_pet_photo": bool, "has_person": bool, "species": "dog" | "cat" | "other",
  "look_id": "<one id from the list>", "confidence": 0.0-1.0,
  "coat": {{"base": "#rrggbb", "light": "#rrggbb", "dark": "#rrggbb"}},
  "markings": "<short: where the white, dark or patterned areas are>",
  "why": "<one short sentence>"}}"""

PAINT_PROMPT = """Image 1 is a sheet of {n} small game sprites of one {species}, each in its own box on a flat bright green (#00FF00) background. Image 2 is a photo of the player's real {species}.

Repaint every sprite in image 1 so it is clearly this exact {species} from image 2: its coat colors, its markings and patches in the same places, its face mask, ear colors, eye color and tail color.{markings}

Rules, for every sprite:
- Keep each sprite's exact outline, pose, size and position in its box. Do not move, resize, redraw or add legs, ears or tails. Only the colors and fur inside each outline change.
- The markings must sit on the same body parts in every sprite (they are all the same animal running, jumping, sliding, standing, catching, swimming and diving).
- Same soft painted style as image 1: light from the upper left, a soft belly highlight, outlines a darker shade of the fur (never black outlines), no shading on the background.
- Keep the background flat pure green (#00FF00) everywhere outside the sprites. No shadows, no ground, no text, no frames, no collars or logos.
- Do not put a person, any text or anything else in the picture."""


def _load_photo(p: Path) -> bytes:
    im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
    im.thumbnail((1024, 1024), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=88)
    return buf.getvalue()


def _png(a: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)).save(buf, 'PNG')
    return buf.getvalue()


def _cells_for(look: dict) -> tuple[dict, dict, dict]:
    """(full cells, cells without the eyes and nose, eyes-and-nose-only cells) per pose."""
    full, body, det = {}, {}, {}
    for p in rig.poses():
        full[p] = rig.cells(rig.compose(look, p), p)
        body[p] = rig.cells(rig.compose(look, p, skip='detail'), p)
        det[p] = rig.cells(rig.compose(look, p, only='detail'), p)
    return full, body, det


# ---------- results on disk ----------

def _save(dest: Path, look: dict, cleaned: dict, full: dict, meta: dict) -> dict:
    """Game-ready strips, previews and the report. Returns the report."""
    dest.mkdir(parents=True, exist_ok=True)
    sprites = dest / 'sprites'
    sprites.mkdir(exist_ok=True)
    strips = {}
    for p, spec in rig.poses().items():
        if p in G.PAINT_POSES:
            cl = [cleaned[(p, i)]['cell'] for i in range(spec['n'])]
        else:
            cl = full[p]  # back views: the matched look as it is
        strips[p] = rig.strip_of(cl)
        rig.to_image(strips[p]).save(sprites / f'custom-{p}.webp', lossless=True)
    _contact(dest / 'preview.png', look, full, strips)
    _gif(dest / 'run.gif', strips['run'], 8)
    fails = {f'{p}-{i}': v['m']['fails'] for (p, i), v in cleaned.items() if v['m']['fails']}
    ms = [v['m'] for v in cleaned.values()]
    report = dict(meta, look=look['id'], passed=not fails, failed_cells=fails, worst={
        'fit': min(m['fit'] for m in ms), 'holes': max(m['holes'] for m in ms), 'spill': max(m['spill'] for m in ms),
        'scale': max(m['scale'] for m in ms), 'drift': max(m['drift'] for m in ms),
    }, cells={f'{p}-{i}': v['m'] for (p, i), v in cleaned.items()}, limits=C.CHECKS)
    (dest / 'report.json').write_text(json.dumps(report, indent=1))
    return report


def _contact(path: Path, look: dict, full: dict, strips: dict) -> None:
    """Each pose: the matched look on top, the result under it, at 2x on a light background."""
    pad, scale = 10, 2
    rows = []
    for p in rig.poses():
        a = rig.to_image(rig.strip_of(full[p]))
        b = rig.to_image(strips[p])
        rows.append((p, a, b))
    W = max(r[1].width for r in rows) * scale + 2 * pad + 110
    H = sum((r[1].height * 2) * scale + 3 * pad for r in rows) + pad
    sheet = Image.new('RGBA', (W, H), (236, 240, 232, 255))
    d = ImageDraw.Draw(sheet)
    y = pad
    for p, a, b in rows:
        d.text((pad, y + 4), p, fill=(40, 40, 40, 255))
        d.text((pad, y + 18), 'matched', fill=(120, 120, 120, 255))
        d.text((pad, y + a.height * scale + pad + 4), 'painted' if p in G.PAINT_POSES else 'kept', fill=(120, 120, 120, 255))
        for k, im in enumerate((a, b)):
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            sheet.alpha_composite(big, (110, y + k * (a.height * scale + pad)))
        y += a.height * 2 * scale + 3 * pad
    sheet.convert('RGB').save(path)


def _gif(path: Path, strip: np.ndarray, n: int) -> None:
    im = rig.to_image(strip)
    w = im.width // n
    frames = []
    for i in range(n):
        f = Image.new('RGBA', (w * 2, im.height * 2), (236, 240, 232, 255))
        f.alpha_composite(im.crop((i * w, 0, (i + 1) * w, im.height)).resize((w * 2, im.height * 2), Image.LANCZOS))
        frames.append(f.convert('RGB'))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=1000 // 16, loop=0)


# ---------- the steps ----------

def match(photo: bytes, budget, note: str) -> dict:
    import openai_api as O
    listing = '\n'.join(f'- {lk["id"]}: {lk["label"]}' for lk in rig.looks())
    ans = O.read_photo(photo, MATCH_PROMPT.format(looks=listing), budget, note)
    ids = {lk['id'] for lk in rig.looks()}
    if ans.get('look_id') not in ids:
        species = ans.get('species') if ans.get('species') in ('dog', 'cat') else 'dog'
        ans['look_id'] = 'cat/grey' if species == 'cat' else 'lab/yellow'
        ans['look_fallback'] = True
    return ans


def paint_one(photo_path: Path, args, budget) -> dict:
    import openai_api as O
    name = args.name or photo_path.stem
    dest = OUT / name
    photo = _load_photo(photo_path)
    meta = {'name': name, 'photo': photo_path.name, 'when': time.strftime('%Y-%m-%d %H:%M'), 'layout': args.layout, 'quality': args.quality}
    if args.look:
        look, m = rig.look_by_id(args.look), None
    else:
        m = match(photo, budget, f'{name}: match')
        meta['match'] = m
        if not m.get('is_pet_photo') or m.get('has_person'):
            dest.mkdir(parents=True, exist_ok=True)
            meta['stopped'] = 'no pet in the photo' if not m.get('is_pet_photo') else 'a person is in the photo'
            (dest / 'report.json').write_text(json.dumps(meta, indent=1))
            print(f'{name}: stopped, {meta["stopped"]}. Nothing was painted.')
            return meta
        look = rig.look_by_id(m['look_id'])
    full, body, det = _cells_for(look)
    species = look['species']
    markings = f' Its markings: {m["markings"]}.' if m and m.get('markings') else ''
    cleaned_raw, usage_all, cost0 = {}, [], budget.total
    dest.mkdir(parents=True, exist_ok=True)
    for k, g in enumerate(G.plan(args.layout)):
        gin = G.build(body, g)
        Image.fromarray(np.clip(gin * 255 + 0.5, 0, 255).astype(np.uint8)).save(dest / f'grid{k + 1}-sent.png')
        prompt = PAINT_PROMPT.format(n=len(g['cells']), species=species, markings=markings)
        size = f'{g["size"][0]}x{g["size"][1]}'
        try:
            png, usage = O.repaint(_png(gin), photo, prompt, size, args.quality, budget, f'{name}: grid {k + 1}')
        except O.OpenAIError as e:
            if e.status == 400 and 'size' in e.message.lower():
                print(f'  size {size} refused ({e.message}); trying size=auto')
                png, usage = O.repaint(_png(gin), photo, prompt, 'auto', args.quality, budget, f'{name}: grid {k + 1} (auto size)')
                meta['size_fallback'] = True
            else:
                raise
        usage_all.append(usage)
        got = Image.open(io.BytesIO(png)).convert('RGB')
        got.save(dest / f'grid{k + 1}-back.png')
        meta.setdefault('returned_sizes', []).append(list(got.size))
        if got.size != g['size']:
            got = got.resize(g['size'], Image.LANCZOS)
        cleaned_raw.update(C.clean_grid(np.asarray(got, dtype=np.float32) / 255.0, g, body))
    cleaned = C.finish(cleaned_raw, det, args.steady)
    meta['usage'] = usage_all
    meta['cost'] = round(budget.total - cost0, 4)
    rep = _save(dest, look, cleaned, full, meta)
    print(f'{name}: {"PASS" if rep["passed"] else "FAIL"} as {look["id"]}, ${meta["cost"]:.3f}, worst {rep["worst"]}. See {dest}')
    return rep


# ---------- the free dry run ----------

def fake_model(gin: np.ndarray, g: dict, fake: np.ndarray, rnd: random.Random) -> tuple[np.ndarray, dict]:
    """Stands in for the image model: each pet in a slightly different place and size, a
    blurred edge, noise, an off-green background, and the whole
    picture back at another size. Returns (picture, the true moves)."""
    H, W = gin.shape[:2]
    out = np.zeros_like(gin)
    out[...] = np.array([8, 236, 22]) / 255.0
    truth = {}
    for c in g['cells']:
        sx, sy, sw, sh = c['slot']
        src = fake[sy:sy + sh, sx:sx + sw]
        s = 1 + rnd.uniform(-0.05, 0.05)
        dx, dy = rnd.uniform(-12, 12), rnd.uniform(-10, 10)
        # model pixel (u, v) shows rig pixel ((u - cx - dx) / s + cx, ...)
        cx, cy = sw / 2, sh / 2
        im = Image.fromarray(np.clip(src * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
        a, b = 1 / s, cx - (cx + dx) / s
        e, f = 1 / s, cy - (cy + dy) / s
        moved = im.transform((sw, sh), Image.AFFINE, (a, 0, b, 0, e, f), resample=Image.BICUBIC)
        moved = moved.filter(ImageFilter.GaussianBlur(0.7))
        mv = np.asarray(moved, dtype=np.float32) / 255.0
        al = mv[..., 3:4]
        out[sy:sy + sh, sx:sx + sw] = mv[..., :3] * al + out[sy:sy + sh, sx:sx + sw] * (1 - al)
        truth[(c['pose'], c['i'])] = (s, dx, dy)
    out += np.random.default_rng(rnd.randint(0, 1 << 30)).normal(0, 0.015, out.shape)
    out = np.clip(out, 0, 1)
    im = Image.fromarray((out * 255).astype(np.uint8)).resize((int(W * 0.9) // 16 * 16, int(H * 0.9) // 16 * 16), Image.LANCZOS)
    return np.asarray(im.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255.0, truth


def dry_run(args) -> None:
    look = rig.look_by_id(args.look)
    others = [lk for lk in rig.looks() if lk['dir'] == look['dir'] and lk['layers'][0] != look['layers'][0]]
    fake_look = rig.look_by_id(args.fake) if args.fake else (others[0] if others else look)
    if fake_look['dir'] != look['dir']:
        raise SystemExit('--fake must be another coat of the same breed (same outline).')
    rnd = random.Random(args.seed)
    full, body, det = _cells_for(look)
    _, fbody, _ = _cells_for(fake_look)
    name = args.name or f'dry-{look["id"].replace("/", "_")}'
    dest = OUT / name
    dest.mkdir(parents=True, exist_ok=True)
    cleaned_raw, errs = {}, []
    for k, g in enumerate(G.plan(args.layout)):
        gin = G.build(body, g)
        Image.fromarray(np.clip(gin * 255 + 0.5, 0, 255).astype(np.uint8)).save(dest / f'grid{k + 1}-sent.png')
        fake = np.zeros((*gin.shape[:2], 4), dtype=np.float32)
        for c in g['cells']:
            x, y, w, h = c['box']
            fake[y:y + h, x:x + w] = G._up(fbody[c['pose']][c['i']])
        got, truth = fake_model(gin, g, fake, rnd)
        Image.fromarray((got * 255).astype(np.uint8)).save(dest / f'grid{k + 1}-back.png')
        res = C.clean_grid(got, g, body)
        for key, v in res.items():
            s, dx, dy = truth[key]
            v['m']['true_move'] = [round(s, 3), round(dx, 1), round(dy, 1)]
            # where rig pixel (0,0) really went vs where the clean-up put it
            cx, cy = g['cells'][0]['slot'][2] / 2, g['cells'][0]['slot'][3] / 2
            ox_true = cx + dx - s * cx
            oy_true = cy + dy - s * cy
            errs.append(max(abs(v['m']['shift'][0] - ox_true), abs(v['m']['shift'][1] - oy_true)))
        cleaned_raw.update(res)
    cleaned = C.finish(cleaned_raw, det, args.steady)
    meta = {'name': name, 'dry_run': True, 'fake_coat': fake_look['id'], 'layout': args.layout, 'seed': args.seed,
            'alignment_error_px_at_2x': {'max': round(float(max(errs)), 2), 'mean': round(float(sum(errs) / len(errs)), 2)}}
    rep = _save(dest, look, cleaned, full, meta)
    print(f'{name}: {"PASS" if rep["passed"] else "FAIL"}; worst {rep["worst"]}; alignment error at 2x: {meta["alignment_error_px_at_2x"]}. See {dest}')


# ---------- batch summary ----------

def summary(reports: list[dict], budget_total: float) -> Path:
    rows = []
    for r in reports:
        n = r.get('name', '?')
        status = r.get('stopped') or ('pass' if r.get('passed') else 'fail: ' + ', '.join(sorted({f for v in r.get('failed_cells', {}).values() for f in v})))
        rows.append(f'<tr><td>{html.escape(n)}</td><td>{html.escape(r.get("look", "-"))}</td><td>{html.escape(status)}</td><td>${r.get("cost", 0):.3f}</td>'
                    f'<td>{"<img src=%s/run.gif>" % html.escape(n) if "look" in r else ""}</td><td>{"<a href=%s/preview.png>all poses</a>" % html.escape(n) if "look" in r else ""}</td></tr>')
    done = [r for r in reports if 'look' in r]
    passed = sum(1 for r in done if r.get('passed'))
    costs = [r.get('cost', 0) for r in done]
    page = f"""<!doctype html><meta charset=utf-8><title>My Pet test</title>
<style>body{{font:15px system-ui;margin:24px}}td,th{{padding:6px 10px;border-bottom:1px solid #ddd;text-align:left}}img{{height:90px;image-rendering:auto}}</style>
<h1>My Pet test</h1><p>{passed} of {len(done)} pets passed every check the first time. Average cost ${(sum(costs) / max(len(costs), 1)):.3f} per pet; total spent ${budget_total:.2f}.</p>
<table><tr><th>Photo</th><th>Matched look</th><th>Result</th><th>Cost</th><th>Run</th><th></th></tr>{''.join(rows)}</table>"""
    p = OUT / 'summary.html'
    p.write_text(page)
    return p


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('looks')
    gp = sub.add_parser('grid'); gp.add_argument('--look', required=True); gp.add_argument('--layout', default='one', choices=G.LAYOUTS)
    dp = sub.add_parser('dry-run'); dp.add_argument('--look', required=True); dp.add_argument('--fake'); dp.add_argument('--seed', type=int, default=1)
    mp = sub.add_parser('match'); mp.add_argument('--photo', required=True, type=Path)
    pp = sub.add_parser('paint'); pp.add_argument('--photo', required=True, type=Path)
    bp = sub.add_parser('batch'); bp.add_argument('--photos', required=True, type=Path)
    for p in (dp, pp, bp):
        p.add_argument('--layout', default='one', choices=G.LAYOUTS)
        p.add_argument('--steady', type=float, default=0.5, help='0-1: how hard to pull frame colors toward the reference frame')
        p.add_argument('--name')
    for p in (pp, bp):
        p.add_argument('--look', help='skip step 1 and use this look')
        p.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    for p in (mp, pp, bp):
        p.add_argument('--budget', type=float, default=40.0, help='stop before total spend could pass this many dollars')
    args = ap.parse_args(argv)

    if args.cmd == 'looks':
        for lk in rig.looks():
            print(f'{lk["id"]:40} {lk["label"]}')
    elif args.cmd == 'grid':
        full, body, det = _cells_for(rig.look_by_id(args.look))
        dest = OUT / f'grid-{args.look.replace("/", "_")}'
        dest.mkdir(parents=True, exist_ok=True)
        for k, g in enumerate(G.plan(args.layout)):
            Image.fromarray(np.clip(G.build(body, g) * 255 + 0.5, 0, 255).astype(np.uint8)).save(dest / f'grid{k + 1}.png')
            print(f'grid{k + 1}.png  {g["size"][0]}x{g["size"][1]}, {len(g["cells"])} cells')
    elif args.cmd == 'dry-run':
        dry_run(args)
    else:
        import openai_api as O
        budget = O.Budget(OUT / 'spend.json', args.budget)
        if args.cmd == 'match':
            print(json.dumps(match(_load_photo(args.photo), budget, f'{args.photo.stem}: match'), indent=1))
        elif args.cmd == 'paint':
            paint_one(args.photo, args, budget)
        else:
            photos = sorted(p for p in args.photos.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.heic'))
            reports = []
            for ph in photos:
                args.name = ph.stem
                try:
                    reports.append(paint_one(ph, args, budget))
                except O.OpenAIError as e:
                    print(f'{ph.name}: {e}')
                    reports.append({'name': ph.stem, 'stopped': str(e)})
                except SystemExit as e:
                    print(e)
                    break
            print(f'Summary: {summary(reports, budget.total)}')
        print(f'Spent so far: ${budget.total:.2f} of ${args.budget:.2f}')


if __name__ == '__main__':
    sys.path.insert(0, str(HERE))
    main()
