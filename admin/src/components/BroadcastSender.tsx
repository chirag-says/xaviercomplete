'use client';

/**
 * The send: a button, a bar, and a loop.
 *
 * ## Why the loop runs in the browser
 *
 * Five hundred messages with a poster attached is minutes of work, and a server
 * action that ran for minutes would hit a timeout somewhere between here and
 * the host — leaving a mailing half sent with nothing on screen to say so.
 *
 * So the server sends a small batch and returns where it got to, and this
 * calls it again until nothing is pending. The admin watches a number climb
 * instead of a spinner, and closing the tab pauses the mailing rather than
 * corrupting it: every recipient is claimed in the database before its message
 * goes out, so reopening the page and pressing continue resumes exactly where
 * it stopped and sends nobody twice.
 *
 * Used both by the composer, straight after writing a mailing, and by
 * /broadcasts/<id> for one that was left part way.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { broadcastProgress, sendBroadcastChunk } from '@/app/actions/broadcast-actions';

export interface Progress {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  status: string;
  done: boolean;
}

export function BroadcastSender({
  broadcastId,
  initial,
  subject,
}: {
  broadcastId: string;
  initial: Progress | null;
  subject?: string;
}) {
  const [progress, setProgress] = useState<Progress | null>(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  // The loop reads this to decide whether to keep going. A ref rather than
  // state because the running loop closes over its value and must see a pause
  // the moment it happens, not on the next render.
  const stopped = useRef(false);

  // A page opened cold — the resume route — starts with nothing and asks.
  useEffect(() => {
    if (progress) return;
    let ignore = false;
    broadcastProgress(broadcastId).then((result) => {
      if (ignore) return;
      if (result.ok) setProgress(result.progress);
      else setError(result.error);
    });
    return () => {
      ignore = true;
    };
  }, [broadcastId, progress]);

  const pump = useCallback(async () => {
    setRunning(true);
    setError('');
    stopped.current = false;

    while (!stopped.current) {
      const result = await sendBroadcastChunk(broadcastId);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      setProgress(result.progress);
      if (result.progress.done) break;
    }

    setRunning(false);
  }, [broadcastId]);

  if (!progress) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>{error || 'Loading…'}</p>
      </div>
    );
  }

  const finished = progress.pending === 0;
  const processed = progress.total - progress.pending;
  const percent = progress.total === 0 ? 100 : Math.round((processed / progress.total) * 100);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>
        {finished ? 'Mailing finished' : progress.sent > 0 ? 'Part way through' : 'Ready to send'}
      </h2>

      {subject && (
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          {subject}
        </p>
      )}

      <p className="muted" style={{ marginTop: 0 }}>
        {finished ? (
          <>
            {progress.sent} sent
            {progress.failed > 0 ? `, ${progress.failed} failed` : ''}
            {progress.skipped > 0 ? `, ${progress.skipped} skipped` : ''}.
          </>
        ) : (
          <>
            <strong>{progress.pending}</strong> still to go, of {progress.total}. Sending cannot be
            undone once it starts.
          </>
        )}
      </p>

      {(running || processed > 0) && (
        <>
          <div
            style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.08)', overflow: 'hidden', margin: '16px 0 8px' }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Sending progress"
          >
            <div style={{ width: `${percent}%`, height: '100%', background: 'var(--good)', transition: 'width .3s ease' }} />
          </div>
          <p className="small muted" style={{ margin: '0 0 16px' }}>
            {processed} of {progress.total} processed
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
            {progress.skipped > 0 ? ` · ${progress.skipped} skipped` : ''}
          </p>
        </>
      )}

      <div className="row">
        {!finished && !running && (
          <button className="btn" type="button" onClick={pump}>
            {processed > 0 ? 'Continue sending' : `Send to ${progress.total}`}
          </button>
        )}
        {running && (
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              stopped.current = true;
            }}
          >
            Pause
          </button>
        )}
        {finished && (
          <a className="btn" href="/broadcasts">
            Back to mailings
          </a>
        )}
      </div>

      {running && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Keep this tab open. Pausing or closing it stops after the current batch — nobody is sent
          twice, and continuing picks up where it left off.
        </p>
      )}

      {finished && progress.failed > 0 && (
        <div className="notice notice--warn" style={{ marginTop: 16 }}>
          <strong>{progress.failed} could not be delivered.</strong> Usually a retired or mistyped
          address. The list is built from directory records, so the fix is to correct the address on
          the record.
        </div>
      )}

      {error && (
        <p className="small" style={{ color: 'var(--danger)', marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
