/**
 * Tell the alumni the directory is live.
 *
 *   npm run invite                 # dry run — shows who would be emailed
 *   npm run invite -- --send       # actually send
 *   npm run invite -- --send --limit 20 --rate 50
 *
 * The last step of the launch, and the one that cannot be taken back. Five
 * hundred people receive an unsolicited email about a directory containing
 * their phone number; get it wrong and the Association spends a month
 * explaining itself.
 *
 * ## Dry run by default
 *
 * `--send` is required. Nothing about a command that mails five hundred people
 * should be the default behaviour of typing its name.
 *
 * ## Paced, because the domain is new
 *
 * Fifty an hour by default. A new sending domain that emits five hundred
 * messages in a minute is a domain that lands in spam — and once Gmail has
 * decided that, the sign-in links stop arriving too and the whole platform
 * looks broken. Budget two days and let it run.
 *
 * ## Resumable, because ten hours is long enough to be interrupted
 *
 * `alumni.invited_at` is stamped **after** each successful send, one at a time.
 * Stop the run, close the laptop, come back tomorrow: it picks up exactly where
 * it left off. Sending twice is the failure that matters here, so the write
 * happens per message rather than per batch.
 *
 * ## The addresses never touch a file
 *
 * Decrypted in memory, one at a time, used, discarded. Nothing is written to
 * disk, and the progress report carries counts and masked addresses only.
 */

import { connect, type Sql } from '../../src/lib/db.ts';
import { decryptField, fieldContext } from '../../src/lib/core/crypto.ts';
import { maskEmail } from '../../src/lib/core/email.ts';
import { alumniInviteEmail, mailConfig, send, type MailConfig } from '../../src/lib/email.ts';

const write = (line = '') => process.stdout.write(`${line}\n`);
const rule = () => write('  ' + '─'.repeat(68));

interface Options {
  send: boolean;
  /** Messages per hour. */
  rate: number;
  /** Stop after this many. 0 means everyone. */
  limit: number;
}

function parseArgs(argv: string[]): Options {
  const number = (flag: string, fallback: number) => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  return {
    send: argv.includes('--send'),
    rate: number('--rate', 50),
    limit: number('--limit', 0),
  };
}

interface Pending {
  id: string;
  gmail_enc: Buffer;
}

/**
 * Who still needs telling.
 *
 * Three conditions, and each excludes someone it would be wrong to email:
 * no sign-in identity means the link would not work; withdrawn means they have
 * already said no; a revoked grant means an admin took their access away and
 * an invitation would contradict that.
 */
async function pending(sql: Sql, limit: number): Promise<Pending[]> {
  return sql<Pending[]>`
    select a.id, a.gmail_enc
      from alumni a
      join access_grant g on g.email_hmac = a.gmail_hmac and g.revoked_at is null
     where a.invited_at is null
       and a.gmail_hmac is not null
       and a.gmail_enc is not null
       and a.is_visible
     order by a.created_at
     ${limit > 0 ? sql`limit ${limit}` : sql``}
  `;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const url = process.env.INGEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    write('\n  INGEST_DATABASE_URL is not set. Nothing to connect to.\n');
    process.exitCode = 1;
    return;
  }

  let config: MailConfig;
  try {
    config = mailConfig();
  } catch (error) {
    write(`\n  ${(error as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  const sql = connect(url, { max: 2, application_name: 'sxccaa-invite' });

  try {
    const queue = await pending(sql, options.limit);

    const totals = await sql<Array<{ total: number; invited: number; no_login: number }>>`
      select
        (select count(*)::int from alumni where is_visible)                                as total,
        (select count(*)::int from alumni where invited_at is not null)                    as invited,
        (select count(*)::int from alumni where is_visible and gmail_hmac is null)         as no_login
    `;
    const counts = totals[0]!;

    write();
    rule();
    write('  SXCCAA — invite the alumni');
    rule();
    write();
    write(`  Listed in the directory        ${counts.total}`);
    write(`  Already invited                ${counts.invited}`);
    write(`  Cannot sign in (no Gmail)      ${counts.no_login}   — never emailed`);
    write(`  Waiting to be invited          ${queue.length}`);
    write();
    write(`  From        ${config.from}`);
    write(`  Links to    ${config.appUrl}`);
    write(`  Rate        ${options.rate}/hour  (~${Math.ceil(queue.length / options.rate)}h for this queue)`);
    write();

    if (queue.length === 0) {
      write('  Nobody is waiting. Nothing to do.\n');
      return;
    }

    if (!options.send) {
      write('  DRY RUN — nothing will be sent. Add --send to do it for real.');
      write();
      write('  The first few who would be emailed:');
      write();
      for (const row of queue.slice(0, 8)) {
        let masked = '(unreadable)';
        try {
          masked = maskEmail(decryptField(row.gmail_enc, fieldContext('alumni', row.id, 'gmail')));
        } catch {
          // A blob that will not authenticate is reported, not skipped silently.
        }
        write(`      ${row.id}   ${masked}`);
      }
      if (queue.length > 8) write(`      … and ${queue.length - 8} more`);
      write();
      write('  Before sending for real:');
      write('    - Check SPF, DKIM and DMARC are live:  npm run launch:check');
      write('    - Send one to yourself first:          npm run invite -- --send --limit 1');
      write('    - Read it on a phone. This is the only email most of them');
      write('      will ever read about how their data is handled.');
      write();
      return;
    }

    // --- the real thing ------------------------------------------------------
    const gapMs = Math.round(3_600_000 / options.rate);
    write(`  SENDING. One message every ${Math.round(gapMs / 1000)}s. Ctrl-C stops it;`);
    write('  rerunning picks up where it left off.');
    write();

    let sent = 0;
    let failed = 0;

    for (const [index, row] of queue.entries()) {
      let address: string;
      try {
        address = decryptField(row.gmail_enc, fieldContext('alumni', row.id, 'gmail'));
      } catch (error) {
        // Left un-invited on purpose: a row whose address will not decrypt is a
        // problem to investigate, not one to skip past quietly for ever.
        write(`  ✗ ${row.id}  address will not decrypt — left for you to look at`);
        write(`      ${(error as Error).message}`);
        failed++;
        continue;
      }

      try {
        await send(
          { to: address, ...alumniInviteEmail(`${config.appUrl}/login`, `${config.appUrl}/me`) },
          config,
        );

        // Stamped per message, immediately. A batch-level write would re-send
        // everything since the last checkpoint after an interruption.
        await sql`update alumni set invited_at = now() where id = ${row.id}`;
        sent++;
        write(`  ✓ ${String(index + 1).padStart(4)}/${queue.length}  ${maskEmail(address)}`);
      } catch (error) {
        failed++;
        write(`  ✗ ${String(index + 1).padStart(4)}/${queue.length}  ${maskEmail(address)} — ${(error as Error).message}`);
        // Not marked invited, so the next run tries again.
      }

      if (index < queue.length - 1) await sleep(gapMs);
    }

    // Counts only. Naming the recipients would put the mailing list in the
    // audit log, which is the thing the blind index exists to avoid.
    await sql`
      insert into audit_log (actor_type, actor_id, action, target_type, meta)
      values ('system', 'invite', 'alumni_invited', 'alumni', ${sql.json({ sent, failed, rate: options.rate })})
    `;

    write();
    rule();
    write(`  Sent ${sent}. Failed ${failed}.`);
    rule();
    write();
    if (failed > 0) {
      write('  The failures were not marked as invited. Run the command again');
      write('  and it will retry exactly those.');
      write();
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await main();
