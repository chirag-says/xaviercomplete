import type { ReactNode } from 'react';
import { variantClass, type Breakpoint, type BreakpointHashes } from '@/lib/breakpoints';

/**
 * A breakpoint copy of a block, the way Framer's server render ships one:
 * every copy is in the markup and the breakpoint CSS shows exactly one.
 */
export function Variant({ hashes, on, children }: { hashes: BreakpointHashes; on: Breakpoint | Breakpoint[]; children: ReactNode }) {
  return <div className={variantClass(hashes, on)}>{children}</div>;
}

/** One copy per breakpoint, each rendered by `render` for that breakpoint. */
export function EachBreakpoint({ hashes, render }: { hashes: BreakpointHashes; render: (breakpoint: Breakpoint) => ReactNode }) {
  return (
    <>
      <Variant hashes={hashes} on="desktop">{render('desktop')}</Variant>
      <Variant hashes={hashes} on="tablet">{render('tablet')}</Variant>
      <Variant hashes={hashes} on="phone">{render('phone')}</Variant>
    </>
  );
}
