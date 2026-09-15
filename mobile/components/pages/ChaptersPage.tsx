/**
 * /chapters — the website's Chapters page at mobile width.
 */

import { useWindowDimensions, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

export function ChaptersPage(): React.ReactElement {
  const content = useContent();
  const { width } = useWindowDimensions();
  const inner = width - layout.gutter * 2;
  const { westZone, page, network, meetsSection, billSection, joinSection } = content.chapters;
  const { meet } = westZone;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="label" color={colour.ink55}>{page.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{page.headline.join(' ')}</Text>
        {page.rail.map((r) => (
          <View key={r.key} style={{ marginTop: 24 }}>
            <Text variant="label" color={colour.ink55}>{r.label}</Text>
            <Text variant="h3" style={{ marginTop: 4 }}>{r.value}</Text>
          </View>
        ))}
      </Band>

      <Band dark>
        <Text variant="label" color={colour.onDark}>{westZone.eyebrow}</Text>
        <Text variant="h2" color={colour.white} style={{ marginTop: 16 }}>{westZone.headline.join(' ')}</Text>
        <Text variant="bodyOnDark" style={{ marginTop: 16 }}>{westZone.lede}</Text>
        <Asset image={westZone.poster} displayWidth={inner} style={{ width: '100%', aspectRatio: 16 / 9, marginTop: 32 }} />
        <Text variant="label" color={colour.onDark} style={{ marginTop: 20 }}>{meet.subtitle}</Text>
        <Text variant="h3OnDark" style={{ marginTop: 8 }}>{meet.title}</Text>
        <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{meet.date}</Text>
        <Text variant="bodyOnDark">{meet.place}</Text>
      </Band>

      <Band>
        <Text variant="label" color={colour.ink55}>{meetsSection.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{meetsSection.title}</Text>
        {meet.bill.map((b) => (
          <Text key={b} variant="body" style={{ marginTop: 12 }}>{b}</Text>
        ))}
      </Band>

      <Band dark>
        <Text variant="label" color={colour.onDark}>{billSection.eyebrow}</Text>
        <Text variant="h2" color={colour.white} style={{ marginTop: 16 }}>{billSection.title}</Text>
        {meet.panels.map((p, i) => (
          <View key={p.title} style={{ marginTop: i === 0 ? 32 : 28 }}>
            <Text variant="h3OnDark">{p.title}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{p.detail}</Text>
          </View>
        ))}
        <Text variant="bodyOnDark" style={{ marginTop: 32 }}>{meet.note}</Text>
        {meet.names.map((n) => (
          <Text key={n} variant="small" color={colour.onDark} style={{ marginTop: 8 }}>{n}</Text>
        ))}
      </Band>

      <Band>
        <Text variant="label" color={colour.ink55}>{joinSection.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{joinSection.title}</Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: 16 }}>{joinSection.note}</Text>
      </Band>

      <Band dark>
        <Text variant="label" color={colour.onDark}>{network.eyebrow}</Text>
        <Text variant="h2" color={colour.white} style={{ marginTop: 16 }}>{network.title.join(' ')}</Text>
        <Text variant="bodyOnDark" style={{ marginTop: 16 }}>{network.lede}</Text>
        {network.nodes.map((n) => (
          <View key={n.key} style={{ marginTop: 32 }}>
            <Text variant="h3OnDark">{n.city}</Text>
            <Text variant="label" color={colour.onDark} style={{ marginTop: 8 }}>{n.role}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{n.detail}</Text>
            <Text variant="small" color={colour.onDark} style={{ marginTop: 4 }}>{n.meta}</Text>
          </View>
        ))}
        <Text variant="small" color={colour.onDark} style={{ marginTop: 24 }}>{network.caption}</Text>
      </Band>
    </Page>
  );
}
