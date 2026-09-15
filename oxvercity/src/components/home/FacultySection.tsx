/**
 * Generated from the Framer site's server-rendered home page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) > .framer-18qsyp8 --children=2:2
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

import { FacultySlideshow } from './FacultySlideshow';
import { SlideMedia } from './SlideMedia';
import { faculties, type FacultySlide } from '@/data/pages/home';


/**
 * The phone card's own container classes. All three carry the same box in the
 * stylesheet but a reveal of their own in `effects.ts`, so they are cycled
 * rather than collapsed to one — a fourth card reuses the first one's reveal.
 */
const PHONE_CARD_CLASSES = ['framer-1tkakbu-container', 'framer-bibtxh-container', 'framer-14ikicq-container'];

/**
 * One stacked card, as the phone breakpoint draws it: no pill, and the text
 * block sits inside the image wrap rather than beside it.
 */
function PhoneCard({ slide, containerClass }: { slide: FacultySlide; containerClass: string }) {
  return (
    <div className={containerClass} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
      <div className={"framer-FtBy4 framer-QNdG4 framer-RqKzS framer-1qbswss framer-v-1vdr9hh"} data-framer-name={"Phone"} style={{ height: "100%", width: "100%", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" } as React.CSSProperties}>
        <div className={"framer-112po6y"} data-framer-name={"Image Wrap"}>
          <SlideMedia image={slide.image} />
          <div className={"framer-191hkq5"} data-framer-name={"Text Block"}>
            <div className={"framer-1cfszvw"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-a0htzi': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", '--framer-paragraph-spacing': "0px", transform: "none" } as React.CSSProperties}>
              <h3 className={"framer-text framer-styles-preset-1oke2e1"} data-styles-preset={"RSOGskbDP"} style={{ '--framer-text-color': "var(--extracted-a0htzi, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)))" } as React.CSSProperties}>
                {slide.title}
              </h3>
            </div>
            <div className={"framer-qeqmug"} data-framer-name={"Paragraph"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-r6o4lv': "var(--token-64ea5169-a638-4017-b73c-ec045eca97b4, rgba(255, 255, 255, 0.8))", '--framer-paragraph-spacing': "0px", transform: "none" } as React.CSSProperties}>
              <p className={"framer-text framer-styles-preset-1yx751z"} data-styles-preset={"kfKr753OE"} style={{ '--framer-text-color': "var(--extracted-r6o4lv, var(--token-64ea5169-a638-4017-b73c-ec045eca97b4, rgba(255, 255, 255, 0.8)))" } as React.CSSProperties}>
                {slide.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FacultySection() {
  return (
    <>
      <section className={"framer-16wyao8"} data-framer-name={"Faculty Section"}>
        <div className={"framer-1si5eg1"} data-framer-name={"Container"}>
          <div className={"framer-1p2rpxb"} data-framer-name={"Faculty Content Wrapper"}>
            <div className={"ssr-variant hidden-11qy7e3"}>
              <div className={"framer-vfrgz7-container hidden-1n3ggvs"}>
                <div className={"framer-tzPFw framer-PSLVr framer-me4w5m framer-v-me4w5m"} data-framer-name={"Desktop Step 01"} style={{ width: "100%" } as React.CSSProperties}>
                  <div className={"framer-to90kx"} data-framer-name={"Title Block"}>
                    <div className={"framer-1iseepf"} data-framer-name={"Title Wrap"}>
                      <div className={"framer-1goa3az"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-1of0zx5': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", '--framer-paragraph-spacing': "0px", willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-color': "var(--extracted-1of0zx5, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)))" } as React.CSSProperties}>
                          {"The Xaverian "}
                        </h2>
                      </div>
                    </div>
                    <div className={"framer-1x8tfoi"} data-framer-name={"Title Wrap"}>
                      <div className={"framer-njgqbr"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-1of0zx5': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", '--framer-paragraph-spacing': "0px", willChange: "transform", opacity: "0", transform: "translateY(80px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-color': "var(--extracted-1of0zx5, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)))" } as React.CSSProperties}>
                          {"community"}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <div className={"framer-7cnolh-container"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
<FacultySlideshow slides={faculties} />
</div>
                </div>
              </div>
            </div>
            <div className={"ssr-variant hidden-1n3ggvs hidden-72rtr7"}>
              <div className={"framer-vfrgz7-container hidden-1n3ggvs"}>
                <div className={"framer-tzPFw framer-PSLVr framer-me4w5m framer-v-1qjjgf8"} data-framer-name={"Tablet"} style={{ width: "100%" } as React.CSSProperties}>
                  <div className={"framer-to90kx"} data-framer-name={"Title Block"}>
                    <div className={"framer-1iseepf"} data-framer-name={"Title Wrap"}>
                      <div className={"framer-1goa3az"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-1of0zx5': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", '--framer-paragraph-spacing': "0px", willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-color': "var(--extracted-1of0zx5, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)))" } as React.CSSProperties}>
                          {"The Xaverian "}
                        </h2>
                      </div>
                    </div>
                    <div className={"framer-1x8tfoi"} data-framer-name={"Title Wrap"}>
                      <div className={"framer-njgqbr"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ '--extracted-1of0zx5': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", '--framer-paragraph-spacing': "0px", willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                        <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-color': "var(--extracted-1of0zx5, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)))" } as React.CSSProperties}>
                          {"community"}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <div className={"framer-18cbtr2-container"} data-framer-name={"Tablet"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
<FacultySlideshow slides={faculties} variant="tablet" />
</div>
                </div>
              </div>
            </div>
            <div className={"framer-1jg2h4t hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Title Block"}>
              <div className={"framer-qgen2v"} data-framer-name={"Title Wrap"}>
                <div className={"framer-1ymzcfk"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                  <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                    {"The Xaverian "}
                  </h2>
                </div>
              </div>
              <div className={"framer-f2f9y7"} data-framer-name={"Title Wrap"}>
                <div className={"framer-c0d2d7"} data-framer-name={"TItle"} data-framer-component-type={"RichTextContainer"} style={{ willChange: "transform", opacity: "0", transform: "translateY(30px)" } as React.CSSProperties}>
                  <h2 className={"framer-text framer-styles-preset-1tiwwlt"} data-styles-preset={"WXi_OMzDz"} style={{ '--framer-text-alignment': "center", '--framer-text-color': "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))" } as React.CSSProperties}>
                    {"community"}
                  </h2>
                </div>
              </div>
            </div>
            <div className={"framer-15tjthq hidden-72rtr7 hidden-11qy7e3"} data-framer-name={"Phone Card Block"}>
              {faculties.map((slide, i) => (
                <PhoneCard key={slide.title} slide={slide} containerClass={PHONE_CARD_CLASSES[i % PHONE_CARD_CLASSES.length]} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
