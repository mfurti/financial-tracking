import { describe, expect, it } from 'vitest';
import { csvDate, germanCents, previewCsv, stableReference } from '../apps/api/src/csv.js';
import { startBank } from '../apps/api/src/bank.js';

const accountId = 'cb3f6dc6-4e89-42b8-9391-7d8d0c348d1a';
const mapping = { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', reference: 'Referenz' };
describe('CSV and bank boundaries', /** Validate sources before financial persistence. */ () => {
  it('uses only an explicitly mapped text fallback and preserves row identities on reimport', /** Empty purposes may use source booking text, while wholly empty rows remain actionable issues. */ () => {
    const content =
      'Datum;Betrag;Zweck;Banktext\n01.11.2026;-1,00;Miete;Dauerauftrag\n02.11.2026;-2,00; ;Kartenzahlung\n03.11.2026;-3,00; ; \n';
    const explicit = { bookingDate: 'Datum', amount: 'Betrag', description: 'Zweck', descriptionFallback: 'Banktext' };
    const result = previewCsv(null, content, ';', explicit);
    expect(
      result.rows.map(
        /** Compare normalized source text without inventing a replacement. */ (row) => row.data.description,
      ),
    ).toEqual(['Miete', 'Kartenzahlung']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.rowNumber).toBe(4);
    expect(result.totalRows).toBe(3);
    expect(previewCsv(null, content, ';', explicit)).toEqual(result);
    expect(previewCsv(null, content, ';', { ...explicit, descriptionFallback: undefined }).rows).toHaveLength(1);
    expect(
      previewCsv(null, content, ';', { ...explicit, description: 'Banktext', descriptionFallback: 'Zweck' }).rows[0]
        ?.data.description,
    ).toBe('Dauerauftrag');
    expect(
      /** Unknown fallback headings must fail before reading any rows. */ () =>
        previewCsv(null, content, ';', { ...explicit, descriptionFallback: 'Missing' }),
    ).toThrow('Zugeordnete Spalte fehlt');
  });
  it('normalizes short Sparkasse years with strict calendar and explicit century boundaries', /** Modern short years do not depend on the machine date or an implicit pivot. */ () => {
    for (const [input, expected] of [
      ['07.11.26', '2026-11-07'],
      ['29.02.00', '2000-02-29'],
      ['31.12.99', '2099-12-31'],
      ['01.01.1970', '1970-01-01'],
      ['2026-11-07', '2026-11-07'],
    ])
      expect(csvDate(input!)).toBe(expected);
    for (const invalid of [
      '29.02.26',
      '29.02.1900',
      '29.02.2100',
      '31.04.26',
      '07.13.26',
      '00.11.26',
      '07.11.6',
      '07.11.026',
    ])
      expect(/** Reject impossible dates without altering import identity. */ () => csvDate(invalid)).toThrow();
    const parsed = previewCsv(
      null,
      'Datum;Wertstellung;Betrag;Text\n07.11.26;06.11.26;-12,34;Beispiel\n29.02.26;;-1,00;Ungültig\n',
      ';',
      { bookingDate: 'Datum', valueDate: 'Wertstellung', amount: 'Betrag', description: 'Text' },
    );
    expect(parsed.rows[0]!.data).toMatchObject({
      bookingDate: '2026-11-07',
      valueDate: '2026-11-06',
      amountCents: '-1234',
    });
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]!.code).toBe('CSV_INVALID_ROW');
  });
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
  it('reports actionable row-specific problems without echoing source values', /** Partial import diagnostics distinguish formatting from missing columns and remain safe. */ () => {
    const result = previewCsv(
      null,
      'Datum;Betrag;Text;Währung\n31.02.2026;-1,20;PRIVATE_DATE;EUR\n07.11.2026;bad;PRIVATE_AMOUNT;EUR\n07.11.2026;-1,20;;EUR\n07.11.2026;-1,20;PRIVATE_CURRENCY;USD\n07.11.2026;-1,20;PRIVATE_COLUMNS\n07.11.2026;-1,20;Gültig;EUR\n',
      ';',
      { bookingDate: 'Datum', amount: 'Betrag', description: 'Text', currency: 'Währung' },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.issues.map(/** Retain the existing partial-consent classification. */ (issue) => issue.code)).toEqual(
      Array(5).fill('CSV_INVALID_ROW'),
    );
    expect(result.issues[0]!.message).toContain('Buchungsdatum');
    expect(result.issues[1]!.message).toContain('-49,90');
    expect(result.issues[2]!.message).toContain('Buchungstext fehlt');
    expect(result.issues[3]!.message).toContain('nur EUR');
    expect(result.issues[4]!.message).toContain('Anzahl der Spalten');
    expect(JSON.stringify(result.issues)).not.toContain('PRIVATE_');
    expect(
      result.issues.map(/** Preserve source row numbers through partial parsing. */ (issue) => issue.rowNumber),
    ).toEqual([2, 3, 4, 5, 6]);
    expect(
      previewCsv(null, 'Datum\tBetrag\tText\n07.11.2026\t-1,20\tTest', '\t', {
        bookingDate: 'Datum',
        amount: 'Betrag',
        description: 'Text',
      }).rows[0]!.data.amountCents,
    ).toBe('-120');
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
