import { z } from 'zod';

export const idSchema = z.uuid().toLowerCase();
export const dateSchema = z.iso.date();
export const timeSchema = z.iso.datetime();
/** Account, group and accountless-only identities are mutually exclusive financial scopes. */
function validAccountScope(value: { accountId?: string; groupId?: string; unassigned?: 'true' | 'false' }) {
  return Number(Boolean(value.accountId)) + Number(Boolean(value.groupId)) + Number(value.unassigned === 'true') <= 1;
}
/** Shared optional account/group scope preserves the existing global default. */
export const accountScopeQuerySchema = z
  .object({ accountId: idSchema.optional(), groupId: idSchema.optional() })
  .refine(validAccountScope, 'Konto oder Kontogruppe auswählen.');
/** Contact metadata never changes the owner's username, credentials or recovery identity. */
export const workspaceProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    contactEmail: z.string().trim().max(254).pipe(z.email()).nullable().optional(),
  })
  .strict();
/** Null update time explicitly identifies the unpersisted current-owner display fallback. */
export const workspaceProfileSchema = workspaceProfileInputSchema.extend({
  userId: idSchema,
  contactEmail: z.email().max(254).nullable(),
  updatedAt: timeSchema.nullable(),
});
/** Atomic group membership rejects duplicate UUIDs after canonicalization. */
const groupAccountIdsSchema = z
  .array(idSchema)
  .max(1000)
  .refine(
    /** A selected account contributes once even when UUID case differs. */ (ids) => new Set(ids).size === ids.length,
    'Konto nur einmal auswählen.',
  );
/** Create groups with bounded display names and an explicit stable default order. */
export const accountGroupInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    accountIds: groupAccountIdsSchema,
    sortOrder: z.number().int().min(0).max(2147483647).default(0),
  })
  .strict();
/** Partial edits must not default absent order or membership fields and erase existing choices. */
export const accountGroupPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    accountIds: groupAccountIdsSchema.optional(),
    sortOrder: z.number().int().min(0).max(2147483647).optional(),
  })
  .strict()
  .refine(
    /** Reject meaningless empty mutation requests. */ (value) => Object.keys(value).length > 0,
    'Mindestens eine Änderung angeben.',
  );
/** Public groups contain references only, never duplicated financial amounts. */
export const accountGroupSchema = accountGroupInputSchema.extend({
  id: idSchema,
  createdAt: timeSchema,
  updatedAt: timeSchema,
});
/** Deleting a group requires explicit consent and never implies account deletion. */
export const accountGroupDeleteSchema = z.object({ confirm: z.literal(true) }).strict();
/** Stable source revisions are bounded without truncating existing financial source fields. */
export const notificationSourceKeySchema = z.string().trim().min(1).max(256);
/** Clients can acknowledge only a source key, never another owner or arbitrary timestamp. */
export const notificationAcknowledgementInputSchema = z.object({ sourceKey: notificationSourceKeySchema }).strict();
/** Durable acknowledgement is metadata independent of its financial source. */
export const notificationAcknowledgementSchema = notificationAcknowledgementInputSchema.extend({
  userId: idSchema,
  acknowledgedAt: timeSchema,
});
/** Only actionable import reviews and confirmed upcoming plans generate in-app events. */
export const notificationKindSchema = z.enum(['IMPORT_REVIEW', 'CONTRACT_DUE']);
/** Bounded current-source pages use opaque source identities, never offsets or financial mutation tokens. */
export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: notificationSourceKeySchema.optional(),
  kind: notificationKindSchema.optional(),
});
/** Derived event data separates planned money from import metadata and durable acknowledgement. */
export const notificationSchema = z
  .object({
    sourceKey: notificationSourceKeySchema,
    kind: notificationKindSchema,
    sourceLabel: z.string(),
    occurredAt: timeSchema,
    dueDate: dateSchema.nullable(),
    plannedCents: z
      .lazy(
        /** Resolve the shared bounded positive-money schema after module initialization. */ () => positiveCentsSchema,
      )
      .nullable(),
    rowNumber: z.number().int().nullable(),
    href: z.string().regex(/^\/(imports\?run=|contracts\/)[0-9a-f-]{36}$/),
    acknowledgedAt: timeSchema.nullable(),
  })
  .strict();
/** Counts refer to the complete bounded selected source kind, not merely the visible cursor page. */
export const notificationsSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: notificationSourceKeySchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  asOf: timeSchema,
});
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
export const positiveCentsSchema = centsSchema.refine(
  /** Validate positive magnitudes without parsing malformed values as BIGINT. */ (value) => /^[1-9]\d*$/.test(value),
  'Betrag muss größer als null sein.',
);
export const transactionSplitSchema = z.object({ categoryId: idSchema.nullable(), amountCents: positiveCentsSchema });
export const transactionSplitLimit = 20;
export const transactionSplitsInputSchema = z
  .object({ splits: z.array(transactionSplitSchema).max(transactionSplitLimit) })
  .strict()
  .refine(
    ({ splits }) =>
      splits.length === 0 ||
      (splits.length >= 2 && new Set(splits.map((part) => part.categoryId)).size === splits.length),
    { path: ['splits'], message: 'Wähle mindestens zwei unterschiedliche Kategorien.' },
  );
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
  categoryOrigin: z.enum(['NONE', 'MANUAL', 'RULE']).default('NONE'),
  categoryRuleId: idSchema.nullable().default(null),
  categoryRuleName: z.string().nullable().default(null),
  categoryRuleConflict: z.boolean().default(false),
  classification: z.enum(['FIXED', 'VARIABLE']).nullable().default(null),
  effectiveClassification: z.enum(['FIXED', 'VARIABLE', 'UNCLASSIFIED']).default('UNCLASSIFIED'),
  contractAutoBlocked: z.boolean().default(false),
  contract: z.object({ id: idSchema, name: z.string(), dueDate: dateSchema }).nullable().default(null),
  isTransfer: z.boolean(),
  transferGroupId: idSchema.nullable(),
  splits: z.array(transactionSplitSchema).optional(),
  /** A category-filtered list can show its contribution while retaining the original amount. */
  categoryAmountCents: centsSchema.optional(),
});
export const transactionPatchSchema = z.object({
  categoryId: idSchema.nullable().optional(),
  classification: z.enum(['FIXED', 'VARIABLE']).nullable().optional(),
  isTransfer: z.boolean().optional(),
});
export const bulkCategorySchema = z.object({ ids: z.array(idSchema).min(1).max(100), categoryId: idSchema.nullable() });
export const bulkClassificationSchema = z.object({
  ids: z.array(idSchema).min(1).max(100),
  classification: z.enum(['FIXED', 'VARIABLE']).nullable(),
});
export const categoryRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  categoryId: idSchema,
  matchType: z.enum(['COUNTERPARTY', 'DESCRIPTION']),
  text: z.string().trim().min(1).max(200),
  direction: z.enum(['ANY', 'INCOME', 'EXPENSE']).default('ANY'),
  priority: z.number().int().min(0).max(10000).default(100),
  isActive: z.boolean().default(true),
});
export const categoryRuleSchema = categoryRuleInputSchema.extend({ id: idSchema });
export const categoryRulePatchSchema = categoryRuleInputSchema
  .omit({ direction: true, priority: true, isActive: true })
  .partial()
  .extend({
    direction: categoryRuleInputSchema.shape.direction.removeDefault().optional(),
    priority: categoryRuleInputSchema.shape.priority.removeDefault().optional(),
    isActive: categoryRuleInputSchema.shape.isActive.removeDefault().optional(),
  });
export const categoryTemplateInputSchema = z.object({
  names: z
    .array(
      z.enum([
        'Lebensmittel',
        'Essen gehen',
        'Mode',
        'Technik',
        'Wohnen',
        'Mobilität',
        'Gesundheit',
        'Freizeit',
        'Abonnements',
        'Versicherungen',
      ]),
    )
    .min(1)
    .max(10),
});
export const categoryRuleBackfillSchema = z.object({ confirm: z.literal(true) });
export const categoryRuleBackfillResultSchema = z.object({
  updated: z.number().int(),
  conflicting: z.number().int(),
  protected: z.number().int(),
});
export const contractDirectionSchema = z.enum(['EXPENSE', 'INCOME']);
export const contractKindSchema = z.enum(['SUBSCRIPTION', 'RENT', 'INSURANCE', 'ENERGY', 'TELECOM', 'OTHER']);
export const suggestionKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
export const suggestionQuerySchema = z.object({ dismissed: z.enum(['true', 'false']).optional() });
export const suggestionDecisionSchema = z.object({ decision: z.literal('DISMISSED') });
export const contractIntervalSchema = z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]);
export const contractInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    provider: z.string().trim().min(1).max(200),
    kind: contractKindSchema,
    direction: contractDirectionSchema.optional(),
    accountId: idSchema.nullable().default(null),
    categoryId: idSchema.nullable().default(null),
    startDate: dateSchema,
    endDate: dateSchema.nullable().default(null),
    cancellationDate: dateSchema.nullable().default(null),
    amountCents: positiveCentsSchema,
    intervalMonths: contractIntervalSchema,
    suggestionKey: suggestionKeySchema.optional(),
  })
  .refine(
    /** The end is inclusive and never before the beginning. */ (value) =>
      !value.endDate || value.endDate >= value.startDate,
    { path: ['endDate'], message: 'Ende liegt vor Beginn.' },
  );
export const contractPatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  provider: z.string().trim().min(1).max(200).optional(),
  kind: contractKindSchema.optional(),
  accountId: idSchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  cancellationDate: dateSchema.nullable().optional(),
});
export const contractRevisionInputSchema = z.object({
  effectiveDate: dateSchema,
  amountCents: positiveCentsSchema,
  intervalMonths: contractIntervalSchema,
});
export const contractRevisionSchema = contractRevisionInputSchema.extend({ id: idSchema });
export const contractPaymentSchema = z.object({
  id: idSchema,
  transactionId: idSchema,
  revisionId: idSchema,
  dueDate: dateSchema,
  source: z.enum(['AUTO', 'MANUAL']),
});
export const contractOccurrenceSchema = z.object({
  dueDate: dateSchema,
  amountCents: positiveCentsSchema,
  revisionId: idSchema,
  payment: contractPaymentSchema.nullable(),
});
export const contractSchema = z.object({
  id: idSchema,
  name: z.string(),
  provider: z.string(),
  kind: contractKindSchema,
  direction: contractDirectionSchema.default('EXPENSE'),
  accountId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  cancellationDate: dateSchema.nullable(),
  revisions: z.array(contractRevisionSchema),
  nextDueDate: dateSchema.nullable(),
  nextAmountCents: positiveCentsSchema.nullable(),
  active: z.boolean(),
});
export const contractPaymentsSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  occurrences: z.array(contractOccurrenceSchema),
  payments: z.array(contractPaymentSchema),
});
export const contractPaymentsQuerySchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() });
export const contractPaymentInputSchema = z.object({
  transactionId: idSchema,
  dueDate: dateSchema,
  confirmMismatch: z.boolean().default(false),
});
export const contractSuggestionSchema = z.object({
  key: suggestionKeySchema,
  provider: z.string(),
  amountCents: positiveCentsSchema,
  intervalMonths: contractIntervalSchema,
  startDate: dateSchema,
  accountId: idSchema.nullable(),
  transactionIds: z.array(idSchema).min(2),
  count: z.number().int().min(2),
});
/** Aggregated totals can exceed a single PostgreSQL BIGINT while retaining integer-cent precision. */
export const aggregateCentsSchema = z.string().regex(/^-?(0|[1-9]\d*)$/);
export const categoryBudgetQuerySchema = z.object({
  month: z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/),
});
export const categoryBudgetInputSchema = categoryBudgetQuerySchema
  .extend({ categoryId: idSchema, limitCents: positiveCentsSchema })
  .strict();
export const categoryBudgetSchema = categoryBudgetInputSchema.extend({ id: idSchema });
export const categoryBudgetSummarySchema = categoryBudgetSchema.extend({
  categoryName: z.string(),
  spentCents: aggregateCentsSchema,
});
export const categoryBudgetDeleteSchema = z.object({ confirm: z.literal(true) }).strict();
export const accountPresentationInputSchema = z.object({ reserveEligible: z.boolean() }).strict();
export const accountPresentationSchema = accountPresentationInputSchema.extend({ accountId: idSchema });
export const reserveGoalInputSchema = z.object({ targetCents: positiveCentsSchema }).strict();
export const reserveGoalSettingSchema = reserveGoalInputSchema.extend({ updatedAt: timeSchema });
export const wealthCoverageSchema = z.enum(['COMPLETE', 'PARTIAL']);
export const reserveGoalSchema = reserveGoalSettingSchema.extend({
  asOf: timeSchema,
  currentCents: aggregateCentsSchema.nullable(),
  coverage: wealthCoverageSchema,
  eligibleCount: z.number().int().nonnegative(),
  observedCount: z.number().int().nonnegative(),
  presentations: z.array(accountPresentationSchema),
  excludedAccounts: z.array(
    z.object({ accountId: idSchema, name: z.string(), reason: z.enum(['INACTIVE', 'NON_EUR']) }),
  ),
  components: z.array(
    z.object({
      accountId: idSchema,
      name: z.string(),
      currency: z.literal('EUR'),
      amountCents: centsSchema.nullable(),
      observedAt: timeSchema.nullable(),
      source: z.string().nullable(),
      stale: z.boolean(),
    }),
  ),
});
export const wealthRecordInputSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(1)
      .max(128)
      .refine(
        /** Preserve exact retry identities while rejecting an entirely blank key. */ (value) =>
          value.trim().length > 0,
        'Schlüssel darf nicht leer sein.',
      ),
  })
  .strict();
export const wealthRecordComponentSchema = z.object({
  id: idSchema,
  recordId: idSchema,
  accountId: idSchema.nullable(),
  sourceLabel: z.string().min(1).max(120),
  amountCents: centsSchema.nullable(),
  observedAt: timeSchema.nullable(),
  sourceType: z.string().min(1).max(64),
});
export const wealthRecordSchema = z.object({
  id: idSchema,
  recordedAt: timeSchema,
  totalCents: centsSchema,
  coverage: wealthCoverageSchema,
  idempotencyKey: wealthRecordInputSchema.shape.idempotencyKey,
  components: z.array(wealthRecordComponentSchema),
});
export const wealthRecordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: idSchema.optional(),
});
export const wealthPreviewSchema = z.object({
  asOf: timeSchema,
  provenance: z.literal('OBSERVED_BOOKED_BALANCES'),
  totalCents: aggregateCentsSchema.nullable(),
  coverage: wealthCoverageSchema,
  componentCount: z.number().int().nonnegative(),
  observedCount: z.number().int().nonnegative(),
  recordable: z.boolean(),
  blockingReason: z
    .enum([
      'NO_ACCOUNTS',
      'TOTAL_OUT_OF_RANGE',
      'SOURCE_LABEL_TOO_LONG',
      'SOURCE_TYPE_TOO_LONG',
      'SOURCE_METADATA_INVALID',
    ])
    .nullable(),
  components: z.array(
    z.object({
      accountId: idSchema,
      sourceLabel: z.string(),
      currency: z.string(),
      amountCents: centsSchema.nullable(),
      observedAt: timeSchema.nullable(),
      sourceType: z.string(),
      stale: z.boolean(),
    }),
  ),
});
export const wealthRecordsSchema = z.object({
  items: z.array(wealthRecordSchema),
  nextCursor: idSchema.nullable(),
  preview: wealthPreviewSchema,
});
export const contractCalendarQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    accountId: idSchema.optional(),
    groupId: idSchema.optional(),
  })
  .refine(validAccountScope, 'Konto oder Kontogruppe auswählen.')
  .refine(
    /** Bound recurrence expansion to at most 36 inclusive calendar months. */ (value) =>
      value.from <= value.to &&
      (Number(value.to.slice(0, 4)) - Number(value.from.slice(0, 4))) * 12 +
        Number(value.to.slice(5, 7)) -
        Number(value.from.slice(5, 7)) <
        36,
    { path: ['to'], message: 'Gültigen Zeitraum mit höchstens 36 Kalendermonaten wählen.' },
  );
export const contractCalendarEventSchema = z.object({
  contractId: idSchema,
  name: z.string(),
  provider: z.string(),
  kind: contractKindSchema,
  direction: contractDirectionSchema.default('EXPENSE'),
  accountId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  revisionId: idSchema,
  dueDate: dateSchema,
  plannedCents: positiveCentsSchema,
  payment: z
    .object({
      transactionId: idSchema,
      bookingDate: dateSchema,
      amountCents: centsSchema,
      status: z.enum(['BOOKED', 'PENDING']),
      source: z.enum(['AUTO', 'MANUAL']),
    })
    .nullable(),
});
export const contractCalendarSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  scope: z.object({ accountId: idSchema.nullable(), groupId: idSchema.optional() }),
  provenance: z.literal('CONTRACT_SCHEDULE'),
  totalPlannedCents: aggregateCentsSchema,
  months: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        plannedCents: aggregateCentsSchema,
        eventCount: z.number().int().nonnegative(),
        paymentCount: z.number().int().nonnegative(),
      }),
    )
    .max(36),
  events: z.array(contractCalendarEventSchema).max(10000),
});
export const contractCostSchema = z.object({
  id: idSchema,
  name: z.string(),
  provider: z.string(),
  kind: contractKindSchema,
  categoryId: idSchema.nullable(),
  categoryName: z.string(),
  amountCents: centsSchema,
  intervalMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  monthlyCents: centsSchema,
});
export const contractCostGroupSchema = z.object({
  key: z.string(),
  name: z.string(),
  monthlyCents: aggregateCentsSchema,
  count: z.number().int().nonnegative(),
  contractIds: z.array(idSchema),
});
export const contractSummarySchema = z.object({
  asOf: dateSchema,
  monthlyCents: aggregateCentsSchema,
  monthlyIncomeCents: aggregateCentsSchema.default('0'),
  monthlyRemainderCents: aggregateCentsSchema.optional(),
  incomeCount: z.number().int().nonnegative().default(0),
  count: z.number().int().nonnegative(),
  contracts: z.array(contractCostSchema),
  categories: z.array(contractCostGroupSchema),
  kinds: z.array(contractCostGroupSchema),
});
export const classificationSchema = z.enum(['FIXED', 'VARIABLE', 'UNCLASSIFIED']);
/** Opaque exact-trimmed merchant identity; canonical UTF-8 contents are validated before database access. */
export const merchantKeySchema = z
  .string()
  .regex(/^(unknown|name:[A-Za-z0-9_-]+)$/)
  .describe(
    'unknown or name: plus canonical unpadded base64url UTF-8 of an exact trimmed nonempty source name; NUL is invalid',
  );
export const analyticsOverviewQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    accountId: idSchema.optional(),
    groupId: idSchema.optional(),
    categoryId: idSchema.optional(),
    merchantKey: merchantKeySchema.optional(),
    unassigned: z.enum(['true', 'false']).optional(),
    uncategorized: z.enum(['true', 'false']).optional(),
  })
  .refine(
    /** Mutually exclusive identity and null filters must not silently shadow one another. */ (value) =>
      validAccountScope(value) && !(value.categoryId && value.uncategorized === 'true'),
    'Filter widersprechen sich.',
  )
  .refine(
    /** Explicit ranges obey the same inclusive 36-calendar-month limit in browser and runtime. */ (value) =>
      !value.from ||
      !value.to ||
      (value.from <= value.to &&
        (Number(value.to.slice(0, 4)) - Number(value.from.slice(0, 4))) * 12 +
          Number(value.to.slice(5, 7)) -
          Number(value.from.slice(5, 7)) <
          36),
    { path: ['to'], message: 'Gültigen Zeitraum mit höchstens 36 Kalendermonaten wählen.' },
  );
export const analyticsExclusionSchema = z.enum(['NO_DATA', 'CURRENT', 'FUTURE', 'PARTIAL']);
export const analyticsMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  from: dateSchema,
  to: dateSchema,
  incomeCents: aggregateCentsSchema,
  expenseCents: aggregateCentsSchema,
  netCents: aggregateCentsSchema,
  count: z.number().int(),
  averageEligible: z.boolean(),
  excludedReason: analyticsExclusionSchema.nullable(),
});
export const analyticsOverviewSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  months: z.array(analyticsMonthSchema),
  incomeCents: aggregateCentsSchema,
  expenseCents: aggregateCentsSchema,
  netCents: aggregateCentsSchema,
  average: z.object({
    expenseCents: aggregateCentsSchema.nullable(),
    monthCount: z.number().int(),
    excludedMonths: z.array(z.object({ month: z.string(), reason: analyticsExclusionSchema })),
  }),
  trend: z
    .object({
      month: z.string(),
      previousMonth: z.string(),
      changeCents: aggregateCentsSchema,
      percent: z.number().nullable(),
    })
    .nullable(),
  categories: z.array(
    z.object({
      categoryId: idSchema.nullable(),
      name: z.string(),
      expenseCents: aggregateCentsSchema,
      count: z.number().int(),
      share: z.number(),
    }),
  ),
  classification: z.array(
    z.object({
      classification: classificationSchema,
      expenseCents: aggregateCentsSchema,
      count: z.number().int(),
      share: z.number(),
    }),
  ),
});
/** Detail bookmarks require an explicit effective window instead of silently applying report defaults. */
export const analyticsDetailQuerySchema = analyticsOverviewQuerySchema.safeExtend({
  from: dateSchema,
  to: dateSchema,
  direction: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
});
export const merchantAnalyticsQuerySchema = analyticsOverviewQuerySchema;
export const merchantAnalyticsSchema = z.object({
  scope: z.object({
    from: dateSchema,
    to: dateSchema,
    accountId: idSchema.nullable(),
    groupId: idSchema.optional(),
    categoryId: idSchema.nullable(),
    unassigned: z.boolean(),
    uncategorized: z.boolean(),
    merchantKey: merchantKeySchema.optional(),
  }),
  expenseCents: aggregateCentsSchema,
  merchants: z.array(
    z.object({
      key: merchantKeySchema,
      name: z.string().nullable(),
      label: z.string(),
      expenseCents: aggregateCentsSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
});
export const transactionQuerySchema = z
  .object({
    classification: classificationSchema.optional(),
    merchantKey: merchantKeySchema.optional(),
    accountId: idSchema.optional(),
    groupId: idSchema.optional(),
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
    (query) => validAccountScope(query),
    'Konto und Ohne-Konto-Filter nicht gleichzeitig auswählen.',
  )
  .refine(
    /** Reject inverted date ranges. */
    (query) => !query.from || !query.to || query.from <= query.to,
    'Ungültiger Zeitraum.',
  );
export const transactionPageSchema = z.object({ items: z.array(transactionSchema), nextCursor: idSchema.nullable() });
export const monthlyQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    accountId: idSchema.optional(),
    groupId: idSchema.optional(),
  })
  .refine(validAccountScope, 'Konto oder Kontogruppe auswählen.');
export const monthlyReviewQuerySchema = monthlyQuerySchema;
export const monthlyReviewSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  scope: z.object({ from: dateSchema, to: dateSchema, accountId: idSchema.nullable(), groupId: idSchema.optional() }),
  incomeCents: aggregateCentsSchema,
  expenseCents: aggregateCentsSchema,
  netCents: aggregateCentsSchema,
  bookedCount: z.number().int().nonnegative(),
  completeness: z.object({
    calendar: z.enum(['CLOSED', 'CURRENT', 'FUTURE']),
    hasBookings: z.boolean(),
    historyComplete: z.literal(false),
  }),
  provenance: z.object({
    basis: z.literal('BOOKED_NON_TRANSFER'),
    includesUnassigned: z.boolean(),
    refunds: z.literal('INCOME'),
  }),
  queries: z.object({ income: transactionQuerySchema, expense: transactionQuerySchema }),
});
export const monthlySchema = z.object({
  month: z.string(),
  bookedCount: z.number().int().nonnegative().optional(),
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
export const bankSetupSchema = z.object({
  configured: z.boolean(),
  bankCode: z.literal('69050001'),
  missing: z.array(z.enum(['PRODUCT_ID', 'BANK_ENDPOINT'])),
});
export const bankChallengeSchema = z.object({
  type: z.enum(['TAN', 'APP_APPROVAL', 'SELECT_METHOD', 'SELECT_MEDIA']),
  message: z.string().max(1000),
  methods: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().max(200),
        media: z.array(z.string().max(100)).optional(),
        mediaRequired: z.boolean().optional(),
      }),
    )
    .optional(),
  media: z.array(z.string().max(100)).optional(),
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
  challenge: bankChallengeSchema.nullable(),
});
export const rollbackInputSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  confirm: z.literal(true),
  linked: z.enum(['KEEP', 'REMOVE']).default('KEEP'),
  confirmLinks: z.boolean().default(false),
});
export const rollbackPreviewSchema = z.object({
  runId: idSchema,
  token: z.string().regex(/^[a-f0-9]{64}$/),
  owned: z.number().int().nonnegative(),
  shared: z.number().int().nonnegative(),
  uncertain: z.number().int().nonnegative(),
  linked: z.number().int().nonnegative(),
  manual: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: idSchema,
      description: z.string(),
      amountCents: centsSchema,
      bookingDate: dateSchema,
      protection: z.enum(['SHARED', 'UNCERTAIN']).nullable(),
      contractName: z.string().nullable(),
      transfer: z.boolean(),
      manual: z.boolean(),
    }),
  ),
  truncated: z.boolean(),
});
export const rollbackResultSchema = z.object({
  deleted: z.number().int().nonnegative(),
  retained: z.number().int().nonnegative(),
});
export const csvMappingSchema = z.object({
  bookingDate: z.string().min(1),
  amount: z.string().min(1),
  description: z.string().min(1),
  descriptionFallback: z.string().optional(),
  valueDate: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyIban: z.string().optional(),
  reference: z.string().optional(),
  currency: z.string().optional(),
});
export const csvEncodingSchema = z.enum(['utf-8', 'windows-1252', 'iso-8859-15', 'utf-16le', 'utf-16be']);
export const csvDelimiterSchema = z.enum([';', ',', '\t']);
export const csvPreviewInputSchema = z.object({
  accountId: idSchema.nullable().optional().default(null),
  content: z.string().max(10485760),
  encoding: csvEncodingSchema.default('utf-8'),
  delimiter: csvDelimiterSchema.default(';'),
  mapping: csvMappingSchema,
});
export const csvPreviewSchema = z.object({
  run: runSchema,
  headers: z.array(z.string()),
  rows: z.array(transactionSchema.omit({ id: true, categoryId: true, isTransfer: true, transferGroupId: true })),
  totalRows: z.number().int(),
  invalidRows: z.number().int(),
  period: z.object({ from: dateSchema, to: dateSchema }).nullable().optional(),
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
        classificationChoice: z.enum(['BANK', 'CSV']).optional(),
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
  method: 'get' | 'post' | 'patch' | 'delete' | 'put';
  path: string;
  request?: z.ZodType;
  query?: z.ZodType;
  response: z.ZodType;
  status: number;
  public?: boolean;
}
export const okSchema = z.object({ ok: z.boolean() });
/** Operation inventory shared with generated OpenAPI and contract tests. */
export const apiContracts: Record<string, ApiContract> = {
  monthlyReview: {
    method: 'get',
    path: '/analytics/review',
    query: monthlyReviewQuerySchema,
    response: monthlyReviewSchema,
    status: 200,
  },
  merchantAnalytics: {
    method: 'get',
    path: '/analytics/merchants',
    query: merchantAnalyticsQuerySchema,
    response: merchantAnalyticsSchema,
    status: 200,
  },
  analyticsOverview: {
    method: 'get',
    path: '/analytics/overview',
    query: analyticsOverviewQuerySchema,
    response: analyticsOverviewSchema,
    status: 200,
  },
  contracts: { method: 'get', path: '/contracts', response: z.array(contractSchema), status: 200 },
  contractSummary: {
    method: 'get',
    path: '/contracts/summary',
    query: accountScopeQuerySchema,
    response: contractSummarySchema,
    status: 200,
  },
  contractCalendar: {
    method: 'get',
    path: '/contracts/calendar',
    query: contractCalendarQuerySchema,
    response: contractCalendarSchema,
    status: 200,
  },
  createContract: {
    method: 'post',
    path: '/contracts',
    request: contractInputSchema,
    response: contractSchema,
    status: 201,
  },
  contractSuggestions: {
    method: 'get',
    path: '/contracts/suggestions',
    query: suggestionQuerySchema,
    response: z.array(contractSuggestionSchema),
    status: 200,
  },
  dismissContractSuggestion: {
    method: 'put',
    path: '/contracts/suggestions/{key}/decision',
    request: suggestionDecisionSchema,
    response: okSchema,
    status: 200,
  },
  restoreContractSuggestion: {
    method: 'delete',
    path: '/contracts/suggestions/{key}/decision',
    response: okSchema,
    status: 200,
  },
  contract: { method: 'get', path: '/contracts/{id}', response: contractSchema, status: 200 },
  patchContract: {
    method: 'patch',
    path: '/contracts/{id}',
    request: contractPatchSchema,
    response: contractSchema,
    status: 200,
  },
  deleteContract: {
    method: 'delete',
    path: '/contracts/{id}',
    request: z.object({ confirm: z.literal(true) }),
    response: okSchema,
    status: 200,
  },
  reviseContract: {
    method: 'post',
    path: '/contracts/{id}/revisions',
    request: contractRevisionInputSchema,
    response: contractSchema,
    status: 201,
  },
  contractPayments: {
    method: 'get',
    path: '/contracts/{id}/payments',
    query: contractPaymentsQuerySchema,
    response: contractPaymentsSchema,
    status: 200,
  },
  linkContractPayment: {
    method: 'post',
    path: '/contracts/{id}/payments',
    request: contractPaymentInputSchema,
    response: contractPaymentSchema,
    status: 201,
  },
  unlinkContractPayment: {
    method: 'delete',
    path: '/contracts/{id}/payments/{paymentId}',
    response: okSchema,
    status: 200,
  },
  categoryRules: { method: 'get', path: '/category-rules', response: z.array(categoryRuleSchema), status: 200 },
  createCategoryRule: {
    method: 'post',
    path: '/category-rules',
    request: categoryRuleInputSchema,
    response: categoryRuleSchema,
    status: 201,
  },
  patchCategoryRule: {
    method: 'patch',
    path: '/category-rules/{id}',
    request: categoryRulePatchSchema,
    response: categoryRuleSchema,
    status: 200,
  },
  deleteCategoryRule: { method: 'delete', path: '/category-rules/{id}', response: okSchema, status: 200 },
  applyCategoryRules: {
    method: 'post',
    path: '/category-rules/apply',
    request: categoryRuleBackfillSchema,
    response: categoryRuleBackfillResultSchema,
    status: 201,
  },
  categoryTemplates: {
    method: 'post',
    path: '/categories/templates',
    request: categoryTemplateInputSchema,
    response: z.array(categorySchema),
    status: 201,
  },
  bulkClassification: {
    method: 'post',
    path: '/transactions/bulk-classification',
    request: bulkClassificationSchema,
    response: z.object({ updated: z.number().int() }),
    status: 201,
  },
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
  bankSetup: { method: 'get', path: '/bank-setup', response: bankSetupSchema, status: 200 },
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
  accountPresentation: {
    method: 'patch',
    path: '/accounts/{id}/presentation',
    request: accountPresentationInputSchema,
    response: accountPresentationSchema,
    status: 200,
  },
  reserveGoal: { method: 'get', path: '/reserve-goal', response: reserveGoalSchema, status: 200 },
  workspaceProfile: { method: 'get', path: '/workspace/profile', response: workspaceProfileSchema, status: 200 },
  accountGroups: { method: 'get', path: '/account-groups', response: z.array(accountGroupSchema), status: 200 },
  notifications: {
    method: 'get',
    path: '/notifications',
    query: notificationsQuerySchema,
    response: notificationsSchema,
    status: 200,
  },
  acknowledgeNotification: {
    method: 'put',
    path: '/notifications/acknowledgement',
    request: notificationAcknowledgementInputSchema,
    response: notificationAcknowledgementSchema,
    status: 200,
  },
  createAccountGroup: {
    method: 'post',
    path: '/account-groups',
    request: accountGroupInputSchema,
    response: accountGroupSchema,
    status: 201,
  },
  patchAccountGroup: {
    method: 'patch',
    path: '/account-groups/{id}',
    request: accountGroupPatchSchema,
    response: accountGroupSchema,
    status: 200,
  },
  deleteAccountGroup: {
    method: 'delete',
    path: '/account-groups/{id}',
    request: accountGroupDeleteSchema,
    response: okSchema,
    status: 200,
  },
  saveWorkspaceProfile: {
    method: 'patch',
    path: '/workspace/profile',
    request: workspaceProfileInputSchema,
    response: workspaceProfileSchema,
    status: 200,
  },
  setReserveGoal: {
    method: 'put',
    path: '/reserve-goal',
    request: reserveGoalInputSchema,
    response: reserveGoalSchema,
    status: 200,
  },
  wealthRecords: {
    method: 'get',
    path: '/wealth-records',
    query: wealthRecordsQuerySchema,
    response: wealthRecordsSchema,
    status: 200,
  },
  captureWealth: {
    method: 'post',
    path: '/wealth-records',
    request: wealthRecordInputSchema,
    response: wealthRecordSchema,
    status: 201,
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
  setTransactionSplits: {
    method: 'put',
    path: '/transactions/{id}/splits',
    request: transactionSplitsInputSchema,
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
  categoryBudgets: {
    method: 'get',
    path: '/budgets',
    query: categoryBudgetQuerySchema,
    response: z.array(categoryBudgetSummarySchema),
    status: 200,
  },
  setCategoryBudget: {
    method: 'put',
    path: '/budgets',
    request: categoryBudgetInputSchema,
    response: categoryBudgetSchema,
    status: 200,
  },
  deleteCategoryBudget: {
    method: 'delete',
    path: '/budgets/{id}',
    request: categoryBudgetDeleteSchema,
    response: okSchema,
    status: 200,
  },
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
  rollbackPreview: {
    method: 'get',
    path: '/imports/{id}/rollback-preview',
    response: rollbackPreviewSchema,
    status: 200,
  },
  rollbackImport: {
    method: 'post',
    path: '/imports/{id}/rollback',
    request: rollbackInputSchema,
    response: rollbackResultSchema,
    status: 201,
  },
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
