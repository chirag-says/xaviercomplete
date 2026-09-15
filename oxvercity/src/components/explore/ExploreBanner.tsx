import { SplitDisplay } from '@/components/shared/SplitDisplay';

/**
 * Generated from the Framer site's server-rendered programs page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) --children=1:1
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

export function ExploreBanner() {
  return (
    <>
      <section className={"framer-d9337d"} data-framer-name={"Banner Section"} id={"banner"}>
        <div className={"framer-cfp9ri-container"} style={{ willChange: "transform", opacity: "1", transform: "none" } as React.CSSProperties}>
          <div className={"framer-7ZZtr framer-13od8gf framer-v-13od8gf"} data-framer-name={"Default"} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
            {/* The template's two flat overlays, lightened so the
            photograph reads brighter: the College blue from 0.35 to 0.15
            and the ink wash from 0.28 to 0.08, matching the home hero.
            The blue is written out rather than taken from its token, so
            the token itself keeps its authored value. */}
            <div className={"framer-fuht15"} data-framer-name={"BG Layer"} style={{ backgroundColor: "rgba(19, 62, 109, 0.15)" } as React.CSSProperties} />
            <div className={"framer-6mzyty"} data-framer-name={"BG Layer 2"} style={{ backgroundColor: "rgba(17, 17, 17, 0.08)" } as React.CSSProperties} />
            <div className={"framer-1kv7kk8"} data-framer-appear-id={"1kv7kk8"} data-framer-name={"BG Image"} style={{ willChange: "transform", opacity: "0.001", transform: "scale(1.03)" } as React.CSSProperties}>
              <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                <img decoding={"async"} width={"480"} height={"611"} sizes={"(min-width: 1200px) max(100vw, 1px), (min-width: 810px) and (max-width: 1199.98px) max(100vw, 1px), (max-width: 809.98px) max(100vw, 1px)"} srcSet={undefined} src={"/images/explore/hero-bg.jpg"} alt={"The arcaded wing of St. Xavier\'s College, Kolkata"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "cover" } as React.CSSProperties} />
              </div>
            </div>
          </div>
        </div>
        <div className={"framer-pj1bnz"} data-framer-name={"Container"}>
          <div className={"framer-hww12i"} data-framer-name={"Content Wrapper"}>
            <div className={"framer-xg19sr"} data-framer-name={"Heading Block"} id={"about-banner-text"}>
              <div className={"framer-1aoi5hu"} data-framer-name={"Title Stack"}>
                <div className={"framer-le6kty"} data-framer-name={"Title Wrap"}>
                  <div className={"framer-bmw3ek"} data-framer-appear-id={"bmw3ek"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(60px)" } as React.CSSProperties}>
                    <h1 className={"framer-text framer-styles-preset-1pqh2fz"} data-styles-preset={"vI9HYE8lQ"}>
                      {"Explore the "}
                    </h1>
                  </div>
                </div>
                <div className={"framer-116hlzb"} data-framer-name={"Title Wrap"}>
                  <div className={"framer-1wtv2py"} data-framer-appear-id={"1wtv2py"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(60px)" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-1pqh2fz"} data-styles-preset={"vI9HYE8lQ"}>
                      {"Xaverian"}
                    </h2>
                  </div>
                </div>
              </div>
              <div className={"framer-vf4nji"} data-framer-name={"Title Wrap"}>
                <SplitDisplay words={["Network"]} appearId="frp2eo" containerClass="framer-frp2eo" as="h2" />
              </div>
            </div>
          </div>
        </div>
        <div aria-label={"Scroll Trigger"} className={"framer-fkc7tz"} data-framer-name={"Scroll Triger"} id={"scroll-trigger"} />
      </section>
    </>
  );
}
