/**
 * The template's section heading: an uppercase eyebrow over a display title
 * stacked one short line at a time, each line rising in after the one above it.
 */

import { Reveal } from '@/components/motion/Reveal';

export function SectionHeading({ eyebrow, lines, dark = false }: { eyebrow: string; lines: string[]; dark?: boolean }) {
  return (
    <>
      <Reveal className={`sx-eyebrow${dark ? '' : ' sx-eyebrow--ink'}`}>{eyebrow}</Reveal>
      <h2 className="sx-heading">
        {lines.map((line, i) => (
          <Reveal key={line} as="span" className="sx-heading__line framer-text framer-styles-preset-1tiwwlt" delay={0.1 * i}>
            {line}
          </Reveal>
        ))}
      </h2>
    </>
  );
}
