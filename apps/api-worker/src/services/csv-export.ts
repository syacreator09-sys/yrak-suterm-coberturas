function neutralizeSpreadsheetFormula(text: string): string {
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  const safe = neutralizeSpreadsheetFormula(raw);
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function recordsToCsv(rows: readonly Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]!);
  return [
    keys.map(csvCell).join(','),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(',')),
  ].join('\n');
}
