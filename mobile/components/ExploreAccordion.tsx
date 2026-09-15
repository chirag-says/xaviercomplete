/**
 * "Explore the Xaverian network" — the website's accordion, reproduced.
 *
 * ## Why this replaced a carousel
 *
 * The app previously rendered this block as a horizontal snapping `ScrollView`.
 * That came from a misread measurement: the earlier audit saw "cards 281 wide
 * at x = 21 with overlapping y values" and concluded carousel. In fact 281.1 is
 * the *text column* width, and the overlapping y values are **collapsed
 * accordion items** whose inner blocks are 1px tall. The website renders
 * `ExploreAccordion` (`framer-49uvd`), one item open at a time, on both the home
 * page and `/explore`.
 *
 * ## The measured geometry, at 390 × 844
 *
 * | Part | Value |
 * |---|---|
 * | Item box | x 20, w 350, padding `0 2px 0 1px` |
 * | Rule | 1px `rgba(17,17,17,0.15)`, **347** wide, at the item's top edge |
 * | Inner padding | `24px 0` |
 * | Closed height | **82.2** |
 * | Open height | **462.2** |
 * | Title | Instrument Sans 26 / 700, ink, x 21, column 281.1 wide |
 * | Icon | 30 × 30 circle at **x 338**, radius 24 |
 * | Icon, closed | transparent fill, 1px ink border, ink plus |
 * | Icon, open | `#111111` fill, white plus **rotated 45°** |
 * | Body | Roboto 16 / 22.4 ink, +12 below the title |
 * | Button | 128.2 × 48.1, `#111111`, radius 80 |
 * | Image | **250 × 193.2**, radius 10, +24 below the button |
 *
 * ## The open/close transition
 *
 * The website animates the text block's and image wrap's heights over 500ms
 * (a FLIP with the Web Animations API) while the image scales up from nothing.
 * `LayoutAnimation` is the closest native equivalent that does not require
 * measuring every child by hand; it animates the height change of the whole
 * item, which is what the eye actually reads here.
 */

import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { SiteButton } from '@/components/SiteButton';
import { Text } from '@/components/Text';
import { colour, layout } from '@/theme';
import type { ExploreItem } from '@/lib/content-types';

/*
 * LayoutAnimation is opt-in on old-architecture Android. Under the New
 * Architecture (this app's default) it is on already, and the call is a no-op —
 * but leaving it out breaks any build that falls back, and it costs nothing.
 */
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Measured. */
const RULE_W = 347;
const INNER_PAD_V = 24;
const TEXT_COL_W = 281.1;
const ICON = 30;
const IMAGE_W = 250;
const IMAGE_H = 193.2;

/**
 * The plus/cross glyph.
 *
 * Two 12 × 1.5 bars; the vertical one is hidden by rotating the pair 45° when
 * open, which is how the website turns the plus into a cross rather than
 * swapping an icon.
 */
function PlusIcon({ open }: { open: boolean }): React.ReactElement {
  const tint = open ? colour.white : colour.ink;
  return (
    <View
      style={{
        width: ICON,
        height: ICON,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: open ? colour.ink : 'transparent',
        borderWidth: 1,
        borderColor: open ? colour.ink : colour.ink,
        transform: [{ rotate: open ? '45deg' : '0deg' }],
      }}
    >
      <View style={{ position: 'absolute', width: 12, height: 1.5, backgroundColor: tint }} />
      <View style={{ position: 'absolute', width: 1.5, height: 12, backgroundColor: tint }} />
    </View>
  );
}

function Item({
  item,
  open,
  detailsLabel,
  onOpen,
}: {
  item: ExploreItem;
  open: boolean;
  detailsLabel: string;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <View style={{ paddingLeft: 1, paddingRight: 2 }}>
      {/* The hairline sits on the item's top edge, 347 wide inside the 350 box. */}
      <View style={{ height: 1, width: RULE_W, backgroundColor: colour.rule }} />

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.create(500, 'easeInEaseOut', 'opacity'));
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.title}
        style={{ paddingVertical: INNER_PAD_V, flexDirection: 'row', alignItems: 'flex-start' }}
      >
        <View style={{ width: TEXT_COL_W }}>
          <Text variant="h3">{item.title}</Text>

          {open ? (
            <>
              <Text variant="body" style={{ marginTop: 12 }}>
                {item.description}
              </Text>
              <SiteButton label={detailsLabel} href={item.href} style={{ marginTop: 15 }} />
            </>
          ) : (
            /*
             * A closed item is 82.2 tall, not the 80.2 its title and padding
             * account for. The website collapses the text block and the image
             * wrap to `height: 1; overflow: hidden` rather than removing them,
             * so each contributes a pixel. Rendering nothing made every closed
             * item 2 short — and with three of them, the whole page below this
             * section sat 6px high.
             */
            <View style={{ height: 1 }} />
          )}
        </View>

        {/* Pushed to x = 338 by the flex row: 21 + 281.1 + gap. */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <PlusIcon open={open} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ width: IMAGE_W, height: IMAGE_H, borderRadius: 10, overflow: 'hidden', marginBottom: INNER_PAD_V }}>
          <Asset image={item.image} displayWidth={IMAGE_W} style={{ width: IMAGE_W, height: IMAGE_H }} />
        </View>
      ) : (
        /* The collapsed image wrap — the second of the two pixels. */
        <View style={{ height: 1 }} />
      )}
    </View>
  );
}

export interface ExploreAccordionProps {
  items: readonly ExploreItem[];
  detailsLabel: string;
}

export function ExploreAccordion({ items, detailsLabel }: ExploreAccordionProps): React.ReactElement {
  // Exactly one open, as on the website, whose wrapper has one "Step" variant
  // per entry and no all-closed state.
  const [open, setOpen] = useState(0);

  return (
    <View style={{ marginHorizontal: layout.gutter }}>
      {items.map((item, i) => (
        <Item key={item.id} item={item} open={i === open} detailsLabel={detailsLabel} onOpen={() => setOpen(i)} />
      ))}
    </View>
  );
}
