'use server';

/**
 * Everything the portal changes.
 *
 * One file, so the set of things an admin can do to the data is a list you can
 * read in one sitting rather than something scattered across a dozen route
 * handlers.
 *
 * Three rules hold throughout:
 *
 *   1. **Every mutation is audited**, with ids and reason codes and never a
 *      value. An audit row that names the person it describes is a second copy
 *      of the data nobody is watching.
 *   2. **Dangerous actions require step-up.** Granting access, revoking access,
 *      inviting an admin, disabling an admin and revealing an address all call
 *      `requireStepUp()` first (plan §9.3).
 *   3. **The actor comes from the session**, never from the form. There is no
 *      parameter anywhere below that names who is acting.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { adminDb } from '@/lib/db';
import { audit, emailBlindIndex, encryptOptional, fieldContext } from '@/lib/shared';
import { requireSettledAdmin, requireStepUp, requireSuperAdmin, StepUpRequired } from '@/lib/guard';
import { revokeAllAdminSessions } from '@/lib/admin-session';
import { changeOwnPassword, stepUp } from '@/lib/admin-auth';
import { assessPassword } from '@/lib/password';
import { createInvite, revokeInvite as revokeInviteRow } from '@/lib/invite';
import { createAlumnus, grantAlumnusAccess } from '@/lib/alumni-create';
import { deleteAlumnus } from '@/lib/alumni-delete';
import { commitImport, previewImport, MAX_IMPORT_BYTES, type ImportPreview } from '@/lib/alumni-import';
import { accessGrantedEmail, accessRejectedEmail, adminInviteEmail, adminUrl, mailConfig, MailConfigError, send } from '@/lib/email';
import { clientIpHash } from '@/lib/request';
import { markSteppedUp } from '@/lib/admin-session';
import { currentAdmin } from '@/lib/session-cookie';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const NEEDS_CONFIRMATION = 'Confirm your password and a code first — the panel at the top of this page.';

/** Wraps an action so StepUpRequired becomes a message rather than a crash. */
async function guarded(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StepUpRequired) return { ok: false, error: NEEDS_CONFIRMATION };
    // A NEXT_REDIRECT is Next's control flow, not a failure.
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error('[admin-actions]', (error as Error).message);
    return { ok: false, error: 'Something went wrong. Nothing was changed.' };
  }
}

// --- step-up -----------------------------------------------------------------

export async function confirmIdentity(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const admin = await requireSettledAdmin();

  const result = await stepUp(
    admin.adminId,
    { password: formData.get('password'), totpCode: formData.get('code') },
    { ipHash: await clientIpHash() },
  );

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'code_already_used'
          ? 'That code has already been used. Wait for your app to show the next one.'
          : 'That password or code was not right.',
    };
  }

  await markSteppedUp(admin.sessionId);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Confirmed. You can act for the next five minutes.' };
}

// --- access requests ---------------------------------------------------------

export async function approveRequest(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const requestId = String(formData.get('requestId') ?? '');
    const sql = adminDb();

    const rows = await sql<Array<{ id: string; email_hmac: Buffer; email_enc: Buffer; status: string; verified: Date | null }>>`
      select id, email_hmac, email_enc, status, email_verified_at as verified
        from access_request where id = ${requestId} limit 1
    `;
    const request = rows[0];
    if (!request) return { ok: false, error: 'That request no longer exists.' };
    if (request.status !== 'pending') return { ok: false, error: 'That request has already been decided.' };
    if (!request.verified) {
      // The OTP proves the person controls the address. Granting without it
      // would let anyone put someone else's address into the allowlist.
      return { ok: false, error: 'That address has not been verified yet. It cannot be granted.' };
    }

    await sql.begin(async (tx) => {
      // `do nothing` on conflict: if an admin previously revoked this identity,
      // approving a fresh request must not silently resurrect the old row with
      // its old provenance — but nor should it fail. The update below settles it.
      await tx`
        insert into access_grant (email_hmac, source, granted_by, granted_at)
        values (${request.email_hmac}, 'admin_grant', ${admin.adminId}, now())
        on conflict (email_hmac) do update
           set revoked_at = null, granted_by = ${admin.adminId}, granted_at = now(), source = 'admin_grant'
      `;
      await tx`
        update access_request set status = 'approved', decided_by = ${admin.adminId}, decided_at = now()
         where id = ${requestId}
      `;
    });

    await audit(
      {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'access_granted',
        targetType: 'access_request',
        targetId: requestId,
      },
      sql,
    );

    // Sent after the grant is committed, so the link in it always works.
    try {
      const config = mailConfig();
      const { decryptField } = await import('@/lib/shared');
      const email = decryptField(request.email_enc, fieldContext('access_request', request.id, 'email'));
      await send(
        { to: email, ...accessGrantedEmail(`${config.appUrl}/login`, `${config.appUrl}/me`) },
        config,
      );
    } catch (error) {
      console.error('[admin-actions] grant email failed:', (error as Error).message);
      return { ok: true, message: 'Access granted, but the notification email could not be sent.' };
    }

    revalidatePath('/requests');
    return { ok: true, message: 'Access granted and the applicant has been told.' };
  });
}

export async function rejectRequest(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireSettledAdmin();
    const requestId = String(formData.get('requestId') ?? '');
    const sql = adminDb();

    const rows = await sql<Array<{ id: string; email_enc: Buffer; status: string }>>`
      select id, email_enc, status from access_request where id = ${requestId} limit 1
    `;
    const request = rows[0];
    if (!request) return { ok: false, error: 'That request no longer exists.' };
    if (request.status !== 'pending') return { ok: false, error: 'That request has already been decided.' };

    await sql`
      update access_request set status = 'rejected', decided_by = ${admin.adminId}, decided_at = now()
       where id = ${requestId}
    `;
    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'access_refused', targetType: 'access_request', targetId: requestId },
      sql,
    );

    // Neutral wording, no reason, no admin named (decision 4, 10 Sep 2026).
    try {
      const { decryptField } = await import('@/lib/shared');
      const email = decryptField(request.email_enc, fieldContext('access_request', request.id, 'email'));
      await send({ to: email, ...accessRejectedEmail() });
    } catch (error) {
      console.error('[admin-actions] rejection email failed:', (error as Error).message);
    }

    revalidatePath('/requests');
    return { ok: true, message: 'Request refused.' };
  });
}

// --- grants ------------------------------------------------------------------

export async function revokeGrant(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const grantId = String(formData.get('grantId') ?? '');
    const sql = adminDb();

    const rows = await sql`
      update access_grant set revoked_at = now()
       where id = ${grantId} and revoked_at is null
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: 'That grant is already revoked.' };

    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'access_revoked', targetType: 'access_grant', targetId: grantId },
      sql,
    );

    revalidatePath('/grants');
    return {
      ok: true,
      message: 'Access revoked. Any session they already hold stays live until it expires — revoke it from Alumni records if that matters.',
    };
  });
}

export async function restoreGrant(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const grantId = String(formData.get('grantId') ?? '');
    const sql = adminDb();

    const rows = await sql`
      update access_grant set revoked_at = null where id = ${grantId} and revoked_at is not null returning id
    `;
    if (rows.length === 0) return { ok: false, error: 'That grant is already live.' };

    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'access_restored', targetType: 'access_grant', targetId: grantId },
      sql,
    );
    revalidatePath('/grants');
    return { ok: true, message: 'Access restored.' };
  });
}

/**
 * Reveal one masked address.
 *
 * Audited, and deliberately one at a time. There is no "reveal all" — a screen
 * showing five hundred addresses in the clear is a screen that gets
 * screenshotted, and the point of masking is that seeing an address should be a
 * decision rather than a side effect of opening a page.
 */
export async function revealAddress(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const grantId = String(formData.get('grantId') ?? '');
    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'address_revealed', targetType: 'access_grant', targetId: grantId },
      adminDb(),
    );
    revalidatePath('/grants');
    return { ok: true, message: 'Revealed below, and recorded in the audit log.' };
  });
}

// --- alumni records ----------------------------------------------------------

const TEXT_LIMITS: Record<string, number> = {
  fullName: 120,
  stream: 120,
  currentOrg: 200,
  designation: 200,
  previousRole: 400,
};

export async function updateAlumni(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireSettledAdmin();
    const id = String(formData.get('id') ?? '');
    const sql = adminDb();

    const text = (name: string): string | null => {
      const raw = formData.get(name);
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (trimmed === '') return null;
      const limit = TEXT_LIMITS[name];
      return limit ? trimmed.slice(0, limit) : trimmed;
    };

    const fullName = text('fullName');
    if (!fullName) return { ok: false, error: 'A record must have a name.' };

    const batchYear = Number(formData.get('batchYear'));
    if (!Number.isInteger(batchYear) || batchYear < 1900 || batchYear > 2100) {
      return { ok: false, error: 'Batch year must be a four-digit year.' };
    }

    const otherInfo = formData.get('otherInfo');

    /*
     * The contact number is three-state, not two.
     *
     * A blank field means "leave it alone", because the form does not pre-fill
     * the number — rendering it there would put an unmasked phone number back
     * into a page that masks it, and would turn any edit with the field
     * accidentally cleared into a silent deletion. Removing a number is an
     * explicit checkbox instead.
     */
    const typedContact = text('contact');
    const clearContact = formData.get('clearContact') === 'true';

    if (clearContact) {
      await sql`
        update alumni set contact_enc = null, show_contact = false where id = ${id}
      `;
    } else if (typedContact !== null) {
      await sql`
        update alumni set contact_enc = ${encryptOptional(typedContact, fieldContext('alumni', id, 'contact'))}
         where id = ${id}
      `;
    }

    // The identity fields (name, batch, stream) and the login address are admin
    // territory by design — an alumnus cannot edit them on /me (plan §7.1) — so
    // this is the only place they change.
    await sql`
      update alumni set
        full_name      = ${fullName},
        batch_year     = ${batchYear},
        stream         = ${text('stream')},
        current_org    = ${text('currentOrg')},
        designation    = ${text('designation')},
        previous_role  = ${text('previousRole')},
        other_info_enc = ${encryptOptional(
          typeof otherInfo === 'string' && otherInfo.trim() !== '' ? otherInfo.trim().slice(0, 2000) : null,
          fieldContext('alumni', id, 'otherInfo'),
        )}
      where id = ${id}
    `;

    await audit(
      {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'alumni_updated',
        targetType: 'alumni',
        targetId: id,
        // Field names and flags, never values.
        meta: {
          fields: ['full_name', 'batch_year', 'stream', 'current_org', 'designation', 'previous_role', 'other_info'],
          contact: clearContact ? 'cleared' : typedContact !== null ? 'replaced' : 'unchanged',
        },
      },
      sql,
    );

    revalidatePath('/alumni');
    revalidatePath(`/alumni/${id}`);
    return { ok: true, message: 'Record saved.' };
  });
}

export async function setAlumniVisibility(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireSettledAdmin();
    const id = String(formData.get('id') ?? '');
    const visible = formData.get('visible') === 'true';
    const sql = adminDb();

    await sql`update alumni set is_visible = ${visible} where id = ${id}`;
    await audit(
      {
        actorType: 'admin',
        actorId: admin.adminId,
        action: visible ? 'alumni_restored' : 'alumni_archived',
        targetType: 'alumni',
        targetId: id,
      },
      sql,
    );

    revalidatePath('/alumni');
    revalidatePath(`/alumni/${id}`);
    return {
      ok: true,
      message: visible ? 'Record is in the directory again.' : 'Record archived — it has left the directory but is retained.',
    };
  });
}

/**
 * Erase a record permanently.
 *
 * Step-up, and the operator must type the name back. Both, because this is the
 * only action in the portal with nothing on the other side of it: no archive to
 * restore from, no second click that puts it back.
 */
export async function deleteAlumni(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const outcome = await guarded(async () => {
    const admin = await requireStepUp();
    const id = String(formData.get('id') ?? '');
    const confirmName = String(formData.get('confirmName') ?? '');

    if (confirmName.trim() === '') {
      return { ok: false, error: 'Type the name of the person to confirm. Nothing was deleted.' };
    }

    const result = await deleteAlumnus(id, confirmName, admin.adminId);
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/alumni');
    return { ok: true, message: 'deleted' };
  });

  // Redirect only on success, and outside `guarded` — a redirect thrown inside
  // it would be indistinguishable from the failures it is there to report.
  if (outcome.ok) redirect('/alumni?deleted=1');
  return outcome;
}

// --- contact messages --------------------------------------------------------

export async function markMessageRead(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireSettledAdmin();
    const messageId = String(formData.get('messageId') ?? '');
    const sql = adminDb();

    const rows = await sql`
      update contact_message set status = 'read', read_at = coalesce(read_at, now())
       where id = ${messageId} and status = 'unread'
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: 'That message is not unread.' };

    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'message_read', targetType: 'contact_message', targetId: messageId },
      sql,
    );
    revalidatePath('/messages');
    return { ok: true, message: 'Marked as read.' };
  });
}

export async function archiveMessage(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireSettledAdmin();
    const messageId = String(formData.get('messageId') ?? '');
    const sql = adminDb();

    const rows = await sql`
      update contact_message set status = 'archived', read_at = coalesce(read_at, now())
       where id = ${messageId} and status <> 'archived'
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: 'That message is already archived.' };

    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'message_archived', targetType: 'contact_message', targetId: messageId },
      sql,
    );
    revalidatePath('/messages');
    return { ok: true, message: 'Archived.' };
  });
}

/** End every directory session for the person this record belongs to. */
export async function revokeAlumniSessions(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const id = String(formData.get('id') ?? '');
    const sql = adminDb();

    const rows = await sql<Array<{ gmail_hmac: Buffer | null }>>`
      select gmail_hmac from alumni where id = ${id} limit 1
    `;
    const hmac = rows[0]?.gmail_hmac;
    if (!hmac) return { ok: false, error: 'That record has no sign-in address, so it has no sessions.' };

    const ended = await sql`
      update session set revoked_at = now() where email_hmac = ${hmac} and revoked_at is null returning id
    `;
    await audit(
      {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'alumni_sessions_revoked',
        targetType: 'alumni',
        targetId: id,
        meta: { ended: ended.length },
      },
      sql,
    );
    return { ok: true, message: `Ended ${ended.length} session${ended.length === 1 ? '' : 's'}.` };
  });
}

// --- administrators ----------------------------------------------------------

export async function inviteAdmin(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireSuperAdmin();
    const admin = await requireStepUp();

    const identity = emailBlindIndex(formData.get('email'));
    if (!identity.ok) return { ok: false, error: 'That is not a usable email address.' };

    const role = formData.get('role') === 'super_admin' ? 'super_admin' : 'moderator';

    const invite = await createInvite(admin.adminId, identity.normalised, identity.hmac, role);
    if ('error' in invite) {
      return {
        ok: false,
        error:
          invite.error === 'already_an_admin'
            ? 'That address already has an admin account.'
            : 'That address already has an invitation outstanding.',
      };
    }

    try {
      await send({
        to: identity.normalised,
        ...adminInviteEmail(`${adminUrl()}/invite?token=${encodeURIComponent(invite.token)}`, 24),
      });
    } catch (error) {
      /*
       * Undo the invitation rather than leave it lying there.
       *
       * The row was created before the send, because the token has to exist to
       * go in the link. If the send then fails and the row survives, the
       * address is now "already invited" — so the obvious next move, trying
       * again, is refused, and the only way out is to find and revoke an
       * invitation that was never delivered. Withdrawing it here means retrying
       * just works.
       */
      await revokeInviteRow(invite.id, admin.adminId).catch(() => {});

      const message = (error as Error).message;
      console.error('[admin-actions] invite email failed:', message);

      // A configuration fault has a specific fix and an operator needs to know
      // which one it is; a provider rejection usually means the from-address is
      // on a domain that is not verified.
      const misconfigured = error instanceof MailConfigError;
      return {
        ok: false,
        error: misconfigured
          ? `Mail is not configured on this server, so nothing was sent — ${message} Nothing was left behind; fix the configuration and try again.`
          : 'The mail provider refused the message, so nothing was sent. The usual cause is MAIL_FROM being on a domain that is not verified with the provider. Nothing was left behind — fix it and try again.',
      };
    }

    revalidatePath('/admins');
    return { ok: true, message: 'Invitation sent. It works once and expires in 24 hours.' };
  });
}

export async function cancelInvite(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireSuperAdmin();
    const admin = await requireStepUp();
    const ok = await revokeInviteRow(String(formData.get('inviteId') ?? ''), admin.adminId);
    revalidatePath('/admins');
    return ok ? { ok: true, message: 'Invitation withdrawn.' } : { ok: false, error: 'That invitation is no longer outstanding.' };
  });
}

export async function setAdminStatus(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireSuperAdmin();
    const admin = await requireStepUp();
    const targetId = String(formData.get('adminId') ?? '');
    const disable = formData.get('disable') === 'true';
    const sql = adminDb();

    if (targetId === admin.adminId) {
      // Not paternalism: a super admin who disables themselves while they are
      // the only one leaves nobody able to re-enable anyone.
      return { ok: false, error: 'You cannot disable your own account. Ask another super admin.' };
    }

    if (disable) {
      const remaining = await sql<Array<{ count: number }>>`
        select count(*)::int as count from admin_user
         where status = 'active' and role = 'super_admin' and id <> ${targetId}
      `;
      if ((remaining[0]?.count ?? 0) === 0) {
        return { ok: false, error: 'That is the last active super admin. Promote someone else first.' };
      }
    }

    await sql`update admin_user set status = ${disable ? 'disabled' : 'active'} where id = ${targetId}`;
    if (disable) await revokeAllAdminSessions(targetId, sql);

    await audit(
      {
        actorType: 'admin',
        actorId: admin.adminId,
        action: disable ? 'admin_disabled' : 'admin_enabled',
        targetType: 'admin_user',
        targetId,
      },
      sql,
    );

    revalidatePath('/admins');
    return { ok: true, message: disable ? 'Account disabled and every session ended.' : 'Account re-enabled.' };
  });
}

export async function forceAdminSignOut(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireSuperAdmin();
    const admin = await requireStepUp();
    const targetId = String(formData.get('adminId') ?? '');
    const ended = await revokeAllAdminSessions(targetId);
    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'admin_sessions_revoked', targetType: 'admin_user', targetId, meta: { ended } },
      adminDb(),
    );
    revalidatePath('/admins');
    return { ok: true, message: `Ended ${ended} session${ended === 1 ? '' : 's'}.` };
  });
}

// --- own password ------------------------------------------------------------

export async function changePassword(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, error: 'Your session has ended. Sign in again.' };

  const next = formData.get('next');
  const confirm = formData.get('confirm');

  if (typeof next !== 'string' || next !== confirm) {
    return { ok: false, error: 'The two new passwords did not match.' };
  }

  // The current password is required even though the session proves identity: a
  // session left open on an unlocked machine should not be enough to take the
  // account over permanently.
  const proof = await stepUp(
    admin.adminId,
    { password: formData.get('current'), totpCode: formData.get('code') },
    { ipHash: await clientIpHash() },
  );
  if (!proof.ok) {
    return {
      ok: false,
      error:
        proof.reason === 'code_already_used'
          ? 'That code has already been used. Wait for your app to show the next one.'
          : 'Your current password or code was not right.',
    };
  }

  const verdict = await assessPassword(next);
  if (!verdict.ok) return { ok: false, error: verdict.message };

  // Ends every session including this one, so the next page load is a sign-in.
  await changeOwnPassword(admin.adminId, next);
  return { ok: true, message: 'Password changed. Sign in again with the new one.' };
}

// --- photographs -------------------------------------------------------------

/**
 * Take a photograph down.
 *
 * There is no approval queue and no rejection: alumni upload what they like and
 * it is live immediately (migration 0009). This is the one thing left, and it
 * exists for the rare case rather than the routine one — an image that should
 * not be on a page carrying the College's name.
 *
 * Step-up is required. Removing somebody's photograph from a public page is
 * done *to* them rather than for them, and it should cost a moment's
 * deliberation.
 *
 * The bytes are deleted, not hidden. Keeping an image the Association has just
 * judged unsuitable, indefinitely, with nobody looking at it, is the opposite
 * of what taking it down was for. The owner sees "the Association removed this
 * photograph" on their own profile and can upload another immediately — they
 * are not blocked.
 */
export async function removePhoto(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();
    const alumniId = String(formData.get('alumniId') ?? '');
    const sql = adminDb();

    const done = await sql.begin(async (tx) => {
      const rows = await tx`
        update alumni
           set photo_status = 'removed', photo_path = null, photo_reviewed_by = ${admin.adminId},
               photo_updated_at = now()
         where id = ${alumniId} and photo_status = 'live'
        returning id
      `;
      if (rows.length === 0) return false;
      await tx`delete from alumni_photo where alumni_id = ${alumniId}`;
      return true;
    });

    if (!done) return { ok: false, error: 'That record has no photograph showing.' };

    await audit(
      { actorType: 'admin', actorId: admin.adminId, action: 'photo_removed_by_admin', targetType: 'alumni', targetId: alumniId },
      sql,
    );
    revalidatePath(`/alumni/${alumniId}`);
    revalidatePath('/alumni');
    return { ok: true, message: 'Photograph removed and the image deleted. They can upload another.' };
  });
}

// --- adding alumni -----------------------------------------------------------

/**
 * Add one alumnus by hand.
 *
 * Step-up is required. This publishes a named person's employer and, if a
 * number is given, puts a contact detail in front of every signed-in Xaverian.
 * It is not the same kind of action as correcting a typo.
 *
 * Granting sign-in access is a separate tick on the same form, because they are
 * separate decisions: being listed in the directory and being able to read
 * everybody else's contact details are not the same privilege.
 */
export async function addAlumni(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const admin = await requireStepUp();

    const text = (name: string): string | null => {
      const raw = formData.get(name);
      return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
    };

    const consentDate = text('consentAt');
    const parsedDate = consentDate ? new Date(consentDate) : new Date();

    const created = await createAlumnus(
      {
        fullName: text('fullName') ?? '',
        batchYear: Number(formData.get('batchYear')),
        stream: text('stream'),
        currentOrg: text('currentOrg'),
        designation: text('designation'),
        previousRole: text('previousRole'),
        contact: text('contact'),
        email: text('email'),
        otherInfo: text('otherInfo'),
        consentNote: text('consentNote') ?? '',
        // An unparseable date falls back to now rather than failing the whole
        // add — the note is the evidence, the timestamp is a convenience.
        consentAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      },
      admin.adminId,
    );

    if (!created.ok) return { ok: false, error: created.message };

    const wantsAccess = formData.get('grantAccess') === 'on';
    const wantsEmail = formData.get('notify') === 'on';
    let note = 'Added to the directory.';

    /*
     * Asking to email somebody who was not granted access is a contradiction,
     * and it used to resolve silently: the send is nested inside the grant, so
     * leaving "let them sign in" unticked disabled a tick box that stayed
     * ticked on screen and said "Email them now". The operator got a success
     * message and no email, with nothing to connect the two. Say it instead.
     */
    if (!wantsAccess && wantsEmail) {
      note = 'Added to the directory — but not emailed, because you did not tick "let them sign in". There would be nothing for them to sign in to.';
    }

    if (wantsAccess) {
      const granted = await grantAlumnusAccess(created.id, admin.adminId);
      note = granted
        ? 'Added, and they can now sign in.'
        : 'Added — but with no email address there is nothing to grant, so they cannot sign in.';

      if (granted && wantsEmail) {
        try {
          const config = mailConfig();
          const sql = adminDb();
          const { decryptField } = await import('@/lib/shared');
          const rows = await sql<Array<{ gmail_enc: Buffer }>>`
            select gmail_enc from alumni where id = ${created.id} and gmail_enc is not null
          `;
          if (rows[0]) {
            const email = decryptField(rows[0].gmail_enc, fieldContext('alumni', created.id, 'gmail'));
            await send({ to: email, ...accessGrantedEmail(`${config.appUrl}/login`, `${config.appUrl}/me`) }, config);
            // Stamped so the bulk invitation run does not email them a second
            // time with the same news.
            await sql`update alumni set invited_at = now() where id = ${created.id}`;
            note = 'Added, they can sign in, and they have been emailed.';
          }
        } catch (error) {
          console.error('[admin-actions] welcome email failed:', (error as Error).message);
          // `invited_at` is left null deliberately, so the next invitation run
          // picks them up. The record itself is not rolled back: they are a real
          // alumnus who belongs in the directory whether or not a mail server
          // was reachable at the moment somebody typed them in.
          note =
            'Added and they can sign in, but the welcome email could not be sent. They are queued for the next invitation run, so nothing is lost.';
        }
      }
    }

    revalidatePath('/alumni');
    return { ok: true, message: `${note} Open the record to check it.` };
  });
}

// --- importing a spreadsheet -------------------------------------------------

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

/**
 * Parse an uploaded sheet and say what would happen. Writes nothing.
 *
 * The file is read into memory and discarded when this returns. It is never
 * written to disk and its contents never reach a log — the only things that
 * come back are counts, row numbers and the operator's own headers.
 */
export async function previewAlumniImport(_prev: unknown, formData: FormData): Promise<PreviewResult> {
  try {
    await requireSuperAdmin();

    const file = formData.get('sheet');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a spreadsheet first.' };
    if (file.size > MAX_IMPORT_BYTES) {
      return { ok: false, error: 'That file is larger than 5 MB. A spreadsheet of alumni should be far smaller.' };
    }

    const parsed = await previewImport(Buffer.from(await file.arrayBuffer()), file.name);
    return parsed.ok ? { ok: true, preview: parsed.preview } : { ok: false, error: parsed.message };
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error('[admin-actions] import preview failed:', (error as Error).message);
    return { ok: false, error: 'That file could not be read. Export it again as .xlsx or .csv.' };
  }
}

/**
 * Write the rows.
 *
 * Step-up is required: this publishes a lot of people at once, and optionally
 * hands each of them the ability to read everybody else's contact details.
 *
 * The browser sends the file a second time rather than the server holding the
 * parsed rows between preview and commit — see the header of alumni-import.ts.
 */
export async function commitAlumniImport(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await requireSuperAdmin();
    const admin = await requireStepUp();

    const file = formData.get('sheet');
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a spreadsheet first.' };

    const consentNote = String(formData.get('consentNote') ?? '').trim();
    if (!consentNote) {
      return {
        ok: false,
        error: 'Say where the consent for these records can be found before importing them.',
      };
    }

    const rawDate = String(formData.get('consentAt') ?? '');
    const parsedDate = rawDate ? new Date(rawDate) : new Date();

    const outcome = await commitImport(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      admin.adminId,
      {
        grantAccess: formData.get('grantAccess') === 'on',
        consentNote,
        consentAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      },
    );

    if (!outcome.ok) return { ok: false, error: outcome.message };

    const r = outcome.result;
    const parts = [`${r.created} added`];
    if (r.granted) parts.push(`${r.granted} can sign in`);
    if (r.skipped) parts.push(`${r.skipped} already in the directory`);
    if (r.failed.length) parts.push(`${r.failed.length} failed`);

    revalidatePath('/alumni');
    return {
      ok: r.failed.length === 0,
      ...(r.failed.length === 0
        ? { message: `${parts.join(', ')}.` }
        : { error: `${parts.join(', ')}. The failures are listed below — fix them and upload again; rows already added are skipped.` }),
    } as ActionResult;
  });
}
