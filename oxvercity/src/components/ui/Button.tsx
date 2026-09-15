import type { CSSProperties } from 'react';
import { tokens } from '@/lib/tokens';

/**
 * The site's pill button ("Button" component `framer-rgTzD`): label plus a
 * diagonal arrow. On hover the label slides up to reveal its twin and the
 * arrow swaps, which `site.css` animates with Framer's 0.4s ease-in-out.
 *
 * `default` is ink on white pages; `white` is the light pill the header uses
 * over the hero image (and the header swaps it for `default` once scrolled).
 * `phone` is the smaller pill without the hover swap, used inside the
 * accordions on tablet and phone.
 *
 * `variant` sets the size; `light` sets the tone. The template has no light
 * pill at phone size, so `light` is how the small pill gets one without
 * inventing a fourth Framer variant.
 */
export interface ButtonProps {
  label: string;
  /** Omitted when the pill submits a form rather than navigating. */
  href?: string;
  variant?: 'default' | 'white' | 'phone';
  /** Grey fill with ink label, for a size the template has no light variant of. */
  light?: boolean;
  /** Framer's wrapper class around the button, which carries its layout slot. */
  containerClass?: string;
  style?: CSSProperties;
  target?: string;
  rel?: string;
  /** Render as `<button type="submit">` — same pill, inside a form. */
  submit?: boolean;
  disabled?: boolean;
}

const VARIANT_CLASS = { default: 'framer-v-1lxudta', white: 'framer-v-hsq876', phone: 'framer-v-l0a84m' } as const;
const VARIANT_NAME = { default: 'Default', white: 'White', phone: 'Phone' } as const;
const RADIUS = { borderBottomLeftRadius: '80px', borderBottomRightRadius: '80px', borderTopLeftRadius: '80px', borderTopRightRadius: '80px' };

export function Button({ label, href, variant = 'default', light, containerClass, style, target, rel, submit, disabled }: ButtonProps) {
  const isLight = variant === 'white' || light === true;
  const bg = isLight ? tokens.grey : tokens.ink;
  const fg = isLight ? tokens.ink : tokens.white;
  const hover = variant !== 'phone';
  const textStyle = { '--extracted-r6o4lv': fg, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties;
  const pStyle = { '--framer-text-color': `var(--extracted-r6o4lv, ${fg})` } as CSSProperties;
  const Tag = submit ? 'button' : 'a';
  const anchor = (
    <Tag
      className={`framer-rgTzD framer-yylGA framer-1lxudta ${VARIANT_CLASS[variant]} framer-1p2gjlx`}
      data-framer-name={VARIANT_NAME[variant]}
      {...(submit ? { type: 'submit' as const, disabled } : { href, target, rel })}
      style={{ backgroundColor: bg, ...style, ...RADIUS }}
    >
      <div className="framer-1nqzra9" data-framer-name="Text Wrapper" style={{ borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px', borderTopLeftRadius: '0px', borderTopRightRadius: '0px' }}>
        <div className="framer-w20m9e" data-framer-name="Default Text" data-framer-component-type="RichTextContainer" style={textStyle}>
          <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={pStyle}>
            {label}
          </p>
        </div>
        {hover && (
          <div className="framer-ihcm4m" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={textStyle}>
            <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={pStyle}>
              {label}
            </p>
          </div>
        )}
      </div>
      <div className="framer-z1a8md" data-framer-name="Arrow Wrap">
        <div data-framer-name="Defualt Icon" className="framer-utBpC framer-1t7z4po" style={{ '--imrg1o': fg } as CSSProperties} />
        {hover && <div data-framer-name="Hover Icon" className="framer-utBpC framer-1y5yfiu" style={{ '--imrg1o': fg, transform: 'translate(-50%, -50%)' } as CSSProperties} />}
      </div>
    </Tag>
  );
  return containerClass ? <div className={containerClass}>{anchor}</div> : anchor;
}
