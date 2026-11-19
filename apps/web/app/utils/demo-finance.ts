import { z } from 'zod';
import { demoCentsSchema, demoIdSchema, demoStateSchema, demoTimeSchema, type DemoState } from './demo-state.js';

/** Shared trade fields enforce whole quantities and entirely synthetic references. */
const tradeFields = { accountId: demoIdSchema, securityId: demoIdSchema, quantity: z.number().int().min(1).max(1000) };
/** All mutations are explicit; no background plan execution or real transport exists. */
export const demoActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('buy'), ...tradeFields }).strict(),
  z.object({ kind: z.literal('sell'), ...tradeFields }).strict(),
  z
    .object({ kind: z.literal('transfer'), fromId: demoIdSchema, toId: demoIdSchema, amountCents: demoCentsSchema })
    .strict(),
  z.object({ kind: z.literal('account'), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ kind: z.literal('category'), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ kind: z.literal('scenario'), basisPoints: z.number().int().min(-3000).max(3000) }).strict(),
  z
    .object({
      kind: z.literal('plan-save'),
      plan: z
        .object({
          id: demoIdSchema,
          name: z.string().trim().min(1).max(80),
          accountId: demoIdSchema,
          securityId: demoIdSchema,
          amountCents: demoCentsSchema,
          day: z.number().int().min(1).max(31),
        })
        .strict(),
    })
    .strict(),
  z.object({ kind: z.literal('plan-delete'), planId: demoIdSchema }).strict(),
  z
    .object({
      kind: z.literal('plan-execute'),
      planId: demoIdSchema,
      period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal('role'),
      id: demoIdSchema,
      name: z.string().trim().min(1).max(80),
      role: z.enum(['owner', 'viewer']),
    })
    .strict(),
]);
/** Typed commands contain no real account IDs, credentials or arbitrary cent adjustments. */
export type DemoAction = z.infer<typeof demoActionSchema>;

/** Round positive rational quotes to the nearest cent, with exact half cents rounded upward. */
export function demoPrice(state: DemoState, securityId: string): bigint {
  const security = state.securities.find(
    /** Find only a supported synthetic instrument. */ (item) => item.id === securityId,
  );
  if (!security) throw new Error('Unbekanntes Demo-Wertpapier.');
  return (BigInt(security.priceCents) * BigInt(10000 + state.scenarioBps) + 5000n) / 10000n;
}

/** Aggregate synthetic cash and marked positions without floating-point money. */
export function demoTotal(state: DemoState): bigint {
  let total = 0n;
  for (const account of state.accounts) total += BigInt(account.cashCents);
  for (const position of state.positions) total += BigInt(position.quantity) * demoPrice(state, position.securityId);
  return total;
}

/** Resolve an owned synthetic account or reject the whole transition. */
function accountById(state: DemoState, id: string) {
  const account = state.accounts.find(/** Match the synthetic account identity. */ (item) => item.id === id);
  if (!account) throw new Error('Unbekanntes Demo-Konto.');
  return account;
}

/** Apply a prevalidated order to a private draft; no rejected draft escapes the transition. */
function trade(
  state: DemoState,
  input: z.infer<typeof demoActionSchema> & { kind: 'buy' | 'sell' },
  id: string,
  at: string,
) {
  const account = accountById(state, input.accountId);
  const price = demoPrice(state, input.securityId);
  const value = price * BigInt(input.quantity);
  const index = state.positions.findIndex(
    /** Find the exact synthetic holding. */ (item) =>
      item.accountId === input.accountId && item.securityId === input.securityId,
  );
  const held = index < 0 ? 0 : state.positions[index]!.quantity;
  if (input.kind === 'buy') {
    if (BigInt(account.cashCents) < value) throw new Error('Nicht genug Demo-Guthaben.');
    if (!Number.isSafeInteger(held + input.quantity)) throw new Error('Demo-Bestand ist zu groß.');
    account.cashCents = (BigInt(account.cashCents) - value).toString();
    if (index < 0)
      state.positions.push({ accountId: input.accountId, securityId: input.securityId, quantity: input.quantity });
    else state.positions[index]!.quantity += input.quantity;
  } else {
    if (held < input.quantity) throw new Error('Nicht genug Demo-Anteile.');
    account.cashCents = (BigInt(account.cashCents) + value).toString();
    if (held === input.quantity) state.positions.splice(index, 1);
    else state.positions[index]!.quantity -= input.quantity;
  }
  // The command discriminator is not part of the persisted strict order schema.
  state.orders.push({
    id,
    accountId: input.accountId,
    securityId: input.securityId,
    quantity: input.quantity,
    side: input.kind,
    priceCents: price.toString(),
    at,
  });
}

/** Validate and atomically return one next revision; errors leave the caller's state untouched. */
export function transitionDemo(source: DemoState, rawAction: unknown, rawId: string, rawAt: string): DemoState {
  const state = demoStateSchema.parse(source);
  const input = demoActionSchema.parse(rawAction);
  const id = demoIdSchema.parse(rawId);
  const at = demoTimeSchema.parse(rawAt);
  if (state.activity.some(/** Replayed command identities cannot execute twice. */ (item) => item.id === id))
    return state;
  const before = demoTotal(state);
  switch (input.kind) {
    case 'buy':
    case 'sell':
      trade(state, input, id, at);
      break;
    case 'transfer': {
      if (input.fromId === input.toId) throw new Error('Verschiedene Demo-Konten wählen.');
      const from = accountById(state, input.fromId),
        to = accountById(state, input.toId);
      const amount = BigInt(input.amountCents);
      if (amount <= 0n || BigInt(from.cashCents) < amount) throw new Error('Ungültiger Demo-Transferbetrag.');
      from.cashCents = (BigInt(from.cashCents) - amount).toString();
      to.cashCents = (BigInt(to.cashCents) + amount).toString();
      break;
    }
    case 'account':
      state.accounts.push({ id, name: input.name, cashCents: '0' });
      break;
    case 'category':
      state.categories.push({ id, name: input.name });
      break;
    case 'scenario':
      state.scenarioBps = input.basisPoints;
      break;
    case 'plan-save': {
      accountById(state, input.plan.accountId);
      demoPrice(state, input.plan.securityId);
      if (BigInt(input.plan.amountCents) <= 0n) throw new Error('Positiven Demo-Sparbetrag eingeben.');
      const index = state.plans.findIndex(
        /** Resolve an existing synthetic plan for replacement. */ (plan) => plan.id === input.plan.id,
      );
      if (index < 0) state.plans.push(input.plan);
      else state.plans[index] = input.plan;
      break;
    }
    case 'plan-delete': {
      const index = state.plans.findIndex(
        /** Resolve the explicitly deleted synthetic plan. */ (plan) => plan.id === input.planId,
      );
      if (index < 0) throw new Error('Unbekannter Demo-Sparplan.');
      state.plans.splice(index, 1);
      break;
    }
    case 'plan-execute': {
      const key = `${input.planId}:${input.period}`;
      if (state.executedPeriods.includes(key))
        throw new Error('Demo-Sparplan wurde für diesen Monat bereits ausgeführt.');
      const plan = state.plans.find(
        /** Resolve the plan's current validated terms. */ (item) => item.id === input.planId,
      );
      if (!plan) throw new Error('Unbekannter Demo-Sparplan.');
      const [year, month] = input.period.split('-').map(Number);
      const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
      const due = `${input.period}-${String(Math.min(plan.day, lastDay)).padStart(2, '0')}`;
      if (at.slice(0, 10) < due) throw new Error('Demo-Ausführungstag noch nicht erreicht.');
      const quantity = BigInt(plan.amountCents) / demoPrice(state, plan.securityId);
      if (quantity < 1n || quantity > 1000n) throw new Error('Demo-Sparbetrag muss 1 bis 1000 ganze Anteile erlauben.');
      trade(
        state,
        { kind: 'buy', accountId: plan.accountId, securityId: plan.securityId, quantity: Number(quantity) },
        id,
        at,
      );
      state.executedPeriods.push(key);
      break;
    }
    case 'role': {
      const role = { id: input.id, name: input.name, role: input.role };
      const index = state.roles.findIndex(
        /** Resolve a display-only synthetic role entry. */ (item) => item.id === input.id,
      );
      if (index < 0) state.roles.push(role);
      else state.roles[index] = role;
      break;
    }
  }
  state.revision++;
  state.activity.push({ id, kind: input.kind, at });
  const total = demoTotal(state);
  if (total !== before) state.history = [...state.history, { id, at, totalCents: total.toString() }].slice(-48);
  return demoStateSchema.parse(state);
}
