/**
 * The Privacy Policy and Terms of Use pages.
 *
 * Both documents are the Client's to write (SOW §9.4), so rather than invent
 * them — or leave two dead links in the footer — these pages state what the
 * platform is built to do and say plainly that the Association's own wording
 * is still to come.
 *
 * Neither page carries a banner: a legal document opens on its own text, not
 * on the home page's photograph, so the section itself starts the page and
 * `sx-section--top` gives it the clearance the fixed header needs.
 */

import { Button } from '@/components/ui/Button';

export function PolicyPlaceholder({ title, intro, points }: { title: string; intro: string; points: string[] }) {
  return (
    <section className="sx-section sx-section--top" data-framer-name="Policy">
      <div className="sx-container">
        <div className="sx-wrapper">
          <div className="sx-head">
            <h1 className="framer-text framer-styles-preset-bm56uh" data-styles-preset="nqEg573cg">{title}</h1>
            <p className="framer-text framer-styles-preset-18gc2kl" data-styles-preset="mM0cFQnf6">{intro}</p>
          </div>
          <div className="sx-notice">
            <p className="framer-text framer-styles-preset-1tfjym1" data-styles-preset="zbOnBKABb">
              Awaiting content from SXCCAA. The points below describe the platform’s behaviour; they are not the Association’s legal wording.
            </p>
          </div>
          <div className="sx-block" style={{ maxWidth: 760 }}>
            <ul style={{ display: 'flex', flexFlow: 'column', gap: 12, paddingLeft: 20, margin: 0 }}>
              {points.map((point) => (
                <li key={point} className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="iF_e_kz5u">
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="sx-actions">
            <Button label="Contact SXCCAA" href="/contact" variant="default" />
          </div>
        </div>
      </div>
    </section>
  );
}
