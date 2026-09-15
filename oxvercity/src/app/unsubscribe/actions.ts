'use server';

/**
 * Setting the opt-out flag, for someone who is not signed in.
 *
 * The token is re-checked here and not merely on the page that rendered the
 * button. A server action is a POST endpoint like any other — anybody can call
 * it with any id — so a check that happened only during render would be a check
 * an attacker skips by not rendering.
 */

import { redirect } from 'next/navigation';

import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { unsubscribeTokenMatches } from '@/lib/core/hmac';
import { isAlumniId } from '@/lib/core/ids';
import { ipSubject } from '@/lib/request';
import { headers } from 'next/headers';

export async function optOutOfMail(formData: FormData): Promise<void> {
  const id = formData.get('id');
  const token = formData.get('t');

  if (typeof id !== 'string' || !isAlumniId(id) || !unsubscribeTokenMatches(id, token)) {
    redirect('/unsubscribe');
  }

  // Idempotent, and deliberately so: a second click, a double submit and a
  // re-clicked link from an old email must all be "you are unsubscribed"
  // rather than an error about a state the visitor cannot see.
  await db()`
    update alumni
       set email_opt_out = true,
           email_opt_out_at = coalesce(email_opt_out_at, now())
     where id = ${id} and email_opt_out = false
  `;

  await audit({
    actorType: 'alumnus',
    actorId: id,
    action: 'email_opt_out',
    targetType: 'alumni',
    targetId: id,
    ipHash: ipSubject(await headers()),
  });

  redirect(`/unsubscribe?done=1`);
}
