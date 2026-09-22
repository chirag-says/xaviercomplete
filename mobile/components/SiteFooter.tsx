/**
 * The website's mobile footer, reproduced.
 *
 * Measured at 390 × 844 — **721px tall**, white, identical on every page:
 *
 * | y (from the footer top) | Block |
 * |---|---|
 * | +59.6 | `logo-dark.svg`, 129 × 32 |
 * | +14   | the Association's full name — Roboto 15/400/20.625, ink |
 * | +14   | "Association Office" — Instrument Sans 15/600/20.625, ink |
 * | +7.1  | the address — Roboto 15/400/20.625, ink, two lines |
 * | +15.6 | "Email" |
 * | +7    | `contact@sxccal.edu` |
 * | +31.7 | column heads, **two per row** at x = 20 and x = 207 |
 * | +30   | `logo-watermark.svg`, 370 × 67.5, at **x = 10** |
 *
 * ## What the first build got wrong
 *
 * It had no wordmark and no watermark; it stacked the four link columns in a
 * single vertical run instead of a 2 × 2 grid; it set the links in Roboto at
 * `ink70` instead of Instrument Sans 15/600 at full ink; and it added a
 * `© …` line above a hairline rule. **The website has no copyright line and no
 * top border** — both were mine.
 *
 * ## The watermark bleeds
 *
 * It is 370 wide at x = 10, so it is inset 10 rather than the 20 every other
 * block uses. That is not a rounding error: it is wider than the content column
 * on purpose, and reproducing it needs a negative margin against the gutter.
 */

import { Link } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { resolveLink } from '@/lib/links';
import { colour, layout } from '@/theme';

/** Measured. The column grid is two 163-wide tracks at x = 20 and x = 207. */
const COL_W = 163;
const COL_GAP = 24;
/** A 26.6 pitch on a 20.625 line box. */
const LINK_GAP = 6;

/**
 * The 6px rhythm lives on the column's `gap`, not on each row's `marginTop`.
 *
 * `<Link asChild>` does not carry a margin set on the child it clones — the
 * links rendered at a 20.6 pitch instead of 26.6, and by the sixth one the
 * column was 31px short. A `gap` on the container is applied by the layout
 * engine and cannot be dropped that way.
 */
function FooterLink({ label, href }: { label: string; href: string }): React.ReactElement {
  const resolved = resolveLink(href);

  // A destination the app has no route for is shown as plain text rather than a
  // link that goes nowhere.
  if (!resolved) return <Text variant="label">{label}</Text>;

  return (
    <Link href={resolved.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={{ top: 4, bottom: 4 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="label">{label}</Text>
      </Pressable>
    </Link>
  );
}

export function SiteFooter(): React.ReactElement {
  const content = useContent();
  const { associationName, contact, logo } = content.site;
  const columns = content.nav.footerColumns;

  /* Two columns per row, in the bundle's own order: Main Pages ‖ Explore, then
     Support ‖ Utility Pages. */
  const rows: (typeof columns)[] = [];
  for (let i = 0; i < columns.length; i += 2) rows.push(columns.slice(i, i + 2));

  return (
    <View style={{ backgroundColor: colour.white, paddingTop: layout.sectionPadV, paddingHorizontal: layout.gutter }}>
      {/* ── Wordmark, 129 × 32 ─────────────────────────────────────────── */}
      <Asset
        image={{ src: logo.dark, width: 129, height: 32, alt: associationName }}
        displayWidth={129}
        contentFit="contain"
        style={{ width: 129, height: 32 }}
      />

      {/* ── The Association's full name, as on the website ─────────────── */}
      <Text variant="small" style={{ marginTop: 14 }}>
        {associationName}
      </Text>

      {/* ── Association Office ─────────────────────────────────────────── */}
      <Text variant="label" style={{ marginTop: 14 }}>
        {contact.officeLabel}
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(contact.addressHref)}
        accessibilityRole="link"
        accessibilityLabel={`Association office: ${contact.address.filter(Boolean).join(', ')}`}
        style={{ marginTop: 7 }}
      >
        <Text variant="small">{contact.address.filter(Boolean).join('\n')}</Text>
      </Pressable>

      {/* ── Email ──────────────────────────────────────────────────────── */}
      {/*
        13.1, not the 15.6 the raw gap suggests. The website's two-line address
        anchor is 38.6 tall where React Native gives the same two lines a 41.3
        line box, so reproducing the *gap* pushes everything below it 2.5 down.
        The measured **top** — 7651.5 — is what has to match.
      */}
      <Text variant="label" style={{ marginTop: 13.1 }}>
        {contact.emailLabel}
      </Text>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
        accessibilityRole="link"
        accessibilityLabel={`Email ${contact.email}`}
        style={{ marginTop: 7 }}
      >
        <Text variant="small">{contact.email}</Text>
      </Pressable>

      {/* ── Link columns, 2 × 2 ────────────────────────────────────────── */}
      {rows.map((row, i) => (
        <View
          key={row.map((c) => c.title).join('|')}
          // 29.1 rather than the measured 31.7 gap, for the same line-box
          // reason as the Email label above: the target is the head's top, 7728.8.
          style={{ flexDirection: 'row', gap: COL_GAP, marginTop: i === 0 ? 29.1 : 20 }}
        >
          {row.map((column) => (
            <View key={column.title} style={{ width: COL_W }}>
              <Text variant="columnHead">{column.title}</Text>
              <View style={{ marginTop: 14, gap: LINK_GAP }}>
                {column.links.map((link) => (
                  <FooterLink key={link.href + link.label} label={link.label} href={link.href} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}

      {/* ── Watermark, 370 × 67.5, inset 10 rather than the 20 gutter ──── */}
      <Asset
        image={{ src: logo.watermark, width: 370, height: 68, alt: '' }}
        displayWidth={370}
        contentFit="contain"
        style={{ width: 370, height: 67.5, marginTop: 30, marginBottom: 36, marginHorizontal: 10 - layout.gutter }}
      />
    </View>
  );
}
