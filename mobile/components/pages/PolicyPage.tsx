/**
 * /privacy-policy and /terms-of-use — the website's own words, from the content
 * bundle. Both surfaces import src/data/pages/policies.ts, so there is one
 * source rather than a paraphrase that drifts.
 *
 * The provisional notice is shown verbatim. It is the Association's disclaimer
 * and softening it would let provisional text read as a legal document.
 */

import { View } from 'react-native';

import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

export function PrivacyPolicyPage(): React.ReactElement {
  return <Policy kind="privacy" />;
}

export function TermsOfUsePage(): React.ReactElement {
  return <Policy kind="terms" />;
}

function Policy({ kind }: { kind: 'privacy' | 'terms' }): React.ReactElement {
  const content = useContent();
  const doc = kind === 'privacy' ? content.policies.privacy : content.policies.terms;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="h2">{doc.title}</Text>
        <Text variant="lede" style={{ marginTop: 20 }}>{doc.intro}</Text>
        <View style={{ marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colour.ink08 }}>
          <Text variant="small" color={colour.ink70}>{doc.notice}</Text>
        </View>
        {doc.points.map((p) => (
          <Text key={p} variant="body" style={{ marginTop: 16 }}>{p}</Text>
        ))}
      </Band>
    </Page>
  );
}
