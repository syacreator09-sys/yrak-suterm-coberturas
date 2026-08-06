import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../../../packages/csv/src/index.js';

describe('CSV', () => {
  it('parses quoted commas and escaped quotes', () => {
    const rows = parseCsv('name,note\r\n"López, Ana","Dijo ""sí"""\r\n');
    expect(rows).toEqual([{ name: 'López, Ana', note: 'Dijo "sí"' }]);
  });

  it('round-trips exported rows', () => {
    const output = toCsv(['name', 'email'], [{ name: 'Ana, López', email: 'ana@example.com' }]);
    expect(parseCsv(output)).toEqual([{ name: 'Ana, López', email: 'ana@example.com' }]);
  });
});
