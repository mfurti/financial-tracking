import { z } from 'zod';

export const idSchema = z.uuid();
export const dateSchema = z.iso.date();
export const timeSchema = z.iso.datetime();
export const centsSchema = z
  .string()
  .regex(/^-?(0|[1-9]\d*)$/)
  .refine(
    /** Restrict transport amounts to PostgreSQL signed BIGINT. */
    (value) =>
      /^-?(0|[1-9]\d*)$/.test(value) &&
      value.length <= 20 &&
      BigInt(value) >= -9223372036854775808n &&
      BigInt(value) <= 9223372036854775807n,
    'Betrag außerhalb des zulässigen Bereichs.',
  );
export const categoryKindSchema = z.enum(['INCOME', 'EXPENSE', 'BOTH']);
export const transactionStatusSchema = z.enum(['BOOKED', 'PENDING']);
export const runStatusSchema = z.enum([
  'CREATED',
  'RUNNING',
  'WAITING_FOR_AUTH',
  'COMMITTING',
  'COMPLETED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'CANCELLED',
]);
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
});
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});
export const sessionSchema = z.object({ username: z.string(), csrfToken: z.string(), expiresAt: timeSchema });
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: categoryKindSchema,
  color: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
export const categorySchema = categoryInputSchema.extend({
  id: idSchema,
  isSystem: z.boolean(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export const connectionInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bankCode: z.string().regex(/^\d{8}$/),
  connectorType: z.enum(['FINTS', 'CSV']),
  username: z.string().trim().max(100).optional(),
});
export const connectionSchema = connectionInputSchema.extend({
  username: z.string().nullable(),
  id: idSchema,
  status: z.enum(['ACTIVE', 'DISABLED', 'BLOCKED']),
});
export const accountInputSchema = z.object({
  bankConnectionId: idSchema,
  name: z.string().trim().min(1).max(100),
  iban: z
    .string()
    .regex(/^DE\d{20}$/)
    .nullable()
    .optional(),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'OTHER']).default('CHECKING'),
});
export const accountPatchSchema = z.object({
  bankConnectionId: idSchema.optional(),
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});
export const balanceSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  amountCents: centsSchema,
  balanceType: z.enum(['BOOKED', 'AVAILABLE']),
  observedAt: timeSchema,
});
export const accountSchema = accountInputSchema.extend({
  id: idSchema,
  currency: z.literal('EUR'),
  isActive: z.boolean(),
  lastSuccessfulSyncAt: timeSchema.nullable(),
  balances: z.array(balanceSchema),
});
export const transactionSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  amountCents: centsSchema,
  currency: z.literal('EUR'),
  bookingDate: dateSchema,
  valueDate: dateSchema.nullable(),
  description: z.string(),
  counterpartyName: z.string().nullable(),
  counterpartyIban: z.string().nullable(),
  status: transactionStatusSchema,
  categoryId: idSchema.nullable(),
  isTransfer: z.boolean(),
  transferGroupId: idSchema.nullable(),
});
export const transactionPatchSchema = z.object({
  categoryId: idSchema.nullable().optional(),
  isTransfer: z.boolean().optional(),
});
export const bulkCategorySchema = z.object({ ids: z.array(idSchema).min(1).max(100), categoryId: idSchema.nullable() });
export const transactionQuerySchema = z
  .object({
    accountId: idSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    categoryId: idSchema.optional(),
    status: transactionStatusSchema.optional(),
    search: z.string().trim().max(200).optional(),
    direction: z.enum(['INCOME', 'EXPENSE']).optional(),
    uncategorized: z.enum(['true', 'false']).optional(),
    excludeTransfers: z.enum(['true', 'false']).optional(),
    cursor: idSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    /** Reject inverted date ranges. */
    (query) => !query.from || !query.to || query.from <= query.to,
    'Ungültiger Zeitraum.',
  );
export const transactionPageSchema = z.object({ items: z.array(transactionSchema), nextCursor: idSchema.nullable() });
export const monthlyQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  accountId: idSchema.optional(),
});
export const monthlySchema = z.object({
  month: z.string(),
  incomeCents: z.string(),
  expenseCents: z.string(),
  netCents: z.string(),
  previousNetCents: z.string(),
  deltaCents: z.string(),
  categories: z.array(
    z.object({
      categoryId: idSchema.nullable(),
      name: z.string(),
      incomeCents: z.string(),
      expenseCents: z.string(),
      count: z.number().int(),
      expenseShare: z.number().nullable(),
    }),
  ),
});
export const syncInputSchema = z.object({
  pin: z.string().min(1).max(256),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  tanMethodId: z.number().int().optional(),
  tanMediaName: z.string().max(100).optional(),
});
export const challengeInputSchema = z.object({
  tan: z.string().max(128).optional(),
  tanMethodId: z.number().int().optional(),
  tanMediaName: z.string().max(100).optional(),
});
export const issueSchema = z.object({
  id: idSchema,
  rowNumber: z.number().int().nullable(),
  code: z.string(),
  message: z.string(),
  candidateIds: z.array(idSchema),
  incoming: transactionSchema
    .omit({ id: true, categoryId: true, isTransfer: true, transferGroupId: true })
    .nullable()
    .optional(),
  candidates: z.array(transactionSchema).optional(),
});
export const runSchema = z.object({
  id: idSchema,
  source: z.enum(['CSV', 'FINTS']),
  status: runStatusSchema,
  startedAt: timeSchema,
  finishedAt: timeSchema.nullable(),
  importedCount: z.number().int(),
  knownCount: z.number().int(),
  reviewRequiredCount: z.number().int(),
  errorCode: z.string().nullable(),
  challenge: z
    .object({
      type: z.enum(['TAN', 'APP_APPROVAL', 'SELECT_METHOD']),
      message: z.string(),
      methods: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
    })
    .nullable(),
});
export const csvMappingSchema = z.object({
  bookingDate: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().min(1),
  valueDate: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyIban: z.string().optional(),
  reference: z.string().optional(),
  currency: z.string().optional(),
});
export const csvPreviewInputSchema = z.object({
  accountId: idSchema,
  content: z.string().max(10485760),
  encoding: z.enum(['utf-8', 'windows-1252']).default('utf-8'),
  delimiter: z.enum([';', ',']).default(';'),
  mapping: csvMappingSchema,
});
export const csvPreviewSchema = z.object({
  run: runSchema,
  headers: z.array(z.string()),
  rows: z.array(transactionSchema.omit({ id: true, categoryId: true, isTransfer: true, transferGroupId: true })),
  totalRows: z.number().int(),
  invalidRows: z.number().int(),
  issues: z.array(issueSchema),
});
export const csvCommitSchema = z.object({ allowPartial: z.boolean().default(false) });
export const resolutionSchema = z.object({
  resolutions: z
    .array(
      z.object({ issueId: idSchema, action: z.enum(['NEW', 'MATCH', 'SKIP']), transactionId: idSchema.optional() }),
    )
    .min(1)
    .max(100),
});
export const transferSchema = z.object({ transactionIds: z.array(idSchema).min(1).max(2) });
export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});

/** Public session returned after authentication. */
export type Session = z.infer<typeof sessionSchema>;
/** Public account representation; amounts remain decimal strings. */
export type Account = z.infer<typeof accountSchema>;
/** Public transaction independent of Prisma types. */
export type Transaction = z.infer<typeof transactionSchema>;
/** User-managed category. */
export type Category = z.infer<typeof categorySchema>;
/** Bank connection without credentials. */
export type Connection = z.infer<typeof connectionSchema>;
/** Import status without transient credentials. */
export type ImportRun = z.infer<typeof runSchema>;
/** User-provided column mapping for CSV uploads. */
export type CsvMapping = z.infer<typeof csvMappingSchema>;
/** Exact monthly amounts and category aggregation. */
export type Monthly = z.infer<typeof monthlySchema>;
