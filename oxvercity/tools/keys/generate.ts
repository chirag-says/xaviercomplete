/**
 * Generate the secrets this system runs on.
 *
 *   npm run keys:generate
 *
 * Run it on your own machine. Copy the output into your password manager first
 * and into the host's secret store second. It is deliberately not written to a
 * file: a .env on disk is the single most common way a project like this leaks,
 * and the moment these values exist in the repo directory, one careless
 * `git add -A` publishes them.
 *
 * DATA_ENCRYPTION_KEYS and EMAIL_HMAC_PEPPER must be byte-identical across the
 * public site, the admin portal and the ingest tool, or one cannot read what
 * another wrote. Generate once; paste three times.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const key = () => randomBytes(32).toString('base64');

const secrets = [
  ['DATA_ENCRYPTION_KEYS', `1:${key()}`, 'AES-256-GCM. "1:" is the key version; rotation adds "2:<newkey>," in front.'],
  ['EMAIL_HMAC_PEPPER', key(), 'Blind index for the login allowlist. Rotating this means rebuilding every HMAC — treat it as permanent.'],
  ['SESSION_SECRET', key(), 'Session token signing.'],
] as const;

/**
 * `--write` fills the blanks in .env in place and prints nothing.
 *
 * Use it whenever someone other than you is driving the terminal — an assistant,
 * a screen share, a recorded session. The default mode prints the values, which
 * is right when you are the only one looking and wrong the moment you are not.
 * A secret in a scrollback is a secret in a screenshot.
 */
if (process.argv.includes('--write')) {
  const path = '.env';
  if (!existsSync(path)) {
    console.error('\n  No .env to write to. Copy .env.example to .env first.\n');
    process.exit(1);
  }

  let contents = readFileSync(path, 'utf8');
  const filled: string[] = [];
  const skipped: string[] = [];

  for (const [name, value] of secrets) {
    const empty = new RegExp(`^${name}=\\s*$`, 'm');
    if (empty.test(contents)) {
      contents = contents.replace(empty, `${name}=${value}`);
      filled.push(name);
    } else if (new RegExp(`^${name}=.+$`, 'm').test(contents)) {
      // Never overwrite a key that is already in use. Doing so would make every
      // field encrypted under the old one permanently unreadable.
      skipped.push(name);
    } else {
      contents += `\n${name}=${value}\n`;
      filled.push(name);
    }
  }

  writeFileSync(path, contents, { mode: 0o600 });
  console.log(`\n  Wrote ${filled.length ? filled.join(', ') : 'nothing'} into .env. Values not printed.`);
  if (skipped.length) console.log(`  Left alone (already set): ${skipped.join(', ')}.`);
  console.log('\n  Open .env, copy all three into your password manager, and keep them.');
  console.log('  Lose DATA_ENCRYPTION_KEYS after real data is loaded and every contact');
  console.log('  number becomes permanently unreadable. There is no recovery path.\n');
  process.exit(0);
}

console.log('\n  Fresh secrets. These are shown once and are not saved anywhere.\n');

for (const [name, value, note] of secrets) {
  console.log(`  # ${note}`);
  console.log(`  ${name}=${value}\n`);
}

console.log('  Next:');
console.log('    1. Store all three in the password manager, under the SXCCAA entry.');
console.log('    2. Set them as secrets on the host. Not in a file in this repo.');
console.log('    3. Use the same values for apps/web, apps/admin and the ingest tool.');
console.log('    4. Lose DATA_ENCRYPTION_KEYS and every contact number becomes');
console.log('       permanently unreadable. There is no recovery path. That is the point.\n');
