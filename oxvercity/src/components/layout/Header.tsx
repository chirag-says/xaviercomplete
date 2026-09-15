'use client';

/**
 * The fixed site header, in Framer's three breakpoint copies (desktop, tablet,
 * phone) which the breakpoint stylesheet shows one at a time. All three share
 * one state:
 *
 * - `scrolled`: the 1px `#scroll-trigger` at the top of the page has left the
 *   viewport. The bar turns white with a shadow, the logo and text turn ink,
 *   and the contact pill inverts (Framer's "Scroll" variants, 0.4s ease).
 * - `hidden`: the visitor is scrolling down. The whole bar lifts out of view
 *   (y -120, opacity 0) on a spring of stiffness 300 / damping 40, and drops
 *   back on the first 4px of upward scroll. This is Framer's scroll-direction
 *   effect, including its quirk that a jump straight to the top does not bring
 *   the bar back until the next scroll.
 * - `pagesOpen`: the desktop "Pages" pill is hovered; its dropdown mounts.
 * - `menuOpen`: the phone/tablet hamburger has been tapped; the menu panel
 *   drops in (top 90px → 80px, opacity 0 → 1).
 * - `searchOpen`: the magnifier opened the search modal.
 *
 * Markup and class names are Framer's. Link lists come from `data/site.ts`.
 */

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { animate, type AnimationPlaybackControls } from 'motion';
import { AccountMenu, useAccountSummary, type AccountSummary } from '@/components/layout/AccountMenu';
import { Button } from '@/components/ui/Button';
import { SearchModal } from '@/components/search/SearchModal';
import { associationName, headerCta, mainNav, mobileMenu, pagesMenu, pagesMenuLabel, siteLogo, type NavLink } from '@/data/site';
import { tokens } from '@/lib/tokens';

type Tone = 'light' | 'dark';
const ink = (tone: Tone) => (tone === 'light' ? tokens.white : tokens.ink);
const textVars = (color: string) => ({ '--extracted-r6o4lv': color, '--framer-paragraph-spacing': '0px', transform: 'none' }) as CSSProperties;
const textColor = (color: string) => ({ '--framer-text-color': `var(--extracted-r6o4lv, ${color})` }) as CSSProperties;
const BORDER = 0.6000000238418579;
const SHADOW = 'rgba(17, 17, 17, 0.25) 0px 2px 40px 0px';
const HIDE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 40, mass: 1 };
/** The "Explore" dropdown sits before this entry of `mainNav`, i.e. third in the bar. */
const PAGES_MENU_INDEX = 2;

function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/* ---------------------------------------------------------------- logo --- */
function Logo({ tone }: { tone: Tone }) {
  const dark = tone === 'dark';
  return (
    <div className="framer-1y0kl7e-container">
      <a
        className={`framer-4X5ZN framer-10rs7as ${dark ? 'framer-v-f1vhqz' : 'framer-v-10rs7as'} framer-1jc5brm`}
        data-framer-name={dark ? 'Logo Dark' : 'Logo White'}
        data-highlight="true"
        href="/"
        tabIndex={0}
        style={{ height: '100%', width: '100%' }}
      >
        <div className="framer-1jrltms" data-framer-name="Logo">
          <div style={{ position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 }} data-framer-background-image-wrapper="true">
            <img
              decoding="async"
              width={siteLogo.crestWidth}
              height={siteLogo.crestHeight}
              src={siteLogo.crest}
              alt={associationName}
              style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: 'center', objectFit: 'contain' }}
            />
          </div>
        </div>
      </a>
    </div>
  );
}

/* ------------------------------------------------------- desktop items --- */
function DesktopNavItem({ link, tone, current, containerClass }: { link: NavLink; tone: Tone; current: boolean; containerClass: string }) {
  const light = tone === 'light';
  const variant = current ? (light ? 'framer-v-1gkdry5' : 'framer-v-2qh80c') : light ? 'framer-v-1elg814' : 'framer-v-1rml2sl';
  const pill = current ? ink(tone) : tokens.white20;
  const text = current ? (light ? tokens.ink : tokens.white) : ink(tone);
  const hoverText = light ? tokens.ink : tokens.white;
  return (
    <div className={containerClass}>
      <a
        className={`framer-ID2Sw framer-5YEWi framer-1elg814 ${variant} framer-1jk0ay1`}
        data-border="true"
        data-framer-name={current ? 'Active' : light ? 'Inactive' : 'Inactive Black'}
        data-highlight="true"
        href={link.href}
        {...(current ? { 'data-framer-page-link-current': 'true' } : {})}
        tabIndex={0}
        style={{ '--border-bottom-width': `${BORDER}px`, '--border-color': ink(tone), '--border-left-width': `${BORDER}px`, '--border-right-width': `${BORDER}px`, '--border-style': 'solid', '--border-top-width': `${BORDER}px`, backgroundColor: pill, borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', borderTopLeftRadius: '30px', borderTopRightRadius: '30px' } as CSSProperties}
      >
        <div className="framer-1g47fbf" data-framer-name="Text Wrapper">
          <div className="framer-c3h8z2" data-framer-name="Default Text" data-framer-component-type="RichTextContainer" style={textVars(text)}>
            <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(text)}>{link.label}</p>
          </div>
          <div className="framer-2fqee9" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={textVars(hoverText)}>
            <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(hoverText)}>{link.label}</p>
          </div>
        </div>
      </a>
    </div>
  );
}

const DROPDOWN_COLUMNS = [
  { wrapper: 'framer-v7lofn', title: 'framer-1w4d4xl', block: 'framer-1iho0a7', links: ['framer-mbssla-container', 'framer-1uoddvj-container', 'framer-1l2w4q3-container', 'framer-1x57zbb-container', 'framer-ffubp-container', 'framer-14jys3k-container'] },
  { wrapper: 'framer-1kl8m4', title: 'framer-14ic3i4', block: 'framer-13xvn3s', links: ['framer-dcmy6g-container', 'framer-pn0i67-container', 'framer-z7zlnf-container'] },
  { wrapper: 'framer-kixw1w', title: 'framer-ef94vz', block: 'framer-zuvpjl', links: ['framer-1rwkdsl-container', 'framer-yxhown-container', 'framer-13nuj4q-container'] },
];

function PagesDropdown({ pathname }: { pathname: string }) {
  return (
    <div
      className="framer-5dgnsv"
      data-border="true"
      data-framer-name="Drop Down"
      data-highlight="true"
      style={{ '--border-bottom-width': '1px', '--border-color': tokens.white20, '--border-left-width': '1px', '--border-right-width': '1px', '--border-style': 'solid', '--border-top-width': '1px', backgroundColor: tokens.white, borderRadius: '10px', boxShadow: 'rgba(0, 0, 0, 0.25) 0px 2px 30px 0px', top: 52 } as CSSProperties}
    >
      {pagesMenu.map((column, c) => {
        const classes = DROPDOWN_COLUMNS[c] ?? DROPDOWN_COLUMNS[0];
        return (
          <div key={column.title} className={classes.wrapper} data-framer-name="Link Wrapper" data-highlight="true" tabIndex={0}>
            <div className={classes.title} data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--extracted-1w1cjl5': tokens.ink, '--framer-link-text-color': 'rgb(0, 153, 255)', '--framer-link-text-decoration': 'underline', transform: 'none' } as CSSProperties}>
              <h6 className="framer-text framer-styles-preset-wlqvn8" data-styles-preset="TxHg9u52P" style={{ '--framer-text-color': `var(--extracted-1w1cjl5, ${tokens.ink})` } as CSSProperties}>{column.title}</h6>
            </div>
            <div className={classes.block} data-framer-name="Menu Link Block">
              {column.links.map((link, i) => (
                <div key={link.label} className={classes.links[i] ?? classes.links[classes.links.length - 1]}>
                  <a
                    className="framer-toeVM framer-5YEWi framer-1f7aydr framer-v-1f7aydr framer-1smurqg"
                    data-framer-name="Default"
                    href={link.href}
                    {...(isCurrent(pathname, link.href) ? { 'data-framer-page-link-current': 'true' } : {})}
                    style={{ width: '100%' }}
                  >
                    <div className="framer-1qcqbb2" data-framer-name="Name" data-framer-component-type="RichTextContainer" style={textVars(tokens.ink70)}>
                      <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(tokens.ink70)}>{link.label}</p>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PagesMenu({ tone, open, onOpen, onClose, pathname }: { tone: Tone; open: boolean; onOpen: () => void; onClose: () => void; pathname: string }) {
  const light = tone === 'light';
  // The open variants' layout rules (label to flex-end, panel to top 52px) are
  // applied by transform and inline style so the change can be transitioned.
  const variant = light ? 'framer-v-1ye23zd' : 'framer-v-t8ftzp';
  const pill = open ? ink(tone) : tokens.white20;
  const text = open ? (light ? tokens.ink : tokens.white) : ink(tone);
  return (
    <div className="framer-imx3y5-container" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <div
        className={`framer-oEnJF framer-5YEWi framer-0LUQn framer-1ye23zd ${variant}`}
        data-border="true"
        data-framer-name={open ? (light ? 'Sub Menu Open' : 'Sub Menu Black Opened') : light ? 'Sub Menu' : 'Sub Menu Black'}
        data-open={open}
        data-highlight="true"
        style={{ '--border-bottom-width': '1px', '--border-color': ink(tone), '--border-left-width': '1px', '--border-right-width': '1px', '--border-style': 'solid', '--border-top-width': '1px', backgroundColor: pill, borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', borderTopLeftRadius: '30px', borderTopRightRadius: '30px' } as CSSProperties}
      >
        <div className="framer-5i704a" data-framer-name="Content Wrapper">
          <div className="framer-wur4gk" data-framer-name="Text Wrapper">
            <div className="framer-1nobhpd" data-framer-name="Default Text" data-framer-component-type="RichTextContainer" style={textVars(text)}>
              <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(text)}>{pagesMenuLabel}</p>
            </div>
            <div className="framer-kv96uo" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={textVars(text)}>
              <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(text)}>{pagesMenuLabel}</p>
            </div>
          </div>
          <div className="framer-yvgXh framer-xynpjb" style={{ '--43q7um': text, transform: open ? 'rotate(180deg)' : 'none' } as CSSProperties} />
        </div>
        {open && <PagesDropdown pathname={pathname} />}
      </div>
    </div>
  );
}

function SearchButton({ tone, onClick }: { tone: Tone; onClick: () => void }) {
  return (
    <div className="framer-4c9nyj-container">
      <div style={{ height: '100%', display: 'flex', borderRadius: '10px', cursor: 'inherit', overflow: 'hidden', width: '100%', pointerEvents: 'auto' }}>
        <button type="button" aria-label="Search Icon" onClick={onClick} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', cursor: 'pointer', color: 'inherit', border: 'none', borderRadius: '10px', padding: 0 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="28" height="28" style={{ color: ink(tone) }}>
            <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------- phone and tablet --- */
function Hamburger({ open, tone, onClick }: { open: boolean; tone: Tone; onClick: () => void }) {
  const bar = ink(tone);
  return (
    <div className="framer-2x9luz" data-framer-name="Hamburger" data-highlight="true" tabIndex={0} role="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }} style={{ borderBottomLeftRadius: '3px', borderBottomRightRadius: '3px', borderTopLeftRadius: '3px', borderTopRightRadius: '3px' }}>
      <div className="framer-4zdul5-container">
        <div className="framer-6FqrO framer-eu99tr framer-v-eu99tr" data-framer-name={open ? 'X' : 'Burger'} data-open={open} style={{ height: '100%', width: '100%' }}>
          <div className="framer-1aqfry8">
            <div className="framer-1qtdxqi" data-framer-name="Bottom" style={{ backgroundColor: bar }} />
            <div className="framer-q44wgk" data-framer-name="Mid" style={{ backgroundColor: bar }} />
            <div className="framer-8bquqo" data-framer-name="Top" style={{ backgroundColor: bar }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const MOBILE_ITEM_CLASSES = ['framer-y6kjx2-container', 'framer-hq3sy-container', 'framer-15fi588-container', 'framer-1h5vixz-container', 'framer-ovfw0e-container', 'framer-16oc9qw-container', 'framer-bx7fei-container', 'framer-zzq1f6-container', 'framer-da32w6-container', 'framer-qs9dgh-container', 'framer-1kgfhw1-container', 'framer-1gksxsm-container'];

function MobileMenu({ open, pathname, onNavigate }: { open: boolean; pathname: string; onNavigate: () => void }) {
  return (
    <div className="framer-19t9n8a-container" data-open={open} style={{ opacity: open ? 1 : 0 }} aria-hidden={!open}>
      <nav
        className="framer-NUe1E framer-pjoegx framer-v-p7pvlm"
        data-framer-name="Phone"
        data-highlight="true"
        tabIndex={-1}
        style={{ backgroundColor: tokens.navWhite, width: '100%', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', boxShadow: '0px 1px 20px 0px rgba(0, 0, 0, 0.12)' }}
      >
        <div className="framer-1ni2m92" data-framer-name="Menu Item Wrapper">
          <div className="framer-18gaspg" data-framer-name="Menu Item Wrap">
            {mobileMenu.map((link, i) => (
              <div key={link.label} className={MOBILE_ITEM_CLASSES[i] ?? MOBILE_ITEM_CLASSES[MOBILE_ITEM_CLASSES.length - 1]}>
                <a
                  className="framer-ID2Sw framer-5YEWi framer-1elg814 framer-v-4ktrah framer-1jk0ay1"
                  data-border="true"
                  data-framer-name="Phone Black"
                  data-highlight="true"
                  href={link.href}
                  {...(isCurrent(pathname, link.href) ? { 'data-framer-page-link-current': 'true' } : {})}
                  tabIndex={open ? 0 : -1}
                  onClick={onNavigate}
                  style={{ '--border-bottom-width': '0px', '--border-color': tokens.white, '--border-left-width': '0px', '--border-right-width': '0px', '--border-style': 'solid', '--border-top-width': '0px', backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '30px' } as CSSProperties}
                >
                  <div className="framer-1g47fbf" data-framer-name="Text Wrapper">
                    <div className="framer-c3h8z2" data-framer-name="Default Text" data-framer-component-type="RichTextContainer" style={textVars(tokens.ink)}>
                      <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(tokens.ink)}>{link.label}</p>
                    </div>
                    <div className="framer-2fqee9" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={textVars(tokens.white)}>
                      <p className="framer-text framer-styles-preset-ss1j4w" data-styles-preset="L47Y0ZKX7" style={textColor(tokens.white)}>{link.label}</p>
                    </div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------- bars --- */
interface BarProps {
  tone: Tone;
  scrolled: boolean;
  /** Framer's "Style 02": the page starts light, so the bar starts with ink text. */
  lightPage: boolean;
  pathname: string;
  /** Null for anonymous visitors, and for the moment before the answer arrives. */
  me: AccountSummary | null;
}

/** Framer's variant classes for the header per layout, [closed, open] × [top, scrolled]. */
const HEADER_VARIANT = {
  desktop: { top: 'framer-v-1josfqx', scrolled: 'framer-v-h3kk2j', lightTop: 'framer-v-1l1qqoe' },
  tablet: { top: 'framer-v-14vp6pu', scrolled: 'framer-v-u6q06j', openTop: 'framer-v-tuzsqy', openScrolled: 'framer-v-14xtokz', lightTop: 'framer-v-h53bmx', lightOpenTop: 'framer-v-f1divp' },
  phone: { top: 'framer-v-q897to', scrolled: 'framer-v-1edj48z', openTop: 'framer-v-1kshteo', openScrolled: 'framer-v-a3y811', lightTop: 'framer-v-dz6cv7', lightOpenTop: 'framer-v-1mic21w' },
} as const;

function barStyle(scrolled: boolean, shadow = true): CSSProperties {
  return { backgroundColor: scrolled ? tokens.white : tokens.transparent, width: '100%', boxShadow: scrolled && shadow ? SHADOW : 'none' };
}

function DesktopBar({ tone, scrolled, lightPage, pathname, me, pagesOpen, setPagesOpen, openSearch }: BarProps & { pagesOpen: boolean; setPagesOpen: (v: boolean) => void; openSearch: () => void }) {
  // One Framer container class per pill; the last is reused if `mainNav` outgrows
  // the list, since every one of them carries the same declarations.
  const itemClasses = ['framer-y6kjx2-container', 'framer-hq3sy-container', 'framer-9wtvq4-container', 'framer-1t4mhpx-container', 'framer-15fi588-container'];
  const v = HEADER_VARIANT.desktop;
  const variant = scrolled ? v.scrolled : lightPage ? v.lightTop : v.top;
  return (
    <header className={`framer-rGmLG framer-1josfqx ${variant}`} data-framer-name={scrolled ? 'Desktop Scroll' : lightPage ? 'Desktop Style 02' : 'Desktop'} style={barStyle(scrolled)}>
      <div className="framer-7di19x" data-framer-name="Container">
        <div className="framer-3vht76" data-framer-name="Navbar" style={{ backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}>
          <Logo tone={tone} />
          <div className="framer-19t9n8a-container">
            <nav className={`framer-NUe1E framer-pjoegx ${scrolled ? 'framer-v-1l8b0e6' : 'framer-v-pjoegx'}`} data-framer-name={scrolled ? 'Desktop Scroll' : 'Desktop'} data-hide-scrollbars="true" data-highlight="true" aria-label="Main" style={{ backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '12px', boxShadow: 'none' }}>
              <div className="framer-1ni2m92" data-framer-name="Menu Item Wrapper">
                <div className="framer-18gaspg" data-framer-name="Menu Item Wrap">
                  {mainNav.map((link, i) => (
                    <Fragment key={`${link.href}-${i}`}>
                      {i === PAGES_MENU_INDEX && (
                        <PagesMenu tone={tone} open={pagesOpen} onOpen={() => setPagesOpen(true)} onClose={() => setPagesOpen(false)} pathname={pathname} />
                      )}
                      <DesktopNavItem link={link} tone={tone} current={isCurrent(pathname, link.href)} containerClass={itemClasses[i] ?? itemClasses[itemClasses.length - 1]} />
                    </Fragment>
                  ))}
                </div>
              </div>
            </nav>
          </div>
          <div className="framer-wav27y" data-framer-name="Header Button">
            <SearchButton tone={tone} onClick={openSearch} />
            {/* Signed-in alumni only; renders nothing at all for everybody else,
                so the anonymous bar is untouched. */}
            <AccountMenu tone={tone} me={me} />
            <Button label={headerCta.label} href={headerCta.href} variant={tone === 'dark' ? 'default' : 'white'} containerClass="framer-1evgxmi-container" />
          </div>
        </div>
      </div>
    </header>
  );
}

function CompactBar({ layout, tone, scrolled, lightPage, pathname, me, menuOpen, toggleMenu, closeMenu }: BarProps & { layout: 'tablet' | 'phone'; menuOpen: boolean; toggleMenu: () => void; closeMenu: () => void }) {
  const v = HEADER_VARIANT[layout];
  const variant = scrolled ? (menuOpen ? v.openScrolled : v.scrolled) : lightPage ? (menuOpen ? v.lightOpenTop : v.lightTop) : menuOpen ? v.openTop : v.top;
  const name = `${layout === 'tablet' ? 'Tablet' : 'Phone'}${lightPage && !scrolled ? ' Style 02' : ''}${menuOpen ? ' Open' : ''}${scrolled ? ' Scroll' : ''}`;
  // Framer's "Phone Open Scroll" variant drops the shadow while the panel is out.
  const shadow = !(layout === 'phone' && menuOpen);
  return (
    <header className={`framer-rGmLG framer-1josfqx ${variant}`} data-framer-name={name} style={barStyle(scrolled, shadow)}>
      <div className="framer-7di19x" data-framer-name="Container">
        <div className="framer-3vht76" data-framer-name="Navbar" style={{ backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}>
          <Logo tone={tone} />
          <MobileMenu open={menuOpen} pathname={pathname} onNavigate={closeMenu} />
          <div className="framer-wav27y" data-framer-name="Header Button">
            <AccountMenu tone={tone} me={me} />
            <Hamburger open={menuOpen} tone={tone} onClick={toggleMenu} />
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- header --- */
export interface HeaderProps {
  /** The page template's fixed-header slot, `framer-yg91o4-container` on most pages. */
  containerClass?: string;
  /** Pages with a light top (contact, search) use Framer's "Style 02": ink text from the start. */
  lightPage?: boolean;
}

export function Header({ containerClass = 'framer-yg91o4-container', lightPage = false }: HeaderProps) {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  // One request for all three breakpoint copies of the bar.
  const me = useAccountSummary();

  // Route changes close whatever was open.
  useEffect(() => {
    setMenuOpen(false);
    setPagesOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Scroll variant: the page's 1px trigger leaving the viewport.
  useEffect(() => {
    const trigger = document.getElementById('scroll-trigger');
    if (!trigger) { setScrolled(false); return; }
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [pathname]);

  // Scroll direction: Framer's effect, spring 300/40, 4px dead zone after a turn.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let previous = window.scrollY;
    let direction: 'up' | 'down' | undefined;
    let anchor = 0;
    let hidden = false;
    let controls: AnimationPlaybackControls | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > document.documentElement.scrollHeight - window.innerHeight || y < 0) return;
      const now = y < previous ? 'up' : 'down';
      previous = y;
      if (now !== direction) { direction = now; anchor = y; return; }
      if (Math.abs(y - anchor) < 4) return;
      const target = now === 'down';
      if (target === hidden) return;
      hidden = target;
      controls?.stop();
      controls = animate(element, hidden ? { x: '-50%', y: -120, opacity: 0 } : { x: '-50%', y: 0, opacity: 1 }, HIDE_SPRING);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); controls?.stop(); };
  }, []);

  const tone: Tone = scrolled || lightPage ? 'dark' : 'light';
  const toggleMenu = () => setMenuOpen((v) => !v);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div ref={container} className={containerClass} data-framer-layout-hint-center-x="true" style={{ willChange: 'transform', opacity: 1, transform: 'translateX(-50%)' }}>
        <div className="ssr-variant hidden-mygaao hidden-4y47at">
          <DesktopBar tone={tone} scrolled={scrolled} lightPage={lightPage} pathname={pathname} me={me} pagesOpen={pagesOpen} setPagesOpen={setPagesOpen} openSearch={() => setSearchOpen(true)} />
        </div>
        <div className="ssr-variant hidden-4y47at hidden-8j9uhy">
          <CompactBar layout="phone" tone={tone} scrolled={scrolled} lightPage={lightPage} pathname={pathname} me={me} menuOpen={menuOpen} toggleMenu={toggleMenu} closeMenu={closeMenu} />
        </div>
        <div className="ssr-variant hidden-mygaao hidden-8j9uhy">
          <CompactBar layout="tablet" tone={tone} scrolled={scrolled} lightPage={lightPage} pathname={pathname} me={me} menuOpen={menuOpen} toggleMenu={toggleMenu} closeMenu={closeMenu} />
        </div>
      </div>
      <SearchModal open={searchOpen} onClose={closeSearch} />
    </>
  );
}
