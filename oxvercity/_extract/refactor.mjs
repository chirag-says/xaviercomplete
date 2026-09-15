// Swap the repeated, content-bearing blocks of the generated sections for
// data-driven components. Each edit replaces a balanced JSX element (found by
// a marker in its opening tag) or a literal text node, and adds the imports
// the replacement needs. Run once after regenerating the sections:
//   node _extract/refactor.mjs
import fs from 'node:fs';

const ROOT = 'D:/oxversity/src/components/';
const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;

/** Replace every element whose opening tag contains `marker`; `make(info, n)` returns the JSX. */
function replaceElements(src, marker, make, { inner = false } = {}) {
  let from = 0;
  let n = 0;
  while (true) {
    const at = src.indexOf(marker, from);
    if (at === -1) break;
    const open = src.lastIndexOf('<', at);
    tagRe.lastIndex = open;
    let depth = 0;
    let end = -1;
    let openEnd = -1;
    let closeStart = -1;
    let m;
    while ((m = tagRe.exec(src))) {
      if (m.index === open) openEnd = m.index + m[0].length;
      if (m[1]) depth--;
      else if (!m[4]) depth++;
      if (depth === 0) {
        closeStart = m[1] ? m.index : m.index + m[0].length;
        end = m.index + m[0].length;
        break;
      }
    }
    const element = src.slice(open, end);
    const body = make({ element, cls: (src.slice(open, openEnd).match(/className=\{"([^"]*)"\}/) || [])[1] || '' }, n);
    if (inner) src = src.slice(0, openEnd) + '\n' + body + '\n' + src.slice(closeStart);
    else src = src.slice(0, open) + body + src.slice(end);
    from = open + body.length + (inner ? openEnd - open : 0);
    n++;
  }
  if (n === 0) throw new Error(`marker not found: ${marker}`);
  return src;
}

/** Replace a literal text node `{"..."}` (or attribute value) everywhere. */
function replaceText(src, literal, expr) {
  const needle = `{"${literal}"}`;
  if (!src.includes(needle)) throw new Error(`text not found: ${literal}`);
  return src.split(needle).join(`{${expr}}`);
}

function addImports(src, lines) {
  const at = src.indexOf('\nexport function');
  return src.slice(0, at) + '\n' + lines.join('\n') + '\n' + src.slice(at);
}

function edit(file, fn) {
  const path = ROOT + file;
  const src = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, fn(src));
  console.log('refactored', file);
}

const ORDER_DPT = ['desktop', 'phone', 'tablet'];
const ORDER_DTP = ['desktop', 'tablet', 'phone'];

// ---- programs accordion --------------------------------------------------------
for (const [file, container] of [['home/ProgramSection.tsx', 'framer-pt2w7z-container'], ['programs/ProgramsList.tsx', 'framer-lexqjw-container']]) {
  edit(file, (src) => {
    src = replaceElements(src, `className={"${container}"}`, (_, n) => `<ProgramAccordion programs={programs} breakpoint="${ORDER_DPT[n]}" containerClass="${container}" detailsLabel={programDetailsLabel} />`);
    return addImports(src, ["import { ProgramAccordion } from '@/components/programs/ProgramAccordion';", "import { programs, programDetailsLabel } from '@/data/programs';"]);
  });
}

// ---- FAQ ----------------------------------------------------------------------
edit('contact/FaqSection.tsx', (src) => {
  src = replaceElements(src, 'className={"framer-j8p5yo-container"}', (_, n) => `<FaqAccordion items={faq} breakpoint="${ORDER_DTP[n]}" />`);
  src = replaceText(src, 'FAQS', 'contactPage.faqTitle');
  return addImports(src, ["import { FaqAccordion } from './FaqAccordion';", "import { contactPage, faq } from '@/data/pages/contact';"]);
});

// ---- about: fact cards, stat lines, about card ----------------------------------
edit('about/AboutStory.tsx', (src) => {
  src = replaceElements(
    src,
    'id={"fact-card-block"}',
    () => `{facts.map((fact, i) => (
                  <EachBreakpoint key={fact.title} hashes={PAGE_HASHES.about} render={(breakpoint) => <FactCard fact={fact} breakpoint={breakpoint} containerClass={FACT_CONTAINERS[i] ?? FACT_CONTAINERS[FACT_CONTAINERS.length - 1]} />} />
                ))}`,
    { inner: true },
  );
  return addImports(src, [
    "import { FactCard } from './FactCard';",
    "import { EachBreakpoint } from '@/components/layout/Variant';",
    "import { PAGE_HASHES } from '@/lib/breakpoints';",
    "import { facts } from '@/data/pages/about';",
    '',
    "/** Framer's layout slot for each fact card; the scroll reveal is keyed by it. */",
    "const FACT_CONTAINERS = ['framer-oabdj9-container', 'framer-11yw4oy-container', 'framer-xv32t5-container'];",
  ]);
});

edit('about/InfoSection.tsx', (src) => {
  for (const [i, container] of [['0', 'framer-1bpv1fj-container'], ['1', 'framer-1r3i20p-container']]) {
    src = replaceElements(src, `className={"${container}"}`, (_, n) => `<StatLine stat={statLines[${i}]} index={${i}} variant="${n === 0 ? 'desktop' : 'tablet'}" containerClass="${container}" />`);
  }
  src = replaceText(src, 'SINCE 1960', 'aboutCard.eyebrow');
  src = replaceText(src, 'When curiosity truly meets new opportunities, brighter futures open wide.', 'aboutCard.title');
  src = src.replace(/\{"Founded in 1960[^"]*"\}/g, '{aboutCard.text}');
  src = replaceText(src, '5000+', 'aboutCard.reviewsCount');
  src = replaceText(src, 'Student reviews', 'aboutCard.reviewsLabel');
  src = src.replace("import { partnerLogos } from '@/data/pages/about';", "import { aboutCard, partnerLogos, statLines } from '@/data/pages/about';\nimport { StatLine } from './StatLine';");
  return src;
});

edit('about/NewsSection.tsx', (src) => {
  src = replaceElements(
    src,
    'className={"framer-16d11js"}',
    () => `{/* Desktop shows three cards; tablet and phone list them all. */}
              <Variant hashes={PAGE_HASHES.about} on="desktop">
                {news.slice(0, 3).map((item) => <NewsCard key={item.title} item={item} variant="desktop" />)}
              </Variant>
              <Variant hashes={PAGE_HASHES.about} on={['tablet', 'phone']}>
                {news.map((item) => <NewsCard key={item.title} item={item} variant="phone" />)}
              </Variant>`,
    { inner: true },
  );
  return addImports(src, ["import { NewsCard } from './NewsCard';", "import { Variant } from '@/components/layout/Variant';", "import { PAGE_HASHES } from '@/lib/breakpoints';", "import { news } from '@/data/pages/about';"]);
});

// ---- home: campus and events --------------------------------------------------
edit('home/CampusSection.tsx', (src) => {
  src = replaceElements(src, 'className={"framer-1wpva9u"}', () => `<CampusSlot index={0} />\n                <CampusSlot index={1} />`, { inner: true });
  src = replaceElements(src, 'className={"framer-115d54s"}', () => `<CampusSlot index={2} />\n                <CampusSlot index={3} />`, { inner: true });
  return addImports(src, [
    "import { CampusCard } from './CampusCard';",
    "import { Variant } from '@/components/layout/Variant';",
    "import { PAGE_HASHES, type Breakpoint } from '@/lib/breakpoints';",
    "import { campusCards } from '@/data/pages/home';",
    '',
    '/**',
    " * Each card's layout slot and its breakpoint copies: which card variant each",
    " * copy uses and the start state of its scroll reveal, as Framer laid them out.",
    ' */',
    "const CAMPUS_SLOTS: { container: string; copies: { on: Breakpoint | Breakpoint[]; variant: 'desktop' | 'phone'; reveal?: string }[] }[] = [",
    "  { container: 'framer-1sf96mu-container', copies: [{ on: 'desktop', variant: 'desktop' }, { on: ['tablet', 'phone'], variant: 'phone' }] },",
    "  { container: 'framer-arxw4x-container', copies: [{ on: 'desktop', variant: 'desktop', reveal: 'translateY(40px)' }, { on: ['tablet', 'phone'], variant: 'phone', reveal: 'translateY(40px)' }] },",
    "  { container: 'framer-bmvoqh-container', copies: [{ on: 'desktop', variant: 'desktop', reveal: 'translateY(-40px)' }, { on: 'phone', variant: 'phone', reveal: 'translateY(40px)' }, { on: 'tablet', variant: 'phone', reveal: 'translateY(-40px)' }] },",
    "  { container: 'framer-1yjpdms-container', copies: [{ on: 'desktop', variant: 'desktop', reveal: 'translateX(40px)' }, { on: 'phone', variant: 'phone', reveal: 'translateY(40px)' }, { on: 'tablet', variant: 'phone', reveal: 'translateX(40px)' }] },",
    '];',
    '',
    'function CampusSlot({ index }: { index: number }) {',
    '  const card = campusCards[index];',
    '  const slot = CAMPUS_SLOTS[index];',
    '  if (!card || !slot) return null;',
    '  return slot.copies.map((copy, i) => (',
    '    <Variant key={i} hashes={PAGE_HASHES.home} on={copy.on}>',
    '      <CampusCard card={card} variant={copy.variant} containerClass={slot.container} reveal={copy.reveal} />',
    '    </Variant>',
    '  ));',
    '}',
  ]);
});

edit('home/EventsSection.tsx', (src) => {
  src = replaceElements(
    src,
    'className={"framer-743kbg"}',
    () => `<div className={"framer-17rkbq7 hidden-1n3ggvs"} data-framer-name={"Event Card Stack"}>
                <div className={"framer-3g08kb"} data-framer-name={"Event Card Wrap"}>
                  <Variant hashes={H} on={['desktop', 'phone']}><EventCard event={events[0]} variant="primary" containerClass="framer-5mov61-container" /></Variant>
                  <Variant hashes={H} on="tablet"><EventCard event={events[0]} variant="phone" containerClass="framer-5mov61-container" /></Variant>
                </div>
                <div className={"framer-1pizrmq"} data-framer-name={"Event Card Wrap"}>
                  <Variant hashes={H} on={['desktop', 'phone']}><EventCard event={events[1]} variant="small" containerClass="framer-1r2mtj3-container" reveal="translateX(40px)" /></Variant>
                  <Variant hashes={H} on="tablet"><EventCard event={events[1]} variant="phone" containerClass="framer-1r2mtj3-container" reveal="translateX(40px)" /></Variant>
                </div>
              </div>
              <div className={"framer-13rnvi7"} data-framer-name={"Event Card Wrap"}>
                <Variant hashes={H} on={['desktop', 'tablet']}>
                  <Variant hashes={H} on={['desktop', 'phone']}><EventCard event={events[2]} variant="primary" containerClass="framer-4kzgrb-container" /></Variant>
                  <Variant hashes={H} on={['tablet', 'phone']}><EventCard event={events[2]} variant="phone" containerClass="framer-4kzgrb-container" /></Variant>
                </Variant>
                <Variant hashes={H} on="phone">
                  {events.map((event) => <EventCard key={event.title} event={event} variant="phone" containerClass="framer-4kzgrb-container" />)}
                </Variant>
              </div>
              <div className={"framer-1169nts hidden-1n3ggvs"} data-framer-name={"Event Card Stack"}>
                <div className={"framer-5z1lc2"} data-framer-name={"Event Card Wrap"}>
                  <Variant hashes={H} on={['desktop', 'phone']}><EventCard event={events[3]} variant="small" containerClass="framer-1yas68c-container" reveal="translateX(-40px)" /></Variant>
                  <Variant hashes={H} on="tablet"><EventCard event={events[3]} variant="phone" containerClass="framer-1yas68c-container" reveal="translateX(-40px)" /></Variant>
                </div>
                <div className={"framer-1tqwk5f"} data-framer-name={"Event Card Wrap"}>
                  <Variant hashes={H} on={['desktop', 'phone']}><EventCard event={events[4]} variant="primary" containerClass="framer-es9y1s-container" reveal="translateX(40px)" /></Variant>
                  <Variant hashes={H} on="tablet"><EventCard event={events[4]} variant="phone" containerClass="framer-es9y1s-container" reveal="translateX(40px)" /></Variant>
                </div>
              </div>`,
    { inner: true },
  );
  return addImports(src, [
    "import { EventCard } from './EventCard';",
    "import { Variant } from '@/components/layout/Variant';",
    "import { PAGE_HASHES } from '@/lib/breakpoints';",
    "import { events } from '@/data/pages/home';",
    '',
    'const H = PAGE_HASHES.home;',
  ]);
});

// ---- forms --------------------------------------------------------------------
function formEdits(src, formClass, submitContainer, data) {
  src = src.split(`<form className={"${formClass}"}>`).join(`<SiteForm className="${formClass}" action={${data}.form.action}>`);
  src = src.split('</form>').join('</SiteForm>');
  src = replaceElements(src, `className={"${submitContainer}"}`, ({ element }) => `<SubmitButton labels={${data}.form} variant="${element.includes('framer-v-1xh1r0') ? 'phone' : 'default'}" containerClass="${submitContainer}" />`);
  src = replaceText(src, 'Full name*', `${data}.form.nameLabel`);
  src = replaceText(src, 'Mason Ethan', `${data}.form.namePlaceholder`);
  src = replaceText(src, 'Email*', `${data}.form.emailLabel`);
  src = src.replace(/^(\s*)\{"Message"\}$/gm, `$1{${data}.form.messageLabel}`);
  src = replaceText(src, 'Plan your campus future with us...', `${data}.form.messagePlaceholder`);
  src = replaceText(src, 'I agree to the terms and conditions.', `${data}.form.consent`);
  return src;
}

edit('contact/ContactBanner.tsx', (src) => {
  src = formEdits(src, 'framer-1o1b9ue', 'framer-szbiu3-container', 'contactPage');
  src = replaceText(src, 'yourmail@email.com', 'contactPage.form.emailPlaceholder');
  src = replaceText(src, 'Get In Touch With Us', 'contactPage.title');
  src = src.replace(/\{"Whether you need admission guidance[^"]*"\}/g, '{contactPage.intro}');
  src = replaceText(src, 'tel:+1 (800) 555-0199', 'contactPage.phoneHref');
  src = replaceText(src, '+1 (800) 555-0199', 'contactPage.phone');
  src = replaceText(src, 'mailto:admission@university.edu', 'contactPage.emailHref');
  src = replaceText(src, 'admission@university.edu', 'contactPage.email');
  src = replaceText(src, 'Follow Us -', 'contactPage.followLabel');
  src = replaceElements(src, 'className={"framer-ah26w4"}', (_, n) => `<SocialLinks socials={contactPage.socials} split={${n === 0}} />`, { inner: true });
  return addImports(src, ["import { SiteForm, SubmitButton } from '@/components/ui/SiteForm';", "import { SocialLinks } from './SocialLinks';", "import { contactPage } from '@/data/pages/contact';"]);
});

edit('shared/ContactCta.tsx', (src) => {
  src = formEdits(src, 'framer-10k5ome', 'framer-1212k9y-container', 'contactCta');
  src = replaceText(src, 'hello@mflowtcompany.com', 'contactCta.form.emailPlaceholder');
  src = replaceText(src, 'Questions? We’re here to help', 'contactCta.title');
  return addImports(src, ["import { SiteForm, SubmitButton } from '@/components/ui/SiteForm';", "import { contactCta } from '@/data/site';"]);
});
