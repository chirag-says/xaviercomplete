/**
 * The chrome every page shares, and the wrapper Framer's layout rules key off.
 *
 * `#main` and the wrapper's class run are not decoration: Framer scopes its
 * page-level layout to them, so a page rendered outside this shell loses its
 * width and stacking. The order matches the original document: fixed header,
 * page body, overlay portal, flex spacer, footer.
 */
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

/**
 * Framer renders the page root with `display: contents`, so the sections lay
 * out directly inside the template wrapper at full width; the root's own
 * 1200px canvas width in the stylesheet never applies. Every page passes this.
 */
export const PAGE_ROOT_STYLE = { minHeight: '100vh', width: 'auto', display: 'contents' } as const;

export interface SiteShellProps {
  children: ReactNode;
  /** The root wrapper's class run, verbatim from the page's server render. */
  rootClass?: string;
  headerContainerClass?: string;
  /** The page starts on a light background, so the header starts with ink text. */
  lightPage?: boolean;
  spacerClass?: string;
  footer?: ReactNode;
}

export function SiteShell({
  children,
  rootClass = 'framer-WnwJO framer-8j9uhy',
  headerContainerClass = 'framer-yg91o4-container',
  lightPage = false,
  spacerClass = 'framer-11uh9gs',
  footer = <Footer />,
}: SiteShellProps) {
  return (
    <div id="main">
      <div className={rootClass} data-layout-template="true" style={{ minHeight: '100vh', width: 'auto' }}>
        <Header containerClass={headerContainerClass} lightPage={lightPage} />
        {children}
        <div id="overlay" />
        <div className={spacerClass} />
        {footer}
      </div>
    </div>
  );
}
