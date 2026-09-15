/**
 * Check the security headers on a running server.
 *
 *   npm run dev          # in another terminal
 *   npm run harden:verify
 *
 * Headers are the one part of this system that is trivially easy to get wrong
 * and completely invisible when you do. Two of the three traps this project hit
 * produced a page that rendered perfectly and did nothing — no console error,
 * no failed request, no clue. So they get a check that looks at what the server
 * actually sends rather than at what the middleware source says it sends.
 *
 * `ADMIN_PROBE_URL` additionally probes the admin portal if it is running.
 */

// This file imports nothing — it only speaks HTTP — so it needs an explicit
// marker to be treated as a module rather than a script with a stray `await`.
export {};

const PUBLIC_PATHS = ['/', '/alumni', '/contact', '/login'] as const;

let passed = 0;
let failed = 0;
let warned = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

function warn(name: string, detail = ''): void {
  process.stdout.write(`  ! ${name}${detail ? `\n      ${detail}` : ''}\n`);
  warned++;
}

interface Probe {
  status: number;
  headers: Headers;
  body: string;
}

async function get(url: string): Promise<Probe> {
  const response = await fetch(url, { redirect: 'manual' });
  return { status: response.status, headers: response.headers, body: await response.text() };
}

function directives(csp: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const space = trimmed.indexOf(' ');
    map.set(space === -1 ? trimmed : trimmed.slice(0, space), space === -1 ? '' : trimmed.slice(space + 1));
  }
  return map;
}

async function checkCsp(appUrl: string): Promise<void> {
  process.stdout.write('\n  Content-Security-Policy\n');

  const probe = await get(`${appUrl}/alumni`);
  const csp = probe.headers.get('content-security-policy');
  if (!csp) {
    report(false, 'a policy is sent at all');
    return;
  }
  report(true, 'a policy is sent');

  const d = directives(csp);
  const script = d.get('script-src') ?? '';

  // The trap that produces a page where nothing works. A nonce in the header is
  // useless unless Next stamped the same one onto its script tags.
  const headerNonce = /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(script)?.[1];
  report(Boolean(headerNonce), 'script-src carries a nonce');

  if (headerNonce) {
    const tagNonces = new Set([...probe.body.matchAll(/nonce="([^"]+)"/g)].map((m) => m[1]!));
    report(tagNonces.size > 0, 'the HTML has nonced script tags', `${tagNonces.size} distinct value(s)`);
    report(
      tagNonces.size === 1 && tagNonces.has(headerNonce),
      'and they match the header exactly',
      tagNonces.size > 0 ? `header ${headerNonce.slice(0, 10)}… vs tag ${[...tagNonces][0]!.slice(0, 10)}…` : '',
    );
  }

  report(!script.includes("'unsafe-inline'"), "script-src does not allow 'unsafe-inline'");

  // `unsafe-eval` is required by `next dev` and must never reach production.
  if (script.includes("'unsafe-eval'")) {
    warn(
      "script-src allows 'unsafe-eval'",
      'Expected in `next dev` — the dev build wraps modules in eval(). It must NOT appear against a production build.',
    );
  } else {
    report(true, "script-src does not allow 'unsafe-eval' (production build)");
  }

  report(d.get('object-src') === "'none'", "object-src is 'none'");
  report(d.get('base-uri') === "'self'", "base-uri is 'self'");
  report(d.get('frame-ancestors') === "'none'", "frame-ancestors is 'none'");
  report(d.get('form-action') === "'self'", "form-action is 'self'");
  report(d.has('img-src') && !d.get('img-src')!.includes('*'), 'img-src is an explicit list, not a wildcard');
  report(
    (d.get('frame-src') ?? '').includes('challenges.cloudflare.com'),
    'frame-src allows the Turnstile challenge and nothing else',
    d.get('frame-src') ?? '(absent)',
  );

  // Styles are the one concession. A style cannot execute; script-src is the
  // control that matters, and the Framer export is inline styles throughout.
  report(
    (d.get('style-src') ?? '').includes("'unsafe-inline'"),
    "style-src allows 'unsafe-inline' — deliberate, see the middleware note",
  );
}

async function checkCommonHeaders(appUrl: string): Promise<void> {
  process.stdout.write('\n  The headers that apply everywhere\n');

  for (const path of PUBLIC_PATHS) {
    const probe = await get(`${appUrl}${path}`);
    const h = probe.headers;
    const label = path === '/' ? '/ (home)' : path;

    const ok =
      h.get('x-content-type-options') === 'nosniff' &&
      h.get('x-frame-options') === 'DENY' &&
      h.get('referrer-policy') === 'same-origin' &&
      (h.get('permissions-policy') ?? '').includes('camera=()');

    report(ok, `${label} carries nosniff, DENY, same-origin and Permissions-Policy`);
  }

  // `no-referrer` is the trap: under it Chrome sends `Origin: null` on a form
  // POST, which 500s every Next server action and fails every same-origin check.
  const home = await get(`${appUrl}/`);
  report(
    home.headers.get('referrer-policy') !== 'no-referrer',
    'Referrer-Policy is NOT no-referrer, which would break every form',
  );
}

async function checkCaching(appUrl: string, isDevServer: boolean): Promise<void> {
  process.stdout.write('\n  Nothing that varies by viewer may be cached\n');

  for (const path of ['/alumni', '/login', '/me']) {
    const probe = await get(`${appUrl}${path}`);
    const cache = probe.headers.get('cache-control') ?? '';
    report(cache.includes('no-store'), `${path} is no-store`, `got "${cache || '(absent)'}"`);
  }

  /*
   * The inverse check: a page with nothing viewer-specific on it should not be
   * uncacheable, or the `no-store` on the pages that need it stops meaning
   * anything in a scan.
   *
   * `next dev` sends `no-store, must-revalidate` on everything it renders, so
   * this is only answerable against a production build — where `/` compiles to
   * a static route. Asserting it in dev produces a failure that is always
   * present and always ignorable, which is how a suite stops being read.
   */
  const home = await get(`${appUrl}/`);
  const homeCache = home.headers.get('cache-control') ?? '';

  if (isDevServer) {
    warn(
      'the home page is no-store, but this is `next dev`',
      'Dev never caches. Re-run against `npm run build && npm run start` to check this one properly.',
    );
    return;
  }

  report(
    !homeCache.includes('no-store'),
    'the home page is NOT needlessly no-store',
    `got "${homeCache || '(absent)'}" — a static marketing page should be cacheable`,
  );
}

async function checkIndexing(appUrl: string): Promise<void> {
  process.stdout.write('\n  What a crawler is told\n');

  const robots = await get(`${appUrl}/robots.txt`);
  report(robots.status === 200, 'robots.txt is served');
  report(robots.body.includes('Disallow: /alumni/'), 'it keeps crawlers off individual profiles');
  report(!/Disallow:\s*\/alumni\s*$/m.test(robots.body), 'but not off the directory listing');
  report(robots.body.includes('Disallow: /me'), 'and off /me');

  const directory = await get(`${appUrl}/alumni`);
  report(
    !(directory.headers.get('x-robots-tag') ?? '').includes('noindex'),
    'the directory listing itself is indexable — the Association wants to be found',
  );

  const login = await get(`${appUrl}/login`);
  report((login.headers.get('x-robots-tag') ?? '').includes('noindex'), '/login is noindex');
}

async function checkAdmin(adminUrl: string): Promise<void> {
  process.stdout.write(`\n  The admin portal at ${adminUrl}\n`);

  let probe: Probe;
  try {
    probe = await get(`${adminUrl}/login`);
  } catch {
    warn('the portal is not running', 'Start it with `npm run dev` in ../admin to include these checks.');
    return;
  }

  const h = probe.headers;
  report((h.get('content-security-policy') ?? '').includes("script-src 'self' 'nonce-"), 'it sends a nonced CSP');
  report((h.get('cache-control') ?? '').includes('no-store'), 'every response is no-store');
  report((h.get('x-robots-tag') ?? '').includes('noindex'), 'and noindex');
  report(h.get('referrer-policy') === 'same-origin', 'Referrer-Policy is same-origin');

  // The portal must never be reachable without a session.
  const root = await get(`${adminUrl}/`);
  report(root.status === 307 || root.status === 302, 'the dashboard redirects a signed-out visitor to sign in');
}

async function main(): Promise<void> {
  const appUrl = (process.env.PROBE_URL ?? process.env.APP_URL ?? 'http://localhost:3300').replace(/\/$/, '');

  process.stdout.write(`\n  Probing ${appUrl}\n`);

  try {
    await get(`${appUrl}/`);
  } catch {
    process.stdout.write(`\n  Cannot reach ${appUrl}. Start the server first:\n    npm run dev\n\n`);
    process.exitCode = 1;
    return;
  }

  // `unsafe-eval` in the policy is the reliable signal that this is `next dev`:
  // the production build has no eval to allow, so the directive is absent.
  const probe = await get(`${appUrl}/alumni`);
  const isDevServer = (probe.headers.get('content-security-policy') ?? '').includes("'unsafe-eval'");

  await checkCsp(appUrl);
  await checkCommonHeaders(appUrl);
  await checkCaching(appUrl, isDevServer);
  await checkIndexing(appUrl);

  const adminUrl = process.env.ADMIN_PROBE_URL;
  if (adminUrl) await checkAdmin(adminUrl.replace(/\/$/, ''));

  process.stdout.write(`\n  ${passed} passed, ${failed} failed${warned ? `, ${warned} to note` : ''}.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  Headers are as designed. Re-run this after any middleware change.\n\n'
      : '\n  A header is wrong. Two of these failures render a page that looks fine and does nothing.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
