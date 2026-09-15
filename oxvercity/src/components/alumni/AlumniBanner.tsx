/**
 * The page banner for /alumni and the profile pages.
 *
 * Same markup as the template's other banners (`framer-d9337d`), so it gets
 * the same background zoom, the same stacked title entrance and the same
 * per-character reveal on the display line. Only the words differ.
 */

import { SplitDisplay } from '@/components/shared/SplitDisplay';

export function AlumniBanner({ lead, tail, display }: { lead: string; tail: string; display: string[] }) {
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
                <img decoding={"async"} width={"1672"} height={"941"} sizes={"(min-width: 1200px) max(100vw, 1px), (min-width: 810px) and (max-width: 1199.98px) max(100vw, 1px), (max-width: 809.98px) max(100vw, 1px)"} srcSet={"/images/home/hero-bg-512.jpg 512w, /images/home/hero-bg-1024.jpg 1024w, /images/home/hero-bg.jpg 1672w"} src={"/images/home/hero-bg.jpg"} alt={"St. Xaviers College (Calcutta)"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "50% 70%", objectFit: "cover" } as React.CSSProperties} />
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
                      {lead}
                    </h1>
                  </div>
                </div>
                <div className={"framer-116hlzb"} data-framer-name={"Title Wrap"}>
                  <div className={"framer-1wtv2py"} data-framer-appear-id={"1wtv2py"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(60px)" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-1pqh2fz"} data-styles-preset={"vI9HYE8lQ"}>
                      {tail}
                    </h2>
                  </div>
                </div>
              </div>
              <div className={"framer-vf4nji"} data-framer-name={"Title Wrap"}>
                <SplitDisplay words={display} appearId="frp2eo" containerClass="framer-frp2eo" as="h2" />
              </div>
            </div>
          </div>
        </div>
        <div aria-label={"Scroll Trigger"} className={"framer-fkc7tz"} data-framer-name={"Scroll Triger"} id={"scroll-trigger"} />
      </section>
    </>
  );
}
