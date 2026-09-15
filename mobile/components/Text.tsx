/**
 * Every piece of text in the app goes through here.
 *
 * `variant` names a **measured website preset** from theme/index.ts, not a
 * design decision. `<Text variant="h2">` renders exactly what
 * `framer-styles-preset-1tiwwlt` renders on the website at 390px: Instrument
 * Sans 700, 36px, 37.8 line-height.
 *
 * The wrapper exists so those values are applied in one place rather than three
 * hundred, and so the two things the web has no equivalent for are handled
 * consistently:
 *
 *  - **Bounded scaling.** Android accessibility text can reach 200%+. Body copy
 *    should grow; a 36px heading at 2× is four words tall. `maxFontSizeMultiplier`
 *    comes from the preset. `allowFontScaling={false}` is the usual shortcut and
 *    it tells a partially sighted user their setting does not apply here.
 *  - **Proportional line-height.** A fixed `lineHeight` beside a scaling
 *    `fontSize` clips descenders as the multiplier rises, so the website's ratio
 *    is preserved rather than its absolute pixel value.
 */

import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { preset, type PresetName } from '@/theme';

/*
 * `role` is React Native's ARIA-role prop and is omitted so `variant` cannot be
 * confused with it. Screens set semantics with `accessibilityRole`.
 */
export interface TextProps extends Omit<RNTextProps, 'style' | 'maxFontSizeMultiplier' | 'role'> {
  /** A measured website preset. Defaults to body copy. */
  variant?: PresetName;
  /** Overrides the preset's own colour — e.g. body copy moved onto a dark band. */
  color?: string;
  align?: TextStyle['textAlign'];
  style?: TextStyle | TextStyle[];
}

export function Text({ variant = 'body', color, align, style, ...rest }: TextProps): React.ReactElement {
  const spec = preset[variant];
  const ratio = spec.lineHeight / spec.fontSize;

  return (
    <RNText
      maxFontSizeMultiplier={spec.maxScale}
      style={[
        {
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          lineHeight: spec.fontSize * ratio,
          color: color ?? spec.color,
          ...(align ? { textAlign: align } : {}),
        },
        ...(Array.isArray(style) ? style : style ? [style] : []),
      ]}
      {...rest}
    />
  );
}
