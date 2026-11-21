import { computed, shallowRef } from 'vue';
import type { z } from 'zod';
import { de } from '../locales/de.js';
import { en } from '../locales/en.js';
import type { WorkspaceLanguage } from '../utils/financial-display.js';

/** Browser display state contains choices only; the client plugin restores it before any page renders. */
const display = shallowRef<{ language: WorkspaceLanguage; masked: boolean }>({ language: 'de', masked: false });

/** Synchronize display choices without retaining any financial payload or persistent owner identity. */
export function restoreWorkspaceDisplay(language: WorkspaceLanguage, masked: boolean) {
  display.value = { language, masked };
}

/** Expose the validated BCP-47 locale to built-in date/number controls. */
export function displayLocale(): 'de-DE' | 'en-GB' {
  return display.value.language === 'en' ? 'en-GB' : 'de-DE';
}

/** Read the reactive mask before constructing text, chart data or accessible labels. */
export function amountsMasked(): boolean {
  return display.value.masked;
}

/** Format an already calculated display percentage; it never accepts monetary cents or stores a source value. */
export function financialPercentage(value: number, options: Intl.NumberFormatOptions = {}): string {
  return amountsMasked() ? tr('Betrag ausgeblendet') : value.toLocaleString(displayLocale(), options);
}

/** Translate source-owned copy only; parameter values and imported financial labels stay unchanged. */
export function tr(message: string, parameters: readonly unknown[] = []): string {
  const key = message.replace(/\s+/g, ' ').trim() as keyof typeof de;
  const dictionary = display.value.language === 'en' ? en : de;
  if (!Object.hasOwn(dictionary, key)) return message;
  const pattern: string = dictionary[key];
  return pattern.replace(
    /\{(\d+)\}/g,
    /** Substitute source parameters without interpreting markup or nested messages. */ (_token, index: string) =>
      String(parameters[Number(index)] ?? ''),
  );
}

/** Adapt only Standard Schema issue wording; validation, field paths and successful transformed values stay shared. */
export function translatedSchema<T extends z.ZodType>(schema: T) {
  const standard = schema['~standard'];
  return {
    '~standard': {
      ...standard,
      /** Translate explicit shared-schema refinements as well as ordinary locale-configured Zod errors. */ async validate(
        value: unknown,
      ) {
        const result = await standard.validate(value);
        return result.issues
          ? {
              issues: result.issues.map(
                /** Retain the exact field association without exposing submitted input. */ (issue) => ({
                  ...issue,
                  message: tr(issue.message),
                }),
              ),
            }
          : result;
      },
    },
  };
}

/** Share validated locale/privacy choices with settings and all formatting consumers. */
export function useWorkspaceLocale() {
  return {
    language: computed(/** Keep the language reactive without storing amounts. */ () => display.value.language),
    tr,
    displayLocale,
    amountsMasked,
  };
}
