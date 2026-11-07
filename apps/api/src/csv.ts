import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { centsSchema, csvMappingSchema, dateSchema } from '@financial-tracking/contracts';
import { AppError } from './errors.js';

export const normalizedSchema = z.object({
  accountId: z.uuid().nullable(),
  amountCents: centsSchema,
  currency: z.literal('EUR'),
  bookingDate: dateSchema,
  valueDate: dateSchema.nullable(),
  description: z.string().trim().min(1).max(4000),
  counterpartyName: z.string().max(300).nullable(),
  counterpartyIban: z.string().max(34).nullable(),
  status: z.enum(['BOOKED', 'PENDING']),
  identityType: z.string().max(50),
  identityValue: z.string().max(500),
  reference: z.string().max(300).nullable(),
});
/** Common validated record shared by CSV and FinTS imports. */
export type NormalizedRow = z.infer<typeof normalizedSchema>;

/** Parse German money exactly without floating point arithmetic. */
export function germanCents(input: string) {
  const value = input.trim().replace(/\s|€/g, '');
  if (!/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value))
    throw new AppError('INVALID_AMOUNT', 'Ungültiger Betrag.');
  const sign = value.startsWith('-') ? -1n : 1n;
  const [whole, fraction = ''] = value.replace(/^[+-]/, '').replaceAll('.', '').split(',');
  return centsSchema.parse(String(sign * (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')))));
}

/** Normalize a supported calendar date and reject impossible dates. */
export function csvDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  return dateSchema.parse(match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim());
}

/** Ignore placeholder references that cannot identify a bank transaction. */
export function stableReference(value?: string | null) {
  const reference = value?.trim();
  return reference && !/^(NONREF|NOTPROVIDED|NOT PROVIDED|N\/A|0+)$/i.test(reference) ? reference : null;
}

/** Parse bounded Sparkasse CSV with explicit column mapping. */
export function previewCsv(
  accountId: string | null,
  content: string,
  delimiter: ';' | ',',
  mapping: z.infer<typeof csvMappingSchema>,
) {
  if (Buffer.byteLength(content, 'utf8') > 10 * 1024 * 1024)
    throw new AppError('CSV_TOO_LARGE', 'Datei überschreitet 10 MiB.', 413);
  let records: string[][];
  try {
    records = parse(content, { delimiter, bom: true, skip_empty_lines: true, max_record_size: 100_000 }) as string[][];
  } catch {
    throw new AppError('CSV_STRUCTURE', 'CSV-Struktur ungültig. Trennzeichen und Anführungszeichen prüfen.');
  }
  const headers = records.shift()?.map(/** Normalize header whitespace. */ (value) => value.trim()) ?? [];
  if (!headers.length || new Set(headers).size !== headers.length || !records.length)
    throw new AppError('CSV_STRUCTURE', 'Kopfzeile oder Daten fehlen; Spaltennamen müssen eindeutig sein.');
  if (records.length > 50_000) throw new AppError('CSV_TOO_MANY_ROWS', 'Maximal 50.000 Datenzeilen.', 413);
  for (const name of Object.values(mapping))
    if (name && !headers.includes(name)) throw new AppError('CSV_MAPPING', 'Zugeordnete Spalte fehlt.');
  const fileHash = createHash('sha256').update(content).digest('hex');
  const rows: { rowNumber: number; data: NormalizedRow }[] = [];
  const issues: { rowNumber: number; code: string; message: string }[] = [];
  for (const [index, row] of records.entries()) {
    try {
      if (row.length !== headers.length) throw new Error('Column count');
      /** Resolve a mapped field without assuming optional columns exist. */
      const field = (key: keyof typeof mapping) =>
        mapping[key] ? (row[headers.indexOf(mapping[key]!)]?.trim() ?? '') : '';
      const reference = stableReference(field('reference'));
      const data = normalizedSchema.parse({
        accountId,
        amountCents: germanCents(field('amount')),
        currency: field('currency') || 'EUR',
        bookingDate: csvDate(field('bookingDate')),
        valueDate: field('valueDate') ? csvDate(field('valueDate')) : null,
        description: field('description'),
        counterpartyName: field('counterpartyName') || null,
        counterpartyIban: field('counterpartyIban') || null,
        status: 'BOOKED',
        identityType: reference ? 'BANK_REFERENCE' : 'CSV_ROW',
        identityValue:
          reference ?? `${fileHash}:${index + 2}:${createHash('sha256').update(JSON.stringify(row)).digest('hex')}`,
        reference,
      });
      rows.push({ rowNumber: index + 2, data });
    } catch {
      issues.push({
        rowNumber: index + 2,
        code: 'CSV_INVALID_ROW',
        message: 'Zeile prüfen: Spalten, Datum, EUR-Betrag oder Buchungstext ungültig.',
      });
    }
  }
  return { headers, rows, issues, totalRows: records.length };
}
