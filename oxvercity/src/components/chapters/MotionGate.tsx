'use client';

/**
 * Turns the page's reveals on.
 *
 * Four of this page's sections start hidden and are animated in when they are
 * reached. Writing that hidden state straight into the stylesheet is what the
 * page this replaces did, and it has a cost: a visitor whose script never
 * arrives — a blocked bundle, a failed hydration, a text-only reader — is left
 * looking at empty sections, which is why that page needed a `<noscript>`
 * block to put its own content back.
 *
 * This inverts it. The stylesheet's resting state is the finished page, and
 * the hidden state is scoped to `[data-cx-motion='on']`, which only exists
 * once this has mounted — i.e. only once there is something running that can
 * be relied on to finish the job. The flag is set in an effect, after the
 * first paint, and every section it affects is below the fold at that point,
 * so nothing is ever seen arriving and then leaving again.
 *
 * It is removed on unmount so the attribute cannot outlive the page on a
 * client-side route change.
 */

import { useEffect } from 'react';

export function MotionGate() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-cx-motion', 'on');
    return () => root.removeAttribute('data-cx-motion');
  }, []);
  return null;
}
