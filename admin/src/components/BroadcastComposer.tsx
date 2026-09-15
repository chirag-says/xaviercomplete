'use client';

/**
 * Compose a mailing, then hand it to {@link BroadcastSender} to go out.
 *
 * ## Two steps, one page
 *
 * Write, then confirm and send. The second step exists for one number: how many
 * people this is about to reach. "Everyone" and "Class of 2015" are one button
 * apart, and the difference between them is several hundred emails that cannot
 * be recalled — so the count is on screen before anything is written, and again
 * on the send button itself.
 *
 * Preparing a mailing writes the recipient list down without sending anything,
 * which is what makes that confirmation real rather than decorative.
 */

import { useState } from 'react';

import { BroadcastSender, type Progress } from '@/components/BroadcastSender';
import { createBroadcastDraft, type CreateResult } from '@/app/actions/broadcast-actions';

interface Option {
  value: string;
  count: number;
}

export interface ComposerProps {
  batches: Option[];
  streams: Option[];
  everyone: number;
  fresh: boolean;
}

export function BroadcastComposer({ batches, streams, everyone, fresh }: ComposerProps) {
  const [kind, setKind] = useState<'everyone' | 'batch' | 'stream'>('everyone');
  const [batch, setBatch] = useState(batches[0]?.value ?? '');
  const [stream, setStream] = useState(streams[0]?.value ?? '');
  const [posterName, setPosterName] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<{ id: string; progress: Progress } | null>(null);

  const selected =
    kind === 'everyone'
      ? everyone
      : kind === 'batch'
        ? (batches.find((option) => option.value === batch)?.count ?? 0)
        : (streams.find((option) => option.value === stream)?.count ?? 0);

  async function onCompose(formData: FormData) {
    setBusy(true);
    setError('');

    const result: CreateResult = await createBroadcastDraft(null, formData);

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPrepared({
      id: result.broadcastId,
      progress: {
        total: result.recipients,
        sent: 0,
        failed: 0,
        skipped: 0,
        pending: result.recipients,
        status: 'draft',
        done: false,
      },
    });
  }

  if (prepared) {
    return <BroadcastSender broadcastId={prepared.id} initial={prepared.progress} />;
  }

  return (
    <form action={onCompose}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Who is this going to?</h2>

        <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['everyone', 'batch', 'stream'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`btn btn--small ${kind === option ? '' : 'btn--ghost'}`}
              onClick={() => setKind(option)}
            >
              {option === 'everyone' ? 'Everyone' : option === 'batch' ? 'One batch' : 'One stream'}
            </button>
          ))}
        </div>

        <input type="hidden" name="segmentKind" value={kind} />

        {kind === 'batch' && (
          <label className="field">
            <span>Batch</span>
            <select name="batchValue" value={batch} onChange={(event) => setBatch(event.target.value)}>
              {batches.map((option) => (
                <option key={option.value} value={option.value}>
                  Class of {option.value} — {option.count} {option.count === 1 ? 'person' : 'people'}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === 'stream' && (
          <label className="field">
            <span>Stream</span>
            <select name="streamValue" value={stream} onChange={(event) => setStream(event.target.value)}>
              {streams.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} — {option.count} {option.count === 1 ? 'person' : 'people'}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="muted small" style={{ margin: '10px 0 0' }}>
          This reaches <strong>{selected}</strong> {selected === 1 ? 'person' : 'people'}. Anyone who has
          unsubscribed is already excluded and cannot be added back from here.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>The message</h2>

        <label className="field">
          <span>Subject</span>
          <input name="subject" type="text" maxLength={200} required placeholder="You are invited: Annual Reunion 2027" />
        </label>

        <label className="field">
          <span>Message</span>
          <textarea
            name="body"
            rows={9}
            maxLength={10000}
            required
            placeholder={'Dear Xaverian,\n\nThe Association warmly invites you to…\n\nDate, time and venue.\n\nWe hope to see you there.'}
          />
          <span className="hint">
            Leave a blank line between paragraphs. Plain text only — no formatting codes, and anything
            that looks like markup is shown as written rather than interpreted.
          </span>
        </label>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 260px' }}>
            <span>Link (optional)</span>
            <input name="linkUrl" type="url" maxLength={400} placeholder="https://sxccaa.org/events" />
          </label>
          <label className="field" style={{ flex: '1 1 160px' }}>
            <span>Button text</span>
            <input name="linkLabel" type="text" maxLength={60} placeholder="See the details" />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Poster (optional)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Shown inside the email and attached to it, so it arrives even for the many people whose mail
          client blocks images. We re-encode it, which strips the location data a phone camera attaches.
        </p>

        <input
          name="poster"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPosterName(event.target.files?.[0]?.name ?? null)}
        />
        {posterName && (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Attaching <strong>{posterName}</strong>
          </p>
        )}
      </div>

      {!fresh && (
        <div className="notice notice--warn" style={{ marginBottom: 16 }}>
          <strong>Confirm who you are first.</strong> Sending a mailing reads and decrypts every address
          in the segment, so it needs your password and a code — the panel at the top of this page.
        </div>
      )}

      <div className="row">
        <button className="btn" type="submit" disabled={busy || selected === 0}>
          {busy ? 'Preparing…' : `Prepare mailing for ${selected}`}
        </button>
        <a className="btn btn--ghost" href="/broadcasts">
          Cancel
        </a>
      </div>

      <p className="small muted" style={{ marginTop: 10 }}>
        Nothing is sent yet. The next screen shows the final count and a send button.
      </p>

      {error && (
        <p className="small" style={{ color: 'var(--danger)', marginTop: 12 }}>
          {error}
        </p>
      )}
    </form>
  );
}
