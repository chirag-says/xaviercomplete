/**
 * The portal frame: navigation, who you are, and the step-up indicator.
 *
 * The step-up pill is deliberately visible at all times. Whether the next
 * dangerous action will ask for a password and a code is the sort of thing an
 * admin should be able to see rather than discover.
 */

import { signOut } from '@/app/actions/sign-out';
import type { AdminSession } from '@/lib/admin-session';
import { isStepUpFresh } from '@/lib/admin-session';

const LINKS: Array<{ href: string; label: string; superOnly?: boolean }> = [
  { href: '/', label: 'Dashboard' },
  { href: '/requests', label: 'Access requests' },
  { href: '/messages', label: 'Messages' },
  { href: '/grants', label: 'Access grants' },
  { href: '/alumni', label: 'Alumni records' },
  { href: '/broadcasts', label: 'Mailings' },
  { href: '/audit', label: 'Audit log' },
  { href: '/admins', label: 'Administrators', superOnly: true },
];

export function Shell({
  admin,
  current,
  children,
  counts,
}: {
  admin: AdminSession;
  current: string;
  children: React.ReactNode;
  counts?: Record<string, number>;
}) {
  const fresh = isStepUpFresh(admin);

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <p className="eyebrow">SXCCAA</p>
          <strong>Admin portal</strong>
        </div>

        {LINKS.filter((link) => !link.superOnly || admin.role === 'super_admin').map((link) => {
          const count = counts?.[link.href];
          return (
            <a
              key={link.href}
              className="sidebar__link"
              href={link.href}
              aria-current={link.href === current ? 'page' : undefined}
            >
              {link.label}
              {count ? <span className="badge badge--accent">{count}</span> : null}
            </a>
          );
        })}

        <div className="sidebar__foot">
          <p className="small muted" style={{ margin: '0 10px 4px' }}>
            {admin.role === 'super_admin' ? 'Super admin' : 'Moderator'}
          </p>
          <p style={{ margin: '0 10px 10px' }}>
            <span className={`badge ${fresh ? 'badge--good' : ''}`}>
              {fresh ? 'Confirmed' : 'Confirmation needed'}
            </span>
          </p>
          <a className="sidebar__link" href="/account/password">Change password</a>
          <form action={signOut}>
            <button className="sidebar__link" type="submit" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="main">{children}</main>
    </div>
  );
}
