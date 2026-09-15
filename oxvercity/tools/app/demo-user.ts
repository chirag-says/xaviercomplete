/**
 * Seed a sign-in code you can actually type, for testing the app.
 *
 *   npm run app:demo-user                       -- grant + code for the default address
 *   npm run app:demo-user -- you@example.org    -- for a specific address
 *   npm run app:demo-user -- --remove           -- take the access away again
 *
 * ## Why this exists
 *
 * Signing in needs a six-digit code, and the code arrives by email. In
 * development there is usually no mail provider configured, and even with one
 * the code goes to a real inbox — neither is convenient when the thing being
 * tested is the app's login screen on a phone.
 *
 * The database stores only `sha256(code)`, so this tool cannot read an existing
 * code any more than an attacker with a copy of the database could. It writes a
 * row whose hash it already knows instead, which is identical from the
 * application's point of view.
 *
 * ## One thing that will catch you out
 *
 * Asking for a code **supersedes** any code already outstanding — `auth.ts`
 * marks the previous row consumed so that "this is your code" is always true.
 * So the order matters:
 *
 *   1. tap "Send me a code" in the app
 *   2. *then* run this tool
 *   3. type the code it prints
 *
 * Running it first and then tapping the button will quietly invalidate the code
 * you were about to use.
 *
 * ## This writes to the real database
 *
 * It refuses to run against production. The address it grants is real access —
 * remove it with `--remove` when you are finished.
 */

import { createHash } from 'node:crypto';

import { connect } from '../../src/lib/db.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';

const DEFAULT_EMAIL = 'demo-xaverian@example.org';
const CODE = '246810';
const LIFETIME_MINUTES = 60;

function usage(): void {
  process.stdout.write(
    '\nSeed a sign-in code for testing the app.\n\n' +
      '  npm run app:demo-user\n' +
      '  npm run app:demo-user -- someone@example.org\n' +
      '  npm run app:demo-user -- --remove\n\n',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('\nRefusing to run in production. This grants directory access.\n\n');
    process.exit(1);
  }

  const remove = args.includes('--remove');
  const email = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_EMAIL;
  const hmac = blindIndexOfNormalised(email);

  const owner = connect(process.env.DATABASE_URL ?? '', { max: 1, application_name: 'sxccaa-demouser' });

  try {
    if (remove) {
      await owner`delete from login_token where email_hmac = ${hmac}`;
      const gone = await owner`delete from access_grant where email_hmac = ${hmac} returning id`;
      await owner`delete from session where email_hmac = ${hmac}`;
      process.stdout.write(
        `\n  Removed access for ${email}${gone.length === 0 ? ' (there was none)' : ''}.\n` +
          '  Any session it had is revoked.\n\n',
      );
      return;
    }

    const existing = await owner<Array<{ id: string }>>`
      select id from access_grant where email_hmac = ${hmac} and revoked_at is null limit 1
    `;

    if (existing.length === 0) {
      await owner`insert into access_grant (email_hmac, source) values (${hmac}, 'import')`;
    }

    // Supersede anything outstanding, exactly as requesting a code would, so the
    // printed code is the only one that works.
    await owner`update login_token set consumed_at = now() where email_hmac = ${hmac} and consumed_at is null`;
    await owner`
      insert into login_token (otp_hash, email_hmac, expires_at)
      values (
        ${createHash('sha256').update(CODE, 'utf8').digest()},
        ${hmac},
        now() + ${`${LIFETIME_MINUTES} minutes`}::interval
      )
    `;

    process.stdout.write(
      `\n  Address:  ${email}\n` +
        `  Code:     ${CODE}\n` +
        `  Valid:    ${LIFETIME_MINUTES} minutes\n` +
        `  Access:   ${existing.length === 0 ? 'granted now' : 'already granted'}\n\n` +
        '  In the app: enter the address, tap "Send me a code", then run this\n' +
        '  tool AGAIN before typing the code — asking for a code supersedes any\n' +
        '  code already outstanding, including this one.\n\n' +
        `  When you are finished:  npm run app:demo-user -- --remove${email === DEFAULT_EMAIL ? '' : ` ${email}`}\n\n`,
    );
  } finally {
    await owner.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exit(1);
});
