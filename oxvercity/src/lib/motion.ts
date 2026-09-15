/** Framer's default variant transition: the ease every layout and colour change on the site uses. */
export const VARIANT_EASING = 'cubic-bezier(0.44, 0, 0.56, 1)';

/**
 * Animate an element between two measured heights (a FLIP) with the Web
 * Animations API, so nothing is left inline afterwards. Overflow is clipped
 * for the duration so the content that is growing in stays inside the box.
 */
export function animateHeight(element: HTMLElement, from: number, to: number, duration: number): void {
  if (from === to) return;
  const overflow = element.style.overflow;
  element.style.overflow = 'hidden';
  const animation = element.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration, easing: VARIANT_EASING });
  animation.finished.finally(() => {
    element.style.overflow = overflow;
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
