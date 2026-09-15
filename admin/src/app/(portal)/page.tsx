/**
 * Dashboard — counts only.
 *
 * Deliberately no names, no addresses, no recent-activity feed naming people.
 * This is the screen most likely to be open on a shared laptop or shown on a
 * call, so it answers "is anything waiting for me?" and nothing else.
 */

import type { Metadata } from 'next';

import { dashboardCounts } from '@/lib/queries';

export const metadata: Metadata = { title: 'Dashboard — SXCCAA Admin' };

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'warn' | 'good' }) {
  return (
    <div className="stat">
      <div className="stat__n" style={tone === 'warn' && n > 0 ? { color: 'var(--warn)' } : undefined}>{n}</div>
      <div className="stat__l">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const c = await dashboardCounts();

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Overview</p>
        <h1>Dashboard</h1>
      </div>

      <h2 style={{ marginBottom: 12 }}>Waiting for you</h2>
      <div className="grid">
        <Stat n={c.requestsPending} label="Access requests" tone="warn" />
        <Stat n={c.invitesPending} label="Invitations outstanding" />
        <Stat n={c.messagesUnread} label="Unread messages" tone="warn" />
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>The directory</h2>
      <div className="grid">
        <Stat n={c.alumniVisible} label="Alumni listed" />
        <Stat n={c.alumniHidden} label="Archived" />
        <Stat n={c.grantsLive} label="Can sign in" />
        <Stat n={c.grantsRevoked} label="Access revoked" />
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>This portal</h2>
      <div className="grid">
        <Stat n={c.adminsActive} label="Active admins" />
        <Stat n={c.signInFailures24h} label="Failed sign-ins, 24h" tone="warn" />
      </div>

      {c.adminsActive < 2 && (
        <div className="notice notice--warn" style={{ marginTop: 24 }}>
          <strong>There is only one admin account.</strong> One admin with one phone is one lost phone
          away from a locked portal, and the way back in then runs through a developer&rsquo;s laptop.
          Invite a second super admin from <a href="/admins">Administrators</a>.
        </div>
      )}

    </>
  );
}
