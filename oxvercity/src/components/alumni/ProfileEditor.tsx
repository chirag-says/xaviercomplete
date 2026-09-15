'use client';

/**
 * The alumnus's own profile: photograph, three toggles, editable fields.
 *
 * ## The toggles say what happens, not what they are called
 *
 * Each one is labelled with its effect and carries a line underneath saying who
 * can see the field right now. A switch whose consequence you cannot see is a
 * switch people get wrong — and getting this one wrong means a phone number on
 * a page five hundred people can read.
 *
 * The state shown under each toggle updates as it is flipped, before saving, so
 * the sentence and the switch never disagree on screen.
 *
 * ## What is not editable, and why it says so
 *
 * Name, batch year, stream and the sign-in address are shown greyed with a
 * short reason. Leaving them out entirely would read as an oversight and
 * generate "why can't I fix my name" emails; saying why turns it into a
 * decision the reader can disagree with but understand.
 */

import { useActionState, useState } from 'react';

import { deletePhoto, saveProfile, setVisibility, uploadPhoto, type MeResult } from '@/app/me/actions';
import { refreshAccountSummary } from '@/components/layout/AccountMenu';
import type { OwnAlumnus } from '@/lib/visibility';

const AVATAR = '/svg/alumni-avatar.svg';

function Result({ state }: { state: MeResult | null }) {
  if (!state) return null;
  return (
    <p className={`me-result ${state.ok ? 'me-result--ok' : 'me-result--bad'}`} role="status">
      {state.ok ? state.message : state.error}
    </p>
  );
}

function Locked({ label, value, why }: { label: string; value: string; why: string }) {
  return (
    <div className="me-locked">
      <span className="me-locked__label">{label}</span>
      <span className="me-locked__value">{value}</span>
      <span className="me-locked__why">{why}</span>
    </div>
  );
}

export function ProfileEditor({ profile }: { profile: OwnAlumnus }) {
  const [saveState, saveAction, saving] = useActionState<MeResult | null, FormData>(
    async (prev, data) => saveProfile(prev, data),
    null,
  );
  const [photoState, photoAction, uploading] = useActionState<MeResult | null, FormData>(
    async (prev, data) => {
      const result = await uploadPhoto(prev, data);
      if (result?.ok) refreshAccountSummary();
      return result;
    },
    null,
  );
  const [visibilityState, visibilityAction] = useActionState<MeResult | null, FormData>(
    async (prev, data) => setVisibility(prev, data),
    null,
  );
  const [removeState, removeAction] = useActionState<MeResult | null, FormData>(
    async () => {
      const result = await deletePhoto();
      if (result?.ok) refreshAccountSummary();
      return result;
    },
    null,
  );

  // Mirrored in state so the sentence under each switch tracks the switch
  // itself rather than the last saved value.
  const [showContact, setShowContact] = useState(profile.showContact);
  const [showGmail, setShowGmail] = useState(profile.showGmail);
  const [photoAudience, setPhotoAudience] = useState(profile.photoAudience);
  const [contact, setContact] = useState(profile.contact ?? '');

  const hasContact = contact.trim() !== '';

  return (
    <div className="me">
      {/* ── Photograph ───────────────────────────────────────────────── */}
      <section className="me-card">
        <h2 className="me-card__title">Your photograph</h2>
        <p className="me-card__lede">
          The only part of your profile that did not come from the form you filled in. Uploading one is
          entirely optional — without it your card shows a plain outline, which looks perfectly normal.
        </p>

        <div className="me-photo">
          <div className="me-photo__frame">
            <img
              src={profile.photoUrl ?? AVATAR}
              width={200}
              height={267}
              alt={profile.photoStatus === 'live' ? 'Your photograph' : 'No photograph'}
            />
          </div>

          <div className="me-photo__side">
            {profile.photoStatus === 'live' && (
              <p className="me-badge me-badge--ok">
                Live — visible to {profile.photoAudience === 'public' ? 'anyone who visits the site' : 'signed-in Xaverians'}.
              </p>
            )}
            {profile.photoStatus === 'removed' && (
              <p className="me-badge me-badge--bad">
                The Association removed this photograph. You are welcome to upload a different one.
              </p>
            )}

            <form action={photoAction} className="me-photo__upload">
              <label htmlFor="photo">Choose an image</label>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
              <p className="me-hint">
                JPEG, PNG or WebP, up to 15 MB. It goes live straight away — there is nothing to wait
                for. We re-encode it and strip the location data your phone attaches, which for a
                photograph taken at home is your address.
              </p>
              <button className="me-btn" type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <Result state={photoState} />
            </form>

            {profile.photoStatus === 'live' && (
              <form action={removeAction}>
                <button className="me-btn me-btn--quiet" type="submit">Remove my photograph</button>
                <Result state={removeState} />
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Everything else ──────────────────────────────────────────── */}
      <form action={saveAction}>
        <section className="me-card">
          <h2 className="me-card__title">Who can see what</h2>
          <p className="me-card__lede">
            Your choice, changeable at any time. Nothing here is ever shown on the public directory —
            these decide what other <em>signed-in</em> Xaverians see.
          </p>

          <div className="me-toggle">
            <label className="me-toggle__row">
              <input
                type="checkbox"
                name="showContact"
                checked={showContact && hasContact}
                disabled={!hasContact}
                onChange={(e) => setShowContact(e.target.checked)}
              />
              <span>Show my contact number to signed-in Xaverians</span>
            </label>
            <p className="me-toggle__state">
              {!hasContact
                ? 'You have not given a number, so there is nothing to show.'
                : showContact
                  ? 'Signed-in Xaverians can see your number. Nobody else can.'
                  : 'Your number is hidden from everyone.'}
            </p>
          </div>

          <div className="me-toggle">
            <label className="me-toggle__row">
              <input
                type="checkbox"
                name="showGmail"
                checked={showGmail}
                onChange={(e) => setShowGmail(e.target.checked)}
              />
              <span>Show my email address to signed-in Xaverians</span>
            </label>
            <p className="me-toggle__state">
              {showGmail
                ? 'Signed-in Xaverians can see your address. Nobody else can.'
                : 'Your address is hidden. You can still sign in with it — this only affects what others see.'}
            </p>
          </div>

          <div className="me-toggle">
            <span className="me-toggle__row me-toggle__row--static">Who can see my photograph</span>
            <div className="me-radios">
              <label>
                <input
                  type="radio"
                  name="photoAudience"
                  value="public"
                  checked={photoAudience === 'public'}
                  onChange={() => setPhotoAudience('public')}
                />
                <span>Anyone who visits the site</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="photoAudience"
                  value="alumni"
                  checked={photoAudience === 'alumni'}
                  onChange={() => setPhotoAudience('alumni')}
                />
                <span>Signed-in Xaverians only</span>
              </label>
            </div>
            <p className="me-toggle__state">
              {photoAudience === 'public'
                ? 'Your photograph appears on the public directory alongside your name.'
                : 'Your photograph is shown only to signed-in Xaverians. The public directory shows the default outline.'}
            </p>
          </div>
        </section>

        <section className="me-card">
          <h2 className="me-card__title">Your details</h2>

          <div className="me-field">
            <label htmlFor="contact">Contact number</label>
            <input
              id="contact"
              name="contact"
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={40}
            />
            <p className="me-hint">Include the country code. Clear this box to remove it entirely.</p>
          </div>

          <div className="me-field">
            <label htmlFor="currentOrg">Current organisation</label>
            <input id="currentOrg" name="currentOrg" defaultValue={profile.currentOrg ?? ''} maxLength={200} />
            <p className="me-hint">Freelance, self-employed, studying, between roles — whatever describes it.</p>
          </div>

          <div className="me-field">
            <label htmlFor="designation">Designation and role</label>
            <input id="designation" name="designation" defaultValue={profile.designation ?? ''} maxLength={200} />
          </div>

          <div className="me-field">
            <label htmlFor="previousRole">Previous organisation or role</label>
            <input id="previousRole" name="previousRole" defaultValue={profile.previousRole ?? ''} maxLength={400} />
          </div>

          <div className="me-field">
            <label htmlFor="otherInfo">Anything else you would like other Xaverians to know</label>
            <textarea id="otherInfo" name="otherInfo" defaultValue={profile.otherInfo ?? ''} maxLength={2000} rows={4} />
            <p className="me-hint">Other qualifications, interests, what you are happy to be asked about.</p>
          </div>

          <button className="me-btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save my profile'}
          </button>
          <Result state={saveState} />
        </section>
      </form>

      {/* ── Fixed fields ─────────────────────────────────────────────── */}
      <section className="me-card">
        <h2 className="me-card__title">Fixed details</h2>
        <p className="me-card__lede">
          Email the Association if any of these is wrong and an administrator will correct it.
        </p>

        <Locked label="Full name" value={profile.fullName} why="Identity — changed by the Association only" />
        <Locked label="Batch / year of passing" value={String(profile.batchYear)} why="Identity — changed by the Association only" />
        <Locked label="Stream of study" value={profile.stream ?? 'Not recorded'} why="Identity — changed by the Association only" />
        <Locked
          label="Sign-in address"
          value={profile.gmail ?? 'None on file'}
          why="This is your account. Changing it would move your sign-in to a different mailbox, so only the Association can."
        />
      </section>

      {/* ── Withdraw ─────────────────────────────────────────────────── */}
      <section className="me-card me-card--grave">
        <h2 className="me-card__title">Leaving the directory</h2>
        {profile.isVisible ? (
          <>
            <p className="me-card__lede">
              This removes your profile from the directory immediately — your name, your role, your
              photograph, everything. The Association keeps your record so you can come back, and you can
              undo it from this page whenever you like.
            </p>
            <form action={visibilityAction}>
              <input type="hidden" name="visible" value="false" />
              <button className="me-btn me-btn--danger" type="submit">
                Remove me from the directory
              </button>
              <Result state={visibilityState} />
            </form>
          </>
        ) : (
          <>
            <p className="me-card__lede">
              You are not currently listed. Nobody can see your profile, including signed-in Xaverians.
            </p>
            <form action={visibilityAction}>
              <input type="hidden" name="visible" value="true" />
              <button className="me-btn" type="submit">List me in the directory again</button>
              <Result state={visibilityState} />
            </form>
          </>
        )}
      </section>
    </div>
  );
}
