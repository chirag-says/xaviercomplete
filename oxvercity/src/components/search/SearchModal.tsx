'use client';

/**
 * The search overlay the header's magnifier opens: Framer's search modal, with
 * its 80% black backdrop and the 500px card 20vh from the top. Escape or a
 * click on the backdrop closes it; the page behind stops scrolling.
 *
 * The backdrop fades with Framer's spring (stiffness 500, damping 60).
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { animate } from 'motion';
import { usePathname } from 'next/navigation';
import { SearchPanel } from './SearchPanel';

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 60, mass: 1 };

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const backdrop = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('__framer-overflow-hidden');
    const controls = [
      backdrop.current && animate(backdrop.current, { opacity: [0, 1] }, SPRING),
      card.current && animate(card.current, { opacity: [0, 1], y: [8, 0] }, SPRING),
    ];
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('__framer-overflow-hidden');
      for (const c of controls) c?.stop();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const container: CSSProperties = { width: '100%', boxSizing: 'border-box', willChange: 'transform', position: 'fixed', display: 'flex', alignItems: 'flex-start', inset: 0, zIndex: 10, justifyContent: 'center' };
  return createPortal(
    <div className="__framer-search-modal-container" role="presentation" style={container} onClick={onClose}>
      <div ref={backdrop} role="presentation" style={{ inset: 0, width: '100%', height: '100%', boxSizing: 'border-box', position: 'absolute', touchAction: 'none', backgroundColor: 'rgba(0, 0, 0, 0.8)', opacity: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 15, overflow: 'visible', width: 500, maxWidth: 'calc(100% - 40px)', marginTop: 0, height: 'auto', maxHeight: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: '100%', flexBasis: '20vh' }} />
        <div ref={card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 16, overflow: 'visible', width: '100%', height: 'auto', maxHeight: '100%', backgroundColor: 'transparent', opacity: 0 }}>
          <SearchPanel currentPath={pathname} onNavigate={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
