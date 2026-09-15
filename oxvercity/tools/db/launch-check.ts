/**
 * The check to run before the domain points at this.
 *
 *   npm run launch:check
 *
 * Everything else in this project tests behaviour. This tests **configuration**
 * — the category of failure that passes every test suite, builds cleanly, and
 * then does something irreversible on the day you go live.
 *
 * The three it exists for:
 *
 *   - Serving twelve invented people to the world because a demo flag was left on.
 *   - Emailing five hundred alumni from a domain with no DMARC, so half of them
 *     land in spam and the other half get a lookalike from a phisher next week.
 *   - Going live with one administrator, one phone, and no way back in.
 *
 * It reads. It changes nothing.
 */

import { promises as dns } from 'node:dns';

import { connect } from '../../src/lib/db.ts';

export {};

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

/** The domain mail is sent from — the one DMARC has to cover. */
function sendingDomain(): string | null {
  const from = process.env.MAIL_FROM ?? '';
  const match = /@([^\s>]+)/.exec(from);
  return match ? match[1]!.toLowerCase() : null;
}

async function txt(name: string): Promise<string[]> {
  try {
    // A TXT record can be split into several strings; joining is the standard
    // reassembly and SPF records over 255 characters rely on it.
    return (await dns.resolveTxt(name)).map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

async function checkEnvironment(): Promise<void> {
  process.stdout.write('\n  Configuration\n');

  const required = [
    'DATA_ENCRYPTION_KEYS',
    'EMAIL_HMAC_PEPPER',
    'SESSION_SECRET',
    'DATABASE_URL',
    'WEB_DATABASE_URL',
    'RESEND_API_KEY',
    'MAIL_FROM',
    'APP_URL',
  ];
  const missing = required.filter((name) => !process.env[name]);
  report(missing.length === 0, 'every required variable is set', missing.length ? `missing: ${missing.join(', ')}` : '');

  // The one that serves twelve invented people to the internet.
  const demo = process.env.USE_DEMO_ALUMNI === 'true';
  report(!demo, 'USE_DEMO_ALUMNI is off', demo ? 'It is TRUE. The live site would serve synthetic records.' : '');

  const appUrl = process.env.APP_URL ?? '';
  report(appUrl.startsWith('https://'), 'APP_URL is https', `got "${appUrl}"`);
  report(!appUrl.endsWith('/'), 'APP_URL has no trailing slash', `got "${appUrl}"`);

  // The public app connecting as the owner would hand it the ability to rename
  // alumni, mint allowlist entries and rewrite the audit log.
  const web = process.env.WEB_DATABASE_URL ?? '';
  report(web.includes('sxc_web'), 'the public site connects as sxc_web, not the owner');

  const adminUrl = process.env.ADMIN_URL ?? '';
  if (adminUrl) {
    report(adminUrl.startsWith('https://'), 'ADMIN_URL is https', `got "${adminUrl}"`);
    try {
      report(
        new URL(adminUrl).hostname !== new URL(appUrl).hostname,
        'the portal is on a different hostname from the public site',
        'A shared origin means an XSS on the public site can reach admin cookies.',
      );
    } catch {
      report(false, 'ADMIN_URL and APP_URL parse as URLs');
    }
  } else {
    warn('ADMIN_URL is not set', 'The portal cannot build invitation links without it.');
  }

  // Without these the sign-in form is a free oracle for mailing any address.
  const turnstile = Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  report(turnstile, 'Turnstile is configured');
  if (process.env.REQUIRE_TURNSTILE === 'false') {
    warn('REQUIRE_TURNSTILE is false', 'Bot protection is switched off. This must not be set in production.');
  }

  report(Boolean(process.env.ADMIN_NOTIFY_EMAIL), 'somebody is told when an access request arrives');
  report(
    Boolean(process.env.ENQUIRY_TO_EMAIL ?? process.env.ADMIN_NOTIFY_EMAIL),
    'the enquiry form has somewhere to send to',
  );
}

async function checkDns(): Promise<void> {
  const domain = sendingDomain();
  process.stdout.write(`\n  Mail authentication for ${domain ?? '(unknown)'}\n`);

  if (!domain) {
    report(false, 'MAIL_FROM names a domain');
    return;
  }

  // SPF — who may send as this domain.
  const root = await txt(domain);
  const spf = root.find((record) => record.toLowerCase().startsWith('v=spf1'));
  report(Boolean(spf), 'SPF record exists', spf ? spf.slice(0, 90) : 'No v=spf1 TXT record found.');
  if (spf && !/[~-]all/.test(spf)) {
    warn('SPF ends in neither ~all nor -all', 'A record without a terminal "all" tells receivers nothing.');
  }

  // DKIM — Resend signs with this selector.
  const dkim = await txt(`resend._domainkey.${domain}`);
  let dkimFound = dkim.length > 0;
  if (!dkimFound) {
    try {
      dkimFound = (await dns.resolveCname(`resend._domainkey.${domain}`)).length > 0;
    } catch {
      dkimFound = false;
    }
  }
  report(dkimFound, 'DKIM record exists at resend._domainkey', dkimFound ? '' : 'Add the record Resend shows under Domains.');

  /*
   * DMARC is the one that matters most here, and the one most often skipped.
   *
   * Without it, anyone can send mail that claims to be from the Association.
   * The highest-probability real attack on this platform is not against the
   * code — it is a lookalike "sign in to the alumni directory" email sent to
   * five hundred people who have just been told to expect exactly that.
   */
  const dmarcRecords = await txt(`_dmarc.${domain}`);
  const dmarc = dmarcRecords.find((record) => record.toLowerCase().startsWith('v=dmarc1'));
  report(Boolean(dmarc), 'DMARC record exists', dmarc ? dmarc.slice(0, 90) : 'No _dmarc TXT record found.');

  if (dmarc) {
    const policy = /p=(\w+)/.exec(dmarc)?.[1]?.toLowerCase();
    if (policy === 'none') {
      warn(
        'DMARC policy is p=none',
        'Reports only — receivers are told to do nothing about spoofed mail. Move to quarantine once the reports look clean.',
      );
    } else {
      report(policy === 'quarantine' || policy === 'reject', `DMARC policy is p=${policy}`);
    }
    if (!/rua=/.test(dmarc)) {
      warn('DMARC has no rua= address', 'Nobody receives the reports, so nobody finds out you are being spoofed.');
    }
  }
}

async function checkDatabase(): Promise<void> {
  process.stdout.write('\n  Database\n');

  const sql = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-launchcheck' });

  try {
    const migrations = await sql<Array<{ filename: string }>>`
      select filename from schema_migration order by filename
    `;
    report(migrations.length >= 8, `all migrations applied`, `${migrations.length} on record`);

    const admins = await sql<Array<{ active: number; supers: number }>>`
      select
        (select count(*)::int from admin_user where status = 'active')                          as active,
        (select count(*)::int from admin_user where status = 'active' and role = 'super_admin') as supers
    `;
    const { active, supers } = admins[0]!;
    report(active > 0, 'at least one administrator exists', `${active} active`);

    if (supers < 2) {
      warn(
        `only ${supers} active super admin`,
        'One admin with one phone is one lost phone away from a locked portal, and the way back runs through a developer\'s laptop.',
      );
    } else {
      report(true, `${supers} active super admins`);
    }

    const unconfirmed = await sql<Array<{ c: number }>>`
      select count(*)::int as c from admin_user where status = 'active' and totp_confirmed_at is null
    `;
    report(unconfirmed[0]!.c === 0, 'every active admin has confirmed two-factor');

    const directory = await sql<Array<{ visible: number; withLogin: number; invited: number }>>`
      select
        (select count(*)::int from alumni where is_visible)                                   as visible,
        (select count(*)::int from alumni where is_visible and gmail_hmac is not null)        as "withLogin",
        (select count(*)::int from alumni where invited_at is not null)                       as invited
    `;
    const d = directory[0]!;
    process.stdout.write(
      `  · directory: ${d.visible} listed, ${d.withLogin} can sign in, ${d.invited} already invited\n`,
    );

    if (d.visible === 0) {
      warn('the directory is empty', 'Run the ingest tool before the domain points here.');
    }

    // Consent is the Association's legal footing for publishing any of this.
    const noConsent = await sql<Array<{ c: number }>>`
      select count(*)::int as c from alumni where is_visible and consent_recorded_at is null
    `;
    if (noConsent[0]!.c > 0) {
      warn(
        `${noConsent[0]!.c} listed alumni have no consent timestamp`,
        'The form Timestamp column should populate this. Without it there is no per-record evidence of consent (DPDP, plan §11).',
      );
    } else if (d.visible > 0) {
      report(true, 'every listed alumnus has a consent timestamp');
    }

    // Supabase's internet-facing roles must hold nothing.
    const exposed = await sql<Array<{ c: number }>>`
      select count(*)::int as c from information_schema.role_table_grants
       where grantee in ('anon', 'authenticated') and table_schema = 'public'
    `;
    report(exposed[0]!.c === 0, 'anon and authenticated hold no table privileges', `${exposed[0]!.c} grants found`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Is this a development configuration?
 *
 * Run locally, several checks below fail for the same reason — localhost is
 * not https, and a dev box has no Turnstile keys. Those failures are correct
 * and they are also noise, and a suite that always shows the same four
 * failures is a suite people stop reading. So they are still reported, and the
 * header says plainly why they are there.
 */
function looksLocal(): boolean {
  const appUrl = process.env.APP_URL ?? '';
  return appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
}

async function main(): Promise<void> {
  process.stdout.write('\n  Pre-launch check. This reads only — nothing is changed.\n');

  if (looksLocal()) {
    process.stdout.write(
      '\n  APP_URL points at localhost, so this is a development configuration.\n' +
        '  Expect the https, hostname and Turnstile checks to fail — they are\n' +
        '  describing this machine, not a problem with the code. The DNS and\n' +
        '  database sections below are still real and still worth reading.\n',
    );
  }

  await checkEnvironment();
  await checkDns();
  await checkDatabase();

  process.stdout.write(`\n  ${passed} passed, ${failed} failed${warned ? `, ${warned} to look at` : ''}.\n`);
  if (failed === 0) {
    process.stdout.write('\n  Nothing blocking. Read the warnings before pointing the domain here.\n\n');
  } else if (looksLocal()) {
    process.stdout.write(
      '\n  Run this again against production configuration before cutover.\n' +
        '  On this machine the failures above are mostly "it is localhost".\n\n',
    );
  } else {
    process.stdout.write('\n  Do not cut the domain over until these are fixed.\n\n');
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
