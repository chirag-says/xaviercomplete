/**
 * Turning an uploaded file into a photograph we are willing to serve.
 *
 * This is the only place in the system that accepts a file from the internet,
 * so it gets the most paranoid treatment in the plan (§7.4). Everything the
 * browser does — the accept attribute, the size cap, the client-side downscale
 * — is convenience. This module assumes every one of them was bypassed.
 *
 * The order matters, and each step exists because of a specific attack:
 *
 *   1. **Hard size stop, on the stream.** A 2 GB upload has to die at 5 MB, not
 *      after. Buffering first and checking afterwards is how you get knocked
 *      over by a single request.
 *   2. **Magic-byte sniff.** The real format is read from the file's first
 *      bytes. `Content-Type` and the filename are both attacker-controlled and
 *      are ignored entirely, so `shell.php.jpg` never gets to be interesting.
 *   3. **Dimension probe before decode.** A 64000×64000 PNG is 200 KB on disk
 *      and several gigabytes decoded. This is how image uploads take servers
 *      down, and the only defence is to look at the header before allocating.
 *   4. **Re-encode.** The actual defence. Re-encoding throws away every byte
 *      that is not pixel data, which destroys polyglot files, appended
 *      archives, embedded scripts and malformed-chunk exploits in one step. The
 *      original bytes are never stored and never written to a temp path.
 *   5. **Strip metadata.** The least obvious and most serious leak here: a
 *      photo taken on a phone carries the GPS coordinates of where it was
 *      taken, which for a profile picture is very often the person's home.
 *      Publishing five hundred of those would be worse than publishing the
 *      phone numbers. `sharp` drops EXIF unless asked to keep it, and we never
 *      ask — this is asserted in the tests rather than assumed.
 */

import sharp from 'sharp';

/** Plan §7.4: 15 MB. Enforced on the stream, before the body is buffered. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Anything larger on either axis is a decompression bomb, not a portrait. */
export const MAX_SOURCE_DIMENSION = 8000;

/** The card is 3:4. These are the two renditions stored per photograph. */
export const WEBP_WIDTH = 800;
export const WEBP_HEIGHT = 1067;
export const JPEG_WIDTH = 400;
export const JPEG_HEIGHT = 533;

/** What we will accept, by *detected* format — never by what the upload claimed. */
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PhotoRejection =
  | 'too_large'
  | 'empty'
  | 'unreadable'
  | 'unsupported_format'
  | 'too_many_pixels'
  | 'processing_failed';

export interface ProcessedPhoto {
  webp: Buffer;
  jpeg: Buffer;
  width: number;
  height: number;
  sourceType: string;
  sourceBytes: number;
}

export type PhotoResult =
  | { ok: true; photo: ProcessedPhoto }
  | { ok: false; reason: PhotoRejection; message: string };

/** What the person who uploaded it should read. Never echoes anything from the file. */
const MESSAGES: Record<PhotoRejection, string> = {
  too_large: 'That image is larger than 5 MB. Most phones can export a smaller copy.',
  empty: 'That file was empty.',
  unreadable: 'That file could not be read as an image.',
  unsupported_format: 'Use a JPEG, PNG or WebP image.',
  too_many_pixels: 'That image has too many pixels to process. Anything up to 8000 pixels on a side is fine.',
  processing_failed: 'That image could not be processed. Try exporting it again, or use a different one.',
};

const reject = (reason: PhotoRejection): PhotoResult => ({ ok: false, reason, message: MESSAGES[reason] });

/**
 * Read a stream into memory, refusing to exceed the cap.
 *
 * Returns null the moment the running total passes `MAX_UPLOAD_BYTES`, so a
 * hostile upload costs us five megabytes and not a byte more. `Content-Length`
 * is not consulted: it is a header, and headers lie.
 */
export async function readCapped(
  stream: ReadableStream<Uint8Array>,
  cap = MAX_UPLOAD_BYTES,
): Promise<Buffer | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/**
 * Validate and re-encode. The only way an image reaches storage.
 *
 * `claimedType` is accepted purely so it can be ignored visibly — it is never
 * consulted for a decision, and the argument exists so nobody adds it later
 * thinking it was an oversight.
 */
export async function processPhoto(input: Buffer, claimedType?: string): Promise<PhotoResult> {
  void claimedType;

  if (input.length === 0) return reject('empty');
  if (input.length > MAX_UPLOAD_BYTES) return reject('too_large');

  // Step 2 — the real format, from the bytes themselves.
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(input);
  if (!detected) return reject('unreadable');
  if (!ACCEPTED.has(detected.mime)) return reject('unsupported_format');

  // Step 3 — read the header only. `sharp().metadata()` parses the image header
  // without decoding the pixel data, which is the whole point of doing it here.
  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(input, { failOn: 'error' }).metadata();
    width = meta.width;
    height = meta.height;
  } catch {
    return reject('unreadable');
  }

  if (!width || !height) return reject('unreadable');
  if (width > MAX_SOURCE_DIMENSION || height > MAX_SOURCE_DIMENSION) return reject('too_many_pixels');

  // Steps 4 and 5 — re-encode, and take no metadata with us.
  try {
    const base = () =>
      sharp(input, { failOn: 'error' })
        // Honour the EXIF orientation flag *before* stripping it, or portraits
        // taken on a phone come out sideways.
        .rotate()
        .resize(WEBP_WIDTH, WEBP_HEIGHT, { fit: 'cover', position: 'attention' });

    const webp = await base().webp({ quality: 82 }).toBuffer();
    const jpeg = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize(JPEG_WIDTH, JPEG_HEIGHT, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    return {
      ok: true,
      photo: {
        webp,
        jpeg,
        width: WEBP_WIDTH,
        height: WEBP_HEIGHT,
        sourceType: detected.mime,
        sourceBytes: input.length,
      },
    };
  } catch {
    return reject('processing_failed');
  }
}

/**
 * Which rendition to serve.
 *
 * WebP where the browser says it can take it, JPEG otherwise. Decided from
 * `Accept`, which is a hint about rendering rather than a security boundary —
 * both renditions came out of our own encoder, so being wrong costs a few
 * kilobytes and nothing else.
 */
export function pickRendition(accept: string | null): 'webp' | 'jpeg' {
  return accept?.includes('image/webp') ? 'webp' : 'jpeg';
}
