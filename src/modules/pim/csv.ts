export type CsvImportRow = Readonly<Record<string, string>>;

const MAX_COLUMNS = 80;
const MAX_CELL_LENGTH = 20_000;

function normalizeCell(value: string): string {
  if (value.length > MAX_CELL_LENGTH) throw new Error('CSV_CELL_TOO_LARGE');
  return value.trim();
}

/**
 * Parses a bounded RFC-4180-style CSV payload without evaluating spreadsheet
 * formulas. Parsed cells remain plain text and are subsequently validated by
 * the server-side PIM import contract.
 */
export function parsePimCsv(text: string, maxRows = 500): readonly CsvImportRow[] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    const next = source[index + 1] ?? '';
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      if (cell.length !== 0) throw new Error('CSV_INVALID_QUOTE');
      quoted = true;
      continue;
    }
    if (character === ',') {
      row.push(normalizeCell(cell));
      cell = '';
      continue;
    }
    if (character === '\r' || character === '\n') {
      if (character === '\r' && next === '\n') index += 1;
      row.push(normalizeCell(cell));
      cell = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (rows.length > maxRows + 1) throw new Error('CSV_ROW_LIMIT_EXCEEDED');
      continue;
    }
    cell += character;
  }

  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  row.push(normalizeCell(cell));
  if (row.some((value) => value.length > 0)) rows.push(row);
  if (rows.length === 0) return [];

  const header = rows.shift() ?? [];
  if (header.length === 0 || header.length > MAX_COLUMNS) throw new Error('CSV_INVALID_HEADER');
  const keys = header.map((value) => value.trim());
  if (keys.some((key) => key.length === 0) || new Set(keys).size !== keys.length) throw new Error('CSV_INVALID_HEADER');
  if (rows.length > maxRows) throw new Error('CSV_ROW_LIMIT_EXCEEDED');

  return rows.map((values) => {
    if (values.length !== keys.length) throw new Error('CSV_COLUMN_COUNT_MISMATCH');
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? '']));
  });
}
