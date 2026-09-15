/**
 * The website's content button.
 *
 * Measured at 390 × 844, from "Explore Alumni" on the home page and every other
 * call to action on the site:
 *
 *   height   48.1        padding  12.5 × 20      radius  80
 *   label    Inter 600, 16 / 23.111
 *   primary  fill #111111, white label
 *   grey     fill #f8f8f8, ink label
 *
 * Width is content-driven — "Explore Alumni" measures 186.2, "Events &
 * Activities" 213.2 — so the button shrink-wraps its label rather than
 * stretching, which is why it carries `alignSelf: 'flex-start'`.
 *
 * ## Not to be confused with the Login pill
 *
 * The header's Login control is a *different* shape: radius 30, padding 8 × 20,
 * 31.5 tall, outlined rather than filled. The first build applied the Login
 * pill's geometry to every button on the site, which is why no call to action
 * matched.
 */

import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/Text';
import { resolveLink } from '@/lib/links';
import { button, colour } from '@/theme';

export interface SiteButtonProps {
  label: string;
  /** A website href. An unroutable one renders the button without a link. */
  href?: string;
  /** `#111111` with a white label, or `#f8f8f8` with an ink one. */
  tone?: 'ink' | 'grey';
  style?: { marginTop?: number };
}

export function SiteButton({ label, href, tone = 'ink', style }: SiteButtonProps): React.ReactElement {
  const link = href ? resolveLink(href) : null;

  const body = (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: tone === 'ink' ? colour.ink : colour.grey,
          borderRadius: button.radius,
          paddingVertical: button.padV,
          paddingHorizontal: button.padH,
        },
        style,
      ]}
    >
      <Text variant="button" color={tone === 'ink' ? colour.white : colour.ink}>
        {label}
      </Text>
    </View>
  );

  if (!link) return body;

  return (
    <Link href={link.href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        {body}
      </Pressable>
    </Link>
  );
}
