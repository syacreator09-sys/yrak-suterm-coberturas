export type CsvRow = Record<string, string>;

function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index] ?? '';
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV con comillas sin cerrar');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((current) => current.some((value) => value.trim().length > 0));
}

export function parseCsv(input: string): CsvRow[] {
  const rows = parseRows(input.replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map((header) => header.trim());
  if (!headers || headers.length === 0) return [];
  if (new Set(headers).size !== headers.length) throw new Error('CSV con encabezados duplicados');
  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `La fila ${rowIndex + 2} tiene ${values.length} columnas; se esperaban ${headers.length}`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function quote(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly Record<string, unknown>[],
): string {
  const lines = [headers.map(quote).join(',')];
  for (const row of rows) lines.push(headers.map((header) => quote(row[header])).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
