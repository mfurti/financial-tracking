import { describe, expect, it } from 'vitest';
import { germanCents, previewCsv, stableReference } from '../apps/api/src/csv.js';
import { startBank } from '../apps/api/src/bank.js';

const accountId = 'cb3f6dc6-4e89-42b8-9391-7d8d0c348d1a';
const mapping = { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', reference: 'Referenz' };
describe('CSV and bank boundaries', /** Validate sources before financial persistence. */ () => {
  it('parses German cents without precision loss', /** BIGINT cents remain exact. */ () => {
    expect(germanCents('9.223.372.036.854.775,07')).toBe('922337203685477507');
    expect(germanCents('-49,90')).toBe('-4990');
    expect(germanCents('+0,01')).toBe('1');
    for (const amount of ['1,234', '1.23', 'abc', '1e3']) expect(() => germanCents(amount)).toThrow();
  });
  it('keeps identical purchases separate and exposes invalid rows', /** Never collapse equal-looking rows during parsing. */ () => {
    const preview = previewCsv(
      accountId,
      'Datum;Betrag;Text;Referenz\n01.11.2026;-1,20;Brot;NONREF\n01.11.2026;-1,20;Brot;NONREF\n31.02.2026;bad;Fehler;\n',
      ';',
      mapping,
    );
    expect(preview.rows).toHaveLength(2);
    expect(preview.issues).toHaveLength(1);
    expect(preview.rows[0]!.data.identityValue).not.toBe(preview.rows[1]!.data.identityValue);
    expect(stableReference('NOTPROVIDED')).toBeNull();
  });
  it('refuses structural damage and oversized uploads', /** Bad quoting must not silently become data. */ () => {
    expect(() => previewCsv(accountId, 'Datum;Betrag;Text;Referenz\n"broken', ';', mapping)).toThrow();
    expect(() => previewCsv(accountId, 'x'.repeat(10 * 1024 * 1024 + 1), ';', mapping)).toThrow();
  });
  it('fails clearly without bank prerequisites', /** No credentials are sent when configuration is missing. */ () => {
    const product = process.env.FINTS_PRODUCT_ID;
    delete process.env.FINTS_PRODUCT_ID;
    expect(() =>
      startBank(
        { username: 'test', pin: 'secret', bankCode: '69050001', fromDate: '2026-11-01', toDate: '2026-11-06' },
        /** No challenge should be emitted before configuration. */ () => {},
      ),
    ).toThrow('FinTS benötigt');
    if (product) process.env.FINTS_PRODUCT_ID = product;
  });
});
