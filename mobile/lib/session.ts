/**
 * The session token, and the only code allowed to touch the keychain.
 *
 * ## Why expo-secure-store and not AsyncStorage
 *
 * `AsyncStorage` is an unencrypted file in the app's sandbox. On a rooted
 * device, in a filesystem backup, or via any library that walks the documents
 * directory, it is readable. A session token there is a token anyone with the
 * handset can lift and replay for up to seven days.
 *
 * `expo-secure-store` is the Android Keystore — hardware-backed where the device
 * supports it, wiped with the app, and never part of a backup. This is exactly
 * the thing it exists for.
 *
 * ## The expiry is stored beside it, and is not trusted
 *
 * `expiresAt` is kept so the app can warn someone *before* they are signed out
 * — see §6.9 of the plan. It is a UX affordance and nothing more. The server
 * enforces both clocks in the WHERE clause of `readSession`, so a device with a
 * wrong system time, or a tampered value here, changes nothing about what the
 * API will accept. The app must never use this to decide it is authorised; only
 * to decide what to say.
 */

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'sxccaa.session.token';
const EXPIRY_KEY = 'sxccaa.session.expiresAt';

export interface StoredSession {
  token: string;
  /** Absolute deadline, ISO 8601. Advisory — see this file's header. */
  expiresAt: string;
}

/**
 * Reads are wrapped because SecureStore throws rather than returning null when
 * the keystore is unavailable — a device with no screen lock on some Android
 * builds, or a keystore invalidated by a biometric change. Treating that as
 * "not signed in" sends the user to the login screen, which works. Letting it
 * propagate crashes the app at launch, which does not.
 */
export async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    const expiresAt = (await SecureStore.getItemAsync(EXPIRY_KEY)) ?? '';
    return { token, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Persist the session. Returns false if it could not be saved.
 *
 * **It does not throw, and callers must not treat false as a failed sign-in.**
 *
 * Found while testing phase 2: the sign-in code is single-use and is spent the
 * moment the server accepts it. If persisting the resulting token then threw,
 * the app discarded a perfectly good session *and* the code that earned it —
 * so the user was bounced back to a login screen where their code no longer
 * worked, with no way forward but to request another. A keystore hiccup became
 * a dead end.
 *
 * The keystore can genuinely be unavailable: a device with no screen lock on
 * some Android builds, a keystore invalidated by a biometric or lock-screen
 * change, or a platform where SecureStore is not implemented at all. None of
 * those should cost someone their session.
 *
 * So the token is kept in memory by the auth context regardless, and this
 * reports whether it will survive a restart. The caller decides what to say.
 */
export async function storeSession(session: StoredSession): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, session.token, {
      // The token is needed on a cold start before the user has unlocked
      // anything, so it cannot require authentication to read. The device lock
      // is the boundary; the optional biometric re-lock is a separate,
      // app-level control and does not gate this item.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(EXPIRY_KEY, session.expiresAt, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the token.
 *
 * Deliberately tolerant of failure on each key independently: a half-cleared
 * session is worse than a failed clear, so both deletes are attempted even if
 * the first throws.
 */
export async function clearStoredSession(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(EXPIRY_KEY),
  ]);
}

/**
 * How long until the absolute deadline, in hours, or null if unknown.
 *
 * Used only to decide whether to show the "you'll need to sign in again"
 * banner. Returns null for a missing or unparseable value rather than guessing,
 * so a bad string means no banner instead of a wrong one.
 */
export function hoursUntilExpiry(expiresAt: string, now: number): number | null {
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) return null;
  return (deadline - now) / 3_600_000;
}
