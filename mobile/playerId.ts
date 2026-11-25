import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The ID goodwookie.com counts this phone's free hero portraits against.
 * Unlike the game's own storage, it comes back after the app is deleted and
 * installed again, so a reinstall doesn't hand out fresh portraits.
 *
 * - Android: built from the Android ID. Since Android 8 that's a different
 *   value for each app signing key, so it can't follow the player to other
 *   apps, and it only changes after a factory reset. Only a one-way hash of
 *   it leaves the phone. Google Play allows it for stopping abuse (never for
 *   ads); the Data safety form lists it as "Device or other IDs".
 * - iPhone: a random ID kept in the Keychain, which iOS keeps when the app
 *   is deleted. It's tied to this phone ("this device only") and goes when the
 *   phone is erased.
 *
 * Shaped like a UUID, as the backend expects. Null when neither works; the
 * game then falls back to its own stored ID, as on the web.
 */
export interface PlayerId {
  id: string;
  kind: 'android-id' | 'ios-keychain';
}

const KEYCHAIN_KEY = 'fetch-dash-player-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First 128 bits of a SHA-256, laid out as a version-5-style UUID. */
function hashToUuid(hex: string): string {
  const h = hex.slice(0, 32).split('');
  h[12] = '5';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function getPlayerId(): Promise<PlayerId | null> {
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (!androidId) return null;
      const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `fetch-dash:${androidId}`);
      return { id: hashToUuid(hex), kind: 'android-id' };
    }
    if (Platform.OS === 'ios') {
      const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
      let id = await SecureStore.getItemAsync(KEYCHAIN_KEY, opts);
      if (!id || !UUID.test(id)) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync(KEYCHAIN_KEY, id, opts);
      }
      return { id, kind: 'ios-keychain' };
    }
  } catch {
    // fall through to the game's own ID
  }
  return null;
}

/** A line of script that hands the ID to the game before it starts. */
export function playerIdScript(p: PlayerId | null): string {
  return `window.__FETCH_DASH_PLAYER = ${JSON.stringify(p)}; true;`;
}
