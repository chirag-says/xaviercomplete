/**
 * The page shell — what every website page is made of on mobile.
 *
 * A website page at 390px is: a fixed transparent header, full-bleed sections
 * that scroll underneath it, then the footer. This reproduces that.
 *
 * ## Why content is NOT inset for the header
 *
 * The website's header floats over the page rather than pushing it down — which
 * is why the hero's top padding is 120 (60 for the section plus the 72 header,
 * roughly) while every later section is 60. Screens therefore start at y = 0 and
 * let the hero run beneath the crest, exactly as the site does.
 *
 * The previous `Screen` component did the opposite: it padded every screen by
 * the safe-area inset and a gutter, which is why nothing was full-bleed and the
 * dark bands could not reach the edges.
 *
 * ## Sections
 *
 * `Band` is the website's `section`: full width, `60px 0`, optionally on
 * `#111111`. Content inside is inset by the 20px gutter — measured from the
 * header's 350-wide inner row at a 390 viewport.
 */

import { createContext, useContext, type ReactNode, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteMenu } from '@/components/SiteMenu';
import { colour, layout } from '@/theme';

/**
 * How far the page has scrolled, on the UI thread.
 *
 * The website has several scroll-driven compositions — the About slider, the
 * Voices pin — and they are not decoration: the About block is 669px tall
 * precisely because it contains 540px of scroll travel, and omitting the
 * behaviour displaced every section below it by that amount.
 *
 * A shared value rather than React state: these run at scroll frequency, and
 * re-rendering the page tree sixty times a second to move two panels is the
 * thing that makes a reproduction feel worse than the original.
 */
const ScrollContext = createContext<SharedValue<number> | null>(null);

/** The page's scroll offset. Null outside a `<Page>` — callers should no-op. */
export function usePageScroll(): SharedValue<number> | null {
  return useContext(ScrollContext);
}

export interface PageProps {
  children: ReactNode;
  /**
   * Tint of the header controls. `light` (white) over a hero or a dark band,
   * `dark` (ink) over white. The website flips this on scroll; the app sets it
   * per page from what sits at the top.
   */
  headerTone?: 'light' | 'dark';
  /** Off for app-only screens that have no website counterpart. */
  footer?: boolean;
}

export function Page({ children, headerTone = 'dark', footer = true }: PageProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <ScrollContext.Provider value={scrollY}>
      <View style={{ flex: 1, backgroundColor: colour.white }}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          // No contentContainer padding: sections are full-bleed and manage their
          // own insets, which is what lets a dark band reach both edges.
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {children}
          {footer ? <SiteFooter /> : null}
        </Animated.ScrollView>

        <SiteHeader tone={headerTone} onOpenMenu={() => setMenuOpen(true)} />
        <SiteMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </View>
    </ScrollContext.Provider>
  );
}

export interface BandProps {
  children: ReactNode;
  /** `#111111`, as three of the home page's six sections use. */
  dark?: boolean;
  /** Skip the 20px horizontal inset for a full-bleed image. */
  bleed?: boolean;
  /** Override the measured `60px 0`. The hero uses 120 / 60. */
  padTop?: number;
  padBottom?: number;
  style?: ViewStyle;
}

/** One website `section`. */
export function Band({ children, dark, bleed, padTop, padBottom, style }: BandProps): React.ReactElement {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? colour.dark : colour.white,
          paddingTop: padTop ?? layout.sectionPadV,
          paddingBottom: padBottom ?? layout.sectionPadV,
          paddingHorizontal: bleed ? 0 : layout.gutter,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
