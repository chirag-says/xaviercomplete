/**
 * Who is signed in, for the whole app.
 *
 * One source of truth, established at launch and updated by exactly three
 * events: a successful sign-in, a sign-out, and the server saying 401.
 *
 * ## The 401 path is the interesting one
 *
 * Sessions here are 7-day absolute and 24-hour idle with no refresh. The idle
 * clock is what will actually bite — anyone who does not open the app for a day
 * is signed out — so expiry is routine, not exceptional, and it will usually
 * land *mid-task*: halfway through an event album, or with a half-typed profile
 * edit on screen.
 *
 * Throwing that person at a login screen loses their place and their work. So
 * `api.ts` calls one listener, registered here, which flips `expired` to true.
 * The shell renders a sheet over whatever is already on screen; the route
 * underneath is untouched, so dismissing or completing the sign-in returns the
 * user exactly where they were.
 *
 * One in-flight 401 raises one sheet. Five concurrent requests failing together
 * still raise one, because the flag is already set.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, request, setExpiryListener, setTokenGetter } from './api';
import { clearContentCache } from './content';
import { clearStoredSession, readStoredSession, storeSession } from './session';

/** `GET /api/app/v1/me`. */
export interface Me {
  signedIn: boolean;
  alumniId: string | null;
  name: string | null;
  initials: string;
  photoUrl: string | null;
  hasRecord: boolean;
  isVisible: boolean | null;
  unreadCount: number;
}

interface AuthState {
  /** Null until the first `/me` resolves; then the answer. */
  me: Me | null;
  /** True while the launch check is in flight. */
  loading: boolean;
  /** True when the server has said 401 and the sheet should be up. */
  expired: boolean;
  /** Absolute deadline of the current session, ISO 8601, or null. */
  expiresAt: string | null;
  signIn: (token: string, expiresAt: string) => Promise<void>;
  signOut: (scope?: 'device' | 'everywhere') => Promise<void>;
  /** Re-read `/me`, e.g. after editing a profile. */
  refresh: () => Promise<void>;
  dismissExpired: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const SIGNED_OUT: Me = {
  signedIn: false,
  alumniId: null,
  name: null,
  initials: '',
  photoUrl: null,
  hasRecord: false,
  isVisible: null,
  unreadCount: 0,
};

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  /*
   * The token is held in a ref, not state.
   *
   * `api.ts` reads it through a getter on every request, and a getter closing
   * over state would capture whatever value existed when the effect last ran —
   * so the first request after signing in would go out with the old token. A ref
   * is always current.
   */
  const token = useRef<string | null>(null);

  // Registered once, before anything can fire them.
  useEffect(() => {
    setTokenGetter(async () => token.current);
    setExpiryListener(() => {
      // Only meaningful if we thought we were signed in. A 401 while signed out
      // is an ordinary answer, not an expiry.
      if (token.current) setExpired(true);
    });
  }, []);

  const loadMe = useCallback(async (): Promise<Me> => {
    const fetched = await request<Me>('/api/app/v1/me');
    setMe(fetched);
    return fetched;
  }, []);

  // Launch: restore the token, then ask the server whether it is still good.
  useEffect(() => {
    let alive = true;

    void (async () => {
      const stored = await readStoredSession();

      if (stored) {
        token.current = stored.token;
        if (alive) setExpiresAt(stored.expiresAt || null);
      }

      try {
        const fetched = await loadMe();
        /*
         * A stored token the server no longer honours. Cleared here rather than
         * left to the 401 listener: at launch there is no work to preserve and
         * no sheet worth showing — the right outcome is simply "signed out".
         */
        if (!fetched.signedIn && token.current) {
          token.current = null;
          await clearStoredSession();
          if (alive) setExpiresAt(null);
        }
      } catch {
        /*
         * Offline at launch. Not the same as signed out — the token may be
         * perfectly good — so the token is kept and `me` is left null. Screens
         * that need identity retry; the rest of the app works from cache.
         */
        if (alive) setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadMe]);

  /**
   * Order matters here, and it is the opposite of the obvious one.
   *
   * The token is adopted in memory *first*, and persistence is allowed to fail.
   * The sign-in code that produced this token is single-use and has already been
   * spent server-side, so treating a keystore failure as a failed sign-in would
   * throw away a valid session and the one-time code together — leaving the user
   * at a login screen where their code no longer works.
   *
   * `persisted: false` means "signed in, but you will have to do this again next
   * launch", which is a far better outcome than "signed in nowhere".
   */
  const signIn = useCallback(
    async (newToken: string, newExpiresAt: string) => {
      token.current = newToken;
      setExpired(false);
      setExpiresAt(newExpiresAt);

      const persisted = await storeSession({ token: newToken, expiresAt: newExpiresAt });
      if (!persisted) {
        console.warn('[auth] session could not be saved to the keystore; it will not survive a restart.');
      }

      await loadMe();
    },
    [loadMe],
  );

  const signOut = useCallback(async (scope: 'device' | 'everywhere' = 'device') => {
    /*
     * Told to the server first, while the token still works — but its failure
     * is not allowed to block the local clear. If the network is down, the user
     * still gets signed out on this device, which is what they asked for. The
     * server-side session then expires on its own clocks.
     */
    try {
      await request<void>('/api/app/v1/auth/logout', {
        method: 'POST',
        body: scope === 'everywhere' ? { scope: 'everywhere' } : {},
      });
    } catch {
      // Deliberately ignored. See above.
    }

    token.current = null;
    setExpired(false);
    setExpiresAt(null);
    setMe(SIGNED_OUT);
    await clearStoredSession();

    /*
     * The content bundle is public website copy, so it is not a leak — but a
     * shared or handed-on phone should not open to the previous user's cached
     * state at all. Cheap to re-fetch; clear it.
     */
    clearContentCache();
  }, []);

  const refresh = useCallback(async () => {
    try {
      await loadMe();
    } catch (error) {
      // A 401 has already fired the listener; anything else is transient and
      // must not clobber a good `me` with an error state.
      if (!(error instanceof ApiError) || error.status !== 401) return;
    }
  }, [loadMe]);

  const dismissExpired = useCallback(() => {
    setExpired(false);
    token.current = null;
    setExpiresAt(null);
    setMe(SIGNED_OUT);
    void clearStoredSession();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ me, loading, expired, expiresAt, signIn, signOut, refresh, dismissExpired }),
    [me, loading, expired, expiresAt, signIn, signOut, refresh, dismissExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>.');
  return state;
}
