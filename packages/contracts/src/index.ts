import { z } from 'zod';

export const idSchema = z.uuid().toLowerCase();
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
/** Validate a German account IBAN using streaming ISO 13616 mod-97 without numeric precision loss. */
export const ibanSchema = z
  .string()
  .overwrite(
    /** Normalize pasted display spacing and country case. */ (value) => value.replace(/\s/g, '').toUpperCase(),
  )
  .refine(
    /** Check both the German length and checksum; accept no inferred account number. */ (value) => {
      if (!/^DE\d{20}$/.test(value)) return false;
      const rearranged = `${value.slice(4)}1314${value.slice(2, 4)}`;
      let remainder = 0;
      for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
      return remainder === 1;
    },
    'Bitte eine gültige deutsche IBAN eingeben.',
  );
export const accountInputSchema = z.object({
  bankConnectionId: idSchema,
  name: z.string().trim().min(1).max(100),
  iban: ibanSchema.nullable().optional(),
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
  accountId: idSchema.nullable(),
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
    unassigned: z.enum(['true', 'false']).optional(),
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
    /** A specific account and the unassigned-only view are mutually exclusive. */
    (query) => !(query.accountId && query.unassigned === 'true'),
    'Konto und Ohne-Konto-Filter nicht gleichzeitig auswählen.',
  )
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
  candidateVersions: z.record(idSchema, timeSchema).optional(),
  incomingSource: z.enum(['CSV', 'FINTS']).optional(),
  incomingReference: z.string().nullable().optional(),
  candidateSources: z.record(idSchema, z.array(z.enum(['CSV', 'FINTS', 'LEGACY']))).optional(),
  candidateReferences: z.record(idSchema, z.array(z.string())).optional(),
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
  accountId: idSchema.nullable().optional().default(null),
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
      z.object({
        issueId: idSchema,
        action: z.enum(['NEW', 'MATCH', 'SKIP', 'EXISTING', 'INCOMING']),
        transactionId: idSchema.optional(),
        candidateVersion: timeSchema.optional(),
      }),
    )
    .min(1)
    .max(100),
});
export const assignmentPreviewInputSchema = z.object({
  accountId: idSchema,
  transactionIds: z
    .array(idSchema)
    .min(1)
    .max(100)
    .refine(
      /** Repeated IDs cannot be applied twice in a batch. */ (ids) => new Set(ids).size === ids.length,
      'Umsatz mehrfach ausgewählt.',
    ),
});
export const assignmentRecordSchema = z.object({
  transaction: transactionSchema,
  accountName: z.string().nullable(),
  references: z.array(z.object({ type: z.string(), value: z.string(), source: z.enum(['CSV', 'FINTS', 'LEGACY']) })),
});
export const assignmentPreviewSchema = z.object({
  accountId: idSchema,
  items: z.array(
    z.object({
      incoming: assignmentRecordSchema,
      candidates: z.array(assignmentRecordSchema),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      hasMoreCandidates: z.boolean(),
    }),
  ),
});
export const assignmentInputSchema = z.object({
  requestId: idSchema,
  accountId: idSchema,
  decisions: z
    .array(
      z.object({
        transactionId: idSchema,
        token: z.string().regex(/^[a-f0-9]{64}$/),
        action: z.enum(['BANK', 'CSV', 'SEPARATE', 'SKIP']),
        candidateId: idSchema.optional(),
        categoryChoice: z.enum(['BANK', 'CSV']).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export const assignmentResultSchema = z.object({
  assigned: z.number().int(),
  merged: z.number().int(),
  skipped: z.number().int(),
  results: z.array(z.object({ transactionId: idSchema, resultingId: idSchema.nullable() })),
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

/** One public operation; schemas remain the only transport field definitions. */
export interface ApiContract {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  request?: z.ZodType;
  query?: z.ZodType;
  response: z.ZodType;
  status: number;
  public?: boolean;
}
const okSchema = z.object({ ok: z.boolean() });
/** Operation inventory shared with generated OpenAPI and contract tests. */
export const apiContracts: Record<string, ApiContract> = {
  health: {
    method: 'get',
    path: '/health',
    response: z.object({ status: z.literal('ok') }),
    status: 200,
    public: true,
  },
  readiness: {
    method: 'get',
    path: '/health/ready',
    response: z.object({ status: z.literal('ok') }),
    status: 200,
    public: true,
  },
  login: {
    method: 'post',
    path: '/auth/login',
    request: loginSchema,
    response: sessionSchema,
    status: 201,
    public: true,
  },
  session: { method: 'get', path: '/auth/session', response: sessionSchema, status: 200 },
  logout: { method: 'post', path: '/auth/logout', response: okSchema, status: 201 },
  password: { method: 'post', path: '/auth/password', request: passwordChangeSchema, response: okSchema, status: 201 },
  connections: { method: 'get', path: '/bank-connections', response: z.array(connectionSchema), status: 200 },
  createConnection: {
    method: 'post',
    path: '/bank-connections',
    request: connectionInputSchema,
    response: connectionSchema,
    status: 201,
  },
  patchConnection: {
    method: 'patch',
    path: '/bank-connections/{id}',
    request: connectionInputSchema.partial().extend({ status: z.enum(['ACTIVE', 'DISABLED', 'BLOCKED']).optional() }),
    response: connectionSchema,
    status: 200,
  },
  accounts: { method: 'get', path: '/accounts', response: z.array(accountSchema), status: 200 },
  createAccount: {
    method: 'post',
    path: '/accounts',
    request: accountInputSchema,
    response: accountSchema,
    status: 201,
  },
  account: { method: 'get', path: '/accounts/{id}', response: accountSchema, status: 200 },
  patchAccount: {
    method: 'patch',
    path: '/accounts/{id}',
    request: accountPatchSchema,
    response: accountSchema,
    status: 200,
  },
  balances: { method: 'get', path: '/accounts/{id}/balances', response: z.array(balanceSchema), status: 200 },
  transactions: {
    method: 'get',
    path: '/transactions',
    query: transactionQuerySchema,
    response: transactionPageSchema,
    status: 200,
  },
  assignmentPreview: {
    method: 'post',
    path: '/transactions/assignment-preview',
    request: assignmentPreviewInputSchema,
    response: assignmentPreviewSchema,
    status: 201,
  },
  assignTransactions: {
    method: 'post',
    path: '/transactions/assign',
    request: assignmentInputSchema,
    response: assignmentResultSchema,
    status: 201,
  },
  transaction: { method: 'get', path: '/transactions/{id}', response: transactionSchema, status: 200 },
  patchTransaction: {
    method: 'patch',
    path: '/transactions/{id}',
    request: transactionPatchSchema,
    response: transactionSchema,
    status: 200,
  },
  bulkCategory: {
    method: 'post',
    path: '/transactions/bulk-category',
    request: bulkCategorySchema,
    response: z.object({ updated: z.number().int() }),
    status: 201,
  },
  categories: { method: 'get', path: '/categories', response: z.array(categorySchema), status: 200 },
  createCategory: {
    method: 'post',
    path: '/categories',
    request: categoryInputSchema,
    response: categorySchema,
    status: 201,
  },
  patchCategory: {
    method: 'patch',
    path: '/categories/{id}',
    request: categoryInputSchema.partial(),
    response: categorySchema,
    status: 200,
  },
  deleteCategory: {
    method: 'delete',
    path: '/categories/{id}',
    request: z.object({ confirm: z.literal(true) }),
    response: okSchema,
    status: 200,
  },
  monthly: {
    method: 'get',
    path: '/analytics/monthly',
    query: monthlyQuerySchema,
    response: monthlySchema,
    status: 200,
  },
  createTransfer: {
    method: 'post',
    path: '/transfers',
    request: transferSchema,
    response: z.object({ id: idSchema }),
    status: 201,
  },
  deleteTransfer: { method: 'delete', path: '/transfers/{id}', response: okSchema, status: 200 },
  imports: { method: 'get', path: '/imports', response: z.array(runSchema), status: 200 },
  previewCsv: {
    method: 'post',
    path: '/imports/csv/preview',
    request: csvPreviewInputSchema,
    response: csvPreviewSchema,
    status: 201,
  },
  commitCsv: {
    method: 'post',
    path: '/imports/csv/{id}/commit',
    request: csvCommitSchema,
    response: runSchema,
    status: 201,
  },
  importRun: { method: 'get', path: '/import-runs/{id}', response: runSchema, status: 200 },
  importIssues: { method: 'get', path: '/imports/{id}/issues', response: z.array(issueSchema), status: 200 },
  resolveImport: {
    method: 'post',
    path: '/imports/{id}/resolutions',
    request: resolutionSchema,
    response: runSchema,
    status: 201,
  },
  sync: {
    method: 'post',
    path: '/bank-connections/{id}/sync',
    request: syncInputSchema,
    response: runSchema,
    status: 202,
  },
  challenge: {
    method: 'post',
    path: '/import-runs/{id}/challenge',
    request: challengeInputSchema,
    response: runSchema,
    status: 201,
  },
  cancel: { method: 'post', path: '/import-runs/{id}/cancel', response: runSchema, status: 201 },
};
