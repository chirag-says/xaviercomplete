/**
 * The ingest tool. Run it on your own machine, never on a server.
 *
 *   npm run ingest -- private-data/alumni.xlsx            # preview, then confirm in a browser
 *   npm run ingest -- private-data/alumni.xlsx --dry-run  # preview only, no database, no server
 *
 * ## Why a path argument rather than the drop zone in plan §4.1
 *
 * A browser drop zone would mean the spreadsheet's bytes travelling over HTTP —
 * localhost or not — and being buffered a second time inside a second process.
 * Passing the path lets this Node process open the file directly from disk,
 * which is exactly the guarantee §4.2 makes: read from disk, never copied,
 * never uploaded. The browser is still used, for the masked confirmation
 * screen; it just never touches the file. Strictly less exposure, same workflow.
 *
 * The confirmation server binds 127.0.0.1 only, checks the Host header on every
 * request so a DNS-rebinding page cannot reach it, and requires a one-time
 * token minted for this run.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { decryptOptional, fieldContext } from '../../src/lib/core/crypto.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';
import { newAlumniId } from '../../src/lib/core/ids.ts';
import { connect } from '../../src/lib/db.ts';

import { detectColumns, type FieldKey } from './columns.ts';
import { assertSafeToRead, storageWarnings, UnsafeFileError } from './guard.ts';
import { applyPlan, loadExisting } from './push.ts';
import { assertNothingLeaked, buildPreview, type Preview } from './preview.ts';
import { buildPlan, type ExistingRecord, type ImportPlan } from './plan.ts';
import { assertReportIsClean, writeReport, type RunReport } from './report.ts';
import { readSheet } from './workbook.ts';
import { validateSheet } from './validate.ts';

const DEFAULT_PORT = 4317;

function die(message: string): never {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

function loadColumnOverrides(): Partial<Record<FieldKey, string>> {
  const path = 'tools/ingest/column-map.json';
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<Record<FieldKey, string>>;
  } catch (error) {
    die(`tools/ingest/column-map.json is not valid JSON: ${(error as Error).message}`);
  }
}

function renderTerminal(preview: Preview, sheetName: string, rejected: number, warnings: number): string {
  const lines: string[] = [];
  const pad = (text: string, width: number) => text.padEnd(width).slice(0, width);

  lines.push('');
  lines.push(`  Sheet: ${sheetName}`);
  lines.push('');
  lines.push(`  ${preview.counts.insert} new · ${preview.counts.update} updated · ${preview.counts.unchanged} unchanged`);
  lines.push(`  ${rejected} rejected · ${warnings} warnings`);
  lines.push(`  ${preview.newGrants} new allowlist entries · ${preview.withoutLogin} rows with no way to sign in`);
  if (preview.counts.skippedFields > 0) {
    lines.push(`  ${preview.counts.skippedFields} fields left alone because the alumnus has edited their own profile`);
  }
  lines.push('');

  const changing = preview.entries.filter((entry) => entry.kind !== 'unchanged');
  if (changing.length > 0) {
    lines.push(`  ${pad('Row', 6)}${pad('Action', 10)}${pad('Name', 30)}${pad('Batch', 7)}Changes`);
    lines.push(`  ${'─'.repeat(76)}`);
    for (const entry of changing.slice(0, 40)) {
      const summary =
        entry.kind === 'insert'
          ? 'all fields'
          : entry.changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join('; ') || '—';
      lines.push(
        `  ${pad(String(entry.rowNumber), 6)}${pad(entry.kind, 10)}${pad(entry.name, 30)}${pad(String(entry.batchYear), 7)}${summary}`,
      );
      for (const skip of entry.skipped) {
        lines.push(`  ${' '.repeat(53)}skipped ${skip.label} (theirs: ${skip.from})`);
      }
    }
    if (changing.length > 40) lines.push(`  … and ${changing.length - 40} more; see the report.`);
  }

  lines.push('');
  lines.push('  Contact numbers, both email columns and free text are masked above — on purpose,');
  lines.push('  on your own screen. The full values are only ever written as ciphertext.');
  lines.push('');
  return lines.join('\n');
}

function page(preview: Preview, token: string, applied: string | null): string {
  const esc = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

  const rows = preview.entries
    .filter((entry) => entry.kind !== 'unchanged')
    .map(
      (entry) => `<tr>
        <td>${entry.rowNumber}</td>
        <td><span class="k k-${entry.kind}">${entry.kind}</span></td>
        <td>${esc(entry.name)}</td>
        <td>${entry.batchYear}</td>
        <td>${
          entry.kind === 'insert'
            ? '<em>all fields</em>'
            : entry.changes.map((c) => `${esc(c.label)}: <s>${esc(c.from)}</s> → <b>${esc(c.to)}</b>`).join('<br>') || '—'
        }${
          entry.skipped.length
            ? `<div class="skip">left alone (the alumnus edited these): ${entry.skipped
                .map((s) => esc(s.label))
                .join(', ')}</div>`
            : ''
        }</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>SXCCAA ingest — confirm</title>
<style>
 body{font:15px/1.55 ui-sans-serif,system-ui,sans-serif;margin:0;padding:2.5rem;background:#0f1115;color:#e6e8ec}
 h1{font-size:1.35rem;margin:0 0 .35rem} .sub{color:#98a1b3;margin:0 0 1.75rem}
 .n{display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.75rem}
 .n div{background:#171a21;border:1px solid #262b36;border-radius:10px;padding:.8rem 1.1rem;min-width:7rem}
 .n b{display:block;font-size:1.5rem} .n span{color:#98a1b3;font-size:.82rem}
 table{border-collapse:collapse;width:100%;font-size:.88rem}
 th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #232833;vertical-align:top}
 th{color:#98a1b3;font-weight:500;position:sticky;top:0;background:#0f1115}
 .k{font-size:.75rem;padding:.1rem .45rem;border-radius:4px}
 .k-insert{background:#13361f;color:#6ee7a0} .k-update{background:#332a10;color:#f5c869}
 .skip{color:#f5a0a0;font-size:.8rem;margin-top:.3rem}
 s{color:#7d8595} b{color:#fff}
 .bar{position:sticky;bottom:0;background:#0f1115;border-top:1px solid #262b36;padding:1.25rem 0;margin-top:2rem}
 button{font:inherit;background:#2f6feb;color:#fff;border:0;border-radius:8px;padding:.7rem 1.4rem;cursor:pointer}
 .note{color:#98a1b3;font-size:.85rem;margin-top:.7rem;max-width:60ch}
 .done{background:#13361f;border:1px solid #1f5c36;border-radius:10px;padding:1rem 1.2rem;color:#6ee7a0}
</style></head><body>
<h1>Confirm the import</h1>
<p class="sub">Nothing has been written yet. Contact numbers, emails and free text are masked below — deliberately, even here.</p>
<div class="n">
 <div><b>${preview.counts.insert}</b><span>new</span></div>
 <div><b>${preview.counts.update}</b><span>updated</span></div>
 <div><b>${preview.counts.unchanged}</b><span>unchanged</span></div>
 <div><b>${preview.newGrants}</b><span>new logins</span></div>
 <div><b>${preview.counts.skippedFields}</b><span>fields left alone</span></div>
</div>
${applied ? `<div class="done">${esc(applied)}</div>` : ''}
<table><thead><tr><th>Row</th><th>Action</th><th>Name</th><th>Batch</th><th>Changes</th></tr></thead><tbody>${rows}</tbody></table>
${
  applied
    ? '<p class="note">Done. You can close this tab; the tool has exited.</p>'
    : `<div class="bar"><form method="POST" action="/apply"><input type="hidden" name="token" value="${esc(token)}">
<button type="submit">Encrypt and push ${preview.counts.insert + preview.counts.update} records</button>
<p class="note">Encryption happens on this machine. Only ciphertext leaves it.</p></form></div>`
}
</body></html>`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const filePath = args.find((arg) => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const port = Number(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? DEFAULT_PORT);

  if (!filePath) {
    die(
      'Usage: npm run ingest -- <path-to-spreadsheet> [--dry-run] [--port=4317]\n\n' +
        '  Keep the file outside the repository, or inside private-data/ which is gitignored.',
    );
  }

  try {
    assertSafeToRead(filePath);
  } catch (error) {
    if (error instanceof UnsafeFileError) die(error.message);
    throw error;
  }
  for (const warning of storageWarnings(filePath)) {
    process.stderr.write(`\n  warning: ${warning}\n`);
  }

  const sheet = await readSheet(filePath);
  const mapping = detectColumns(sheet.headers, loadColumnOverrides());

  if (mapping.missingRequired.length > 0) {
    die(
      `Could not find a column for: ${mapping.missingRequired.join(', ')}.\n\n` +
        `  Headers in the sheet:\n${sheet.headers.map((h, i) => `    ${i + 1}. ${h}`).join('\n')}\n\n` +
        '  Fix by creating tools/ingest/column-map.json, e.g.\n' +
        `    { "fullName": "${sheet.headers[0] ?? 'Your header here'}" }`,
    );
  }

  process.stdout.write('\n  Column mapping\n');
  for (const entry of mapping.explain) {
    process.stdout.write(
      `    ${entry.label.padEnd(34)} ${entry.column ? `${entry.column}  ${entry.header}` : '— not found —'}\n`,
    );
  }
  if (mapping.unusedHeaders.length > 0) {
    process.stdout.write(`\n  Unused columns: ${mapping.unusedHeaders.join(', ')}\n`);
  }

  const outcome = validateSheet(sheet.rows, mapping.map, sheet.firstRowNumber);

  // --- diff against what is already there ------------------------------------
  let existing = new Map<string, ExistingRecord>();
  let sql: ReturnType<typeof connect> | null = null;

  if (!dryRun) {
    const url = process.env.INGEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
    if (!url) {
      die(
        'INGEST_DATABASE_URL is not set, so there is nothing to import into.\n\n' +
          '  Use the sxc_ingest role from db/migrations/0002_roles.sql, or pass --dry-run to preview only.',
      );
    }
    sql = connect(url, { max: 2, application_name: 'sxccaa-ingest' });
    const records = await loadExisting(sql, (blob, id, field) =>
      decryptOptional(blob, fieldContext('alumni', id, field)),
    );
    existing = new Map(records.map((record) => [record.loginHmacHex, record]));
  }

  const plan: ImportPlan = buildPlan(
    outcome.valid,
    existing,
    (email) => blindIndexOfNormalised(email).toString('hex'),
    newAlumniId,
  );
  const preview = buildPreview(plan);

  const terminal = renderTerminal(preview, sheet.sheetName, outcome.rejected.length, outcome.warnings.length);
  assertNothingLeaked(terminal, plan);
  process.stdout.write(terminal);

  if (outcome.rejected.length > 0) {
    process.stdout.write(`  Rejected rows (not imported):\n`);
    for (const problem of outcome.rejected.slice(0, 25)) {
      process.stdout.write(`    row ${problem.rowNumber}: ${problem.field} — ${problem.reason}\n`);
    }
    if (outcome.rejected.length > 25) process.stdout.write(`    … and ${outcome.rejected.length - 25} more.\n`);
    process.stdout.write('\n');
  }

  const report: RunReport = {
    at: new Date().toISOString(),
    sheet: { name: sheet.sheetName, headers: sheet.headers.length, dataRows: sheet.rows.length },
    mapping: mapping.explain.map(({ key, column, header }) => ({ field: key, column, header })),
    unusedHeaders: mapping.unusedHeaders,
    counts: {
      ...preview.counts,
      validRows: outcome.valid.length,
      rejectedRows: outcome.rejected.length,
      warnings: outcome.warnings.length,
      newGrants: plan.newGrants.length,
      withoutLogin: plan.withoutLogin,
    },
    rejected: outcome.rejected,
    warnings: outcome.warnings,
    applied: false,
  };

  const secrets = outcome.valid.flatMap((row) => [row.contact, row.gmail, row.formEmail, row.otherInfo].filter(Boolean) as string[]);

  if (dryRun) {
    assertReportIsClean(report, secrets);
    process.stdout.write(`  Report: ${writeReport(report)}\n  Dry run — nothing was written.\n\n`);
    return;
  }

  // --- confirmation, on 127.0.0.1 only ---------------------------------------
  const token = randomBytes(24).toString('base64url');
  const origin = `http://127.0.0.1:${port}`;

  await new Promise<void>((resolve) => {
    const server = createServer((req, res) => {
      // A DNS-rebinding page resolves its own hostname to 127.0.0.1 and then
      // talks to whatever is listening. Pinning the Host header closes that,
      // and costs one comparison.
      const host = req.headers.host ?? '';
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
        res.writeHead(421).end('Wrong host.');
        return;
      }

      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'");
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');

      if (req.method === 'GET' && req.url === '/') {
        const html = page(preview, token, null);
        assertNothingLeaked(html, plan);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
        return;
      }

      if (req.method === 'POST' && req.url === '/apply') {
        if (req.headers.origin && req.headers.origin !== origin) {
          res.writeHead(403).end('Bad origin.');
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 4096) req.destroy();
        });
        req.on('end', () => {
          void (async () => {
            if (new URLSearchParams(body).get('token') !== token) {
              res.writeHead(403).end('Bad token.');
              return;
            }
            try {
              const result = await applyPlan(sql!, plan);
              report.applied = true;
              report.result = result;
              assertReportIsClean(report, secrets);
              const path = writeReport(report);
              const message = `Imported: ${result.inserted} new, ${result.updated} updated, ${result.grantsAdded} allowlist entries added, ${result.grantsLeftAlone} already present.`;
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page(preview, token, message));
              process.stdout.write(`\n  ${message}\n  Report: ${path}\n\n`);
              setTimeout(() => { server.close(); resolve(); }, 1500);
            } catch (error) {
              process.stderr.write(`\n  Import failed, nothing was written: ${(error as Error).message}\n\n`);
              res.writeHead(500).end('Import failed. Nothing was written. See the terminal.');
              setTimeout(() => { server.close(); resolve(); }, 500);
            }
          })();
        });
        return;
      }

      res.writeHead(404).end('Not found.');
    });

    server.listen(port, '127.0.0.1', () => {
      process.stdout.write(`  Review and confirm at ${origin}\n  Press Ctrl-C to cancel — nothing is written until you click.\n\n`);
    });
  });

  await sql?.end({ timeout: 5 });
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).message}\n\n`);
  process.exit(1);
});
