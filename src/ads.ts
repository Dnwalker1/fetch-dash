// Ad breaks (27 Nov 2026).
//
// The game shows no ads itself. In the phone app, Google AdMob runs natively
// (mobile/ads.ts) and this file only tells it when the player is at a natural
// break: tapping on from the end-of-run or bonus card. The next run waits
// until the app says the ad is done, so an ad never covers a run. On the web
// (and in an app build without ads) every break carries straight on.
//
// The app decides whether an ad is due (at most one every few minutes, none
// in the first runs of a session) and where it's needed shows a "Privacy
// choices" button, so players can change their ad consent.

interface AdStatus {
  privacy: boolean;
}

interface AdsWindow {
  ReactNativeWebView?: { postMessage(msg: string): void };
  __FETCH_DASH_ADS?: AdStatus;
  __fetchDashAds?: {
    status(s: AdStatus): void;
    showing(id: number): void;
    done(id: number): void;
  };
}

const w = window as unknown as AdsWindow;

/** How long to wait for the app to answer before going on without it. */
const NO_ANSWER_MS = 1500;
/** Longest an ad may hold the game, in case the app never says it closed. */
const AD_MAX_MS = 90_000;

let seq = 0;
let pending: { id: number; finish: () => void; timer: number } | undefined;

function send(msg: Record<string, unknown>): boolean {
  const bridge = w.ReactNativeWebView;
  if (!bridge) return false;
  try {
    bridge.postMessage(JSON.stringify({ fd: 'ads', ...msg }));
    return true;
  } catch {
    return false;
  }
}

/** The age screen's answer (hero/age.ts), so players under 18 only get non-personalised ads. */
function ageBand(): string | undefined {
  try {
    return localStorage.getItem('fetch-dash-age') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * A natural break: the app may show an ad here. `next` runs once it's done,
 * or right away when there's no ad.
 */
export function adBreak(next: () => void): void {
  // A second tap while the first is still waiting does nothing
  if (pending) return;
  const id = ++seq;
  const finish = () => {
    if (pending?.id !== id) return;
    window.clearTimeout(pending.timer);
    pending = undefined;
    next();
  };
  pending = { id, finish, timer: window.setTimeout(finish, NO_ANSWER_MS) };
  if (!send({ type: 'break', id, at: Date.now(), age: ageBand() })) finish();
}

/** Adds the "Privacy choices" button to a row of buttons, where the app says it's needed. */
export function addPrivacyButton(row: Element | null): void {
  if (!row || !w.__FETCH_DASH_ADS?.privacy || row.querySelector('.adprivacy')) return;
  const b = document.createElement('button');
  b.className = 'btn ghost adprivacy';
  b.textContent = 'Privacy choices';
  b.addEventListener('click', () => send({ type: 'privacy' }));
  row.appendChild(b);
}

// Answers from the app
w.__fetchDashAds = {
  status(s) {
    w.__FETCH_DASH_ADS = s;
    // The home card may already be open
    addPrivacyButton(document.querySelector('#ui .card.home .headbtns'));
  },
  showing(id) {
    // The ad is up: wait for it to close
    if (pending?.id !== id) return;
    window.clearTimeout(pending.timer);
    pending.timer = window.setTimeout(pending.finish, AD_MAX_MS);
  },
  done(id) {
    if (pending?.id === id) pending.finish();
  },
};

send({ type: 'hello', age: ageBand() });
