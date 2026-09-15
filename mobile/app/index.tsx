/**
 * Home — the website's mobile home page, section for section.
 *
 * Measured on the live site at 390 × 844. Six sections, in this order, with
 * these backgrounds:
 *
 *   0  Hero                              844  full-bleed photo
 *   1  About                            1225  white
 *   2  The Xaverian community           1174  #111111
 *   3  Explore the Xaverian network     1128  white
 *   4  Inside the Xaverian experience    856  #111111
 *   5  Voices From Our Community        2237  #111111
 *      Footer                            721
 *
 * ## What was deleted from the previous build
 *
 * A "NEXT" event card, three "01 — THE COMMUNITY" eyebrow markers with gold
 * rules, and a "MORE / Explore the Association" link list. **None of the three
 * exists on the website.** They were mine, and they were the clearest evidence
 * that the app had become a redesign rather than a reproduction.
 *
 * Two whole sections that the website has and the app was missing — About, and
 * Explore the Xaverian network — are now present.
 *
 * ## The hero
 *
 * Full viewport height, `hero-bg.jpg` at `cover` / `50% 35%`, with two centred
 * lines in **Olde English**: the title at 34.32px and "Alumni Association" at
 * 21px. It carries **no buttons** — the website hides its CTAs at mobile width.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions, View } from 'react-native';

import { AboutSlider } from '@/components/AboutSlider';
import { Asset } from '@/components/AppImage';
import { ExploreAccordion } from '@/components/ExploreAccordion';
import { Band, Page } from '@/components/Page';
import { SiteButton } from '@/components/SiteButton';
import { Text } from '@/components/Text';
import { VoicesSection } from '@/components/VoicesSection';
import { useContent } from '@/lib/content-context';
import { colour, layout } from '@/theme';

/**
 * The hero title's measured top, from the hero's own top edge.
 *
 * Not 120. The section's padding is `120px 0 60px`, but the title block sits
 * 44.4 further down inside it, and reproducing the padding alone put the title
 * visibly high against the website.
 */
const HERO_TITLE_TOP = 164.4;

/** Measured: the "Inside the Xaverian experience" cards are 350 × 196.9. */
const CAMPUS_CARD_H = 196.9;

/**
 * The gaps above each of those three cards — **24 then 15.9**, not a uniform 24.
 *
 * The section is a fixed 856 tall and its content is distributed inside that
 * box, so the last gap is whatever is left over rather than a chosen value.
 * Transcribing the leftover is the only way the section ends where the website's
 * does; a tidy 24 everywhere makes it 8px too tall and pushes Voices down.
 */
const CAMPUS_CARD_GAPS = [0, 24, 15.9];

/**
 * The order the website *renders* those cards in, which is not the order the
 * bundle lists them in.
 *
 * The bundle is Campus · Academics · Life at Xavier's; on screen it reads
 * Campus · Life at Xavier's · Academics, because the stylesheet reorders them —
 * the same trick the mobile menu plays with "Explore the Network". Keyed on the
 * image filename so renaming a card's title cannot silently reshuffle the
 * section.
 */
const CAMPUS_CARD_ORDER = ['campus-raghabpur', 'campus-gym', 'campus-libraries'];

function inRenderedOrder<T extends { image: { src: string } }>(cards: readonly T[]): T[] {
  const rank = (card: T) => {
    const i = CAMPUS_CARD_ORDER.findIndex((name) => card.image.src.includes(name));
    return i === -1 ? CAMPUS_CARD_ORDER.length : i;
  };
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

export default function HomeScreen(): React.ReactElement {
  const content = useContent();
  const { width, height } = useWindowDimensions();
  const inner = width - layout.gutter * 2;

  const { hero, faculties, campusCards, voices, about } = content.home;
  const { items: exploreItems } = content.explore;

  return (
    <Page headerTone="light">
      {/* ── 0. Hero — full viewport, photo, Olde English, centred ──────────
          Measured: the title's top is at y = 164.4, not at the 120 the
          section's padding would suggest, and the subtitle follows 16.5 later.
          Two overlay layers, not one — see below. */}
      <View style={{ height, backgroundColor: colour.dark }}>
        <Asset
          image={{
            src: '/images/home/hero-bg.jpg',
            width: 1600,
            height: 2400,
            alt: 'St. Xaviers College (Calcutta)',
            // Measured object-position on the live hero.
            position: '50% 35%',
          }}
          displayWidth={width}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          priority="high"
        />
        {/*
          The website stacks two layers over the photograph, and the difference
          from the flat scrim this used to carry is visible: a navy cast across
          the whole frame, then a bottom-weighted gradient that darkens the foot
          and leaves the top of the image untouched.
        */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(19,62,109,0.15)' }} />
        <LinearGradient
          colors={['rgba(10,20,35,0)', 'rgba(10,20,35,0.14)', 'rgba(10,20,35,0.44)', 'rgba(10,20,35,0.72)']}
          locations={[0.2, 0.4, 0.7, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,17,17,0.08)' }}
        />

        <View style={{ flex: 1, paddingTop: HERO_TITLE_TOP, paddingHorizontal: layout.gutter, alignItems: 'center' }}>
          <Text variant="heroTitle" align="center">
            {hero.display.join(' ')}
          </Text>
          {/*
            7.6, not the 16.5 the raw measurement suggests. The website's title
            element is 28.9 tall — the glyph box of a text node — while React
            Native gives the same text a 37.752 line box. Reproducing the *gap*
            would put the subtitle 8.8 low; reproducing the subtitle's measured
            **top** (209.8) is what matches, and that is 7.6 below the RN box.
          */}
          <Text variant="heroSubtitle" align="center" style={{ marginTop: 7.6 }}>
            {hero.subtitle}
          </Text>
        </View>
      </View>

      {/* ── 1. About ─────────────────────────────────────────────────────
          Measured: heading stacked ("About" / "SXCCAA") **60** below the
          section top — the 90 this used to carry came from measuring an
          unfired scroll reveal, which starts 30px low. The lede follows at 32,
          then two buttons at 20 and 14. */}
      <Band padTop={0}>
        <View style={{ paddingTop: layout.sectionPadV }}>
          {about.heading.map((line) => (
            <Text key={line} variant="h2">{line}</Text>
          ))}
        </View>
        <Text variant="lede" style={{ marginTop: 32 }}>{about.lede}</Text>

        {/* hero.primaryCta / secondaryCta — the same two the hero would carry
            on desktop. The website hides them in the hero at mobile width and
            shows them here instead: filled, radius 80, the first on #111111 and
            the second on #f8f8f8. */}
        <SiteButton label={hero.primaryCta.label} href={hero.primaryCta.href} style={{ marginTop: 20 }} />
        <SiteButton label={hero.secondaryCta.label} href={hero.secondaryCta.href} tone="grey" style={{ marginTop: 14 }} />

        {/* The three-panel composition: a 129-tall panel pinned through 540px
            of scroll inside a 669-tall block. Measured top at 1339.8, which is
            30 below the second button. */}
        <View style={{ marginTop: 30 }}>
          <AboutSlider width={inner} images={about.collage.images} />
        </View>
      </Band>

      {/* ── 2. The Xaverian community — dark ─────────────────────────────
          Measured: H2 stacked on two lines, 90 from the section top. Each card
          is a 350x300 image with the title and body OVERLAID on its lower
          portion, inset 20 from the card edge — not stacked beneath it. The
          title sits 197 below the image top; the body 7 below the title. */}
      <Band dark padTop={0} bleed>
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: layout.sectionPadV }}>
          <Text variant="h2" color={colour.white} align="center">The Xaverian</Text>
          <Text variant="h2" color={colour.white} align="center">community</Text>
        </View>
        <View style={{ marginTop: 30, paddingHorizontal: layout.gutter }}>
          {faculties.map((slide, index) => (
            <View key={slide.title} style={{ marginTop: index === 0 ? 0 : 24, height: 300 }}>
              {slide.image ? (
                <Asset image={slide.image} displayWidth={inner}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }} />
              ) : null}
              {/* No scrim. The website has none — these crops are dark at the
                  foot on their own, and the 150px band the first build added
                  was the most visible invention on the page. */}
              <View style={{ position: 'absolute', left: 20, right: 20, top: 196.7 }}>
                <Text variant="h3OnDark">{slide.title}</Text>
                <Text variant="bodyOnDark" style={{ marginTop: 6 }}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </Band>

      {/* ── 3. Explore the Xaverian network ────────────────────────────
          An **accordion**, not a carousel — see ExploreAccordion's header for
          why the previous reading was wrong. Heading centred, 60 below the
          section top; the first item 46 below the heading block; then the
          section's own two pills at 30 and 14. */}
      <Band padTop={0} bleed>
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: layout.sectionPadV }}>
          <Text variant="h2" align="center">Explore the Xaverian</Text>
          <Text variant="h2" align="center">network</Text>
        </View>

        <View style={{ marginTop: 46 }}>
          <ExploreAccordion items={exploreItems} detailsLabel={content.explore.detailsLabel} />
        </View>

        <View style={{ paddingHorizontal: layout.gutter }}>
          <SiteButton label="Explore the Network" href="/explore" style={{ marginTop: 30 }} />
          <SiteButton label="Events & Activities" href="/events" style={{ marginTop: 14 }} />
        </View>
      </Band>

      {/* ── 4. Inside the Xaverian experience — dark ───────────────────────
          Measured: 350 x 196.9 images with the title and body **overlaid**,
          the title 95.3 below the image top and the body 8 under it. The
          previous build stacked the text beneath a 4:3 image. */}
      <Band dark padTop={0} bleed>
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: layout.sectionPadV }}>
          <Text variant="h2" color={colour.white} align="center">Inside the Xaverian</Text>
          <Text variant="h2" color={colour.white} align="center">experience</Text>
        </View>
        <View style={{ marginTop: 30, paddingHorizontal: layout.gutter }}>
          {inRenderedOrder(campusCards).map((card, index) => (
            <View key={card.title} style={{ marginTop: CAMPUS_CARD_GAPS[index] ?? 24, height: CAMPUS_CARD_H }}>
              <Asset image={card.image} displayWidth={inner}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CAMPUS_CARD_H }} />
              <View style={{ position: 'absolute', left: 20, right: 20, top: 95.3 }}>
                <Text variant="cardTitle">{card.title}</Text>
                <Text variant="bodyOnDark" style={{ marginTop: 8 }}>{card.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </Band>

      {/* ── 5. Voices From Our Community — dark, scroll-pinned ─────────────
          2237 tall: an 844 stage pinned through 1393 of scroll, with three
          glass cards rising through it. See VoicesSection. */}
      <VoicesSection
        voices={voices}
        background={{
          src: '/images/home/voices-bg.png',
          width: 1666,
          height: 944,
          alt: 'The gate of St. Xaviers College (Calcutta), Raghabpur campus, at dusk',
          position: 'center center',
        }}
      />
    </Page>
  );
}
