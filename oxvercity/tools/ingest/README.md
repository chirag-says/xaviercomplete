# Ingest tool

Loads the alumni spreadsheet into the database. **Runs on your machine only.**
It is not part of the deployed site, not reachable over the internet, and not
included in the production build — it is not there to reach.

## Use

```bash
npm run ingest -- private-data/alumni.xlsx --dry-run
```

Reads the file, shows a masked preview, writes a report, and touches nothing.
Do this first, every time.

```bash
npm run ingest -- private-data/alumni.xlsx
```

The same preview, plus a confirmation page at `http://127.0.0.1:4317`. Nothing
is written until you click the button. Needs `INGEST_DATABASE_URL` (the
`sxc_ingest` role from `db/migrations/0002_roles.sql`), `DATA_ENCRYPTION_KEYS`
and `EMAIL_HMAC_PEPPER`.

```bash
npm run ingest:sample
```

Writes a synthetic spreadsheet to `private-data/sample-alumni.xlsx` with the same
eleven columns and the same mess — numbers written five ways, "NA", one person
who filled the form twice with their address spelt differently, an unparseable
year. Use it to rehearse before touching the real file.

## Where the file must live

`private-data/`, which is gitignored, or anywhere outside the repository. The
tool **refuses to run** if the file is tracked by git, or is inside the repo and
not ignored. A spreadsheet in version control is one push from being public and
deleting it later does not remove it from history.

It also warns if the path looks like a cloud-synced folder. Sync means a
plaintext copy on someone else's server, which undoes the whole design — no code
here can stop that, so it says so and carries on.

## Why a path argument, not the drop zone in plan §4.1

A browser drop zone means the spreadsheet's bytes travel over HTTP — localhost
or not — and get buffered a second time in a second process. Passing the path
lets this Node process open the file directly from disk, which is exactly what
§4.2 promises: read from disk, never copied, never uploaded. The browser is
still used for the confirmation screen; it just never touches the file.

The confirmation server binds `127.0.0.1` only, pins the `Host` header so a
DNS-rebinding page cannot reach it, checks `Origin`, and requires a one-time
token minted for that run.

## What is masked, and why that rule

> The preview shows exactly what the public site would show, and masks everything else.

Name, batch, stream, organisation and designation are already visible to anyone
on the internet, so showing them reveals nothing new and lets you recognise a
row. Contact numbers, both email columns and the free-text field are masked —
on your own screen. Free text is shown as a character count and never a prefix,
because it is where people write health and family details.

`assertNothingLeaked` re-checks the rendered output against the real values
before anything is printed or served. A masking bug stops the tool rather than
quietly printing the sheet.

## What it decides for you

| Decision | Rule |
|---|---|
| Duplicate rows | Matched on the **normalised** address, so `priya.menon@` and `priyamenon@` are one person. The later row wins — it is the more recent answer. |
| `show_contact` default | ON if they supplied a number, OFF if the cell was blank or "NA". From the form, never assumed. |
| `show_gmail` default | ON. Forced OFF where there is no Gmail, because the database constraint refuses a toggle promising a field that is not there. |
| A blank cell on re-import | Ignored. An absence of information is not an instruction to erase what we hold. |
| A field the alumnus has edited | **Never overwritten.** Reported as skipped so you can see the divergence and decide. |
| An address already on the allowlist | Left alone, including if an admin revoked it. A spreadsheet does not outrank a person's decision. |
| A bad phone number | The person imports, the number does not. Listed in the report. |
| A missing name or unreadable year | Row rejected with a reason pointing at the cell. Never guessed. |

## Reports

`tools/ingest/reports/` (gitignored, mode 0600). Counts, row numbers and error
reasons — no names, numbers, addresses or free text. `assertReportIsClean`
checks that before writing.

## Files

| File | Role |
|---|---|
| `run.ts` | CLI, terminal preview, confirmation server |
| `columns.ts` | Works out which column is which; pure |
| `validate.ts` | Row → clean record or reasons; pure |
| `plan.ts` | Diff against the database; pure |
| `preview.ts` | Masking; pure |
| `push.ts` | Encrypt and write, in one transaction |
| `guard.ts` | Refuses unsafe file locations |
| `workbook.ts` | exceljs reader |
| `report.ts` | Run report |
| `fixtures/make-sample.ts` | Synthetic spreadsheet generator |

Everything marked pure is unit-tested in `tests/ingest-*.test.ts` without a
database, a file, or a key.

## Column mapping

Headers are matched on keywords, because Google Forms writes a question rather
than a label. The mapping it chose is printed before anything happens — check
it. If it gets one wrong, create `tools/ingest/column-map.json`:

```json
{ "contact": "Your mobile number (WhatsApp preferred)" }
```

Keyed by field, valued by the exact header text. No need to edit the sensitive
spreadsheet.
