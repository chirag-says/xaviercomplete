/**
 * Generated from the Framer site's server-rendered contact page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) --children=2:2
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

import { FaqAccordion } from './FaqAccordion';
import { contactPage, faq } from '@/data/pages/contact';

export function FaqSection() {
  return (
    <>
      <section className={"framer-1h9cs3j"} data-framer-name={"FAQ Section"}>
        <div className={"framer-1jxdnfw"} data-framer-name={"Container"}>
          <div className={"framer-oqr0zc"} data-framer-name={"Content Wrapper"}>
            <div className={"framer-1lnqc8j"} data-framer-name={"Title Wrap"}>
              <div className={"ssr-variant hidden-5echh6"}>
                <div className={"framer-l9v3kt"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                  <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"}>
                    {contactPage.faqTitle}
                  </h2>
                </div>
              </div>
              <div className={"ssr-variant hidden-19nkl0n hidden-4ozm6q"}>
                <div className={"framer-l9v3kt"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                  <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center" } as React.CSSProperties}>
                    {contactPage.faqTitle}
                  </h2>
                </div>
              </div>
            </div>
            <div className={"ssr-variant hidden-19nkl0n hidden-5echh6"}>
              <FaqAccordion items={faq} breakpoint="desktop" />
            </div>
            <div className={"ssr-variant hidden-4ozm6q hidden-5echh6"}>
              <FaqAccordion items={faq} breakpoint="tablet" />
            </div>
            <div className={"ssr-variant hidden-19nkl0n hidden-4ozm6q"}>
              <FaqAccordion items={faq} breakpoint="phone" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
