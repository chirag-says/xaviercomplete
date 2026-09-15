/**
 * The app shell: fonts, then content, then the navigator.
 *
 * ## Why the fonts are bundled and not downloaded
 *
 * The website self-hosts eighty font files in oxvercity/public/fonts — and
 * seventy-nine of them are `.woff2`, which React Native cannot load. That is not
 * a packaging problem to work around; it is the wrong format entirely.
 *
 * All three families are Google Fonts, so `@expo-google-fonts/*` supplies the
 * same typefaces as `.ttf`, compiled into the binary. The alternative — fetching
 * them at launch — would mean the first paint of every cold start is the system
 * font, and on a bad connection it stays that way.
 *
 * ## Why nothing renders until content resolves
 *
 * The splash screen is held until both the fonts and the content bundle are
 * ready. It costs a few hundred milliseconds on first launch and nothing
 * thereafter (the bundle is on disk), and it buys something worth more: every
 * screen below this point can treat `useContent()` as non-null. Without the
 * gate, nine screens each grow optional-chaining down four levels, and the
 * loading state has to be designed nine times.
 */

/*
 * Each weight is imported from its own entry point, never from the package root.
 *
 * `@expo-google-fonts/roboto` exports eighteen weights and their italics, and
 * every one registers a .ttf with Metro — so importing the root bundles all of
 * them whether or not they are used. Measured on this app: the root imports
 * produced 45 font files and 9.9MB of assets; these six produce 7 files. The
 * `useFonts` hook still comes from expo-font, which is where it actually lives.
 */
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_500Medium } from '@expo-google-fonts/roboto/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionExpiredSheet } from '@/components/SessionExpiredSheet';
import { Text } from '@/components/Text';
import { AuthProvider } from '@/lib/auth-context';
import { ContentProvider, useContentState } from '@/lib/content-context';
import { colour, radius, space } from '@/theme';

// Held manually so the splash covers font loading and the first content read
// rather than vanishing onto an empty white screen.
void SplashScreen.preventAutoHideAsync();

/**
 * First launch with no cached bundle and no connection. The only genuine dead
 * end in the app, so it gets a real explanation and a retry rather than a
 * spinner that never resolves.
 */
function Unavailable({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colour.white }}>
      <Text variant="label" color={colour.ink70}>
        SXCCAA
      </Text>
      <Text variant="h2" style={{ marginTop: space.md }}>
        Couldn&rsquo;t load the app
      </Text>
      <Text variant="body" color={colour.ink70} style={{ marginTop: space.md }}>
        The Association&rsquo;s content could not be reached, and there is no copy saved on this device yet. Check
        your connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try loading again"
        style={{
          marginTop: space.xl,
          paddingVertical: space.base,
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          backgroundColor: colour.ink,
          alignSelf: 'flex-start',
        }}
      >
        <Text variant="label" color={colour.white}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

function Shell(): React.ReactElement | null {
  const { content, loading, error, reload } = useContentState();

  const ready = !loading && (content !== null || error !== null);

  const onLayout = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    // Visible only in the sliver between the splash hiding and the first paint,
    // and on a manual retry.
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colour.white }}>
        <ActivityIndicator color={colour.ink} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colour.white }} onLayout={onLayout}>
      {content === null ? (
        <Unavailable onRetry={reload} />
      ) : (
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colour.white },
              animation: 'slide_from_right',
            }}
          >
            {/*
              Every route is a website path. There is no tab navigator: the
              website has no bottom navigation, and the app's navigation is the
              header's hamburger menu, exactly as the site's is.
            */}
            <Stack.Screen name="index" />
            {/*
              Sign-in is presented as a sheet. It is usually reached mid-task —
              from the Login pill, or from the expiry prompt — and a modal
              returns the user underneath it rather than onto whatever the stack
              happens to hold.
            */}
            <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>

          {/*
            Outside the Stack on purpose: it must render over whatever route is
            current, without replacing it. See the component's header.
          */}
          <SessionExpiredSheet />
        </>
      )}
    </View>
  );
}

export default function RootLayout(): React.ReactElement | null {
  const [fontsLoaded, fontError] = useFonts({
    /*
     * Olde English is the website's own file, copied from public/fonts. It is
     * the only .ttf among the eighty there — the rest are .woff2, which React
     * Native cannot load — and it sets the two most prominent lines on the site:
     * the hero title and "Alumni Association". Missing it was the single largest
     * visual error in the first build.
     */
    OldeEnglish: require('../assets/fonts/OldeEnglish.ttf'),
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    Roboto_400Regular,
    Roboto_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  /*
   * `fontError` is treated as loaded on purpose. A font that fails to decode is
   * a cosmetic problem — the system face is substituted — and blocking the whole
   * app on it would turn a wrong typeface into a blank screen.
   */
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Dark glyphs: the app is locked to a light interface, so this is not conditional. */}
        <StatusBar style="dark" />
        {/*
          Auth sits inside Content because the login screen renders the
          Association's own wording from the bundle, and outside the Shell so a
          session survives the content gate's retry.
        */}
        <ContentProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ContentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
