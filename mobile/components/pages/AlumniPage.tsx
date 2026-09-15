/**
 * /alumni — the directory.
 *
 * The listing itself arrives in phase 4, against GET /api/app/v1/alumni. The
 * page shell, copy and sign-in prompt are the website's.
 */

import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

export function AlumniPage(): React.ReactElement {
  const content = useContent();
  const router = useRouter();
  const { me } = useAuth();
  const { copy } = content.directory;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="h2">{copy.title}</Text>
        <Text variant="lede" style={{ marginTop: 20 }}>{copy.intro}</Text>

        {!me?.signedIn ? (
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="Login"
            style={({ pressed }) => ({
              marginTop: 32, alignSelf: 'flex-start',
              borderWidth: 1, borderColor: colour.ink, borderRadius: layout.pillRadius,
              paddingVertical: 8, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="loginPill" color={colour.ink}>Login</Text>
          </Pressable>
        ) : null}

        <Text variant="small" color={colour.ink55} style={{ marginTop: 32 }}>{copy.privacyNote}</Text>
      </Band>
    </Page>
  );
}
