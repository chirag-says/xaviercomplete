/**
 * /me — the signed-in alumnus's own record.
 *
 * An app-only screen: the website has /me, but its content (the editable
 * profile) arrives in phase 4. Styled with the website's presets and controls,
 * introducing no new visual language.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { useContent } from '@/lib/content-context';
import { colour, layout, space } from '@/theme';

export default function MeRoute(): React.ReactElement {
  const { me, loading, signOut } = useAuth();
  const content = useContent();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <Page headerTone="dark" footer={false}>
        <View style={{ paddingTop: 200, alignItems: 'center' }}><ActivityIndicator color={colour.ink} /></View>
      </Page>
    );
  }

  if (!me?.signedIn) {
    return (
      <Page headerTone="dark">
        <Band padTop={layout.heroPadTop}>
          <Text variant="h2">Your Xaverian record</Text>
          <Text variant="lede" style={{ marginTop: 20 }}>
            Sign in with the address the Association has on record to see the directory and edit what others see about you.
          </Text>
          <Pressable onPress={() => router.push('/login')} accessibilityRole="button" accessibilityLabel="Login"
            style={({ pressed }) => ({ marginTop: 32, alignSelf: 'flex-start', borderWidth: 1, borderColor: colour.ink,
              borderRadius: layout.pillRadius, paddingVertical: 8, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1 })}>
            <Text variant="loginPill" color={colour.ink}>Login</Text>
          </Pressable>
          <Text variant="small" color={colour.ink55} style={{ marginTop: 32 }}>
            {content.directory.copy.privacyNote}
          </Text>
        </Band>
      </Page>
    );
  }

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="h2">{me.name ?? 'Signed in'}</Text>
        <Text variant="small" color={colour.ink55} style={{ marginTop: 8 }}>
          {me.hasRecord ? 'Verified Xaverian' : 'Signed in — no directory record yet'}
        </Text>
        {!me.hasRecord ? (
          <Text variant="body" color={colour.ink70} style={{ marginTop: 16 }}>
            The Association has not yet added your details to the directory. They will appear here once it does.
          </Text>
        ) : null}
        <Pressable
          onPress={() => Alert.alert('Sign out', 'Sign out on this device, or everywhere?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'This device', onPress: () => { setBusy(true); void signOut('device').finally(() => setBusy(false)); } },
            { text: 'Everywhere', style: 'destructive', onPress: () => { setBusy(true); void signOut('everywhere').finally(() => setBusy(false)); } },
          ])}
          disabled={busy} accessibilityRole="button" accessibilityLabel="Sign out"
          style={({ pressed }) => ({ marginTop: space.xxl, minHeight: 52, borderRadius: layout.pillRadius,
            borderWidth: 1, borderColor: colour.ink08, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          {busy ? <ActivityIndicator color={colour.ink} /> : <Text variant="label">Sign out</Text>}
        </Pressable>
      </Band>
    </Page>
  );
}
