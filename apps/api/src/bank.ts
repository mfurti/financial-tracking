import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import { AppError } from './errors.js';
import { normalizedSchema } from './csv.js';

export const bankBundleSchema = z.object({
  accounts: z.array(
    z.object({
      reference: z.string(),
      name: z.string(),
      iban: z.string().nullable(),
      balanceCents: z.string(),
      observedAt: z.string(),
      rows: z.array(normalizedSchema.omit({ accountId: true })),
    }),
  ),
  failedAccounts: z.number().int(),
  metadata: z.record(z.string(), z.unknown()),
});
export const bankChallengeSchema = z.object({
  type: z.enum(['TAN', 'APP_APPROVAL', 'SELECT_METHOD']),
  message: z.string().max(1000),
  methods: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
});
/** Credential-free data returned by the isolated bank adapter. */
export type BankBundle = z.infer<typeof bankBundleSchema>;
/** Public instructions for a transient bank challenge. */
export type BankChallenge = z.infer<typeof bankChallengeSchema>;
/** A running adapter; secrets are confined to its worker. */
export interface BankConnector {
  result: Promise<BankBundle>;
  continue(input: { tan?: string; tanMethodId?: number; tanMediaName?: string }): void;
  cancel(): Promise<void>;
}
/** Credentials exist only in memory while constructing the worker. */
export interface BankInput {
  username: string;
  pin: string;
  bankCode: string;
  fromDate: string;
  toDate: string;
  metadata?: unknown;
  tanMethodId?: number;
  tanMediaName?: string;
}

/** Isolate lib-fints because its decoder writes raw responses to stderr on failure. */
export function startBank(input: BankInput, onChallenge: (challenge: BankChallenge | null) => void): BankConnector {
  if (!process.env.FINTS_PRODUCT_ID || !process.env.FINTS_BANK_URL)
    throw new AppError(
      'BANK_NOT_CONFIGURED',
      'FinTS benötigt registrierte Produkt-ID und bestätigten Bankendpunkt.',
      409,
    );
  const endpoint = new URL(process.env.FINTS_BANK_URL);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || input.bankCode !== '69050001')
    throw new AppError(
      'BANK_UNSUPPORTED',
      'Nur der konfigurierte HTTPS-Endpunkt der Sparkasse Bodensee ist freigegeben.',
    );
  const worker = new Worker(new URL('./bank-worker.js', import.meta.url), {
    workerData: { ...input, endpoint: endpoint.href, productId: process.env.FINTS_PRODUCT_ID },
    stdout: true,
    stderr: true,
  });
  // Drain library output without forwarding or persisting potentially sensitive decoder errors.
  worker.stdout.resume();
  worker.stderr.resume();
  let settled = false;
  let rejectResult: (error: Error) => void;
  const result = new Promise<BankBundle>(
    /** Resolve only validated, credential-free worker messages. */ (resolve, reject) => {
      rejectResult = reject;
      worker.on(
        'message',
        /** Ignore arbitrary messages and never pass through worker exceptions. */ (message: unknown) => {
          const envelope = z.object({ kind: z.string(), data: z.unknown().optional() }).parse(message);
          if (envelope.kind === 'challenge') onChallenge(bankChallengeSchema.parse(envelope.data));
          if (envelope.kind === 'running') onChallenge(null);
          if (envelope.kind === 'done') {
            settled = true;
            resolve(bankBundleSchema.parse(envelope.data));
          }
          if (envelope.kind === 'error') {
            settled = true;
            const code = z
              .enum([
                'BANK_INVALID_CREDENTIALS',
                'BANK_AUTH_REJECTED',
                'BANK_UNAVAILABLE',
                'BANK_INVALID_RESPONSE',
                'BANK_UNSUPPORTED',
              ])
              .catch('BANK_INVALID_RESPONSE')
              .parse(envelope.data);
            reject(new AppError(code, 'Bankabruf fehlgeschlagen. Zugang und Freigabe prüfen.', 502));
          }
        },
      );
      worker.once(
        'error',
        /** Replace raw worker exceptions with a safe error. */ () => {
          settled = true;
          reject(new AppError('BANK_UNAVAILABLE', 'Bankabruf fehlgeschlagen.', 502));
        },
      );
      worker.once(
        'exit',
        /** A worker exiting without a complete response never counts as success. */ () => {
          if (!settled) reject(new AppError('BANK_UNAVAILABLE', 'Bankdialog beendet.', 502));
        },
      );
    },
  );
  const timeout = setTimeout(
    /** Terminate any worker retaining secrets beyond ten minutes. */ () => {
      if (!settled) {
        settled = true;
        rejectResult(new AppError('BANK_AUTH_TIMEOUT', 'Zeit für Bankfreigabe abgelaufen.', 502));
      }
      void worker.terminate();
    },
    10 * 60_000,
  );
  void result
    .finally(
      /** Release worker memory after success or failure. */ () => {
        clearTimeout(timeout);
        void worker.terminate();
      },
    )
    .catch(/** The caller owns rejection handling. */ () => {});
  return {
    result,
    /** Continue the current challenge without persisting the submitted TAN. */
    continue(response) {
      worker.postMessage(response);
    },
    /** Cancellation terminates network work and destroys the credential-owning worker. */
    async cancel() {
      if (!settled) {
        settled = true;
        rejectResult(new AppError('SYNC_CANCELLED', 'Abruf abgebrochen.', 409));
      }
      clearTimeout(timeout);
      await worker.terminate();
    },
  };
}
