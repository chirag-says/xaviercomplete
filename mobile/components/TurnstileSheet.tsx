/**
 * The Cloudflare challenge, in a WebView.
 *
 * Loads `/embed/turnstile` from the API host as a top-level document and waits
 * for `window.ReactNativeWebView.postMessage`. See that route's header for why
 * the page exists and why it is a route handler rather than a page.
 *
 * ## Failure is a first-class outcome here
 *
 * This is the most fragile thing in the app: a browser control, in a
 * non-browser, against a third party who can change it without telling us. So
 * every way it can go wrong has a named path out, and none of them is "sit
 * there".
 *
 *   - the page reports an error   → `onResult({ ok: false })`
 *   - the page never loads at all → the WebView's own `onError`
 *   - it loads and nothing happens → a timeout, on this side as well as the page's
 *   - the user gives up           → a visible Cancel, always
 *
 * A blank WebView with no way out is the one outcome that must never happen,
 * because to the user it is indistinguishable from the app having crashed.
 *
 * ## When the server does not require a challenge
 *
 * `GET /config` reports `turnstile.required`. In development that is false, so
 * the caller skips this component entirely and signs in with no challenge —
 * which is what makes the whole auth flow testable without a Cloudflare account.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { apiBaseUrl } from '@/lib/api';
import { colour, radius, space } from '@/theme';

export type TurnstileResult = { ok: true; token: string } | { ok: false; reason: string };

export interface TurnstileSheetProps {
  visible: boolean;
  onResult: (result: TurnstileResult) => void;
  onCancel: () => void;
}

/**
 * Slightly longer than the page's own 20s guard, so the page gets to report a
 * specific reason before this blunter timer fires.
 */
const TIMEOUT_MS = 25_000;

export function TurnstileSheet({ visible, onResult, onCancel }: TurnstileSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);

  useEffect(() => {
    if (!visible) {
      settled.current = false;
      setLoading(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!settled.current) {
        settled.current = true;
        onResult({ ok: false, reason: 'timeout' });
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [visible, onResult]);

  function settle(result: TurnstileResult): void {
    if (settled.current) return;
    settled.current = true;
    onResult(result);
  }

  function handleMessage(event: WebViewMessageEvent): void {
    let parsed: { status?: string; token?: string; reason?: string };
    try {
      parsed = JSON.parse(event.nativeEvent.data) as typeof parsed;
    } catch {
      // The bridge is ours, so malformed data means the page is not the page we
      // think it is. Refuse rather than guess.
      settle({ ok: false, reason: 'bad_bridge_message' });
      return;
    }

    if (parsed.status === 'ok' && typeof parsed.token === 'string' && parsed.token.length > 0) {
      settle({ ok: true, token: parsed.token });
    } else {
      settle({ ok: false, reason: parsed.reason ?? 'widget_error' });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colour.white,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.lg,
            paddingHorizontal: space.lg,
            minHeight: 320,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="h3">Security check</Text>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel the security check"
              hitSlop={12}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <Text variant="label" color={colour.navy}>
                Cancel
              </Text>
            </Pressable>
          </View>

          <Text variant="small" color={colour.ink70} style={{ marginTop: space.xs }}>
            A quick check that you are a person, before we send your code.
          </Text>

          <View style={{ height: 200, marginTop: space.base, justifyContent: 'center' }}>
            {loading ? (
              <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
                <ActivityIndicator color={colour.ink} />
              </View>
            ) : null}

            {visible ? (
              <WebView
                source={{ uri: `${apiBaseUrl()}/embed/turnstile` }}
                onMessage={handleMessage}
                onLoadEnd={() => setLoading(false)}
                onError={() => settle({ ok: false, reason: 'webview_error' })}
                onHttpError={() => settle({ ok: false, reason: 'webview_http_error' })}
                // Nothing here should navigate anywhere. The challenge runs in
                // Cloudflare's own iframe; the top document never leaves ours.
                originWhitelist={['https://*', 'http://*']}
                javaScriptEnabled
                // No shared cookie jar and no storage: this WebView holds no
                // session and must not become a second place one could live.
                sharedCookiesEnabled={false}
                thirdPartyCookiesEnabled={false}
                incognito
                style={{ backgroundColor: 'transparent' }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
