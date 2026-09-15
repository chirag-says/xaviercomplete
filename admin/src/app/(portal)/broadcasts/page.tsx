/**
 * Mailings — what has been sent, and the way to send another.
 *
 * The history is not decoration. A mailing cannot be recalled, so the only
 * protection against sending the same invitation twice is being able to see
 * that it already went, to whom, and when. It also carries the failure counts,
 * which is the closest thing the Association has to a list of addresses that
 * have gone stale.
 *
 * Subjects are shown. Recipients are not — this screen says "482 people, Class
 * of 2015", never who they were.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { stopBroadcast } from '@/app/actions/broadcast-actions';
import { canActNow } from '@/lib/guard';
import { describeSegment, listBroadcasts, segmentOptions } from '@/lib/broadcast';

export const metadata: Metadata = { title: 'Mailings — SXCCAA Admin' };

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge',
  sending: 'badge badge--warn',
  sent: 'badge badge--good',
  cancelled: 'badge badge--danger',
};

export default async function BroadcastsPage() {
  const [broadcasts, options, fresh] = await Promise.all([
    listBroadcasts(),
    segmentOptions(),
    canActNow(),
  ]);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Email</p>
        <h1>Mailings</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Invite the alumni to an event, or tell them something. {options.everyone}{' '}
          {options.everyone === 1 ? 'person can' : 'people can'} be reached.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <div className="row" style={{ marginBottom: 16 }}>
        <a className="btn" href="/broadcasts/new">
          Write a mailing
        </a>
      </div>

      {(options.unreachableGrants > 0 || options.optedOut > 0) && (
        <div className="notice" style={{ marginBottom: 16 }}>
          {options.optedOut > 0 && (
            <p style={{ margin: 0 }}>
              <strong>{options.optedOut}</strong>{' '}
              {options.optedOut === 1 ? 'person has' : 'people have'} unsubscribed and are excluded from
              every mailing. That choice is theirs and cannot be undone from this portal.
            </p>
          )}
          {options.unreachableGrants > 0 && (
            <p style={{ margin: options.optedOut > 0 ? '8px 0 0' : 0 }}>
              <strong>{options.unreachableGrants}</strong>{' '}
              {options.unreachableGrants === 1 ? 'address' : 'addresses'} can sign in but{' '}
              {options.unreachableGrants === 1 ? 'has' : 'have'} no directory record, so there is nothing
              to mail. Add a record from <a href="/alumni/new">Alumni records</a> to include them.
            </p>
          )}
        </div>
      )}

      <div className="card">
        {broadcasts.length === 0 ? (
          <div className="empty">
            <p style={{ margin: 0 }}>Nothing has been sent yet.</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              A mailing goes to everyone in the directory, or to one batch or stream.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Sent to</th>
                <th>Result</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <td>
                    {broadcast.subject}
                    {broadcast.hasPoster && (
                      <div className="small muted">With a poster</div>
                    )}
                  </td>

                  <td className="small">
                    {describeSegment(broadcast.segmentKind, broadcast.segmentValue)}
                    <div className="muted">
                      {broadcast.total} {broadcast.total === 1 ? 'recipient' : 'recipients'}
                    </div>
                  </td>

                  <td className="small">
                    <span className={STATUS_BADGE[broadcast.status] ?? 'badge'}>{broadcast.status}</span>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {broadcast.sent} sent
                      {broadcast.failed > 0 ? `, ${broadcast.failed} failed` : ''}
                      {broadcast.skipped > 0 ? `, ${broadcast.skipped} skipped` : ''}
                    </div>
                  </td>

                  <td className="small muted">{broadcast.createdAt.toLocaleDateString('en-GB')}</td>

                  <td>
                    {(broadcast.status === 'draft' || broadcast.status === 'sending') && (
                      <div className="row">
                        <a className="btn btn--ghost btn--small" href={`/broadcasts/${broadcast.id}`}>
                          Continue
                        </a>
                        <ActionForm
                          action={stopBroadcast}
                          submitLabel="Stop"
                          variant="danger"
                          inline
                          hidden={{ broadcastId: broadcast.id }}
                          confirmText="Stop this mailing? Messages already sent cannot be recalled."
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <strong>Who a mailing can reach.</strong> Recipients come from directory records, because that is
        where an address is held. The sign-in allowlist stores only a one-way hash — deliberately, so a
        stolen copy is not a list of who attended St Xavier&rsquo;s — and there is no address in it to
        write to. Everyone is sent their own message; no recipient ever sees another&rsquo;s address.
      </div>
    </>
  );
}
