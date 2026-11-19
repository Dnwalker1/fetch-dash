import './cards.css';
import { PALETTES, type PetChoice, type Size, type Species } from '../art/pets';
import { LEVELS, levelById, type Progress } from '../levels';
import { HeroError, LIVE, generateLive, loadImage, messageFor, preparePhoto, reportDesign } from '../hero/api';
import { makeDemoPortrait, matchPalette } from '../hero/demo';
import { FREE_PORTRAITS, cap, countPortrait, displayName, loadHero, portraitsLeft, saveHero, type Hero } from '../hero/store';

/**
 * The cards shown over the game: make your hero (start), meet your hero
 * and pick a level (home), and the end-of-level card with the portrait
 * and the Design Your Pet shop button. They're plain web page elements on
 * top of the game canvas, so typing a name and choosing a photo work like
 * any web form on a phone.
 */

export interface CardHost {
  choice(): PetChoice;
  setChoice(c: PetChoice): void;
  /** Data URLs of the in-game run frames for a pet. */
  petFrames(c: PetChoice): string[];
  progress(): Progress;
  play(level: number): void;
}

export interface RunResult {
  level: number;
  won: boolean;
  reason: string;
  score: number;
  best: number;
  newBest: boolean;
  meters: number;
  treats: number;
  treatsTotal: number;
  goals: { finish: boolean; treats: boolean; clean: boolean };
  stars: number;
  bestStars: number;
}

function starRow(n: number): string {
  return [0, 1, 2].map((i) => `<i class="star${i < n ? ' on' : ''}">★</i>`).join('');
}

const SHOP = 'https://www.goodwookie.com/design-your-pet';
const shopUrl = (where: string) => `${SHOP}?utm_source=fetch-dash&utm_medium=game&utm_campaign=${where}`;

let root: HTMLDivElement | undefined;
let runnerTimer: number | undefined;
let keyHandler: ((e: KeyboardEvent) => void) | undefined;
let photoFile: Blob | undefined;
let photoUrl: string | undefined;
let lastError = '';

function ui(): HTMLDivElement {
  if (!root) {
    root = document.createElement('div');
    root.id = 'ui';
    document.body.appendChild(root);
  }
  return root;
}

export function cardsOpen(): boolean {
  return Boolean(root && root.childElementCount > 0);
}

/** True when a page event happened on a card, so the game should ignore it. */
export function isUiEvent(e: Event): boolean {
  return Boolean(root && e.target instanceof Node && root.contains(e.target));
}

export function closeCards(): void {
  if (runnerTimer) window.clearInterval(runnerTimer);
  runnerTimer = undefined;
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = undefined;
  if (root) {
    root.innerHTML = '';
    root.classList.remove('open');
  }
}

function show(html: string, onEnter?: () => void): HTMLDivElement {
  closeCards();
  const r = ui();
  r.innerHTML = html;
  r.classList.add('open');
  if (onEnter) {
    keyHandler = (e) => {
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === 'Enter' || (e.key === ' ' && !typing)) {
        e.preventDefault();
        onEnter();
      }
    };
    document.addEventListener('keydown', keyHandler);
  }
  return r;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Cycles the pet's run frames in an <img>, like a tiny flipbook. */
function startRunner(r: HTMLElement, host: CardHost): void {
  const imgs = Array.from(r.querySelectorAll<HTMLImageElement>('.runner img, img.flip'));
  if (!imgs.length) return;
  const frames = host.petFrames(host.choice());
  const order = [0, 1, 2, 1];
  let i = 0;
  imgs.forEach((img) => (img.src = frames[0]));
  if (runnerTimer) window.clearInterval(runnerTimer);
  runnerTimer = window.setInterval(() => {
    i = (i + 1) % order.length;
    imgs.forEach((img) => (img.src = frames[order[i]]));
  }, 85);
}

// ---------------------------------------------------------------------------
// Make your hero
// ---------------------------------------------------------------------------

export function openSetup(host: CardHost, opts: { canGoBack: boolean }): void {
  const hero = loadHero();
  const c = host.choice();
  const left = portraitsLeft();
  const hasPhoto = Boolean(photoFile);
  const name = hero?.name ?? '';

  const chips = (Object.keys(PALETTES) as string[])
    .map(
      (k) =>
        `<button class="chip coat${c.palette === k ? ' on' : ''}" data-palette="${k}" title="${PALETTES[k].label}" aria-label="${PALETTES[k].label}" style="--coat:#${PALETTES[k].fur.toString(16).padStart(6, '0')}"></button>`,
    )
    .join('');
  const seg = (field: string, value: string, items: [string, string][]) =>
    items.map(([v, label]) => `<button class="seg${value === v ? ' on' : ''}" data-${field}="${v}">${label}</button>`).join('');

  const photoBox = left > 0
    ? `<label class="drop${hasPhoto ? ' has' : ''}">
         <img src="${hasPhoto ? photoUrl : './hero-example.png'}" alt="" />
         ${hasPhoto ? '' : '<span class="tag">Example</span>'}
         <input type="file" accept="image/*" />
         <span class="pick">${hasPhoto ? 'Change photo' : '📷 Choose a photo'}</span>
       </label>
       <p class="small">${left} of ${FREE_PORTRAITS} free hero portraits left</p>`
    : `<div class="drop used">
         <img src="${hero?.portrait ?? './hero-example.png'}" alt="" />
       </div>
       <p class="small">You've used your ${FREE_PORTRAITS} free portraits. Make more in
         <a href="${shopUrl('portraits-used')}" target="_blank" rel="noopener">Design Your Pet</a>.</p>`;

  const r = show(
    `<div class="card setup">
      <div class="head">
        <h1>Make your pet the hero</h1>
        <p>Add a photo and Design Your Pet turns it into a hero portrait. Then you play as them!</p>
      </div>
      <div class="cols">
        <div class="col left">${photoBox}</div>
        <div class="col right">
          <label class="field">Name
            <input class="name" maxlength="14" placeholder="Your pet's name" value="${esc(name)}" autocomplete="off" />
          </label>
          <div class="field">Pet <div class="segs">${seg('species', c.species, [['dog', '🐶 Dog'], ['cat', '🐱 Cat']])}</div></div>
          <div class="field">Size <div class="segs">${seg('size', c.size, [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']])}</div></div>
          <div class="field">Coat <div class="chips">${chips}</div>
            ${hasPhoto ? '<span class="note">Matched to your photo. Tap to change.</span>' : ''}</div>
          <div class="runner"><span>In the game</span><img alt="" /></div>
        </div>
      </div>
      ${lastError ? `<p class="error">${esc(lastError)}</p>` : ''}
      <div class="actions">
        ${opts.canGoBack ? '<button class="btn ghost back">Back</button>' : '<button class="btn ghost skip">Skip, just play</button>'}
        ${left > 0 && hasPhoto ? '<button class="btn primary go">✨ Make my hero</button>' : `<button class="btn primary save">${opts.canGoBack ? 'Save' : 'Play ▶'}</button>`}
      </div>
      <p class="fine">Use a photo of just your pet${LIVE ? '' : '. This preview makes a stand-in portrait on your device; the real one comes from Design Your Pet'}.</p>
    </div>`,
  );
  lastError = '';
  startRunner(r, host);

  const nameInput = r.querySelector<HTMLInputElement>('.name')!;
  const keepName = () => {
    const h = loadHero();
    saveHero({ ...(h ?? {}), name: nameInput.value.trim() });
  };

  r.querySelectorAll<HTMLButtonElement>('[data-species]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      host.setChoice({ ...host.choice(), species: b.dataset.species as Species });
      openSetup(host, opts);
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      host.setChoice({ ...host.choice(), size: b.dataset.size as Size });
      openSetup(host, opts);
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      host.setChoice({ ...host.choice(), palette: b.dataset.palette! });
      openSetup(host, opts);
    }),
  );
  r.querySelector<HTMLInputElement>('input[type=file]')?.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    keepName();
    photoFile = f;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(f);
    try {
      const img = await loadImage(photoUrl);
      host.setChoice({ ...host.choice(), palette: matchPalette(img) });
    } catch {
      lastError = messageFor('bad_photo');
      photoFile = undefined;
    }
    openSetup(host, opts);
  });

  const finish = () => {
    keepName();
    const h = loadHero();
    if (!h?.name) saveHero({ ...(h ?? {}), name: '' });
    openHome(host);
  };
  r.querySelector('.save')?.addEventListener('click', finish);
  r.querySelector('.back')?.addEventListener('click', finish);
  r.querySelector('.skip')?.addEventListener('click', () => {
    keepName();
    host.play(host.progress().current);
  });
  r.querySelector('.go')?.addEventListener('click', () => {
    keepName();
    void makeHero(host, opts);
  });
  // The portrait letters the name, so it needs one before it can be made
  const go = r.querySelector<HTMLButtonElement>('.go');
  const nameNeeded = () => {
    if (!go) return;
    const empty = !nameInput.value.trim();
    go.disabled = empty;
    go.textContent = empty ? 'Type a name first' : '✨ Make my hero';
  };
  nameInput.addEventListener('input', nameNeeded);
  nameNeeded();
  if (!opts.canGoBack && !name) nameInput.focus({ preventScroll: true });
}

async function makeHero(host: CardHost, opts: { canGoBack: boolean }): Promise<void> {
  if (!photoFile || !photoUrl) return;
  const name = loadHero()?.name ?? '';
  const shown = displayName(loadHero(), host.choice().species);
  const r = show(
    `<div class="card making">
      <div class="orb"><img src="${photoUrl}" alt="" /><i></i></div>
      <h1>Making ${esc(shown)} a hero…</h1>
      <p class="step">Getting ready…</p>
      <p class="small">This usually takes about 30 seconds.</p>
    </div>`,
  );
  const step = r.querySelector('.step')!;
  const setStep = (s: string) => (step.textContent = s);
  try {
    let hero: Hero;
    if (LIVE) {
      const photo = await preparePhoto(photoFile);
      const res = await generateLive(photo, name || shown, setStep);
      hero = { name, portrait: res.url, source: 'live', designId: res.designId };
    } else {
      const img = await loadImage(photoUrl);
      for (const s of ['Finding the hero in your photo…', 'Adding the cape…', 'Painting the city lights…', 'Lettering the name…']) {
        setStep(s);
        await new Promise((res) => setTimeout(res, 650));
      }
      hero = { name, portrait: await makeDemoPortrait(img, name || shown), source: 'demo' };
    }
    countPortrait();
    saveHero(hero);
    photoFile = undefined;
    openHome(host, { reveal: true });
  } catch (err) {
    lastError = err instanceof HeroError ? err.message : messageFor('failed');
    openSetup(host, opts);
  }
}

// ---------------------------------------------------------------------------
// Meet your hero + pick a level
// ---------------------------------------------------------------------------

function portraitBlock(host: CardHost, hero: Hero | null, ribbon?: string): string {
  if (hero?.portrait) {
    return `<div class="portrait">
      <img src="${esc(hero.portrait)}" alt="" />
      ${ribbon ? `<div class="ribbon">${ribbon}</div>` : ''}
      ${hero.source === 'demo' ? '<span class="tag">Preview art</span>' : ''}
    </div>`;
  }
  // No portrait yet: show the in-game pet big on a sunburst instead
  return `<div class="portrait empty">
      <div class="burst"></div>
      <div class="runner big"><img alt="" /></div>
      <div class="plate">${esc(displayName(hero, host.choice().species).toUpperCase())}</div>
      ${ribbon ? `<div class="ribbon">${ribbon}</div>` : ''}
    </div>`;
}

/** Where each level sits on the trail map, in a 1000 x 260 box. */
function mapPoints(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    x: 70 + (i * 860) / Math.max(1, n - 1),
    y: 128 + 74 * Math.sin(i * 0.95),
  }));
}

/** A smooth trail through the points (Catmull-Rom turned into curves). */
function trailPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** The small hero picture in the corner of the map card. */
function heroMedal(hero: Hero | null): string {
  if (hero?.portrait) return `<button class="medal" title="See the full portrait"><img src="${esc(hero.portrait)}" alt="Hero portrait" /></button>`;
  return `<div class="medal empty"><img class="flip" alt="" /></div>`;
}

export function openHome(host: CardHost, opts: { reveal?: boolean } = {}): void {
  const hero = loadHero();
  const p = host.progress();
  const name = displayName(hero, host.choice().species);
  const pts = mapPoints(LEVELS.length);
  // The trail runs in from the left edge and on to the ball past the last stop
  const lastPt = pts[pts.length - 1];
  const full = [{ x: 0, y: pts[0].y + 40 }, ...pts, { x: 985, y: lastPt.y - 30 }];
  const walked = full.slice(0, Math.min(full.length, p.unlocked + 1));
  // Each trail gets a soft patch of its own ground color on the map
  const patches = LEVELS.map((l, i) => {
    const c = l.theme.grass;
    const rgba = `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, 0.55)`;
    return `radial-gradient(ellipse 9% 38% at ${pts[i].x / 10}% ${pts[i].y / 2.6}%, ${rgba}, transparent)`;
  }).join(', ');
  const stops = LEVELS.map((l, i) => {
    const locked = l.id > p.unlocked;
    const done = p.done.includes(l.id);
    const { x, y } = pts[i];
    const above = y > 128;
    return `<button class="stop${locked ? ' locked' : ''}${done ? ' done' : ''}${l.id === p.current ? ' on' : ''}" data-level="${l.id}"
        style="left:${x / 10}%; top:${y / 2.6}%; --ring:${hex(l.theme.grassDark)}" ${locked ? 'disabled' : ''} title="${esc(l.name)}" aria-label="Level ${l.id}: ${esc(l.name)}">
        <b>${locked ? '🔒' : l.id}</b>
        ${done ? `<em class="mini">${starRow(p.stars[l.id] ?? 0)}</em>` : ''}
      </button>
      <span class="mark" style="left:${x / 10}%; top:${(above ? y - 50 : y + 52) / 2.6}%">${l.icon}</span>`;
  }).join('');

  const r = show(
    `<div class="card home mapcard${opts.reveal ? ' reveal' : ''}">
      <div class="maphead">
        ${heroMedal(hero)}
        <div class="who">
          <h1>${opts.reveal ? `Meet ${esc(name)}!` : esc(cap(name))}</h1>
          <p class="lead">${opts.reveal ? 'Your hero is ready. Pick a trail on the map.' : 'Pick a trail on the map.'}</p>
        </div>
        <div class="headbtns">
          <button class="btn ghost edit">${hero?.portrait ? 'Edit hero' : '✨ Make a hero portrait'}</button>
          <a class="shoplink" href="${shopUrl('home')}" target="_blank" rel="noopener">Put ${esc(name)} on a shirt →</a>
        </div>
      </div>
      <div class="map" style="background: ${patches}, var(--parchment)">
        <span class="maptitle">Fetch Dash Trail Map</span>
        <svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">
          <path class="road" d="${trailPath(full)}" />
          <path class="walked" d="${trailPath(walked)}" />
          <path class="dash" d="${trailPath(full)}" />
        </svg>
        ${stops}
        <span class="ball" style="left:98.5%; top:${(lastPt.y - 30) / 2.6}%">🎾</span>
        <span class="compass">🧭</span>
        <div class="mappet"><img class="flip" alt="" /></div>
      </div>
      <div class="mapfoot">
        <div class="info"></div>
        <button class="btn primary play"></button>
      </div>
    </div>`,
    () => host.play(host.progress().current),
  );

  // Show the picked level's name, stars and best score, and stand the pet on its stop
  const pick = (id: number) => {
    const prog = host.progress();
    prog.current = id;
    const l = levelById(id);
    const i = LEVELS.indexOf(l);
    r.querySelectorAll('.stop').forEach((b) => b.classList.toggle('on', Number((b as HTMLElement).dataset.level) === id));
    const pet = r.querySelector<HTMLElement>('.mappet');
    if (pet) {
      pet.style.left = `${pts[i].x / 10}%`;
      pet.style.top = `${pts[i].y / 2.6}%`;
    }
    const best = prog.best[id];
    const info = r.querySelector('.info');
    if (info) {
      info.innerHTML = `<b>Level ${id} · ${esc(l.name)}</b>
        <span class="stars">${starRow(prog.stars[id] ?? 0)}</span>
        <small>${esc(l.tagline)} · ${l.goalMeters} m${best ? ` · Best ${best}` : ''}</small>`;
    }
    const play = r.querySelector('.play');
    if (play) play.textContent = `Play Level ${id} ▶`;
  };
  pick(p.current);
  startRunner(r, host);
  r.querySelectorAll<HTMLButtonElement>('.stop').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.level))));
  r.querySelector('.play')?.addEventListener('click', () => host.play(host.progress().current));
  r.querySelector('.edit')?.addEventListener('click', () => openSetup(host, { canGoBack: true }));
  // Tap the small hero picture to see the whole portrait; tap again to close it
  const medal = r.querySelector<HTMLButtonElement>('button.medal');
  medal?.addEventListener('click', () => {
    const card = r.querySelector('.mapcard');
    if (!card || !hero?.portrait) return;
    const big = document.createElement('button');
    big.className = 'bigportrait';
    big.innerHTML = `<img src="${esc(hero.portrait)}" alt="Hero portrait" /><span>Tap to close</span>`;
    big.addEventListener('click', () => big.remove());
    card.appendChild(big);
  });
}

export function openEnd(host: CardHost, res: RunResult): void {
  const hero = loadHero();
  const level = levelById(res.level);
  const next = LEVELS.find((l) => l.id === res.level + 1);
  const name = displayName(hero, host.choice().species);
  const ribbon = res.won ? `Level ${level.id} complete!` : `${Math.min(res.meters, level.goalMeters)} of ${level.goalMeters} m`;
  const title = res.won
    ? `${esc(cap(name))} caught the ball!`
    : esc(res.reason.replace('!', '')) + '!';
  const primary = res.won && next ? `Level ${next.id}: ${next.name} ▶` : res.won ? 'Play again ▶' : 'Run again ▶';
  const primaryLevel = res.won && next ? next.id : res.level;

  const r = show(
    `<div class="card end${res.won ? ' won' : ''}">
      <div class="cols">
        <div class="col left">${portraitBlock(host, hero, ribbon)}</div>
        <div class="col right">
          <h1>${title}</h1>
          <p class="lead">${level.name}${res.won && !next ? ' · You finished every level!' : ''}</p>
          <div class="goals">
            <div class="bigstars">${starRow(res.stars)}</div>
            <ul>
              <li class="${res.goals.finish ? 'ok' : ''}">Catch the ball</li>
              <li class="${res.goals.treats ? 'ok' : ''}">Grab most of the treats (${res.treats} of ${res.treatsTotal})</li>
              <li class="${res.goals.clean ? 'ok' : ''}">No bumps</li>
            </ul>
          </div>
          <div class="stats">
            <div><b>${res.score}</b><span>Score${res.newBest ? ' · new best!' : ''}</span></div>
            <div><b>${Math.min(res.meters, level.goalMeters)} m</b><span>Distance</span></div>
            <div><b>${res.treats}</b><span>Treats</span></div>
            <div><b>${res.best}</b><span>Best</span></div>
          </div>
          <div class="actions">
            <button class="btn ghost levels-btn">Levels</button>
            <button class="btn primary again">${primary}</button>
          </div>
          <div class="shop">
            <p>${hero?.portrait ? `Love this portrait? Put ${esc(name)} on a shirt, sticker or poster.` : `Turn ${esc(name)} into art for a shirt, sticker or poster.`}</p>
            <a class="btn gold" href="${shopUrl(res.won ? 'end-won' : 'end')}" target="_blank" rel="noopener">Shop Design Your Pet →</a>
            ${hero?.portrait ? '<button class="btn link savepic">⬇ Save picture</button>' : '<button class="btn link make">✨ Make a hero portrait</button>'}
            ${hero?.source === 'live' && hero.designId ? '<button class="btn link report">Report picture</button>' : ''}
          </div>
        </div>
      </div>
    </div>`,
    () => host.play(primaryLevel),
  );
  startRunner(r, host);
  r.querySelector('.again')?.addEventListener('click', () => host.play(primaryLevel));
  r.querySelector('.levels-btn')?.addEventListener('click', () => {
    host.progress().current = primaryLevel;
    openHome(host);
  });
  r.querySelector('.make')?.addEventListener('click', () => openSetup(host, { canGoBack: true }));
  r.querySelector('.savepic')?.addEventListener('click', () => void savePicture(hero!, name, level.name, res));
  r.querySelector('.report')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    await reportDesign(hero!.designId!, 'other').catch(() => undefined);
    b.textContent = 'Reported. Thank you.';
  });
}

/** Portrait plus a strip with the result, saved as a picture to share. */
async function savePicture(hero: Hero, name: string, levelName: string, res: RunResult): Promise<void> {
  try {
    const img = await loadImage(hero.portrait!);
    const S = 960;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S + 150;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, S, S);
    g.fillStyle = '#16202A';
    g.fillRect(0, S, S, 150);
    g.fillStyle = '#C79A3E';
    g.fillRect(0, S, S, 6);
    g.fillStyle = '#EFE3C6';
    g.textAlign = 'center';
    g.font = 'bold 44px Arial, sans-serif';
    const who = cap(name);
    g.fillText(res.won ? `${who} finished ${levelName}!` : `${who} ran ${res.meters} m on ${levelName}`, S / 2, S + 66);
    g.font = '28px Arial, sans-serif';
    g.fillStyle = '#D9C8A2';
    g.fillText(`Score ${res.score}  ·  Fetch Dash by Goodwookie`, S / 2, S + 116);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/jpeg', 0.9);
    a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'hero'}-fetch-dash.jpg`;
    a.click();
  } catch {
    // The picture can't be drawn here (another site's image); open it instead
    window.open(hero.portrait, '_blank', 'noopener');
  }
}
