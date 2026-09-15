/**
 * Generated from the Framer site's server-rendered home page by _extract/jsx.mjs.
 * Selector: #main > div > div:nth-child(3) > .framer-18qsyp8 --children=6:8
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

/**
 * Breakpoint hashes differ per page template: each `ssr-variant` copy is hidden
 * outside its own breakpoint by `styles/breakpoints.css`.
 */
export interface BreakpointHashes { desktop: string; tablet: string; phone: string }
export const HOME_HASHES: BreakpointHashes = { desktop: '72rtr7', tablet: '11qy7e3', phone: '1n3ggvs' };
export const ABOUT_HASHES: BreakpointHashes = { desktop: 'r0yflc', tablet: '4h95au', phone: '1ppn25y' };

/** Each page template wraps the CTA in its own container class, which carries the width rule. */
export const CTA_CONTAINERS = { home: 'framer-o4lape-container', about: 'framer-1j8g7ei-container' } as const;

import { SiteForm, SubmitButton } from '@/components/ui/SiteForm';
import { contactCta } from '@/data/site';

export function ContactCta({ hashes = HOME_HASHES, containerClass = CTA_CONTAINERS.home }: { hashes?: BreakpointHashes; containerClass?: string }) {
  return (
    <>
      <div className={`ssr-variant hidden-${hashes.phone} hidden-${hashes.tablet}`}>
        <div className={containerClass}>
          <section className={"framer-JP73w framer-r4qqQ framer-ShxJM framer-8jqacb framer-v-8jqacb"} data-framer-name={"Desktop"} style={{ width: "100%" } as React.CSSProperties}>
            <div className={"framer-easkis"} data-framer-name={"BG Image"} style={{ willChange: "transform", opacity: "1", transform: "scale(1.1)" } as React.CSSProperties}>
              <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                <img decoding={"async"} width={"900"} height={"611"} sizes={"(min-width: 1200px) 100vw, (max-width: 809.98px) 100vw, (min-width: 810px) and (max-width: 1199.98px) 100vw"} srcSet={"/images/shared/contact-cta-bg-512.jpg 512w, /images/shared/contact-cta-bg.jpg 900w"} src={"/images/shared/contact-cta-bg.jpg"} alt={"Cta Image"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "cover" } as React.CSSProperties} />
              </div>
            </div>
            <div className={"framer-1wdx7i7"} data-framer-name={"Container"}>
              <div className={"framer-vw8ily"} data-framer-name={"Contact Wrapper"}>
                <div className={"framer-1acrwa0"} data-framer-name={"Contact Form"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", willChange: "transform", borderBottomLeftRadius: "20px", borderBottomRightRadius: "20px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                  <div className={"framer-n6n5x6"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-paragraph-spacing': "0px", transform: "none" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-7pqvzz"} data-styles-preset={"JTFmiHfFA"}>
                      {contactCta.title}
                    </h2>
                    <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                      {contactCta.intro}
                    </p>
                  </div>
                  <SiteForm className="framer-10k5ome" action={contactCta.form.action}>
                    <label className={"framer-jp5dup"}>
                      <div className={"framer-431pgr"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.nameLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1tgm52 framer-form-text-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"text"} required={true} name={"Name"} placeholder={contactCta.form.namePlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-eb67um"}>
                      <div className={"framer-1fwfc4z"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.emailLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1s9nmw8"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"email"} required={true} name={"Email"} placeholder={contactCta.form.emailPlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-umuu3p"}>
                      <div className={"framer-1yjbxkx"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.messageLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-upme3c framer-form-textarea-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "15px", '--framer-input-border-radius-bottom-right': "15px", '--framer-input-border-radius-top-left': "15px", '--framer-input-border-radius-top-right': "15px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <textarea name={"Message"} placeholder={contactCta.form.messagePlaceholder} className={"framer-form-input"} />
                      </div>
                    </label>
                    <label className={"framer-1irorkc"}>
                      <input className={"framer-form-boolean-input framer-1b708wg"} required={true} type={"checkbox"} name={"Consent"} style={{ '--framer-input-background': "rgba(186, 186, 186, 0)", '--framer-input-boolean-checked-background': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-bottom-width': "1px", '--framer-input-border-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-left-width': "1px", '--framer-input-border-radius-bottom-left': "4px", '--framer-input-border-radius-bottom-right': "4px", '--framer-input-border-radius-top-left': "4px", '--framer-input-border-radius-top-right': "4px", '--framer-input-border-right-width': "1px", '--framer-input-border-style': "solid", '--framer-input-border-top-width': "1px", '--framer-input-icon-color': "rgb(255, 255, 255)" } as React.CSSProperties} />
                      <div className={"framer-1ftzq1o"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.consent}
                        </p>
                      </div>
                    </label>
                    <SubmitButton labels={contactCta.form} variant="default" containerClass="framer-1212k9y-container" />
                    <input type={"text"} name={"website"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"company"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"message"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"subject"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"title"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"description"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"feedback"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"notes"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"details"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"remarks"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"comments"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                  </SiteForm>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className={`ssr-variant hidden-${hashes.desktop} hidden-${hashes.tablet}`}>
        <div className={containerClass}>
          <section className={"framer-JP73w framer-r4qqQ framer-ShxJM framer-8jqacb framer-v-1wtl4qm"} data-framer-name={"Phone"} style={{ width: "100%" } as React.CSSProperties}>
            <div className={"framer-easkis"} data-framer-name={"BG Image"} style={{ willChange: "transform", opacity: "1", transform: "scale(1.1)" } as React.CSSProperties}>
              <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                <img decoding={"async"} width={"900"} height={"611"} sizes={"(min-width: 1200px) 100vw, (max-width: 809.98px) 100vw, (min-width: 810px) and (max-width: 1199.98px) 100vw"} srcSet={"/images/shared/contact-cta-bg-512.jpg 512w, /images/shared/contact-cta-bg.jpg 900w"} src={"/images/shared/contact-cta-bg.jpg"} alt={"Cta Image"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "cover" } as React.CSSProperties} />
              </div>
            </div>
            <div className={"framer-1wdx7i7"} data-framer-name={"Container"}>
              <div className={"framer-vw8ily"} data-framer-name={"Contact Wrapper"}>
                <div className={"framer-1acrwa0"} data-framer-name={"Contact Form"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", willChange: "transform", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                  <div className={"framer-n6n5x6"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-paragraph-spacing': "0px", transform: "none" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-7pqvzz"} data-styles-preset={"JTFmiHfFA"} style={{ '--framer-text-alignment': "left" } as React.CSSProperties}>
                      {contactCta.title}
                    </h2>
                    <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"} style={{ '--framer-text-alignment': "left" } as React.CSSProperties}>
                      {contactCta.intro}
                    </p>
                  </div>
                  <SiteForm className="framer-10k5ome" action={contactCta.form.action}>
                    <label className={"framer-jp5dup"}>
                      <div className={"framer-431pgr"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.nameLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1tgm52 framer-form-text-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"text"} required={true} name={"Name"} placeholder={contactCta.form.namePlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-eb67um"}>
                      <div className={"framer-1fwfc4z"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.emailLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1s9nmw8"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"email"} required={true} name={"Email"} placeholder={contactCta.form.emailPlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-umuu3p"}>
                      <div className={"framer-1yjbxkx"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.messageLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-upme3c framer-form-textarea-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "15px", '--framer-input-border-radius-bottom-right': "15px", '--framer-input-border-radius-top-left': "15px", '--framer-input-border-radius-top-right': "15px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <textarea name={"Message"} placeholder={contactCta.form.messagePlaceholder} className={"framer-form-input"} />
                      </div>
                    </label>
                    <label className={"framer-1irorkc"}>
                      <input className={"framer-form-boolean-input framer-1b708wg"} required={true} type={"checkbox"} name={"Consent"} style={{ '--framer-input-background': "rgba(186, 186, 186, 0)", '--framer-input-boolean-checked-background': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-bottom-width': "1px", '--framer-input-border-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-left-width': "1px", '--framer-input-border-radius-bottom-left': "4px", '--framer-input-border-radius-bottom-right': "4px", '--framer-input-border-radius-top-left': "4px", '--framer-input-border-radius-top-right': "4px", '--framer-input-border-right-width': "1px", '--framer-input-border-style': "solid", '--framer-input-border-top-width': "1px", '--framer-input-icon-color': "rgb(255, 255, 255)" } as React.CSSProperties} />
                      <div className={"framer-1ftzq1o"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.consent}
                        </p>
                      </div>
                    </label>
                    <SubmitButton labels={contactCta.form} variant="phone" containerClass="framer-1212k9y-container" />
                    <input type={"text"} name={"website"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"company"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"message"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"subject"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"title"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"description"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"feedback"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"notes"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"details"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"remarks"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"comments"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                  </SiteForm>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className={`ssr-variant hidden-${hashes.phone} hidden-${hashes.desktop}`}>
        <div className={containerClass}>
          <section className={"framer-JP73w framer-r4qqQ framer-ShxJM framer-8jqacb framer-v-1n4499d"} data-framer-name={"Tablet"} style={{ width: "100%" } as React.CSSProperties}>
            <div className={"framer-easkis"} data-framer-name={"BG Image"} style={{ willChange: "transform", opacity: "1", transform: "scale(1.1)" } as React.CSSProperties}>
              <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                <img decoding={"async"} width={"900"} height={"611"} sizes={"(min-width: 1200px) 100vw, (max-width: 809.98px) 100vw, (min-width: 810px) and (max-width: 1199.98px) 100vw"} srcSet={"/images/shared/contact-cta-bg-512.jpg 512w, /images/shared/contact-cta-bg.jpg 900w"} src={"/images/shared/contact-cta-bg.jpg"} alt={"Cta Image"} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "cover" } as React.CSSProperties} />
              </div>
            </div>
            <div className={"framer-1wdx7i7"} data-framer-name={"Container"}>
              <div className={"framer-vw8ily"} data-framer-name={"Contact Wrapper"}>
                <div className={"framer-1acrwa0"} data-framer-name={"Contact Form"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", willChange: "transform", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", borderTopLeftRadius: "14px", borderTopRightRadius: "14px", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                  <div className={"framer-n6n5x6"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-paragraph-spacing': "0px", transform: "none" } as React.CSSProperties}>
                    <h2 className={"framer-text framer-styles-preset-7pqvzz"} data-styles-preset={"JTFmiHfFA"} style={{ '--framer-text-alignment': "left" } as React.CSSProperties}>
                      {contactCta.title}
                    </h2>
                    <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"} style={{ '--framer-text-alignment': "left" } as React.CSSProperties}>
                      {contactCta.intro}
                    </p>
                  </div>
                  <SiteForm className="framer-10k5ome" action={contactCta.form.action}>
                    <label className={"framer-jp5dup"}>
                      <div className={"framer-431pgr"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.nameLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1tgm52 framer-form-text-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"text"} required={true} name={"Name"} placeholder={contactCta.form.namePlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-eb67um"}>
                      <div className={"framer-1fwfc4z"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.emailLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-1s9nmw8"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "50px", '--framer-input-border-radius-bottom-right': "50px", '--framer-input-border-radius-top-left': "50px", '--framer-input-border-radius-top-right': "50px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <input type={"email"} required={true} name={"Email"} placeholder={contactCta.form.emailPlaceholder} className={"framer-form-input framer-form-input-empty"} defaultValue={""} />
                      </div>
                    </label>
                    <label className={"framer-umuu3p"}>
                      <div className={"framer-1yjbxkx"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.messageLabel}
                        </p>
                      </div>
                      <div className={"framer-form-text-input framer-form-input-wrapper framer-upme3c framer-form-textarea-input-type"} style={{ '--framer-input-background': "var(--token-d5147b08-e506-4b4a-b908-10ebbdc474cc, rgb(248, 248, 248))", '--framer-input-border-radius-bottom-left': "15px", '--framer-input-border-radius-bottom-right': "15px", '--framer-input-border-radius-top-left': "15px", '--framer-input-border-radius-top-right': "15px", '--framer-input-font-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-icon-color': "rgb(153, 153, 153)", '--framer-input-placeholder-color': "var(--token-24028cf8-2d22-4bb0-bb97-bb6cf9822565, rgb(153, 153, 153))" } as React.CSSProperties}>
                        <textarea name={"Message"} placeholder={contactCta.form.messagePlaceholder} className={"framer-form-input"} />
                      </div>
                    </label>
                    <label className={"framer-1irorkc"}>
                      <input className={"framer-form-boolean-input framer-1b708wg"} required={true} type={"checkbox"} name={"Consent"} style={{ '--framer-input-background': "rgba(186, 186, 186, 0)", '--framer-input-boolean-checked-background': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-bottom-width': "1px", '--framer-input-border-color': "var(--token-1c49fc01-5a06-4e84-9621-823d64297d7d, rgb(17, 17, 17))", '--framer-input-border-left-width': "1px", '--framer-input-border-radius-bottom-left': "4px", '--framer-input-border-radius-bottom-right': "4px", '--framer-input-border-radius-top-left': "4px", '--framer-input-border-radius-top-right': "4px", '--framer-input-border-right-width': "1px", '--framer-input-border-style': "solid", '--framer-input-border-top-width': "1px", '--framer-input-icon-color': "rgb(255, 255, 255)" } as React.CSSProperties} />
                      <div className={"framer-1ftzq1o"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          {contactCta.form.consent}
                        </p>
                      </div>
                    </label>
                    <SubmitButton labels={contactCta.form} variant="phone" containerClass="framer-1212k9y-container" />
                    <input type={"text"} name={"website"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"company"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"message"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"subject"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"title"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"description"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"feedback"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"notes"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"details"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"remarks"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                    <input type={"text"} name={"comments"} tabIndex={-1} autoComplete={"one-time-code"} aria-hidden={"true"} style={{ position: "absolute", transform: "scale(0)" } as React.CSSProperties} data-1p-ignore={"true"} data-lpignore={"true"} data-form-type={"other"} data-bwignore={"true"} defaultValue={""} />
                  </SiteForm>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
