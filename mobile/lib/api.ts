/**
 * The one place the app talks to the server.
 *
 * Everything goes through `request()`. That is worth insisting on for three
 * reasons, each of which would otherwise be re-litigated per screen:
 *
 *  1. **The bearer token is attached in exactly one function.** The token lives
 *     in the platform keychain and is read through an injected getter, so no
 *     screen imports the secure store and no screen can forget the header.
 *  2. **A 401 is handled once.** Sessions here are 7-day absolute and 24-hour
 *     idle with no refresh, so expiry is routine rather than exceptional. One
 *     listener raises one sheet; fifty call sites do not each invent a redirect.
 *  3. **No response is ever written to disk from here.** Persistence is opt-in
 *     and lives in content.ts, which handles the only two public payloads. See
 *     the cache policy note below — it is a security property, not a style
 *     preference.
 *
 * ## Finding the server in development
 *
 * `localhost` means the phone, not the laptop, so a device cannot reach a dev
 * server that way. Rather than making everyone hand-edit an IP address, the base
 * URL is derived from Expo's own manifest: Metro is already being served from
 * the laptop's LAN address, so that host with port 3300 is the Next.js dev
 * server. `EXPO_PUBLIC_API_URL` overrides it for a staging or production build.
 *
 * That derivation holds only while Metro is on the LAN. Under `expo start
 * --tunnel` the manifest host is an `exp.direct` forwarder that carries Metro's
 * port and nothing else, so `<tunnel host>:3300` is a machine that exists and a
 * port that was never forwarded — the request hangs until it times out and the
 * app shows "Couldn't load the app" with no hint as to why. A tunnel is
 * therefore treated as an unresolvable case and says so, rather than producing a
 * URL that is syntactically fine and functionally dead.
 */

import Constants from 'expo-constants';

/** The Next.js dev server port, from oxvercity/package.json's `dev` script. */
const DEV_API_PORT = 3300;

/** Hosts belonging to a dev tunnel rather than to the machine running the API. */
const TUNNEL_HOSTS = ['.exp.direct', '.ngrok.io', '.ngrok-free.app', '.ngrok.app'];

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (explicit) return explicit;

  // "192.168.1.5:8081" or "100.115.92.197:8081" — whatever host Metro is on.
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];

    if (host && TUNNEL_HOSTS.some((suffix) => host.endsWith(suffix))) {
      throw new Error(
        `Metro is on a tunnel (${host}), which forwards its own port only — the API on ` +
          `port ${DEV_API_PORT} is not reachable through it. Start a second tunnel for the ` +
          'Next.js dev server and set EXPO_PUBLIC_API_URL to its https URL before running ' +
          '`npm run start:tunnel`.',
      );
    }

    if (host) return `http://${host}:${DEV_API_PORT}`;
  }

  // Web: hostUri is not provided the same way. Use the browser's own hostname,
  // which is the same machine running the Next.js dev server.
  if (__DEV__ && typeof window !== 'undefined' && window.location) {
    return `http://${window.location.hostname}:${DEV_API_PORT}`;
  }

  throw new Error(
    'No API URL. Set EXPO_PUBLIC_API_URL (e.g. https://sxccaa.org) — a release build cannot guess one.',
  );
}

let baseUrl: string | undefined;

export function apiBaseUrl(): string {
  if (!baseUrl) baseUrl = resolveBaseUrl();
  return baseUrl;
}

// --- token plumbing -----------------------------------------------------------

/**
 * How `request()` obtains the session token.
 *
 * Injected rather than imported so this module has no dependency on the
 * keychain, which keeps it testable and keeps the number of places that touch
 * the token at one. Phase 2 registers a getter backed by expo-secure-store;
 * until then it returns null and every authenticated route answers 401, which
 * is the correct behaviour for an app with no sign-in screen yet.
 */
type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter = async () => null;

export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

/** Notified when the server says the session is gone. Phase 2 raises the sheet. */
type ExpiryListener = () => void;

let onExpired: ExpiryListener = () => {};

export function setExpiryListener(listener: ExpiryListener): void {
  onExpired = listener;
}

// --- errors -------------------------------------------------------------------

/**
 * A failure the app can branch on.
 *
 * `code` is the server's stable machine code from app-api.ts (`unauthenticated`,
 * `not_found`, `rate_limited`, …). `message` is the server's sentence and is
 * safe to show a user — the server is careful never to say more in a message
 * than the code already admits, so displaying it cannot leak anything.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when retrying the identical request might work. Guides the retry affordance. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Thrown when the device has no usable connection. Distinct from a server error. */
export class OfflineError extends ApiError {
  constructor() {
    super(0, 'offline', 'No connection. Check your network and try again.');
    this.name = 'OfflineError';
  }
}

// --- the request --------------------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. Use `form` for multipart uploads instead. */
  body?: unknown;
  form?: FormData;
  /** Omit the Authorization header even if a token exists. For the auth routes. */
  anonymous?: boolean;
  /** Extra headers. Cannot override Authorization. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, anonymous = false, headers = {}, signal, timeoutMs } = options;

  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };

  if (!anonymous) {
    const token = await getToken();
    // Set last so a caller-supplied header cannot shadow it.
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (form) {
    // Deliberately no Content-Type: the runtime must set it, because only it
    // knows the multipart boundary. Setting it by hand is the classic way to
    // make every upload fail with an unhelpful parse error.
    payload = form;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  /*
   * A timeout combined with the caller's own signal. Without one, a request on a
   * flaky mobile connection hangs until the OS gives up — which can be a minute
   * of a spinner the user reads as "broken".
   */
  const timeout = AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: payload,
      signal: composed,
      // No cookies, ever. The bearer token is the only credential, and that is
      // what makes these routes structurally immune to CSRF — see app-auth.ts.
      credentials: 'omit',
    });
  } catch (error) {
    // A caller-initiated abort is not a network failure; let it propagate so a
    // screen that navigated away does not show an error.
    if (signal?.aborted) throw error;
    throw new OfflineError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const shape = (parsed ?? {}) as { error?: string; message?: string };
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);

    /*
     * 401 fires the listener before throwing, so the sheet is already rising as
     * the call site handles its own failure. The token is not cleared here —
     * that is the session layer's job in phase 2, and doing it in two places
     * invites a race where one clears while the other is still reading.
     */
    if (response.status === 401) onExpired();

    throw new ApiError(
      response.status,
      shape.error ?? 'unknown',
      shape.message ?? 'Something went wrong. Please try again.',
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }

  return parsed as T;
}
