/**
 * The audit log. Read-only, and read-only all the way down.
 *
 * There is no delete button here because there is no delete *grant*: `sxc_admin`
 * can insert and select on `audit_log` and nothing else, and a trigger enforces
 * it besides (0001, 0002). An audit log with a delete path is not an audit log,
 * and `npm run admin:verify` proves this one has none.
 *
 * Every row is ids and reason codes. If you find a name or a phone number in
 * `meta`, that is a bug in whatever wrote it — the log must not become a second,
 * unwatched copy of the data it exists to protect.
 */

import type { Metadata } from 'next';

import { distinctAuditActions, listAudit } from '@/lib/queries';

export const metadata: Metadata = { title: 'Audit log — SXCCAA Admin' };

/** Actions worth colouring, because they are the ones you scan for. */
const TONE: Record<string, string> = {
  access_granted: 'badge--good',
  access_restored: 'badge--good',
  admin_signed_in: 'badge--good',
  access_revoked: 'badge--danger',
  access_refused: 'badge--danger',
  admin_disabled: 'badge--danger',
  alumni_archived: 'badge--danger',
  admin_sign_in_failed: 'badge--warn',
  admin_step_up_failed: 'badge--warn',
  login_link_refused: 'badge--warn',
  address_revealed: 'badge--warn',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const { action = '', actor = '' } = await searchParams;
  const [rows, actions] = await Promise.all([
    listAudit({ action, actorId: actor, limit: 300 }),
    distinctAuditActions(),
  ]);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Record</p>
        <h1>Audit log</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Append-only. Nothing in this portal can edit or remove a row, including you.
        </p>
      </div>

      <form className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="action">Action</label>
            <select id="action" name="action" defaultValue={action}>
              <option value="">All actions</option>
              {actions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="actor">Actor id</label>
            <input id="actor" name="actor" defaultValue={actor} placeholder="admin or alumni id" />
          </div>
          <button className="btn" type="submit">Filter</button>
          {(action || actor) && <a className="btn btn--ghost" href="/audit">Clear</a>}
        </div>
      </form>

      <div className="card">
        <div className="card__head">
          <h2>{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</h2>
          {rows.length === 300 && <span className="small muted">Showing the most recent 300.</span>}
        </div>

        {rows.length === 0 ? (
          <div className="empty">Nothing matches.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                    {row.at.toLocaleString('en-GB')}
                  </td>
                  <td className="small">
                    <span className="badge">{row.actorType}</span>
                    {row.actorId && <div className="mono muted" style={{ marginTop: 3 }}>{row.actorId.slice(0, 8)}…</div>}
                  </td>
                  <td>
                    <span className={`badge ${TONE[row.action] ?? ''}`}>{row.action}</span>
                  </td>
                  <td className="small mono muted">
                    {row.targetType ? `${row.targetType}` : '—'}
                    {row.targetId && <div>{row.targetId.slice(0, 12)}</div>}
                  </td>
                  <td className="small mono muted" style={{ maxWidth: 280, wordBreak: 'break-word' }}>
                    {Object.keys(row.meta).length > 0 ? JSON.stringify(row.meta) : '—'}
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
