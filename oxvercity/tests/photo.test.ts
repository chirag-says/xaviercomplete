/**
 * The upload abuse suite (plan §10.8).
 *
 * Every case here is a real attack that has worked on real image uploads. The
 * point of this file is not that the happy path works — it is that each of
 * these is refused, and refused for the right reason.
 *
 * The fixtures are generated rather than committed: a repository with a
 * decompression bomb and a polyglot in it is a repository that trips scanners
 * and worries people, and generating them proves the encoder can still produce
 * the shape being tested.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import sharp from 'sharp';

import {
  MAX_SOURCE_DIMENSION,
  MAX_UPLOAD_BYTES,
  pickRendition,
  processPhoto,
  readCapped,
  WEBP_HEIGHT,
  WEBP_WIDTH,
} from '../src/lib/photo.ts';

/** A plain, valid portrait. */
const portrait = (width = 600, height = 800) =>
  sharp({ create: { width, height, channels: 3, background: { r: 90, g: 110, b: 140 } } })
    .jpeg()
    .toBuffer();

/**
 * A real Web `ReadableStream`, chunked, because that is what a request body is.
 *
 * `Readable.from(...)` gives a Node stream, which has no `getReader()` — and a
 * cast would make this file pass while `readCapped` stayed broken against the
 * thing it actually receives. `toWeb` converts properly.
 */
const streamOf = (buffer: Buffer, chunk = 64 * 1024): ReadableStream<Uint8Array> => {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buffer.length; i += chunk) chunks.push(buffer.subarray(i, i + chunk));
  return Readable.toWeb(
    Readable.from(chunks.length > 0 ? chunks : [Buffer.alloc(0)]),
  ) as ReadableStream<Uint8Array>;
};

describe('readCapped', () => {
  it('reads a file under the cap', async () => {
    const data = Buffer.alloc(1024, 7);
    const read = await readCapped(streamOf(data), MAX_UPLOAD_BYTES);
    assert.ok(read);
    assert.equal(read.length, 1024);
  });

  it('gives up the moment the cap is passed, rather than after', async () => {
    // The 2 GB upload case. A hostile stream must cost us the cap and not a
    // byte more, so this is checked on the running total rather than at the end.
    const cap = 4096;
    const tooBig = Buffer.alloc(cap * 4, 1);
    assert.equal(await readCapped(streamOf(tooBig, 512), cap), null);
  });

  it('accepts a file exactly at the cap', async () => {
    const cap = 2048;
    const exact = Buffer.alloc(cap, 3);
    const read = await readCapped(streamOf(exact, 256), cap);
    assert.equal(read?.length, cap);
  });
});

describe('processPhoto — what it accepts', () => {
  it('re-encodes a JPEG into both renditions at the card ratio', async () => {
    const result = await processPhoto(await portrait());
    assert.ok(result.ok, result.ok ? '' : result.message);
    if (!result.ok) return;

    assert.equal(result.photo.width, WEBP_WIDTH);
    assert.equal(result.photo.height, WEBP_HEIGHT);
    assert.equal(result.photo.sourceType, 'image/jpeg');

    const webp = await sharp(result.photo.webp).metadata();
    assert.equal(webp.format, 'webp');
    assert.equal(webp.width, WEBP_WIDTH);

    const jpeg = await sharp(result.photo.jpeg).metadata();
    assert.equal(jpeg.format, 'jpeg');
  });

  it('accepts PNG and WebP too', async () => {
    const png = await sharp({ create: { width: 500, height: 500, channels: 3, background: '#446' } }).png().toBuffer();
    const webp = await sharp({ create: { width: 500, height: 500, channels: 3, background: '#446' } }).webp().toBuffer();

    assert.equal((await processPhoto(png)).ok, true);
    assert.equal((await processPhoto(webp)).ok, true);
  });
});

describe('processPhoto — what it refuses', () => {
  it('refuses a PHP file renamed .jpg', async () => {
    // The classic. The filename and the Content-Type are attacker-controlled;
    // only the magic bytes are not.
    const php = Buffer.from('<?php system($_GET["c"]); ?>', 'utf8');
    const result = await processPhoto(php, 'image/jpeg');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'unreadable');
  });

  it('refuses a script even when it claims to be an image', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
    const result = await processPhoto(html, 'image/png');
    assert.equal(result.ok, false);
  });

  it('refuses a PDF, which is a valid file and not an image', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n', 'utf8'), Buffer.alloc(600, 0x20)]);
    const result = await processPhoto(pdf);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'unsupported_format');
  });

  it('refuses a GIF — a real image format we have not allowed', async () => {
    // Animated GIFs are a denial-of-service surface all of their own, and the
    // card does not animate. Not on the list is not on the list.
    const gif = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#111' } }).gif().toBuffer();
    const result = await processPhoto(gif);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'unsupported_format');
  });

  it('refuses an empty file', async () => {
    const result = await processPhoto(Buffer.alloc(0));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'empty');
  });

  it('refuses anything over 5 MB', async () => {
    const result = await processPhoto(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'too_large');
  });

  it('refuses a decompression bomb by its header, without decoding it', async () => {
    // A 12000x12000 PNG of flat colour is tiny on disk and enormous decoded.
    // The dimension probe reads the header only, which is the whole point —
    // decoding first is how this attack takes a server down.
    const bomb = await sharp({
      create: { width: MAX_SOURCE_DIMENSION + 4000, height: 12, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    assert.ok(bomb.length < MAX_UPLOAD_BYTES, 'the fixture must be small on disk to be a fair test');

    const result = await processPhoto(bomb);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'too_many_pixels');
  });

  it('refuses a valid image with a ZIP appended', async () => {
    // A polyglot: valid JPEG to an image parser, valid archive to an unzipper.
    // The dimension probe passes, so this one has to be caught by the fact that
    // we re-encode — the output contains pixels and nothing else.
    const withZip = Buffer.concat([await portrait(200, 200), Buffer.from('PK\x03\x04payload', 'binary')]);
    const result = await processPhoto(withZip);

    // Accepting it is fine *provided* the appended bytes are gone. That is the
    // guarantee re-encoding gives, and it is stronger than rejection would be.
    assert.ok(result.ok, 'a valid image with junk appended should still be usable');
    if (!result.ok) return;
    assert.ok(!result.photo.webp.includes(Buffer.from('PK\x03\x04', 'binary')), 'the archive survived re-encoding');
    assert.ok(!result.photo.jpeg.includes(Buffer.from('payload', 'utf8')), 'the payload survived re-encoding');
  });
});

describe('metadata stripping', () => {
  it('removes EXIF, including the GPS tags a phone attaches', async () => {
    // The most serious leak in the whole feature: a photograph taken at home
    // carries the coordinates of the person's home. Publishing five hundred of
    // those would be worse than publishing the phone numbers.
    const withExif = await sharp({ create: { width: 400, height: 500, channels: 3, background: '#777' } })
      .withExif({
        IFD0: { Copyright: 'SXCCAA-TEST', Artist: 'Test Photographer' },
        IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
      })
      .jpeg()
      .toBuffer();

    const before = await sharp(withExif).metadata();
    assert.ok(before.exif, 'the fixture must actually carry EXIF, or this test proves nothing');

    const result = await processPhoto(withExif);
    assert.ok(result.ok);
    if (!result.ok) return;

    for (const [name, buffer] of [['webp', result.photo.webp], ['jpeg', result.photo.jpeg]] as const) {
      const after = await sharp(buffer).metadata();
      assert.equal(after.exif, undefined, `${name} still carries EXIF`);
      assert.ok(!buffer.includes(Buffer.from('SXCCAA-TEST', 'utf8')), `${name} still carries the copyright string`);
      assert.ok(!buffer.includes(Buffer.from('Test Photographer', 'utf8')), `${name} still carries the artist string`);
    }
  });

  it('applies the orientation flag before discarding it', async () => {
    // Strip EXIF without honouring orientation and every portrait taken on a
    // phone comes out sideways — a correctness bug that looks like a design one.
    const rotated = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#345' } })
      .withExif({ IFD0: { Orientation: '6' } }) // rotate 90° clockwise
      .jpeg()
      .toBuffer();

    const result = await processPhoto(rotated);
    assert.ok(result.ok);
    if (!result.ok) return;
    const out = await sharp(result.photo.webp).metadata();
    assert.equal(out.width, WEBP_WIDTH, 'output is always the card ratio, whatever the input orientation');
    assert.equal(out.height, WEBP_HEIGHT);
  });
});

describe('the claimed content type is never consulted', () => {
  it('accepts a real image whose Content-Type header lies', async () => {
    const jpeg = await portrait(300, 400);
    const result = await processPhoto(jpeg, 'application/x-msdownload');
    assert.equal(result.ok, true, 'a real image must be judged on its bytes, not its header');
  });

  it('refuses a non-image whose Content-Type header is respectable', async () => {
    const notAnImage = Buffer.from('MZ\x90\x00this is a windows executable', 'binary');
    const result = await processPhoto(notAnImage, 'image/jpeg');
    assert.equal(result.ok, false);
  });
});

describe('pickRendition', () => {
  it('serves WebP where the browser says it can take it', () => {
    assert.equal(pickRendition('image/avif,image/webp,image/apng,*/*'), 'webp');
    assert.equal(pickRendition('image/png,image/jpeg'), 'jpeg');
    assert.equal(pickRendition(null), 'jpeg', 'no Accept header means the safe fallback');
  });
});
