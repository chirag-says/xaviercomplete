import type { Metadata } from 'next';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { SearchPanel } from '@/components/search/SearchPanel';
import { Footer } from '@/components/layout/Footer';
import { LAYOUT_HASHES } from '@/lib/breakpoints';
import { searchPage } from '@/data/pages/search';

export const metadata: Metadata = { title: 'Search — SXCCAA' };

/**
 * The original site has no search page: its search lives in the header modal.
 * This route gives that same panel a page of its own, framed like the contact
 * page's banner (the template's own light layout for a form-first page), so
 * the header, footer and type system are the site's.
 */
export default function SearchPage() {
  return (
    <SiteShell rootClass="framer-tVDMH framer-50zb47" headerContainerClass="framer-4kmgod-container" lightPage spacerClass="framer-11ppgcl" footer={<Footer hashes={LAYOUT_HASHES.contact} containerClass="framer-pis4pp-container" />}>
      <div className="framer-S0pG3 framer-S2cF2 framer-PG8vB framer-f9Co9 framer-ytjKt framer-Z70cW framer-hZdsH framer-J7x2y framer-ShxJM framer-PSLVr framer-4ozm6q" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <section className="framer-m2d69s" data-framer-name="Banner Section">
          <div className="framer-1md3kse" data-framer-name="Container">
            <div className="framer-18yu3z" data-framer-name="Content Wrapper" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="framer-e0drya" data-framer-name="Contact Info" style={{ width: '100%', maxWidth: 'none' }}>
                <div className="framer-1r4j60" data-framer-name="Title text">
                  <div className="framer-5kmsq2" data-framer-name="Title" data-framer-component-type="RichTextContainer">
                    <h1 className="framer-text framer-styles-preset-bm56uh" data-styles-preset="oZKofxX7x">{searchPage.title}</h1>
                  </div>
                  <div className="framer-p7unex" data-framer-name="Text" data-framer-component-type="RichTextContainer">
                    <p className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="q695KX4fM">{searchPage.intro}</p>
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', maxWidth: 700 }}>
                <SearchPanel currentPath="/search" frame="page" />
              </div>
            </div>
          </div>
        </section>
        <div aria-label="Scroll Trigger" className="framer-c3vasr" data-framer-name="Scroll Triger" id="scroll-trigger" />
      </div>
    </SiteShell>
  );
}
