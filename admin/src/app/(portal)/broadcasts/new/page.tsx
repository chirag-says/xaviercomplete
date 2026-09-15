/**
 * Write a mailing.
 *
 * The segment counts are loaded here rather than fetched by the composer, so
 * the number beside "Class of 2015" is on screen before anything is typed —
 * choosing who to write to is the decision with consequences, and it should not
 * be the one made with the least information.
 */

import type { Metadata } from 'next';

import { BroadcastComposer } from '@/components/BroadcastComposer';
import { StepUpPanel } from '@/components/StepUpPanel';
import { canActNow } from '@/lib/guard';
import { segmentOptions } from '@/lib/broadcast';

export const metadata: Metadata = { title: 'Write a mailing — SXCCAA Admin' };

export default async function NewBroadcastPage() {
  const [options, fresh] = await Promise.all([segmentOptions(), canActNow()]);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Email</p>
        <h1>Write a mailing</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Everyone is sent their own copy, so no recipient sees anyone else&rsquo;s address. Every
          message carries an unsubscribe link.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <BroadcastComposer
        batches={options.batches}
        streams={options.streams}
        everyone={options.everyone}
        fresh={fresh}
      />
    </>
  );
}
