/**
 * The audit log.
 *
 * One rule, and it is absolute: **`meta` never contains personal data.** Log
 * `alumni_id`, not the person's name. Log the field name `show_contact`, not
 * the number behind it. An audit log that leaks the data it exists to protect
 * is worse than no audit log, because it is a second copy nobody is watching.
 *
 * The table is append-only, enforced by a grant and a trigger (0001, 0002).
 * Nothing here can update or delete, and neither can anything else.
 */

import { db, type Sql } from './db.ts';

export type ActorType = 'alumnus' | 'admin' | 'system' | 'anonymous';

/**
 * What `meta` may hold. Narrow on purpose: typing it as `unknown` would let a
 * caller pass an object graph that happens to contain a name or a number, and
 * the compiler would not care.
 */
export type MetaValue = string | number | boolean | null | MetaValue[] | { [key: string]: MetaValue };

export interface AuditEntry {
  actorType: ActorType;
  /** An opaque id — session id, alumni id, admin id. Never an email or a name. */
  actorId?: string | null;
  /** Verb, snake_case, past tense: `login_link_sent`, `session_created`. */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ipHash?: Buffer | null;
  /** Counts, flags, field names, reason codes. Never values. */
  meta?: Record<string, MetaValue>;
}

/**
 * Write one entry.
 *
 * Deliberately swallows its own failures. An audit write that throws would turn
 * a logging problem into a failed sign-in, and the user cannot do anything
 * about either. The error still reaches the server console, where it is
 * someone's job to notice.
 */
export async function audit(entry: AuditEntry, sql: Sql = db()): Promise<void> {
  try {
    await sql`
      insert into audit_log (actor_type, actor_id, action, target_type, target_id, ip_hash, meta)
      values (
        ${entry.actorType},
        ${entry.actorId ?? null},
        ${entry.action},
        ${entry.targetType ?? null},
        ${entry.targetId ?? null},
        ${entry.ipHash ?? null},
        ${sql.json(entry.meta ?? {})}
      )
    `;
  } catch (error) {
    console.error('[audit] failed to write entry', entry.action, (error as Error).message);
  }
}
