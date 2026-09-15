/**
 * Root layout.
 *
 * No navigation here: the shell lives in the (portal) route group so the sign-in
 * and invitation pages, which have no session, render without a sidebar
 * advertising what is behind it.
 */

import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'SXCCAA Admin',
  // Belt and braces with the X-Robots-Tag header in middleware. Nothing here is
  // reachable without a session, but a portal that turns up in a search result
  // advertises where to attack.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
