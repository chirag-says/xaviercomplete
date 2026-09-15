/**
 * Reading the spreadsheet off disk.
 *
 * The file is opened by this Node process, from the path given on the command
 * line. It is not uploaded, not copied, not written to a temp file, and does
 * not travel over HTTP — not even to localhost. See the note in run.ts about
 * why this is a path argument rather than a browser drop zone.
 *
 * exceljs rather than SheetJS: SheetJS's free distribution has a history of
 * prototype-pollution CVEs and an awkward npm story, and this parser is pointed
 * at a file full of five hundred people's phone numbers.
 */

import ExcelJS from 'exceljs';

export interface Sheet {
  sheetName: string;
  headers: string[];
  /** Data rows, zero-indexed to match `headers`. The header row is not included. */
  rows: unknown[][];
  /** Sheet row number of `rows[0]`, so errors can point at what Excel shows. */
  firstRowNumber: number;
  /** How many worksheets the file had. Only the first is read. */
  sheetCount: number;
}

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetReadError';
  }
}

/**
 * exceljs returns 1-indexed row arrays with a leading hole, and omits trailing
 * empty cells entirely. Both would silently shift or truncate a column, so
 * every row is squared off to the header width here rather than at the call site.
 */
function squareOff(values: unknown, width: number): unknown[] {
  const source = Array.isArray(values) ? values.slice(1) : [];
  const out = new Array<unknown>(width).fill(null);
  for (let i = 0; i < width; i++) out[i] = source[i] ?? null;
  return out;
}

export async function readSheet(filePath: string): Promise<Sheet> {
  const workbook = new ExcelJS.Workbook();

  if (filePath.toLowerCase().endsWith('.csv')) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  return extractSheet(workbook);
}

/**
 * The same parse, from bytes already in memory.
 *
 * Used by the admin portal's upload, where the file arrives over HTTP and must
 * never be written to disk. `readSheet` above reads from a path because the
 * local tool has one; both end up in `extractSheet`, so there is a single
 * understanding of what row 1 means and how a ragged row is squared off.
 */
export async function readSheetFromBuffer(bytes: Buffer, isCsv = false): Promise<Sheet> {
  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const { Readable } = await import('node:stream');
    await workbook.csv.read(Readable.from(bytes.toString('utf8')));
  } else {
    // ExcelJS's types want the DOM ArrayBuffer shape; a Node Buffer is a view
    // over one and works at runtime. The cast is the narrowest way to say so.
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  }

  return extractSheet(workbook);
}

function extractSheet(workbook: ExcelJS.Workbook): Sheet {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new SheetReadError('The file has no worksheets.');
  // Which sheet was read is reported back on `Sheet` rather than written to
  // stderr: the portal has no terminal to write it to, and the operator there
  // needs to see it on screen.

  const headerRow = worksheet.getRow(1);
  const headers = squareOff(headerRow.values, headerRow.cellCount).map((cell) =>
    cell === null || cell === undefined ? '' : String(cell).trim(),
  );

  if (headers.every((header) => header === '')) {
    throw new SheetReadError('Row 1 is empty; the first row must be the header row.');
  }

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push(squareOff(row.values, headers.length));
  });

  return { sheetName: worksheet.name, headers, rows, firstRowNumber: 2, sheetCount: workbook.worksheets.length };
}
