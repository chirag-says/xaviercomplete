/**
 * Prove the gate holds, against a real server and the real database.
 *
 *   npm run dev            # in another terminal, with USE_DEMO_ALUMNI=false
 *   npm run gate:verify
 *
 * tests/visibility.test.ts proves the projections are right. It cannot prove
 * that the routes use them, that Next is not caching a profile, or that an
 * anonymous request really gets a 404 rather than a redirect. Those are
 * properties of the running application, so they are checked here, over HTTP,
 * the way an attacker would find out.
 *
 * Every assertion below is a **negative**: this is the suite that fails when
 * someone reopens a hole, which is a different job from the suite that passes
 * when a feature works.
 *
 * It writes one alumnus with known confidential values, grants and signs in one
 * identity, probes, and removes everything it made. Audit rows stay — they are
 * append-only by design and a fair record of what happened.
 */

import { encryptOptional, fieldContext } from '../../src/lib/core/crypto.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';
import { connect, type Sql } from '../../src/lib/db.ts';
import { createSession, SESSION_COOKIE } from '../../src/lib/session.ts';

/**
 * Values planted in the record and then hunted for in anonymous responses.
 * Distinctive enough that a match cannot be a coincidence — "+44 7700 900" is
 * Ofcom's drama range and will never reach a handset.
 */
const PLANTED = {
  // Must satisfy alumni_id_check: exactly 12 characters from the id alphabet,
  // which has no 0, 1, l or o in it.
  id: 'gatev3rify99',
  name: 'Gate Verify Subject',
  contact: '+44 7700 900931',
  gmail: 'gate.verify.931@example.org',
  otherInfo: 'CANARY-OTHER-INFO-931',
  previousRole: 'CANARY-PREVIOUS-ROLE-931',
};

const SIGN_IN_AS = 'gate.verify.931@example.org';

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

async function clean(owner: Sql): Promise<void> {
  const hmac = blindIndexOfNormalised(SIGN_IN_AS);
  await owner`delete from session where email_hmac = ${hmac}`;
  await owner`delete from login_token where email_hmac = ${hmac}`;
  await owner`delete from access_grant where email_hmac = ${hmac}`;
  await owner`delete from alumni where id = ${PLANTED.id}`;
}

async function plant(owner: Sql, showContact: boolean, showGmail: boolean): Promise<void> {
  const enc = (value: string, field: string) =>
    encryptOptional(value, fieldContext('alumni', PLANTED.id, field));

  await owner`
    insert into alumni (
      id, full_name, batch_year, stream, current_org, designation, previous_role,
      contact_enc, gmail_enc, other_info_enc, gmail_hmac,
      show_contact, show_gmail, is_visible
    ) values (
      ${PLANTED.id}, ${PLANTED.name}, 2011, 'B.Com.', 'Gate Verify Ltd', 'Subject',
      ${PLANTED.previousRole},
      ${enc(PLANTED.contact, 'contact')}, ${enc(PLANTED.gmail, 'gmail')},
      ${enc(PLANTED.otherInfo, 'otherInfo')}, ${blindIndexOfNormalised(PLANTED.gmail)},
      ${showContact}, ${showGmail}, true
    )
  `;
}

interface Probe {
  status: number;
  body: string;
  headers: Headers;
}

async function get(appUrl: string, path: string, cookie?: string): Promise<Probe> {
  const response = await fetch(`${appUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return { status: response.status, body: await response.text(), headers: response.headers };
}

async function main(): Promise<void> {
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3300').replace(/\/$/, '');
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-gateverify' });

  try {
    process.stdout.write(`\n  Probing ${appUrl}\n`);

    // A server serving synthetic records would pass every check below without
    // the gate being involved, which is the most misleading possible outcome.
    let reachable: Probe;
    try {
      reachable = await get(appUrl, '/alumni');
    } catch {
      process.stdout.write(
        `\n  Cannot reach ${appUrl}. Start the server first:\n    USE_DEMO_ALUMNI=false npm run dev\n\n`,
      );
      process.exitCode = 1;
      return;
    }
    if (reachable.status !== 200) {
      process.stdout.write(`\n  ${appUrl}/alumni returned ${reachable.status}; expected 200.\n\n`);
      process.exitCode = 1;
      return;
    }

    await clean(owner);
    await plant(owner, true, true);

    const grantHmac = blindIndexOfNormalised(SIGN_IN_AS);
    await owner`insert into access_grant (email_hmac, source) values (${grantHmac}, 'import')`;
    const { token } = await createSession(grantHmac, 'gate-verify', owner);
    const signedIn = `${SESSION_COOKIE}=${token}`;

    // --- the anonymous directory --------------------------------------------
    process.stdout.write('\n  An anonymous visitor gets the five public fields and no more\n');

    const grid = await get(appUrl, '/alumni');
    report(grid.status === 200, 'the directory itself is public');

    const plantedOnGrid = grid.body.includes(PLANTED.name);
    report(plantedOnGrid, 'the planted record is on the page', plantedOnGrid ? '' : 'is USE_DEMO_ALUMNI still true? this run proves nothing');
    if (!plantedOnGrid) {
      process.stdout.write('\n  Stopping: the server is not serving the database.\n\n');
      process.exitCode = 1;
      return;
    }

    for (const [label, secret] of Object.entries({
      'contact number': PLANTED.contact,
      'Gmail address': PLANTED.gmail,
      'free-text other info': PLANTED.otherInfo,
      'previous role': PLANTED.previousRole,
    })) {
      report(!grid.body.includes(secret), `the ${label} is absent from the anonymous HTML`);
    }

    report(
      !grid.body.includes(`href="/alumni/${PLANTED.id}"`),
      'no card links to a profile',
    );
    report(
      !grid.body.includes('al-card__overlay'),
      'the hover overlay is absent from the markup, not merely hidden',
    );

    // --- the profile, anonymous ---------------------------------------------
    process.stdout.write('\n  A profile does not exist for anyone who is not signed in\n');

    const anonProfile = await get(appUrl, `/alumni/${PLANTED.id}`);
    report(anonProfile.status === 404, 'the profile page returns 404', `got ${anonProfile.status}`);
    report(
      !anonProfile.body.includes(PLANTED.contact) && !anonProfile.body.includes(PLANTED.gmail),
      'the 404 body carries nothing',
    );

    const anonJson = await get(appUrl, `/api/alumni/${PLANTED.id}`);
    report(anonJson.status === 404, 'the JSON route returns 404', `got ${anonJson.status}`);
    report(
      !anonJson.body.includes(PLANTED.contact),
      'the JSON 404 carries no contact number',
    );

    const unknown = await get(appUrl, '/api/alumni/zzzzzzzzzzzz');
    report(
      unknown.status === anonJson.status && unknown.body === anonJson.body,
      'a real id and an invented one are indistinguishable while signed out',
    );

    // --- the profile, signed in ---------------------------------------------
    process.stdout.write('\n  A signed-in Xaverian gets what the owner published\n');

    const page = await get(appUrl, `/alumni/${PLANTED.id}`, signedIn);
    report(page.status === 200, 'the profile page renders', `got ${page.status}`);
    report(page.body.includes(PLANTED.contact), 'the published number is shown');
    report(page.body.includes(PLANTED.gmail), 'the published address is shown');

    const json = await get(appUrl, `/api/alumni/${PLANTED.id}`, signedIn);
    report(json.status === 200, 'the JSON route answers');
    const parsed = JSON.parse(json.body) as Record<string, unknown>;
    report(parsed.contact === PLANTED.contact, 'the JSON carries the number');
    report(parsed.gmail === PLANTED.gmail, 'the JSON carries the address');

    const missing = await get(appUrl, '/api/alumni/zzzzzzzzzzzz', signedIn);
    report(missing.status === 404, 'an unknown id is 404 even with a session');

    const malformed = await get(appUrl, '/api/alumni/..%2F..%2Fetc', signedIn);
    report(malformed.status === 404, 'a traversal attempt never reaches the database');

    // --- the toggles, over HTTP ---------------------------------------------
    process.stdout.write('\n  A toggle turned off removes the field from the wire\n');

    await owner`update alumni set show_contact = false, show_gmail = false where id = ${PLANTED.id}`;

    const toggled = await get(appUrl, `/api/alumni/${PLANTED.id}`, signedIn);
    report(
      !toggled.body.includes(PLANTED.contact),
      'the hidden number is nowhere in the JSON',
    );
    report(
      !toggled.body.includes(PLANTED.gmail),
      'the hidden address is nowhere in the JSON',
    );
    const toggledParsed = JSON.parse(toggled.body) as Record<string, unknown>;
    report(!('contact' in toggledParsed), 'the contact key is absent, not null');
    report(!('gmail' in toggledParsed), 'the gmail key is absent, not null');

    const toggledPage = await get(appUrl, `/alumni/${PLANTED.id}`, signedIn);
    report(
      !toggledPage.body.includes(PLANTED.contact),
      'the hidden number is nowhere in the rendered page either',
    );
    report(toggledPage.body.includes('Not shared'), 'the page says so rather than leaving a gap');

    // --- withdrawal ----------------------------------------------------------
    process.stdout.write('\n  A withdrawn record is gone, not merely unlisted\n');

    await owner`update alumni set is_visible = false where id = ${PLANTED.id}`;

    const withdrawn = await get(appUrl, `/api/alumni/${PLANTED.id}`, signedIn);
    report(withdrawn.status === 404, 'a withdrawn profile is 404 to a signed-in viewer');
    report(
      withdrawn.body === missing.body,
      'withdrawn and never-existed are indistinguishable',
    );

    const gridAfter = await get(appUrl, '/alumni', signedIn);
    report(!gridAfter.body.includes(PLANTED.name), 'and the record has left the grid');

    // --- caching and indexing ------------------------------------------------
    process.stdout.write('\n  Nothing that varies by viewer may be cached or indexed\n');

    await owner`update alumni set is_visible = true where id = ${PLANTED.id}`;

    const cacheable = await get(appUrl, `/alumni/${PLANTED.id}`, signedIn);
    const cacheControl = cacheable.headers.get('cache-control') ?? '';
    // `no-store` is the assertion that matters and the only one made here.
    // Next sets its own `no-store, must-revalidate` on a force-dynamic route,
    // which replaces the `private, no-store` middleware adds — and that is
    // fine, because `no-store` is the strictly stronger directive: `private`
    // forbids shared caches, `no-store` forbids every cache including the
    // browser's own disk. Asserting `private` as well would fail on a
    // difference that is not a disclosure.
    report(cacheControl.includes('no-store'), 'the profile is no-store', `got "${cacheControl}"`);
    report(
      (cacheable.headers.get('x-robots-tag') ?? '').includes('noindex'),
      'the profile is noindex',
    );

    const gridHeaders = await get(appUrl, '/alumni');
    report(
      (gridHeaders.headers.get('cache-control') ?? '').includes('no-store'),
      'the directory is no-store too, because the cards differ by viewer',
    );

    const jsonHeaders = await get(appUrl, `/api/alumni/${PLANTED.id}`, signedIn);
    const jsonCache = jsonHeaders.headers.get('cache-control') ?? '';
    // The route handler sets this one itself, so both directives are ours to
    // assert and both must be there.
    report(
      jsonCache.includes('no-store') && jsonCache.includes('private'),
      'the JSON route is private and no-store',
      `got "${jsonCache}"`,
    );

    const robots = await get(appUrl, '/robots.txt');
    report(robots.body.includes('Disallow: /alumni/'), 'robots.txt keeps crawlers off profiles');
    report(!/Disallow:\s*\/alumni\s*$/m.test(robots.body), 'but not off the directory listing');
  } finally {
    await clean(owner);
    await owner.end({ timeout: 5 });
  }

  process.stdout.write(`\n  ${passed} passed, ${failed} failed.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  Every 404 above is the gate working.\n\n'
      : '\n  A failure here is a disclosure. Do not deploy.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
