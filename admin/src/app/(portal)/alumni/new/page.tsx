/**
 * Add one alumnus by hand.
 *
 * For the Xaverian the spreadsheet missed, or the one who turns up at a chapter
 * dinner. The spreadsheet import is still the right tool for a batch; this is
 * for ones and twos.
 *
 * ## Why consent is a text box and not a tickbox
 *
 * Everything else in this system rests on the Google Form: somebody filled it
 * in, the Timestamp column proves when, and the form's wording proves what they
 * agreed to. A record typed in here has none of that.
 *
 * A tickbox saying "I confirm consent was obtained" would record that somebody
 * ticked a box. What the Association needs, if a record is ever challenged, is
 * *where the consent is* — which file, which email, which conversation. A
 * person can act on that a year later; a boolean cannot.
 */

import type { Metadata } from 'next';

import { ActionForm } from '@/components/ActionForm';
import { StepUpPanel } from '@/components/StepUpPanel';
import { addAlumni } from '@/app/actions/admin-actions';
import { canActNow } from '@/lib/guard';

export const metadata: Metadata = { title: 'Add an alumnus — SXCCAA Admin' };

export default async function NewAlumnusPage() {
  const fresh = await canActNow();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">
          <a href="/alumni">Alumni records</a> · Add
        </p>
        <h1>Add an alumnus</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          Adding somebody publishes their name, batch, stream, organisation and role on the public
          directory straight away. Adding several at once? Use{' '}
          <a href="/alumni/import">import from a spreadsheet</a> instead.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <div className="card">
        <ActionForm action={addAlumni} submitLabel="Add to the directory" variant="primary">
          <h2 style={{ marginBottom: 14 }}>Who they are</h2>

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" maxLength={120} required autoFocus />
            <p className="hint">As the Association would have it on record. This appears publicly.</p>
          </div>

          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '0 1 170px' }}>
              <label htmlFor="batchYear">Year of passing</label>
              <input id="batchYear" name="batchYear" type="number" min={1900} max={2100} placeholder="2011" required />
            </div>
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="stream">Stream of study</label>
              <input id="stream" name="stream" maxLength={120} placeholder="B.Com." />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="currentOrg">Current organisation</label>
            <input id="currentOrg" name="currentOrg" maxLength={200} />
            <p className="hint">Freelance, self-employed, studying, retired — whatever describes it.</p>
          </div>

          <div className="field">
            <label htmlFor="designation">Designation and role</label>
            <input id="designation" name="designation" maxLength={200} />
          </div>

          <div className="field">
            <label htmlFor="previousRole">Previous organisation or role</label>
            <input id="previousRole" name="previousRole" maxLength={400} />
            <p className="hint">Not public. Visible to signed-in Xaverians only.</p>
          </div>

          <h2 style={{ margin: '26px 0 14px' }}>How to reach them</h2>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" />
            <p className="hint">
              This is how they sign in. Leave it blank and they appear in the directory but cannot log
              in — which is fine, and is how the spreadsheet handles people who did not give one.
            </p>
          </div>

          <div className="field">
            <label htmlFor="contact">Contact number</label>
            <input id="contact" name="contact" type="tel" maxLength={40} placeholder="+91 98765 43210" />
            <p className="hint">
              Include the country code. Shown to signed-in Xaverians unless they turn it off on their
              own profile — never to the public.
            </p>
          </div>

          <div className="field">
            <label htmlFor="otherInfo">Other information</label>
            <textarea id="otherInfo" name="otherInfo" maxLength={2000} rows={3} />
          </div>

          <h2 style={{ margin: '26px 0 8px' }}>Consent</h2>
          <p className="small muted" style={{ margin: '0 0 14px', maxWidth: '62ch' }}>
            Every other record in the directory came from the Association&rsquo;s form, where the
            timestamp is the evidence. This one has none, so say where the consent can be found.
            Under the DPDP Act the Association has to be able to show it for every person listed.
          </p>

          <div className="field">
            <label htmlFor="consentNote">Where is the consent?</label>
            <input
              id="consentNote"
              name="consentNote"
              maxLength={500}
              required
              placeholder="Signed form in the 2019 file / email of 4 March, forwarded to the secretary"
            />
            <p className="hint">
              Written for somebody reading it in a year&rsquo;s time who was not in the room.
            </p>
          </div>

          <div className="field">
            <label htmlFor="consentAt">When was it given?</label>
            <input id="consentAt" name="consentAt" type="date" max={today} defaultValue={today} />
          </div>

          <h2 style={{ margin: '26px 0 14px' }}>Access</h2>

          <div className="field">
            <label htmlFor="grantAccess" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontWeight: 400 }}>
              <input id="grantAccess" name="grantAccess" type="checkbox" defaultChecked style={{ width: 'auto', marginTop: 3 }} />
              <span>
                <strong>Let them sign in to the directory.</strong> Being listed and being able to read
                everyone else&rsquo;s contact details are different things — this is the second one.
                Needs an email address above.
              </span>
            </label>
          </div>

          <div className="field">
            <label htmlFor="notify" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontWeight: 400 }}>
              <input id="notify" name="notify" type="checkbox" defaultChecked style={{ width: 'auto', marginTop: 3 }} />
              <span>
                <strong>Email them now.</strong> Tells them they are listed and links to their own
                profile so they can change what others see. If you leave this off they will be included
                in the next bulk invitation run instead.
              </span>
            </label>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
