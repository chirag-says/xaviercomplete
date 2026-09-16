/**
 * Alumni records — search and list.
 *
 * The list shows only what the public card shows, plus the flags an admin needs
 * to do their job: whether the record is listed, whether the person can sign in,
 * what they have chosen to share. Contact details are one click away on the
 * record itself, not sprayed across a table of two hundred rows.
 */

import type { Metadata } from 'next';

import { listAlumni } from '@/lib/queries';

export const metadata: Metadata = { title: 'Alumni records — SXCCAA Admin' };

export default async function AlumniListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const { q = '', deleted } = await searchParams;
  const people = await listAlumni(q);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">Directory</p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1>Alumni records</h1>
          <div className="row">
            <a className="btn" href="/alumni/new">Add an alumnus</a>
            <a className="btn btn--ghost" href="/alumni/import">Import from a spreadsheet</a>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>
          Name, batch and stream are edited here and nowhere else — an alumnus cannot change their own
          identity fields, because those are what an access request is matched against.
        </p>
      </div>

      {/*
        The record page redirects here after a deletion, because there is no
        longer a page to stay on. Without this the operator lands on a list with
        no indication anything happened — and the one thing they need to know is
        that it did.
      */}
      {deleted && (
        <div className="notice notice--good">
          Record deleted. Their details, photograph, access and sessions are gone.
        </div>
      )}

      <form className="card" style={{ marginBottom: 16 }}>
        <label htmlFor="q">Search</label>
        <div className="row">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, organisation, designation or batch year"
            style={{ flex: '1 1 300px' }}
          />
          <button className="btn" type="submit">Search</button>
          {q && <a className="btn btn--ghost" href="/alumni">Clear</a>}
        </div>
      </form>

      <div className="card">
        <div className="card__head">
          <h2>{people.length} record{people.length === 1 ? '' : 's'}</h2>
          {people.length === 200 && <span className="small muted">Showing the first 200 — narrow the search.</span>}
        </div>

        {people.length === 0 ? (
          <div className="empty">
            <p style={{ margin: 0 }}>{q ? 'Nothing matches that search.' : 'The directory is empty.'}</p>
            {!q && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                Load it with the ingest tool: <span className="mono">npm run ingest</span> in the public app.
              </p>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Batch</th>
                <th>Role</th>
                <th>Shares</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} style={person.isVisible ? undefined : { opacity: 0.55 }}>
                  <td>
                    <a href={`/alumni/${person.id}`}>
                      {person.fullName ? (
                        <strong>{person.fullName}</strong>
                      ) : (
                        /* Muted rather than bold: this is a gap to be filled,
                           and it should not read as somebody's actual name in a
                           list being scanned. */
                        <strong className="muted">No name — {person.id}</strong>
                      )}
                    </a>
                    <div className="small muted mono">{person.id}</div>
                  </td>
                  <td>
                    {person.batchYear}
                    {person.stream && <div className="small muted">{person.stream}</div>}
                  </td>
                  <td className="small">
                    {[person.designation, person.currentOrg].filter(Boolean).join(', ') || (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {person.showContact && <span className="badge">Number</span>}{' '}
                    {person.showGmail && <span className="badge">Email</span>}
                    {!person.showContact && !person.showGmail && <span className="small muted">Nothing</span>}
                  </td>
                  <td>
                    {person.isVisible ? (
                      <span className="badge badge--good">Listed</span>
                    ) : (
                      <span className="badge badge--danger">Archived</span>
                    )}
                    {!person.hasLogin && <div style={{ marginTop: 4 }}><span className="badge badge--warn">No sign-in</span></div>}
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
