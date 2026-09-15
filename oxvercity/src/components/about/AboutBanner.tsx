import { SplitDisplay } from '@/components/shared/SplitDisplay';

/**
 * Generated from the Framer site's server-rendered about page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) --children=1:2
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

export function AboutBanner() {
  return (
    <>
      <div aria-label={"Scroll Trigger"} className={"framer-1rgdng8"} data-framer-name={"Scroll Triger"} id={"scroll-trigger"} />
      <section className={"framer-nlgv1q"} data-framer-name={"Banner Section"} id={"banner"}>
        <div className={"ssr-variant"}>
          <div className={"framer-1tpa2o2-container"} style={{ willChange: "transform", opacity: "1", transform: "none" } as React.CSSProperties}>
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
                  <picture>
                    <source media="(max-width: 809.98px)" srcSet="/images/home/campus-gate-mobile.png" />
                    <img decoding={"async"} width={"1600"} height={"900"} sizes={"(min-width: 1200px) max(100vw, 1px), (min-width: 810px) and (max-width: 1199.98px) max(100vw, 1px), (max-width: 809.98px) max(100vw, 1px)"} srcSet={"/images/home/voices-bg-512.jpg 512w, /images/home/voices-bg-1024.jpg 1024w, /images/home/voices-bg.jpg 1600w"} src={"/images/home/voices-bg.jpg"} alt={"Xaverian community"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "50% 50%", objectFit: "cover" } as React.CSSProperties} />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={"framer-18xd8b1"} data-framer-name={"Container"}>
          <div className={"framer-1rqftte"} data-framer-name={"Content Wrapper"}>
            <div className={"framer-1u4dl21"} data-framer-name={"Content"}>
              <div className={"framer-1ehv5ps"} data-framer-name={"Heading Block"} id={"about-banner-text"}>
                <div className={"framer-8uw6ew"} data-framer-name={"Title Stack"}>
                  <div className={"framer-bgty5i"} data-framer-name={"Title Wrap"}>
                    <div className={"framer-aazozd"} data-framer-appear-id={"aazozd"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(60px)" } as React.CSSProperties}>
                      <h1 className={"framer-text framer-styles-preset-1pqh2fz"} data-styles-preset={"vI9HYE8lQ"}>
                        {"About"}
                      </h1>
                    </div>
                  </div>
                  <div className={"framer-5nr6br"} data-framer-name={"Title Wrap"}>
                    <div className={"framer-otiu90"} data-framer-appear-id={"otiu90"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(60px)" } as React.CSSProperties}>
                      <h2 className={"framer-text framer-styles-preset-1pqh2fz"} data-styles-preset={"vI9HYE8lQ"}>
                        {" the"}
                      </h2>
                    </div>
                  </div>
                </div>
                <div className={"framer-12hjwe4"} data-framer-name={"Title Wrap"}>
                  <SplitDisplay words={["Association"]} appearId="v723o2" containerClass="framer-v723o2" as="h2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
