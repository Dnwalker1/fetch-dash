"""The two OpenAI calls, with a spend log and a hard budget.

Same models and settings as the game's portraits (wix-backend/backend/
fetchDashOpenAI.js): the picture from /v1/images/edits with the model pinned,
the photo reading from /v1/responses with store false. Needs OPENAI_API_KEY
in the environment (or a proxy that adds it). Nothing that identifies a player is sent.
"""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

IMAGE_MODEL = 'gpt-image-2.5-sunburst-2026-09-08'
CHECK_MODEL = 'gpt-6-luna'
API = 'https://api.openai.com/v1'

# Dollars per 1M tokens. The image rates are from OpenAI's pricing page as
# Elon's plan read it on 27 Nov 2026. The check model's rates were not looked
# up: these are set high on purpose, so the budget errs on the safe side.
# Real use is in each answer's "usage" and is what gets logged.
RATES = {
    IMAGE_MODEL: {'text_in': 5.0, 'image_in': 8.0, 'out': 30.0},
    CHECK_MODEL: {'text_in': 5.0, 'image_in': 5.0, 'out': 30.0},
}
# What one call can cost at most, for the budget check before it is made.
WORST = {'image': 1.50, 'check': 0.10}


class Budget:
    """A running total in spend.json; refuses any call that could pass the limit."""

    def __init__(self, path: Path, limit: float):
        self.path, self.limit = path, limit
        self.log = json.loads(path.read_text()) if path.exists() else {'total': 0.0, 'calls': []}

    @property
    def total(self) -> float:
        return self.log['total']

    def check(self, kind: str) -> None:
        if self.total + WORST[kind] > self.limit:
            raise SystemExit(f'Stopped: ${self.total:.2f} spent of the ${self.limit:.2f} budget, and the next call could cost up to ${WORST[kind]:.2f}.')

    def add(self, kind: str, model: str, usage: dict, note: str) -> float:
        cost = cost_of(model, usage)
        self.log['total'] = round(self.total + cost, 4)
        self.log['calls'].append({'when': time.strftime('%Y-%m-%d %H:%M:%S'), 'kind': kind, 'model': model, 'usage': usage, 'cost': round(cost, 4), 'note': note})
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.log, indent=1))
        return cost


def cost_of(model: str, usage: dict) -> float:
    r = RATES[model]
    det = usage.get('input_tokens_details') or {}
    img_in = det.get('image_tokens', 0) or 0
    txt_in = det.get('text_tokens', (usage.get('input_tokens', 0) or 0) - img_in) or 0
    out = usage.get('output_tokens', 0) or 0
    return (txt_in * r['text_in'] + img_in * r['image_in'] + out * r['out']) / 1e6


def _headers(ctype: str) -> dict:
    """The key comes from OPENAI_API_KEY, or, with none set, from a network proxy
    that adds it to requests for api.openai.com (a cloud environment's network secret)."""
    k = os.environ.get('OPENAI_API_KEY', '').strip()
    h = {'Content-Type': ctype}
    if k:
        h['Authorization'] = f'Bearer {k}'
    return h


def _post(path: str, body: bytes, ctype: str, timeout: int = 600) -> dict:
    req = urllib.request.Request(f'{API}{path}', data=body, method='POST', headers=_headers(ctype))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get('error', {}).get('message', '')
        except Exception:
            msg = ''
        if e.code == 401:
            msg += ' (no working key: set OPENAI_API_KEY, or add the key as a network secret for api.openai.com)'
        raise OpenAIError(e.code, msg) from None


class OpenAIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f'OpenAI {status}: {message}')
        self.status, self.message = status, message


def _text_of(json_: dict) -> str | None:
    for item in json_.get('output') or []:
        if item.get('type') != 'message':
            continue
        for c in item.get('content') or []:
            if c.get('type') == 'output_text':
                return c.get('text')
    return json_.get('output_text')


def read_photo(photo_jpeg: bytes, prompt: str, budget: Budget, note: str) -> dict:
    """Step 1: the check model reads the photo and answers with JSON."""
    budget.check('check')
    body = {
        'model': CHECK_MODEL,
        'input': [{'role': 'user', 'content': [
            {'type': 'input_text', 'text': 'Answer with one JSON object only.'},
            {'type': 'input_text', 'text': prompt},
            {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + base64.b64encode(photo_jpeg).decode()},
        ]}],
        'text': {'format': {'type': 'json_object'}},
        'store': False,
    }
    j = _post('/responses', json.dumps(body).encode(), 'application/json', timeout=120)
    budget.add('check', CHECK_MODEL, j.get('usage') or {}, note)
    text = _text_of(j)
    if not text:
        raise OpenAIError(502, 'no answer from the check model')
    return json.loads(text)


def repaint(grid_png: bytes, photo_jpeg: bytes, prompt: str, size: str, quality: str, budget: Budget, note: str, background: str | None = None, extra_png: bytes | None = None) -> tuple[bytes, dict]:
    """Step 2: the image model repaints the grid (image 1) from the photo (image 2), with an
    optional third picture for reference. Returns (PNG bytes, usage)."""
    budget.check('image')
    boundary = '----mypet' + uuid.uuid4().hex
    parts: list[bytes] = []

    def field(name: str, value: str) -> None:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())

    def file(name: str, fname: str, ctype: str, data: bytes) -> None:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode())
        parts.append(data)
        parts.append(b'\r\n')

    field('model', IMAGE_MODEL)
    n_img = 3 if extra_png else 2
    field('prompt', f'The {n_img} attached images are numbered in the order they are attached.\n\n' + prompt)
    field('size', size)
    field('quality', quality)
    field('output_format', 'png')
    if background:
        field('background', background)
    field('n', '1')
    file('image[]', 'image1.png', 'image/png', grid_png)
    file('image[]', 'image2.jpg', 'image/jpeg', photo_jpeg)
    if extra_png:
        file('image[]', 'image3.png', 'image/png', extra_png)
    parts.append(f'--{boundary}--\r\n'.encode())
    j = _post('/images/edits', b''.join(parts), f'multipart/form-data; boundary={boundary}')
    usage = j.get('usage') or {}
    budget.add('image', IMAGE_MODEL, usage, note)
    b64 = ((j.get('data') or [{}])[0]).get('b64_json')
    if not b64:
        raise OpenAIError(200, 'no picture came back (it may have been declined for safety)')
    return base64.b64decode(b64), usage
