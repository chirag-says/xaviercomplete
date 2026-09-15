/**
 * Generated from the Framer site's server-rendered home page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) > .framer-18qsyp8 --children=1:1
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 *
 * One change to the export: the single pill becomes a row of two, because the
 * home page's hero carries no buttons and both of its calls to action live
 * here instead. The template's own pill is untouched; the second is the site's
 * Button component in the matching variant.
 */

import { Button } from '@/components/ui/Button';
import { AboutSlider } from '@/components/home/AboutSlider';
import { hero } from '@/data/pages/home';

export function AboutSection() {
  return (
    <>
      <section className={"framer-1r6v9gw"} data-framer-name={"About Section"}>
        <div className={"framer-7jaoq4"} data-framer-name={"Container"}>
          <div className={"framer-rsz2xk"} data-framer-name={"About Content Wrapper"}>
            <div className={"framer-df28te"} data-framer-name={"Top Content"}>
              <div className={"framer-1xdfiqp"}>
                <div className={"framer-lyufow"} data-framer-name={"Title Block"}>
                  <div className={"framer-etyk4v"} data-framer-name={"Title Wrap"}>
                    <div className={"ssr-variant hidden-1n3ggvs"}>
                      <div className={"framer-1u2a99c"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"}>
                          {"About "}
                        </h2>
                      </div>
                    </div>
                    <div className={"ssr-variant hidden-72rtr7 hidden-11qy7e3"}>
                      <div className={"framer-1u2a99c"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"}>
                          {"About "}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <div className={"framer-41nao0"} data-framer-name={"Title Wrap"}>
                    <div className={"ssr-variant hidden-1n3ggvs"}>
                      <div className={"framer-35jjhq"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                        <h3 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"}>
                          {"SXCCAA"}
                        </h3>
                      </div>
                    </div>
                    <div className={"ssr-variant hidden-72rtr7 hidden-11qy7e3"}>
                      <div className={"framer-35jjhq"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                        <h3 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"}>
                          {"SXCCAA"}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={"ssr-variant hidden-11qy7e3"}>
                  <div className={"site-about-actions"} data-framer-name={"Button Row"}>
                    <div className={"framer-17z1wwx-container hidden-1n3ggvs"} data-framer-name={"Button"}>
                      <Button label={hero.primaryCta.label} href={hero.primaryCta.href} variant="default" />
                    </div>
                    <div className={"framer-17z1wwx-container hidden-1n3ggvs"} data-framer-name={"Button"}>
                      <Button label={hero.secondaryCta.label} href={hero.secondaryCta.href} variant="white" />
                    </div>
                  </div>
                </div>
                <div className={"ssr-variant hidden-1n3ggvs hidden-72rtr7"}>
                  <div className={"site-about-actions"} data-framer-name={"Button Row"}>
                    <div className={"framer-17z1wwx-container hidden-1n3ggvs"} data-framer-name={"Button"}>
                      <Button label={hero.primaryCta.label} href={hero.primaryCta.href} variant="phone" />
                    </div>
                    <div className={"framer-17z1wwx-container hidden-1n3ggvs"} data-framer-name={"Button"}>
                      <Button label={hero.secondaryCta.label} href={hero.secondaryCta.href} variant="phone" light />
                    </div>
                  </div>
                </div>
              </div>
              <div className={"ssr-variant hidden-1n3ggvs"}>
                <div className={"framer-7v1wrm"} data-framer-name={"Text Wrapper"} style={{ willChange: "transform", opacity: "0", transform: "translateY(60px)" } as React.CSSProperties}>
                  <div className={"framer-ful994"} data-framer-name={"Paragraph"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                    <p className={"framer-text framer-styles-preset-18gc2kl"} data-styles-preset={"mM0cFQnf6"}>
                      {"A community that carries the Xaverian spirit forward. SXCCAA connects Xaverians through fellowship, initiatives and engagement with their alma mater, strengthening the bond between alumni and the College."}
                    </p>
                  </div>
                  <div className={"site-about-actions"} data-framer-name={"Button Row"}>
                    <div className={"framer-11p4ebm-container hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Button"}>
                      <Button label={hero.primaryCta.label} href={hero.primaryCta.href} variant="default" />
                    </div>
                    <div className={"framer-11p4ebm-container hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Button"}>
                      <Button label={hero.secondaryCta.label} href={hero.secondaryCta.href} variant="white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className={"ssr-variant hidden-72rtr7 hidden-11qy7e3"}>
                <div className={"framer-7v1wrm"} data-framer-name={"Text Wrapper"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                  <div className={"framer-ful994"} data-framer-name={"Paragraph"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                    <p className={"framer-text framer-styles-preset-18gc2kl"} data-styles-preset={"mM0cFQnf6"}>
                      {"A community that carries the Xaverian spirit forward. SXCCAA connects Xaverians through fellowship, initiatives and engagement with their alma mater, strengthening the bond between alumni and the College."}
                    </p>
                  </div>
                  <div className={"site-about-actions"} data-framer-name={"Button Row"}>
                    <div className={"framer-11p4ebm-container hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Button"}>
                      <Button label={hero.primaryCta.label} href={hero.primaryCta.href} variant="phone" />
                    </div>
                    <div className={"framer-11p4ebm-container hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Button"}>
                      <Button label={hero.secondaryCta.label} href={hero.secondaryCta.href} variant="phone" light />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <AboutSlider />
          </div>
        </div>
      </section>
    </>
  );
}
