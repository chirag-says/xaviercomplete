/**
 * Deleting an alumnus, permanently.
 *
 * ## The position this reverses
 *
 * The record page used to say, in as many words, "There is no delete button, and
 * that is deliberate." The reasoning was sound and is still mostly right:
 * archiving takes somebody out of the directory while keeping the consent note
 * and the audit trail, and for nearly every case — they asked to be unlisted,
 * the record turned out to be wrong, somebody was added twice — archive is the
 * correct answer and this function is not.
 *
 * What that position got wrong is the case it did not cover. Under the DPDP Act
 * a data principal may withdraw consent and ask to be erased, and the
 * Association then has to actually erase them. "We keep an archived copy
 * forever" is not a lawful response to that request. Refusing to build the
 * button did not make the obligation go away; it made the obligation something
 * only a developer with database access could discharge, which is worse —
 * ad hoc SQL typed against production, by hand, under time pressure, with no
 * audit entry.
 *
 * So: the button exists, archive is still the default the page recommends, and
 * this path is the deliberate one.
 *
 * ## Why this is not one `delete from alumni`
 *
 * Four tables hold a row per person keyed by the **hash of their address**, not
 * by the alumnus id: `access_grant`, `access_request`, `session`, `login_token`.
 * A hash cannot carry a foreign key back to a row it does not reference, so
 * `on delete cascade` cannot reach them and Postgres will not warn you.
 *
 * Deleting only the `alumni` row therefore leaves a **ghost**: no directory
 * record, but a live access grant, valid sessions, and any unspent magic link
 * still working. The person could sign in to a directory that has no idea who
 * they are. It also leaves their email hash — which is personal data, and is
 * the whole point of the erasure — sitting in four tables.
 *
 * `alumni_photo` is the exception and does cascade, because it keys on the id.
 * Verified against `pg_constraint` rather than assumed.
 *
 * ## Why the audit entry does not record the name
 *
 * It records who deleted what, when, and how many rows went — but not who the
 * person was. An erasure that leaves the name behind in an audit log is not an
 * erasure, and an audit log is exactly the kind of place a name survives one.
 * The opaque id is retained and ties this entry to the `alumni_created` entry
 * from when the record was made; neither contains anything identifying.
 *
 * The cost is real and worth stating plainly: after this runs, the audit trail
 * can prove a record was deleted and by whom, but cannot reconstruct who it
 * described. That is the trade erasure demands.
 */

import { adminDb, type Sql } from './db.ts';
import { audit } from './shared.ts';

export interface DeleteCounts {
  grants: number;
  requests: number;
  sessions: number;
  loginTokens: number;
  photos: number;
}

export type DeleteOutcome =
  | { ok: true; counts: DeleteCounts }
  | { ok: false; message: string };

/**
 * Erase one alumnus and everything keyed to them.
 *
 * `confirmName` must match the record's stored name. The browser asks for it
 * too, but the check that matters is this one: a confirmation enforced only in
 * the page is not a control, it is a suggestion, and this is the one action in
 * the portal that cannot be undone by a second click.
 */
export async function deleteAlumnus(
  id: string,
  confirmName: string,
  adminId: string,
  sql: Sql = adminDb(),
): Promise<DeleteOutcome> {
  const rows = await sql<Array<{ full_name: string; gmail_hmac: Buffer | null }>>`
    select full_name, gmail_hmac from alumni where id = ${id} limit 1
  `;
  const person = rows[0];
  if (!person) return { ok: false, message: 'No such record — it may already have been deleted.' };

  // Compared on trimmed, case-folded text. Requiring the exact casing of a name
  // somebody is reading off the screen adds no safety and fails honest attempts.
  if (confirmName.trim().toLowerCase() !== person.full_name.trim().toLowerCase()) {
    return { ok: false, message: 'That name does not match the record. Nothing was deleted.' };
  }

  const counts: DeleteCounts = { grants: 0, requests: 0, sessions: 0, loginTokens: 0, photos: 0 };

  /*
   * One transaction. A half-finished erasure is the worst outcome available
   * here — the directory row gone and the sign-in grant still standing is
   * precisely the ghost described above, and nobody would be looking for it.
   */
  await sql.begin(async (tx) => {
    const photos = await tx`delete from alumni_photo where alumni_id = ${id} returning 1`;
    counts.photos = photos.length;

    if (person.gmail_hmac) {
      const hmac = person.gmail_hmac;
      counts.loginTokens = (await tx`delete from login_token where email_hmac = ${hmac} returning 1`).length;
      counts.sessions = (await tx`delete from session where email_hmac = ${hmac} returning 1`).length;
      counts.grants = (await tx`delete from access_grant where email_hmac = ${hmac} returning 1`).length;
      counts.requests = (await tx`delete from access_request where email_hmac = ${hmac} returning 1`).length;
    }

    const gone = await tx`delete from alumni where id = ${id} returning 1`;
    if (gone.length === 0) {
      // Deleted by somebody else between the read and here. Roll back rather
      // than leave their grants destroyed and the record standing.
      throw new Error('record disappeared mid-delete');
    }
  });

  await audit(
    {
      actorType: 'admin',
      actorId: adminId,
      action: 'alumni_deleted',
      targetType: 'alumni',
      targetId: id,
      // Counts only — see the note at the top of this file.
      meta: { ...counts, had_login: person.gmail_hmac !== null },
    },
    sql,
  );

  return { ok: true, counts };
}
