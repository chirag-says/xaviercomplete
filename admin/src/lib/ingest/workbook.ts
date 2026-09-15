/**
 * Reading the spreadsheet from bytes.
 *
 * COPIED from oxvercity/tools/ingest/workbook.ts to make the admin app
 * self-contained for separate Hostinger hosting.
 */

import ExcelJS from 'exceljs';

export interface Sheet {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
  firstRowNumber: number;
  sheetCount: number;
}

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetReadError';
  }
}

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

export async function readSheetFromBuffer(bytes: Buffer, isCsv = false): Promise<Sheet> {
  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const { Readable } = await import('node:stream');
    await workbook.csv.read(Readable.from(bytes.toString('utf8')));
  } else {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  }

  return extractSheet(workbook);
}

function extractSheet(workbook: ExcelJS.Workbook): Sheet {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new SheetReadError('The file has no worksheets.');

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
