/**
 * The oversized display line the hero and the page banners share, split into
 * characters. `FramerEffects` finds the characters by their inline-block style
 * and raises them one after another after the line itself has appeared, which
 * is Framer's text effect on the original.
 *
 * The markup is the export's, so the extracted CSS styles it exactly; only the
 * word is ours.
 */

const LETTER_STYLE = {
  display: 'inline-block',
  opacity: '0.001',
  transform: 'translateX(0px) translateY(80px) scale(1) rotate(0deg) skewX(0deg) skewY(0deg)',
} as React.CSSProperties;

function SplitWord({ word }: { word: string }) {
  return (
    <span style={{ whiteSpace: 'nowrap' } as React.CSSProperties}>
      {word.split('').map((letter, i) => (
        <span key={i} style={LETTER_STYLE}>
          {letter}
        </span>
      ))}
    </span>
  );
}

export interface SplitDisplayProps {
  /** The line, one entry per word; each word stays unbroken. */
  words: string[];
  /** Framer's appear id for the line, which differs per page. */
  appearId: string;
  containerClass: string;
  as: 'h1' | 'h2';
}

export function SplitDisplay({ words, appearId, containerClass, as }: SplitDisplayProps) {
  const Tag = as;
  return (
    <div className={containerClass} data-framer-appear-id={appearId} data-framer-name={"Title"} data-framer-component-type={"RichTextContainer"} style={{ opacity: "0.001", transform: "translateY(40px) rotateX(40deg)" } as React.CSSProperties}>
      <Tag className={"framer-text framer-styles-preset-1y2slg"} data-styles-preset={"q695KX4fM"}>
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            {i > 0 ? ' ' : null}
            <SplitWord word={word} />
          </span>
        ))}
      </Tag>
    </div>
  );
}
