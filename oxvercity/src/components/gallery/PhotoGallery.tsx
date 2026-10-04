'use client';

/**
 * The full gallery, set the way the /events gallery is: justified rows where
 * every picture in a row shares one height and the row fills the measure.
 *
 * /events composes its two rows by hand. With a thousand-odd photographs that
 * can't be done, so the rows are packed here instead — in shooting order, each
 * row taking pictures until their aspect ratios add up to a target. The targets
 * alternate between a wide row of a few large pictures and a strip of more,
 * smaller ones, which is the rhythm of the /events composition (three, then
 * four). The widths and the equal heights are then the same CSS as /events:
 * each cell grows by its own aspect from a zero basis.
 *
 * The targets depend on the measure, so the rows are packed per breakpoint;
 * the server renders the desktop packing and a phone repacks after mount.
 *
 * Photographs arrive in batches behind a button rather than all at once: a
 * thousand <img> elements, lazy or not, is a lot of layout for one page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cloudinaryIdUrl } from '@/lib/cloudinary';
import { galleryEvent, photos, type GalleryPhoto } from '@/data/pages/gallery';
import { Lightbox } from '@/components/events/Lightbox';

/** Aspect-ratio sums a row aims for, alternating wide row / strip. */
const TARGETS = {
  desktop: [4.5, 6],
  tablet: [3, 4.5],
  phone: [1.5, 3],
} as const;
type Layout = keyof typeof TARGETS;

/** The shell's measure, for `sizes`. */
const MEASURE = 1296;
const THUMB_WIDTHS = [480, 800, 1200, 1600];
const BATCH = 72;

interface Cell { photo: GalleryPhoto; index: number; aspect: number }
interface Row { cells: Cell[]; sum: number; target: number }

function pack(layout: Layout): Row[] {
  const targets = TARGETS[layout];
  const rows: Row[] = [];
  let cells: Cell[] = [];
  let sum = 0;
  const target = () => targets[rows.length % targets.length];
  photos.forEach((photo, index) => {
    const aspect = photo.width / photo.height;
    cells.push({ photo, index, aspect });
    sum += aspect;
    if (sum < target()) return;
    // close the row on whichever side of the target is nearer
    const without = sum - aspect;
    if (cells.length > 1 && target() - without < sum - target()) {
      const last = cells.pop()!;
      rows.push({ cells, sum: without, target: target() });
      cells = [last];
      sum = last.aspect;
    } else {
      rows.push({ cells, sum, target: target() });
      cells = [];
      sum = 0;
    }
  });
  if (cells.length) rows.push({ cells, sum, target: target() });
  return rows;
}

function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>('desktop');
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 809.98px)');
    const tablet = window.matchMedia('(max-width: 1199.98px)');
    const update = () => setLayout(phone.matches ? 'phone' : tablet.matches ? 'tablet' : 'desktop');
    update();
    phone.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      phone.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);
  return layout;
}

export function PhotoGallery() {
  const layout = useLayout();
  const rows = useMemo(() => pack(layout), [layout]);
  const [shown, setShown] = useState(BATCH);
  const buttons = useRef<Record<number, HTMLButtonElement | null>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  // whole rows only, so the last one on screen is never a stretched remnant
  const visible = useMemo(() => {
    const out: Row[] = [];
    for (const row of rows) {
      if (row.cells[0].index >= shown) break;
      out.push(row);
    }
    return out;
  }, [rows, shown]);
  const lastShown = visible.length ? visible[visible.length - 1].cells.at(-1)!.index + 1 : 0;

  const items = useMemo(
    () =>
      photos.map((photo) => ({
        image: { src: photo.id, width: photo.width, height: photo.height, alt: photo.alt },
        full: cloudinaryIdUrl(photo.id, { width: 2048 }),
        title: galleryEvent.title,
        date: galleryEvent.date,
        place: galleryEvent.place,
      })),
    [],
  );

  const openAt = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const img = event.currentTarget.querySelector('img');
    setOrigin(img ? img.getBoundingClientRect() : null);
    setOpen(index);
  };

  const close = () => {
    const button = open !== null ? buttons.current[open] : null;
    setOpen(null);
    setOrigin(null);
    button?.focus();
  };

  return (
    <section className="ev-gallery gl-gallery" aria-labelledby="gallery-heading">
      <div className="ev-shell">
        <div className="ev-gallery__head">
          <h1 className="ev-section-title gl-title" id="gallery-heading">Gallery</h1>
          <div className="gl-meta">
            <p className="ev-eyebrow">{galleryEvent.title}</p>
            <p className="ev-gallery__note">
              {galleryEvent.place} · {galleryEvent.date}
            </p>
          </div>
        </div>

        <ul className="ev-gallery__rows">
          {visible.map((row, r) => {
            // an unfinished last row keeps its natural height instead of
            // stretching a picture or two across the whole measure
            const fill = row === rows[rows.length - 1] ? Math.min(1, row.sum / row.target) : 1;
            return (
              <li className="ev-gallery__row gl-row" key={`${layout}-${r}`}>
                <ul style={fill < 1 ? { width: `${fill * 100}%` } : undefined}>
                  {row.cells.map(({ photo, index, aspect }) => {
                    const share = (aspect / row.sum) * fill;
                    return (
                      <li
                        className="ev-gallery__cell"
                        key={photo.id}
                        style={{
                          '--ar': `${photo.width} / ${photo.height}`,
                          '--grow': aspect,
                        } as React.CSSProperties}
                      >
                        <button
                          type="button"
                          className="ev-gallery__button"
                          onClick={(e) => openAt(index, e)}
                          ref={(el) => { buttons.current[index] = el; }}
                        >
                          <span className="ev-gallery__frame">
                            <img
                              src={cloudinaryIdUrl(photo.id, { width: 800 })}
                              srcSet={THUMB_WIDTHS.map((w) => `${cloudinaryIdUrl(photo.id, { width: w })} ${w}w`).join(', ')}
                              sizes={`(min-width: 1336px) ${Math.round(share * MEASURE)}px, ${Math.max(1, Math.round(share * 100))}vw`}
                              width={photo.width}
                              height={photo.height}
                              alt={photo.alt}
                              loading="lazy"
                              decoding="async"
                            />
                            <span className="ev-gallery__zoom" aria-hidden="true">View</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        {lastShown < photos.length ? (
          <div className="gl-more">
            <button type="button" className="gl-more__button" onClick={() => setShown(lastShown + BATCH)}>
              Show more photos
            </button>
          </div>
        ) : null}
      </div>

      {open !== null ? (
        <Lightbox
          items={items}
          index={open}
          origin={origin}
          onClose={close}
          onStep={(next) => { setOrigin(null); setOpen(next); }}
          showCount={false}
        />
      ) : null}
    </section>
  );
}
