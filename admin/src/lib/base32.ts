/**
 * RFC 4648 base32, because that is the alphabet authenticator apps speak.
 *
 * Forty lines and no dependency. The encoding is fully specified, the test
 * vectors are in the RFC, and every package that provides it also provides
 * fifteen things we do not want on a machine that holds the encryption keys.
 *
 * Decoding is deliberately forgiving of the two things a human does when typing
 * a secret off a screen — lowercase, and the spaces we ourselves put in to make
 * it readable — and unforgiving of everything else.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // Whatever is left over is padded on the right with zero bits, per the RFC.
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];

  return out;
}

export function base32Decode(input: string): Buffer {
  // `=` padding carries no information here, and the spaces are ours.
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const character of clean) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error(`"${character}" is not a base32 character.`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

/**
 * Grouped into fours for anyone typing it into a phone by hand.
 *
 * We do not print a QR code: rendering one needs a dependency, and this CLI
 * runs on the machine that holds `DATA_ENCRYPTION_KEYS`. A once-per-admin
 * typing job is a fair price for one less package in that blast radius.
 */
export function groupForReading(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}
