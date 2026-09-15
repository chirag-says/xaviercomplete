/**
 * Who may see which field.
 *
 * This file is the access model from plan §1.1 written as code, and it is
 * deliberately **pure** — no database, no Next, no session lookup. It takes a
 * decrypted record and a viewer tier and returns the object that tier is
 * allowed to hold. That purity is the point: the whole matrix can be tested
 * exhaustively under plain Node (tests/visibility.test.ts), which is what plan
 * §10.8 asks for.
 *
 * ## The rule this file exists to enforce
 *
 * A field a viewer may not see is **absent from the returned object**, not
 * present and empty, and not present and null. Absent.
 *
 * That is why the private fields are declared optional (`contact?`) and built
 * with a conditional spread rather than assigned `null`. `JSON.stringify` drops
 * an undefined property entirely, so an unpermitted field cannot reach the
 * network even if a future route serialises the whole object by accident. A
 * `contact: null` would travel, announce that the field exists, and invite the
 * next person to "fix" it by filling it in.
 *
 * ## Why the viewer tier is a parameter and not a lookup
 *
 * Nothing here reads a cookie. The caller resolves the session and passes the
 * tier in, so this module has no way to be wrong about who is asking — and no
 * way to be tricked into asking on someone else's behalf. The only place a tier
 * is derived is src/lib/directory.ts, from the session cookie and nothing else.
 */

/** Anonymous is everyone on the internet. Verified is a live session on the allowlist. */
export type ViewerTier = 'anonymous' | 'verified';

export type PhotoAudience = 'public' | 'alumni';
/**
 * `live` the moment it is uploaded — there is no approval step (migration 0009).
 * `removed` means an administrator took one down, which is kept distinct from
 * `none` so the owner can be told why it disappeared.
 */
export type PhotoStatus = 'none' | 'live' | 'removed';

/**
 * The columns the directory grid selects, and the only ones it may.
 *
 * Split out from {@link AlumniRecord} so the separation is structural rather
 * than a matter of care: `listPublicAlumni` is typed to return this, so the
 * query behind it cannot select `contact_enc` without a compile error. The
 * ciphertext for five hundred phone numbers never enters the process to render
 * a page that would not display them anyway.
 */
export interface PublicRow {
  id: string;
  fullName: string;
  batchYear: number;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  photoAudience: PhotoAudience;
  photoStatus: PhotoStatus;
}

/**
 * One full row, decrypted, exactly as the profile loader produces it.
 *
 * This shape never leaves the server and is never handed to a component. It is
 * the input to {@link toPrivate} and nothing else.
 */
export interface AlumniRecord extends PublicRow {
  previousRole: string | null;
  contact: string | null;
  gmail: string | null;
  otherInfo: string | null;
  showContact: boolean;
  showGmail: boolean;
}

/**
 * What anyone on the internet may hold: the five card fields from plan §1.1,
 * plus a photograph if its owner published it.
 *
 * Nulls here are not secrets — an alumnus who left "current organisation" blank
 * on the form has nothing to hide, and the card renders the gap.
 */
export interface PublicAlumnus {
  id: string;
  fullName: string;
  batchYear: number;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  /** Null means "show the fallback avatar" — either no photo, or not for this viewer. */
  photoUrl: string | null;
}

/**
 * What a signed-in alumnus may hold.
 *
 * Every field added here is optional on purpose. If it is present, this viewer
 * is allowed to see it; if the owner's toggle is off or the value was never
 * supplied, the key does not exist. There is no third state.
 */
export interface PrivateAlumnus extends PublicAlumnus {
  previousRole?: string;
  contact?: string;
  gmail?: string;
  otherInfo?: string;
}

/**
 * What an alumnus may hold about **themselves**.
 *
 * Everything in `PrivateAlumnus` is unconditional here — the toggles govern who
 * else sees a field, never whether its owner does — plus the toggle states
 * themselves and the photograph's review status, which nobody else has any
 * business seeing.
 *
 * Produced only by `readOwnProfile`, which resolves the record from the
 * session's blind index. There is no function anywhere that takes an id and
 * returns one of these, so no request can be made to yield someone else's.
 */
export interface OwnAlumnus extends PublicAlumnus {
  previousRole: string | null;
  contact: string | null;
  gmail: string | null;
  otherInfo: string | null;
  showContact: boolean;
  showGmail: boolean;
  photoAudience: PhotoAudience;
  photoStatus: PhotoStatus;
  /** True when a photograph is uploaded and visible. */
  photoLive: boolean;
  isVisible: boolean;
}

export function toOwn(record: AlumniRecord & { isVisible: boolean }): OwnAlumnus {
  return {
    ...toPublic(record, 'verified'),
    // The owner's own view is never filtered by their own toggles. Hiding a
    // number from the person who supplied it would make the toggle impossible
    // to check and the page impossible to trust.
    previousRole: record.previousRole,
    contact: record.contact,
    gmail: record.gmail,
    otherInfo: record.otherInfo,
    showContact: record.showContact,
    showGmail: record.showGmail,
    photoAudience: record.photoAudience,
    photoStatus: record.photoStatus,
    photoLive: record.photoStatus === 'live',
    isVisible: record.isVisible,
  };
}

/**
 * Where a photograph is served from, or null if this viewer may not have it.
 *
 * Both audiences resolve to the same application route rather than a storage
 * CDN URL. That costs a little bandwidth and buys two things: the storage key
 * never appears in any HTML, and the decision about who may see the image stays
 * in one place instead of being split between this function and a bucket
 * policy.
 */
export function photoUrlFor(row: PublicRow, viewer: ViewerTier): string | null {
  // Nothing to serve unless there is an object behind it. `removed` and `none`
  // both mean the bytes were deleted.
  if (row.photoStatus !== 'live') return null;
  if (row.photoAudience === 'public') return `/api/photo/${row.id}`;
  return viewer === 'verified' ? `/api/photo/${row.id}` : null;
}

/** The card projection. Safe to send to anyone — that is the whole contract. */
export function toPublic(row: PublicRow, viewer: ViewerTier): PublicAlumnus {
  return {
    id: row.id,
    fullName: row.fullName,
    batchYear: row.batchYear,
    stream: row.stream,
    currentOrg: row.currentOrg,
    designation: row.designation,
    photoUrl: photoUrlFor(row, viewer),
  };
}

/**
 * The full-profile projection, honouring the owner's toggles.
 *
 * There is no `viewer` parameter because there is only one tier that may call
 * this. Taking one would imply an anonymous variant exists; it does not, and
 * the type system should not suggest otherwise.
 */
export function toPrivate(record: AlumniRecord): PrivateAlumnus {
  return {
    ...toPublic(record, 'verified'),
    // A toggle that is on but has no value behind it is refused at the database
    // (constraint show_contact_needs_a_contact), so the value check here is
    // belt and braces — and it is what keeps the type honest if that ever
    // changes.
    ...(record.previousRole ? { previousRole: record.previousRole } : {}),
    ...(record.showContact && record.contact ? { contact: record.contact } : {}),
    ...(record.showGmail && record.gmail ? { gmail: record.gmail } : {}),
    ...(record.otherInfo ? { otherInfo: record.otherInfo } : {}),
  };
}

/**
 * Every string in a record that no anonymous visitor may ever receive.
 *
 * Used by the gate verifier (`npm run gate:verify`) to assert the negative: it
 * fetches the anonymous directory HTML and fails if any of these appears in it.
 * Keeping the list next to the projections means a field added above without a
 * matching decision here is visible in the diff.
 */
export function confidentialStrings(record: AlumniRecord): string[] {
  return [record.contact, record.gmail, record.otherInfo, record.previousRole].filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
}
