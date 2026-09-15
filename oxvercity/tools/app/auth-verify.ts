/**
 * Prove the app's sign-in flow, end to end, against a real server and database.
 *
 *   npm run app:auth-verify      (needs `npm run dev` running)
 *
 * Phase 2 of IMPLEMENTATION-PLAN-Mobile-App.md. The unit tests cover the pure
 * functions and `auth:verify` covers the website's flow; this covers the things
 * only a live HTTP round trip can answer about the *app's* routes.
 *
 * Four properties matter more than the rest:
 *
 *  1. **The app routes work with no Origin header.** React Native sends neither
 *     Origin nor Referer. If `isSameOrigin` were ever added to `/api/app/v1`,
 *     every request from a phone would 403 — and it would pass every test that
 *     used a browser-shaped request. So these checks send no Origin at all.
 *
 *  2. **The website routes still refuse without one.** The same run asserts the
 *     opposite for `/api/auth/request`, so "we relaxed CSRF for the app" cannot
 *     quietly become "we relaxed CSRF".
 *
 *  3. **The response is neutral, in body and in status.** A registered address,
 *     an unregistered one and a malformed one must be indistinguishable.
 *     Otherwise the login screen is a membership oracle.
 *
 *  4. **Verify returns a token and sets no cookie.** The app carries a bearer;
 *     a Set-Cookie here would mean a second, ambient credential exists — which
 *     is exactly what the CSRF argument depends on not existing.
 *
 * As with `auth:verify`, this cannot read a code out of the database — only the
 * SHA-256 is stored. It plants rows with a code it already knows, which is the
 * same thing from the application's point of view.
 */

import { createHash } from 'node:crypto';

import { connect, type Sql } from '../../src/lib/db.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';

const BASE = (process.env.APP_VERIFY_URL ?? 'http://localhost:3300').replace(/\/+$/, '');
const API = `${BASE}/api/app/v1`;

/** On the allowlist for the duration of this run, then removed. */
const REGISTERED = 'app-auth-verify@example.org';
/** Never granted access. Must be indistinguishable from the above. */
const STRANGER = 'app-auth-nobody@example.org';

const CODE = '424242';
const hashCode = (code: string) => createHash('sha256').update(code, 'utf8').digest();

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

function section(title: string): void {
  process.stdout.write(`\n${title}\n`);
}

/**
 * Every request in this file goes through here, and it sends **no Origin and no
 * Referer** — the shape React Native actually produces.
 */
async function api(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers; text: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* left empty */
  }
  return { status: response.status, json, headers: response.headers, text };
}

async function plantCode(owner: Sql, email: string, options: { expired?: boolean; attempts?: number } = {}) {
  const hmac = blindIndexOfNormalised(email);
  await owner`delete from login_token where email_hmac = ${hmac}`;
  await owner`
    insert into login_token (otp_hash, email_hmac, expires_at, otp_attempts)
    values (
      ${hashCode(CODE)},
      ${hmac},
      now() + ${options.expired ? '-1 minute' : '10 minutes'}::interval,
      ${options.attempts ?? 0}
    )
  `;
}

async function clean(owner: Sql): Promise<void> {
  const registered = blindIndexOfNormalised(REGISTERED);
  const stranger = blindIndexOfNormalised(STRANGER);
  await owner`delete from login_token where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from session where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from access_grant where email_hmac in (${registered}, ${stranger})`;
  await owner`delete from rate_limit where bucket like 'login%'`;
}

// --- checks -------------------------------------------------------------------

async function checkNeutralRequest(): Promise<void> {
  section('POST /auth/request — nothing distinguishes a member from a stranger');

  const registered = await api('/auth/request', { method: 'POST', body: { email: REGISTERED } });
  const stranger = await api('/auth/request', { method: 'POST', body: { email: STRANGER } });
  const malformed = await api('/auth/request', { method: 'POST', body: { email: 'not-an-address' } });

  report(registered.status === 200, 'a registered address gets 200', `got ${registered.status}`);
  report(stranger.status === 200, 'an unregistered address gets 200', `got ${stranger.status}`);
  report(malformed.status === 200, 'a malformed address gets 200 too', `got ${malformed.status}`);

  report(
    registered.text === stranger.text && stranger.text === malformed.text,
    'all three responses are byte-identical',
  );
  report(
    !/registered|unknown|not found|no account/i.test(registered.text.replace(/If that address is registered/i, '')),
    'the message admits nothing beyond the neutral line',
  );

  // The app's own rule: a 200 always advances to the code step.
  report(registered.status === 200 && stranger.status === 200, 'so the app advances for both — no client-side oracle');
}

async function checkOriginPolicy(): Promise<void> {
  section('CSRF: relaxed for the app, unchanged for the website');

  // Already proven implicitly by every call above, but asserted explicitly so a
  // failure names the right cause.
  const noOrigin = await api('/auth/request', { method: 'POST', body: { email: STRANGER } });
  report(noOrigin.status === 200, 'an app POST with no Origin header is accepted');

  const website = await fetch(`${BASE}/api/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STRANGER }),
  });
  await website.text();
  report(
    website.status === 403,
    'the WEBSITE route still refuses a POST with no Origin',
    `got ${website.status} — if this is 200, CSRF protection was removed from the site`,
  );

  const wrongOrigin = await fetch(`${BASE}/api/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ email: STRANGER }),
  });
  await wrongOrigin.text();
  report(wrongOrigin.status === 403, 'the website route still refuses a foreign Origin');
}

async function checkVerify(owner: Sql): Promise<string> {
  section('POST /auth/verify — one failure for everything, a token on success');

  await plantCode(owner, REGISTERED);

  const wrongCode = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: '999999' } });
  const unknownAddress = await api('/auth/verify', { method: 'POST', body: { email: STRANGER, code: CODE } });

  report(wrongCode.status === 400, 'a wrong code is refused', `got ${wrongCode.status}`);
  report(unknownAddress.status === 400, 'an unknown address is refused');
  report(
    wrongCode.text === unknownAddress.text,
    'and both say exactly the same thing — otherwise the form tells you who is a member',
  );
  report(wrongCode.json.error === 'invalid', 'the machine code is the same for both');

  // A fresh row: the wrong guess above spent an attempt.
  await plantCode(owner, REGISTERED);

  const ok = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  report(ok.status === 200, 'the right code signs in', `got ${ok.status} ${ok.text.slice(0, 120)}`);
  report(typeof ok.json.token === 'string' && (ok.json.token as string).length >= 20, 'a session token comes back');
  report(typeof ok.json.expiresAt === 'string', 'with the absolute deadline, so the app can warn before it lands');
  report(
    Number.isFinite(Date.parse(String(ok.json.expiresAt))),
    'and the deadline parses as a date',
  );

  /*
   * The property the CSRF argument rests on: this endpoint issues a bearer
   * token and nothing ambient. A Set-Cookie here would mean a credential the
   * platform attaches by itself, which is what CSRF needs.
   */
  report(ok.headers.get('set-cookie') === null, 'NO cookie is set — the app carries a bearer, not an ambient credential');
  report(
    (ok.headers.get('cache-control') ?? '').includes('no-store'),
    'the token response is no-store',
  );

  // Codes are single use, enforced in SQL.
  const replay = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  report(replay.status === 400, 'the same code cannot be used twice');

  await plantCode(owner, REGISTERED, { expired: true });
  const expired = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  report(expired.status === 400, 'an expired code is refused');
  report(expired.text === wrongCode.text, 'and is indistinguishable from a wrong one');

  await plantCode(owner, REGISTERED, { attempts: 5 });
  const exhausted = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  report(exhausted.status === 400, 'a code with five failed attempts is refused');
  report(
    exhausted.text === wrongCode.text,
    'and says the same thing — "too many attempts" would confirm the address is registered',
  );

  return String(ok.json.token);
}

async function checkMe(token: string): Promise<void> {
  section('GET /me — the launch check');

  const anon = await api('/me');
  report(anon.status === 200, 'answers 200 when nobody is signed in, not 401', `got ${anon.status}`);
  report(anon.json.signedIn === false, 'and says so plainly');
  report(
    Object.keys(anon.json).length === 1,
    'a signed-out answer carries nothing else',
    `got ${JSON.stringify(anon.json)}`,
  );

  const mine = await api('/me', { token });
  report(mine.status === 200, 'a bearer token is accepted');
  report(mine.json.signedIn === true, 'and reports the session');
  report('unreadCount' in mine.json, 'carries unreadCount, so the badge needs no client release in phase 6');

  const junk = await api('/me', { token: 'ZZZZnotarealtokenZZZZ00000' });
  report(junk.json.signedIn === false, 'a token matching no row is simply not signed in');

  report(
    !/contact|gmail|phone|previous_role|other_info/i.test(mine.text),
    'no confidential field leaks into the cheap launch endpoint',
  );
}

async function checkLogout(owner: Sql): Promise<void> {
  section('POST /auth/logout');

  await plantCode(owner, REGISTERED);
  const first = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  const token = String(first.json.token);

  const out = await api('/auth/logout', { method: 'POST', token, body: {} });
  report(out.status === 204, 'answers 204', `got ${out.status}`);

  const after = await api('/me', { token });
  report(after.json.signedIn === false, 'and the token stops working immediately');

  const again = await api('/auth/logout', { method: 'POST', token, body: {} });
  report(again.status === 204, 'signing out twice is not an error — intent already satisfied');

  const nonsense = await api('/auth/logout', { method: 'POST', token: 'ZZZZnotarealtokenZZZZ00000', body: {} });
  report(nonsense.status === 204, 'nor is signing out with a token that was never valid');

  // "Everywhere" across two live sessions.
  await plantCode(owner, REGISTERED);
  const a = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });
  await plantCode(owner, REGISTERED);
  const b = await api('/auth/verify', { method: 'POST', body: { email: REGISTERED, code: CODE } });

  const tokenA = String(a.json.token);
  const tokenB = String(b.json.token);
  report(tokenA !== tokenB, 'two sign-ins produce two distinct sessions');

  await api('/auth/logout', { method: 'POST', token: tokenA, body: { scope: 'everywhere' } });

  const deadA = await api('/me', { token: tokenA });
  const deadB = await api('/me', { token: tokenB });
  report(deadA.json.signedIn === false, 'sign out everywhere kills the calling session');
  report(deadB.json.signedIn === false, 'and every other session for that identity');
}

async function checkEmbed(): Promise<void> {
  section('GET /embed/turnstile — the challenge WebView page');

  const response = await fetch(`${BASE}/embed/turnstile`);
  const html = await response.text();

  report(response.status === 200, 'is served', `got ${response.status}`);
  report(
    (response.headers.get('content-type') ?? '').includes('text/html'),
    'as HTML, not JSON',
  );
  report((response.headers.get('cache-control') ?? '').includes('no-store'), 'and is never cached — the nonce is per request');

  const nonces = html.match(/nonce="[A-Za-z0-9]+"/g) ?? [];
  report(nonces.length >= 1, 'its scripts carry the CSP nonce', `found ${nonces.length}`);
  report(
    html.includes('ReactNativeWebView'),
    'it posts its result back through the WebView bridge',
  );
  report(
    !/sxccaa|alumni|directory/i.test(html.replace(/Security check/gi, '')),
    'and carries no SXCCAA content — it is a challenge, not a page of the site',
  );

  /*
   * Whichever branch the server is in, the page must reach a conclusion. A
   * WebView that neither succeeds nor reports failure is indistinguishable from
   * a crash, and it is the one outcome with no way out for the user.
   */
  report(
    html.includes('not configured') || html.includes('cf-turnstile'),
    'it either renders the widget or says it cannot — never a blank page',
  );
}

// --- main ---------------------------------------------------------------------

async function main(): Promise<void> {
  process.stdout.write('\nApp API — phase 2 (authentication)\n');

  try {
    await fetch(`${API}/config`, { signal: AbortSignal.timeout(4000) });
  } catch {
    process.stdout.write(
      `\n  ! nothing answering at ${BASE}\n` +
        '      Start the server first:  npm run dev\n' +
        '      Or point elsewhere:      APP_VERIFY_URL=https://… npm run app:auth-verify\n\n',
    );
    process.exit(1);
  }

  const owner = connect(process.env.DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-appauthverify' });

  try {
    await clean(owner);

    // On the allowlist for this run only. `source` is constrained to
    // ('import','admin_grant') by 0001_schema.sql.
    await owner`
      insert into access_grant (email_hmac, source)
      values (${blindIndexOfNormalised(REGISTERED)}, 'import')
    `;

    await checkNeutralRequest();
    await checkOriginPolicy();
    const token = await checkVerify(owner);
    await checkMe(token);
    await checkLogout(owner);
    await checkEmbed();
  } finally {
    await clean(owner).catch(() => {});
    await owner.end({ timeout: 5 });
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed\n\n`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
