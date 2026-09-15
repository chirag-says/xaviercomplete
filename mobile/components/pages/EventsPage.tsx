/**
 * /events — the website's Events page at mobile width.
 */

import { useWindowDimensions, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

export function EventsPage(): React.ReactElement {
  const content = useContent();
  const { width } = useWindowDimensions();
  const inner = width - layout.gutter * 2;
  const { page, upcoming, all } = content.events;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="label" color={colour.ink55}>{page.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{page.headline.join(' ')}</Text>
        <Text variant="lede" style={{ marginTop: 20 }}>{page.intro}</Text>
      </Band>

      <Band dark>
        <Asset image={upcoming.poster} displayWidth={inner} style={{ width: '100%', aspectRatio: 3 / 2 }} />
        <Text variant="h3OnDark" style={{ marginTop: 20 }}>{upcoming.title}</Text>
        <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{upcoming.date} · {upcoming.time}</Text>
        <Text variant="bodyOnDark">{upcoming.place}</Text>
        <Text variant="bodyOnDark" style={{ marginTop: 16 }}>{upcoming.lede}</Text>
      </Band>

      <Band>
        <Text variant="label" color={colour.ink55}>{page.recordEyebrow}</Text>
        {all.map((e, i) => (
          <View key={e.id} style={{ marginTop: i === 0 ? 32 : 40 }}>
            {e.images[0] ? (
              <Asset image={e.images[0]} displayWidth={inner} style={{ width: '100%', aspectRatio: 16 / 10 }} />
            ) : null}
            <Text variant="label" color={colour.ink55} style={{ marginTop: 16 }}>
              {[e.stamp.day, e.stamp.month, e.stamp.year].filter(Boolean).join(' ')}
            </Text>
            <Text variant="h3" style={{ marginTop: 8 }}>{e.title}</Text>
            <Text variant="small" color={colour.ink55} style={{ marginTop: 4 }}>{e.place}</Text>
            <Text variant="body" color={colour.ink70} style={{ marginTop: 12 }}>{e.description}</Text>
          </View>
        ))}
        <Text variant="small" color={colour.ink55} style={{ marginTop: 40 }}>{page.photoNote}</Text>
      </Band>
    </Page>
  );
}
