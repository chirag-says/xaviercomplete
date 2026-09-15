/**
 * AES-256-GCM field encryption.
 *
 * Every confidential field in the database is a blob written by this file and
 * readable only by it. The database never sees a phone number, an email address
 * or a line of free text in the clear.
 *
 * Blob layout:
 *
 *   [ 1 byte key_version ][ 12 byte nonce ][ ciphertext ][ 16 byte auth tag ]
 *
 * The version byte is what makes key rotation possible without downtime: a row
 * declares which key wrote it, so old and new keys can coexist while rows are
 * re-encrypted in the background.
 *
 * ## The AAD, which is the part most implementations skip
 *
 * Each call binds `table:row_id:field` as Additional Authenticated Data, with
 * the key version prefixed. The ciphertext is therefore welded to the exact
 * cell it belongs in. An attacker with write access to the database who copies
 * one person's `contact_enc` into another person's row gets a loud decryption
 * failure instead of a quiet impersonation. The version byte is inside the AAD
 * too, so it cannot be edited to force a downgrade to a retired key.
 *
 * ## What this does not protect against
 *
 * A compromise of the running server, which has the key in memory. That is the
 * honest floor (plan §0.2) and is addressed by the controls in plan §10.6, not
 * by this file.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDataKeyring, type Keyring } from './keys.ts';

const ALGORITHM = 'aes-256-gcm';
const VERSION_LEN = 1;
const NONCE_LEN = 12; // 96 bits: the size GCM is designed for
const TAG_LEN = 16;
const MIN_BLOB_LEN = VERSION_LEN + NONCE_LEN + TAG_LEN;

/** Thrown whenever a blob will not authenticate. Never carries plaintext. */
export class CryptoIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoIntegrityError';
  }
}

/**
 * Build the AAD context string for a cell.
 *
 * Includes the table name as well as the row id so that two tables holding the
 * same kind of secret — `alumni.form_email_enc` and `access_request.email_enc`
 * — cannot have their ciphertext swapped either.
 */
export function fieldContext(table: string, rowId: string, field: string): string {
  if (!table || !rowId || !field) {
    throw new TypeError('fieldContext requires a table, a row id and a field name.');
  }
  if (table.includes(':') || rowId.includes(':') || field.includes(':')) {
    // Without this, ("a:b", "c") and ("a", "b:c") would produce the same
    // context, which would let one cell's ciphertext validate in another's slot.
    throw new TypeError('fieldContext parts must not contain ":".');
  }
  return `${table}:${rowId}:${field}`;
}

function aadFor(version: number, context: string): Buffer {
  return Buffer.concat([Buffer.from([version]), Buffer.from(context, 'utf8')]);
}

/**
 * Encrypt one field. `context` must come from {@link fieldContext} and must be
 * reproducible at read time — so it may only be built from immutable values.
 */
export function encryptField(
  plaintext: string,
  context: string,
  keyring: Keyring = getDataKeyring(),
): Buffer {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptField expects a string; encode other types before calling.');
  }

  const { version, key } = keyring.current;
  const nonce = randomBytes(NONCE_LEN);

  const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LEN });
  cipher.setAAD(aadFor(version, context));

  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([version]), nonce, body, cipher.getAuthTag()]);
}

/** Decrypt one field. Throws {@link CryptoIntegrityError} on any tampering. */
export function decryptField(
  blob: Buffer,
  context: string,
  keyring: Keyring = getDataKeyring(),
): string {
  if (!Buffer.isBuffer(blob)) {
    throw new TypeError('decryptField expects a Buffer.');
  }
  if (blob.length < MIN_BLOB_LEN) {
    throw new CryptoIntegrityError(`Ciphertext is too short to be valid (${context}).`);
  }

  const version = blob[0]!;
  const key = keyring.byVersion.get(version);
  if (!key) {
    throw new CryptoIntegrityError(
      `No key for version ${version} (${context}). The key was retired before every row was re-encrypted, or DATA_ENCRYPTION_KEYS is incomplete.`,
    );
  }

  const nonce = blob.subarray(VERSION_LEN, VERSION_LEN + NONCE_LEN);
  const body = blob.subarray(VERSION_LEN + NONCE_LEN, blob.length - TAG_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);

  const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LEN });
  decipher.setAAD(aadFor(version, context));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    // GCM failing is the system working. The blob was altered, it belongs to a
    // different cell, or the wrong key was used. The original error text says
    // nothing useful and is swallowed deliberately.
    throw new CryptoIntegrityError(
      `Ciphertext failed authentication (${context}). It was modified, or it does not belong to this field.`,
    );
  }
}

/**
 * Encrypt a value that may be absent. `null` in, `null` out — an unshared
 * contact number stores nothing rather than storing an encrypted empty string,
 * so "they did not give us a number" stays distinguishable from "they gave us
 * a blank one" at the database level.
 */
export function encryptOptional(
  value: string | null | undefined,
  context: string,
  keyring?: Keyring,
): Buffer | null {
  if (value === null || value === undefined || value === '') return null;
  return encryptField(value, context, keyring);
}

export function decryptOptional(
  blob: Buffer | null | undefined,
  context: string,
  keyring?: Keyring,
): string | null {
  if (blob === null || blob === undefined) return null;
  return decryptField(blob, context, keyring);
}

/** The key version a blob was written with, without decrypting it. Drives re-encryption sweeps. */
export function blobKeyVersion(blob: Buffer): number {
  if (!Buffer.isBuffer(blob) || blob.length < MIN_BLOB_LEN) {
    throw new CryptoIntegrityError('Not a valid ciphertext blob.');
  }
  return blob[0]!;
}

/** True when a blob predates the current key and should be rewritten. */
export function needsReEncryption(blob: Buffer, keyring: Keyring = getDataKeyring()): boolean {
  return blobKeyVersion(blob) !== keyring.current.version;
}

/**
 * Length-safe constant-time comparison, for session tokens, magic-link hashes
 * and anything else where a fast rejection leaks how much of a guess was right.
 * `timingSafeEqual` throws on a length mismatch, which would itself be a
 * timing signal, so the length check is done first and deliberately.
 */
export function secretEquals(a: Buffer, b: Buffer): boolean {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
