/**
 * Generated from the Framer site's server-rendered home page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) --children=2:3
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original. Only the copy and the background image
 * are the Association's; the structure, the appear ids and the per-character
 * reveal on the display line are the template's.
 *
 * The hero carries three things and no buttons: the College's name across the
 * top in the template's own display type, the Association's own line under it
 * — the two set in falling steps so they read as one lock-up, the way the
 * header's logo does — and one line at the bottom right in the template's
 * paragraph type — the
 * type and the place the original gives its right-hand column. Both calls to
 * action have moved to the About section below, which is the first thing a
 * visitor scrolls to. `site.css` holds the placing — see "hero tiers".
 */

import { SplitDisplay } from '@/components/shared/SplitDisplay';
import { hero } from '@/data/pages/home';

export function Hero() {
  return (
    <>
      <div aria-label={"Scroll Trigger"} className={"framer-1bgbqmj"} data-framer-name={"Scroll Triger"} id={"scroll-trigger"} />
      <section className={"framer-1kvexlt"} data-framer-name={"Hero Section"} id={"hero"}>
        <div className={"ssr-variant"}>
          <div className={"framer-1n96xeg-container"} style={{ willChange: "transform", opacity: "1", transform: "none" } as React.CSSProperties}>
            <div className={"framer-7ZZtr framer-13od8gf framer-v-13od8gf"} data-framer-name={"Default"} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
              {/* The template's two flat overlays, lightened so the photograph
                  reads brighter: the College blue drops from 0.35 to 0.15 and
                  the ink wash from 0.28 to 0.08 — the same pair the other
                  pages' banners now carry. The blue is written out rather than
                  taken from its token, so the token keeps its authored value.
                  What contrast the type needs comes from the gradient in
                  `site.css`. */}
              <div className={"framer-fuht15"} data-framer-name={"BG Layer"} style={{ backgroundColor: "rgba(19, 62, 109, 0.15)" } as React.CSSProperties} />
              <div className={"framer-6mzyty"} data-framer-name={"BG Layer 2"} style={{ backgroundColor: "rgba(17, 17, 17, 0.08)" } as React.CSSProperties} />
              <div className={"framer-1kv7kk8"} data-framer-appear-id={"1kv7kk8"} data-framer-name={"BG Image"} style={{ willChange: "transform", opacity: "0.001", transform: "scale(1.03)" } as React.CSSProperties}>
                <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                  <picture>
                    <source media="(max-width: 809.98px)" srcSet="/images/home/hero-bg-mobile.png" />
                    <img decoding={"async"} width={"1672"} height={"941"} sizes={"(min-width: 1200px) max(100vw, 1px), (min-width: 810px) and (max-width: 1199.98px) max(100vw, 1px), (max-width: 809.98px) max(100vw, 1px)"} srcSet={"/images/home/hero-bg-512.jpg 512w, /images/home/hero-bg-1024.jpg 1024w, /images/home/hero-bg.jpg 1672w"} src={"/images/home/hero-bg.jpg"} alt={"St. Xaviers College (Calcutta), seen across the college grounds"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "cover" } as React.CSSProperties} />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={"framer-w9d4ld"} data-framer-name={"Container"}>
          <div className={"framer-10ootzd"} data-framer-name={"Hero Content Wrapper"}>
            <div className={"framer-x3cdgf"}>
              <div className={"framer-7lgqt8"} data-framer-name={"Content"}>
                <div className={"framer-13zotdq site-hero-heading"} data-framer-name={"Heading Block"} id={"about-banner-text"}>

                  <div className={"framer-z4uw3d"} data-framer-name={"Title Wrap"}>
                    <div className={"ssr-variant hidden-1n3ggvs hidden-11qy7e3"}>
                      <SplitDisplay words={hero.display} appearId="1slilnr" containerClass="framer-1slilnr" as="h1" />
                    </div>
                    <div className={"ssr-variant hidden-72rtr7"}>
                      <SplitDisplay words={hero.display} appearId="1slilnr" containerClass="framer-1slilnr" as="h2" />
                    </div>
                  </div>
                  <div className={"site-hero-sub"} data-framer-appear-id={"1xedpim"} data-framer-name={"Association"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(40px)" } as React.CSSProperties}>
                    <p className={"framer-text framer-styles-preset-1o91uer"} data-styles-preset={"mUynNyA4W"} style={{ '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                      {hero.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
