import { describe, expect, it } from 'vitest';
import { csvPreviewInputSchema, csvEncodingSchema, csvDelimiterSchema } from '../packages/contracts/src/index.js';
import { decodeCsv, csvHeaders, suggestCsvMapping } from '../apps/web/app/utils/csv-file.js';

describe('bank CSV file recovery', /** Exercise real byte decoding and heading parsing before any upload. */ () => {
  it('recovers the reported UTF-8 rejection without losing umlauts or a euro sign', /** Windows-1252 bank bytes must reach preview as intact Unicode. */ () => {
    const bytes = Uint8Array.from(
      Buffer.from('Buchungstag;Betrag;Verwendungszweck\r\n07.11.2026;-1,20;M\xfcller \x80\r\n', 'latin1'),
    );
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toThrow();
    const decoded = decodeCsv(bytes, 'auto');
    expect(decoded.encoding).toBe('windows-1252');
    expect(decoded.content).toContain('Müller €');
    expect(() => decodeCsv(bytes, 'utf-8')).toThrow('anderen Textformat');
    expect(decodeCsv(bytes, 'windows-1252').content).toBe(decoded.content);
  });
  it('handles UTF-8, both UTF-16 BOMs and explicit Latin-9', /** Shared formats cover extra encodings without pretending legacy code pages are distinguishable. */ () => {
    const text = 'Datum;Betrag;Text\n07.11.2026;-1,20;Grüße €\n';
    expect(decodeCsv(new TextEncoder().encode(text), 'auto')).toEqual({ content: text, encoding: 'utf-8' });
    const le = Buffer.from('\ufeff' + text, 'utf16le');
    const be = Buffer.from(le).swap16();
    expect(decodeCsv(le, 'auto')).toEqual({ content: text, encoding: 'utf-16le' });
    expect(decodeCsv(be, 'auto')).toEqual({ content: text, encoding: 'utf-16be' });
    expect(decodeCsv(Uint8Array.from([0xa4]), 'iso-8859-15').content).toBe('€');
    expect(() => decodeCsv(new Uint8Array(), 'auto')).toThrow('leer');
    expect(() => decodeCsv(Uint8Array.from([0x50, 0x4b, 3, 4]), 'auto')).toThrow('CSV-Textformat');
  });
  it('detects quoted separators and leaves ambiguous headings for explicit choice', /** CSV parsing must preserve quoted column names, not split on every punctuation character. */ () => {
    const source = '"Buchungstag","Betrag","Text, Beschreibung"\n07.11.2026,"-1,20",Test';
    expect(csvHeaders(source, 'auto')).toEqual({
      headers: ['Buchungstag', 'Betrag', 'Text, Beschreibung'],
      delimiter: ',',
    });
    expect(csvHeaders('Datum\tBetrag\tText\n07.11.2026\t-1,20\tTest', 'auto').delimiter).toBe('\t');
    expect(() => csvHeaders(source, ';')).toThrow('keine getrennten Spalten');
    expect(() => csvHeaders('Datum;Betrag;Text;Text', 'auto')).toThrow('doppelt');
    expect(
      suggestCsvMapping(['Buchungstag', 'Betrag', 'Verwendungszweck', 'Begünstigter / Zahlungspflichtiger']),
    ).toMatchObject({
      bookingDate: 'Buchungstag',
      amount: 'Betrag',
      description: 'Verwendungszweck',
      counterpartyName: 'Begünstigter / Zahlungspflichtiger',
    });
    expect(suggestCsvMapping(['Datum', 'Buchungstag', 'Betrag', 'Text']).bookingDate).toBe('');
    expect(
      suggestCsvMapping(['Buchungstag', 'Betrag', 'Buchungstext', 'Verwendungszweck', 'Kontonummer/IBAN']),
    ).toMatchObject({ description: 'Verwendungszweck', counterpartyIban: 'Kontonummer/IBAN' });
  });
  it('uses the same additive format enums at browser and API boundaries', /** Existing UTF-8/Windows-1252 requests keep their defaults; new formats remain constrained. */ () => {
    for (const encoding of csvEncodingSchema.options)
      for (const delimiter of csvDelimiterSchema.options)
        expect(
          csvPreviewInputSchema.parse({
            content: 'x',
            mapping: { bookingDate: 'a', amount: 'b', description: 'c' },
            encoding,
            delimiter,
          }),
        ).toMatchObject({ encoding, delimiter, accountId: null });
    expect(
      csvPreviewInputSchema.parse({ content: 'x', mapping: { bookingDate: 'a', amount: 'b', description: 'c' } }),
    ).toMatchObject({ encoding: 'utf-8', delimiter: ';' });
  });
});
