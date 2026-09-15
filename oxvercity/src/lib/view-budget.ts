/**
 * How many profiles one person may open, and what happens when they stop.
 *
 * Plan §1.2 names the trade honestly: once five hundred people can sign in,
 * five hundred people can read five hundred contact details. That is what the
 * directory is *for*, and no control makes it untrue. What a budget does is
 * change the shape of the risk — from "one compromised mailbox quietly exports
 * the whole Association" to "somebody has to work at it for days, leaving a
 * trail the whole way".
 *
 * ## Keyed on the person, not the session
 *
 * Plan §10.4 says "per session". Per session is weaker than it sounds: signing
 * out and back in mints a new session, and a magic link costs nothing but a
 * click. The subject here is the blind index of the signed-in address — the
 * same identity across every device and every sign-in — so the budget cannot be
 * reset by starting again.
 *
 * ## Two clocks, for two different behaviours
 *
 * Sixty an hour catches a script. Two hundred a day catches someone patient
 * enough to pace themselves. A single bucket cannot express both: an hourly
 * refill large enough to allow normal browsing refills to far more than two
 * hundred over a day.
 *
 * ## Only full profiles count
 *
 * The grid is not metered. It carries the five public card fields, which anyone
 * on the internet can already read, so charging for it would punish ordinary
 * browsing to protect nothing. The meter runs on the pages that carry a contact
 * detail.
 */

import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import { LIMITS, consumeAll } from './rate-limit.ts';
import type { Session } from './session.ts';

export interface ViewDecision {
  allowed: boolean;
  /** Whole views left on the tighter of the two clocks. For the soft block's wording. */
  remaining: number;
}

/**
 * Spend one profile view.
 *
 * Both buckets are consumed together so a single request cannot pass the hourly
 * check and then be refused by the daily one having already spent a token from
 * the first.
 */
export async function spendProfileView(session: Session, sql: Sql = db()): Promise<ViewDecision> {
  const decision = await consumeAll(
    [
      { subject: session.emailHmac, limit: LIMITS.profileViewHour },
      { subject: session.emailHmac, limit: LIMITS.profileViewDay },
    ],
    sql,
  );

  if (!decision.allowed) {
    /*
     * Logged at the moment of refusal, not on every view.
     *
     * Auditing each view would write a row per profile per person and turn the
     * audit log into a behavioural record of who looked at whom — a second
     * store of exactly the sensitive relationship data the directory tries not
     * to accumulate. The refusal is the event worth keeping: it is rare, it is
     * the signal an operator would act on, and it names nobody.
     */
    await audit(
      {
        actorType: 'alumnus',
        action: 'profile_view_budget_exhausted',
        meta: { hour_limit: LIMITS.profileViewHour.capacity, day_limit: LIMITS.profileViewDay.capacity },
      },
      sql,
    );
  }

  return { allowed: decision.allowed, remaining: decision.remaining };
}
