/**
 * The website's mobile menu, reproduced.
 *
 * Measured on the live site at 390 × 844: a panel **350 × 464 at (20, 90)**,
 * closed by default — its container carries `opacity: 0; pointer-events: none`
 * until the hamburger is tapped.
 *
 * The ten links, in the website's order:
 *
 *   Home · About SXCCAA · Alumni Directory · Xaverians Making a Difference ·
 *   Explore the Network · Chapters · Alumni Events & Activities · Contact ·
 *   Privacy Policy · Terms of Use
 *
 * They come from the content bundle (`nav.mobile`) rather than being written
 * here, so an edit to the website's navigation reaches the app on next launch.
 * `resolveLink` maps each website href to the app's route.
 *
 * ## What this replaces
 *
 * A five-tab bottom bar that existed on no page of the website. Anything that
 * was reachable from those tabs is reachable here, because these are the
 * website's own ten destinations.
 */

import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { resolveLink } from '@/lib/links';
import { colour, layout } from '@/theme';

export interface SiteMenuProps {
  visible: boolean;
  onClose: () => void;
}

/** Panel geometry, measured: 350 × 464 at (20, 90), radius 12, padding 20. */
const PANEL_W = 350;
const PANEL_TOP = 90;
const PANEL_PAD = 20;
const ROW_H = 28;
const ROW_GAP = 16;

type NavEntry = ReturnType<typeof useContent>['nav']['mobile'][number];

/**
 * The website's *rendered* order, which is not its data order.
 *
 * The bundle lists "Xaverians Making a Difference" before "Explore the
 * Network"; the stylesheet reorders them, so on screen Explore comes fourth and
 * Xaverians fifth (measured at y 242 and 286). The app has no CSS `order`, so
 * the swap happens here.
 *
 * It is keyed on href rather than index so a future edit to the bundle — adding
 * an entry, renaming a label — cannot silently reorder something else.
 */
function orderedMobileNav(entries: readonly NavEntry[]): NavEntry[] {
  const next = [...entries];
  const a = next.findIndex((e) => e.href === '/alumni#featured');
  const b = next.findIndex((e) => e.href === '/explore');
  const featured = next[a];
  const explore = next[b];
  if (a >= 0 && b >= 0 && a < b && featured && explore) {
    next[a] = explore;
    next[b] = featured;
  }
  return next;
}

export function SiteMenu({ visible, onClose }: SiteMenuProps): React.ReactElement {
  const content = useContent();
  const insets = useSafeAreaInsets();

  /*
   * Every entry the website's mobile menu shows, including the ones that map to
   * a tab. This is the whole navigation, not a filtered subset — filtering is
   * what produced the "More" list the first build invented.
   */
  const links = useMemo(
    () =>
      orderedMobileNav(content.nav.mobile)
        .map((entry) => ({ entry, link: resolveLink(entry.href) }))
        .filter((row): row is { entry: typeof row.entry; link: NonNullable<typeof row.link> } => Boolean(row.link)),
    [content.nav.mobile],
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      {/*
        Tapping outside closes. The backdrop is **transparent**: the website
        dims nothing — its panel is the entire overlay, and the page stays fully
        visible around it. The scrim and drop shadow the first build added were
        inventions, and they are what made the menu read as a native sheet
        rather than as the site's own dropdown.
      */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close the menu"
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <View
          style={{
            position: 'absolute',
            top: insets.top + PANEL_TOP,
            left: layout.gutter,
            width: PANEL_W,
            maxWidth: '100%',
            backgroundColor: colour.white,
            borderRadius: 12,
            padding: PANEL_PAD,
            // 10 rows × 28 + 9 gaps × 16 + 40 padding = 464, the measured height.
            gap: ROW_GAP,
          }}
        >
          {links.map(({ entry, link }) => (
            <Link key={entry.href} href={link.href} asChild onPress={onClose}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={entry.label}
                // 28 tall on a 44 pitch. `hitSlop` recovers the touch target the
                // website does not need and a phone does — without it a 28px row
                // is below every platform minimum.
                hitSlop={{ top: ROW_GAP / 2, bottom: ROW_GAP / 2 }}
                style={({ pressed }) => ({ height: ROW_H, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <Text variant="navLink">{entry.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
