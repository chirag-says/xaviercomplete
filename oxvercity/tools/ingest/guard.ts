/**
 * Refusing to run when the spreadsheet is somewhere it could be committed.
 *
 * A committed spreadsheet is unrecoverable: git keeps it in history, and if the
 * repo is ever pushed, five hundred phone numbers are public and rewriting
 * history does not un-publish them. This check costs a few milliseconds and
 * closes the most likely way this project leaks.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export class UnsafeFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeFileError';
  }
}

function git(args: string[], cwd: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() };
  } catch {
    return { ok: false, out: '' };
  }
}

/**
 * Throws unless the file is safe to read: it exists, is a file, and is either
 * outside the repository or inside it and gitignored.
 */
export function assertSafeToRead(filePath: string, repoRoot = process.cwd()): void {
  const absolute = resolve(filePath);

  if (!existsSync(absolute)) {
    throw new UnsafeFileError(`No such file: ${absolute}`);
  }
  if (!statSync(absolute).isFile()) {
    throw new UnsafeFileError(`Not a file: ${absolute}`);
  }

  const top = git(['rev-parse', '--show-toplevel'], repoRoot);
  if (!top.ok) return; // not a git repository; nothing to protect against here

  const insideRepo = relative(top.out, absolute);
  if (insideRepo.startsWith('..')) return; // the file lives outside the repo entirely

  // Tracked: it is already in git's index, and possibly in history.
  if (git(['ls-files', '--error-unmatch', '--', absolute], top.out).ok) {
    throw new UnsafeFileError(
      `${absolute} is tracked by git.\n\n` +
        `  Refusing to read it. A spreadsheet in version control is one push away from being public,\n` +
        `  and deleting it later does not remove it from history.\n\n` +
        `  Fix: git rm --cached the file, move it to private-data/, and confirm private-data/ is in .gitignore.`,
    );
  }

  // Untracked but not ignored: one `git add -A` away from the case above.
  if (!git(['check-ignore', '-q', '--', absolute], top.out).ok) {
    throw new UnsafeFileError(
      `${absolute} is inside the repository and is not gitignored.\n\n` +
        `  Refusing to read it: a single \`git add -A\` would commit it.\n\n` +
        `  Fix: move it to private-data/ (already gitignored), or keep it outside the repo entirely.`,
    );
  }
}

/**
 * Advice printed alongside the preview. Not enforceable from here — a synced
 * folder means a copy of the plaintext on someone else's server, which undoes
 * the entire design, and no code in this repo can stop that.
 */
export function storageWarnings(filePath: string): string[] {
  const absolute = resolve(filePath).toLowerCase();
  const warnings: string[] = [];

  const synced = ['dropbox', 'onedrive', 'google drive', 'googledrive', 'icloud', 'nextcloud'];
  for (const service of synced) {
    if (absolute.includes(service)) {
      warnings.push(
        `This file looks like it is in a ${service} folder. Cloud sync means a plaintext copy on someone else's server — move it out before importing.`,
      );
    }
  }
  if (absolute.includes('/downloads/') || absolute.includes('\\downloads\\')) {
    warnings.push('This file is in Downloads. Move it somewhere you will remember to delete it from.');
  }
  return warnings;
}
