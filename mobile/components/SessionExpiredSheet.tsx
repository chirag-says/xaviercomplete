/**
 * "Your session has ended."
 *
 * Rendered *over* whatever is on screen, never in place of it. That is the whole
 * point: sessions are 7-day absolute and 24-hour idle with no refresh, so expiry
 * is routine rather than exceptional, and it lands mid-task — halfway down an
 * event album, or with a half-written profile edit open.
 *
 * Replacing the route with a login screen throws that away and gives the user
 * nothing back when they return. A sheet leaves the route mounted underneath, so
 * signing in again returns them exactly where they were.
 *
 * ## The copy says why
 *
 * "For security, SXCCAA signs you out after a day of inactivity" turns an
 * annoyance into a policy someone can understand and predict. Without a reason
 * it reads as the app losing their session at random, which is the same
 * experience and a worse impression.
 *
 * The 24-hour idle clock is the one that will actually generate support
 * questions — a week away from the app is rare, a day is not.
 */

import { useRouter } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { colour, radius, space } from '@/theme';

export function SessionExpiredSheet(): React.ReactElement | null {
  const { expired, dismissExpired } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!expired) return null;

  function signInAgain(): void {
    // Clears the dead token first, so the login screen does not start by firing
    // another 401 and re-raising this sheet behind itself.
    dismissExpired();
    router.push('/login');
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissExpired}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colour.white,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            padding: space.lg,
            paddingBottom: insets.bottom + space.lg,
          }}
        >
          <Text variant="label" color={colour.ink55}>
            SIGNED OUT
          </Text>
          <Text variant="h3" style={{ marginTop: space.sm }}>
            Your session has ended
          </Text>
          <Text variant="body" color={colour.ink70} style={{ marginTop: space.md }}>
            For security, SXCCAA signs you out after a day without opening the app. Sign in again to pick up where you
            left off.
          </Text>

          <Pressable
            onPress={signInAgain}
            accessibilityRole="button"
            accessibilityLabel="Sign in again"
            style={({ pressed }) => ({
              marginTop: space.lg,
              minHeight: 52,
              borderRadius: radius.pill,
              backgroundColor: colour.ink,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="label" color={colour.white}>
              Sign in again
            </Text>
          </Pressable>

          <Pressable
            onPress={dismissExpired}
            accessibilityRole="button"
            accessibilityLabel="Continue without signing in"
            style={{ marginTop: space.md, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="label" color={colour.navy}>
              Not now
            </Text>
          </Pressable>

          {/*
            "Not now" is a real option, not a courtesy. Everything the app shows
            without a session — home, events, the marketing pages — still works,
            and forcing a sign-in to read a public event listing would be worse
            than the expiry itself.
          */}
        </View>
      </View>
    </Modal>
  );
}
