/**
 * Contact messages received from the public site's enquiry form.
 *
 * Every message that reaches the Association's mailbox is also stored in the
 * database so it can be reviewed here without switching to email. The admin can
 * mark a message as read or archive it; nothing is deleted.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { markMessageRead, archiveMessage } from '@/app/actions/admin-actions';
import { listMessages } from '@/lib/queries';

export const metadata: Metadata = { title: 'Messages — SXCCAA Admin' };

const TABS = [
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'unread' } = await searchParams;
  const active = TABS.some((tab) => tab.key === status) ? status : 'unread';

  const messages = await listMessages(active);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Communication</p>
        <h1>Messages</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Enquiries submitted from the contact form on the public site. Each message is also
          delivered to the Association&rsquo;s mailbox.
        </p>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <a
            key={tab.key}
            className={`btn btn--small ${tab.key === active ? '' : 'btn--ghost'}`}
            href={`/messages?status=${tab.key}`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="card">
        {messages.length === 0 ? (
          <div className="empty">
            <p style={{ margin: 0 }}>No messages here.</p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              Messages arrive when someone submits the contact form on the public site.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sender</th>
                <th>Message</th>
                <th>Source</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg.id} style={msg.status === 'unread' ? { fontWeight: 600 } : undefined}>
                  <td>
                    <div>{msg.name}</div>
                    <div className="small muted" style={{ fontWeight: 400 }}>
                      <a href={`mailto:${msg.email}`}>{msg.email}</a>
                    </div>
                  </td>

                  <td style={{ maxWidth: 380 }}>
                    <span className="small" style={{ fontWeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.message.length > 200
                        ? msg.message.slice(0, 200) + '…'
                        : msg.message}
                    </span>
                  </td>

                  <td>
                    <span className="small muted" style={{ fontWeight: 400 }}>{msg.source ?? '—'}</span>
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="small" style={{ fontWeight: 400 }}>
                      {msg.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <div className="small muted" style={{ fontWeight: 400 }}>
                      {msg.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td>
                    <div className="row">
                      {msg.status === 'unread' && (
                        <ActionForm
                          action={markMessageRead}
                          submitLabel="Mark read"
                          variant="ghost"
                          inline
                          hidden={{ messageId: msg.id }}
                        />
                      )}
                      {msg.status !== 'archived' && (
                        <ActionForm
                          action={archiveMessage}
                          submitLabel="Archive"
                          variant="ghost"
                          inline
                          hidden={{ messageId: msg.id }}
                        />
                      )}
                      {msg.status === 'archived' && (
                        <span className="badge">Archived</span>
                      )}
                    </div>
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
