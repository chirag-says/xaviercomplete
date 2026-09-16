/**
 * Reads for the portal screens.
 *
 * ## Why the grants list has to work to show an address at all
 *
 * `access_grant` stores nothing but an HMAC. That is the design working — the
 * allowlist is deliberately not a readable list of who is a Xaverian (plan
 * §0.1) — but it means the portal cannot simply print who has access.
 *
 * The address is recoverable only where some *other* table happens to hold it
 * encrypted against the same identity: `alumni.gmail_enc` for a grant built
 * from the spreadsheet, `access_request.email_enc` for one an admin approved.
 * Both are joined on the blind index below. A grant matching neither shows as
 * an opaque fingerprint, which is the honest thing to display: we genuinely do
 * not know, and could not find out.
 *
 * Addresses are **masked by default** everywhere they appear. Revealing one is
 * a separate, audited action (plan §9.4) — not because an admin should not see
 * it, but because a screen that lists five hundred addresses in the clear is a
 * screen that gets screenshotted.
 */

import { adminDb, type Sql } from './db.ts';
import { decryptField, fieldContext } from './shared.ts';
import type { AdminRole } from './admin-session.ts';

/** `pri••••••@gmail.com` — enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '••••';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return `${head}${'•'.repeat(Math.max(3, local.length - head.length))}${domain}`;
}

/** `+44 ••••• ••234` — the last four, which is how people recognise their own number. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `${'•'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-4)}`;
}

function safeDecrypt(blob: Buffer | null, table: string, id: string, field: string): string | null {
  if (!blob) return null;
  try {
    return decryptField(blob, fieldContext(table, id, field));
  } catch {
    return null;
  }
}

// --- dashboard ---------------------------------------------------------------

export interface DashboardCounts {
  alumniVisible: number;
  alumniHidden: number;
  grantsLive: number;
  grantsRevoked: number;
  requestsPending: number;
  photosLive: number;
  adminsActive: number;
  invitesPending: number;
  signInFailures24h: number;
  messagesUnread: number;
}

export async function dashboardCounts(sql: Sql = adminDb()): Promise<DashboardCounts> {
  const rows = await sql<Array<Record<string, number>>>`
    select
      (select count(*)::int from alumni where is_visible)                                as alumni_visible,
      (select count(*)::int from alumni where not is_visible)                            as alumni_hidden,
      (select count(*)::int from access_grant where revoked_at is null)                  as grants_live,
      (select count(*)::int from access_grant where revoked_at is not null)              as grants_revoked,
      -- Every pending row. This used to add "and email_verified_at is not
      -- null", which was right while an applicant had to answer a one-time code
      -- before their request was queued. That step is gone, nothing sets the
      -- column any more, and the filter would have made the dashboard read
      -- "0 waiting" forever while the queue filled up behind it.
      (select count(*)::int from access_request where status = 'pending')                as requests_pending,
      (select count(*)::int from alumni where photo_status = 'live')                     as photos_live,
      (select count(*)::int from admin_user where status = 'active')                     as admins_active,
      (select count(*)::int from admin_invite where consumed_at is null
          and expires_at > now())                                                        as invites_pending,
      (select count(*)::int from audit_log where action = 'admin_sign_in_failed'
          and at > now() - interval '24 hours')                                          as sign_in_failures_24h,
      (select count(*)::int from contact_message where status = 'unread')                as messages_unread
  `;
  const r = rows[0]!;
  return {
    alumniVisible: r.alumni_visible!,
    alumniHidden: r.alumni_hidden!,
    grantsLive: r.grants_live!,
    grantsRevoked: r.grants_revoked!,
    requestsPending: r.requests_pending!,
    photosLive: r.photos_live!,
    adminsActive: r.admins_active!,
    invitesPending: r.invites_pending!,
    signInFailures24h: r.sign_in_failures_24h!,
    messagesUnread: r.messages_unread!,
  };
}

// --- access requests ---------------------------------------------------------

export interface AccessRequestRow {
  id: string;
  name: string;
  email: string | null;
  batchYear: number | null;
  stream: string | null;
  reason: string | null;
  status: string;
  createdAt: Date;
  /** A directory record whose login address matches, if there is one. */
  matchedAlumniId: string | null;
  matchedAlumniName: string | null;
  /** True if this address already holds a live grant. */
  alreadyGranted: boolean;
}

/*
 * There is deliberately no `verified` field above.
 *
 * `access_request.email_verified_at` is not read here and must not be
 * reintroduced. Nothing sets it any more, and the rows written during the
 * period when `submitAccessRequest` stamped it unconditionally carry a
 * timestamp for a check that never ran — so a UI driven off that column shows a
 * green badge backed by nothing, on precisely the screen where somebody decides
 * whether a stranger may read five hundred contact details.
 *
 * The queue now states plainly that no address is confirmed and asks the admin
 * to say they have satisfied themselves another way. If the one-time code is
 * ever restored, add the field back *then*, in the same change that starts
 * writing it.
 */

export async function listAccessRequests(
  status: string,
  sql: Sql = adminDb(),
): Promise<AccessRequestRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      email_enc: Buffer;
      name: string;
      batch_year: number | null;
      stream: string | null;
      reason: string | null;
      status: string;
      created_at: Date;
      matched_id: string | null;
      matched_name: string | null;
      already_granted: boolean;
    }>
  >`
    select r.id, r.email_enc, r.name, r.batch_year, r.stream, r.reason, r.status,
           r.created_at,
           a.id as matched_id, a.full_name as matched_name,
           exists (
             select 1 from access_grant g
              where g.email_hmac = r.email_hmac and g.revoked_at is null
           ) as already_granted
      from access_request r
      left join alumni a on a.gmail_hmac = r.email_hmac
     where (${status} = 'all' or r.status = ${status})
     order by r.created_at desc
     limit 300
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: safeDecrypt(row.email_enc, 'access_request', row.id, 'email'),
    batchYear: row.batch_year,
    stream: row.stream,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    matchedAlumniId: row.matched_id,
    matchedAlumniName: row.matched_name,
    alreadyGranted: row.already_granted,
  }));
}

// --- access grants -----------------------------------------------------------

export interface GrantRow {
  id: string;
  /** Null when no table holds this identity's address — see the header. */
  email: string | null;
  /** First eight hex characters of the blind index. Opaque, stable, not reversible. */
  fingerprint: string;
  source: string;
  grantedAt: Date;
  revokedAt: Date | null;
  note: string | null;
  alumniId: string | null;
  alumniName: string | null;
}

export async function listGrants(
  includeRevoked: boolean,
  sql: Sql = adminDb(),
): Promise<GrantRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      email_hmac: Buffer;
      source: string;
      granted_at: Date;
      revoked_at: Date | null;
      note: string | null;
      alumni_id: string | null;
      alumni_name: string | null;
      gmail_enc: Buffer | null;
      request_id: string | null;
      request_email_enc: Buffer | null;
    }>
  >`
    select g.id, g.email_hmac, g.source, g.granted_at, g.revoked_at, g.note,
           a.id as alumni_id, a.full_name as alumni_name, a.gmail_enc,
           r.id as request_id, r.email_enc as request_email_enc
      from access_grant g
      left join alumni a on a.gmail_hmac = g.email_hmac
      left join lateral (
        select id, email_enc from access_request
         where email_hmac = g.email_hmac and status = 'approved'
         order by decided_at desc limit 1
      ) r on true
     where (${includeRevoked} or g.revoked_at is null)
     order by g.granted_at desc
     limit 600
  `;

  return rows.map((row) => ({
    id: row.id,
    email:
      (row.alumni_id ? safeDecrypt(row.gmail_enc, 'alumni', row.alumni_id, 'gmail') : null) ??
      (row.request_id ? safeDecrypt(row.request_email_enc, 'access_request', row.request_id, 'email') : null),
    fingerprint: Buffer.from(row.email_hmac).toString('hex').slice(0, 8),
    source: row.source,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    note: row.note,
    alumniId: row.alumni_id,
    alumniName: row.alumni_name,
  }));
}

// --- alumni ------------------------------------------------------------------

export interface AlumniListRow {
  id: string;
  fullName: string | null;
  batchYear: number | null;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  isVisible: boolean;
  showContact: boolean;
  showGmail: boolean;
  photoStatus: string;
  hasLogin: boolean;
}

export async function listAlumni(search: string, sql: Sql = adminDb()): Promise<AlumniListRow[]> {
  const needle = search.trim().toLowerCase();
  const rows = await sql<
    Array<{
      id: string;
      full_name: string | null;
      batch_year: number | null;
      stream: string | null;
      current_org: string | null;
      designation: string | null;
      is_visible: boolean;
      show_contact: boolean;
      show_gmail: boolean;
      photo_status: string;
      gmail_hmac: Buffer | null;
    }>
  >`
    select id, full_name, batch_year, stream, current_org, designation,
           is_visible, show_contact, show_gmail, photo_status, gmail_hmac
      from alumni
     where ${needle} = ''
        or lower(full_name) like ${'%' + needle + '%'}
        or lower(coalesce(current_org, '')) like ${'%' + needle + '%'}
        or lower(coalesce(designation, '')) like ${'%' + needle + '%'}
        or cast(batch_year as text) like ${'%' + needle + '%'}
     order by batch_year desc, full_name
     limit 200
  `;

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    batchYear: row.batch_year,
    stream: row.stream,
    currentOrg: row.current_org,
    designation: row.designation,
    isVisible: row.is_visible,
    showContact: row.show_contact,
    showGmail: row.show_gmail,
    photoStatus: row.photo_status,
    hasLogin: row.gmail_hmac !== null,
  }));
}

export interface AlumniDetail extends AlumniListRow {
  previousRole: string | null;
  contact: string | null;
  gmail: string | null;
  formEmail: string | null;
  otherInfo: string | null;
  photoAudience: string;
  consentRecordedAt: Date | null;
  submittedAt: Date | null;
  ownerUpdatedAt: Date | null;
  updatedAt: Date;
}

/**
 * One record, fully decrypted.
 *
 * The owner's visibility toggles are reported but not applied: an admin is the
 * data controller and needs the whole record to answer a correction request or
 * a complaint (plan §1). The toggles govern what other *alumni* see.
 */
export async function readAlumni(id: string, sql: Sql = adminDb()): Promise<AlumniDetail | null> {
  const rows = await sql<
    Array<{
      id: string;
      full_name: string | null;
      batch_year: number | null;
      stream: string | null;
      current_org: string | null;
      designation: string | null;
      previous_role: string | null;
      contact_enc: Buffer | null;
      gmail_enc: Buffer | null;
      form_email_enc: Buffer | null;
      other_info_enc: Buffer | null;
      gmail_hmac: Buffer | null;
      is_visible: boolean;
      show_contact: boolean;
      show_gmail: boolean;
      photo_status: string;
      photo_audience: string;
      consent_recorded_at: Date | null;
      submitted_at: Date | null;
      owner_updated_at: Date | null;
      updated_at: Date;
    }>
  >`
    select * from alumni where id = ${id} limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    batchYear: row.batch_year,
    stream: row.stream,
    currentOrg: row.current_org,
    designation: row.designation,
    previousRole: row.previous_role,
    contact: safeDecrypt(row.contact_enc, 'alumni', row.id, 'contact'),
    gmail: safeDecrypt(row.gmail_enc, 'alumni', row.id, 'gmail'),
    formEmail: safeDecrypt(row.form_email_enc, 'alumni', row.id, 'formEmail'),
    otherInfo: safeDecrypt(row.other_info_enc, 'alumni', row.id, 'otherInfo'),
    isVisible: row.is_visible,
    showContact: row.show_contact,
    showGmail: row.show_gmail,
    photoStatus: row.photo_status,
    photoAudience: row.photo_audience,
    hasLogin: row.gmail_hmac !== null,
    consentRecordedAt: row.consent_recorded_at,
    submittedAt: row.submitted_at,
    ownerUpdatedAt: row.owner_updated_at,
    updatedAt: row.updated_at,
  };
}

// --- audit -------------------------------------------------------------------

export interface AuditRow {
  id: string;
  at: Date;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown>;
}

export async function listAudit(
  filters: { action?: string; actorId?: string; limit?: number },
  sql: Sql = adminDb(),
): Promise<AuditRow[]> {
  const action = filters.action?.trim() ?? '';
  const actorId = filters.actorId?.trim() ?? '';

  const rows = await sql<
    Array<{
      id: string;
      at: Date;
      actor_type: string;
      actor_id: string | null;
      action: string;
      target_type: string | null;
      target_id: string | null;
      meta: Record<string, unknown>;
    }>
  >`
    select id, at, actor_type, actor_id, action, target_type, target_id, meta
      from audit_log
     where (${action} = '' or action = ${action})
       and (${actorId} = '' or actor_id = ${actorId})
     order by id desc
     limit ${Math.min(filters.limit ?? 200, 500)}
  `;

  return rows.map((row) => ({
    id: String(row.id),
    at: row.at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    meta: row.meta ?? {},
  }));
}

export async function distinctAuditActions(sql: Sql = adminDb()): Promise<string[]> {
  const rows = await sql<Array<{ action: string }>>`
    select distinct action from audit_log order by action
  `;
  return rows.map((row) => row.action);
}

// --- admins ------------------------------------------------------------------

export interface AdminRow {
  id: string;
  email: string | null;
  role: AdminRole;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  recoveryCodesLeft: number;
  liveSessions: number;
}

export async function listAdmins(sql: Sql = adminDb()): Promise<AdminRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      email_enc: Buffer;
      role: AdminRole;
      status: string;
      created_at: Date;
      last_login_at: Date | null;
      locked_until: Date | null;
      must_change_password: boolean;
      codes_left: number;
      live_sessions: number;
    }>
  >`
    select u.id, u.email_enc, u.role, u.status, u.created_at, u.last_login_at,
           u.locked_until, u.must_change_password,
           (select count(*)::int from admin_recovery_code c
             where c.admin_id = u.id and c.used_at is null) as codes_left,
           (select count(*)::int from admin_session s
             where s.admin_id = u.id and s.revoked_at is null and s.expires_at > now()) as live_sessions
      from admin_user u
     order by u.created_at
  `;

  return rows.map((row) => ({
    id: row.id,
    email: safeDecrypt(row.email_enc, 'admin_user', row.id, 'email'),
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lockedUntil: row.locked_until,
    mustChangePassword: row.must_change_password,
    recoveryCodesLeft: row.codes_left,
    liveSessions: row.live_sessions,
  }));
}

// --- contact messages --------------------------------------------------------

export interface MessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  source: string | null;
  status: string;
  createdAt: Date;
  readAt: Date | null;
}

export async function listMessages(
  status: string,
  sql: Sql = adminDb(),
): Promise<MessageRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      name: string;
      email: string;
      message: string;
      source: string | null;
      status: string;
      created_at: Date;
      read_at: Date | null;
    }>
  >`
    select id, name, email, message, source, status, created_at, read_at
      from contact_message
     where (${status} = 'all' or status = ${status})
     order by created_at desc
     limit 300
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}
