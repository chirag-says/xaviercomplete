/**
 * One alumni record, in full.
 *
 * This is the only screen in the system that shows a record whole — the
 * alumnus's own toggles are reported here but not applied, because an admin is
 * the data controller and needs the full record to answer a correction request
 * or a complaint (plan §1).
 *
 * That makes it the most sensitive page in the portal, so:
 *
 *   - contact details are masked until asked for;
 *   - the toggles are shown as *their* decision, not as controls an admin can
 *     flip. Overriding someone's privacy choice from here would make the
 *     promise on /me untrue, and the promise is what the consent rests on;
 *   - archiving is offered instead of deletion, because the audit trail and the
 *     consent record have to survive.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { deleteAlumni, removePhoto, revokeAlumniSessions, setAlumniVisibility, updateAlumni } from '@/app/actions/admin-actions';
import { canActNow } from '@/lib/guard';
import { maskEmail, maskPhone, readAlumni } from '@/lib/queries';

export const metadata: Metadata = { title: 'Alumni record — SXCCAA Admin' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--faint)' }}>
      <div className="small muted" style={{ width: 180, flex: 'none' }}>{label}</div>
      <div className="small" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default async function AlumniRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [person, fresh] = await Promise.all([readAlumni(id), canActNow()]);
  if (!person) notFound();

  // One label for every sentence on this page that names the record. A nameless
  // record still has to be referable to in a confirmation prompt, and its id is
  // the thing that is unique and on screen.
  const label = person.fullName ?? `this record (${person.id})`;

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">
          <a href="/alumni">Alumni records</a> · {person.id}
        </p>
        <h1>{label}</h1>
        <div className="row" style={{ marginTop: 8 }}>
          {person.isVisible ? (
            <span className="badge badge--good">Listed in the directory</span>
          ) : (
            <span className="badge badge--danger">Archived</span>
          )}
          {person.hasLogin ? (
            <span className="badge">Can sign in</span>
          ) : (
            <span className="badge badge--warn">No sign-in address</span>
          )}
          {person.ownerUpdatedAt && <span className="badge badge--accent">Edited by its owner</span>}
        </div>
      </div>

      <StepUpPanel fresh={fresh} />

      {/* What the person chose */}
      <div className="card">
        <div className="card__head">
          <div>
            <h2>What this person has chosen to share</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Their decision, made on their own profile page. It is shown here, not editable here —
              overriding it would make the promise on that page untrue.
            </p>
          </div>
        </div>

        <Row label="Contact number">
          {person.showContact ? (
            <span className="badge badge--good">Shown to signed-in alumni</span>
          ) : (
            <span className="badge">Hidden</span>
          )}
        </Row>
        <Row label="Email address">
          {person.showGmail ? (
            <span className="badge badge--good">Shown to signed-in alumni</span>
          ) : (
            <span className="badge">Hidden</span>
          )}
        </Row>
        <Row label="Photograph">
          {person.photoStatus === 'live' ? (
            <>
              <span className="badge badge--good">Showing</span>{' '}
              <span className="badge">{person.photoAudience === 'public' ? 'Public' : 'Alumni only'}</span>
              {/*
                There is no approval queue — photographs go live the moment they
                are uploaded. This is the rare-case button, not a routine one.
              */}
              <div style={{ marginTop: 8 }}>
                <ActionForm
                  action={removePhoto}
                  submitLabel="Remove this photograph"
                  variant="danger"
                  inline
                  hidden={{ alumniId: person.id }}
                  confirmText={`Remove the photograph on ${label}? The image is deleted, they are told the Association removed it, and they can upload another straight away.`}
                />
              </div>
            </>
          ) : person.photoStatus === 'removed' ? (
            <span className="badge badge--danger">Removed by an administrator</span>
          ) : (
            <span className="small muted">None uploaded</span>
          )}
        </Row>
      </div>

      {/* Confidential */}
      <div className="card">
        <div className="card__head">
          <h2>Confidential</h2>
          <span className="small muted">Masked. These are encrypted at rest.</span>
        </div>

        <Row label="Contact number">
          {person.contact ? <span className="mono">{maskPhone(person.contact)}</span> : <span className="muted">Not supplied</span>}
        </Row>
        <Row label="Sign-in address">
          {person.gmail ? <span className="mono">{maskEmail(person.gmail)}</span> : <span className="muted">None</span>}
        </Row>
        <Row label="Form respondent address">
          {person.formEmail ? <span className="mono">{maskEmail(person.formEmail)}</span> : <span className="muted">None</span>}
        </Row>
        {/* "Other information" is not repeated here — it is editable in full
            below, and rendering it twice doubles the exposure for no gain. */}
        <Row label="Consent recorded">
          {person.consentRecordedAt ? (
            person.consentRecordedAt.toLocaleString('en-GB')
          ) : (
            <span className="badge badge--warn">No consent timestamp</span>
          )}
        </Row>
      </div>

      {/* Edit */}
      <div className="card">
        <div className="card__head">
          <div>
            <h2>Edit</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Name, batch and stream can only be changed here. The sign-in address cannot be changed at
              all from the portal — rewriting it would move the account to a different mailbox.
            </p>
          </div>
        </div>

        <ActionForm action={updateAlumni} submitLabel="Save record" variant="primary" hidden={{ id: person.id }}>
          {/* `required` is gone from both of these, and the empty defaults are
              the point: a record imported from a ragged spreadsheet row may have
              neither. Marking them required would mean an admin could not save a
              correction to somebody's employer without first inventing a name. */}
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              name="fullName"
              defaultValue={person.fullName ?? ''}
              maxLength={200}
              placeholder="Not recorded"
            />
          </div>

          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: '0 1 160px', marginTop: 14 }}>
              <label htmlFor="batchYear">Batch year</label>
              <input
                id="batchYear"
                name="batchYear"
                type="number"
                min={1900}
                max={2100}
                defaultValue={person.batchYear ?? ''}
                placeholder="—"
              />
            </div>
            <div className="field" style={{ flex: '1 1 220px', marginTop: 14 }}>
              <label htmlFor="stream">Stream of study</label>
              <input id="stream" name="stream" defaultValue={person.stream ?? ''} maxLength={200} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="currentOrg">Current organisation</label>
            <input id="currentOrg" name="currentOrg" defaultValue={person.currentOrg ?? ''} maxLength={500} />
          </div>

          <div className="field">
            <label htmlFor="designation">Designation and role</label>
            <input id="designation" name="designation" defaultValue={person.designation ?? ''} maxLength={500} />
          </div>

          <div className="field">
            <label htmlFor="previousRole">Previous organisation / role</label>
            <input id="previousRole" name="previousRole" defaultValue={person.previousRole ?? ''} maxLength={1000} />
          </div>

          {/*
            The contact number is deliberately NOT pre-filled.

            Two reasons, and both are bugs avoided rather than preferences.
            Rendering it as a field value would put the unmasked number straight
            back into the page that masks it three sections above — defeating
            the masking for anyone taking a screenshot or sharing a screen. And
            a pre-filled field that means "save whatever is here" turns an edit
            to somebody's job title into a silent deletion of their phone number
            the moment the field is cleared by accident.

            Blank therefore means "leave it alone", and removing a number is an
            explicit checkbox.
          */}
          <div className="field">
            <label htmlFor="contact">Contact number</label>
            <input
              id="contact"
              name="contact"
              maxLength={40}
              placeholder={person.contact ? `Unchanged (${maskPhone(person.contact)})` : 'None on file'}
            />
            <p className="hint">
              Leave blank to keep what is there. Type a number to replace it.
            </p>
          </div>

          {person.contact && (
            <div className="field">
              <label htmlFor="clearContact" style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                <input id="clearContact" name="clearContact" type="checkbox" value="true" style={{ width: 'auto' }} />
                Remove this number entirely
              </label>
              <p className="hint">
                This also turns off &ldquo;show my number&rdquo;, because a toggle cannot promise a value
                that is no longer there.
              </p>
            </div>
          )}

          <div className="field">
            <label htmlFor="otherInfo">Other information</label>
            <textarea id="otherInfo" name="otherInfo" defaultValue={person.otherInfo ?? ""} maxLength={4000} />
            <p className="hint">Free text the alumnus supplied. Blank clears it.</p>
          </div>
        </ActionForm>
      </div>

      {/* Dangerous */}
      <div className="card">
        <div className="card__head">
          <h2>Directory listing</h2>
        </div>

        <p className="small muted" style={{ marginTop: 0 }}>
          Archiving removes the record from the public directory and from every profile page, but keeps
          it — the consent record and the audit trail survive, and it can be undone. For somebody who
          asked to be unlisted, a record entered twice, or one that turned out to be wrong, this is the
          right button.
        </p>

        <div className="row" style={{ marginTop: 12 }}>
          <ActionForm
            action={setAlumniVisibility}
            submitLabel={person.isVisible ? 'Archive this record' : 'Restore to the directory'}
            variant={person.isVisible ? 'danger' : 'ghost'}
            inline
            hidden={{ id: person.id, visible: person.isVisible ? 'false' : 'true' }}
            confirmText={
              person.isVisible
                ? `Archive ${label}? They disappear from the public directory immediately.`
                : `Restore ${label} to the directory?`
            }
          />

          {person.hasLogin && (
            <ActionForm
              action={revokeAlumniSessions}
              submitLabel="End their open sessions"
              variant="danger"
              inline
              hidden={{ id: person.id }}
              confirmText="Sign this person out of the directory everywhere?"
            />
          )}
        </div>
      </div>

      {/*
        Deletion is a separate card rather than a third button in the row above,
        because it is a different kind of decision. Archiving is reversible and
        taken often; this is neither, and putting them a click apart is worth
        more than the consistency of one tidy row.
      */}
      <div className="card">
        <div className="card__head">
          <h2 style={{ color: 'var(--danger)' }}>Delete permanently</h2>
        </div>

        <p className="small muted" style={{ marginTop: 0, maxWidth: '68ch' }}>
          This erases the record, their photograph, their sign-in access, any open sessions and any
          unused sign-in link. It cannot be undone, and afterwards the audit trail can show that a
          record was deleted and by whom, but not who it described — which is what erasure means.
        </p>
        <p className="small muted" style={{ maxWidth: '68ch' }}>
          Use this when somebody has withdrawn consent and asked to be erased. In every other case
          archive instead: it takes them out of the directory just as completely and keeps the
          Association&rsquo;s record of why they were listed.
        </p>

        <ActionForm
          action={deleteAlumni}
          submitLabel="Delete this record for good"
          variant="danger"
          hidden={{ id: person.id }}
          confirmText={`Permanently delete ${label}? There is no undo.`}
        >
          <div className="field" style={{ maxWidth: 380 }}>
            <label htmlFor="confirmName">
              Type <strong>{person.fullName ?? person.id}</strong> to confirm
            </label>
            <input id="confirmName" name="confirmName" autoComplete="off" required />
          </div>
        </ActionForm>
      </div>
    </>
  );
}
