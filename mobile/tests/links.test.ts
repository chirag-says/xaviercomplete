/**
 * Website href → app route.
 *
 * The app's routes ARE the website's paths, so this is mostly about the two
 * things that still need deciding: what happens to a fragment, and what happens
 * to a destination the app has no screen for.
 *
 * The fragment case is a real bug that shipped once: `/alumni#featured` was
 * turned into `/more/alumni%23featured`, a route that did not exist, and it
 * rendered as a perfectly ordinary-looking link that landed on "Not found".
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveLink } from '../lib/links.ts';

describe('resolveLink', () => {
  it('maps the website path to the identical app route', () => {
    for (const p of ['/', '/about', '/alumni', '/chapters', '/events', '/explore', '/contact', '/privacy-policy', '/terms-of-use']) {
      assert.deepEqual(resolveLink(p), { href: p }, p);
    }
  });

  it('strips a fragment — the bug that shipped once', () => {
    assert.deepEqual(resolveLink('/alumni#featured'), { href: '/alumni' });
  });

  it('strips a query string', () => {
    assert.deepEqual(resolveLink('/events?filter=past'), { href: '/events' });
  });

  it('treats a bare fragment as home', () => {
    assert.deepEqual(resolveLink('#top'), { href: '/' });
  });

  it('tolerates a trailing slash', () => {
    assert.deepEqual(resolveLink('/chapters/'), { href: '/chapters' });
  });

  it('never leaks an encoded fragment into a route', () => {
    for (const h of ['/alumni#featured', '/about#history', '/explore#top']) {
      const r = resolveLink(h);
      assert.ok(r, h);
      assert.ok(!JSON.stringify(r.href).includes('%23'), h);
      assert.ok(!JSON.stringify(r.href).includes('#'), h);
    }
  });

  it('drops a destination the app has no screen for, rather than guessing', () => {
    // Rendering these as links would land the user on "Not found".
    assert.equal(resolveLink('/search'), null);
    assert.equal(resolveLink('/nonexistent'), null);
    assert.equal(resolveLink(''), null);
  });

  it('refuses external links, which the caller opens in a browser', () => {
    assert.equal(resolveLink('https://example.org'), null);
    assert.equal(resolveLink('mailto:alumni@sxccaa.org'), null);
    assert.equal(resolveLink('tel:+913322551000'), null);
  });
});
