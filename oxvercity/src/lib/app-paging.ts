/**
 * Cursors and page sizes for the app's list endpoints.
 *
 * Kept free of Next imports — `next/server` will not load outside a Next build,
 * and these are the parts worth driving directly from `npm run app:verify`. The
 * same split as session.ts / session-cookie.ts. app-api.ts re-exports them so
 * route files have one import.
 */

/**
 * Keyset cursors, opaque to the client.
 *
 * Base64url JSON rather than an offset. `limit/offset` over a list people are
 * inserted into shows duplicates and skips rows as the underlying order shifts
 * beneath the reader, which on a phone reads as a buggy list. A keyset cursor
 * names the last row seen, so paging stays stable regardless of what changed
 * behind it.
 *
 * Opaque because it is not a promise. The app treats it as a token to hand back,
 * never a structure to construct, so its shape can change without stranding
 * installed clients.
 */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/**
 * Decode a cursor, or start from the beginning.
 *
 * A malformed, truncated or stale cursor returns null rather than raising. An
 * old app version paging with last release's cursor shape should quietly get
 * page one, not an error it has no code path for. The cost is that a genuine
 * client bug looks like a reset rather than a failure — which is the better way
 * round for something a user is looking at.
 *
 * Arrays are rejected along with primitives: `JSON.parse('[1,2]')` is an object
 * to `typeof`, and letting one through would hand a caller-shaped array to code
 * expecting named keys.
 */
export function decodeCursor<T extends Record<string, unknown>>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * A page size the client may lower but not raise.
 *
 * `?limit=` is attacker-controlled. An unbounded one turns a paginated endpoint
 * back into the "select the whole directory in one query" behaviour that
 * pagination exists to replace — so `max` is a ceiling, not a suggestion.
 *
 * Anything unparseable, zero, negative or fractional falls back rather than
 * erroring: a bad query string should not fail a read.
 */
export function pageLimit(raw: string | null | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}
