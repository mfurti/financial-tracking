import { z } from 'zod';

/** Synthetic identifiers cannot contain real account UUIDs or session identities. */
export const demoIdSchema = z.string().regex(/^demo-[a-z0-9-]{1,90}$/);
/** Bound synthetic amounts while preserving exact integer cents in JSON. */
export const demoCentsSchema = z.string().regex(/^(0|[1-9][0-9]{0,29})$/);
/** Explicit action timestamps keep transitions deterministic and independently testable. */
export const demoTimeSchema = z.iso.datetime();
/** User-created simulation labels never become financial classifications. */
const labelSchema = z.string().trim().min(1).max(80);
/** Only this validated synthetic catalog is tradable; these are not live quotes. */
export const demoCatalog = [
  { id: 'demo-world', name: 'Demo Weltfonds', priceCents: '12345' },
  { id: 'demo-tech', name: 'Demo Technologiefonds', priceCents: '8750' },
] as const;
/** Complete dedicated simulation payload; unknown fields and real identities are rejected. */
export const demoStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    seedId: z.literal('demo-household-v1'),
    scenarioBps: z.number().int().min(-3000).max(3000),
    securities: z
      .array(z.object({ id: demoIdSchema, name: labelSchema, priceCents: demoCentsSchema }).strict())
      .length(2),
    accounts: z
      .array(z.object({ id: demoIdSchema, name: labelSchema, cashCents: demoCentsSchema }).strict())
      .min(1)
      .max(100),
    categories: z.array(z.object({ id: demoIdSchema, name: labelSchema }).strict()).max(100),
    positions: z
      .array(
        z
          .object({
            accountId: demoIdSchema,
            securityId: demoIdSchema,
            quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          })
          .strict(),
      )
      .max(200),
    orders: z
      .array(
        z
          .object({
            id: demoIdSchema,
            accountId: demoIdSchema,
            securityId: demoIdSchema,
            side: z.enum(['buy', 'sell']),
            quantity: z.number().int().min(1).max(1000),
            priceCents: demoCentsSchema,
            at: demoTimeSchema,
          })
          .strict(),
      )
      .max(10000),
    plans: z
      .array(
        z
          .object({
            id: demoIdSchema,
            name: labelSchema,
            accountId: demoIdSchema,
            securityId: demoIdSchema,
            amountCents: demoCentsSchema.refine(
              /** A plan always budgets a positive exact amount. */ (value) => BigInt(value) > 0n,
            ),
            day: z.number().int().min(1).max(31),
          })
          .strict(),
      )
      .max(100),
    executedPeriods: z.array(z.string().regex(/^demo-[a-z0-9-]{1,90}:\d{4}-(0[1-9]|1[0-2])$/)).max(10000),
    activity: z
      .array(
        z
          .object({
            id: demoIdSchema,
            kind: z.enum([
              'buy',
              'sell',
              'transfer',
              'account',
              'category',
              'scenario',
              'plan-save',
              'plan-delete',
              'plan-execute',
              'role',
            ]),
            at: demoTimeSchema,
          })
          .strict(),
      )
      .max(10000),
    history: z.array(z.object({ id: demoIdSchema, at: demoTimeSchema, totalCents: demoCentsSchema }).strict()).max(48),
    roles: z
      .array(z.object({ id: demoIdSchema, name: labelSchema, role: z.enum(['owner', 'viewer']) }).strict())
      .max(20),
  })
  .strict()
  .superRefine(
    /** Reject dangling references, duplicated identities and modified catalog quotes before use. */ (
      state,
      context,
    ) => {
      const identities = [
        state.accounts,
        state.categories,
        state.orders,
        state.plans,
        state.activity,
        state.history,
        state.roles,
      ];
      for (const collection of identities) {
        if (
          new Set(
            collection.map(/** Collect identities within their independent entity namespace. */ (item) => item.id),
          ).size !== collection.length
        )
          context.addIssue({ code: 'custom', message: 'Duplicate synthetic identity' });
      }
      if (JSON.stringify(state.securities) !== JSON.stringify(demoCatalog))
        context.addIssue({ code: 'custom', message: 'Unsupported synthetic catalog' });
      const accounts = new Set(state.accounts.map(/** Resolve synthetic account ownership. */ (account) => account.id));
      const securities = new Set<string>(
        demoCatalog.map(/** Resolve supported synthetic securities. */ (security) => security.id),
      );
      for (const item of [...state.positions, ...state.orders, ...state.plans]) {
        if (!accounts.has(item.accountId) || !securities.has(item.securityId))
          context.addIssue({ code: 'custom', message: 'Unknown synthetic reference' });
      }
      const positionKeys = state.positions.map(
        /** A holding has one row per synthetic account and security. */ (position) =>
          `${position.accountId}:${position.securityId}`,
      );
      if (
        new Set(positionKeys).size !== positionKeys.length ||
        new Set(state.executedPeriods).size !== state.executedPeriods.length
      )
        context.addIssue({ code: 'custom', message: 'Duplicate synthetic position or plan period' });
      for (let index = 1; index < state.history.length; index++) {
        if (state.history[index]!.totalCents === state.history[index - 1]!.totalCents)
          context.addIssue({ code: 'custom', message: 'Unchanged synthetic history value' });
      }
    },
  );
/** Validated JSON-only state is independent of every real API and entity model. */
export type DemoState = z.infer<typeof demoStateSchema>;

/** Return fresh, deterministic synthetic assets without reading a bank or browser storage. */
export function seedDemoState(): DemoState {
  return demoStateSchema.parse({
    schemaVersion: 1,
    revision: 0,
    seedId: 'demo-household-v1',
    scenarioBps: 0,
    securities: structuredClone(demoCatalog),
    accounts: [
      { id: 'demo-cash', name: 'Demo Verrechnungskonto', cashCents: '1000000' },
      { id: 'demo-savings', name: 'Demo Sparguthaben', cashCents: '250000' },
    ],
    categories: [{ id: 'demo-investing', name: 'Demo Geldanlage' }],
    positions: [{ accountId: 'demo-cash', securityId: 'demo-world', quantity: 10 }],
    orders: [],
    plans: [],
    executedPeriods: [],
    activity: [],
    history: [{ id: 'demo-seed', at: '2026-01-01T00:00:00.000Z', totalCents: '1373450' }],
    roles: [{ id: 'demo-owner', name: 'Demo Eigentümer', role: 'owner' }],
  });
}
