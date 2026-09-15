/**
 * The access-request queue.
 *
 * Someone who is not in the original spreadsheet — or whose address has changed
 * — asks for access from the public contact page, verifies the address with a
 * one-time code, and lands here. Approving inserts their address into the
 * allowlist; nothing else does.
 *
 * The form that creates these rows is Phase 7, so until then this screen is
 * correct and empty. That is worth showing rather than hiding: an admin who
 * finds the queue already built knows where requests will appear.
 *
 * ## Two things surfaced next to every request
 *
 * **Whether the address matched a directory record.** A request from an address
 * already in the spreadsheet is almost always an alumnus who cannot sign in,
 * not a stranger — a different decision, so it is shown rather than left for
 * the admin to go and check.
 *
 * **Whether the address is verified.** An unverified request cannot be
 * approved. Without the one-time code, anyone could put someone else's address
 * into the allowlist by typing it into a form.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { approveRequest, rejectRequest } from '@/app/actions/admin-actions';
import { canActNow } from '@/lib/guard';
import { listAccessRequests, maskEmail } from '@/lib/queries';

export const metadata: Metadata = { title: 'Access requests — SXCCAA Admin' };

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Refused' },
  { key: 'all', label: 'All' },
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'pending' } = await searchParams;
  const active = TABS.some((tab) => tab.key === status) ? status : 'pending';

  const [requests, fresh] = await Promise.all([listAccessRequests(active), canActNow()]);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Moderation</p>
        <h1>Access requests</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Approving adds an address to the sign-in allowlist. It is the only thing that does, apart
          from the spreadsheet import.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <div className="row" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <a
            key={tab.key}
            className={`btn btn--small ${tab.key === active ? '' : 'btn--ghost'}`}
            href={`/requests?status=${tab.key}`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="card">
        {requests.length === 0 ? (
          <div className="empty">
            <p style={{ margin: 0 }}>Nothing here.</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              Requests arrive from the contact form on the public site, once an applicant has
              confirmed their address with a one-time code.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Address</th>
                <th>Reason</th>
                <th>Match</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.name}</strong>
                    <div className="small muted">
                      {request.batchYear ? `Class of ${request.batchYear}` : 'Batch not given'}
                      {request.stream ? ` · ${request.stream}` : ''}
                    </div>
                    <div className="small muted">{request.createdAt.toLocaleDateString('en-GB')}</div>
                  </td>

                  <td>
                    <span className="mono">{request.email ? maskEmail(request.email) : '—'}</span>
                    <div style={{ marginTop: 4 }}>
                      {request.verified ? (
                        <span className="badge badge--good">Verified</span>
                      ) : (
                        <span className="badge badge--warn">Not verified</span>
                      )}
                      {request.alreadyGranted && <span className="badge badge--accent">Already has access</span>}
                    </div>
                  </td>

                  <td style={{ maxWidth: 280 }}>
                    <span className="small">{request.reason ?? <span className="muted">None given</span>}</span>
                  </td>

                  <td>
                    {request.matchedAlumniId ? (
                      <a className="small" href={`/alumni/${request.matchedAlumniId}`}>
                        {request.matchedAlumniName}
                      </a>
                    ) : (
                      <span className="small muted">No directory record</span>
                    )}
                  </td>

                  <td>
                    {request.status === 'pending' ? (
                      <div className="row">
                        {request.verified ? (
                          <ActionForm
                            action={approveRequest}
                            submitLabel="Approve"
                            variant="primary"
                            inline
                            hidden={{ requestId: request.id }}
                            confirmText={`Grant ${request.name} access to the alumni directory? They will be emailed a sign-in link.`}
                          />
                        ) : (
                          <span className="small muted">Cannot approve until verified</span>
                        )}
                        <ActionForm
                          action={rejectRequest}
                          submitLabel="Refuse"
                          variant="danger"
                          inline
                          hidden={{ requestId: request.id }}
                          confirmText={`Refuse this request? ${request.name} gets a neutral email with no reason given.`}
                        />
                      </div>
                    ) : (
                      <span className={`badge ${request.status === 'approved' ? 'badge--good' : ''}`}>
                        {request.status === 'approved' ? 'Approved' : 'Refused'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
