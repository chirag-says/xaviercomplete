/**
 * The content bundle, and the only server response the app writes to disk.
 *
 * ## The cache policy this file enforces
 *
 * The plan divides everything the app fetches into two tiers, and the division
 * is a security property rather than a performance one:
 *
 *   **Tier A — may persist.** The content bundle and the app config. Public
 *   website copy, identical for every caller, no authentication required to
 *   obtain it. Handled here.
 *
 *   **Tier B — memory only.** Directory rows, profile detail, contact numbers,
 *   Gmail addresses, previous employment, photographs, notification bodies.
 *   Never written to disk, in any form, for any reason.
 *
 * The test is simple: *did fetching this need a bearer token?* If yes, it does
 * not touch the filesystem. A lost or stolen phone must not be an offline copy
 * of five hundred alumni's telephone numbers, and the only way to guarantee that
 * is for no code path to exist. Hence this module is small, is the only one that
 * imports expo-file-system, and refuses to take a token.
 *
 * Phase 8 asserts it from the outside: sign in, open a profile with a visible
 * contact number, background the app, then grep the entire sandbox for that
 * number. Finding it fails the build.
 *
 * ## Stale-while-revalidate, because a cold launch should not be a spinner
 *
 * `readContent()` returns the cached bundle immediately if there is one, so the
 * app draws real content on the first frame even with no connection.
 * `refreshContent()` then revalidates with `If-None-Match`; the server answers
 * 304 in the overwhelmingly common case and nothing is rewritten.
 */

import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { apiBaseUrl, OfflineError } from './api';
import type { AppConfig, Content } from './content-types';

/**
 * `Paths.document`, not `Paths.cache`.
 *
 * The bundle is what makes the app work offline, and the OS may evict the cache
 * directory under storage pressure at any time — which would leave a user on a
 * plane with an empty app. Documents survive. This is the one payload that earns
 * that, because it is public and small.
 */
const IS_WEB = Platform.OS === 'web';

const DIRECTORY_NAME = 'content';
const BODY_FILE = 'bundle.json';
const ETAG_FILE = 'bundle.etag';

function directory(): Directory {
  return new Directory(Paths.document, DIRECTORY_NAME);
}

function ensureDirectory(): Directory {
  const dir = directory();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

interface Cached {
  content: Content;
  etag: string | null;
}

function readCache(): Cached | null {
  if (IS_WEB) return null; // expo-file-system is not supported on web
  try {
    const body = new File(directory(), BODY_FILE);
    if (!body.exists) return null;

    const content = JSON.parse(body.textSync()) as Content;

    const etagFile = new File(directory(), ETAG_FILE);
    const etag = etagFile.exists ? etagFile.textSync().trim() || null : null;

    return { content, etag };
  } catch {
    /*
     * A truncated write (killed mid-save) or a bundle from an incompatible
     * release both land here. Discarding and re-fetching is always recoverable;
     * throwing would brick the app until reinstall, which is not a trade worth
     * making to surface a corrupt cache.
     */
    clearContentCache();
    return null;
  }
}

function writeCache(body: string, etag: string | null): void {
  if (IS_WEB) return; // expo-file-system is not supported on web
  try {
    const dir = ensureDirectory();
    new File(dir, BODY_FILE).write(body);
    if (etag) new File(dir, ETAG_FILE).write(etag);
  } catch {
    // A failed write is not a failed launch. The app has the content in memory;
    // it simply will not have it offline next time.
  }
}

/** Called on sign-out alongside the token wipe, and on a corrupt read. */
export function clearContentCache(): void {
  if (IS_WEB) return; // expo-file-system is not supported on web
  try {
    const dir = directory();
    if (dir.exists) dir.delete();
  } catch {
    // Nothing useful to do, and nothing sensitive was in here anyway.
  }
}

// --- network ------------------------------------------------------------------

/**
 * Fetched directly rather than through `request()`, because this is the one
 * endpoint that cares about ETags, 304s and the raw body text. Routing it
 * through the JSON helper would mean teaching that helper about conditional
 * requests it will never otherwise make.
 *
 * `credentials: 'omit'` and no Authorization header: asking anonymously is what
 * proves this response cannot be user-specific, which is what makes it
 * cacheable in the first place.
 */
async function fetchBundle(etag: string | null): Promise<{ body: string; etag: string | null } | 'unchanged'> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (etag) headers['If-None-Match'] = etag;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/app/v1/content`, {
      headers,
      credentials: 'omit',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new OfflineError();
  }

  if (response.status === 304) return 'unchanged';
  if (!response.ok) {
    throw new Error(`Content unavailable (${response.status}).`);
  }

  return { body: await response.text(), etag: response.headers.get('etag') };
}

// --- public API ---------------------------------------------------------------

let memo: Content | undefined;

/**
 * The bundle, from memory, then disk, then the network.
 *
 * Throws only when all three fail — a first launch with no connection, which is
 * a genuine dead end the app must show as an error with a retry rather than an
 * empty screen.
 */
export async function readContent(): Promise<Content> {
  if (memo) return memo;

  const cached = readCache();
  if (cached) {
    memo = cached.content;
    return cached.content;
  }

  const fetched = await fetchBundle(null);
  if (fetched === 'unchanged') {
    // Only reachable if the server 304s a request that carried no ETag, which
    // would be a server bug. Treat it as no content rather than cache 'null'.
    throw new Error('Content unavailable.');
  }

  const content = JSON.parse(fetched.body) as Content;
  writeCache(fetched.body, fetched.etag);
  memo = content;
  return content;
}

/**
 * Revalidate in the background.
 *
 * Returns the new bundle when the server sent one, or null when nothing changed
 * or the network was unavailable. Callers fire this without awaiting and update
 * state if something comes back — a copy edit deployed this morning reaches the
 * user on this launch, without the launch waiting on it.
 *
 * It never throws. A failed revalidation is not an error the user needs to see;
 * they already have content on screen.
 */
export async function refreshContent(): Promise<Content | null> {
  try {
    const cached = readCache();
    const fetched = await fetchBundle(cached?.etag ?? null);
    if (fetched === 'unchanged') return null;

    const content = JSON.parse(fetched.body) as Content;
    writeCache(fetched.body, fetched.etag);
    memo = content;
    return content;
  } catch {
    return null;
  }
}

/**
 * The app config.
 *
 * Deliberately **not** cached to disk. It carries `minSupportedVersion`, which
 * exists to stop a broken build talking to the server — a stale cached copy
 * saying "0.0.0" would defeat the one lever we have over an app already in
 * someone's pocket. It is a few hundred bytes; fetch it.
 *
 * Returns null rather than throwing when unreachable. The app then proceeds
 * without a version gate, which is the right failure direction: a config
 * endpoint being briefly down must not lock people out of an app that works.
 */
export async function readConfig(): Promise<AppConfig | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/app/v1/config`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as AppConfig;
  } catch {
    return null;
  }
}
