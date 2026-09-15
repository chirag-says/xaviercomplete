/**
 * Generated from the Framer site's server-rendered programs page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) --children=2:2
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

import { ExploreAccordion } from '@/components/explore/ExploreAccordion';
import { exploreItems, exploreDetailsLabel } from '@/data/explore';

export function ExploreList() {
  return (
    <>
      <section className={"framer-1n4fnum"} data-framer-name={"Explore Section"}>
        <div className={"framer-62970b"} data-framer-name={"Container"}>
          <div className={"framer-1wn0m64"} data-framer-name={"Content Wrapper"}>
            <div className={"ssr-variant hidden-o8vy71 hidden-6i04m6"}>
              <ExploreAccordion items={exploreItems} breakpoint="desktop" containerClass="framer-lexqjw-container" detailsLabel={exploreDetailsLabel} />
            </div>
            <div className={"ssr-variant hidden-1ijzfe8 hidden-6i04m6"}>
              <ExploreAccordion items={exploreItems} breakpoint="phone" containerClass="framer-lexqjw-container" detailsLabel={exploreDetailsLabel} />
            </div>
            <div className={"ssr-variant hidden-1ijzfe8 hidden-o8vy71"}>
              <ExploreAccordion items={exploreItems} breakpoint="tablet" containerClass="framer-lexqjw-container" detailsLabel={exploreDetailsLabel} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
