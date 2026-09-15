/**
 * /explore — the website's Explore page at mobile width.
 * Stacked image-and-text blocks, as the site stacks them on a phone.
 */

import { Link } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { resolveLink } from '@/lib/links';
import { colour, layout } from '@/theme';

export function ExplorePage(): React.ReactElement {
  const content = useContent();
  const { width } = useWindowDimensions();
  const inner = width - layout.gutter * 2;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="h2">{content.explore.detailsLabel}</Text>
        {content.explore.items.map((item, i) => {
          const link = resolveLink(item.href);
          const body = (
            <>
              <Asset image={item.image} displayWidth={inner} style={{ width: '100%', aspectRatio: 4 / 3 }} />
              <Text variant="h3" style={{ marginTop: 20 }}>{item.title}</Text>
              <Text variant="body" color={colour.ink70} style={{ marginTop: 12 }}>{item.description}</Text>
            </>
          );
          return (
            <View key={item.id} style={{ marginTop: i === 0 ? 32 : 40 }}>
              {link ? (
                <Link href={link.href} asChild>
                  <Pressable accessibilityRole="link" accessibilityLabel={item.title}>{body}</Pressable>
                </Link>
              ) : body}
            </View>
          );
        })}
      </Band>
    </Page>
  );
}
