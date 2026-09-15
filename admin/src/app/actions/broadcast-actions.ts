'use server';

/**
 * Composing and sending a mailing.
 *
 * Separate from admin-actions.ts because these are the only actions in the
 * portal that reach outward — every other one changes a row and stops, while
 * these put a message in five hundred mailboxes and cannot be undone once a
 * chunk has gone. Keeping them apart makes that difference visible in the
 * import list of any file that touches them.
 *
 * The three rules from admin-actions.ts hold here too: every mutation is
 * audited with counts and reason codes and never a value, the dangerous action
 * requires step-up, and the actor comes from the session rather than the form.
 */

import { revalidatePath } from 'next/cache';

import {
  MAX_POSTER_UPLOAD_BYTES,
  cancelBroadcast,
  countSegment,
  createBroadcast,
  processPoster,
  readProgress,
  sendChunk,
  type Progress,
  type Segment,
  type SegmentKind,
} from '@/lib/broadcast';
import { MailConfigError, mailConfig } from '@/lib/email';
import { requireSettledAdmin, requireStepUp, StepUpRequired } from '@/lib/guard';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const NEEDS_CONFIRMATION = 'Confirm your password and a code first — the panel at the top of this page.';

async function guarded<T>(fallback: (error: string) => T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StepUpRequired) return fallback(NEEDS_CONFIRMATION);
    if (error instanceof MailConfigError) {
      return fallback(`Email is not configured on this server: ${error.message}`);
    }
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error('[broadcast-actions]', (error as Error).message);
    return fallback('Something went wrong. Nothing was sent.');
  }
}

function segmentFrom(formData: FormData): Segment | null {
  const kind = String(formData.get('segmentKind') ?? '') as SegmentKind;
  if (kind !== 'everyone' && kind !== 'batch' && kind !== 'stream') return null;

  if (kind === 'everyone') return { kind, value: null };

  const raw = formData.get(kind === 'batch' ? 'batchValue' : 'streamValue');
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return null;
  if (kind === 'batch' && !/^\d{4}$/.test(value)) return null;
  return { kind, value };
}

function text(value: FormDataEntryValue | null, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export type CreateResult =
  | { ok: true; broadcastId: string; recipients: number }
  | { ok: false; error: string };

/**
 * Write the mailing down. Sends nothing.
 *
 * Split from sending on purpose: the admin gets a recipient count and a send
 * button rather than discovering how many people they just wrote to. This is
 * the last moment at which "Class of 2015" being mistyped as "everyone" is
 * free to correct.
 */
export async function createBroadcastDraft(_prev: unknown, formData: FormData): Promise<CreateResult> {
  return guarded<CreateResult>(
    (error) => ({ ok: false, error }),
    async () => {
      // Step-up: this reads and decrypts every address in the segment. It is at
      // least as sensitive as revealing one, which already requires it.
      const admin = await requireStepUp();

      // Fail before the work rather than at recipient one, so a server with no
      // mail credentials says so on the compose screen.
      mailConfig();

      const subject = text(formData.get('subject'), 200);
      const body = text(formData.get('body'), 10_000);
      if (subject === '') return { ok: false, error: 'Give the message a subject line.' };
      if (body === '') return { ok: false, error: 'Write something in the message.' };

      const segment = segmentFrom(formData);
      if (!segment) return { ok: false, error: 'Choose who this is going to.' };

      const linkUrlRaw = text(formData.get('linkUrl'), 400);
      if (linkUrlRaw !== '' && !/^https?:\/\//i.test(linkUrlRaw)) {
        return { ok: false, error: 'The link must start with http:// or https://' };
      }
      const linkUrl = linkUrlRaw === '' ? null : linkUrlRaw;
      const linkLabel = text(formData.get('linkLabel'), 60) || null;

      let poster = null;
      const file = formData.get('poster');
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_POSTER_UPLOAD_BYTES) {
          return { ok: false, error: 'That image is larger than 8 MB. Export a smaller copy and try again.' };
        }
        const processed = await processPoster(Buffer.from(await file.arrayBuffer()), file.name);
        if (!processed.ok) return { ok: false, error: processed.message };
        poster = processed;
      }

      const expected = await countSegment(segment);
      if (expected === 0) {
        return {
          ok: false,
          error: 'That selection matches nobody who can be emailed. Check the segment, or the opt-out list.',
        };
      }

      const { id, recipients } = await createBroadcast(
        { subject, body, linkUrl, linkLabel, segment, poster },
        admin.adminId,
      );

      revalidatePath('/broadcasts');
      return { ok: true, broadcastId: id, recipients };
    },
  );
}

export type ChunkResult = { ok: true; progress: Progress } | { ok: false; error: string };

/**
 * Send the next batch of messages and report where the mailing is.
 *
 * The compose screen calls this in a loop. It is deliberately small and
 * idempotent-ish: every call only ever claims rows that are still pending, so
 * a duplicated call sends to the next few people rather than to the same
 * people again.
 */
export async function sendBroadcastChunk(broadcastId: string): Promise<ChunkResult> {
  return guarded<ChunkResult>(
    (error) => ({ ok: false, error }),
    async () => {
      await requireStepUp();

      if (typeof broadcastId !== 'string' || broadcastId === '') {
        return { ok: false, error: 'Unknown mailing.' };
      }

      const progress = await sendChunk(broadcastId);
      if (!progress) return { ok: false, error: 'That mailing no longer exists.' };

      if (progress.done) revalidatePath('/broadcasts');
      return { ok: true, progress };
    },
  );
}

/** Where a mailing has got to, for a page reopened part way through a send. */
export async function broadcastProgress(broadcastId: string): Promise<ChunkResult> {
  return guarded<ChunkResult>(
    (error) => ({ ok: false, error }),
    async () => {
      await requireSettledAdmin();
      const progress = await readProgress(broadcastId);
      if (!progress) return { ok: false, error: 'That mailing no longer exists.' };
      return { ok: true, progress };
    },
  );
}

/** Stop a mailing part way. What has already gone has gone. */
export async function stopBroadcast(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return guarded<ActionResult>(
    (error) => ({ ok: false, error }),
    async () => {
      const admin = await requireStepUp();
      const id = String(formData.get('broadcastId') ?? '');
      const stopped = await cancelBroadcast(id, admin.adminId);

      revalidatePath('/broadcasts');
      return stopped
        ? { ok: true, message: 'Stopped. Messages already sent cannot be recalled.' }
        : { ok: false, error: 'That mailing had already finished.' };
    },
  );
}
