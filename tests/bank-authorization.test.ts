import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeBank,
  libraryCents,
  type AuthorizationContext,
  type BankResponse as ClientResponse,
} from '../apps/api/src/bank-authorization.js';

/** Build only public bank response fields used by the production authorization driver. */
function response(fields: Partial<ClientResponse> = {}): ClientResponse {
  return { success: true, requiresTan: false, bankAnswers: [], ...fields } as ClientResponse;
}
/** Provide an in-memory worker interaction while retaining the real authorization state machine. */
function context(): AuthorizationContext {
  return {
    config: { selectedTanMethod: undefined },
    pin: 'SYNTHETIC_PRIVATE_PIN',
    answer: vi.fn(/** Return a transient synthetic TAN. */ async () => ({ tan: 'synthetic-tan' })),
    challenge: vi.fn(),
    running: vi.fn(),
  };
}

describe('bank authorization boundary', /** Deterministic driver proof without bank traffic or production credentials. */ () => {
  afterEach(/** Restore wall time even when a bank-limit assertion fails. */ () => vi.useRealTimers());
  it('continues a TAN dialog and never retries a rejected PIN', /** Only an explicit pending challenge permits continuation. */ async () => {
    const interaction = context(),
      continuation = vi.fn(/** Finish the challenged operation. */ async () => response());
    await authorizeBank(
      /** Request one TAN. */ async () =>
        response({ requiresTan: true, tanReference: 'reference', tanChallenge: interaction.pin }),
      continuation,
      interaction,
    );
    expect(continuation).toHaveBeenCalledWith('reference', 'synthetic-tan');
    expect(interaction.challenge).toHaveBeenCalledWith({ type: 'TAN', message: '[geschützt]' });
    const initial = vi.fn(
      /** Model a bank login refusal without exposing its message. */ async () =>
        response({ success: false, bankAnswers: [{ code: 9930 }] as ClientResponse['bankAnswers'] }),
    );
    await expect(authorizeBank(initial, continuation, interaction)).rejects.toThrow('BANK_INVALID_CREDENTIALS');
    expect(initial).toHaveBeenCalledTimes(1);
    expect(continuation).toHaveBeenCalledTimes(1);
  });
  it('honors decoupled first/between waits and the maximum number of bank polls', /** Browser clicks cannot bypass bank-provided pacing. */ async () => {
    vi.useFakeTimers();
    const interaction = context();
    interaction.config = {
      selectedTanMethod: {
        isDecoupled: true,
        decoupled: {
          waitingSecondsBeforeFirstStatusRequest: 4,
          waitingSecondsBetweenStatusRequests: 7,
          maxStatusRequests: 2,
        },
      } as NonNullable<AuthorizationContext['config']['selectedTanMethod']>,
    };
    const pending = response({ requiresTan: true, tanReference: 'pending' });
    const continuation = vi.fn(/** Keep the app approval pending. */ async () => pending);
    const job = authorizeBank(
      /** Begin a decoupled app authorization. */ async () => pending,
      continuation,
      interaction,
    );
    const result = expect(job).rejects.toThrow('BANK_AUTH_REJECTED');
    await vi.advanceTimersByTimeAsync(3999);
    expect(continuation).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(continuation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6999);
    expect(continuation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(continuation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(7000);
    await result;
    expect(continuation).toHaveBeenCalledTimes(2);
  });
  it('rejects unsupported challenge formats and unsafe cent conversion', /** Unsupported rendering never becomes a successful read. */ async () => {
    const interaction = context();
    await expect(
      authorizeBank(
        /** A photo challenge needs an unsupported renderer. */ async () =>
          response({ requiresTan: true, tanReference: 'photo', tanChallengeHhdUc: 'data' }),
        /** No continuation is allowed. */ async () => response(),
        interaction,
      ),
    ).rejects.toThrow('BANK_UNSUPPORTED');
    expect(libraryCents(-49.9)).toBe('-4990');
    expect(libraryCents(0.01)).toBe('1');
    for (const value of [NaN, Infinity, Number.MAX_SAFE_INTEGER, 0.001])
      expect(() => libraryCents(value)).toThrow('BANK_INVALID_RESPONSE');
  });
});
