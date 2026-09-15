/**
 * Framer's three breakpoints. Each page carries its own set of hashes for
 * them (the appear-animation blob is keyed by hash), so the active breakpoint
 * is resolved from the media query and then mapped onto whichever hash the
 * current page uses.
 */
export const BREAKPOINTS = {
  desktop: '(min-width: 1200px)',
  tablet: '(min-width: 810px) and (max-width: 1199.98px)',
  phone: '(max-width: 809.98px)',
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** Every hash the site uses, by breakpoint, across the page and layout templates. */
const HASHES: Record<Breakpoint, string[]> = {
  desktop: ['72rtr7', '8j9uhy', 'r0yflc', '1ijzfe8', '4ozm6q', '50zb47'],
  tablet: ['11qy7e3', '4y47at', '4h95au', '6i04m6', '19nkl0n', '1y39x2x'],
  phone: ['1n3ggvs', 'mygaao', '1ppn25y', 'o8vy71', '5echh6', 'i56k9n'],
};

export function activeBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(BREAKPOINTS.phone).matches) return 'phone';
  if (window.matchMedia(BREAKPOINTS.tablet).matches) return 'tablet';
  return 'desktop';
}

/** The key to read from a per-breakpoint spec: a page hash, or "default" on desktop. */
export function activeBreakpointHash(): string {
  return activeBreakpoint() === 'desktop' ? 'default' : activeBreakpoint();
}

export function hashesFor(breakpoint: Breakpoint): string[] {
  return HASHES[breakpoint];
}

export interface BreakpointHashes { desktop: string; tablet: string; phone: string }

/** Each page template's own hash per breakpoint (the `hidden-<hash>` classes). */
export const PAGE_HASHES = {
  home: { desktop: '72rtr7', tablet: '11qy7e3', phone: '1n3ggvs' },
  about: { desktop: 'r0yflc', tablet: '4h95au', phone: '1ppn25y' },
  programs: { desktop: '1ijzfe8', tablet: '6i04m6', phone: 'o8vy71' },
  contact: { desktop: '4ozm6q', tablet: '19nkl0n', phone: '5echh6' },
} as const satisfies Record<string, BreakpointHashes>;

/** The `ssr-variant` class that shows a block only on the given breakpoints. */
export function variantClass(hashes: BreakpointHashes, on: Breakpoint | Breakpoint[]): string {
  const shown = new Set(Array.isArray(on) ? on : [on]);
  const hidden = (Object.keys(BREAKPOINTS) as Breakpoint[]).filter((bp) => !shown.has(bp)).map((bp) => `hidden-${hashes[bp]}`);
  return ['ssr-variant', ...hidden].join(' ');
}

/** The root layout templates' hashes: main pages, and the contact/search template. */
export const LAYOUT_HASHES = {
  main: { desktop: '8j9uhy', tablet: '4y47at', phone: 'mygaao' },
  contact: { desktop: '50zb47', tablet: '1y39x2x', phone: 'i56k9n' },
} as const satisfies Record<string, BreakpointHashes>;
