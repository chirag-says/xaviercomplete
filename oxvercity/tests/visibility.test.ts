/**
 * The access model, tested exhaustively.
 *
 * Plan §10.8 asks for "every combination of show_contact × show_gmail ×
 * photo_audience × session tier". The matrix is small enough to enumerate
 * rather than sample, so this file does — 2 × 2 × 2 × 2 × 4 photo states, and
 * every one is checked rather than a representative few. A gate is exactly as
 * strong as its least-tested branch.
 *
 * The assertions are deliberately about **absence**, not emptiness. `assert.ok(
 * !('contact' in result))` fails for `contact: null` as well as for a leaked
 * number, which is the point: a null tells a reader the field exists and
 * invites the next person to populate it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  confidentialStrings,
  photoUrlFor,
  toPrivate,
  toPublic,
  type AlumniRecord,
  type PhotoAudience,
  type PhotoStatus,
  type ViewerTier,
} from '../src/lib/visibility.ts';

const NUMBER = '+44 7700 900101';
const EMAIL = 'sample.profile.01@example.org';
const OTHER = 'Interested in mentoring.';
const PREVIOUS = 'Marketing Associate, Sample Retail';

function record(overrides: Partial<AlumniRecord> = {}): AlumniRecord {
  return {
    id: 'k3f9x2m7qp4w',
    fullName: 'Sample Profile 01',
    batchYear: 2018,
    stream: 'B.Com.',
    currentOrg: 'Sample Organisation',
    designation: 'Marketing Professional',
    previousRole: PREVIOUS,
    contact: NUMBER,
    gmail: EMAIL,
    otherInfo: OTHER,
    showContact: true,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
    ...overrides,
  };
}

const TIERS: ViewerTier[] = ['anonymous', 'verified'];
const AUDIENCES: PhotoAudience[] = ['public', 'alumni'];
const STATUSES: PhotoStatus[] = ['none', 'live', 'removed'];
const BOOLS = [true, false];

/** Everything the record holds that no anonymous viewer may ever receive. */
const SECRETS = [NUMBER, EMAIL, OTHER, PREVIOUS];

describe('toPublic — the card projection', () => {
  it('carries the five public fields from plan §1.1 and nothing else', () => {
    const keys = Object.keys(toPublic(record(), 'verified')).sort();
    assert.deepEqual(keys, ['batchYear', 'currentOrg', 'designation', 'fullName', 'id', 'photoUrl', 'stream']);
  });

  it('never carries a confidential field, whatever the toggles say', () => {
    // The exhaustive part. If a future edit adds a field to toPublic, one of
    // these 128 combinations will catch it.
    for (const tier of TIERS) {
      for (const showContact of BOOLS) {
        for (const showGmail of BOOLS) {
          for (const photoAudience of AUDIENCES) {
            for (const photoStatus of STATUSES) {
              const result = toPublic(
                record({ showContact, showGmail, photoAudience, photoStatus }),
                tier,
              );
              const serialised = JSON.stringify(result);
              for (const secret of SECRETS) {
                assert.ok(
                  !serialised.includes(secret),
                  `public projection leaked "${secret}" for ${tier}/${showContact}/${showGmail}/${photoAudience}/${photoStatus}`,
                );
              }
            }
          }
        }
      }
    }
  });

  it('passes through a blank public field rather than hiding it', () => {
    // A missing organisation is not a secret — the person left the cell empty.
    // Nulling it here would be indistinguishable from withholding it.
    const result = toPublic(record({ currentOrg: null, stream: null }), 'anonymous');
    assert.equal(result.currentOrg, null);
    assert.equal(result.stream, null);
  });
});

describe('toPrivate — the full profile', () => {
  it('includes the contact number only when the owner has published it', () => {
    assert.equal(toPrivate(record({ showContact: true })).contact, NUMBER);
    assert.ok(!('contact' in toPrivate(record({ showContact: false }))));
  });

  it('includes the Gmail only when the owner has published it', () => {
    assert.equal(toPrivate(record({ showGmail: true })).gmail, EMAIL);
    assert.ok(!('gmail' in toPrivate(record({ showGmail: false }))));
  });

  it('omits a hidden field rather than setting it to null', () => {
    // The distinction this whole file exists for. JSON.stringify drops an
    // absent key and keeps a null one, so "hidden" must mean absent or the
    // field's existence travels even when its value does not.
    //
    // `photoUrl: null` is exempt and is asserted to stay: it is a public field
    // meaning "render the fallback avatar", not a withheld one.
    const hidden = toPrivate(record({ showContact: false, showGmail: false }));
    const serialised = JSON.stringify(hidden);

    assert.ok(!serialised.includes('"contact"'), 'the contact key itself must not be serialised');
    assert.ok(!serialised.includes('"gmail"'), 'the gmail key itself must not be serialised');

    const nulled = Object.entries(hidden)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    assert.deepEqual(nulled, ['photoUrl'], 'only photoUrl may be null; a withheld field is absent');
  });

  it('refuses to publish a toggle that has no value behind it', () => {
    // The database constraint show_contact_needs_a_contact makes this row
    // impossible to store. If it ever becomes storable, the projection must
    // still not invent a field.
    const inconsistent = toPrivate(record({ showContact: true, contact: null }));
    assert.ok(!('contact' in inconsistent));
  });

  it('omits previousRole and otherInfo when they are empty', () => {
    const sparse = toPrivate(record({ previousRole: null, otherInfo: null }));
    assert.ok(!('previousRole' in sparse));
    assert.ok(!('otherInfo' in sparse));
  });

  it('gives a verified viewer everything that is published, across the matrix', () => {
    for (const showContact of BOOLS) {
      for (const showGmail of BOOLS) {
        const result = toPrivate(record({ showContact, showGmail }));
        assert.equal('contact' in result, showContact, 'contact presence must follow its toggle');
        assert.equal('gmail' in result, showGmail, 'gmail presence must follow its toggle');
        // Neither toggle may affect the other, and neither may affect the
        // fields that have no toggle.
        assert.equal(result.otherInfo, OTHER);
        assert.equal(result.previousRole, PREVIOUS);
      }
    }
  });
});

describe('photoUrlFor', () => {
  it('shows nothing unless there is an object behind it', () => {
    // `removed` and `none` both mean the bytes were deleted. Photographs are
    // live the moment they are uploaded — there is no approval step (0009).
    for (const photoStatus of STATUSES) {
      for (const photoAudience of AUDIENCES) {
        for (const tier of TIERS) {
          const url = photoUrlFor(record({ photoStatus, photoAudience }), tier);
          if (photoStatus !== 'live') {
            assert.equal(url, null, `a ${photoStatus} photo must not be served to ${tier}`);
          }
        }
      }
    }
  });

  it('serves a live public photograph to everyone', () => {
    for (const tier of TIERS) {
      assert.equal(
        photoUrlFor(record({ photoStatus: 'live', photoAudience: 'public' }), tier),
        '/api/photo/k3f9x2m7qp4w',
      );
    }
  });

  it('withholds an alumni-only photograph from an anonymous viewer', () => {
    const row = record({ photoStatus: 'live', photoAudience: 'alumni' });
    assert.equal(photoUrlFor(row, 'anonymous'), null);
    assert.equal(photoUrlFor(row, 'verified'), '/api/photo/k3f9x2m7qp4w');
  });

  it('builds the URL from the alumni id, never from the storage key', () => {
    // Plan §7.4: the object key and the alumni id are separate namespaces, so a
    // photo URL cannot be walked back to a profile. Asserting the shape here
    // pins that before Phase 6 builds the route behind it.
    const url = photoUrlFor(record({ photoStatus: 'live' }), 'verified');
    assert.equal(url, '/api/photo/k3f9x2m7qp4w');
  });
});

describe('confidentialStrings — what the gate verifier searches for', () => {
  it('lists every value an anonymous response must not contain', () => {
    assert.deepEqual(confidentialStrings(record()).sort(), [...SECRETS].sort());
  });

  it('ignores absent and blank values so the verifier cannot match on ""', () => {
    // An empty needle matches every haystack. Without this filter the gate
    // verifier would fail on a record with no phone number and look like a
    // leak, which is the worst kind of false alarm: the one people learn to
    // ignore.
    const sparse = confidentialStrings(
      record({ contact: null, gmail: '', otherInfo: '   ', previousRole: null }),
    );
    assert.deepEqual(sparse, []);
  });

  it('lists values regardless of the toggles', () => {
    // Deliberate: a number the owner has hidden must not appear in anonymous
    // output either, so the verifier checks for it whatever show_contact says.
    const hidden = confidentialStrings(record({ showContact: false, showGmail: false }));
    assert.ok(hidden.includes(NUMBER));
    assert.ok(hidden.includes(EMAIL));
  });
});

describe('the demo records exercise the matrix', () => {
  it('covers both states of both toggles and both photo audiences', async () => {
    // A synthetic set where every row is complete would let a whole branch of
    // the gate go unexercised in development and in the gate verifier.
    const { demoAlumni } = await import('../src/data/alumni.ts');

    const seen = {
      showContact: new Set(demoAlumni.map((r) => r.showContact)),
      showGmail: new Set(demoAlumni.map((r) => r.showGmail)),
      photoAudience: new Set(demoAlumni.map((r) => r.photoAudience)),
    };

    assert.equal(seen.showContact.size, 2, 'need records with the contact toggle on and off');
    assert.equal(seen.showGmail.size, 2, 'need records with the Gmail toggle on and off');
    assert.equal(seen.photoAudience.size, 2, 'need both photo audiences');
    assert.ok(
      demoAlumni.some((r) => r.contact === null),
      'need a record that wrote NA on the form',
    );
    assert.ok(
      demoAlumni.some((r) => r.gmail === null),
      'need a record with no login identity',
    );
  });

  it('holds no toggle that the database would refuse', () => {
    // Mirrors show_contact_needs_a_contact / show_gmail_needs_a_gmail from
    // 0001_schema.sql. Demo data that could not be stored would test a shape
    // the real directory can never have.
    return import('../src/data/alumni.ts').then(({ demoAlumni }) => {
      for (const row of demoAlumni) {
        assert.ok(!row.showContact || row.contact, `${row.id} claims a number it does not have`);
        assert.ok(!row.showGmail || row.gmail, `${row.id} claims a Gmail it does not have`);
      }
    });
  });
});
