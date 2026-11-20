import { tr } from '../composables/useWorkspaceLocale.js';
import { parse } from 'csv-parse/browser/esm/sync';
import { z } from 'zod';
import { csvEncodingSchema, csvDelimiterSchema, type CsvMapping } from '@financial-tracking/contracts';

/** Supported byte decoding; auto is a local preference, never an API format. */
export type CsvEncoding = z.infer<typeof csvEncodingSchema>;
/** Supported field separator; auto is resolved before the preview request. */
export type CsvDelimiter = z.infer<typeof csvDelimiterSchema>;

/** A safe file diagnostic containing an explanation and a concrete recovery action. */
export class CsvFileError extends Error {}

/** Decode a transient upload without silently replacing invalid characters. */
export function decodeCsv(bytes: Uint8Array, requested: CsvEncoding | 'auto') {
  if (!bytes.length) throw new CsvFileError(tr('Die Datei ist leer. Bitte exportiere die Umsätze erneut als CSV.'));
  let encoding: CsvEncoding = requested === 'auto' ? 'utf-8' : requested;
  if (requested === 'auto') {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        encoding = 'windows-1252';
      }
    }
  }
  let content: string;
  try {
    content = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new CsvFileError(
      tr(
        'Die Datei ist in einem anderen Textformat gespeichert, zum Beispiel Windows-1252 statt UTF-8. Wähle unter „Dateiformat anpassen“ Automatisch oder eine andere Kodierung. Erneutes Auswählen ist nicht nötig.',
      ),
    );
  }
  let binary = content.startsWith('PK\u0003\u0004') || content.startsWith('%PDF-');
  for (let index = 0; index < content.length && !binary; index++) {
    const code = content.charCodeAt(index);
    binary = code < 32 && code !== 9 && code !== 10 && code !== 13;
  }
  if (binary)
    throw new CsvFileError(
      tr(
        'Die Datei enthält kein lesbares CSV-Textformat. Wähle im Online-Banking den CSV-Export statt Excel oder PDF. Bei UTF-16 ohne Erkennungsmarkierung kannst du die Kodierung manuell auswählen.',
      ),
    );
  return { content, encoding };
}

/** Read unique headings with quoted separators intact; never inspect financial values to guess a format. */
export function csvHeaders(content: string, requested: CsvDelimiter | 'auto') {
  const candidates: CsvDelimiter[] = requested === 'auto' ? [';', ',', '\t'] : [requested];
  for (const delimiter of candidates) {
    try {
      const records = parse(content, { delimiter, bom: true, skip_empty_lines: true, to: 1 }) as string[][];
      const headers = records[0]?.map(/** Normalize surrounding export whitespace. */ (value) => value.trim()) ?? [];
      if (headers.length < 2) continue;
      if (
        headers.some(/** Every mapped column needs a name. */ (header) => !header) ||
        new Set(headers).size !== headers.length
      )
        throw new CsvFileError(
          tr(
            'Spaltenüberschriften fehlen oder kommen doppelt vor. Bitte exportiere die Datei mit einer eindeutigen Kopfzeile.',
          ),
        );
      return { headers, delimiter };
    } catch (cause) {
      if (cause instanceof CsvFileError) throw cause;
    }
  }
  throw new CsvFileError(
    tr(
      'Es wurden keine getrennten Spalten erkannt. Prüfe unter „Dateiformat anpassen“ das Trennzeichen (Semikolon, Komma oder Tabulator). Die erste Zeile muss die Spaltennamen enthalten.',
    ),
  );
}

/** Compare common bank headings while retaining the actual source names for mapping. */
function headingKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Suggest columns by heading only; unknown or ambiguous headings remain explicit choices. */
export function suggestCsvMapping(headers: string[]): CsvMapping {
  const aliases: Record<keyof CsvMapping, string[]> = {
    bookingDate: ['Buchungstag', 'Buchungsdatum', 'Datum'],
    amount: ['Betrag', 'Umsatz', 'Betrag (EUR)'],
    description: ['Verwendungszweck', 'Buchungstext', 'Text'],
    descriptionFallback: [],
    valueDate: ['Wertstellung', 'Valutadatum', 'Valuta'],
    counterpartyName: [
      'Beguenstigter/Zahlungspflichtiger',
      'Begünstigter/Zahlungspflichtiger',
      'Gegenpartei',
      'Name Zahlungsbeteiligter',
    ],
    counterpartyIban: ['IBAN Zahlungsbeteiligter', 'Gegenkonto-IBAN', 'IBAN Kontonummer', 'Kontonummer/IBAN'],
    reference: ['Bankreferenz'],
    currency: ['Waehrung', 'Währung'],
  };
  const result: CsvMapping = { bookingDate: '', amount: '', description: '' };
  for (const [key, names] of Object.entries(aliases)) {
    const matches = headers.filter(
      /** Require exactly one actual heading matching the known aliases. */ (header) =>
        names.some(
          /** Normalize labels, never values or identities. */ (name) => headingKey(name) === headingKey(header),
        ),
    );
    if (matches.length === 1) (result as Record<string, string>)[key] = matches[0]!;
    if (key === 'description' && matches.length > 1) {
      const purpose = matches.find(
        /** Prefer payment purpose over the bank's generic booking-type column. */ (heading) =>
          headingKey(heading) === 'verwendungszweck',
      );
      if (purpose) {
        result.description = purpose;
        const alternatives = matches.filter(
          /** Suggest a fallback only when exactly one other recognized text column exists. */ (heading) =>
            heading !== purpose,
        );
        if (alternatives.length === 1) result.descriptionFallback = alternatives[0]!;
      }
    }
  }
  return result;
}
