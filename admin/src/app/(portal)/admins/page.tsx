/**
 * Administrators — super admins only.
 *
 * The whole screen is gated on the role, not just the buttons: a moderator does
 * not need to know who else administers the portal, and a list of admin
 * addresses is a phishing target with a very high payoff.
 *
 * Accounts are disabled, never deleted. `admin_user` is referenced by audit
 * rows and by photo reviews, and an audit trail that loses the identity of the
 * person who acted is worth much less than one that keeps it.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { cancelInvite, forceAdminSignOut, inviteAdmin, setAdminStatus } from '@/app/actions/admin-actions';
import { canActNow, requireSuperAdmin } from '@/lib/guard';
import { listPendingInvites } from '@/lib/invite';
import { listAdmins, maskEmail } from '@/lib/queries';

export const metadata: Metadata = { title: 'Administrators — SXCCAA Admin' };

export default async function AdminsPage() {
  const me = await requireSuperAdmin();
  const [admins, invites, fresh] = await Promise.all([listAdmins(), listPendingInvites(), canActNow()]);

  const activeSupers = admins.filter((a) => a.status === 'active' && a.role === 'super_admin').length;

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">This portal</p>
        <h1>Administrators</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          There is no public sign-up. An account exists only because someone here invited it, or
          because it was created on the Association&rsquo;s own machine with the bootstrap command.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      {activeSupers < 2 && (
        <div className="notice notice--warn">
          <strong>Only one active super admin.</strong> If that phone is lost, the way back into this
          portal runs through the bootstrap command on a developer&rsquo;s machine. Invite a second one.
        </div>
      )}

      <div className="card">
        <div className="card__head">
          <div>
            <h2>Invite an administrator</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              They set their own password and enrol their own authenticator. Nothing is created until
              they finish — so an invitation that is never opened leaves no account behind.
            </p>
          </div>
        </div>

        <ActionForm action={inviteAdmin} submitLabel="Send invitation" variant="primary">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 260px' }}>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div style={{ flex: '0 1 180px' }}>
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="moderator">
                <option value="moderator">Moderator</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            A moderator handles access requests and photographs. A super admin can also add and remove
            administrators.
          </p>
        </ActionForm>
      </div>

      {invites.length > 0 && (
        <div className="card">
          <div className="card__head"><h2>Outstanding invitations</h2></div>
          <table>
            <thead>
              <tr><th>Address</th><th>Role</th><th>Expires</th><th /></tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td className="mono">{maskEmail(invite.email)}</td>
                  <td><span className="badge">{invite.role === 'super_admin' ? 'Super admin' : 'Moderator'}</span></td>
                  <td className="small muted">{invite.expiresAt.toLocaleString('en-GB')}</td>
                  <td>
                    <ActionForm
                      action={cancelInvite}
                      submitLabel="Withdraw"
                      variant="danger"
                      inline
                      hidden={{ inviteId: invite.id }}
                      confirmText="Withdraw this invitation? The link stops working immediately."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card__head"><h2>Accounts</h2></div>
        <table>
          <thead>
            <tr>
              <th>Address</th><th>Role</th><th>State</th><th>Last signed in</th><th>Recovery</th><th />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const isMe = admin.id === me.adminId;
              return (
                <tr key={admin.id} style={admin.status === 'active' ? undefined : { opacity: 0.55 }}>
                  <td>
                    <span className="mono">{admin.email ? maskEmail(admin.email) : '—'}</span>
                    {isMe && <span className="badge badge--accent" style={{ marginLeft: 6 }}>You</span>}
                  </td>
                  <td><span className="badge">{admin.role === 'super_admin' ? 'Super admin' : 'Moderator'}</span></td>
                  <td>
                    {admin.status === 'active' ? (
                      <span className="badge badge--good">Active</span>
                    ) : (
                      <span className="badge badge--danger">Disabled</span>
                    )}
                    {admin.lockedUntil && admin.lockedUntil > new Date() && (
                      <div style={{ marginTop: 4 }}><span className="badge badge--warn">Locked</span></div>
                    )}
                    {admin.mustChangePassword && (
                      <div style={{ marginTop: 4 }}><span className="badge badge--warn">Must change password</span></div>
                    )}
                  </td>
                  <td className="small muted">
                    {admin.lastLoginAt ? admin.lastLoginAt.toLocaleDateString('en-GB') : 'Never'}
                    <div>{admin.liveSessions} live session{admin.liveSessions === 1 ? '' : 's'}</div>
                  </td>
                  <td>
                    <span className={`badge ${admin.recoveryCodesLeft <= 2 ? 'badge--warn' : ''}`}>
                      {admin.recoveryCodesLeft} left
                    </span>
                  </td>
                  <td>
                    {!isMe && (
                      <div className="row">
                        <ActionForm
                          action={setAdminStatus}
                          submitLabel={admin.status === 'active' ? 'Disable' : 'Enable'}
                          variant={admin.status === 'active' ? 'danger' : 'ghost'}
                          inline
                          hidden={{ adminId: admin.id, disable: admin.status === 'active' ? 'true' : 'false' }}
                          confirmText={
                            admin.status === 'active'
                              ? 'Disable this account? Every session it holds ends immediately.'
                              : 'Re-enable this account?'
                          }
                        />
                        {admin.liveSessions > 0 && (
                          <ActionForm
                            action={forceAdminSignOut}
                            submitLabel="Sign out"
                            variant="danger"
                            inline
                            hidden={{ adminId: admin.id }}
                            confirmText="End every session for this administrator?"
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <strong>There is no password reset by email.</strong> If an administrator is locked out, another
        super admin invites them again. Email-based reset would make a compromised admin mailbox a full
        breach of this portal, which is the thing two-factor exists to prevent.
      </div>
    </>
  );
}
