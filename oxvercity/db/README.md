# Database

PostgreSQL on Supabase. Migrations are plain SQL, applied in order, by hand.
There is no migration framework: two files a year does not justify one, and a
schema this security-sensitive should be read by a person before it runs.

## Applying

Get the direct connection string from Supabase → Project Settings → Database
(the **session** pooler URI, not the transaction pooler — DDL needs a real
session). Then, from `oxvercity/`:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_schema.sql
```

Then create the roles, with three passwords from your password manager:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v web_password="$WEB_PW" -v admin_password="$ADMIN_PW" -v ingest_password="$INGEST_PW" -f db/migrations/0002_roles.sql
```

`ON_ERROR_STOP=1` matters. Without it psql carries on after a failed statement
and you end up with half a schema and no error worth reading.

Put a leading space before any command containing a password so bash keeps it
out of history, or better, pipe them in from the password manager's CLI.

## What the files do

| File | Purpose |
|---|---|
| `0001_schema.sql` | Tables, constraints, indexes, append-only audit trigger, RLS deny-all |
| `0002_roles.sql` | `sxc_web`, `sxc_admin`, `sxc_ingest` and their grants |

## The two things to understand before editing

**Confidential columns are ciphertext.** `contact_enc`, `gmail_enc`,
`other_info_enc`, `form_email_enc`, `email_enc` and `totp_secret_enc` hold
AES-256-GCM blobs written by `src/lib/core/crypto.ts`. They cannot be read with
SQL, searched with `LIKE`, or indexed on their contents — and that is the
design, not a limitation to work around. If you ever need to match on one, add a
blind index column the way `gmail_hmac` does it.

**The constraints encode the access model.** `show_contact` cannot be true
without a `contact_enc`; `photo_status` cannot claim a photo with no stored
object; an `admin_user` cannot be `active` without a confirmed TOTP. Removing
one of these to make a query pass is removing a guarantee the plan makes to the
client.

## Verifying it worked

After applying, confirm the deny-all layer is really on:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

Every row must read `t`. Then confirm the web role cannot do what it must not:

```sql
set role sxc_web;
update alumni set full_name = 'x';            -- expect: permission denied for column
insert into access_grant (email_hmac, source) values (repeat('\x00'::bytea, 32), 'import');  -- expect: permission denied
update audit_log set action = 'x';            -- expect: audit_log is append-only
reset role;
```

Those three failures are the migration working. Run them once after the first
apply and once after any change to `0002_roles.sql`.

## Backups

Supabase daily backups plus PITR. Before launch, restore one into a scratch
database and confirm `contact_enc` is unreadable ciphertext — that restore is
the proof the whole encryption design does what it claims (plan §10.8).
