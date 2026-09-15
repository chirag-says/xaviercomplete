/**
 * Secret material: loading, validation, and the key ring that makes rotation possible.
 *
 * Rules this file exists to enforce:
 *   1. Secrets are read from the environment and nowhere else. Never a file on
 *      disk in production, never the database, never a constant in this repo.
 *   2. Nothing is read at import time. Next.js evaluates modules during `next
 *      build`, where these variables are absent; throwing there would break the
 *      build for a secret the build does not need. Everything here is lazy and
 *      throws on first *use*.
 *   3. A malformed secret fails loudly and immediately. A 31-byte key that
 *      silently works is a key you cannot rotate off later.
 *
 * Imports inside src/lib/core use explicit .ts extensions so this directory
 * loads under plain Node (tests, the ingest tool, the admin CLI) as well as
 * under Next. Do not use the "@/" alias in here.
 */

/** AES-256 and HMAC-SHA-256 both want exactly this many bytes. */
export const KEY_BYTES = 32;

export interface DataKey {
  /** 1–255. Stored as the first byte of every ciphertext blob. */
  version: number;
  key: Buffer;
}

export interface Keyring {
  /** The key new ciphertext is written with: always the highest version present. */
  current: DataKey;
  byVersion: ReadonlyMap<number, Buffer>;
}

export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretConfigError';
  }
}

function requireEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    throw new SecretConfigError(
      `${name} is not set. Generate secrets with \`npm run keys:generate\` and add them to the host's secret store.`,
    );
  }
  return raw.trim();
}

/** Decode base64 and insist on exactly KEY_BYTES. Never reports the value. */
function decodeKey(name: string, encoded: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    throw new SecretConfigError(`${name} is not valid base64.`);
  }
  // Buffer.from is forgiving: it ignores junk rather than throwing, so the
  // length check below is what actually catches a mangled paste.
  if (key.length !== KEY_BYTES) {
    throw new SecretConfigError(
      `${name} must decode to exactly ${KEY_BYTES} bytes, got ${key.length}. It was probably truncated in transit.`,
    );
  }
  return key;
}

/**
 * Parse `DATA_ENCRYPTION_KEYS`: a comma-separated list of `version:base64key`.
 *
 *   DATA_ENCRYPTION_KEYS="1:aGVsbG8..."                  — normal operation
 *   DATA_ENCRYPTION_KEYS="2:bmV3a2V5...,1:b2xka2V5..."   — mid-rotation
 *
 * The highest version is always the current one, so a rotation is a single
 * edit with no second variable to fall out of sync with the first.
 */
export function parseKeyring(raw: string, varName = 'DATA_ENCRYPTION_KEYS'): Keyring {
  const byVersion = new Map<number, Buffer>();

  for (const entry of raw.split(',')) {
    const part = entry.trim();
    if (part === '') continue;

    const colon = part.indexOf(':');
    if (colon < 1) {
      throw new SecretConfigError(`${varName} entries must look like "version:base64key".`);
    }

    const versionText = part.slice(0, colon).trim();
    if (!/^\d{1,3}$/.test(versionText)) {
      throw new SecretConfigError(`${varName}: "${versionText}" is not a key version.`);
    }
    const version = Number(versionText);
    if (version < 1 || version > 255) {
      throw new SecretConfigError(
        `${varName}: key version must be 1–255 (it is stored in one byte), got ${version}.`,
      );
    }
    if (byVersion.has(version)) {
      throw new SecretConfigError(`${varName}: key version ${version} appears twice.`);
    }

    byVersion.set(version, decodeKey(`${varName} key ${version}`, part.slice(colon + 1).trim()));
  }

  if (byVersion.size === 0) {
    throw new SecretConfigError(`${varName} contains no keys.`);
  }

  const highest = Math.max(...byVersion.keys());
  return {
    current: { version: highest, key: byVersion.get(highest)! },
    byVersion,
  };
}

let cachedKeyring: Keyring | undefined;
let cachedPepper: Buffer | undefined;
let cachedSessionSecret: Buffer | undefined;

/** The data-encryption key ring. Parsed once, on first use. */
export function getDataKeyring(): Keyring {
  cachedKeyring ??= parseKeyring(requireEnv('DATA_ENCRYPTION_KEYS'));
  return cachedKeyring;
}

/**
 * The blind-index pepper. Deliberately a different secret from the data key:
 * if one leaks, the other still holds. Rotating this one means rebuilding
 * every HMAC in the database, so it is not versioned — it is meant to outlive
 * the data keys.
 */
export function getEmailPepper(): Buffer {
  cachedPepper ??= decodeKey('EMAIL_HMAC_PEPPER', requireEnv('EMAIL_HMAC_PEPPER'));
  return cachedPepper;
}

export function getSessionSecret(): Buffer {
  cachedSessionSecret ??= decodeKey('SESSION_SECRET', requireEnv('SESSION_SECRET'));
  return cachedSessionSecret;
}

/**
 * Drop the memoised secrets. For tests that swap the environment between
 * cases; there is no reason to call this from application code.
 */
export function resetSecretCache(): void {
  cachedKeyring = undefined;
  cachedPepper = undefined;
  cachedSessionSecret = undefined;
}
