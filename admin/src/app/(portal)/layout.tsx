/**
 * The signed-in frame.
 *
 * `requireSettledAdmin` runs here, so every page in this group is behind the
 * session check whether or not its own file remembers to ask — and an admin
 * mid-forced-password-change is bounced to the change screen before they can
 * read anything.
 */

import { Shell } from '@/components/Shell';
import { requireSettledAdmin } from '@/lib/guard';
import { dashboardCounts } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSettledAdmin();
  const counts = await dashboardCounts();

  return (
    <Shell
      admin={admin}
      current=""
      counts={{ '/requests': counts.requestsPending, '/admins': counts.invitesPending, '/messages': counts.messagesUnread }}
    >
      {children}
    </Shell>
  );
}
