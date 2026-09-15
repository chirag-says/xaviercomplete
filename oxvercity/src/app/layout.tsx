import type { Metadata } from 'next';
/*
 * Load order is the cascade: none of these sheets use !important to settle
 * disagreements, so the later one wins.
 *   fonts        @font-face declarations for Instrument Sans, Inter, Roboto
 *   framer       the site's own stylesheet, the styling baseline
 *   framer-runtime  component CSS Framer only injects on interaction (dropdown)
 *   breakpoints  which breakpoint copy of a component is visible
 *   site         the few hand-written rules the rebuild adds
 *   voices       the home page's animated community voices section
 *   auth         the sign-in page, built from the same tokens as the rest
 *   account      the profile icon in the header, for signed-in alumni
 */
import '@/styles/fonts.css';
import '@/styles/framer.css';
import '@/styles/framer-runtime.css';
import '@/styles/breakpoints.css';
import '@/styles/site.css';
import '@/styles/voices.css';
import '@/styles/events.css';
import '@/styles/chapters.css';
import '@/styles/alumni.css';
import '@/styles/auth.css';
import '@/styles/account.css';
import '@/styles/me.css';
import '@/styles/request.css';
import '@/styles/contact.css';
import { FramerEffects } from '@/components/motion/FramerEffects';

export const metadata: Metadata = {
  title: { default: "St. Xaviers College (Calcutta) Alumni Association — SXCCAA", template: '%s' },
  description:
    "The alumni platform of the St. Xaviers College (Calcutta) Alumni Association: a searchable directory of Xaverians, alumni stories, chapters, events and a private way to request a connection with a fellow Xaverian.",
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FramerEffects />
      </body>
    </html>
  );
}
