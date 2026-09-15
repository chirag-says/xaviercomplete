/**
 * Generated from the Framer site's server-rendered home page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) > .framer-18qsyp8 --children=4:4
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 *
 * Layout: Campus is full-width on top; Academics + Chapters side-by-side below.
 */

import { CampusCard } from './CampusCard';
import { Variant } from '@/components/layout/Variant';
import { PAGE_HASHES, type Breakpoint } from '@/lib/breakpoints';
import { campusCards } from '@/data/pages/home';

/**
 * Each card's layout slot and its breakpoint copies: which card variant each
 * copy uses and the start state of its scroll reveal, as Framer laid them out.
 *
 * Slots 0 = Campus (full width), 1 = Academics, 2 = Chapters
 */
const CAMPUS_SLOTS: { container: string; copies: { on: Breakpoint | Breakpoint[]; variant: 'desktop' | 'phone'; reveal?: string }[] }[] = [
  { container: 'framer-1sf96mu-container', copies: [{ on: 'desktop', variant: 'desktop' }, { on: ['tablet', 'phone'], variant: 'phone' }] },
  { container: 'framer-arxw4x-container', copies: [{ on: 'desktop', variant: 'desktop', reveal: 'translateY(40px)' }, { on: ['tablet', 'phone'], variant: 'phone', reveal: 'translateY(40px)' }] },
  { container: 'framer-1yjpdms-container', copies: [{ on: 'desktop', variant: 'desktop', reveal: 'translateX(40px)' }, { on: 'phone', variant: 'phone', reveal: 'translateY(40px)' }, { on: 'tablet', variant: 'phone', reveal: 'translateX(40px)' }] },
];

function CampusSlot({ index }: { index: number }) {
  const card = campusCards[index];
  const slot = CAMPUS_SLOTS[index];
  if (!card || !slot) return null;
  return slot.copies.map((copy, i) => (
    <Variant key={i} hashes={PAGE_HASHES.home} on={copy.on}>
      <CampusCard card={card} variant={copy.variant} containerClass={slot.container} reveal={copy.reveal} />
    </Variant>
  ));
}

export function CampusSection() {
  return (
    <>
      <section className={"framer-1b0dxc1"} data-framer-name={"Campus Section"}>
        <div className={"framer-1lfnhuq"} data-framer-name={"Container"}>
          <div className={"framer-k4ulwg"} data-framer-name={"Campus Content Wrapper"}>
            <div className={"framer-weyub3"} data-framer-name={"Title Block"}>
              <div className={"framer-18h5a62"} data-framer-name={"Title Wrap"}>
                <div className={"ssr-variant hidden-1n3ggvs"}>
                  <div className={"framer-xjwpuc"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {"Inside the Xaverian "}
                    </h2>
                  </div>
                </div>
                <div className={"ssr-variant hidden-72rtr7 hidden-11qy7e3"}>
                  <div className={"framer-xjwpuc"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {"Inside the Xaverian "}
                    </h2>
                  </div>
                </div>
              </div>
              <div className={"framer-f15r3k"} data-framer-name={"Title Wrap"}>
                <div className={"ssr-variant hidden-1n3ggvs hidden-11qy7e3"}>
                  <div className={"framer-1cuqyk1"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {"experience"}
                    </h2>
                  </div>
                </div>
                <div className={"ssr-variant hidden-72rtr7 hidden-11qy7e3"}>
                  <div className={"framer-1cuqyk1"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                    <h3 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {"experience"}
                    </h3>
                  </div>
                </div>
                <div className={"ssr-variant hidden-1n3ggvs hidden-72rtr7"}>
                  <div className={"framer-1cuqyk1"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                    <h3 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {"experience"}
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            {/* New layout: Campus full-width top, Academics + Chapters side-by-side below */}
            <div className={"framer-1sm1ya7"} data-framer-name={"Campus Card Deck"} style={{ flexDirection: 'column', gap: '24px' }}>
              {/* Row 1: Campus — full width */}
              <div className="sx-campus-wide">
                <CampusSlot index={0} />
              </div>
              {/* Row 2: Academics + Life at Xavier's — side by side */}
              <div className={"framer-115d54s"} data-framer-name={"Campus Card Block"}>
                <CampusSlot index={1} />
                <CampusSlot index={2} />
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
