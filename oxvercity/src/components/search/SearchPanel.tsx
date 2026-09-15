'use client';

/**
 * The search box and its result list, exactly as Framer's search component
 * renders them: an input row with the magnifier and a clear button, a hairline,
 * then the ranked results (title over path), with keyboard navigation.
 *
 * Both the header modal and the /search page render this; only the frame
 * around it differs.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { search } from '@/lib/search';
import { searchIndex } from '@/data/searchIndex';
import { tokens } from '@/lib/tokens';

const FONT = 'Inter, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
const MUTED = 'rgba(0, 0, 0, 0.45)';

export interface SearchPanelProps {
  /** Path of the page the panel sits on; that page is left out of the results. */
  currentPath?: string;
  /** Called after a result is chosen, before navigation. */
  onNavigate?: () => void;
  autoFocus?: boolean;
  /** `dialog` is the modal's card; `page` drops the card's max-height so the list grows with the page. */
  frame?: 'dialog' | 'page';
}

export function SearchPanel({ currentPath, onNavigate, autoFocus = true, frame = 'dialog' }: SearchPanelProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const results = useMemo(() => search(searchIndex, query, currentPath), [query, currentPath]);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  useEffect(() => setSelected(0), [query]);

  const go = (url: string) => {
    onNavigate?.();
    router.push(url);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((i) => Math.min(i + 1, Math.max(results.length - 1, 0))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((i) => Math.max(i - 1, 0)); }
    if (event.key === 'Enter' && results[selected]) { event.preventDefault(); go(results[selected].url); }
  };

  const dialogStyle: CSSProperties = {
    willChange: 'transform',
    backgroundColor: 'rgb(255, 255, 255)',
    color: tokens.ink,
    borderRadius: 16,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'rgba(0, 0, 0, 0.2) 0px 20px 40px 0px',
    maxHeight: frame === 'dialog' ? 'min(496px, -30px + 100vh)' : undefined,
  };

  return (
    <div role="dialog" aria-label="Search" style={dialogStyle}>
      <div role="search" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontFamily: FONT, padding: '12px 20px', gap: 12, touchAction: 'none' }}>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" style={{ color: MUTED }}>
            <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" fill="currentColor" />
          </svg>
        </div>
        <input
          ref={input}
          spellCheck={false}
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search"
          style={{ outline: 'none', border: 'none', background: 'transparent', fontWeight: 500, height: '2em', padding: 0, width: '100%', WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)', color: tokens.ink, lineHeight: '2em', verticalAlign: 'baseline', fontSize: 16, fontFamily: FONT, '--framer-search-placeholder-color': 'rgba(0, 0, 0, 0.4)' } as CSSProperties}
        />
        {query && (
          <div style={{ flexShrink: 0, fontSize: 14 }}>
            <button
              type="button"
              className="__framer-search-clear-button"
              aria-label="Clear search"
              onClick={() => { setQuery(''); input.current?.focus(); }}
              style={{ fontFamily: 'inherit', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', textTransform: 'uppercase', color: MUTED, fontSize: '0.75em', padding: 0 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style={{ color: MUTED, width: 18, height: 18 }}>
                <rect width="256" height="256" fill="none" />
                <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div style={{ background: tokens.ink, height: 1, flexShrink: 0, opacity: 0.05 }} />
      <div style={{ width: 'calc(100% + 20px)', overflow: 'hidden scroll', overscrollBehavior: 'contain', marginTop: -1 }}>
        <ul aria-live="polite" style={{ display: 'flex', flexDirection: 'column', width: 'calc(100% - 20px)', padding: 0, gap: 1, margin: 0 }}>
          {query && results.length === 0 && (
            <li style={{ padding: '12px 20px', lineHeight: '2em', height: '100%', listStyle: 'none' }}>
              <h3 style={{ textOverflow: 'ellipsis', maxWidth: '100%', overflow: 'hidden', fontWeight: 500, whiteSpace: 'nowrap', flex: '1 1 0%', margin: 0, textAlign: 'center', lineHeight: '32px', color: 'rgba(0, 0, 0, 0.4)', fontSize: 14, fontFamily: FONT }}>
                No results
              </h3>
            </li>
          )}
          {results.map((result, index) => (
            <a
              key={result.url}
              href={result.url}
              style={{ textDecoration: 'none' }}
              onClick={(e) => { e.preventDefault(); go(result.url); }}
              onMouseMove={() => setSelected(index)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <li style={{ padding: '16px 20px', listStyle: 'none', fontWeight: 500, color: tokens.ink, position: 'relative' }}>
                <div style={{ backgroundColor: tokens.ink, position: 'absolute', opacity: index === selected ? 0.06 : 0, borderRadius: 0, inset: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 4 }}>
                  <h3 style={{ textOverflow: 'ellipsis', maxWidth: '100%', overflow: 'hidden', fontWeight: 500, whiteSpace: 'nowrap', flex: '1 1 0%', margin: 0, fontSize: 14, fontFamily: FONT, lineHeight: '1.4em' }}>
                    {result.title}
                  </h3>
                  <p style={{ margin: 0, color: 'rgba(0, 0, 0, 0.4)', fontSize: 12, fontFamily: FONT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4em' }}>
                    {' '}{result.url}
                  </p>
                </div>
              </li>
            </a>
          ))}
        </ul>
      </div>
    </div>
  );
}
