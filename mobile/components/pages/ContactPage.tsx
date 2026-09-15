/**
 * /contact — the website's Contact page at mobile width.
 *
 * The enquiry form reports the real outcome: `sent` only on a 2xx, the server's
 * own message on failure, and what the user typed is kept either way. The
 * website's history here is the reason — its form once treated a missing action
 * as success, so people read "Message sent" and nobody ever saw the message.
 *
 * Consent is checked here and again by `submitEnquiry` server-side. The
 * client-side gate is courtesy; the server one is the rule.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, TextInput, View } from 'react-native';

import { Band, Page } from '@/components/Page';
import { Text } from '@/components/Text';
import { TurnstileSheet, type TurnstileResult } from '@/components/TurnstileSheet';
import { ApiError, request } from '@/lib/api';
import { useAppConfig, useContent } from '@/lib/content-context';
import type { EnquiryForm } from '@/lib/content-types';
import { colour, font, layout, preset, radius, space } from '@/theme';

function Field({ label, value, onChange, placeholder, multiline, email, editable }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  multiline?: boolean; email?: boolean; editable: boolean;
}): React.ReactElement {
  return (
    <View style={{ marginTop: space.base }}>
      <Text variant="label">{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colour.ink55} editable={editable} multiline={multiline}
        keyboardType={email ? 'email-address' : 'default'}
        autoCapitalize={email ? 'none' : 'sentences'} autoCorrect={!email}
        accessibilityLabel={label} maxFontSizeMultiplier={preset.body.maxScale}
        style={{
          marginTop: space.sm, borderWidth: 1, borderColor: colour.ink08, borderRadius: radius.md,
          paddingHorizontal: space.base, paddingVertical: multiline ? space.md : 0,
          minHeight: multiline ? 120 : 52, textAlignVertical: multiline ? 'top' : 'center',
          fontFamily: font.roboto, fontSize: preset.body.fontSize, color: colour.ink,
        }}
      />
    </View>
  );
}

function Enquiry({ copy }: { copy: EnquiryForm }): React.ReactElement {
  const config = useAppConfig();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [challenging, setChallenging] = useState(false);

  const ready = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && consent;
  const busy = status === 'sending';

  const send = useCallback(async (token: string | null) => {
    setStatus('sending'); setError(null);
    try {
      await request<{ message: string }>('/api/app/v1/enquiry', {
        method: 'POST', anonymous: true, timeoutMs: 20_000,
        body: { name: name.trim(), email: email.trim(), message: message.trim(), consent: true, turnstileToken: token },
      });
      setStatus('sent'); setName(''); setEmail(''); setMessage(''); setConsent(false);
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof ApiError ? cause.message : copy.error);
    }
  }, [copy.error, email, message, name]);

  const submit = useCallback(() => {
    setError(null);
    if (config?.turnstile.required && config.turnstile.embedUrl) { setChallenging(true); return; }
    void send(null);
  }, [config, send]);

  const onChallenge = useCallback((r: TurnstileResult) => {
    setChallenging(false);
    if (r.ok) void send(r.token);
    else { setStatus('error'); setError('The security check could not be completed. Please try again.'); }
  }, [send]);

  if (status === 'sent') {
    return (
      <View style={{ marginTop: space.lg }}>
        <Text variant="h3">{copy.sent}</Text>
        <Text variant="body" color={colour.ink70} style={{ marginTop: space.sm }}>
          Thank you — your message is with the Association.
        </Text>
        <Pressable onPress={() => setStatus('idle')} accessibilityRole="button" accessibilityLabel="Send another message"
          style={{ marginTop: space.base, minHeight: 44, justifyContent: 'center' }}>
          <Text variant="label" color={colour.navy}>Send another</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ marginTop: space.lg }}>
      <Field label={copy.nameLabel} value={name} onChange={setName} placeholder={copy.namePlaceholder} editable={!busy} />
      <Field label={copy.emailLabel} value={email} onChange={setEmail} placeholder={copy.emailPlaceholder} email editable={!busy} />
      <Field label={copy.messageLabel} value={message} onChange={setMessage} placeholder={copy.messagePlaceholder} multiline editable={!busy} />

      <Pressable onPress={() => setConsent((c) => !c)} disabled={busy}
        accessibilityRole="checkbox"
        /* accessibilityState is what TalkBack reads; aria-checked is what
           react-native-web needs. Setting one leaves a hole on the other. */
        accessibilityState={{ checked: consent }} aria-checked={consent}
        accessibilityLabel={copy.consent}
        style={{ marginTop: space.base, flexDirection: 'row', gap: space.md, minHeight: 44, alignItems: 'center' }}>
        <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1,
          borderColor: consent ? colour.ink : colour.ink08, backgroundColor: consent ? colour.ink : 'transparent',
          alignItems: 'center', justifyContent: 'center' }}>
          {consent ? <Text variant="small" color={colour.white}>✓</Text> : null}
        </View>
        <Text variant="small" color={colour.ink70} style={{ flex: 1 }}>{copy.consent}</Text>
      </Pressable>

      {error ? (
        <View accessibilityLiveRegion="polite" style={{ marginTop: space.base }}>
          <Text variant="small" color={colour.maroon}>{error}</Text>
        </View>
      ) : null}

      <Pressable onPress={submit} disabled={!ready || busy}
        accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }}
        accessibilityLabel={copy.submit}
        style={({ pressed }) => ({
          marginTop: space.lg, minHeight: 52, borderRadius: layout.pillRadius,
          backgroundColor: ready && !busy ? colour.ink : colour.ink08,
          alignItems: 'center', justifyContent: 'center', opacity: pressed && ready ? 0.85 : 1,
        })}>
        {busy ? <ActivityIndicator color={colour.white} />
          : <Text variant="button" color={ready ? colour.white : colour.ink55}>{copy.submit}</Text>}
      </Pressable>

      <TurnstileSheet visible={challenging} onResult={onChallenge}
        onCancel={() => { setChallenging(false); setStatus('idle'); }} />
    </View>
  );
}

export function ContactPage(): React.ReactElement {
  const content = useContent();
  const { page, faq } = content.contact;
  const { contact } = content.site;

  return (
    <Page headerTone="dark">
      <Band padTop={layout.heroPadTop}>
        <Text variant="h2">{page.title}</Text>
        <Text variant="lede" style={{ marginTop: 20 }}>{page.intro}</Text>

        <Text variant="label" style={{ marginTop: 32 }}>{contact.officeLabel}</Text>
        <Text variant="small" color={colour.ink70} style={{ marginTop: 8 }}>
          {contact.address.filter(Boolean).join('\n')}
        </Text>

        <Text variant="label" style={{ marginTop: 24 }}>{contact.emailLabel}</Text>
        <Pressable onPress={() => void Linking.openURL(`mailto:${contact.email}`)}
          accessibilityRole="link" accessibilityLabel={`Email ${contact.email}`}
          style={{ marginTop: 8, minHeight: 32, justifyContent: 'center' }}>
          <Text variant="small" color={colour.ink70}>{contact.email}</Text>
        </Pressable>

        <Text variant="label" style={{ marginTop: 24 }}>
          {page.followLabel.replace(/[-–—]\s*$/, '').trim()}
        </Text>
        <View style={{ marginTop: 8 }}>
          {page.socials.map((s) => (
            <Pressable key={s.name} onPress={() => void Linking.openURL(s.href)}
              accessibilityRole="link" accessibilityLabel={`${s.name}, opens in your browser`}
              style={{ minHeight: 36, justifyContent: 'center' }}>
              <Text variant="small" color={colour.ink70}>{s.name}</Text>
            </Pressable>
          ))}
        </View>

        <Enquiry copy={page.form} />
      </Band>

      <Band dark>
        <Text variant="h2" color={colour.white}>{page.faqTitle}</Text>
        {faq.map((item, i) => (
          <View key={item.question} style={{ marginTop: i === 0 ? 32 : 32 }}>
            <Text variant="h3OnDark">{item.question}</Text>
            <Text variant="bodyOnDark" style={{ marginTop: 12 }}>{item.answer}</Text>
          </View>
        ))}
      </Band>
    </Page>
  );
}
