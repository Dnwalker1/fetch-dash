// Ads in the phone app (27 Nov 2026).
//
// Google AdMob runs here, natively, never inside the game's WebView. The game
// only says when the player has reached a natural break (tapping on from the
// end-of-run or bonus card, see src/ads.ts), and waits until we say "done".
// So an ad never covers a run.
//
// Rules Don approved: a standard 13+ app (not Families), ad content rated PG
// at most, Google's consent form (UMP) on first launch where the law needs
// it, no ads mid-run, and test ads in every test build.

import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads';

/** How often the between-runs ad may show. */
export const AD_RULES = {
  /** At least this long between two ads. */
  minGapMs: 3 * 60_000,
  /** Breaks each time the app opens before the first ad can show. */
  freeBreaks: 2,
};

/**
 * Don's "Between runs" interstitial unit from AdMob, per platform. Empty
 * means no ads in store builds on that platform yet (iOS has no app in
 * AdMob yet).
 */
const BETWEEN_RUNS_UNIT = {
  android: 'ca-app-pub-3611997283952590/9764409914',
  ios: '',
};

/**
 * Real ads only in store builds: eas.json's production profile sets
 * EXPO_PUBLIC_REAL_ADS=1. Every other build shows Google's test ads, which
 * are safe to tap (tapping your own real ads can get the AdMob account shut).
 */
export const REAL_ADS = process.env.EXPO_PUBLIC_REAL_ADS === '1';

function unitId(): string | null {
  if (!REAL_ADS) return TestIds.INTERSTITIAL;
  return Platform.select({ android: BETWEEN_RUNS_UNIT.android, ios: BETWEEN_RUNS_UNIT.ios, default: '' }) || null;
}

/** The game's age-screen answer (src/hero/age.ts), when it has one. */
type AgeBand = 'under13' | '13-17' | '18+';
const isAgeBand = (v: unknown): v is AgeBand => v === 'under13' || v === '13-17' || v === '18+';

/** What the game is told, so it can show a "Privacy choices" button. */
export interface AdStatus {
  privacy: boolean;
}

/** Messages from the game (src/ads.ts). */
type GameMessage =
  | { fd: 'ads'; type: 'hello'; age?: string }
  | { fd: 'ads'; type: 'break'; id: number; at?: number; age?: string }
  | { fd: 'ads'; type: 'privacy' };

/** Script lines sent back into the game. */
export type Reply = (script: string) => void;

const call = (fn: string, ...args: unknown[]) =>
  `window.__fetchDashAds && window.__fetchDashAds.${fn}(${args.map((a) => JSON.stringify(a)).join(',')}); true;`;

class Ads {
  private started = false;
  private canRequest = false;
  private status: AdStatus = { privacy: false };
  private statusListeners = new Set<(s: AdStatus) => void>();

  private age: AgeBand | undefined;
  private ad: InterstitialAd | undefined;
  /** The age settings the held ad was loaded with. */
  private adFor: string | undefined;
  private loaded = false;
  private loading = false;
  private showing = false;
  private retryMs = 30_000;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  private breaks = 0;
  private lastShown = 0;

  /** Consent first, then the SDK, then the first ad loads. Called once, at launch. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      // Shows Google's consent form only where it's required (EEA, UK, some US states)
      // and only until it has been answered. AdMob sets the form up (Privacy & messaging).
      await AdsConsent.gatherConsent();
    } catch {
      // Offline or the form couldn't load: fall back to what the phone already knows
    }
    try {
      const info = await AdsConsent.getConsentInfo();
      this.canRequest = info.canRequestAds;
      this.setStatus({ privacy: info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED });
    } catch {
      this.canRequest = false;
    }
    if (!this.canRequest) return;
    try {
      await this.configure();
      await mobileAds().initialize();
      this.load();
    } catch {
      this.canRequest = false;
    }
  }

  onStatus(fn: (s: AdStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  /** A message from the game's WebView. Anything not for us is ignored. */
  handle(data: string, reply: Reply): void {
    let msg: GameMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || msg.fd !== 'ads') return;
    if (msg.type === 'hello') {
      this.setAge(msg.age);
      reply(call('status', this.status));
    } else if (msg.type === 'break') {
      this.setAge(msg.age);
      void this.adBreak(msg.id, reply, msg.at);
    } else if (msg.type === 'privacy') {
      void this.privacyOptions();
    }
  }

  private setStatus(s: AdStatus) {
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  private setAge(v: unknown) {
    if (isAgeBand(v)) this.age = v;
  }

  /** The request settings for the player's age, as one comparable key. */
  private ageKey(): string {
    return this.age ?? 'unknown';
  }

  private async configure(): Promise<void> {
    const under13 = this.age === 'under13';
    const minor = under13 || this.age === '13-17';
    await mobileAds().setRequestConfiguration({
      // PG at most for everyone; G if the player told the game they're under 13
      maxAdContentRating: under13 ? MaxAdContentRating.G : MaxAdContentRating.PG,
      // Not a children's app, but a player who says they're under 13 is treated as one
      tagForChildDirectedTreatment: under13,
      tagForUnderAgeOfConsent: minor,
    });
  }

  private load() {
    const id = unitId();
    if (!this.canRequest || !id || this.loading || this.loaded) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.loading = true;
    const key = this.ageKey();
    const minor = this.age !== undefined && this.age !== '18+';
    void this.configure()
      .catch(() => undefined)
      .then(() => {
        this.ad?.destroy();
        // Players under 18 only get ads that aren't based on their activity
        const ad = InterstitialAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: minor });
        ad.addAdEventListener(AdEventType.LOADED, () => {
          this.loading = false;
          this.loaded = true;
          this.retryMs = 30_000;
        });
        ad.addAdEventListener(AdEventType.ERROR, () => {
          this.loading = false;
          this.loaded = false;
          if (this.showing) return; // handled by the show
          // No ad (often just no fill): try again later, less often each time
          this.retryTimer = setTimeout(() => this.load(), this.retryMs);
          this.retryMs = Math.min(this.retryMs * 2, 10 * 60_000);
        });
        this.ad = ad;
        this.adFor = key;
        ad.load();
      });
  }

  /** The player is between runs. Shows an ad if one is ready and the rules allow it. */
  private async adBreak(id: number, reply: Reply, at?: number): Promise<void> {
    const done = () => reply(call('done', id));
    this.breaks++;
    // The game goes on by itself after 1.5 s without an answer, so a late
    // message never gets an ad: it could cover the next run.
    const late = typeof at === 'number' && Math.abs(Date.now() - at) > 1000;
    const due = !late && this.breaks > AD_RULES.freeBreaks && Date.now() - this.lastShown >= AD_RULES.minGapMs;
    const ad = this.ad;
    // An ad loaded for another age answer isn't shown; the right one loads for next time
    if (ad && this.loaded && this.adFor !== this.ageKey()) {
      this.loaded = false;
      this.load();
    }
    if (!due || !ad || !this.loaded || this.showing) {
      done();
      this.load();
      return;
    }
    this.showing = true;
    reply(call('showing', id));
    const finish = () => {
      if (!this.showing) return;
      this.showing = false;
      this.loaded = false;
      offClosed();
      offError();
      done();
      this.load();
    };
    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.lastShown = Date.now();
      finish();
    });
    const offError = ad.addAdEventListener(AdEventType.ERROR, finish);
    try {
      await ad.show();
    } catch {
      finish();
    }
  }

  /** The "Privacy choices" button in the game: Google's form to change consent. */
  private async privacyOptions(): Promise<void> {
    try {
      const info = await AdsConsent.showPrivacyOptionsForm();
      this.canRequest = info.canRequestAds;
      if (this.canRequest) {
        await mobileAds().initialize();
        this.load();
      }
    } catch {
      // The form couldn't open (offline); the button stays for another try
    }
  }
}

export const ads = new Ads();

/** The status line for the game, set before its page loads. */
export function adStatusScript(s: AdStatus): string {
  return `window.__FETCH_DASH_ADS = ${JSON.stringify(s)}; ${call('status', s)}`;
}
