/**
 * The About section's three-panel composition, driven by scroll.
 *
 * This is a port of the website's `AboutSlider`, not a new animation. The
 * keyframe tables, the travel and the panel geometry below are its own values,
 * read from `oxvercity/src/components/home/AboutSlider.tsx` and from the live
 * DOM at 390 × 844.
 *
 * ## Why it could not simply be a static image
 *
 * The block is **669px tall** on the website and the panel inside it is **129**.
 * The difference — 540px — is not padding: it is the scroll distance the panel
 * stays pinned for while the two side panels slide out from behind the centre.
 * Drawing only the 129px rest frame is what left every section below About
 * **527px too high**, which was the single largest remaining error on Home.
 *
 * ## Measured geometry, at 390 × 844
 *
 * | Part | x | Width | Height | Fill |
 * |---|---|---|---|---|
 * | Crest | 20 | 77 | 129 | `#111111`, image inset 12% |
 * | Campus | 104.7 | 180.6 | 129 | the photograph, `cover` |
 * | EMRC | 293 | 77 | 129 | `rgb(147,240,239)`, image inset 7% |
 *
 * All three have a 10px radius. Both side panels travel **84.7** — from their
 * leading edge sitting exactly on the centre panel's to their resting place —
 * and hold at **0.4 opacity** until the last third.
 *
 * ## How the pin is reproduced
 *
 * React Native has no `position: sticky`. The panel is absolutely positioned
 * inside the block and translated by `clamp(PIN_TOP − blockTop, 0, TRAVEL)`,
 * where `blockTop` is the block's live viewport position read on the UI thread.
 * That is the same arithmetic the browser does for a sticky box, and it is why
 * `measure()` is called in the worklet rather than a layout captured once: the
 * block's position changes as the page scrolls, which is the entire point.
 *
 * Scroll drives it directly — no timer, no spring. Stop scrolling and it stops;
 * scroll back and it runs backwards, exactly as the website does.
 */

import Animated, {
  clamp,
  interpolate,
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  type AnimatedRef,
} from 'react-native-reanimated';
import { View } from 'react-native';

import { Asset } from '@/components/AppImage';
import { usePageScroll } from '@/components/Page';
import { colour } from '@/theme';
import type { SiteImage } from '@/lib/content-types';

/** Measured: block 350 × 669, panel 350 × 129, sticky at top 239.84. */
const BLOCK_H = 669;
const PANEL_H = 129;
const PIN_TOP = 239.84;
const TRAVEL = BLOCK_H - PANEL_H;

/** Measured rest geometry, in a 350-wide frame. */
const SIDE_W = 77;
const CENTRE_W = 180.6;
const CENTRE_X = 104.7;
const RIGHT_X = 293;
/** Centre edge minus side edge — how far each side panel travels. */
const SPAN = 84.7;
const RADIUS = 10;

/*
 * The website's own keyframe tables, verbatim. The offset holds at 1 for the
 * first 8% and reaches 0 at 92%, which is what gives the closed and open
 * compositions a beat of stillness at each end.
 */
const OFFSET_STOPS = [0, 0.08, 0.36, 0.64, 0.92, 1];
const OFFSET_VALUES = [1, 1, 0.781818, 0.418182, 0, 0];
const FADE_STOPS = [0, 0.64, 0.92, 1];
const FADE_VALUES = [0.4, 0.4, 1, 1];

export interface AboutSliderProps {
  /** The 350-wide content column at this viewport. */
  width: number;
  /**
   * `home.about.collage.images`.
   *
   * The three panels are picked out of it **by filename**, because the
   * bundle's own `left`/`top`/`w`/`h` describe the composition mid-animation
   * (the crest at x = 94, overlapping the centre) rather than at rest. The
   * geometry used here is measured; only the image sources come from the
   * bundle.
   */
  images: readonly SiteImage[];
}

/** Where the panel sits inside the block, and how far through the pin we are. */
function pinnedAt(blockRef: AnimatedRef<View>): { offset: number; progress: number } {
  'worklet';
  const m = measure(blockRef);
  if (!m) return { offset: 0, progress: 0 };
  const offset = clamp(PIN_TOP - m.pageY, 0, TRAVEL);
  return { offset, progress: offset / TRAVEL };
}

function bySource(images: readonly SiteImage[], name: string): SiteImage | undefined {
  return images.find((image) => image.src.includes(name));
}

export function AboutSlider({ width, images }: AboutSliderProps): React.ReactElement | null {
  const scrollY = usePageScroll();
  const blockRef = useAnimatedRef<View>();

  // The measured frame is 350 wide; scale to whatever the device gives us so
  // the composition holds on a 360 or a 430 without a second table.
  const k = width / 350;

  const panelStyle = useAnimatedStyle(() => {
    // Read so the worklet re-runs on every scroll frame. `measure()` alone has
    // no dependency Reanimated can track.
    scrollY?.value;
    return { transform: [{ translateY: pinnedAt(blockRef).offset }] };
  });

  const crestStyle = useAnimatedStyle(() => {
    scrollY?.value;
    const t = pinnedAt(blockRef).progress;
    return {
      opacity: interpolate(t, FADE_STOPS, FADE_VALUES),
      transform: [{ translateX: SPAN * k * interpolate(t, OFFSET_STOPS, OFFSET_VALUES) }],
    };
  });

  const emrcStyle = useAnimatedStyle(() => {
    scrollY?.value;
    const t = pinnedAt(blockRef).progress;
    return {
      opacity: interpolate(t, FADE_STOPS, FADE_VALUES),
      transform: [{ translateX: -SPAN * k * interpolate(t, OFFSET_STOPS, OFFSET_VALUES) }],
    };
  });

  const crest = bySource(images, 'about-crest');
  const campus = bySource(images, 'about-slide-1');
  const emrc = bySource(images, 'about-emrc');
  if (!crest || !campus || !emrc) return null;

  return (
    <View ref={blockRef} collapsable={false} style={{ height: BLOCK_H, width }}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width, height: PANEL_H }, panelStyle]}>
        {/* Crest — slides in from behind the centre panel's left edge. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: SIDE_W * k,
              height: PANEL_H,
              borderRadius: RADIUS,
              backgroundColor: colour.ink,
              padding: SIDE_W * k * 0.12,
            },
            crestStyle,
          ]}
        >
          <Asset image={crest} displayWidth={SIDE_W * k} contentFit="contain" style={{ flex: 1 }} />
        </Animated.View>

        {/* Campus — the fixed centre. */}
        <View
          style={{
            position: 'absolute',
            left: CENTRE_X * k,
            top: 0,
            width: CENTRE_W * k,
            height: PANEL_H,
            borderRadius: RADIUS,
            overflow: 'hidden',
          }}
        >
          <Asset image={campus} displayWidth={CENTRE_W * k} style={{ flex: 1 }} />
        </View>

        {/* EMRC — slides in from behind the centre panel's right edge. */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: RIGHT_X * k,
              top: 0,
              width: SIDE_W * k,
              height: PANEL_H,
              borderRadius: RADIUS,
              backgroundColor: colour.emrc,
              padding: SIDE_W * k * 0.07,
            },
            emrcStyle,
          ]}
        >
          <Asset image={emrc} displayWidth={SIDE_W * k} contentFit="contain" style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
