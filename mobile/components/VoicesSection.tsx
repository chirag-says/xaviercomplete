/**
 * "Voices From Our Community" — the scroll-driven section above the footer.
 *
 * A port of the website's `VoicesSection` + `voices.css`, not a new design.
 * Every number is either from that stylesheet's phone tier or measured on the
 * live page at 390 × 844.
 *
 * ## Scroll is the clock
 *
 * Nothing here animates on its own. The section is `stage + track` tall, a
 * stage-height panel is pinned inside it, and the panel's progress through the
 * track — 0 → 1 — is the only input. Each card's pass is scrubbed to a slice of
 * that progress. Stop scrolling and the composition holds; scroll back and it
 * runs backwards. The website does this by feeding `--sx-p` into a paused CSS
 * animation's negative delay; the arithmetic below is the same thing.
 *
 * ## The measured phone geometry, at 390 × 844
 *
 * | Value | |
 * |---|---|
 * | Section | 390 × **2237** (stage 100vh + track 165vh) |
 * | Pin | 844, sticky at top 0 — travel **1393** |
 * | Centre block | x 20, w 350, **109.72** below the pin, gap 12 |
 * | Field | full width, **337.6** below the pin, **506.4** tall, clipped |
 * | Card | 350 × 306, resting centre **61%** down the field |
 * | Enter / exit | +354.48 / −430.44 (0.7 and −0.85 of the field) |
 *
 * Three reviews with a 0.79 handover give each a **0.3876** slice starting at
 * 0, 0.3062 and 0.6124 — so two are on the stage together for the last fifth of
 * the older one's life.
 *
 * ## One unavoidable difference
 *
 * The website's card is `backdrop-filter: blur(14px) saturate(1.1)`. React
 * Native has no backdrop filter; `expo-blur`'s `BlurView` is the equivalent and
 * is what is used. It cannot saturate, so the glass is a shade flatter than the
 * web's — the only part of this section that is an approximation rather than a
 * transcription.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  clamp,
  Easing,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  type AnimatedRef,
} from 'react-native-reanimated';

import { Asset } from '@/components/AppImage';
import { usePageScroll } from '@/components/Page';
import { Text } from '@/components/Text';
import { colour, layout } from '@/theme';

/** From `.sx-voices`, phone tier. */
const TRACK_RATIO = 1.65;
const FIELD_TOP_RATIO = 0.4;
const FIELD_H_RATIO = 0.6;
const ENTER_RATIO = 0.7;
const EXIT_RATIO = -0.85;
/** Where a card rests, as a fraction of the field. */
const REST = 0.61;
/** The centre block's offset, as a fraction of the stage (`top: 13%`). */
const CENTRE_TOP_RATIO = 0.13;

const CARD_MIN_H = 300;
const CARD_RADIUS = 20;
const MONOGRAM = 48;

/** Each card begins its rise 79% of the way through the one before it. */
const HANDOVER = 0.79;

/*
 * The pass, from `@keyframes sx-voice-move`: rise to rest over the first 50.3%,
 * hold to 56.3%, then leave. The two eased segments carry the stylesheet's own
 * curves; the hold between them is linear because it does not move.
 */
const RISE_END = 0.503;
const HOLD_END = 0.563;
const riseEase = Easing.bezierFn(0.32, 0, 0.5, 1);
const leaveEase = Easing.bezierFn(0.4, 0, 0.6, 1);

/** `@keyframes sx-voice-fade` — no fade in, a long hold, then away. */
const FADE_STOPS = [0, 0.02, 0.7, 0.92, 1];
const FADE_VALUES = [0, 1, 1, 0.35, 0];

/** Two letters: both surnames in the data begin with S. */
function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('');
}

/** The pinned panel's progress through the track, 0 → 1. */
function pinProgress(sectionRef: AnimatedRef<View>, travel: number): { offset: number; progress: number } {
  'worklet';
  const m = measure(sectionRef);
  if (!m || travel <= 0) return { offset: 0, progress: 0 };
  const offset = clamp(-m.pageY, 0, travel);
  return { offset, progress: offset / travel };
}

export interface Voice {
  name: string;
  comment: string;
  role?: string;
}

function Card({
  voice,
  start,
  span,
  sectionRef,
  travel,
  enter,
  exit,
  width,
}: {
  voice: Voice;
  start: number;
  span: number;
  sectionRef: AnimatedRef<View>;
  travel: number;
  enter: number;
  exit: number;
  width: number;
}): React.ReactElement {
  const scrollY = usePageScroll();

  const style = useAnimatedStyle(() => {
    scrollY?.value; // the dependency `measure()` cannot provide
    const p = pinProgress(sectionRef, travel).progress;
    // This card's own 0 → 1. Clamped, so before its slice it holds the 0%
    // state and after it the 100% — which is what CSS `animation-fill-mode:
    // both` does, and why a card is invisible outside its pass.
    const t = clamp((p - start) / span, 0, 1);

    let y: number;
    if (t < RISE_END) y = enter * (1 - riseEase(t / RISE_END));
    else if (t < HOLD_END) y = 0;
    else y = exit * leaveEase((t - HOLD_END) / (1 - HOLD_END));

    return { opacity: interpolate(t, FADE_STOPS, FADE_VALUES), transform: [{ translateY: y }] };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }, style]}>
      <BlurView
        intensity={28}
        tint="dark"
        style={{
          width,
          minHeight: CARD_MIN_H,
          borderRadius: CARD_RADIUS,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(255,255,255,0.07)',
          paddingTop: 26,
          paddingHorizontal: 24,
          paddingBottom: 24,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 13,
        }}
      >
        <Text variant="voiceQuote" align="center">
          &ldquo;{voice.comment}&rdquo;
        </Text>
        <View
          style={{
            width: MONOGRAM,
            height: MONOGRAM,
            borderRadius: 999,
            marginTop: 4,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Text variant="voiceMonogram">{initials(voice.name)}</Text>
        </View>
        <Text variant="voiceName" align="center">
          {voice.name}
        </Text>
        {voice.role ? (
          <Text variant="voiceRole" align="center" style={{ marginTop: -10 }}>
            {voice.role}
          </Text>
        ) : null}
      </BlurView>
    </Animated.View>
  );
}

export function VoicesSection({
  voices,
  background,
}: {
  voices: readonly Voice[];
  background: Parameters<typeof Asset>[0]['image'];
}): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const sectionRef = useAnimatedRef<View>();
  const scrollY = usePageScroll();

  const stage = height;
  const travel = stage * TRACK_RATIO;
  const fieldTop = stage * FIELD_TOP_RATIO;
  const fieldH = stage * FIELD_H_RATIO;
  const enter = fieldH * ENTER_RATIO;
  const exit = fieldH * EXIT_RATIO;
  const cardW = Math.min(width - layout.gutter * 2, 420);

  const span = 1 / (1 + HANDOVER * (voices.length - 1));

  // React Native has no `position: sticky`; this is the same arithmetic the
  // browser performs for one.
  const pinStyle = useAnimatedStyle(() => {
    scrollY?.value;
    return { transform: [{ translateY: pinProgress(sectionRef, travel).offset }] };
  });

  return (
    <View ref={sectionRef} collapsable={false} style={{ height: stage + travel, backgroundColor: colour.dark }}>
      <Animated.View style={[{ height: stage, width, overflow: 'hidden' }, pinStyle]}>
        {/* The photograph is the stage. */}
        <Asset image={background} displayWidth={width} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {/* `.sx-voices__bg::after` — weighted to the top and bottom edges so the
            photograph keeps its own light through the middle. */}
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(19,62,109,0.12)' }}
        />
        <LinearGradient
          colors={['rgba(17,17,17,0.42)', 'rgba(17,17,17,0.14)', 'rgba(17,17,17,0.46)']}
          locations={[0, 0.42, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />

        {/* The centre, which the cards move around and never displace. */}
        <View
          style={{
            position: 'absolute',
            top: stage * CENTRE_TOP_RATIO,
            left: layout.gutter,
            width: width - layout.gutter * 2,
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text variant="h2" color={colour.white} align="center">
            Voices From Our Community
          </Text>
          <Text variant="voiceStandfirst" align="center">
            Stories, experiences and memories that continue to connect generations of Xaverians.
          </Text>
        </View>

        {/* The moving layer, clipped — a card is half-visible as it arrives and
            as it leaves, which is what gives the pass its edges. */}
        <View style={{ position: 'absolute', top: fieldTop, left: 0, right: 0, height: fieldH, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: fieldH * REST - CARD_MIN_H / 2, left: 0, right: 0 }}>
            {voices.map((voice, i) => (
              <Card
                key={voice.name}
                voice={voice}
                start={i * HANDOVER * span}
                span={span}
                sectionRef={sectionRef}
                travel={travel}
                enter={enter}
                exit={exit}
                width={cardW}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

