import { describe, expect, it } from 'vitest';
import { ApiError, publicApiError, formFieldErrors } from '../apps/web/app/utils/api-error.js';

describe('safe form errors', /** Preserve public error semantics without propagating raw transport failures. */ () => {
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
