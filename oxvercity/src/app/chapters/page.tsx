import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { MotionGate } from '@/components/chapters/MotionGate';
import { ChapterStage } from '@/components/chapters/ChapterStage';
import { ChapterNetwork } from '@/components/chapters/ChapterNetwork';
import { ChapterMeets } from '@/components/chapters/ChapterMeets';
import { ChapterBill } from '@/components/chapters/ChapterBill';
import { ChapterJoin } from '@/components/chapters/ChapterJoin';
import { ChapterClose } from '@/components/chapters/ChapterClose';

export const metadata: Metadata = {
  title: 'Chapters — The Xaverian Network — SXCCAA',
  description:
    "The chapters of the St. Xavier's College (Calcutta) Alumni Association: the Association's seat in Calcutta, its West Zone chapter in Mumbai, and the Xaverians Nostalgia meets the chapter holds.",
};

/**
 * /chapters — the Xaverian network.
 *
 * The page runs as one argument in five moves and a foot: the chapter's poster
 * at the size it deserves, the meets it holds, what a meet is made of, how to
 * attend, and the network the chapter belongs to — then the ways on. It opens and closes on night with paper in between, which is what
 * holds it together as one object rather than a stack of sections.
 *
 * The network sits last rather than second. Widening out to the two cities
 * reads as a closing thought once the chapter has been met; before it, it was
 * an abstraction standing between the reader and the thing they came for. Its
 * section numbers are set in the data file, so the order is changed in one
 * place.
 *
 * Everything factual comes from `data/pages/chapters.ts` and, for the 2026
 * meet, from the events data, so nothing here is a second copy of a date.
 * Nothing on the page asserts a chapter, a city or a figure the Association
 * has not published.
 *
 * There is no `<noscript>` block, unlike the page this replaces. Every resting
 * state that used to be written by a component is in the stylesheet now, and
 * the hero's reveal is a CSS animation, so a visitor whose script never
 * arrives gets the finished composition rather than an empty page. What
 * scripting adds is the scroll-linked depth, the network's reveal and the
 * poster viewer — enhancements, each of which is simply absent without it.
 */
export default function ChaptersPage() {
  return (
    <SiteShell>
      <div className="ev-page cx-page">
        <MotionGate />
        <ChapterStage />
        <ChapterMeets />
        <ChapterBill />
        <ChapterJoin />
        <ChapterNetwork />
        <ChapterClose />
      </div>
    </SiteShell>
  );
}
