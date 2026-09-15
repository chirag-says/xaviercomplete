/**
 * Email normalisation.
 *
 * This is the single shared function referred to in plan §3.4, and it has to be
 * byte-identical between the ingest tool and the login route. If the sheet holds
 * `firstname.lastname@gmail.com` and the alumnus types `firstnamelastname@gmail.com`
 * — the same mailbox, as far as Google is concerned — a naive HMAC locks them
 * out and they report the site as broken.
 *
 * It is deliberately not a full RFC 5322 parser. Chasing that standard produces
 * a regex nobody can review and accepts addresses no mail server will deliver
 * to. What it does is: reject anything obviously not an address, canonicalise
 * the Gmail quirks, and hand back a stable lowercase string.
 */

export type EmailResult = { ok: true; value: string } | { ok: false; reason: string };

/** Google treats these as the same service. */
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

const MAX_TOTAL = 254; // RFC 5321 path limit
const MAX_LOCAL = 64;

/**
 * Normalise an address to the form that gets hashed and compared.
 *
 * 1. Trim and lowercase.
 * 2. For Gmail only: drop the `+tag`, strip dots from the local part, and
 *    collapse googlemail.com onto gmail.com.
 * 3. Leave every other provider's local part exactly as typed — plenty of them
 *    treat dots as significant, and merging two real mailboxes into one would
 *    hand one person another's account.
 */
export function normaliseEmail(raw: unknown): EmailResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_a_string' };

  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (trimmed.length > MAX_TOTAL) return { ok: false, reason: 'too_long' };
  if (/\s/.test(trimmed)) return { ok: false, reason: 'contains_whitespace' };

  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return { ok: false, reason: 'missing_local_or_domain' };
  if (trimmed.indexOf('@') !== at) return { ok: false, reason: 'multiple_at_signs' };

  let local = trimmed.slice(0, at).toLowerCase();
  let domain = trimmed.slice(at + 1).toLowerCase();

  const domainProblem = checkDomain(domain);
  if (domainProblem) return { ok: false, reason: domainProblem };

  if (GMAIL_DOMAINS.has(domain)) {
    const plus = local.indexOf('+');
    if (plus !== -1) local = local.slice(0, plus);
    local = local.replaceAll('.', '');
    domain = 'gmail.com';
    // No minimum length check here on purpose. Gmail requires six characters
    // for new sign-ups, but grandfathered accounts are shorter, and locking a
    // real alumnus out is worse than accepting an address that bounces.
  }

  if (local.length === 0) return { ok: false, reason: 'empty_local' };
  if (local.length > MAX_LOCAL) return { ok: false, reason: 'local_too_long' };
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) {
    // Quoted local parts ("odd name"@example.com) are legal and vanishingly
    // rare; rejecting them is better than mis-normalising them.
    return { ok: false, reason: 'unsupported_local_characters' };
  }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return { ok: false, reason: 'malformed_local' };
  }

  return { ok: true, value: `${local}@${domain}` };
}

function checkDomain(domain: string): string | null {
  if (domain.length > 253) return 'domain_too_long';
  if (!domain.includes('.')) return 'domain_has_no_dot';
  if (domain.startsWith('.') || domain.endsWith('.')) return 'malformed_domain';

  for (const label of domain.split('.')) {
    if (label.length === 0 || label.length > 63) return 'malformed_domain';
    if (label.startsWith('-') || label.endsWith('-')) return 'malformed_domain';
    if (!/^[a-z0-9-]+$/.test(label)) return 'malformed_domain';
  }
  return null;
}

/** True when the address is a Gmail mailbox — used to pick the login allowlist column. */
export function isGmail(normalised: string): boolean {
  return normalised.endsWith('@gmail.com');
}

/**
 * Mask an address for a screen or a dry-run report: `r•••••@gmail.com`.
 * Used by the ingest preview so the operator can spot a wrong row without the
 * full list being readable over their shoulder or in a screenshot.
 */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at < 1) return '•••••';
  const local = value.slice(0, at);
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(3, local.length - 1))}${value.slice(at)}`;
}
