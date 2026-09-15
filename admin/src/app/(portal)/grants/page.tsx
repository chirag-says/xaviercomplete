/**
 * The sign-in allowlist.
 *
 * Every address that can sign in to the directory, and nothing else — this is
 * the table that decides who is a Xaverian as far as the site is concerned.
 *
 * ## Why some rows have no address
 *
 * `access_grant` stores an HMAC and nothing else, on purpose: the allowlist is
 * deliberately not a readable list of who is a Xaverian (plan §0.1). An address
 * shown here was recovered from another table that happens to hold it encrypted
 * against the same identity — the directory record, or the access request it
 * came from. A grant matching neither shows only a fingerprint. That is not a
 * gap to be fixed; it is the blind index doing its job.
 *
 * Addresses are masked. Revealing one is a separate, audited action.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { restoreGrant, revokeGrant } from '@/app/actions/admin-actions';
import { canActNow } from '@/lib/guard';
import { listGrants, maskEmail } from '@/lib/queries';

export const metadata: Metadata = { title: 'Access grants — SXCCAA Admin' };

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string }>;
}) {
  const { revoked } = await searchParams;
  const includeRevoked = revoked === '1';

  const [grants, fresh] = await Promise.all([listGrants(includeRevoked), canActNow()]);
  const live = grants.filter((grant) => !grant.revokedAt).length;

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Allowlist</p>
        <h1>Access grants</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          {live} address{live === 1 ? '' : 'es'} can sign in to the directory. Revoking takes effect at
          the next sign-in; a session already open survives until it expires.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <div className="row" style={{ marginBottom: 16 }}>
        <a className={`btn btn--small ${includeRevoked ? 'btn--ghost' : ''}`} href="/grants">
          Live only
        </a>
        <a className={`btn btn--small ${includeRevoked ? '' : 'btn--ghost'}`} href="/grants?revoked=1">
          Include revoked
        </a>
      </div>

      <div className="card">
        {grants.length === 0 ? (
          <div className="empty">
            <p style={{ margin: 0 }}>The allowlist is empty.</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              Run the ingest tool against the Association&rsquo;s spreadsheet, or approve an access request.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Directory record</th>
                <th>Source</th>
                <th>Granted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id} style={grant.revokedAt ? { opacity: 0.55 } : undefined}>
                  <td>
                    {grant.email ? (
                      <span className="mono">{maskEmail(grant.email)}</span>
                    ) : (
                      <>
                        <span className="mono muted">{grant.fingerprint}…</span>
                        <div className="small muted">Not recoverable — see note below</div>
                      </>
                    )}
                  </td>

                  <td>
                    {grant.alumniId ? (
                      <a className="small" href={`/alumni/${grant.alumniId}`}>{grant.alumniName}</a>
                    ) : (
                      <span className="small muted">None</span>
                    )}
                  </td>

                  <td>
                    <span className="badge">{grant.source === 'import' ? 'Spreadsheet' : 'Admin grant'}</span>
                  </td>

                  <td className="small muted">{grant.grantedAt.toLocaleDateString('en-GB')}</td>

                  <td>
                    {grant.revokedAt ? (
                      <div className="row">
                        <span className="badge badge--danger">Revoked</span>
                        <ActionForm
                          action={restoreGrant}
                          submitLabel="Restore"
                          inline
                          hidden={{ grantId: grant.id }}
                          confirmText="Restore access for this address?"
                        />
                      </div>
                    ) : (
                      <ActionForm
                        action={revokeGrant}
                        submitLabel="Revoke"
                        variant="danger"
                        inline
                        hidden={{ grantId: grant.id }}
                        confirmText="Revoke access for this address? They will not be able to sign in again unless it is restored."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <strong>Why some rows show only a fingerprint.</strong> The allowlist stores a one-way hash of
        each address, never the address itself, so that a stolen copy of this database is not a list of
        who attended St Xavier&rsquo;s. Where an address appears above, it was decrypted from the
        directory record or the access request behind it. Where it does not, nobody can recover it —
        including us.
      </div>
    </>
  );
}
