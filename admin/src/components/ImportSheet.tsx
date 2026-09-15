'use client';

/**
 * Drag a spreadsheet in, see what would happen, then commit.
 *
 * ## Why it previews first
 *
 * The same reason the local ingest tool does. An import writes a lot of people
 * into a public directory at once, and "I think the Contact number column was
 * picked up" is not something anyone should be finding out afterwards. The
 * preview shows which column mapped to which field, how many rows are good, how
 * many are already in the directory, and every rejection with its reason.
 *
 * ## The file is held in the browser, not on the server
 *
 * It is posted twice — once to preview, once to commit — and the `File` stays in
 * this component in between. The alternative would be the server parking five
 * hundred people's contact details somewhere as working state between two
 * requests, which is exactly what the rest of this system avoids.
 *
 * ## Contact details are never rendered
 *
 * The preview shows names, batch years and row numbers. Not one phone number
 * and not one address — this screen gets looked at over somebody's shoulder,
 * and there is no reason it needs to show them to do its job.
 */

import { useActionState, useRef, useState, type DragEvent } from 'react';

import {
  commitAlumniImport,
  previewAlumniImport,
  type ActionResult,
  type PreviewResult,
} from '@/app/actions/admin-actions';

export function ImportSheet() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const [preview, previewAction, previewing] = useActionState<PreviewResult | null, FormData>(
    async (prev, data) => previewAlumniImport(prev, data),
    null,
  );
  const [committed, commitAction, committing] = useActionState<ActionResult | null, FormData>(
    async (prev, data) => commitAlumniImport(prev, data),
    null,
  );

  /**
   * The dropped file is put into the real `<input type=file>` so the form posts
   * it normally. A `DataTransfer` round-trip is the only way to set that input
   * programmatically, and doing it keeps one code path for dropped and chosen
   * files rather than two.
   */
  function accept(dropped: File | null) {
    if (!dropped) return;
    setFile(dropped);
    if (input.current) {
      const transfer = new DataTransfer();
      transfer.items.add(dropped);
      input.current.files = transfer.files;
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files?.[0] ?? null);
  }

  const ready = preview?.ok ? preview.preview : null;

  return (
    <>
      <form action={previewAction}>
        <div
          className={`drop${dragging ? ' drop--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') input.current?.click();
          }}
        >
          <input
            ref={input}
            name="sheet"
            type="file"
            accept=".xlsx,.csv"
            hidden
            onChange={(e) => accept(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <strong>{file.name}</strong>
              <span className="small muted">{(file.size / 1024).toFixed(0)} KB — click to choose a different one</span>
            </>
          ) : (
            <>
              <strong>Drop a spreadsheet here</strong>
              <span className="small muted">or click to choose · .xlsx or .csv · up to 5 MB</span>
            </>
          )}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" type="submit" disabled={!file || previewing}>
            {previewing ? 'Reading…' : 'Check the file'}
          </button>
          <span className="small muted">Nothing is written until you confirm on the next step.</span>
        </div>

        {preview && !preview.ok && <div className="notice notice--error" style={{ marginTop: 14 }}>{preview.error}</div>}
      </form>

      {ready && (
        <>
          {/* ── What was found ──────────────────────────────────────── */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card__head">
              <h2>What is in the file</h2>
              <span className="small muted">
                Sheet &ldquo;{ready.sheetName}&rdquo;
                {ready.sheetCount > 1 && ` — ${ready.sheetCount} sheets in the file, only the first is read`}
              </span>
            </div>

            <div className="grid" style={{ marginBottom: 18 }}>
              <div className="stat">
                <div className="stat__n" style={{ color: 'var(--good)' }}>{ready.valid.length - ready.duplicates.length}</div>
                <div className="stat__l">Will be added</div>
              </div>
              <div className="stat">
                <div className="stat__n">{ready.duplicates.length}</div>
                <div className="stat__l">Already listed</div>
              </div>
              <div className="stat">
                <div className="stat__n" style={ready.rejected.length ? { color: 'var(--danger)' } : undefined}>
                  {ready.rejected.length}
                </div>
                <div className="stat__l">Rejected</div>
              </div>
              <div className="stat">
                <div className="stat__n" style={ready.withoutLogin ? { color: 'var(--warn)' } : undefined}>
                  {ready.withoutLogin}
                </div>
                <div className="stat__l">No sign-in address</div>
              </div>
            </div>

            <h3 style={{ marginBottom: 8 }}>Columns</h3>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              Check these before committing. A column read as the wrong field is the mistake that is
              hardest to notice afterwards.
            </p>
            <table>
              <thead>
                <tr><th>Field</th><th>Column</th><th>Header in your sheet</th></tr>
              </thead>
              <tbody>
                {ready.mapping.map((entry) => (
                  <tr key={entry.label}>
                    <td className="small">{entry.label}</td>
                    <td className="small mono">{entry.column ?? <span className="muted">—</span>}</td>
                    <td className="small muted">
                      {entry.header ?? <span className="badge badge--warn">not found</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ready.rejected.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Rejected rows</h2></div>
              <p className="small muted" style={{ marginTop: 0 }}>
                These are skipped. Fix them in the sheet and upload again — rows already added are
                recognised and left alone.
              </p>
              <table>
                <thead><tr><th>Row</th><th>Field</th><th>Why</th></tr></thead>
                <tbody>
                  {ready.rejected.slice(0, 40).map((problem, index) => (
                    <tr key={`${problem.rowNumber}-${problem.field}-${index}`}>
                      <td className="mono small">{problem.rowNumber}</td>
                      <td className="small mono muted">{problem.field}</td>
                      <td className="small">{problem.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ready.rejected.length > 40 && (
                <p className="small muted">…and {ready.rejected.length - 40} more.</p>
              )}
            </div>
          )}

          {ready.duplicates.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Already in the directory</h2></div>
              <p className="small muted" style={{ marginTop: 0 }}>
                Matched on the sign-in address. These are skipped rather than duplicated — one address,
                one record. To change an existing record, open it from Alumni records.
              </p>
              <table>
                <thead><tr><th>Row</th><th>In the sheet</th><th>Existing record</th></tr></thead>
                <tbody>
                  {ready.duplicates.slice(0, 40).map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="mono small">{row.rowNumber}</td>
                      <td className="small">{row.name}</td>
                      <td className="small muted">{row.existing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Commit ──────────────────────────────────────────────── */}
          <div className="card">
            <div className="card__head"><h2>Add them</h2></div>

            <form
              action={(data) => {
                // The file goes again — the server kept nothing between the two
                // requests, deliberately.
                if (file) data.set('sheet', file);
                return commitAction(data);
              }}
            >
              <div className="field">
                <label htmlFor="consentNote">Where is the consent for these records?</label>
                <input
                  id="consentNote"
                  name="consentNote"
                  maxLength={500}
                  required
                  placeholder="Responses to the Association's alumni form, 2026"
                />
                <p className="hint">
                  Applied to every row that has no timestamp of its own. Where the sheet carries the
                  form&rsquo;s Timestamp column, that is used instead — it is the better evidence.
                </p>
              </div>

              <div className="field">
                <label htmlFor="grantAccess" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontWeight: 400 }}>
                  <input id="grantAccess" name="grantAccess" type="checkbox" defaultChecked style={{ width: 'auto', marginTop: 3 }} />
                  <span>
                    <strong>Let them sign in.</strong> Adds each address to the allowlist. Without this
                    they appear in the directory but cannot log in. Nobody is emailed either way — use
                    the invitation run for that.
                  </span>
                </label>
              </div>

              <button className="btn" type="submit" disabled={committing || ready.valid.length === ready.duplicates.length}>
                {committing
                  ? 'Adding…'
                  : `Add ${ready.valid.length - ready.duplicates.length} ${ready.valid.length - ready.duplicates.length === 1 ? 'person' : 'people'}`}
              </button>

              {committed && (
                <div
                  className={`notice ${committed.ok ? 'notice--good' : 'notice--error'}`}
                  style={{ marginTop: 14 }}
                >
                  {committed.ok ? committed.message : committed.error}
                </div>
              )}
            </form>
          </div>
        </>
      )}
    </>
  );
}
