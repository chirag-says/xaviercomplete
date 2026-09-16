/**
 * The access-request queue.
 *
 * Someone who is not in the original spreadsheet — or whose address has changed
 * — asks for access from the public contact page and lands here. Approving
 * inserts their address into the allowlist; apart from the spreadsheet import,
 * nothing else does.
 *
 * ## Nothing here has confirmed an address, and the screen says so
 *
 * This page used to print a green "Verified" badge and refuse to approve
 * without it. The one-time code behind that badge was removed when the public
 * form became single-step, but the badge was not: `submitAccessRequest` kept
 * stamping `email_verified_at`, so every request arrived marked as proven and
 * the gate passed every time. The word on screen meant nothing, on the one
 * screen where somebody decides whether a stranger may read five hundred
 * people's contact details.
 *
 * So the badge is gone. Every request now states plainly that the address is
 * unconfirmed, and approving requires the admin to tick that they have
 * satisfied themselves some other way. That tick is not security theatre with a
 * different label: it is the honest shape of the decision, which was always a
 * human judgement (plan §7.3) and is now presented as one.
 *
 * ## What is still surfaced next to every request
 *
 * **Whether the address matched a directory record.** A request from an address
 * already in the spreadsheet is almost always an alumnus who cannot sign in,
 * not a stranger. A different decision, so it is shown rather than left for the
 * admin to go and check — and it is the single most useful signal on this page
 * now that the badge is gone.
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
          from the spreadsheet import. Nothing here has proved who is behind an address — the form
          is open to anyone — so the match against the directory, and what the applicant wrote, are
          the evidence you have.
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
              Requests arrive from the contact form on the public site. Anyone can submit one for
              any address, so treat what a request says about itself as a claim, not a fact.
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
                      {/*
                        Stated on every row rather than once at the top of the
                        page. A caveat in a header is read on the first visit and
                        never again; this decision is taken one row at a time.
                      */}
                      <span className="badge badge--warn">Address not confirmed</span>
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
                        <ActionForm
                          action={approveRequest}
                          submitLabel="Approve"
                          variant="primary"
                          inline
                          hidden={{ requestId: request.id }}
                          confirmText={`Grant ${request.name} access to the alumni directory? They will be able to read every signed-in Xaverian's contact details.`}
                        >
                          {/*
                            Required, and checked again in the action — a
                            `required` attribute is a convenience for the person
                            using the page, not a control. Nothing in this system
                            has confirmed who is behind that address, so the
                            acknowledgement is the only honest gate there is.
                          */}
                          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', maxWidth: 260 }}>
                            <input type="checkbox" name="confirmed" value="yes" required />
                            <span>I have satisfied myself this is the person they say they are.</span>
                          </label>
                        </ActionForm>
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
