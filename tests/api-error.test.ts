import { describe, expect, it } from 'vitest';
import { ApiError, publicApiError, formFieldErrors, userErrorMessage } from '../apps/web/app/utils/api-error.js';
import { csvPreviewInputSchema } from '../packages/contracts/src/index.js';

describe('safe form errors', /** Preserve public error semantics without propagating raw transport failures. */ () => {
  it('explains missing CSV mappings and transport failures without raw diagnostics', /** Local Zod JSON and network exception text must never become alert content. */ () => {
    const result = csvPreviewInputSchema.safeParse({
      content: 'x',
      mapping: { bookingDate: '', amount: '', description: '' },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(userErrorMessage(result.error)).toContain('Buchungsdatum, Betrag und Buchungstext');
    expect(userErrorMessage(new Error('PRIVATE_PAYLOAD'))).not.toContain('PRIVATE');
    expect(publicApiError(undefined, 413).message).toContain('kleineren Zeitraum');
    expect(publicApiError(undefined, 0).message).toContain('Netzwerkverbindung');
    expect(
      publicApiError(
        { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler.', requestId: 'x', details: {} } },
        500,
      ).message,
    ).toContain('später');
  });
  it('retains safe codes, field paths and request identity', /** A rejected HTTP input maps to its actual form control. */ () => {
    const error = publicApiError(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Eingabe prüfen.',
          requestId: 'synthetic',
          details: { fields: [{ path: 'iban', code: 'custom' }] },
        },
      },
      400,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_INPUT', status: 400, requestId: 'synthetic' });
    expect(formFieldErrors(error)).toEqual([{ name: 'iban', message: 'Bitte Eingabe prüfen.' }]);
    expect(publicApiError({ message: 'PRIVATE_DATABASE_DIAGNOSTIC' }, 502).message).not.toContain('PRIVATE');
  });
});
