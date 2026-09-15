/**
 * Sign in — address, then the six digits.
 *
 * ## The rule this screen must not break
 *
 * **It advances to the code step for every accepted address, including ones that
 * will never receive a code.**
 *
 * The server is careful about this: `/auth/request` returns the same body, the
 * same status and the same timing whether the address is on the allowlist or
 * not, because otherwise the login form becomes a membership oracle — type any
 * address, read the answer, learn whether that person is a Xaverian.
 *
 * A client that "helpfully" stayed on the email step for an unknown address
 * would rebuild that oracle in the app, where it is just as readable. So the
 * only thing that keeps us on step one is a 4xx. A 200 always moves on.
 * `npm run app:auth-verify` asserts it.
 *
 * The same reasoning governs the failure copy on step two: wrong code, expired
 * code, five attempts used, unknown address and revoked access all produce one
 * message, because telling them apart leaks the same fact.
 */

import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { TurnstileSheet, type TurnstileResult } from '@/components/TurnstileSheet';
import { ApiError, request } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAppConfig, useContent } from '@/lib/content-context';
import { colour, font, preset, radius, space } from '@/theme';

type Step = 'email' | 'code';

interface VerifyResponse {
  token: string;
  expiresAt: string;
}

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const content = useContent();
  const config = useAppConfig();
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);

  const codeInput = useRef<TextInput>(null);

  /** Shape only. The server decides everything else, and says nothing about it. */
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const sendCode = useCallback(
    async (turnstileToken: string | null) => {
      setBusy(true);
      setError(null);

      try {
        await request<{ message: string }>('/api/app/v1/auth/request', {
          method: 'POST',
          anonymous: true,
          body: { email: email.trim(), turnstileToken },
          // The server holds every response to a 1200ms floor on purpose, so
          // this needs headroom well beyond the default.
          timeoutMs: 20_000,
        });

        // Always advance. See this file's header.
        setStep('code');
        setNotice(
          `If ${email.trim()} is registered with the Association, a six-digit code is on its way. It lasts ten minutes.`,
        );
        setTimeout(() => codeInput.current?.focus(), 350);
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Could not reach the Association. Check your connection and try again.',
        );
      } finally {
        setBusy(false);
      }
    },
    [email],
  );

  const onRequestPress = useCallback(() => {
    setError(null);

    /*
     * Turnstile is skipped when the server says it is not required — which is
     * the case in development. That is what makes this flow testable end to end
     * without a Cloudflare account, and it is the server's decision to make, not
     * a hardcoded __DEV__ check here.
     */
    if (config?.turnstile.required && config.turnstile.embedUrl) {
      setChallenging(true);
      return;
    }

    void sendCode(null);
  }, [config, sendCode]);

  const onChallengeResult = useCallback(
    (result: TurnstileResult) => {
      setChallenging(false);
      if (result.ok) {
        void sendCode(result.token);
      } else {
        setError(
          result.reason === 'timeout'
            ? 'The security check did not load. Check your connection and try again.'
            : 'The security check could not be completed. Please try again.',
        );
      }
    },
    [sendCode],
  );

  const onVerifyPress = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const result = await request<VerifyResponse>('/api/app/v1/auth/verify', {
        method: 'POST',
        anonymous: true,
        body: { email: email.trim(), code: code.trim() },
        timeoutMs: 20_000,
      });

      await signIn(result.token, result.expiresAt);
      // Replace, not push: the login screen must not be reachable with a back
      // gesture from inside a signed-in app.
      router.replace('/me');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not reach the Association. Check your connection and try again.',
      );
      setCode('');
    } finally {
      setBusy(false);
    }
  }, [code, email, router, signIn]);

  const canSubmit = step === 'email' ? looksLikeEmail && !busy : /^\d{6}$/.test(code.trim()) && !busy;

  return (
    <Page headerTone="dark" footer={false}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text variant="label" color={colour.navy}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={{ marginTop: space.xl }}>
        <Text variant="label" color={colour.ink55}>
          {content.site.associationShortName.toUpperCase()}
        </Text>
        <Text variant="h2" style={{ marginTop: space.md }}>
          {step === 'email' ? 'Sign in' : 'Enter your code'}
        </Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: space.md }}>
          {step === 'email'
            ? 'Use the email address the Association has on record for you. We will send a six-digit code — there is no password to remember.'
            : notice}
        </Text>
      </View>

      {step === 'email' ? (
        <View style={{ marginTop: space.xl }}>
          <Text variant="label" color={colour.ink70}>
            Email address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="send"
            editable={!busy}
            onSubmitEditing={() => canSubmit && onRequestPress()}
            placeholder="you@example.com"
            placeholderTextColor={colour.ink55}
            accessibilityLabel="Your registered email address"
            maxFontSizeMultiplier={preset.body.maxScale}
            style={{
              marginTop: space.sm,
              borderWidth: 1,
              borderColor: colour.ink08,
              borderRadius: radius.md,
              paddingHorizontal: space.base,
              // 52pt rather than the 44pt minimum: a text field is aimed at
              // more carefully than a button, and thumbs are not precise.
              minHeight: 52,
              fontFamily: font.roboto,
              fontSize: preset.body.fontSize,
              color: colour.ink,
            }}
          />
        </View>
      ) : (
        <View style={{ marginTop: space.xl }}>
          <Text variant="label" color={colour.ink70}>
            Six-digit code
          </Text>
          <TextInput
            ref={codeInput}
            value={code}
            // Strip everything but digits as it is typed, so a code pasted as
            // "123 456" out of a mail client just works. The server forgives
            // the same thing; doing it here means the button enables correctly.
            onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            editable={!busy}
            onSubmitEditing={() => canSubmit && void onVerifyPress()}
            placeholder="000000"
            placeholderTextColor={colour.ink08}
            accessibilityLabel="The six-digit code from your email"
            maxFontSizeMultiplier={1.4}
            style={{
              marginTop: space.sm,
              borderWidth: 1,
              borderColor: colour.ink08,
              borderRadius: radius.md,
              paddingHorizontal: space.base,
              minHeight: 60,
              fontFamily: font.instrumentSemi,
              fontSize: 28,
              letterSpacing: 8,
              color: colour.ink,
            }}
          />
        </View>
      )}

      {error ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            marginTop: space.base,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: 'rgba(139,35,50,0.06)',
            borderLeftWidth: 3,
            borderLeftColor: colour.maroon,
          }}
        >
          <Text variant="small" color={colour.maroon}>
            {error}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={step === 'email' ? onRequestPress : () => void onVerifyPress()}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy }}
        accessibilityLabel={step === 'email' ? 'Send me a code' : 'Sign in'}
        style={({ pressed }) => ({
          marginTop: space.xl,
          minHeight: 52,
          borderRadius: radius.pill,
          backgroundColor: canSubmit ? colour.ink : colour.ink08,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed && canSubmit ? 0.85 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color={colour.white} />
        ) : (
          <Text variant="label" color={canSubmit ? colour.white : colour.ink55}>
            {step === 'email' ? 'Send me a code' : 'Sign in'}
          </Text>
        )}
      </Pressable>

      {step === 'code' ? (
        <Pressable
          onPress={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Use a different email address"
          style={{ marginTop: space.base, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text variant="label" color={colour.navy}>
            Use a different address
          </Text>
        </Pressable>
      ) : null}

      <Text variant="small" color={colour.ink70} style={{ marginTop: space.xxl }}>
        Access to the directory is limited to alumni the Association has on record. If your address is not recognised,
        contact the Association office.
      </Text>

      <TurnstileSheet
        visible={challenging}
        onResult={onChallengeResult}
        onCancel={() => {
          setChallenging(false);
          setError('The security check was cancelled.');
        }}
      />
    </Page>
  );
}
