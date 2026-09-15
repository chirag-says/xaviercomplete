/**
 * Refuse to let a secret into the repository.
 *
 *   npm run scan:secrets            # everything git tracks
 *   npm run scan:secrets -- --staged  # only what is about to be committed
 *
 * A committed key is the most common way projects like this leak (plan §10.7),
 * and it is uniquely hard to undo: a push to a public remote means the value is
 * gone whatever the next commit says, and every alumni contact number becomes
 * readable to whoever found it.
 *
 * Hand-written rather than `gitleaks` for the same reason the rest of this
 * project avoids dependencies on the machine that holds the keys: the patterns
 * that matter here are few, specific and ours. A general-purpose scanner would
 * find more and would also need installing, updating and trusting.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

export {};

interface Pattern {
  name: string;
  test: RegExp;
  /** Why this one matters, printed when it fires. */
  why: string;
}

const PATTERNS: Pattern[] = [
  {
    name: 'AES key ring',
    // `1:<44 base64 chars>` — the shape of DATA_ENCRYPTION_KEYS.
    test: /\b\d+:[A-Za-z0-9+/]{42,}={0,2}\b/,
    why: 'This is the key that makes every contact number in the database readable.',
  },
  {
    name: 'Resend API key',
    test: /\bre_[A-Za-z0-9_]{20,}\b/,
    why: 'Lets anyone send mail as the Association.',
  },
  {
    name: 'Postgres connection string with a password',
    test: /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]{6,}@/,
    why: 'Direct database access.',
  },
  {
    name: 'Supabase service-role key',
    test: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
    why: 'Bypasses every row-level policy and least-privilege grant in the schema.',
  },
  {
    name: 'Cloudflare Turnstile secret',
    test: /\b0x[A-Za-z0-9]{30,}\b/,
    why: 'Turns off bot protection on the mail-sending endpoints.',
  },
  {
    name: 'Private key block',
    test: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    why: 'A private key does not belong in an application repository.',
  },
];

/** Files that legitimately describe the *shape* of a secret without being one. */
const ALLOWED = [
  /(^|\/)\.env\.example$/,
  /(^|\/)tools\/security\/scan-secrets\.ts$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)TESTING-GUIDE\.md$/,
  /(^|\/)IMPLEMENTATION-PLAN-.*\.md$/,
];

const BINARY = /\.(png|jpe?g|gif|webp|woff2?|ico|pdf|xlsx|webm|mp4)$/i;

function trackedFiles(stagedOnly: boolean): string[] {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
    : ['ls-files'];
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main(): void {
  const stagedOnly = process.argv.includes('--staged');
  const files = trackedFiles(stagedOnly);

  let checked = 0;
  const findings: string[] = [];

  for (const file of files) {
    if (BINARY.test(file)) continue;
    if (ALLOWED.some((rule) => rule.test(file))) continue;

    let contents: string;
    try {
      // Skip anything large enough to be a build artefact rather than source.
      if (statSync(file).size > 2_000_000) continue;
      contents = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    checked++;

    contents.split('\n').forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (pattern.test.test(line)) {
          findings.push(`${file}:${index + 1}  ${pattern.name}\n      ${pattern.why}`);
        }
      }
    });
  }

  process.stdout.write(`\n  Scanned ${checked} ${stagedOnly ? 'staged' : 'tracked'} file(s).\n`);

  if (findings.length === 0) {
    process.stdout.write('\n  No secrets found.\n\n');
    return;
  }

  process.stdout.write(`\n  ${findings.length} possible secret(s):\n\n`);
  for (const finding of findings) process.stdout.write(`  ✗ ${finding}\n\n`);
  process.stdout.write(
    '  If one of these is a false positive, add the file to ALLOWED in this script\n' +
      '  with a note explaining why it is safe.\n\n',
  );
  process.exitCode = 1;
}

main();
