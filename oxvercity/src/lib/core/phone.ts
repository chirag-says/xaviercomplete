/**
 * Phone number normalisation to E.164.
 *
 * Five hundred numbers typed into a Google Form by five hundred people arrive
 * as `9876543210`, `+91 98765 43210`, `098765-43210`, `91 9876543210` and
 * `NA`. They all have to become one canonical string, or the same person shows
 * up twice and a "do we already have this number" check is meaningless.
 *
 * Built rather than pulled in: libphonenumber is the right answer for a product
 * dialling arbitrary countries, but here the failure mode is a wrong-looking
 * number that a test catches, not a breach — and the rules for the sheet we
 * have fit in forty lines. If the real data turns out to hold many non-Indian
 * numbers, swap this for `libphonenumber-js`; the interface is built to allow it.
 */

export type PhoneResult =
  /** A usable number, in E.164: `+919876543210`. */
  | { ok: true; value: string }
  /** Deliberately not shared — the cell was blank or said "NA". Stores nothing. */
  | { ok: true; value: null }
  | { ok: false; reason: string };

/** Default country for a bare ten-digit number. India, for this association. */
const DEFAULT_CC = '91';

/** Ways people write "I am not giving you my number". */
const ABSENT = new Set([
  '', 'na', 'n/a', 'n.a', 'n.a.', 'nil', 'none', 'no', '-', '--', '---',
  'not applicable', 'not available', 'not shared', 'null', 'x', 'xx', 'xxx',
]);

export function normalisePhone(raw: unknown): PhoneResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };

  // Excel hands back numeric cells as numbers, which is also how a leading zero
  // gets eaten before we ever see the value.
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : null;
  if (text === null) return { ok: false, reason: 'not_a_string' };

  const trimmed = text.trim();
  if (ABSENT.has(trimmed.toLowerCase())) return { ok: true, value: null };

  // Anything that is not a digit or a leading plus is punctuation people add
  // for readability: spaces, dashes, brackets, dots.
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (digits === '') return { ok: false, reason: 'no_digits' };
  if (/[a-z]/i.test(trimmed.replace(/^\+/, ''))) return { ok: false, reason: 'contains_letters' };

  // 00 is the international prefix in most of the world; it means the same as +.
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
    return finish(digits);
  }

  if (hasPlus) return finish(digits);

  // From here the number was written without any international marker.
  if (digits.length === 10) {
    if (!/^[6-9]/.test(digits)) return { ok: false, reason: 'not_an_indian_mobile' };
    return finish(DEFAULT_CC + digits);
  }
  // A trunk-prefixed domestic number: 0 followed by the ten-digit mobile.
  if (digits.length === 11 && digits.startsWith('0')) {
    const rest = digits.slice(1);
    if (!/^[6-9]/.test(rest)) return { ok: false, reason: 'not_an_indian_mobile' };
    return finish(DEFAULT_CC + rest);
  }
  // Country code already typed, just without the plus.
  if (digits.length === 12 && digits.startsWith(DEFAULT_CC)) return finish(digits);
  if (digits.length === 13 && digits.startsWith('0' + DEFAULT_CC)) return finish(digits.slice(1));

  return { ok: false, reason: digits.length < 10 ? 'too_short' : 'unrecognised_format' };
}

function finish(digits: string): PhoneResult {
  // E.164 allows at most fifteen digits including the country code, and no real
  // number is shorter than eight.
  if (digits.length < 8) return { ok: false, reason: 'too_short' };
  if (digits.length > 15) return { ok: false, reason: 'too_long' };
  return { ok: true, value: `+${digits}` };
}

/**
 * Mask a number for a dry-run preview or an admin list: `+91 ••••• ••210`.
 * The last three digits are enough for the owner to recognise their own number
 * and not enough for anyone else to dial it.
 */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return '•••••';
  const cc = digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const tail = digits.slice(-3);
  return `${cc ? `+${cc} ` : ''}••••• ••${tail}`;
}
