import { describe, expect, it } from 'vitest';
import { csvCell, recordsToCsv } from './csv-export.js';

describe('CSV export hardening', () => {
  it('neutralizes spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("https://example.test")')).toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(csvCell('-10')).toBe("'-10");
  });

  it('escapes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('builds a deterministic header and rows', () => {
    expect(recordsToCsv([{ name: 'Ana', status: 'ACTIVE' }])).toBe('name,status\nAna,ACTIVE');
  });
});
