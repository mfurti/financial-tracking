import { describe, expect, it } from 'vitest';
import { displayMoney, displayDate, displayTimestamp } from '../apps/web/app/utils/financial-display.js';
import { de } from '../apps/web/app/locales/de.js';
import { en } from '../apps/web/app/locales/en.js';
import { restoreWorkspaceDisplay, tr, translatedSchema } from '../apps/web/app/composables/useWorkspaceLocale.js';
import { ibanSchema, workspaceProfileInputSchema } from '../packages/contracts/src/index.js';
import { suggestCsvMapping } from '../apps/web/app/utils/csv-file.js';
import { contractKinds, contractKindOptions } from '../apps/web/app/utils/contract-presentation.js';
import { analysisModuleLabels } from '../apps/web/app/utils/analysis-modules.js';
import { publicApiError } from '../apps/web/app/utils/api-error.js';
import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

describe('localized exact financial display', /** Keep display choices separate from financial calculations and persisted payloads. */ () => {
  it('formats arbitrary signed integer cents without floating conversion', /** BIGINT values beyond Number safety preserve every digit and minor unit. */ () => {
    expect(displayMoney('-900719925474099312345', 'de', false)).toBe('−9.007.199.254.740.993.123,45 €');
    expect(displayMoney('-900719925474099312345', 'en', false)).toBe('−€9,007,199,254,740,993,123.45');
    expect(displayMoney('0', 'en', false)).toBe('€0.00');
    expect(displayMoney('1', 'de', false)).toBe('0,01 €');
  });
  it('masks before formatting and validates dates without timezone shifts', /** Masked labels contain neither numeric amounts nor hidden formatted source values. */ () => {
    expect(displayMoney('900719925474099312345', 'en', true)).toBe('Amount hidden');
    expect(displayMoney('-1', 'de', true)).toBe('Betrag ausgeblendet');
    expect(displayDate('2024-02-29', 'de')).toBe('29.02.2024');
    expect(displayDate('2024-02-29', 'en')).toBe('29/02/2024');
    expect(displayDate('2023-02-29', 'en')).toBe('—');
    expect(displayTimestamp('2026-11-19T23:30:00Z', 'en')).toContain('20/11/2026');
  });
  it('keeps translated message keys and interpolation tokens identical', /** English cannot silently fall back to untranslated German for a delivered message. */ () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      expect(en[key].trim()).not.toBe('');
      expect(en[key].match(/\{\d+\}/g)?.sort() ?? []).toEqual(de[key].match(/\{\d+\}/g)?.sort() ?? []);
    }
  });
  it('translates cached labels while preserving source values and CSV mappings', /** Changing language cannot rewrite German bank headings or canonical category/contract identities. */ () => {
    restoreWorkspaceDisplay('en', false);
    try {
      expect(contractKinds.RENT.label).toBe('Rent');
      expect(
        contractKindOptions.find(/** Match the unchanged transport identity. */ (item) => item.value === 'RENT')?.label,
      ).toBe('Rent');
      expect(analysisModuleLabels.months).toBe('Monthly comparison');
      expect(tr('{0} Buchungen', [7])).toBe('7 transactions');
      expect(tr('Imported source {0}')).toBe('Imported source {0}');
      expect(
        publicApiError(
          {
            error: {
              code: 'GROUP_NAME_EXISTS',
              message: 'Eine Kontogruppe mit diesem Namen existiert bereits.',
              requestId: 'display-test',
              details: {},
            },
          },
          409,
        ).message,
      ).toBe('An account group with this name already exists.');
      expect(suggestCsvMapping(['Buchungsdatum', 'Betrag', 'Buchungstext'])).toMatchObject({
        bookingDate: 'Buchungsdatum',
        amount: 'Betrag',
        description: 'Buchungstext',
      });
      restoreWorkspaceDisplay('de', true);
      expect(contractKinds.RENT.label).toBe('Miete');
    } finally {
      restoreWorkspaceDisplay('de', false);
    }
  });
  it('provides both translations for every source-owned literal message', /** A new delivered UI message cannot silently become German-only through the safe unknown-source fallback. */ () => {
    const missing: string[] = [];
    for (const file of globSync('apps/web/app/**/*.{ts,vue}')) {
      if (file.includes('locales')) continue;
      const source = readFileSync(file, 'utf8').replaceAll('&quot;', '"');
      for (const match of source.matchAll(/\btr\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) {
        const ast = ts.createSourceFile('message.ts', `const message = ${match[1]};`, ts.ScriptTarget.Latest, true);
        const statement = ast.statements[0];
        if (!statement || !ts.isVariableStatement(statement)) throw new Error('Unparseable message literal');
        const value = statement.declarationList.declarations[0]?.initializer;
        if (!value || !ts.isStringLiteral(value)) throw new Error('Invalid message literal');
        const key = value.text.replace(/\s+/g, ' ').trim();
        if (!Object.hasOwn(de, key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('translates explicit refinements without changing validation or successful transforms', /** Standard Schema adaptation preserves the shared parser result and field paths exactly. */ async () => {
    restoreWorkspaceDisplay('en', false);
    try {
      const invalid = await translatedSchema(ibanSchema)['~standard'].validate('DE00370400440532013000');
      expect(invalid.issues?.[0]?.message).toBe('Please enter a valid German IBAN.');
      const input = { displayName: '  Exact owner  ', contactEmail: null };
      const valid = await translatedSchema(workspaceProfileInputSchema)['~standard'].validate(input);
      expect(valid).toEqual({ value: workspaceProfileInputSchema.parse(input) });
      const blank = await translatedSchema(workspaceProfileInputSchema)['~standard'].validate({ displayName: ' ' });
      expect(blank.issues?.[0]?.path).toEqual(['displayName']);
    } finally {
      restoreWorkspaceDisplay('de', false);
    }
  });
});
