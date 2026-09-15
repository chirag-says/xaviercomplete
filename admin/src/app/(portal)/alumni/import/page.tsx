/**
 * Import alumni from a spreadsheet.
 *
 * Super admins only, and step-up is required to commit — this publishes a lot
 * of people at once and optionally hands each of them the ability to read
 * everybody else's contact details.
 *
 * The page says plainly when to use the local tool instead. For the first five
 * hundred records, a file that never leaves a laptop is still the better
 * answer; this is for the batches that follow.
 */

import type { Metadata } from 'next';

import { ImportSheet } from '@/components/ImportSheet';
import { StepUpPanel } from '@/components/StepUpPanel';
import { canActNow, requireSuperAdmin } from '@/lib/guard';

export const metadata: Metadata = { title: 'Import alumni — SXCCAA Admin' };

export default async function ImportPage() {
  await requireSuperAdmin();
  const fresh = await canActNow();

  return (
    <>
      <div className="main__head">
        <p className="eyebrow">
          <a href="/alumni">Alumni records</a> · Import
        </p>
        <h1>Import from a spreadsheet</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          The same columns as the Association&rsquo;s alumni form. Nothing is written until you have
          seen what the file contains and confirmed it.
        </p>
      </div>

      <StepUpPanel fresh={fresh} />

      <div className="card">
        <ImportSheet />
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <strong>Loading the whole directory for the first time?</strong> Use the local tool instead —
        <span className="mono"> npm run ingest</span> on the Association&rsquo;s own machine. One file
        containing every alumnus is worth keeping off the internet entirely. This page is for the
        handful who turn up afterwards, and it stops at 2,000 rows.
      </div>

      <div className="notice" style={{ marginTop: 12 }}>
        <strong>What happens to the file.</strong> It is read in memory and discarded when the page
        finishes with it. It is never written to disk, never logged, and its contents never appear in
        this preview beyond names and row numbers — no phone numbers, no addresses.
      </div>
    </>
  );
}
