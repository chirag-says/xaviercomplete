/**
 * A mailing that was left part way through.
 *
 * Reached from "Continue" in the history. Everything that makes resuming safe
 * lives in the database — each recipient is claimed before its message goes out
 * — so this page needs no state of its own beyond the id, and an admin can
 * finish a mailing from a different machine on a different day.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BroadcastSender } from '@/components/BroadcastSender';
import { StepUpPanel } from '@/components/StepUpPanel';
import { adminDb } from '@/lib/db';
import { canActNow, requireSettledAdmin } from '@/lib/guard';
import { describeSegment, readProgress, type SegmentKind } from '@/lib/broadcast';

export const metadata: Metadata = { title: 'Mailing — SXCCAA Admin' };

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSettledAdmin();
  const { id } = await params;

  const rows = await adminDb()<
    Array<{ subject: string; segment_kind: SegmentKind; segment_value: string | null }>
  >`select subject, segment_kind, segment_value from broadcast where id = ${id} limit 1`;
  const broadcast = rows[0];
  if (!broadcast) notFound();

  const [progress, fresh] = await Promise.all([readProgress(id), canActNow()]);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">{describeSegment(broadcast.segment_kind, broadcast.segment_value)}</p>
        <h1>{broadcast.subject}</h1>
      </div>

      <StepUpPanel fresh={fresh} />

      <BroadcastSender broadcastId={id} initial={progress} subject={broadcast.subject} />

      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn btn--ghost" href="/broadcasts">
          Back to mailings
        </a>
      </div>
    </>
  );
}
