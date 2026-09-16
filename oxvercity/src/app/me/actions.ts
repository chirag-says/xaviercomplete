'use server';

/**
 * Everything an alumnus can change about themselves.
 *
 * Each action resolves the record from the session's blind index and takes no
 * id from the caller (see the header of src/lib/me.ts). Rate limits are the
 * ones in plan §6.3: twenty saves an hour, five photograph uploads a day.
 *
 * These are Next server actions, which validate the request Origin themselves.
 * That is what middleware sends `Referrer-Policy: same-origin` rather than
 * `no-referrer` for: under `no-referrer` Chrome serialises the Origin header of
 * a form POST as the literal string `null`, Next parses it as a URL, and every
 * action here returns a 500. The header is set once for the whole site — there
 * is no per-path exception, and none is needed. See the note in middleware.ts.
 */

import { revalidatePath } from 'next/cache';

import { LIMITS, consume } from '@/lib/rate-limit';
import { currentSession } from '@/lib/session-cookie';
import { MAX_UPLOAD_BYTES } from '@/lib/photo';
import { removeOwnPhoto, saveOwnPhoto, saveOwnProfile, setOwnVisibility } from '@/lib/me';

export type MeResult = { ok: true; message: string } | { ok: false; error: string };

const SIGNED_OUT = 'Your session has ended. Sign in again.';

/** A rate-limit subject tied to the session, not the IP — the limit is per person. */
async function sessionSubject(): Promise<{ session: Awaited<ReturnType<typeof currentSession>>; subject: Buffer } | null> {
  const session = await currentSession();
  if (!session) return null;
  return { session, subject: session.emailHmac };
}

export async function saveProfile(_prev: unknown, formData: FormData): Promise<MeResult> {
  const context = await sessionSubject();
  if (!context?.session) return { ok: false, error: SIGNED_OUT };

  const limit = await consume(context.subject, LIMITS.profileSaveHour);
  if (!limit.allowed) {
    return { ok: false, error: 'That is a lot of saves in one hour. Try again shortly.' };
  }

  const text = (name: string): string | null => {
    const raw = formData.get(name);
    return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
  };

  const result = await saveOwnProfile(context.session, {
    currentOrg: text('currentOrg'),
    designation: text('designation'),
    previousRole: text('previousRole'),
    otherInfo: text('otherInfo'),
    contact: text('contact'),
    showContact: formData.get('showContact') === 'on',
    showGmail: formData.get('showGmail') === 'on',
    photoAudience: formData.get('photoAudience') === 'alumni' ? 'alumni' : 'public',
  });

  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath('/me');
  revalidatePath('/alumni');

  // Says what is now true rather than "saved". A toggle whose effect you cannot
  // see is a toggle people get wrong (plan §7.2).
  const parts = [
    result.profile.showContact ? 'your number is visible to signed-in Xaverians' : 'your number is hidden',
    result.profile.showGmail ? 'your email is visible to signed-in Xaverians' : 'your email is hidden',
  ];
  return { ok: true, message: `Saved — ${parts.join(', ')}.` };
}

export async function uploadPhoto(_prev: unknown, formData: FormData): Promise<MeResult> {
  const context = await sessionSubject();
  if (!context?.session) return { ok: false, error: SIGNED_OUT };

  const limit = await consume(context.subject, LIMITS.photoUploadDay);
  if (!limit.allowed) {
    return { ok: false, error: 'You have uploaded a few photographs today. Try again tomorrow.' };
  }

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image first.' };
  }
  // A cheap first stop. `processPhoto` checks again on the bytes it actually
  // receives, because `File.size` is as trustworthy as any other client claim.
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That image is larger than 15 MB. Most phones can export a smaller copy.' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await saveOwnPhoto(context.session, bytes, file.type || undefined);
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath('/me');
  return {
    ok: true,
    message: 'Uploaded. It is on your card now.',
  };
}

export async function deletePhoto(): Promise<MeResult> {
  const session = await currentSession();
  if (!session) return { ok: false, error: SIGNED_OUT };

  const removed = await removeOwnPhoto(session);
  if (!removed) return { ok: false, error: 'There is no directory record for this address yet.' };

  revalidatePath('/me');
  revalidatePath('/alumni');
  return { ok: true, message: 'Photograph removed.' };
}

export async function setVisibility(_prev: unknown, formData: FormData): Promise<MeResult> {
  const session = await currentSession();
  if (!session) return { ok: false, error: SIGNED_OUT };

  const visible = formData.get('visible') === 'true';
  const done = await setOwnVisibility(session, visible);
  if (!done) return { ok: false, error: 'There is no directory record for this address yet.' };

  revalidatePath('/me');
  revalidatePath('/alumni');
  return {
    ok: true,
    message: visible
      ? 'You are listed in the directory again.'
      : 'You have been removed from the directory. Nobody can see your profile, and you can undo this here at any time.',
  };
}
