/**
 * The site footer, generated from the Framer site's server-rendered markup
 * (_extract/jsx.mjs, then _extract/refactor-footer.mjs). Copy, contact
 * details and link lists come from src/data/site.ts. The two layout
 * templates (main pages; contact and search) differ only in their breakpoint
 * hashes and the wrapper class, which are props.
 */

import { FooterLink } from './FooterLink';
import { LAYOUT_HASHES, type BreakpointHashes } from '@/lib/breakpoints';
import { contact, footerColumns, siteLogo } from '@/data/site';

/** Framer's layout slot for each link, per column. */
const LINK_CONTAINERS = [
  ['framer-izdigx-container', 'framer-av3n65-container', 'framer-1xog0rv-container', 'framer-1lsiork-container', 'framer-6yhaz4-container'],
  ['framer-wd0hgi-container', 'framer-1bdo07-container', 'framer-4rbr4a-container', 'framer-xur1h1-container'],
  ['framer-1uvd8ko-container'],
  ['framer-1a1mchw-container', 'framer-11btwj9-container', 'framer-1qwqaiz-container'],
];

export function Footer({ hashes = LAYOUT_HASHES.main, containerClass = 'framer-1dc0cev-container' }: { hashes?: BreakpointHashes; containerClass?: string }) {
  return (
    <>
      <div className={`ssr-variant hidden-${hashes.tablet}`}>
        <div className={containerClass}>
          <div className={`ssr-variant hidden-${hashes.phone}`}>
            <footer className={"framer-kIeXk framer-FuTU5 framer-ShxJM framer-ytjKt framer-Z70cW framer-q3F3D framer-25f22s framer-v-25f22s"} data-framer-name={"Desktop"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", width: "100%" } as React.CSSProperties}>
              <div className={"framer-1pvq53s"} data-framer-name={"Linear Background"} style={{ background: "linear-gradient(180deg, var(--token-fe810758-ba26-4c60-a7b7-193cf95cf6ce, rgba(255, 255, 255, 0)) 0%, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)) 100%)" } as React.CSSProperties} />
              <div className={"framer-91x297"} data-framer-name={"Container"}>
                <div className={"framer-glvige"} data-framer-name={"Footer Wrapper"}>
                  <div className={"framer-1q51sri"} data-framer-name={"Footer Description"}>
                    <div className={"framer-1rwbufp-container"}>
                      <a className={"framer-4X5ZN framer-10rs7as framer-v-f1vhqz framer-1jc5brm"} data-framer-name={"Logo Dark"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                        <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                          <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                            <img decoding={"async"} width={"153"} height={"29"} src={siteLogo.dark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                          </div>
                        </div>
                      </a>
                    </div>
                    <div className={"framer-75f6l"} data-framer-name={"Text Block"}>
                      <div className={"framer-k9231b"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                          {contact.officeLabel}
                        </p>
                      </div>
                      <div className={"framer-1ozirm2"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          <a className={"framer-text framer-styles-preset-1l1b9t0"} data-styles-preset={"Hc8nRCIht"} href={contact.addressHref} target={"_blank"} rel={""}>
                            {contact.address.join('\u2028')}
                          </a>
                        </p>
                      </div>
                    </div>
                    <div className={"framer-971bpt"} data-framer-name={"Label"}>
                      <div className={"framer-prff41"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                          {contact.emailLabel}
                        </p>
                      </div>
                      <div className={"framer-1v2ebvy"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          <a className={"framer-text framer-styles-preset-1l1b9t0"} data-styles-preset={"Hc8nRCIht"} href={`mailto:${contact.email}`} target={"_blank"} rel={""}>
                            {contact.email}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={"framer-e96jzp"} data-framer-name={"Footer List Block"}>
                    <div className={"framer-1w7qv1f"} data-framer-name={"Footer List"}>
                      <div className={"framer-nclzzx"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[0].title}
                        </p>
                      </div>
                      <div className={"framer-59pkxz"} data-framer-name={"List Item Block"}>
{footerColumns[0].links.map((link, i) => <FooterLink key={link.label} link={link} variant="default" containerClass={LINK_CONTAINERS[0][i] ?? LINK_CONTAINERS[0][LINK_CONTAINERS[0].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-2lhesk"} data-framer-name={"Footer List"}>
                      <div className={"framer-13u44s0"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[1].title}
                        </p>
                      </div>
                      <div className={"framer-9faqx5"} data-framer-name={"List Item Block"}>
{footerColumns[1].links.map((link, i) => <FooterLink key={link.label} link={link} variant="default" containerClass={LINK_CONTAINERS[1][i] ?? LINK_CONTAINERS[1][LINK_CONTAINERS[1].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-14olq64"} data-framer-name={"Footer List"}>
                      <div className={"framer-162shz6"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[2].title}
                        </p>
                      </div>
                      <div className={"framer-mr2n1u"} data-framer-name={"List Item Block"}>
{footerColumns[2].links.map((link, i) => <FooterLink key={link.label} link={link} variant="default" containerClass={LINK_CONTAINERS[2][i] ?? LINK_CONTAINERS[2][LINK_CONTAINERS[2].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-1um81sx"} data-framer-name={"Footer List"}>
                      <div className={"framer-1srvnmy"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[3].title}
                        </p>
                      </div>
                      <div className={"framer-55ksaj"} data-framer-name={"List Item Block"}>
{footerColumns[3].links.map((link, i) => <FooterLink key={link.label} link={link} variant="default" containerClass={LINK_CONTAINERS[3][i] ?? LINK_CONTAINERS[3][LINK_CONTAINERS[3].length - 1]} />)}
</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={"framer-1wha7z8"} data-framer-name={"Footer Logo Wrap"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                <div className={"framer-1029xla"} data-framer-name={"Gradient Layer"} style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.55) 30%, rgb(255, 255, 255) 93%)" } as React.CSSProperties} />
                <div className={"framer-3xr0l9"}>
                  <div className={"framer-99r95a-container"} style={{ transform: "translateX(-50%)" } as React.CSSProperties}>
                    <a className={"framer-4X5ZN framer-10rs7as framer-v-1xpu774 framer-1jc5brm"} data-framer-name={"Logo Dark Large"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                      <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                        <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                          <img decoding={"async"} loading={"lazy"} width={"1245"} height={"227"} src={siteLogo.watermark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
          <div className={`ssr-variant hidden-${hashes.desktop}`}>
            <footer className={"framer-kIeXk framer-FuTU5 framer-ShxJM framer-ytjKt framer-Z70cW framer-q3F3D framer-25f22s framer-v-1jo7mdf"} data-framer-name={"Phone"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", width: "100%" } as React.CSSProperties}>
              <div className={"framer-1pvq53s"} data-framer-name={"Linear Background"} style={{ background: "linear-gradient(180deg, var(--token-fe810758-ba26-4c60-a7b7-193cf95cf6ce, rgba(255, 255, 255, 0)) 0%, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)) 100%)" } as React.CSSProperties} />
              <div className={"framer-91x297"} data-framer-name={"Container"}>
                <div className={"framer-glvige"} data-framer-name={"Footer Wrapper"}>
                  <div className={"framer-1q51sri"} data-framer-name={"Footer Description"}>
                    <div className={"framer-1rwbufp-container"}>
                      <a className={"framer-4X5ZN framer-10rs7as framer-v-f1vhqz framer-1jc5brm"} data-framer-name={"Logo Dark"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                        <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                          <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                            <img decoding={"async"} width={"153"} height={"29"} src={siteLogo.dark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                          </div>
                        </div>
                      </a>
                    </div>
                    <div className={"framer-75f6l"} data-framer-name={"Text Block"}>
                      <div className={"framer-k9231b"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                          {contact.officeLabel}
                        </p>
                      </div>
                      <div className={"framer-1ozirm2"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          <a className={"framer-text framer-styles-preset-b4f9gh"} data-styles-preset={"AjgMvdFPo"} href={contact.addressHref} target={"_blank"} rel={""}>
                            {contact.address.join('\u2028')}
                          </a>
                        </p>
                      </div>
                    </div>
                    <div className={"framer-971bpt"} data-framer-name={"Label"}>
                      <div className={"framer-prff41"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                          {contact.emailLabel}
                        </p>
                      </div>
                      <div className={"framer-1v2ebvy"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                          <a className={"framer-text framer-styles-preset-b4f9gh"} data-styles-preset={"AjgMvdFPo"} href={`mailto:${contact.email}`} target={"_blank"} rel={""}>
                            {contact.email}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={"framer-e96jzp"} data-framer-name={"Footer List Block"}>
                    <div className={"framer-1w7qv1f"} data-framer-name={"Footer List"}>
                      <div className={"framer-nclzzx"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[0].title}
                        </p>
                      </div>
                      <div className={"framer-59pkxz"} data-framer-name={"List Item Block"}>
{footerColumns[0].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[0][i] ?? LINK_CONTAINERS[0][LINK_CONTAINERS[0].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-2lhesk"} data-framer-name={"Footer List"}>
                      <div className={"framer-13u44s0"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[1].title}
                        </p>
                      </div>
                      <div className={"framer-9faqx5"} data-framer-name={"List Item Block"}>
{footerColumns[1].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[1][i] ?? LINK_CONTAINERS[1][LINK_CONTAINERS[1].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-14olq64"} data-framer-name={"Footer List"}>
                      <div className={"framer-162shz6"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[2].title}
                        </p>
                      </div>
                      <div className={"framer-mr2n1u"} data-framer-name={"List Item Block"}>
{footerColumns[2].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[2][i] ?? LINK_CONTAINERS[2][LINK_CONTAINERS[2].length - 1]} />)}
</div>
                    </div>
                    <div className={"framer-1um81sx"} data-framer-name={"Footer List"}>
                      <div className={"framer-1srvnmy"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                        <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                          {footerColumns[3].title}
                        </p>
                      </div>
                      <div className={"framer-55ksaj"} data-framer-name={"List Item Block"}>
{footerColumns[3].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[3][i] ?? LINK_CONTAINERS[3][LINK_CONTAINERS[3].length - 1]} />)}
</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={"framer-1wha7z8"} data-framer-name={"Footer Logo Wrap"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
                <div className={"framer-1029xla"} data-framer-name={"Gradient Layer"} style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.55) 30%, rgb(255, 255, 255) 93%)" } as React.CSSProperties} />
                <div className={"framer-3xr0l9"}>
                  <div className={"framer-99r95a-container"} style={{ transform: "translateX(-50%)" } as React.CSSProperties}>
                    <a className={"framer-4X5ZN framer-10rs7as framer-v-1xpu774 framer-1jc5brm"} data-framer-name={"Logo Dark Large"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                      <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                        <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                          <img decoding={"async"} loading={"lazy"} width={"1245"} height={"227"} src={siteLogo.watermark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
      <div className={`ssr-variant hidden-${hashes.phone} hidden-${hashes.desktop}`}>
        <div className={containerClass}>
          <footer className={"framer-kIeXk framer-FuTU5 framer-ShxJM framer-ytjKt framer-Z70cW framer-q3F3D framer-25f22s framer-v-folhnv"} data-framer-name={"Tablet"} style={{ backgroundColor: "var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255))", width: "100%" } as React.CSSProperties}>
            <div className={"framer-1pvq53s"} data-framer-name={"Linear Background"} style={{ background: "linear-gradient(180deg, var(--token-fe810758-ba26-4c60-a7b7-193cf95cf6ce, rgba(255, 255, 255, 0)) 0%, var(--token-5cace45c-5aeb-4596-8405-46748e8b644b, rgb(255, 255, 255)) 100%)" } as React.CSSProperties} />
            <div className={"framer-91x297"} data-framer-name={"Container"}>
              <div className={"framer-glvige"} data-framer-name={"Footer Wrapper"}>
                <div className={"framer-1q51sri"} data-framer-name={"Footer Description"}>
                  <div className={"framer-1rwbufp-container"}>
                    <a className={"framer-4X5ZN framer-10rs7as framer-v-f1vhqz framer-1jc5brm"} data-framer-name={"Logo Dark"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                      <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                        <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                          <img decoding={"async"} width={"153"} height={"29"} src={siteLogo.dark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                        </div>
                      </div>
                    </a>
                  </div>
                  <div className={"framer-75f6l"} data-framer-name={"Text Block"}>
                    <div className={"framer-k9231b"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                        {contact.officeLabel}
                      </p>
                    </div>
                    <div className={"framer-1ozirm2"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                        <a className={"framer-text framer-styles-preset-b4f9gh"} data-styles-preset={"AjgMvdFPo"} href={contact.addressHref} target={"_blank"} rel={""}>
                          {contact.address.join('\u2028')}
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className={"framer-971bpt"} data-framer-name={"Label"}>
                    <div className={"framer-prff41"} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-1x4tk8l"} data-styles-preset={"pDck0CifI"}>
                        {contact.emailLabel}
                      </p>
                    </div>
                    <div className={"framer-1v2ebvy"} data-framer-name={"Text"} data-framer-component-type={"RichTextContainer"} style={{ transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-1dfqlr0"} data-styles-preset={"r3nvaFHNq"}>
                        <a className={"framer-text framer-styles-preset-b4f9gh"} data-styles-preset={"AjgMvdFPo"} href={`mailto:${contact.email}`} target={"_blank"} rel={""}>
                          {contact.email}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                <div className={"framer-e96jzp"} data-framer-name={"Footer List Block"}>
                  <div className={"framer-1w7qv1f"} data-framer-name={"Footer List"}>
                    <div className={"framer-nclzzx"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                        {footerColumns[0].title}
                      </p>
                    </div>
                    <div className={"framer-59pkxz"} data-framer-name={"List Item Block"}>
{footerColumns[0].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[0][i] ?? LINK_CONTAINERS[0][LINK_CONTAINERS[0].length - 1]} />)}
</div>
                  </div>
                  <div className={"framer-2lhesk"} data-framer-name={"Footer List"}>
                    <div className={"framer-13u44s0"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                        {footerColumns[1].title}
                      </p>
                    </div>
                    <div className={"framer-9faqx5"} data-framer-name={"List Item Block"}>
{footerColumns[1].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[1][i] ?? LINK_CONTAINERS[1][LINK_CONTAINERS[1].length - 1]} />)}
</div>
                  </div>
                  <div className={"framer-14olq64"} data-framer-name={"Footer List"}>
                    <div className={"framer-162shz6"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                        {footerColumns[2].title}
                      </p>
                    </div>
                    <div className={"framer-mr2n1u"} data-framer-name={"List Item Block"}>
{footerColumns[2].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[2][i] ?? LINK_CONTAINERS[2][LINK_CONTAINERS[2].length - 1]} />)}
</div>
                  </div>
                  <div className={"framer-1um81sx"} data-framer-name={"Footer List"}>
                    <div className={"framer-1srvnmy"} data-framer-name={"Label"} data-framer-component-type={"RichTextContainer"} style={{ '--framer-link-text-color': "rgb(0, 153, 255)", '--framer-link-text-decoration': "underline", transform: "none" } as React.CSSProperties}>
                      <p className={"framer-text framer-styles-preset-d4by9r"} data-styles-preset={"ahiFuEnMo"}>
                        {footerColumns[3].title}
                      </p>
                    </div>
                    <div className={"framer-55ksaj"} data-framer-name={"List Item Block"}>
{footerColumns[3].links.map((link, i) => <FooterLink key={link.label} link={link} variant="small" containerClass={LINK_CONTAINERS[3][i] ?? LINK_CONTAINERS[3][LINK_CONTAINERS[3].length - 1]} />)}
</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={"framer-1wha7z8"} data-framer-name={"Footer Logo Wrap"} style={{ willChange: "transform", opacity: "0", transform: "translateY(40px)" } as React.CSSProperties}>
              <div className={"framer-1029xla"} data-framer-name={"Gradient Layer"} style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.55) 30%, rgb(255, 255, 255) 93%)" } as React.CSSProperties} />
              <div className={"framer-3xr0l9"}>
                <div className={"framer-99r95a-container"} style={{ transform: "translateX(-50%)" } as React.CSSProperties}>
                  <a className={"framer-4X5ZN framer-10rs7as framer-v-1xpu774 framer-1jc5brm"} data-framer-name={"Logo Dark Large"} data-highlight={"true"} href={"/"} tabIndex={0} style={{ height: "100%", width: "100%" } as React.CSSProperties}>
                    <div className={"framer-1jrltms"} data-framer-name={"Logo"}>
                      <div style={{ position: "absolute", borderRadius: "inherit", cornerShape: "inherit", top: "0", right: "0", bottom: "0", left: "0" } as React.CSSProperties} data-framer-background-image-wrapper={"true"}>
                        <img decoding={"async"} width={"1245"} height={"227"} src={siteLogo.watermark} alt={""} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", cornerShape: "inherit", objectPosition: "center", objectFit: "contain" } as React.CSSProperties} />
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
