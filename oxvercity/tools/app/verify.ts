/**
 * Prove the mobile API's foundations, against the real database and a real server.
 *
 *   npm run app:verify
 *
 * Phase 0 of IMPLEMENTATION-PLAN-Mobile-App.md. Three things are worth asserting
 * here rather than trusting:
 *
 *  1. **A bearer token resolves to the same session a cookie would.** If it did
 *     not, the app would be running a second, quieter authentication path — and
 *     the whole argument for reusing the website's session model would be a
 *     claim rather than a fact.
 *
 *  2. **A cookie alone resolves to nothing.** This is the load-bearing one.
 *     `/api/app/v1/**` omits the origin check that every website POST performs,
 *     and the only reason that is safe is that these routes read no ambient
 *     credential — so a third-party page cannot make a client send one. The
 *     moment `app-auth.ts` learns to read a cookie, every app route silently
 *     becomes CSRF-able. This check is what would catch that.
 *
 *  3. **The content bundle carries no synthetic alumni.** src/data/alumni.ts
 *     exports twelve invented records beside the copy the app needs, and the
 *     content endpoint is publicly cacheable. A careless import would put fake
 *     people into a CDN.
 *
 * The pure and database checks need no server. The HTTP checks need `npm run
 * dev` (or APP_VERIFY_URL pointing somewhere else) and say so plainly rather
 * than passing by default — a verifier that goes green when it tested nothing is
 * worse than no verifier.
 */

import { connect, type Sql } from '../../src/lib/db.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';
import { appSessionFrom, bearerToken, resolveOwner } from '../../src/lib/app-auth.ts';
import { createSession, revokeSession } from '../../src/lib/session.ts';
import { decodeCursor, encodeCursor, pageLimit } from '../../src/lib/app-paging.ts';

const BASE = (process.env.APP_VERIFY_URL ?? 'http://localhost:3300').replace(/\/+$/, '');

/** A record this tool owns, so it can create and remove it without touching anyone real. */
const ALUMNI_ID = 'appverifyrec';
const ADDRESS = 'app-verify@example.org';

/** The three ids in src/data/alumni.ts. None may ever appear in a content response. */
const SYNTHETIC_IDS = ['h2p6s4c8nx3v', 'b7n4t8v2yz6h', 'c7h3v9k4sw2p'];

let passed = 0;
let failed = 0;
let skipped = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

function section(title: string): void {
  process.stdout.write(`\n${title}\n`);
}

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

// --- pure ---------------------------------------------------------------------

function checkBearerParsing(): void {
  section('Authorization parsing');

  report(bearerToken(headers({ authorization: 'Bearer abcdefghij0123456789' })) === 'abcdefghij0123456789', 'a well-formed Bearer header yields the token');

  report(bearerToken(headers({ authorization: 'bearer abcdefghij0123456789' })) === 'abcdefghij0123456789', 'the scheme is case-insensitive (RFC 7235)');

  report(
    bearerToken(headers({ authorization: 'Bearer    abcdefghij0123456789  ' })) === 'abcdefghij0123456789',
    'surrounding and separating whitespace is tolerated',
  );

  report(bearerToken(headers({})) === undefined, 'no Authorization header yields nothing');
  report(bearerToken(headers({ authorization: '' })) === undefined, 'an empty Authorization header yields nothing');
  report(bearerToken(headers({ authorization: 'Bearer' })) === undefined, 'a scheme with no token yields nothing');
  report(bearerToken(headers({ authorization: 'Bearer ' })) === undefined, 'a scheme with only space yields nothing');

  report(
    bearerToken(headers({ authorization: 'Basic YWxhZGRpbjpvcGVuc2VzYW1l' })) === undefined,
    'Basic auth is not mistaken for a bearer token',
  );

  report(
    bearerToken(headers({ authorization: 'Bearer ../../etc/passwd' })) === undefined,
    'a token outside the base64url alphabet is refused before it reaches the database',
  );

  report(bearerToken(headers({ authorization: 'Bearer short' })) === undefined, 'an implausibly short token is refused');

  report(
    bearerToken(headers({ authorization: `Bearer ${'a'.repeat(500)}` })) === undefined,
    'an implausibly long token is refused rather than hashed',
  );

  /*
   * The CSRF-safety property, at the parsing level. A cookie is attached by the
   * platform; an Authorization header is not. This function must never learn to
   * read the former.
   */
  report(
    bearerToken(headers({ cookie: '__Host-sxc_session=abcdefghij0123456789' })) === undefined,
    'a session cookie is NOT read as a bearer token',
  );
}

function checkPaging(): void {
  section('Cursors and page sizes');

  const round = decodeCursor<{ id: string; at: string }>(encodeCursor({ id: 'abc', at: '2026-09-12' }));
  report(round?.id === 'abc' && round?.at === '2026-09-12', 'a cursor round-trips');

  report(!encodeCursor({ id: 'abc' }).includes('='), 'cursors are base64url, unpadded — safe in a query string');
  report(decodeCursor(null) === null, 'a missing cursor means page one');
  report(decodeCursor('') === null, 'an empty cursor means page one');
  report(decodeCursor('!!!not base64!!!') === null, 'a malformed cursor means page one rather than an error');
  report(
    decodeCursor(Buffer.from('[1,2,3]', 'utf8').toString('base64url')) === null,
    'an array is refused — typeof would call it an object',
  );
  report(
    decodeCursor(Buffer.from('"a string"', 'utf8').toString('base64url')) === null,
    'a bare JSON primitive is refused',
  );
  report(decodeCursor(Buffer.from('null', 'utf8').toString('base64url')) === null, 'JSON null is refused');

  report(pageLimit(null, 30, 100) === 30, 'no limit given falls back');
  report(pageLimit('10', 30, 100) === 10, 'a client may ask for fewer');
  report(pageLimit('5000', 30, 100) === 100, 'a client may NOT ask for more than the ceiling');
  report(pageLimit('0', 30, 100) === 30, 'zero falls back');
  report(pageLimit('-5', 30, 100) === 30, 'a negative limit falls back');
  report(pageLimit('abc', 30, 100) === 30, 'an unparseable limit falls back');
}

// --- database -----------------------------------------------------------------

async function clean(owner: Sql): Promise<void> {
  const hmac = blindIndexOfNormalised(ADDRESS);
  await owner`delete from session where email_hmac = ${hmac}`;
  await owner`delete from alumni where id = ${ALUMNI_ID}`;
}

async function checkSessionResolution(owner: Sql, web: Sql): Promise<void> {
  section('Session resolution over Authorization: Bearer');

  const hmac = blindIndexOfNormalised(ADDRESS);
  const { token } = await createSession(hmac, 'app-verify', web);

  const viaBearer = await appSessionFrom(headers({ authorization: `Bearer ${token}` }), web);
  report(viaBearer !== null, 'a live session resolves from a bearer token');
  report(
    viaBearer !== null && Buffer.compare(viaBearer.emailHmac, hmac) === 0,
    'the resolved session carries the right identity',
  );

  /*
   * The property the whole `/api/app/v1` CSRF argument rests on. If this ever
   * fails, the origin check must go back on every app route in the same commit.
   */
  const viaCookie = await appSessionFrom(
    headers({ cookie: `__Host-sxc_session=${token}` }),
    web,
  );
  report(viaCookie === null, 'the SAME token in a cookie resolves to NOTHING — app routes read no ambient credential');

  report(
    (await appSessionFrom(headers({ authorization: 'Bearer ZZZZnotarealtokenZZZZ0000' }), web)) === null,
    'a well-shaped token that matches no row resolves to nothing',
  );
  report((await appSessionFrom(headers({}), web)) === null, 'no header at all resolves to nothing');

  await revokeSession(token, web);
  report(
    (await appSessionFrom(headers({ authorization: `Bearer ${token}` }), web)) === null,
    'a revoked session stops resolving immediately',
  );

  // The idle clock is enforced in readSession's WHERE clause; reach past it by
  // ageing last_seen_at rather than waiting a day.
  const { token: idle } = await createSession(hmac, 'app-verify', web);
  await owner`update session set last_seen_at = now() - interval '25 hours' where email_hmac = ${hmac} and revoked_at is null`;
  report(
    (await appSessionFrom(headers({ authorization: `Bearer ${idle}` }), web)) === null,
    'a session idle for over 24 hours no longer resolves',
  );

  const { token: stale } = await createSession(hmac, 'app-verify', web);
  await owner`update session set expires_at = now() - interval '1 minute' where email_hmac = ${hmac} and revoked_at is null`;
  report(
    (await appSessionFrom(headers({ authorization: `Bearer ${stale}` }), web)) === null,
    'a session past its 7-day absolute deadline no longer resolves',
  );

  await owner`delete from session where email_hmac = ${hmac}`;
}

async function checkOwnerResolution(owner: Sql, web: Sql): Promise<void> {
  section('Resolving the caller to their own record');

  const hmac = blindIndexOfNormalised(ADDRESS);
  const session = { id: 'irrelevant', emailHmac: hmac };

  report((await resolveOwner(session, web)) === null, 'a session with no directory record resolves to null, not an error');

  await owner`
    insert into alumni (id, full_name, batch_year, gmail_hmac, is_visible)
    values (${ALUMNI_ID}, 'App Verify', 2001, ${hmac}, true)
  `;

  const found = await resolveOwner(session, web);
  report(found?.alumniId === ALUMNI_ID, 'the caller resolves to their own alumni id');
  report(found?.isVisible === true, 'visibility is reported');

  /*
   * An alumnus who withdraws their record still owns it. Filtering on
   * `is_visible` here would lock them out of the very switch they just flipped,
   * with no way back.
   */
  await owner`update alumni set is_visible = false where id = ${ALUMNI_ID}`;
  const withdrawn = await resolveOwner(session, web);
  report(withdrawn?.alumniId === ALUMNI_ID, 'a withdrawn record still resolves for its owner');
  report(withdrawn?.isVisible === false, 'and is reported as not visible');

  await owner`delete from alumni where id = ${ALUMNI_ID}`;
}

// --- HTTP ---------------------------------------------------------------------

async function reachable(): Promise<boolean> {
  try {
    await fetch(`${BASE}/api/app/v1/config`, { signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

async function checkConfig(): Promise<void> {
  section(`GET /api/app/v1/config  (${BASE})`);

  const response = await fetch(`${BASE}/api/app/v1/config`);
  report(response.status === 200, 'responds 200', `got ${response.status}`);

  const body = (await response.json()) as {
    minSupportedVersion?: unknown;
    turnstile?: { required?: unknown; siteKey?: unknown; embedUrl?: unknown };
    features?: Record<string, unknown>;
  };

  report(typeof body.minSupportedVersion === 'string', 'carries minSupportedVersion — the force-upgrade lever');
  report(/^\d+\.\d+\.\d+$/.test(String(body.minSupportedVersion)), 'minSupportedVersion is a three-part version');
  report(typeof body.turnstile?.required === 'boolean', 'says whether a Turnstile challenge is required');
  report(
    body.turnstile?.siteKey === null || typeof body.turnstile?.siteKey === 'string',
    'carries the Turnstile site key, or null',
  );
  report(
    body.turnstile?.embedUrl === null || String(body.turnstile?.embedUrl).endsWith('/embed/turnstile'),
    'points at the challenge page, or null when APP_URL is unset',
  );
  report(body.features?.connections === false, 'the removed connections feature is flagged off');
  report(
    (response.headers.get('cache-control') ?? '').includes('public'),
    'is publicly cacheable — identical for every caller',
  );

  const raw = JSON.stringify(body);
  report(!/secret|password|service_role|DATABASE_URL/i.test(raw), 'leaks no secret-shaped key');
}

async function checkContent(): Promise<void> {
  section(`GET /api/app/v1/content  (${BASE})`);

  const response = await fetch(`${BASE}/api/app/v1/content`);
  report(response.status === 200, 'responds 200', `got ${response.status}`);

  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
    report(true, 'returns valid JSON');
  } catch {
    report(false, 'returns valid JSON');
  }

  for (const key of ['site', 'nav', 'home', 'about', 'events', 'chapters', 'explore', 'contact', 'directory', 'search']) {
    report(key in body, `carries the "${key}" section`);
  }

  const nav = body.nav as { main?: unknown[]; mobile?: unknown[]; footerColumns?: unknown[] } | undefined;
  report((nav?.main?.length ?? 0) >= 5, 'the main navigation survived serialisation');
  report((nav?.mobile?.length ?? 0) >= 5, 'the mobile menu survived serialisation');
  report((nav?.footerColumns?.length ?? 0) >= 1, 'the footer columns survived serialisation');

  const events = body.events as { all?: unknown[] } | undefined;
  report((events?.all?.length ?? 0) >= 1, 'the event list survived serialisation');

  // The reason this endpoint gets a verifier at all.
  section('The content bundle carries no synthetic alumni');
  for (const id of SYNTHETIC_IDS) {
    report(!text.includes(id), `no demo record id ${id}`);
  }
  report(!text.includes('example.org'), 'no example.org address');
  report(!text.includes('7700 900'), 'no drama-range telephone number');
  report(!/"contact_enc"|"gmail_enc"|"other_info_enc"/.test(text), 'no encrypted column name');

  section('Caching and revalidation');
  report(
    (response.headers.get('cache-control') ?? '').includes('public'),
    'is publicly cacheable — every byte is already public on the website',
  );

  /*
   * The safety property behind `decidesOwnCaching` using `===` rather than
   * `startsWith('/api/app/v1')`. Every other route in this namespace varies by
   * caller, so a prefix match would put one alumnus's profile in a shared
   * cache. Asserted against a path that does not exist yet — a 404 still passes
   * through the middleware — so the guarantee is locked in before the per-user
   * routes arrive in phase 4.
   */
  const perUser = await fetch(`${BASE}/api/app/v1/me`);
  report(
    (perUser.headers.get('cache-control') ?? '').includes('no-store'),
    'a per-user app path is NOT publicly cacheable, even before it exists',
  );
  await perUser.arrayBuffer();

  const etag = response.headers.get('etag');
  report(Boolean(etag), 'sets an ETag');
  report(Boolean(etag && /^"[0-9a-f]{32}"$/.test(etag)), 'the ETag is a strong, quoted content hash');

  const second = await fetch(`${BASE}/api/app/v1/content`);
  report(second.headers.get('etag') === etag, 'the ETag is stable across requests — no timestamp in the hash');
  await second.arrayBuffer();

  const revalidated = await fetch(`${BASE}/api/app/v1/content`, { headers: { 'If-None-Match': etag ?? '' } });
  report(revalidated.status === 304, 'a matching If-None-Match gets 304', `got ${revalidated.status}`);
  report((await revalidated.text()).length === 0, '304 carries no body — the point of the exercise');

  const weak = await fetch(`${BASE}/api/app/v1/content`, { headers: { 'If-None-Match': `W/${etag}` } });
  report(weak.status === 304, 'a proxy-weakened ETag still revalidates');
  await weak.text();

  const changed = await fetch(`${BASE}/api/app/v1/content`, { headers: { 'If-None-Match': '"0123456789abcdef0123456789abcdef"' } });
  report(changed.status === 200, 'a stale ETag gets the whole bundle');
  await changed.arrayBuffer();
}

async function checkEnquiry(): Promise<void> {
  section(`POST /api/app/v1/enquiry  (${BASE})`);

  const post = async (body: unknown) => {
    const response = await fetch(`${BASE}/api/app/v1/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text };
  };

  const base = { name: 'App Verify', email: 'app-verify@example.org', message: 'Automated check.' };

  /*
   * The consent translation. `submitEnquiry` accepts only the strings a real
   * checkbox produces, and a JSON client naturally sends a boolean — so without
   * the route's normalisation every app enquiry fails with "please confirm you
   * agree", which is a baffling thing to tell someone who ticked the box.
   */
  const accepted = await post({ ...base, consent: true });
  report(accepted.status === 200, 'a JSON boolean consent is accepted', `got ${accepted.status} ${accepted.text.slice(0, 90)}`);

  const missing = await post(base);
  report(missing.status === 400, 'consent omitted is refused');

  /*
   * Only an explicit true counts. A truthy coercion would let `consent: 1`
   * through, and the whole point of the check is that the tickbox means
   * something rather than being decoration.
   */
  const truthy = await post({ ...base, consent: 1 });
  report(truthy.status === 400, 'a merely truthy consent (1) is still refused');

  const stringy = await post({ ...base, consent: 'no' });
  report(stringy.status === 400, 'an arbitrary string consent is refused');

  const malformed = await fetch(`${BASE}/api/app/v1/enquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json',
  });
  await malformed.text();
  report(malformed.status === 400, 'a malformed body is refused rather than throwing');

  const wrongMethod = await fetch(`${BASE}/api/app/v1/enquiry`);
  await wrongMethod.text();
  report(wrongMethod.status === 405, 'GET is not allowed');
}

async function checkContentScreens(): Promise<void> {
  section('The content bundle carries every screen the app renders');

  const response = await fetch(`${BASE}/api/app/v1/content`);
  const bundle = (await response.json()) as Record<string, Record<string, unknown>>;

  /*
   * Phase 3 renders these from the bundle. Asserting the fields exist here
   * means a website data edit that drops one fails CI rather than rendering an
   * empty section on a phone, where nobody would notice for a release or two.
   */
  const required: Array<[string, string[]]> = [
    ['about', ['bannerLead', 'card', 'pillars', 'pillarsHeading', 'history', 'why', 'college', 'facts', 'statLines']],
    ['chapters', ['westZone', 'page', 'network', 'meetsSection', 'billSection', 'joinSection']],
    ['explore', ['detailsLabel', 'items']],
    ['contact', ['page', 'faq', 'cta']],
  ];

  for (const [sectionName, keys] of required) {
    for (const key of keys) {
      report(
        bundle[sectionName] !== undefined && bundle[sectionName]![key] !== undefined,
        `${sectionName}.${key} is present`,
      );
    }
  }

  // The nested shapes the screens actually index into.
  const chapters = bundle.chapters as { westZone?: { meet?: Record<string, unknown>; poster?: unknown } };
  report(Boolean(chapters?.westZone?.meet?.panels), 'chapters.westZone.meet.panels — the "on the bill" section');
  report(Boolean(chapters?.westZone?.poster), 'chapters.westZone.poster — the meet poster');

  const contact = bundle.contact as { page?: { form?: Record<string, unknown>; socials?: unknown[] } };
  report(Boolean(contact?.page?.form?.consent), 'contact.page.form.consent — the checkbox label');
  report((contact?.page?.socials?.length ?? 0) > 0, 'contact.page.socials — the follow rail');

  const about = bundle.about as { history?: { milestones?: unknown[] }; college?: { motto?: unknown } };
  report((about?.history?.milestones?.length ?? 0) > 0, 'about.history.milestones — the timeline');
  report(Boolean(about?.college?.motto), 'about.college.motto — Nihil Ultra');

  /*
   * The policies are the one place the app renders text that also appears on a
   * website *page* rather than only in src/data. Both now import
   * src/data/pages/policies.ts, and these checks are what stop them drifting —
   * a paraphrase in the app would make it stop being a replica, and softening
   * the notice would let provisional text read as a legal document.
   */
  const policies = bundle.policies as
    | { privacy?: { points?: string[]; notice?: string }; terms?: { points?: string[]; notice?: string } }
    | undefined;

  report(Boolean(policies?.privacy), 'policies.privacy is present');
  report(Boolean(policies?.terms), 'policies.terms is present');
  report((policies?.privacy?.points?.length ?? 0) >= 5, 'the privacy policy carries all its points');
  report((policies?.terms?.points?.length ?? 0) >= 4, 'the terms carry all their points');
  report(
    (policies?.privacy?.notice ?? '').includes('not the Association’s legal wording'),
    'the provisional notice is intact — it must not be softened into "coming soon"',
  );
}

/**
 * The app must render the website's words, not a paraphrase.
 *
 * Fetches both policy pages and checks every point the bundle serves actually
 * appears in the rendered HTML. This is what makes "an exact replica of the
 * website" a tested property rather than an intention: if someone edits one
 * side, this fails.
 */
async function checkPoliciesMatchWebsite(): Promise<void> {
  section('The app and the website serve the same policy text');

  const bundle = (await (await fetch(`${BASE}/api/app/v1/content`)).json()) as {
    policies: { privacy: { points: string[] }; terms: { points: string[] } };
  };

  const pages: Array<[string, string[]]> = [
    ['/privacy-policy', bundle.policies.privacy.points],
    ['/terms-of-use', bundle.policies.terms.points],
  ];

  for (const [path, points] of pages) {
    const html = await (await fetch(`${BASE}${path}`)).text();
    const missing = points.filter((point) => {
      // The page renders the same string; entity-encode the characters Next
      // escapes so a curly apostrophe does not read as a mismatch.
      const encoded = point.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return !html.includes(point) && !html.includes(encoded);
    });
    report(missing.length === 0, `every ${path} point the app shows is on the website`, missing[0]?.slice(0, 70) ?? '');
  }
}

// --- main ---------------------------------------------------------------------

async function main(): Promise<void> {
  process.stdout.write('\nApp API — phase 0\n');

  checkBearerParsing();
  checkPaging();

  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-appverify' });
  const web = connect(process.env.WEB_DATABASE_URL ?? process.env.DATABASE_URL ?? '', {
    max: 2,
    application_name: 'sxccaa-appverify-web',
  });

  try {
    await clean(owner);
    await checkSessionResolution(owner, web);
    await checkOwnerResolution(owner, web);
  } finally {
    await clean(owner).catch(() => {});
    await owner.end({ timeout: 5 });
    await web.end({ timeout: 5 });
  }

  if (await reachable()) {
    await checkConfig();
    await checkContent();
    await checkContentScreens();
    await checkPoliciesMatchWebsite();
    await checkEnquiry();
  } else {
    section('HTTP checks');
    process.stdout.write(
      `  ! skipped — nothing answering at ${BASE}\n` +
        '      Start the server first:  npm run dev\n' +
        '      Or point elsewhere:      APP_VERIFY_URL=https://… npm run app:verify\n',
    );
    skipped += 1;
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} group skipped` : ''}\n\n`);

  // A skipped HTTP group is a failure. Going green without having tested the
  // endpoints is exactly the outcome this tool exists to prevent.
  if (failed > 0 || skipped > 0) process.exit(1);
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
