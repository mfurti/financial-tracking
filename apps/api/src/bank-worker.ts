import { parentPort, workerData } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { FinTSClient, FinTSConfig, type ClientResponse, type BankingInformation } from 'lib-fints';
import { z } from 'zod';
import { dateSchema, challengeInputSchema } from '@financial-tracking/contracts';
import { stableReference } from './csv.js';
import { authorizeBank, libraryCents } from './bank-authorization.js';

const input = z
  .object({
    username: z.string(),
    pin: z.string(),
    bankCode: z.string(),
    fromDate: dateSchema,
    toDate: dateSchema,
    endpoint: z.url(),
    productId: z.string(),
    metadata: z.unknown().optional(),
    tanMethodId: z.number().optional(),
    tanMediaName: z.string().optional(),
  })
  .parse(workerData);
const originalFetch = globalThis.fetch;
// The library has no timeout/cancel injection. This worker confines its transport to the configured endpoint.
globalThis.fetch =
  /** Reject redirects, unexpected destinations, excessive responses, and stalled bank requests. */ async (
    url,
    init,
  ) => {
    if (String(url) !== input.endpoint) throw new Error('BANK_UNSUPPORTED');
    const response = await originalFetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 10 * 1024 * 1024) {
          await reader.cancel();
          throw new Error('BANK_INVALID_RESPONSE');
        }
        chunks.push(chunk.value);
      }
    }
    return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
  };
const config = FinTSConfig.forFirstTimeUse(
  input.productId,
  '0.1',
  input.endpoint,
  input.bankCode,
  input.username,
  input.pin,
);
config.debugEnabled = false;
if (input.metadata) config.bankingInformation = input.metadata as BankingInformation;
const client = new FinTSClient(config);

/** Wait for exactly one validated authorization response. */
async function answer() {
  return new Promise<z.infer<typeof challengeInputSchema>>(
    /** Parent messages never enter persistent storage. */ (resolve) => {
      parentPort!.once(
        'message',
        /** Validate before selecting methods or sending TAN values. */ (value: unknown) =>
          resolve(challengeInputSchema.parse(value)),
      );
    },
  );
}

/** Bind authorization to the current isolated worker without changing its public messages. */
function authorized<T extends ClientResponse>(
  initial: () => Promise<T>,
  continuation: (reference: string, tan?: string) => Promise<T>,
): Promise<T> {
  return authorizeBank(initial, continuation, {
    config,
    pin: input.pin,
    answer,
    /** Publish only the same safe public challenge as before extraction. */
    challenge: (data) => parentPort!.postMessage({ kind: 'challenge', data }),
    /** Signal that the worker is continuing the existing bank dialog. */
    running: () => parentPort!.postMessage({ kind: 'running' }),
  });
}
try {
  await authorized(
    /** Initialize the bank dialog once; incorrect PIN is never retried. */ () => client.synchronize(),
    /** Continue an initialization requiring TAN. */ (reference, tan) => client.synchronizeWithTan(reference, tan),
  );
  const methods = config.availableTanMethods;
  if (input.tanMethodId) client.selectTanMethod(input.tanMethodId);
  else if (methods.length === 1) client.selectTanMethod(methods[0]!.id);
  else if (methods.length > 1) {
    parentPort!.postMessage({
      kind: 'challenge',
      data: {
        type: 'SELECT_METHOD',
        message: 'TAN-Verfahren wählen.',
        methods: methods.map(
          /** Expose only method identifiers and labels. */ (method) => ({ id: method.id, name: method.name }),
        ),
      },
    });
    const selected = await answer();
    if (!selected.tanMethodId) throw new Error('BANK_UNSUPPORTED');
    client.selectTanMethod(selected.tanMethodId);
    if (selected.tanMediaName) client.selectTanMedia(selected.tanMediaName);
  }
  if (input.tanMediaName) client.selectTanMedia(input.tanMediaName);
  await authorized(
    /** Reinitialize with the selected TAN method to retrieve user accounts. */ () => client.synchronize(),
    /** Complete selected-method initialization. */ (reference, tan) => client.synchronizeWithTan(reference, tan),
  );
  const accounts = [];
  let failedAccounts = 0;
  for (const account of config.bankingInformation.upd?.bankAccounts ?? []) {
    if (account.currency !== 'EUR' || !client.canGetAccountBalance(account) || !client.canGetAccountStatements(account))
      continue;
    try {
      const balance = await authorized(
        /** Fetch only a supported account balance. */ () => client.getAccountBalance(account),
        /** Complete balance authorization. */ (reference, tan) => client.getAccountBalanceWithTan(reference, tan),
      );
      const statements = await authorized(
        /** Fetch the complete library-supported date range. */ () =>
          client.getAccountStatements(account, new Date(input.fromDate), new Date(input.toDate)),
        /** Complete transaction authorization. */ (reference, tan) =>
          client.getAccountStatementsWithTan(reference, tan),
      );
      if (!balance.balance || balance.balance.currency !== 'EUR') throw new Error('BANK_INVALID_RESPONSE');
      const rows = statements.statements.flatMap(
        /** Normalize statement entries without persisting bank protocol data. */ (statement) =>
          statement.transactions.map(
            /** Preserve bank references only when non-placeholder. */ (row) => {
              const reference = stableReference(row.bankReference);
              return {
                amountCents: libraryCents(row.amount),
                currency: 'EUR' as const,
                bookingDate: dateSchema.parse(row.entryDate.toISOString().slice(0, 10)),
                valueDate: dateSchema.parse(row.valueDate.toISOString().slice(0, 10)),
                description: row.purpose || row.bookingText || row.transactionType,
                counterpartyName: row.remoteName || null,
                counterpartyIban: row.remoteIdentifier?.startsWith('DE') ? row.remoteIdentifier : null,
                status: 'BOOKED' as const,
                identityType: reference ? 'BANK_REFERENCE' : 'FINTS_OBSERVATION',
                identityValue: reference ?? randomUUID(),
                reference,
              };
            },
          ),
      );
      accounts.push({
        reference: account.iban ?? `${account.accountNumber}:${account.subAccountId ?? ''}`,
        name: account.product ?? account.accountNumber,
        iban: account.iban ?? null,
        balanceCents: libraryCents(balance.balance.balance),
        observedAt: balance.balance.date.toISOString(),
        rows,
      });
    } catch (error) {
      if (error instanceof Error && ['BANK_INVALID_CREDENTIALS', 'BANK_AUTH_REJECTED'].includes(error.message))
        throw error;
      failedAccounts++;
    }
  }
  if (!accounts.length) throw new Error('BANK_UNSUPPORTED');
  // bankingInformation contains protocol parameters/system ID, never config.pin or the client object.
  parentPort!.postMessage({
    kind: 'done',
    data: {
      accounts,
      failedAccounts,
      metadata: {
        systemId: config.bankingInformation.systemId,
        bpd: config.bankingInformation.bpd,
        upd: config.bankingInformation.upd,
        bankMessages: [],
      },
    },
  });
} catch (error) {
  const code =
    error instanceof Error &&
    ['BANK_INVALID_CREDENTIALS', 'BANK_AUTH_REJECTED', 'BANK_UNSUPPORTED', 'BANK_INVALID_RESPONSE'].includes(
      error.message,
    )
      ? error.message
      : 'BANK_UNAVAILABLE';
  parentPort!.postMessage({ kind: 'error', data: code });
} finally {
  config.pin = undefined;
  input.pin = '';
  parentPort!.close();
}
