import type { ClientResponse, FinTSConfig } from 'lib-fints';
import type { z } from 'zod';
import { centsSchema, challengeInputSchema } from '@financial-tracking/contracts';
import type { BankChallenge } from './bank.js';

/** Library response boundary exposed for isolated driver fixtures without a root SDK dependency. */
export type BankResponse = ClientResponse;

/** Keep credential redaction knowledge only for the lifetime of one worker dialog. */
export function transientSecrets(pin: string) {
  const secrets = new Set([pin]);
  return {
    /** Remember a submitted TAN only until worker cleanup. */
    remember(value: string) {
      if (value) secrets.add(value);
    },
    /** Remove known transient credentials from bank-provided free text. */
    publicText(value: string) {
      let result = value;
      for (const secret of secrets) if (secret) result = result.split(secret).join('[geschützt]');
      return result;
    },
    /** Release references when the bank dialog ends. */
    clear() {
      secrets.clear();
    },
  };
}

/** Transient worker-owned interaction boundary; no protocol state or credentials are persisted here. */
export interface AuthorizationContext {
  config: Pick<FinTSConfig, 'selectedTanMethod'>;
  pin: string;
  answer: () => Promise<z.infer<typeof challengeInputSchema>>;
  challenge: (challenge: BankChallenge) => void;
  running: () => void;
  publicText?: (value: string) => string;
}

/** Drive a TAN operation while respecting the bank's waiting time and poll limit. */
export async function authorizeBank<T extends ClientResponse>(
  initial: () => Promise<T>,
  continuation: (reference: string, tan?: string) => Promise<T>,
  context: AuthorizationContext,
): Promise<T> {
  let response = await initial();
  let attempts = 0;
  let lastPoll = Date.now();
  while (response.requiresTan) {
    if (!response.tanReference || response.tanPhoto || response.tanChallengeHhdUc) throw new Error('BANK_UNSUPPORTED');
    const method = context.config.selectedTanMethod;
    const limit = method?.decoupled?.maxStatusRequests ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('BANK_INVALID_RESPONSE');
    if (attempts >= limit) throw new Error('BANK_AUTH_REJECTED');
    const rawMessage = response.tanChallenge ?? 'Bankfreigabe erforderlich.';
    const challengeMessage = (
      context.publicText ? context.publicText(rawMessage) : rawMessage.split(context.pin).join('[geschützt]')
    ).slice(0, 1000);
    context.challenge({ type: method?.isDecoupled ? 'APP_APPROVAL' : 'TAN', message: challengeMessage });
    const submitted = await context.answer();
    const seconds = attempts
      ? (method?.decoupled?.waitingSecondsBetweenStatusRequests ?? 5)
      : (method?.decoupled?.waitingSecondsBeforeFirstStatusRequest ?? 5);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) throw new Error('BANK_INVALID_RESPONSE');
    const remaining = seconds * 1000 - (Date.now() - lastPoll);
    if (method?.isDecoupled && remaining > 0)
      await new Promise(
        /** Delay inside the isolated worker according to bank limits. */ (resolve) => setTimeout(resolve, remaining),
      );
    attempts++;
    context.running();
    response = await continuation(response.tanReference, submitted.tan);
    lastPoll = Date.now();
  }
  if (!response.success) {
    if (
      response.bankAnswers.some(
        /** Classify login refusal without forwarding bank text. */ (answer) => [9930, 9942].includes(answer.code),
      )
    )
      throw new Error('BANK_INVALID_CREDENTIALS');
    throw new Error('BANK_AUTH_REJECTED');
  }
  return response;
}

/** Convert a library numeric boundary to exact cents; reject unsafe precision. */
export function libraryCents(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100)
    throw new Error('BANK_INVALID_RESPONSE');
  const text = value.toFixed(2);
  if (Number(text) !== value) throw new Error('BANK_INVALID_RESPONSE');
  return centsSchema.parse(BigInt(text.replace('.', '')).toString());
}
