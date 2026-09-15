/**
 * The website's mobile header, reproduced.
 *
 * Measured at 390 × 844 on the live site:
 *
 *   position   fixed, z-index 10, transparent background
 *   height     72
 *   inner row  350 wide (20px inset each side)
 *   logo       /svg/logo-crest.svg, 37 × 44, at y = 14
 *   Login      Inter 500 13.5px, white, 1px white border, radius 30, pad 8×20
 *   hamburger  24 × 18 glyph in a 48 × 48 target
 *
 * ## Why this replaces a bottom tab bar
 *
 * The first build gave the app a five-tab bottom bar. **The website has no such
 * thing** — no bottom navigation exists anywhere on it. Its mobile navigation is
 * this header plus a hamburger dropdown, so that is what the app has.
 *
 * ## The header is transparent and sits over the content
 *
 * It does not push the page down; the hero runs full-bleed underneath it, which
 * is why the hero's top padding is 120 rather than 60. Screens therefore do
 * **not** add top padding for it — they let content scroll beneath, exactly as
 * the website does.
 *
 * The one addition the web has no equivalent for is the safe-area inset: on a
 * phone with a notch or a status bar the 72px band starts below it, otherwise
 * the crest would sit under the clock.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { absoluteUrl } from '@/lib/images';
import { colour, layout, preset } from '@/theme';

/** Measured from the live header. */
const LOGO_W = 37;
const LOGO_H = 44;
const BURGER_TARGET = 48;

export interface SiteHeaderProps {
  onOpenMenu: () => void;
  /**
   * The header is white-on-transparent over the hero and the dark bands, and
   * must flip to ink over white sections — the website does the same thing with
   * its scroll variant.
   */
  tone?: 'light' | 'dark';
}

/**
 * The three-bar glyph. Measured: **24 × 18**, three 24 × 2 bars with **square**
 * corners at y 27 / 35 / 43 inside the 72px header — an 8px pitch, which
 * `space-between` across 18px reproduces exactly.
 */
function Hamburger({ tint }: { tint: string }): React.ReactElement {
  return (
    <View style={{ width: 24, height: 18, justifyContent: 'space-between' }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 2, backgroundColor: tint }} />
      ))}
    </View>
  );
}

export function SiteHeader({ onOpenMenu, tone = 'light' }: SiteHeaderProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useAuth();

  const tint = tone === 'light' ? colour.white : colour.ink;

  return (
    <View
      // Fixed over the content, as on the website. Not part of the scroll flow.
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingTop: insets.top,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          height: layout.headerHeight,
          marginHorizontal: layout.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.push('/')}
          accessibilityRole="link"
          accessibilityLabel="SXCCAA home"
          hitSlop={10}
        >
          <Image
            source={{ uri: absoluteUrl('/svg/logo-crest.svg') }}
            style={{ width: LOGO_W, height: LOGO_H }}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel="St. Xavier's College Calcutta crest"
          />
        </Pressable>

        {/* Measured: the pill's right edge is 300 and the hamburger's 48px
            target starts at 322 — a 22px gap, not 8. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.headerGap }}>
          {/*
            The website shows a "Login" pill here, and swaps it for an account
            control once signed in. Same behaviour, same pill.
          */}
          <Pressable
            onPress={() => router.push(me?.signedIn ? '/me' : '/login')}
            accessibilityRole="button"
            accessibilityLabel={me?.signedIn ? 'Your profile' : 'Login'}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: tint,
              borderRadius: layout.pillRadius,
              paddingVertical: 8,
              paddingHorizontal: 20,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="loginPill" color={tint}>
              {me?.signedIn ? me.initials || 'Account' : 'Login'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onOpenMenu}
            accessibilityRole="button"
            accessibilityLabel="Open the menu"
            // The glyph is centred in its 48px target (x 334 inside 322–370),
            // not flush to the right edge, which put it 12px too far over.
            style={{
              width: BURGER_TARGET,
              height: BURGER_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Hamburger tint={tint} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** The height a screen must clear if it does NOT want content under the header. */
export function headerClearance(topInset: number): number {
  return layout.headerHeight + topInset;
}

export { preset as headerPreset };
