import './cards.css';
import { PALETTES, type PetChoice, type Size, type Species } from '../art/pets';
import { sheetFor, sheetsFor } from '../art/sheets';
import { cardArtUrl } from '../art/petLook';
import { BANDANAS, breedById, shapeOption, type BreedId, type DogChoice } from '../art/breeds';
import { BONUS } from '../config';
import { setTutorialDone, tutorialDone } from '../tutorial';
import { BONUS_AFTER, LEVELS, levelById, playStyle, type PlayStyle, type Progress } from '../levels';
import { HERO_STEPS, HeroError, LIVE, SERVER_PORTRAIT_DAYS, fetchAllowance, gameCode, generateLive, isOnDevice, keepOnDevice, loadImage, messageFor, preparePhoto, reportDesign } from '../hero/api';
import { makeDemoPortrait, matchPalette } from '../hero/demo';
import { ageLine, loadAgeBand, portraitsAllowed, saveAgeBand } from '../hero/age';
import { openAgeGate } from './ageGate';
import { CAT_PATTERNS, bodiesFor, findBody, type BodySize } from './bodies';
import { SLOTH, paintedWithSloth } from '../art/rider';
import {
  MAX_PETS,
  PORTRAITS_PER_PET,
  TOTAL_PORTRAITS,
  allowanceFor,
  cap,
  countPortrait,
  displayName,
  loadHero,
  markPetUsedUp,
  nameAck,
  petCounts,
  petKey,
  rememberPet,
  saveHero,
  savedPet,
  setNameAck,
  setServerPets,
  setSlothWanted,
  slothWanted,
  type Hero,
  type LimitReason,
} from '../hero/store';
import { adBreak, addPrivacyButton } from '../ads';

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
  /** Starts the Backyard Toss bonus round that follows this level. */
  playBonus?(after: number): void;
}

export interface BonusResult {
  /** the level the bonus round follows, if it was opened from one */
  after?: number;
  name: string;
  species: Species;
  returned: number;
  airCatches: number;
  golden: number;
  streaks: number;
  total: number;
  /** the treat jar after this round */
  jar: number;
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
/** The Design Your Pet app in the stores. */
const DYP_PLAY = 'https://play.google.com/store/apps/details?id=com.goodwookie.designyourpet&referrer=utm_source%3Dfetch-dash%26utm_medium%3Dgame';
const DYP_APP_STORE = 'https://apps.apple.com/us/app/design-your-pet-by-goodwookie/id6828224743';

let root: HTMLDivElement | undefined;
let runnerTimer: number | undefined;
let keyHandler: ((e: KeyboardEvent) => void) | undefined;
let photoFile: Blob | undefined;
let photoUrl: string | undefined;
let lastError = '';
let serverCountChecked = false;

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

/** Told when the home screen (or a card over it) opens and closes, so the game can hide its score and buttons behind it. */
let homeListener: ((open: boolean) => void) | undefined;
let homeShowing = false;
export function onHomeScreen(cb: ((open: boolean) => void) | undefined): void {
  homeListener = cb;
}
function setHomeShowing(on: boolean): void {
  if (on === homeShowing) return;
  homeShowing = on;
  homeListener?.(on);
}

export function closeCards(): void {
  setHomeShowing(false);
  if (runnerTimer) window.clearInterval(runnerTimer);
  runnerTimer = undefined;
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = undefined;
  if (root) {
    root.innerHTML = '';
    root.classList.remove('open', 'title', 'home');
  }
}

/**
 * Keeps the field being typed in on screen. On a phone held sideways the
 * keyboard leaves only a strip of the screen (the app shrinks the game to
 * that strip), so the card scrolls the field into the middle of what's left.
 */
let focusKeeper = false;
function keepFocusInView(): void {
  if (focusKeeper) return;
  focusKeeper = true;
  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'file' && el.closest('#ui') ? el : null;
  };
  const reveal = () => requestAnimationFrame(() => typing()?.scrollIntoView({ block: 'center', inline: 'nearest' }));
  window.addEventListener('resize', reveal);
  window.visualViewport?.addEventListener('resize', reveal);
  // Again once the keyboard has had time to open
  document.addEventListener('focusin', () => {
    if (typing()) window.setTimeout(reveal, 350);
  });
}

function show(html: string, onEnter?: () => void): HTMLDivElement {
  closeCards();
  keepFocusInView();
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

/** Restarts the open card's flipbook, e.g. once the pet's painted sprites have loaded. */
export function refreshPetFrames(host: CardHost): void {
  const root = document.getElementById('ui');
  if (root && cardsOpen()) startRunner(root, host);
}

/** Cycles the pet's run frames in an <img>, like a tiny flipbook. */
function startRunner(r: HTMLElement, host: CardHost): void {
  // a painted card picture that doesn't load gives way to the running pet
  r.querySelectorAll<HTMLImageElement>('img.card-art').forEach((img) => {
    img.onerror = () => {
      img.onerror = null;
      const t = document.createElement('template');
      t.innerHTML = img.dataset.fallback ?? '';
      (img.closest('.card-pic') ?? img).replaceWith(t.content);
      startRunner(r, host);
    };
  });
  const imgs = Array.from(r.querySelectorAll<HTMLImageElement>('.runner img, img.flip'));
  if (!imgs.length) return;
  const frames = host.petFrames(host.choice());
  let i = 0;
  imgs.forEach((img) => (img.src = frames[0]));
  if (runnerTimer) window.clearInterval(runnerTimer);
  runnerTimer = window.setInterval(() => {
    i = (i + 1) % frames.length;
    imgs.forEach((img) => (img.src = frames[i]));
  }, 60);
}

// ---------------------------------------------------------------------------
// Make your hero
// ---------------------------------------------------------------------------

/** The pet maker's steps, in order. */
const STEPS = ['Pet', 'Body', 'Coat', 'Extras', 'Photo'] as const;
const STEP_HINT = [
  'Two quick choices, then the fun part.',
  'Pick the shape closest to your pet. For a mix, go with its body type.',
  'Colors and shapes for this body.',
  'All optional. More things to wear unlock as you play.',
  'Optional. You can add a photo any time from My Pet.',
];
/** The step the pet maker is on (kept while the card redraws after each tap). */
let setupStep = 0;
/** The size filter on the Body step. */
let bodyFilter: 'all' | BodySize = 'all';

/**
 * The pet maker: five short steps (Pet, Body, Coat, Extras, Photo) with the
 * pet on the left, changing with every tap. Every tap saves the choice and
 * redraws the card on the same step.
 */
export function openSetup(host: CardHost, opts: { canGoBack: boolean; step?: number }): void {
  if (opts.step !== undefined) setupStep = Math.max(0, Math.min(STEPS.length - 1, opts.step));
  const step = setupStep;
  // Once per visit, take the server's count of free portraits (it's the one
  // that counts) and redraw the card if it differs from the device's.
  if (LIVE && !serverCountChecked) {
    serverCountChecked = true;
    void fetchAllowance().then((a) => {
      // An older server only counts one total; its refusals still show the pop-up.
      if (!a?.pets) return;
      const before = JSON.stringify(petCounts());
      setServerPets(a.pets, a.portraitsUsed);
      if (JSON.stringify(petCounts()) === before) return;
      if (!document.querySelector('#ui .card.setup') || document.querySelector('#ui .limitpop')) return;
      // Keep a name typed while the count was on its way.
      const typed = document.querySelector<HTMLInputElement>('#ui .card.setup .name');
      if (typed) saveHero({ ...(loadHero() ?? {}), name: typed.value.trim() });
      openSetup(host, { canGoBack: opts.canGoBack });
    });
  }
  const hero = loadHero();
  const c = host.choice();
  const hasPhoto = Boolean(photoFile);
  const name = hero?.name ?? '';
  const allow = allowanceFor(name);
  const pets = petCounts();
  // The live portraits are for players 18 and over for now (hero/age.ts).
  // Asked once, when the player first goes to choose a photo.
  const band = LIVE ? loadAgeBand() : '18+';
  const ageOff = band !== undefined && !portraitsAllowed(band);
  const canPortrait = !ageOff && allow.totalLeft > 0;

  const seg = (field: string, value: string, items: [string, string][]) =>
    items.map(([v, label]) => `<button class="seg${value === v ? ' on' : ''}" data-${field}="${v}">${label}</button>`).join('');
  const looks = sheetsFor(c.species);
  const look = sheetFor(c);
  const dog = c.species === 'dog' ? c.dog : undefined;
  const breed = breedById(dog?.breed);
  const isChewy = paintedWithSloth(c);
  /** which entry of the body list this pet is */
  const bodyId = c.species === 'cat' ? 'shorthair' : (breed?.id ?? (look ? look.id : 'chewy'));
  const body = bodiesFor(c.species).find((b) => b.id === bodyId);

  // ---- the pet on the left ----
  const meta = [c.species === 'dog' ? 'Dog' : 'Cat', body?.label, breed && dog ? breed.coats[dog.coat]?.label : c.species === 'cat' ? PALETTES[c.palette]?.label : '', cap(c.size)]
    .filter(Boolean)
    .join(' · ');
  const stage = `<div class="stage">${petPicture(c)}${plate(displayName(hero, c.species))}<span class="meta">${esc(meta)}</span></div>`;

  // ---- each step's content ----
  let pane = '';
  if (step === 0) {
    // The pets that already have portraits, to switch between them
    const petRow = pets.length
      ? `<div class="field">Your pets <div class="segs pets">${pets
          .map((p) => {
            const left = Math.max(0, PORTRAITS_PER_PET - p.used);
            const on = petKey(p.name) === petKey(name);
            return `<button class="seg${on ? ' on' : ''}" data-pet="${esc(p.name)}">${esc(p.name)} <small>${left ? `${left} left` : 'all used'}</small></button>`;
          })
          .join('')}${allow.newPetsLeft > 0 && allow.totalLeft > 0 && !allow.isNew ? '<button class="seg add" data-pet="">+ New pet</button>' : ''}</div></div>`
      : '';
    pane = `<h2>Who's your hero?</h2>
      <label class="field">Name
        <input class="name" maxlength="18" placeholder="Your pet's name" value="${esc(name)}" autocomplete="off" enterkeyhint="done" />
      </label>
      ${petRow}
      <div class="species">
        <button class="sp${c.species === 'dog' ? ' on' : ''}" data-species="dog"><img src="art/pets/lab/card-yellow.webp" alt="" />Dog</button>
        <button class="sp${c.species === 'cat' ? ' on' : ''}" data-species="cat"><img src="art/pets/cat/card-ginger.webp" alt="" />Cat</button>
      </div>
      ${canPortrait ? `<div class="shortcut"><p><b>Have a photo of your pet?</b> Add it and Design Your Pet paints them as an Arcade Hero.</p><button class="btn navy" data-step="4">Add a photo</button></div>` : ''}`;
  } else if (step === 1) {
    const list = bodiesFor(c.species);
    const tiles = list
      .filter((b) => bodyFilter === 'all' || b.size === bodyFilter)
      .map((b) => {
        if (b.soon) return `<div class="body soon" data-body-id="${b.id}"><span class="soon-tag">Coming soon</span><div class="ph">🐾</div><b>${esc(b.label)}</b><small>${esc(b.covers)}</small></div>`;
        const pic = bodyCard(c, b.id);
        const on = b.id === bodyId;
        const attr = c.species === 'cat' ? '' : ` data-breed="${b.id}"`;
        return `<button class="body${on ? ' on' : ''}" data-body-id="${b.id}"${attr}>${pic ? `<img src="${pic}" alt="" />` : '<div class="ph">🐾</div>'}<b>${esc(b.label)}</b><small>${esc(b.covers)}</small></button>`;
      })
      .join('');
    pane = `<h2>Pick a body</h2>
      <input class="find" type="search" placeholder="${c.species === 'cat' ? 'Type a breed, like Maine Coon or Siamese' : 'Type a breed, like Schnauzer or Pit bull'}" autocomplete="off" enterkeyhint="search" />
      <p class="hit" aria-live="polite"></p>
      <div class="segs">${seg('filter', bodyFilter, [['all', 'All'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']])}</div>
      <div class="bodies">${tiles}</div>
      <div class="field">Size in the game <div class="segs">${seg('size', c.size, [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']])}</div></div>`;
  } else if (step === 2) {
    if (c.species === 'dog' && breed && dog) {
      const coats = Object.entries(breed.coats)
        .map(([k, v]) => {
          const pic = cardArtUrl({ ...c, dog: { ...dog, coat: k } });
          return `<button class="coattile${dog.coat === k ? ' on' : ''}" data-coat="${k}">${pic ? `<img src="${pic}" alt="" />` : ''}<span>${esc(v.label)}</span></button>`;
        })
        .join('');
      const shapes = (['ears', 'tail'] as const)
        .filter((g) => breed.variants[g])
        .map((g) => `<div class="field">${g === 'ears' ? 'Ears' : 'Tail'} <div class="segs">${seg(`shape-${g}`, shapeOption(dog, g)!, breed.variants[g]!.map((o): [string, string] => [o, cap(o)]))}</div></div>`)
        .join('');
      pane = `<h2>Coat and markings</h2>
        <div class="field">Coat <span class="coatname">${esc(breed.coats[dog.coat].label)}</span><div class="coats">${coats}</div></div>
        ${shapes}
        <div class="field">Markings <span class="soon-tag">Coming soon</span><div class="segs">${['White chest', 'White socks', 'Face blaze', 'Spots'].map((m) => `<button class="seg" disabled>${m}</button>`).join('')}</div></div>`;
    } else if (c.species === 'cat') {
      const coats = (Object.keys(PALETTES) as string[])
        .map((k) => `<button class="coattile${c.palette === k ? ' on' : ''}" data-palette="${k}"><img src="art/pets/cat/card-${k}.webp" alt="" /><span>${PALETTES[k].label}</span></button>`)
        .join('');
      pane = `<h2>Coat and pattern</h2>
        <div class="field">Coat <div class="coats">${coats}</div>${hasPhoto ? '<span class="note">Matched to your photo. Tap to change.</span>' : ''}</div>
        ${looks.length ? `<div class="field">Look <div class="segs">${seg('look', look?.id ?? 'drawn', [['drawn', 'Drawn'], ...looks.map((l): [string, string] => [l.id, `\u{1F3A8} ${esc(l.label)}`])])}</div></div>` : ''}
        <div class="field">Pattern <span class="soon-tag">Coming soon</span><div class="segs">${CAT_PATTERNS.map((m) => `<button class="seg" disabled>${m}</button>`).join('')}</div></div>`;
    } else {
      pane = `<h2>Coat</h2><p class="lead">Chewy is painted in his own colors. Pick another body to choose a coat, or go on to Extras.</p>`;
    }
  } else if (step === 3) {
    const hexOf = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const bandanas =
      breed && dog
        ? `<div class="field">Bandana <div class="chips"><button class="chip coat none${dog.bandana ? '' : ' on'}" data-bandana="" title="No bandana" aria-label="No bandana"></button>${Object.entries(BANDANAS)
            .map(([k, v]) => `<button class="chip coat${dog.bandana === k ? ' on' : ''}" data-bandana="${k}" title="${cap(k)}" aria-label="${cap(k)} bandana" style="--coat:${hexOf(v)}"></button>`)
            .join('')}</div></div>`
        : `<p class="note">Bandanas come to ${isChewy ? 'Chewy' : 'cats'} with Elon's next pictures.</p>`;
    const toggles =
      breed && dog
        ? [breed.features.tailtip ? `<button class="seg${dog.tailtip ? ' on' : ''}" data-feature="tailtip">White tail tip</button>` : '', breed.features.muzzle ? `<button class="seg${dog.muzzle ? ' on' : ''}" data-feature="muzzle">Gray muzzle</button>` : ''].join('')
        : '';
    pane = `<h2>Extras</h2>
      <label class="sloth"><input type="checkbox"${slothWanted() || isChewy ? ' checked' : ''}${isChewy ? ' disabled' : ''} />
        <img src="art/sloth/side.webp" alt="" />
        <span>Bring the sloth along <small>${isChewy ? 'Chewy always brings him.' : `He rides on ${c.species === 'cat' ? 'your cat' : 'your pup'}'s head, in the game and in the portrait.`}</small></span></label>
      ${bandanas}
      ${toggles ? `<div class="field">Details <div class="segs">${toggles}</div></div>` : ''}
      <p class="note">Hats, collars and more are coming to the Wardrobe on the home screen.</p>`;
  } else {
    // The example portrait is Chewy (with the sloth). For any other pet, the
    // photo box shows that pet instead, so it never looks like the wrong breed.
    const card = isChewy ? undefined : cardArtUrl(c);
    const flip = '<img class="flip pet" alt="" />';
    const example = isChewy
      ? `<img src="./hero-example.webp" alt="" /><span class="tag">Example</span>`
      : card
        ? `<img class="pet card-art" src="${card}" alt="" data-fallback="${esc(flip)}" />`
        : flip;
    const photoBox = ageOff
      ? `<div class="drop used"><img src="${hero?.portrait ?? './hero-example.webp'}" alt="" /></div>
         <p class="small">${ageLine(band!)}</p>`
      : allow.totalLeft > 0
        ? `<label class="drop${hasPhoto ? ' has' : ''}">
             ${hasPhoto ? `<img src="${photoUrl}" alt="" />` : example}
             <input type="file" accept="image/*" />
             <span class="pick">${hasPhoto ? 'Change photo' : '📷 Choose a photo'}</span>
           </label>`
        : `<div class="drop used"><img src="${hero?.portrait ?? './hero-example.webp'}" alt="" /></div>
           <p class="small">You've used all ${TOTAL_PORTRAITS} free hero portraits.</p>
           <button class="btn gold more">Keep designing in Design Your Pet</button>`;
    pane = `<h2>Hero portrait <span class="note">optional</span></h2>
      <div class="photostep">
        <div class="col">${photoBox}</div>
        <div class="col">
          <p class="lead">Add a photo and Design Your Pet paints ${esc(displayName(hero, c.species))} as an Arcade Hero, for the end cards and the shirt.</p>
          ${canPortrait ? `<p class="small allow">${allowanceLine(name)}</p>${nameAckBox(name)}` : ''}
          <p class="fine">Use a photo of just your pet${LIVE ? '' : '. This preview makes a stand-in portrait on your device; the real one comes from Design Your Pet'}.</p>
          ${LIVE ? `<p class="fine privacy">To have everything deleted from our server, email info@goodwookie.com with your game code <span class="code">${esc(gameCode())}</span>.</p>` : ''}
        </div>
      </div>`;
  }

  // ---- the card ----
  const steps = STEPS.map((l, i) => `<button class="${i < step ? 'done' : i === step ? 'now' : ''}" data-step="${i}"><i>${i < step ? '✓' : i + 1}</i>${l}</button>`).join('');
  const left = step === 0 ? (opts.canGoBack ? '<button class="btn ghost back">Back</button>' : '<button class="btn ghost skip">Skip, just play</button>') : `<button class="btn ghost" data-step="${step - 1}">‹ Back</button>`;
  const right =
    step < STEPS.length - 1
      ? `<button class="btn primary" data-step="${step + 1}">Next: ${STEPS[step + 1]} ›</button>`
      : canPortrait && hasPhoto
        ? '<button class="btn ghost save">Skip the portrait</button><button class="btn primary go">✨ Make my hero</button>'
        : `<button class="btn primary save">${opts.canGoBack ? 'Save ✓' : 'Play ▶'}</button>`;
  const r = show(
    `<div class="card setup maker">
      <div class="mk-head">
        ${opts.canGoBack ? '<button class="round back" aria-label="Save and go back">‹</button>' : ''}
        <h1>Make your hero</h1>
        <nav class="steps" aria-label="Steps">${steps}</nav>
      </div>
      <div class="mk-main">
        ${stage}
        <div class="pane">${pane}</div>
      </div>
      ${lastError ? `<p class="error">${esc(lastError)}</p>` : ''}
      <div class="mk-foot">${left}<span class="hint">${STEP_HINT[step]}</span>${right}</div>
    </div>`,
  );
  lastError = '';
  setHomeShowing(true); // the maker covers the trail, so the HUD and the pet on it step aside
  startRunner(r, host);
  seatSloths(r);

  const nameInput = r.querySelector<HTMLInputElement>('.name');
  const typedName = () => (nameInput ? nameInput.value.trim() : name);
  const keepName = () => {
    if (nameInput) keepHeroName(host, nameInput.value.trim());
  };
  const redraw = () => openSetup(host, { canGoBack: opts.canGoBack });

  // Steps: the tabs at the top and Back / Next at the bottom
  r.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      openSetup(host, { canGoBack: opts.canGoBack, step: Number(b.dataset.step) });
    }),
  );

  // Switch to one of the pets with portraits, or start a new one
  r.querySelectorAll<HTMLButtonElement>('[data-pet]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      const next = b.dataset.pet ?? '';
      keepHeroName(host, next);
      redraw();
      if (!next) document.querySelector<HTMLInputElement>('#ui .card.setup .name')?.focus({ preventScroll: true });
    }),
  );
  r.querySelector('.more')?.addEventListener('click', () => openLimitPopup('total', name));

  r.querySelectorAll<HTMLButtonElement>('[data-species]').forEach((b) =>
    b.addEventListener('click', () => {
      keepName();
      const sp = b.dataset.species as Species;
      if (sp !== host.choice().species) {
        bodyFilter = 'all';
        host.setChoice({ ...host.choice(), species: sp });
      }
      redraw();
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      host.setChoice({ ...host.choice(), size: b.dataset.size as Size });
      redraw();
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      bodyFilter = b.dataset.filter as typeof bodyFilter;
      redraw();
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.look;
      host.setChoice({ ...host.choice(), look: id === 'drawn' ? undefined : id });
      redraw();
    }),
  );

  // Body search: typing a breed lights up the body it uses
  const find = r.querySelector<HTMLInputElement>('.find');
  const hit = r.querySelector('.hit');
  find?.addEventListener('input', () => {
    const b = findBody(host.choice().species, find.value);
    r.querySelectorAll<HTMLElement>('[data-body-id]').forEach((el) => el.classList.toggle('match', el.dataset.bodyId === b?.id));
    if (hit) {
      const typed = esc(find.value.trim());
      hit.textContent = '';
      if (find.value.trim().length < 3) return;
      hit.innerHTML = !b
        ? 'No match yet. Pick the closest shape.'
        : b.soon
          ? `${typed} uses the <b>${esc(b.label)}</b> body. It's coming soon, so pick the closest one for now.`
          : `${typed} uses the <b>${esc(b.label)}</b> body. Tap it to choose it.`;
    }
    // a filter could hide the match
    if (b && bodyFilter !== 'all' && b.size !== bodyFilter) {
      bodyFilter = 'all';
      const keep = find.value;
      redraw();
      const again = document.querySelector<HTMLInputElement>('#ui .card.setup .find');
      if (again) {
        again.value = keep;
        again.focus({ preventScroll: true });
        again.dispatchEvent(new Event('input'));
      }
      return;
    }
    r.querySelector('.body.match')?.scrollIntoView({ block: 'nearest' });
  });
  find?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      find.blur();
    }
  });

  // Breed dogs: every change saves and redraws the card
  const setDog = (f: (d: DogChoice) => DogChoice | undefined, lookId?: string) => {
    const cur = host.choice();
    const next: PetChoice = { ...cur };
    const d = cur.dog ? f(cur.dog) : undefined;
    if (d) {
      next.dog = d;
      delete next.look;
    } else {
      delete next.dog;
      next.look = lookId;
    }
    host.setChoice(next);
    redraw();
  };
  r.querySelectorAll<HTMLButtonElement>('[data-breed]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.breed!;
      const br = breedById(id);
      const next: PetChoice = { ...host.choice(), species: 'dog' };
      if (br) {
        // keep the bandana when switching breeds
        next.dog = { breed: id as BreedId, coat: br.defaultCoat, ...(next.dog?.bandana ? { bandana: next.dog.bandana } : {}) };
        delete next.look;
      } else {
        delete next.dog;
        next.look = 'chewy';
      }
      host.setChoice(next);
      redraw();
    }),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-coat]').forEach((b) => b.addEventListener('click', () => setDog((d) => ({ ...d, coat: b.dataset.coat! }))));
  for (const g of ['ears', 'tail'] as const) {
    r.querySelectorAll<HTMLButtonElement>(`[data-shape-${g}]`).forEach((b) => b.addEventListener('click', () => setDog((d) => ({ ...d, [g]: b.getAttribute(`data-shape-${g}`)! }))));
  }
  r.querySelectorAll<HTMLButtonElement>('[data-bandana]').forEach((b) =>
    b.addEventListener('click', () =>
      setDog((d) => {
        const n = { ...d };
        if (b.dataset.bandana) n.bandana = b.dataset.bandana;
        else delete n.bandana;
        return n;
      }),
    ),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-feature]').forEach((b) =>
    b.addEventListener('click', () =>
      setDog((d) => {
        const k = b.dataset.feature as 'tailtip' | 'muzzle';
        const n = { ...d };
        if (n[k]) delete n[k];
        else n[k] = true;
        return n;
      }),
    ),
  );
  r.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach((b) =>
    b.addEventListener('click', () => {
      host.setChoice({ ...host.choice(), palette: b.dataset.palette! });
      redraw();
    }),
  );
  // No age answer yet: the age screen comes first, then the photo picker
  if (LIVE && band === undefined) {
    r.querySelector('label.drop')?.addEventListener('click', (e) => {
      e.preventDefault();
      openAgeGate((b) => {
        saveAgeBand(b);
        redraw();
        // Still inside the tap on Continue, so the picker is allowed to open
        if (portraitsAllowed(b)) document.querySelector<HTMLInputElement>('#ui .card.setup input[type=file]')?.click();
      });
    });
  }
  r.querySelector<HTMLInputElement>('input[type=file]')?.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
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
    redraw();
  });

  const finish = () => {
    keepName();
    const h = loadHero();
    if (!h?.name) saveHero({ ...(h ?? {}), name: '' });
    setupStep = 0;
    openHome(host);
  };
  r.querySelectorAll('.save, .back').forEach((el) => el.addEventListener('click', finish));
  r.querySelector('.skip')?.addEventListener('click', () => {
    keepName();
    setupStep = 0;
    host.play(host.progress().current);
  });
  r.querySelector<HTMLInputElement>('.sloth:not(.nameack) input')?.addEventListener('change', (e) => {
    setSlothWanted((e.target as HTMLInputElement).checked);
    host.setChoice(host.choice()); // the sloth hops on (or off) the pet in the game too
    redraw();
  });
  r.querySelector('.go')?.addEventListener('click', () => {
    // This pet's free portraits are used (or 3 pets have theirs): explain where to go next
    const blocked = allowanceFor(typedName()).blocked;
    if (blocked) return openLimitPopup(blocked, typedName());
    void makeHero(host, { canGoBack: opts.canGoBack });
  });
  // The portrait letters the name, so it needs one before it can be made
  const go = r.querySelector<HTMLButtonElement>('.go');
  const ackBox = r.querySelector<HTMLLabelElement>('.nameack');
  const ackInput = ackBox?.querySelector('input');
  const nameNeeded = () => {
    // Each name is its own pet, so the count follows the name as it's typed
    const k = petKey(typedName());
    r.querySelectorAll<HTMLButtonElement>('.pets [data-pet]').forEach((el) => el.classList.toggle('on', Boolean(el.dataset.pet) && petKey(el.dataset.pet!) === k));
    r.querySelectorAll('.card.setup .plate').forEach((p) => (p.textContent = (typedName() || displayName(null, host.choice().species)).toUpperCase()));
    // The personal-use box shows only for a name the server asked about
    const ack = nameAck(typedName());
    if (ackBox && ackInput) {
      ackBox.hidden = ack === undefined;
      ackInput.checked = ack === true;
    }
    if (!go) return;
    const empty = !typedName();
    const unticked = ack === false;
    go.disabled = empty || unticked;
    go.textContent = empty ? 'Add a name first (step 1)' : unticked ? 'Tick the box first' : '✨ Make my hero';
  };
  ackInput?.addEventListener('change', () => {
    setNameAck(typedName(), ackInput.checked);
    nameNeeded();
  });
  nameInput?.addEventListener('input', nameNeeded);
  // The keyboard's Go/Done key closes the keyboard, so the whole card shows again
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameInput.blur();
    }
  });
  nameNeeded();
  if (step === 0 && !opts.canGoBack && !name) nameInput?.focus({ preventScroll: true });
}

/** A body's picture for its tile: this pet's coat when it's the same body, else the body's first coat. */
function bodyCard(c: PetChoice, id: string): string | undefined {
  if (c.species === 'cat') return `art/pets/cat/card-${c.palette}.webp`;
  if (id === 'chewy') return cardArtUrl({ species: 'dog', size: c.size, palette: c.palette, look: 'chewy' });
  const b = breedById(id);
  if (!b) return undefined;
  const coat = c.dog?.breed === id ? c.dog.coat : b.defaultCoat;
  return cardArtUrl({ species: 'dog', size: c.size, palette: c.palette, dog: { breed: b.id, coat } });
}

/**
 * The pet standing, for the pet maker and the home screen: its painted card
 * picture with the sloth on its head when he's riding, or the running pet
 * when it has no card picture.
 */
function petPicture(c: PetChoice, cls = ''): string {
  const card = cardArtUrl(c);
  const flip = `<div class="petpic ${cls}"><img class="flip" alt="" /></div>`;
  if (!card) return flip;
  const sloth = slothWanted() && !paintedWithSloth(c) ? `<img class="rider" src="art/sloth/side.webp" alt="" data-species="${c.species}" />` : '';
  return `<div class="petpic ${cls}"><img class="card-art" src="${card}" alt="" data-fallback="${esc('<img class="flip" alt="" />')}" />${sloth}</div>`;
}

/**
 * Seats the sloth on the top of the pet's head in a card picture, the way
 * rider.ts does it in the game: the head is the highest point of the front
 * 40% of the body (pets face right).
 */
function seatSloths(r: HTMLElement): void {
  r.querySelectorAll<HTMLImageElement>('img.rider').forEach((sloth) => {
    const pet = sloth.parentElement?.querySelector<HTMLImageElement>('img.card-art');
    if (!pet) return;
    sloth.style.visibility = 'hidden';
    const seat = () => {
      const w = pet.naturalWidth;
      const h = pet.naturalHeight;
      if (!w || !h || !sloth.naturalWidth) return;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(pet, 0, 0);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        return;
      }
      let top = -1;
      let bottom = -1;
      let headX = 0;
      const solid = (x: number, y: number) => data[(y * w + x) * 4 + 3] > 128;
      for (let y = 0; y < h && top < 0; y++) {
        const xs: number[] = [];
        for (let x = Math.floor(w * 0.6); x < w; x++) if (solid(x, y)) xs.push(x);
        if (xs.length) {
          top = y;
          headX = xs.reduce((a, b) => a + b, 0) / xs.length;
        }
      }
      for (let y = h - 1; y >= 0 && bottom < 0; y--) {
        for (let x = 0; x < w; x++)
          if (solid(x, y)) {
            bottom = y;
            break;
          }
      }
      if (top < 0 || bottom <= top) return;
      const petH = bottom - top;
      const size = sloth.dataset.species === 'cat' ? SLOTH.size.cat : SLOTH.size.dog;
      const sh = petH * size;
      const sw = sh * (sloth.naturalWidth / sloth.naturalHeight);
      const y = top + petH * SLOTH.sink;
      sloth.style.width = `${(sw / w) * 100}%`;
      sloth.style.left = `${((headX - SLOTH.seat.side.x * sw) / w) * 100}%`;
      sloth.style.top = `${((y - SLOTH.seat.side.y * sh) / h) * 100}%`;
      sloth.style.visibility = '';
    };
    const both = () => {
      if (pet.complete && sloth.complete) seat();
    };
    pet.addEventListener('load', both);
    sloth.addEventListener('load', both);
    both();
  });
}

/** Shown once the server says the name also belongs to a brand or character. */
function nameAckBox(name: string): string {
  const ack = nameAck(name);
  return `<label class="sloth nameack"${ack === undefined ? ' hidden' : ''}><input type="checkbox"${ack ? ' checked' : ''} />
      <span>It's my pet's name <small>This name may also belong to a brand or character. My portrait is for personal use only.</small></span></label>`;
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
      <p class="small">This usually takes a minute or two. Keep the game open.</p>
    </div>`,
  );
  const step = r.querySelector('.step')!;
  const setStep = (s: string) => (step.textContent = s);
  try {
    let hero: Hero;
    if (LIVE) {
      const photo = await preparePhoto(photoFile);
      const res = await generateLive(photo, name || shown, setStep, { sloth: slothWanted(), nameAck: nameAck(name || shown) === true });
      setStep('Saving your hero…');
      // Kept on the device: the server's copy is deleted after SERVER_PORTRAIT_DAYS.
      hero = { name, portrait: await keepOnDevice(res.url), source: 'live', designId: res.designId };
      // The server's count already has this one in it
      if (res.allowance?.pets) setServerPets(res.allowance.pets, res.allowance.portraitsUsed);
      else countPortrait(name || shown);
    } else {
      const img = await loadImage(photoUrl);
      for (const s of HERO_STEPS) {
        setStep(s);
        await new Promise((res) => setTimeout(res, 650));
      }
      hero = { name, portrait: await makeDemoPortrait(img, name || shown), source: 'demo' };
      countPortrait(name || shown);
    }
    const saved = saveHero(hero);
    rememberPet(hero, host.choice());
    photoFile = undefined;
    setupStep = 0;
    // A live portrait that couldn't be kept on the phone is lost once the
    // server deletes its copy, so the player is told to save it now.
    openHome(host, { reveal: true, notSaved: hero.source === 'live' && (!saved || !isOnDevice(hero.portrait)) });
  } catch (err) {
    const code = err instanceof HeroError ? err.code : 'failed';
    // The server says no more free portraits: the pop-up says why and where to go next
    const limit: LimitReason | undefined = code === 'limit_pet' ? 'pet' : code === 'limit_pets' ? 'pets' : code === 'limit_game' ? 'total' : undefined;
    if (limit === 'pet') markPetUsedUp(name || shown);
    // The name also belongs to a brand or character: the box under the name asks the player
    if (code === 'name_ack_needed') setNameAck(name || shown, false);
    if (limit) {
      // Pick up the server's count, so the card shows the same thing
      const a = await fetchAllowance();
      if (a?.pets) setServerPets(a.pets, a.portraitsUsed);
    } else {
      lastError = err instanceof HeroError ? err.message : messageFor('failed');
    }
    openSetup(host, opts);
    if (limit) openLimitPopup(limit, name || shown);
  }
}

/** Keeps the typed name. A different name is a different pet: the current
 * pet's portrait and look are put aside, and the named pet's come back. */
function keepHeroName(host: CardHost, name: string): void {
  const h = loadHero();
  if (h?.portrait && petKey(h.name) && petKey(h.name) !== petKey(name)) {
    rememberPet(h, host.choice());
    const back = savedPet<PetChoice>(name);
    if (back) {
      host.setChoice(back.choice);
      saveHero({ ...back.hero, name: name || back.hero.name });
    } else {
      saveHero({ name });
    }
    return;
  }
  if (!h?.portrait && petKey(name) && petKey(h?.name ?? '') !== petKey(name)) {
    // Switching back to a pet that has a portrait saved on this device
    const back = savedPet<PetChoice>(name);
    if (back) {
      host.setChoice(back.choice);
      saveHero({ ...back.hero, name });
      return;
    }
  }
  saveHero({ ...(h ?? {}), name });
}

/** "Chewy: 2 of 3 free portraits left · 7 of 9 in all" */
function allowanceLine(name: string): string {
  const a = allowanceFor(name);
  const all = `${a.totalLeft} of ${TOTAL_PORTRAITS} in all`;
  const who = a.petName ? `<b>${esc(a.petName)}</b>` : 'This pet';
  if (a.blocked === 'pets') return `You've made portraits for ${MAX_PETS} pets. Pick one above to make more · ${all}`;
  if (a.blocked === 'pet') return `${who} has used ${PORTRAITS_PER_PET} of ${PORTRAITS_PER_PET} free portraits · ${all}`;
  if (a.isNew && petCounts().length) return `${name ? `New pet ${who}` : 'A new pet'}: ${a.petLeft} free portraits · ${all}`;
  return `${who}: ${a.petLeft} of ${PORTRAITS_PER_PET} free hero portraits left${petCounts().length ? ` · ${all}` : ''}`;
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}
function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * The pop-up when the free portraits run out (for this pet, for new pets, or
 * all 9): says why, and how to keep designing in the Design Your Pet app or
 * on goodwookie.com.
 */
export function openLimitPopup(reason: LimitReason, name: string): void {
  document.querySelector('#ui .limitpop')?.remove();
  const pet = allowanceFor(name).petName || 'your pet';
  const others = petCounts()
    .filter((p) => p.used < PORTRAITS_PER_PET)
    .map((p) => p.name);
  const a = allowanceFor('');
  let title: string;
  let why: string;
  if (reason === 'pet') {
    title = `That's all ${PORTRAITS_PER_PET} free portraits for ${esc(cap(pet))}`;
    why = `Fetch Dash gives every pet ${PORTRAITS_PER_PET} free hero portraits, for up to ${MAX_PETS} pets.`;
    if (others.length) why += ` You can still make portraits of ${esc(others.join(' or '))}.`;
    else if (a.newPetsLeft > 0 && a.totalLeft > 0) why += ` You can still make portraits of ${a.newPetsLeft === 1 ? 'one more pet' : `${a.newPetsLeft} more pets`}.`;
  } else if (reason === 'pets') {
    title = `You've made portraits for ${MAX_PETS} pets`;
    why = `Fetch Dash gives free hero portraits to up to ${MAX_PETS} pets per phone${others.length ? `. ${esc(others.join(' and '))} still ${others.length === 1 ? 'has' : 'have'} some left` : ''}.`;
  } else {
    title = `You've used all your free hero portraits`;
    why = `Fetch Dash gives ${PORTRAITS_PER_PET} free portraits per pet, for up to ${MAX_PETS} pets. Your heroes stay in the game.`;
  }
  const appUrl = isAndroid() ? DYP_PLAY : isIos() ? DYP_APP_STORE : DYP_PLAY;
  const appLabel = isAndroid() || isIos() ? '📱 Get the Design Your Pet app' : '📱 Design Your Pet on Google Play';
  const box = document.createElement('div');
  box.className = 'limitpop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<div class="box">
      <h2>${title}</h2>
      <p>${why}</p>
      <p class="keep">Keep designing ${reason === 'pet' ? esc(pet) : 'your pets'} in <b>Design Your Pet</b>: lots more art styles, up to 5 free designs every 24 hours, and you can put any design on a shirt, sticker or poster.</p>
      <div class="links">
        ${appUrl ? `<a class="btn primary" href="${appUrl}" target="_blank" rel="noopener">${appLabel}</a>` : ''}
        <a class="btn gold" href="${shopUrl(`limit-${reason}`)}" target="_blank" rel="noopener">🌐 Design on goodwookie.com</a>
      </div>
      <button class="btn ghost close">Back to the game</button>
    </div>`;
  const close = () => box.remove();
  box.querySelector('.close')!.addEventListener('click', close);
  box.addEventListener('click', (e) => {
    if (e.target === box) close();
  });
  ui().appendChild(box);
  box.querySelector<HTMLElement>('.close')!.focus({ preventScroll: true });
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
  // No portrait yet: show the pet's painted card picture (or the in-game pet) big on a sunburst instead
  const runner = '<div class="runner big"><img alt="" /></div>';
  const card = cardArtUrl(host.choice());
  return `<div class="portrait empty">
      <div class="burst"></div>
      ${card ? `<div class="card-pic"><img class="card-art" src="${card}" alt="" data-fallback="${esc(runner)}" /></div>` : runner}
      ${plate(displayName(hero, host.choice().species))}
      ${ribbon ? `<div class="ribbon">${ribbon}</div>` : ''}
    </div>`;
}

/** Where each level sits on the trail map, in a 1000 x 260 box. */
/**
 * Where each level's stop sits on the map (a 1000 x 260 box): the trail runs
 * left to right along the top, turns at the right edge and comes back along
 * the bottom.
 */
function mapPoints(n: number): { x: number; y: number }[] {
  const top = Math.ceil(n / 2);
  const bottom = n - top;
  return Array.from({ length: n }, (_, i) => {
    if (i < top) return { x: 110 + (i * 780) / Math.max(1, top - 1), y: 90 + 12 * Math.sin(i * 1.3) };
    const j = i - top;
    return { x: 890 - ((j + 0.5) * 760) / Math.max(1, bottom), y: 192 + 10 * Math.sin(j * 1.3 + 1) };
  });
}

/** The whole trail on the map: in from the left, through every stop, round the bend, and on to the ball. */
function mapTrail(pts: { x: number; y: number }[]): { full: { x: number; y: number }[]; at: (stop: number) => number } {
  const top = Math.ceil(pts.length / 2);
  const full = [{ x: 0, y: pts[0].y + 14 }, ...pts.slice(0, top), { x: 968, y: (pts[top - 1].y + (pts[top]?.y ?? 192)) / 2 }, ...pts.slice(top), { x: 40, y: 200 }];
  // stop k (1 = first) is at full[k], or one further along once past the bend
  return { full, at: (k) => (k <= top ? k : k + 1) };
}

/** How a level plays, in a few words, on the map. */
const STYLE_LABEL: Record<PlayStyle, string> = {
  run: 'Trail run',
  climb: 'Climbing',
  dig: 'Dig spots and tunnels',
  swim: 'Swimming',
  horizon: 'Run to the horizon',
  dark: 'Night run',
  space: 'Low gravity',
};

/** The middle of the trail's curve from pts[i] to pts[i + 1] (the same curve trailPath draws). */
function curveMid(pts: { x: number; y: number }[], i: number): { x: number; y: number } {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
  const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
  return { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
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

/**
 * The title screen: the Fetch Dash logo and a Play button, shown once when
 * the game opens, before the hero card or the trail map.
 */
export function openTitle(onPlay: () => void): void {
  const r = show(
    `<div class="titlecard">
      <img class="logo" src="./art/logo.webp" alt="Fetch Dash" />
      <button class="btn primary go">Play ▶</button>
      <p class="by">A Goodwookie game · Design Your Pet</p>
    </div>`,
    () => onPlay(),
  );
  r.classList.add('title');
  r.querySelector('.go')?.addEventListener('click', () => onPlay());
}

// ---------------------------------------------------------------------------
// Home: the pet, Play, and the buttons along the bottom
// ---------------------------------------------------------------------------

const ICON = {
  paw: '<svg viewBox="0 0 40 40" fill="#c8641f" stroke="#5a2c10" stroke-width="2"><ellipse cx="20" cy="27" rx="9" ry="7.5"/><ellipse cx="9" cy="17" rx="3.6" ry="4.6"/><ellipse cx="16" cy="10.5" rx="3.6" ry="4.8"/><ellipse cx="24" cy="10.5" rx="3.6" ry="4.8"/><ellipse cx="31" cy="17" rx="3.6" ry="4.6"/></svg>',
  map: '<svg viewBox="0 0 40 40" stroke="#16202a" stroke-width="2" stroke-linejoin="round"><path d="M5 9l9-3 12 4 9-3v24l-9 3-12-4-9 3z" fill="#f3e2b4"/><path d="M14 6v24M26 10v24" fill="none"/><path d="M9 25c4-1 5-6 9-6s5 4 9 2" fill="none" stroke="#a85433" stroke-dasharray="2 2"/></svg>',
  bandana: '<svg viewBox="0 0 40 40" stroke="#16202a" stroke-width="2" stroke-linejoin="round"><path d="M5 11q15 7 30 0l-2 5Q26 34 20 34 14 34 7 16z" fill="#24346a"/><circle cx="14" cy="19" r="1.6" fill="#fff" stroke="none"/><circle cx="24" cy="22" r="1.6" fill="#fff" stroke="none"/><circle cx="19" cy="27" r="1.6" fill="#fff" stroke="none"/></svg>',
  jar: '<svg viewBox="0 0 40 40" stroke="#16202a" stroke-width="2" stroke-linejoin="round"><rect x="11" y="5" width="18" height="5" rx="1.5" fill="#a85433"/><path d="M10 12h20q3 0 3 4v15q0 5-5 5H12q-5 0-5-5V16q0-4 3-4z" fill="#eaf4f7"/><g transform="translate(12 19) scale(.42)"><path d="M8 3a5 5 0 0 1 4.6 3h14.8A5 5 0 1 1 32 12a5 5 0 1 1-4.6 2H12.6A5 5 0 1 1 8 8a5 5 0 1 1 0-5z" fill="#f6e7c6" stroke="#7a5a28" stroke-width="3"/></g></svg>',
  shirt: '<svg viewBox="0 0 40 40" stroke="#16202a" stroke-width="2" stroke-linejoin="round"><path d="M14 5l-9 5 3 8 4-2v19h16V16l4 2 3-8-9-5q-2 4-6 4t-6-4z" fill="#fff"/><circle cx="20" cy="21" r="4.5" fill="#c79a3e"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="#16202a" stroke-width="2.2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};

/** 3,000 treats buy a $3 Design Your Pet coupon (Don, Nov 28). The coupon itself comes in a later build. */
export const COUPON = { treats: 3000, dollars: 3 };

function treatPill(host: CardHost, cls = ''): string {
  const cat = host.choice().species === 'cat';
  return `<button class="treatpill ${cls}" data-open="treats" title="Your treats" aria-label="Your treats: ${host.progress().bonusTreats}"><img src="art/props/${cat ? 'fish' : 'bone'}.webp" alt="" /><b>${host.progress().bonusTreats.toLocaleString()}</b></button>`;
}

export function openHome(host: CardHost, opts: { reveal?: boolean; notSaved?: boolean } = {}): void {
  const hero = loadHero();
  const p = host.progress();
  const c = host.choice();
  const name = displayName(hero, c.species);
  const l = levelById(p.current);
  const r = show(
    `<div class="homescr${opts.reveal ? ' reveal' : ''}">
      <img class="logo" src="./art/logo.webp" alt="Fetch Dash" />
      <div class="hero">
        ${petPicture(c, 'home')}
        <button class="plate edit" title="Edit ${esc(name)}">${esc(name.toUpperCase())} <small>✎ edit</small></button>
      </div>
      <div class="topbar">
        ${treatPill(host)}
        <button class="round settings" aria-label="Settings">${ICON.gear}</button>
      </div>
      ${opts.reveal ? `<div class="meet"><b>Meet ${esc(cap(name))}!</b> Your hero is ready.${hero?.portrait ? ' <button class="link portrait">See the portrait</button>' : ''}</div>` : ''}
      ${opts.notSaved ? `<p class="error homeerr">We couldn't save this portrait on your phone. Use Save picture after your next run: our copy is deleted after ${SERVER_PORTRAIT_DAYS} days.</p>` : ''}
      <div class="playzone">
        <button class="lvlribbon" data-open="map">Level ${l.id} · ${esc(l.name)} <span class="stars">${starRow(p.stars[l.id] ?? 0)}</span></button>
        <button class="btn primary play">Play ▶</button>
      </div>
      <nav class="dock" aria-label="Menu">
        <button class="tile" data-open="pet"><i>${ICON.paw}</i><span>My Pet</span></button>
        <button class="tile" data-open="map"><i>${ICON.map}</i><span>Trail map</span></button>
        <button class="tile" data-open="wardrobe"><i>${ICON.bandana}</i><span>Wardrobe</span></button>
        <button class="tile" data-open="treats"><i>${ICON.jar}</i><span>Treats</span></button>
        <button class="tile" data-open="merch"><i>${ICON.shirt}</i><span>Merch</span></button>
      </nav>
    </div>`,
    () => host.play(host.progress().current),
  );
  r.classList.add('home');
  setHomeShowing(true);
  startRunner(r, host);
  seatSloths(r);
  r.querySelector('.play')?.addEventListener('click', () => host.play(host.progress().current));
  r.querySelector('.edit')?.addEventListener('click', () => openSetup(host, { canGoBack: true, step: 0 }));
  r.querySelector('.settings')?.addEventListener('click', () => openSettings(host));
  r.querySelector('.portrait')?.addEventListener('click', () => {
    if (!hero?.portrait) return;
    const big = document.createElement('button');
    big.className = 'bigportrait';
    big.innerHTML = `<img src="${esc(hero.portrait)}" alt="Hero portrait" /><span>Tap to close</span>`;
    big.addEventListener('click', () => big.remove());
    r.querySelector('.homescr')?.appendChild(big);
  });
  bindOpeners(r, host);
}

/** The buttons that open the other cards (home, map, and the cards themselves). */
function bindOpeners(r: HTMLElement, host: CardHost): void {
  r.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) =>
    b.addEventListener('click', () => {
      const to = b.dataset.open;
      if (to === 'pet') openSetup(host, { canGoBack: true, step: 0 });
      else if (to === 'map') openMap(host);
      else if (to === 'wardrobe') openWardrobe(host);
      else if (to === 'treats') openTreats(host);
      else if (to === 'merch') openMerch(host);
      else if (to === 'home') openHome(host);
    }),
  );
}

/** A card over the home screen: a title, the treat count and a close button. */
function homeCard(host: CardHost, cls: string, title: string, body: string): HTMLDivElement {
  const r = show(
    `<div class="card homecard ${cls}">
      <div class="hc-head"><h1>${title}</h1>${treatPill(host)}<button class="round close" data-open="home" aria-label="Close">×</button></div>
      <div class="hc-body">${body}</div>
    </div>`,
  );
  setHomeShowing(true);
  bindOpeners(r, host);
  return r;
}

/** Wardrobe items still to be painted (Elon's list: /mnt/project-files/wardrobe/wardrobe-for-elon.md). */
const WARDROBE_SOON: { icon: string; name: string; unlock: string }[] = [
  { icon: '📿', name: 'Collar', unlock: '15 ★' },
  { icon: '🎀', name: 'Bow tie', unlock: '600 treats' },
  { icon: '🧣', name: 'Scarf', unlock: '900 treats' },
  { icon: '🧢', name: 'Ball cap', unlock: '1,000 treats' },
  { icon: '🌼', name: 'Flower crown', unlock: '1,200 treats' },
  { icon: '🕶️', name: 'Sunglasses', unlock: '1,500 treats' },
  { icon: '🎉', name: 'Party hat', unlock: 'Rank 5' },
  { icon: '🦸', name: 'Hero cape', unlock: 'All 19 levels' },
];

export function openWardrobe(host: CardHost): void {
  const c = host.choice();
  const dog = c.species === 'dog' ? c.dog : undefined;
  const chewy = paintedWithSloth(c);
  const hexOf = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const bandanas = dog
    ? `<button class="item${dog.bandana ? '' : ' on'}" data-bandana=""><span class="swatch none"></span><span>None</span></button>` +
      Object.entries(BANDANAS)
        .map(([k, v]) => `<button class="item${dog.bandana === k ? ' on' : ''}" data-bandana="${k}"><span class="swatch" style="background:${hexOf(v)}"></span><span>${cap(k)}</span></button>`)
        .join('')
    : '';
  const sloth = `<button class="item${slothWanted() || chewy ? ' on' : ''}" data-sloth${chewy ? ' disabled' : ''}><img src="art/sloth/side.webp" alt="" /><span>${chewy ? 'Always on' : 'Sloth'}</span></button>`;
  const soon = WARDROBE_SOON.map((w) => `<div class="item lock"><span class="ic">${w.icon}</span><span>${w.name}</span><small>🔒 ${w.unlock}</small></div>`).join('');
  const r = homeCard(
    host,
    'wardrobe',
    'Wardrobe',
    `<div class="tryon">${petPicture(c, 'try')}<div class="who"><b>${esc(cap(displayName(loadHero(), c.species)))}</b><p>Tap something to try it on.${dog ? '' : ` Bandanas come to ${chewy ? 'Chewy' : 'cats'} with Elon's next pictures.`}</p></div></div>
     <div class="items">${bandanas}${sloth}</div>
     <h2>Coming soon</h2>
     <div class="items">${soon}</div>`,
  );
  seatSloths(r);
  r.querySelectorAll<HTMLButtonElement>('[data-bandana]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = host.choice();
      if (!cur.dog) return;
      const d = { ...cur.dog };
      if (b.dataset.bandana) d.bandana = b.dataset.bandana;
      else delete d.bandana;
      host.setChoice({ ...cur, dog: d });
      openWardrobe(host);
    }),
  );
  r.querySelector('[data-sloth]')?.addEventListener('click', () => {
    setSlothWanted(!slothWanted());
    host.setChoice(host.choice());
    openWardrobe(host);
  });
}

export function openTreats(host: CardHost): void {
  const jar = host.progress().bonusTreats;
  const cat = host.choice().species === 'cat';
  const toGo = Math.max(0, COUPON.treats - jar);
  const pct = Math.min(100, Math.round((jar / COUPON.treats) * 100));
  homeCard(
    host,
    'treats',
    'Treats',
    `<p class="lead">Every ${cat ? 'fish' : 'treat'} your pet catches is saved here: on the trail, in bonus rounds, everywhere.</p>
     <div class="row warm">
       <div class="grow"><b>Treat rewards</b> <span class="soon-tag">Coming soon</span><br>
       <small>${COUPON.treats.toLocaleString()} treats get you a $${COUPON.dollars} Design Your Pet coupon, for a shirt or hoodie with your hero on it.</small>
       <div class="bar"><span style="width:${pct}%"></span></div>
       <small>${toGo ? `${toGo.toLocaleString()} to go` : 'You have enough!'}</small></div>
     </div>
     <div class="row"><div class="grow"><b>Spend them in the Wardrobe</b><br><small>Bow ties, caps, sunglasses and more, as Elon paints them.</small></div><button class="btn ghost" data-open="wardrobe">Wardrobe</button></div>
     <div class="row"><div class="grow"><b>Treat packs, free treats and Remove ads</b><br><small>Coming in the next build.</small></div></div>`,
  );
}

export function openMerch(host: CardHost): void {
  const hero = loadHero();
  const c = host.choice();
  const name = cap(displayName(hero, c.species));
  const pic = hero?.portrait ? `<img class="onshirt" src="${esc(hero.portrait)}" alt="" />` : `<img class="onshirt" src="./hero-example.webp" alt="" />`;
  const r = homeCard(
    host,
    'merch',
    `${esc(name)} on a shirt`,
    `<div class="merchrow">
       <div class="shirt"><svg viewBox="0 0 200 200"><path d="M68 18 22 42l14 42 20-10v110h88V74l20 10 14-42-46-24q-10 18-32 18T68 18z" fill="#26323d" stroke="#16202a" stroke-width="4" stroke-linejoin="round"/></svg>${pic}</div>
       <div class="grow">
         <h2>Put your hero on a shirt</h2>
         <p>${hero?.portrait ? `${esc(name)}'s Arcade Hero portrait` : 'Your pet as an Arcade Hero'}, printed by Design Your Pet. Sizes XS to 5XL.</p>
         <div class="segs"><span class="seg on">Front print $26</span><span class="seg">Back print $34</span></div>
         <div class="actions"><a class="btn gold" href="${shopUrl('home-merch')}" target="_blank" rel="noopener">Open Design Your Pet →</a>${hero?.portrait ? '' : '<button class="btn ghost addphoto">Make a hero portrait</button>'}</div>
         <p class="small">Treat coupons (${COUPON.treats.toLocaleString()} treats for $${COUPON.dollars}) are coming soon.</p>
       </div>
     </div>`,
  );
  r.querySelector('.addphoto')?.addEventListener('click', () => openSetup(host, { canGoBack: true, step: 4 }));
}

export function openSettings(host: CardHost): void {
  const r = homeCard(
    host,
    'settings',
    'Settings',
    `<div class="actions left">
       ${tutorialDone() ? '<button class="btn ghost tut">Replay tutorial</button>' : ''}
       <a class="btn ghost" href="${shopUrl('settings')}" target="_blank" rel="noopener">Design Your Pet</a>
     </div>
     ${LIVE ? `<p class="small">Your game code: <span class="code">${esc(gameCode())}</span>. To have everything deleted from our server, email info@goodwookie.com with it.</p>` : ''}
     <div class="actions left privacyrow"></div>`,
  );
  addPrivacyButton(r.querySelector('.privacyrow'));
  r.querySelector('.tut')?.addEventListener('click', () => {
    setTutorialDone(false);
    host.play(1);
  });
}

// ---------------------------------------------------------------------------
// The trail map: pick a level
// ---------------------------------------------------------------------------
export function openMap(host: CardHost): void {
  const hero = loadHero();
  const p = host.progress();
  const name = displayName(hero, host.choice().species);
  const pts = mapPoints(LEVELS.length);
  // The trail runs in from the left edge and on to the ball past the last stop
  const { full, at } = mapTrail(pts);
  const ballPt = full[full.length - 1];
  const walked = full.slice(0, Math.min(full.length, at(p.unlocked) + 1));
  const topRow = Math.ceil(LEVELS.length / 2);
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
    const above = i < topRow;
    return `<button class="stop${locked ? ' locked' : ''}${done ? ' done' : ''}${l.id === p.current ? ' on' : ''}" data-level="${l.id}"
        style="left:${x / 10}%; top:${y / 2.6}%; --ring:${hex(l.theme.grassDark)}" ${locked ? 'disabled' : ''} title="${esc(l.name)}" aria-label="Level ${l.id}: ${esc(l.name)}">
        <b>${locked ? '🔒' : l.id}</b>
        ${done ? `<em class="mini">${starRow(p.stars[l.id] ?? 0)}</em>` : ''}
      </button>
      <span class="mark" style="left:${x / 10}%; top:${(above ? y - 44 : y + 42) / 2.6}%">${l.icon}</span>`;
  }).join('');
  // Backyard Toss bonus stops on the trail after the levels in BONUS_AFTER, open once that level is done
  const cat = host.choice().species === 'cat';
  const bonusAt = new Map(BONUS_AFTER.filter((a) => a < LEVELS.length).map((a) => [a, curveMid(full, at(a))]));
  const bonusStops = [...bonusAt].map(([a, { x, y }]) => {
    const open = p.done.includes(a);
    return `<button class="bstop${open ? '' : ' locked'}" data-after="${a}" style="left:${x / 10}%; top:${y / 2.6}%" ${open ? '' : 'disabled'}
        title="${open ? 'Bonus round' : `Bonus round: finish level ${a} first`}" aria-label="Bonus round after level ${a}">${cat ? '🧶' : '🎾'}</button>`;
  }).join('');

  const r = show(
    `<div class="card home mapcard">
      <div class="maphead">
        ${heroMedal(hero)}
        <div class="who">
          <h1>${esc(cap(name))}</h1>
          <p class="lead">Pick a trail on the map.</p>
        </div>
        <img class="headlogo" src="./art/logo.webp" alt="Fetch Dash" />
        <div class="headbtns">
          <button class="btn ghost homebtn">‹ Home</button>
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
        ${bonusStops}
        <span class="jar" title="Treats from bonus rounds">${cat ? '🐟' : '🦴'} Treat jar: ${p.bonusTreats}</span>
        <span class="ball" style="left:${ballPt.x / 10}%; top:${ballPt.y / 2.6}%">🎾</span>
        <span class="compass">🧭</span>
        <div class="mappet"><img class="flip" alt="" /></div>
      </div>
      <div class="mapfoot">
        <div class="info"></div>
        <button class="btn primary play"></button>
      </div>
    </div>`,
    () => go(),
  );

  // The bonus round picked on the map, if one is
  let bonusPick: number | undefined;
  const go = () => (bonusPick && host.playBonus ? host.playBonus(bonusPick) : host.play(host.progress().current));
  const standPet = (at: { x: number; y: number }) => {
    const pet = r.querySelector<HTMLElement>('.mappet');
    if (pet) {
      pet.style.left = `${at.x / 10}%`;
      pet.style.top = `${at.y / 2.6}%`;
    }
  };
  const highlight = (level?: number, after?: number) => {
    r.querySelectorAll('.stop').forEach((b) => b.classList.toggle('on', Number((b as HTMLElement).dataset.level) === level));
    r.querySelectorAll('.bstop').forEach((b) => b.classList.toggle('on', Number((b as HTMLElement).dataset.after) === after));
  };
  const pickBonus = (after: number) => {
    bonusPick = after;
    highlight(undefined, after);
    standPet(bonusAt.get(after)!);
    const info = r.querySelector('.info');
    if (info) {
      info.innerHTML = `<b>Bonus round · Backyard Toss</b>
        <small>Throw the ${cat ? 'yarn' : 'ball'}, fetch it and bring it back for treats · ${BONUS.roundSeconds} s · Treat jar ${host.progress().bonusTreats}</small>`;
    }
    const play = r.querySelector('.play');
    if (play) play.textContent = 'Play bonus round ▶';
  };

  // Show the picked level's name, stars and best score, and stand the pet on its stop
  const pick = (id: number) => {
    bonusPick = undefined;
    const prog = host.progress();
    prog.current = id;
    const l = levelById(id);
    const i = LEVELS.indexOf(l);
    highlight(id);
    standPet(pts[i]);
    const best = prog.best[id];
    const info = r.querySelector('.info');
    if (info) {
      info.innerHTML = `<b>Level ${id} · ${esc(l.name)}</b>
        <span class="stars">${starRow(prog.stars[id] ?? 0)}</span>
        <small>${STYLE_LABEL[playStyle(l)]} · ${esc(l.tagline)} · ${l.goalMeters} m${best ? ` · Best ${best}` : ''}</small>`;
    }
    const play = r.querySelector('.play');
    if (play) play.textContent = `Play Level ${id} ▶`;
  };
  pick(p.current);
  startRunner(r, host);
  r.querySelectorAll<HTMLButtonElement>('.stop').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.level))));
  r.querySelectorAll<HTMLButtonElement>('.bstop').forEach((b) => b.addEventListener('click', () => pickBonus(Number(b.dataset.after))));
  r.querySelector('.play')?.addEventListener('click', go);
  setHomeShowing(true);
  r.querySelector('.homebtn')?.addEventListener('click', () => openHome(host));
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

/**
 * The name plate under the pet's picture. Names wrap between words, and a
 * long word (up to the 18-letter limit) gets smaller letters so it stays on
 * the plate.
 */
function plate(name: string): string {
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => w.length));
  const k = Math.min(1, 11 / longest);
  const size = k < 1 ? ` style="font-size: calc(clamp(18px, 5vh, 34px) * ${k.toFixed(2)})"` : '';
  return `<div class="plate"${size}>${esc(name.toUpperCase())}</div>`;
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
  // After the levels in BONUS_AFTER the bonus round comes next (it can be skipped)
  const bonus = res.won && BONUS_AFTER.includes(res.level) && host.playBonus ? () => host.playBonus!(res.level) : undefined;
  // Leaving this card is a natural break, where the phone app may show an ad (ads.ts)
  const go = () => adBreak(() => (bonus ? bonus() : host.play(primaryLevel)));

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
              ${res.treatsTotal ? `<li class="${res.goals.treats ? 'ok' : ''}">Grab most of the treats (${res.treats} of ${res.treatsTotal})</li>` : ''}
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
            ${bonus ? `<button class="btn ghost skip">Skip to ${next ? `Level ${next.id}` : 'the map'}</button>` : ''}
            <button class="btn primary again">${bonus ? '\u{1F3BE} Bonus round ▶' : primary}</button>
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
    go,
  );
  startRunner(r, host);
  r.querySelector('.again')?.addEventListener('click', go);
  r.querySelector('.skip')?.addEventListener('click', () => adBreak(() => (next ? host.play(primaryLevel) : openHome(host))));
  r.querySelector('.levels-btn')?.addEventListener('click', () =>
    adBreak(() => {
      host.progress().current = primaryLevel;
      openHome(host);
    }),
  );
  r.querySelector('.make')?.addEventListener('click', () => openSetup(host, { canGoBack: true }));
  r.querySelector('.savepic')?.addEventListener('click', () => void savePicture(hero!, name, level.name, res));
  r.querySelector('.report')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    await reportDesign(hero!.designId!, 'other').catch(() => undefined);
    b.textContent = 'Reported. Thank you.';
  });
}

// ---------------------------------------------------------------------------
// End of a bonus round
// ---------------------------------------------------------------------------

export function openBonusEnd(host: CardHost, res: BonusResult): void {
  const hero = loadHero();
  const next = res.after ? LEVELS.find((l) => l.id === res.after! + 1) : undefined;
  const cat = res.species === 'cat';
  const treat = cat ? '🐟' : '🦴';
  const n = res.returned;
  const toy = cat ? (n === 1 ? 'ball of yarn' : 'balls of yarn') : n === 1 ? 'ball' : 'balls';
  const title = n ? `${esc(res.name)} brought back ${n} ${toy}!` : "Time's up!";
  const rows: [string, number][] = [
    [`Brought back (${n} × ${BONUS.perReturn})`, n * BONUS.perReturn],
    [`Air catches (${res.airCatches} × ${BONUS.airCatch})`, res.airCatches * BONUS.airCatch],
    ['Golden treats', res.golden],
    [`Streak bonus (${res.streaks} × ${BONUS.streak.bonus})`, res.streaks * BONUS.streak.bonus],
  ];
  const primary = next ? `Level ${next.id}: ${next.name} ▶` : 'Trail map ▶';
  const go = () => adBreak(() => (next ? host.play(next.id) : openHome(host)));
  const r = show(
    `<div class="card end won bonusend">
      <div class="cols">
        <div class="col left">${portraitBlock(host, hero, 'Bonus round!')}</div>
        <div class="col right">
          <h1>${title}</h1>
          <p class="lead">Backyard Toss${n ? '' : ` · Try a shorter throw, then bring the ${cat ? 'yarn' : 'ball'} to the circle`}</p>
          <ul class="tally">
            ${rows.map(([label, v]) => `<li><span>${label}</span><b>${v ? `+${v}` : '0'}</b></li>`).join('')}
            <li class="sum"><span>Bonus treats</span><b>${treat} +${res.total}</b></li>
          </ul>
          <p class="jarline">Treat jar: <b>${res.jar}</b> ${treat}</p>
          <div class="actions">
            ${next ? '<button class="btn ghost levels-btn">Map</button>' : ''}
            <button class="btn ghost toss">Toss again</button>
            <button class="btn primary again">${primary}</button>
          </div>
          <div class="shop">
            <p>Put ${esc(displayName(hero, res.species))} on a shirt, sticker or poster.</p>
            <a class="btn gold" href="${shopUrl('bonus-end')}" target="_blank" rel="noopener">Shop Design Your Pet →</a>
          </div>
        </div>
      </div>
    </div>`,
    go,
  );
  startRunner(r, host);
  r.querySelector('.again')?.addEventListener('click', go);
  r.querySelector('.toss')?.addEventListener('click', () => adBreak(() => host.playBonus?.(res.after ?? 0)));
  r.querySelector('.levels-btn')?.addEventListener('click', () =>
    adBreak(() => {
      if (next) host.progress().current = next.id;
      openHome(host);
    }),
  );
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
