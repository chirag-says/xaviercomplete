/**
 * /about — the website's About page at mobile width.
 *
 * Sections in the website's order, on its own backgrounds. The previous version
 * of this file used ordinal cards, a dotted timeline and a gold-ruled eyebrow —
 * none of which the website has. They are gone.
 */

import { useWindowDimensions, View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

/** `display` wins when present; otherwise the number and its suffix. */
const figure = (f: { value: number; suffix: string; display?: string }) => f.display ?? `${f.value}${f.suffix}`;

export function AboutPage(): React.ReactElement {
  const content = useContent();
  const { width } = useWindowDimensions();
  const inner = width - layout.gutter * 2;
  const { bannerLead, pillars, pillarsHeading, history, why, college, facts, statLines } = content.about;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="label" color={colour.ink55}>{bannerLead.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{bannerLead.lead}</Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: 16 }}>{bannerLead.text}</Text>
      </Band>

      <Band dark>
        <Text variant="label" color={colour.onDark}>{pillarsHeading.eyebrow}</Text>
        <Text variant="h2" color={colour.white} style={{ marginTop: 16 }}>{pillarsHeading.lines.join(' ')}</Text>
        {pillars.map((p, i) => (
          <View key={p.id} style={{ marginTop: i === 0 ? 32 : 40 }}>
            <Text variant="h3OnDark">{p.title}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 12 }}>{p.summary}</Text>
            {p.points.map((pt) => (
              <Text key={pt} variant="small" color={colour.onDark} style={{ marginTop: 8 }}>{pt}</Text>
            ))}
          </View>
        ))}
      </Band>

      <Band>
        <Text variant="label" color={colour.ink55}>{history.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{history.lines.join(' ')}</Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: 16 }}>{history.intro}</Text>
        <Asset image={history.image} displayWidth={inner} style={{ width: '100%', aspectRatio: 3 / 2, marginTop: 32 }} />
        {history.milestones.map((m) => (
          <View key={m.year} style={{ marginTop: 32 }}>
            <Text variant="label" color={colour.navy}>{m.year}</Text>
            <Text variant="h3" style={{ marginTop: 8 }}>{m.title}</Text>
            <Text variant="body" color={colour.ink70} style={{ marginTop: 8 }}>{m.text}</Text>
          </View>
        ))}
      </Band>

      <Band dark>
        <Text variant="label" color={colour.onDark}>{why.eyebrow}</Text>
        <Text variant="h2" color={colour.white} style={{ marginTop: 16 }}>{why.lines.join(' ')}</Text>
        {why.reasons.map((r, i) => (
          <View key={r.ordinal} style={{ marginTop: i === 0 ? 32 : 40 }}>
            <Text variant="h3OnDark">{r.title}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 12 }}>{r.text}</Text>
          </View>
        ))}
      </Band>

      <Band>
        <Text variant="label" color={colour.ink55}>{college.eyebrow}</Text>
        <Text variant="h2" style={{ marginTop: 16 }}>{college.lines.join(' ')}</Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: 16 }}>{college.lead}</Text>
        {college.marks.map((m) => (
          <Text key={m} variant="h3" style={{ marginTop: 20 }}>{m}</Text>
        ))}
        <View style={{ marginTop: 40 }}>
          <Text variant="label" color={colour.ink55}>{college.motto.eyebrow}</Text>
          <Text variant="h2" style={{ marginTop: 8 }}>{college.motto.latin}</Text>
          <Text variant="body" color={colour.ink70} style={{ marginTop: 8 }}>{college.motto.gloss}</Text>
        </View>
        {college.facts.map((f) => (
          <View key={f.label} style={{ marginTop: 24 }}>
            <Text variant="label" color={colour.ink55}>{f.label}</Text>
            <Text variant="body" style={{ marginTop: 4 }}>{f.value}</Text>
          </View>
        ))}
      </Band>

      <Band dark>
        {facts.map((f, i) => (
          <View key={f.title} style={{ marginTop: i === 0 ? 0 : 40 }}>
            <Text variant="h2" color={colour.white}>{figure(f)}</Text>
            <Text variant="cardTitle" style={{ marginTop: 8 }}>{f.title}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{f.description}</Text>
          </View>
        ))}
        {statLines.map((s) => (
          <View key={s.text} style={{ marginTop: 40 }}>
            <Text variant="h2" color={colour.white}>{figure(s)}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{s.text}</Text>
          </View>
        ))}
      </Band>
    </Page>
  );
}
