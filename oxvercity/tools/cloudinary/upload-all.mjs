#!/usr/bin/env node
/**
 * Upload every file under public/images/ to Cloudinary.
 *
 * Folder structure is preserved: public/images/home/hero-bg.jpg becomes
 * Cloudinary public_id "oxvercity/home/hero-bg" inside the folder "oxvercity/home".
 *
 * Usage:
 *   node --env-file-if-exists=.env tools/cloudinary/upload-all.mjs
 *
 * Idempotent: Cloudinary overwrites an existing asset with the same public_id,
 * so re-running is safe. A manifest of uploaded ids is written to
 * tools/cloudinary/manifest.json.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const CLOUD   = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const SECRET  = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD || !API_KEY || !SECRET) {
  console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
  process.exit(1);
}

const ROOT       = join(import.meta.dirname, '..', '..'); // oxvercity/
const IMAGES_DIR = join(ROOT, 'public', 'images');
const MANIFEST   = join(import.meta.dirname, 'manifest.json');
const PREFIX     = 'oxvercity';             // top-level Cloudinary folder
const ENDPOINT   = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`;
const CONCURRENCY = 5;                      // parallel uploads
const MAX_RETRIES = 3;

/** Recursively list every file under `dir`. */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

/** Sign the Cloudinary upload params. */
function sign(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(sorted + SECRET).digest('hex');
}

/** Upload one file, returning { publicId, url } or throwing. */
async function upload(absPath, retries = 0) {
  const rel       = relative(IMAGES_DIR, absPath);              // home/hero-bg.jpg
  const parts     = rel.split(sep);
  const filename  = parts.pop();                                 // hero-bg.jpg
  const folder    = [PREFIX, ...parts].join('/');                 // oxvercity/home
  const publicId  = `${folder}/${filename.replace(extname(filename), '')}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const params    = { folder, overwrite: 'true', public_id: publicId, timestamp: String(timestamp) };
  const signature = sign(params);

  const body = new FormData();
  const buf  = await readFile(absPath);
  body.append('file', new Blob([buf]), filename);
  body.append('api_key', API_KEY);
  body.append('timestamp', String(timestamp));
  body.append('signature', signature);
  body.append('public_id', publicId);
  body.append('folder', folder);
  body.append('overwrite', 'true');

  const res = await fetch(ENDPOINT, { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text();
    if (retries < MAX_RETRIES && (res.status === 429 || res.status >= 500)) {
      const wait = (retries + 1) * 2000;
      console.log(`  ↻ ${publicId} — retrying in ${wait / 1000}s (${res.status})`);
      await new Promise(r => setTimeout(r, wait));
      return upload(absPath, retries + 1);
    }
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  const json = await res.json();
  return { publicId: json.public_id, url: json.secure_url, width: json.width, height: json.height };
}

/** Run uploads with bounded concurrency. */
async function uploadAll(files) {
  const results = [];
  let i = 0;
  let done = 0;

  async function next() {
    while (i < files.length) {
      const idx = i++;
      const file = files[idx];
      const rel = relative(IMAGES_DIR, file);
      try {
        const result = await upload(file);
        results.push(result);
        done++;
        console.log(`[${done}/${files.length}] ✓ ${rel}`);
      } catch (err) {
        done++;
        console.error(`[${done}/${files.length}] ✗ ${rel}: ${err.message}`);
        results.push({ publicId: rel, error: err.message });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => next());
  await Promise.all(workers);
  return results;
}

// ── main ────────────────────────────────────────────────────────────────────
const files = (await walk(IMAGES_DIR)).sort();
console.log(`Found ${files.length} images under public/images/`);
console.log(`Uploading to Cloudinary cloud "${CLOUD}" under folder "${PREFIX}/"\n`);

const results = await uploadAll(files);

const manifest = {};
for (const r of results) {
  if (r.url) manifest[r.publicId] = { url: r.url, width: r.width, height: r.height };
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nDone. ${Object.keys(manifest).length} uploaded, ${results.length - Object.keys(manifest).length} failed.`);
console.log(`Manifest written to ${MANIFEST}`);
