import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventEmitter } from 'node:events';
import { bankSetup, startBank } from '../apps/api/src/bank.js';

const state = vi.hoisted(
  /** Hold only the synthetic worker seam, never real credentials. */ () => ({ worker: null as unknown }),
);
vi.mock(
  'node:worker_threads',
  /** Replace only process ownership; the production wrapper still validates every message. */ async () => {
    const { EventEmitter } = await import('node:events');
    class SyntheticWorker extends EventEmitter {
      stdout = { resume: vi.fn() };
      stderr = { resume: vi.fn() };
      terminate = vi.fn(/** Model successful process destruction. */ async () => 0);
      postMessage = vi.fn();
      /** Capture the synthetic process for event and lifetime assertions. */
      constructor() {
        super();
        state.worker = this;
      }
    }
    return { Worker: SyntheticWorker };
  },
);

/** Access only the public event/process surface implemented by the synthetic worker. */
function worker() {
  return state.worker as EventEmitter & {
    terminate: ReturnType<typeof vi.fn>;
    stdout: { resume: ReturnType<typeof vi.fn> };
    stderr: { resume: ReturnType<typeof vi.fn> };
  };
}
/** Build synthetic transient input without using a real bank endpoint or PIN. */
function input() {
  return {
    username: 'synthetic',
    pin: 'CANARY_PIN_WORKER_9f32',
    bankCode: '69050001',
    fromDate: '2026-11-01',
    toDate: '2026-11-02',
  };
}

describe('worker ownership and safe output', /** Test disposal, deadlines and output validation without outbound requests. */ () => {
  beforeEach(
    /** Configure only the fake worker transport. */ () => {
      vi.stubEnv('FINTS_PRODUCT_ID', 'synthetic-product');
      vi.stubEnv('FINTS_BANK_URL', 'https://bank.invalid/fints30');
    },
  );
  afterEach(
    /** Restore environment and timer state after each synthetic process. */ () => {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    },
  );
  it('reports actionable setup without leaking configured values', /** Missing or invalid endpoint configuration is not an attempted bank login. */ () => {
    expect(bankSetup({})).toEqual({
      configured: false,
      bankCode: '69050001',
      missing: ['PRODUCT_ID', 'BANK_ENDPOINT'],
    });
    expect(bankSetup({ FINTS_PRODUCT_ID: 'private', FINTS_BANK_URL: 'http://bank.invalid' }).configured).toBe(false);
    expect(
      bankSetup({ FINTS_PRODUCT_ID: 'private', FINTS_BANK_URL: 'https://user:password@bank.invalid' }).configured,
    ).toBe(false);
    expect(bankSetup({ FINTS_PRODUCT_ID: 'private', FINTS_BANK_URL: 'https://bank.invalid' })).toEqual({
      configured: true,
      bankCode: '69050001',
      missing: [],
    });
  });
  it('drains decoder streams and destroys a completed worker', /** Raw decoder output must never be forwarded to application logs. */ async () => {
    const connector = startBank(input(), vi.fn());
    expect(worker().stdout.resume).toHaveBeenCalledOnce();
    expect(worker().stderr.resume).toHaveBeenCalledOnce();
    worker().emit('message', { kind: 'done', data: { accounts: [], failedAccounts: 0, metadata: {} } });
    expect(await connector.result).toMatchObject({ metadata: {} });
    await Promise.resolve();
    expect(worker().terminate).toHaveBeenCalled();
  });
  it('rejects raw protocol metadata and sanitizes unexpected worker errors', /** Neither a malformed success nor an exception can publish credentials. */ async () => {
    const connector = startBank(input(), vi.fn());
    const rejected = expect(connector.result).rejects.toMatchObject({ code: 'BANK_INVALID_RESPONSE' });
    worker().emit('message', {
      kind: 'done',
      data: { accounts: [], failedAccounts: 0, metadata: { pin: input().pin } },
    });
    await rejected;
    const next = startBank(input(), vi.fn());
    const failure = expect(next.result).rejects.toMatchObject({
      code: 'BANK_UNAVAILABLE',
      message: 'Bankabruf fehlgeschlagen.',
    });
    worker().emit('error', new Error(input().pin));
    await failure;
  });
  it('expires after ten minutes and terminates cancellation immediately', /** A pending dialog cannot retain credentials without a bounded owner. */ async () => {
    vi.useFakeTimers();
    const connector = startBank(input(), vi.fn());
    const expired = expect(connector.result).rejects.toMatchObject({ code: 'BANK_AUTH_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(600_000);
    await expired;
    expect(worker().terminate).toHaveBeenCalled();
    const next = startBank(input(), vi.fn());
    const cancelled = expect(next.result).rejects.toMatchObject({ code: 'SYNC_CANCELLED' });
    await next.cancel();
    await cancelled;
    expect(worker().terminate).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
