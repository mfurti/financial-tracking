# Proposed API Contracts

All paths below are relative to the existing authenticated API. The browser continues to use the existing same-origin proxy. Existing session, CSRF, input/output Zod validation, error handling, and privacy rules apply. These are proposed additions, not currently implemented endpoints. Existing routes remain compatible.

## Common Shapes

- IDs: UUID unless an explicitly opaque merchant/source key.
- Money: decimal integer-cent strings, e.g. `"300000"`; no JSON floating-point amounts.
- Calendar dates: `YYYY-MM-DD`, inclusive, Europe/Berlin semantics. Observation timestamps: ISO UTC timestamps.
- Mutations reject unknown fields, invalid IDs, invalid ranges and nonexistent references before changing state. Errors use the existing application error envelope, with no private record payloads.
- New wealth-record idempotency keys are limited to 128 characters; new component source labels/types to 120/64 characters and notification source keys to 256. Reject overlong values without truncation; these limits do not change existing imported source fields.
- Reuse existing 36-month maximum analytics range and pagination limits. Query `accountId` and `groupId` are mutually exclusive. Group expansion deduplicates active member IDs; an explicitly empty group means no matches, never all accounts.

## Existing Interfaces to Reuse

`GET /accounts`, `GET /accounts/:id/balances`, transaction list/detail/patch routes, transfer routes, analytics overview/monthly routes, category/rule routes, import/rollback/assignment routes, contract/review/payment routes, banking authorization routes, and `/auth/session`, `/auth/password`, `/auth/logout`. Exact existing request/response schemas remain in `packages/contracts/src/index.ts`.

## Reporting Additions

| Method / route                      | Request                                                       | Response / rules                                                                                            |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET /analytics/review               | month `YYYY-MM`, optional accountId/groupId                   | Inclusive range, exact income/expense/net, actual scope, completeness, and contributing detail queries.     |
| GET /analytics/merchants            | Existing range/category/account filters plus optional groupId | Expense merchant buckets with opaque key, nullable name, exact expenseCents/count, and the effective scope. |
| GET /transactions (additive filter) | merchantKey plus existing filters                             | Existing paginated transaction envelope; exact shared merchant predicate, not text search.                  |
| GET /contracts/calendar             | from/to plus optional accountId/groupId                       | Bounded due events computed with existing schedule logic, planned amount and observed payment references.   |

Merchant keys encode a validated exact normalized source name or an explicit unknown sentinel; the service rejects malformed keys. The same canonical predicate is used by report and list queries. Scope is echoed in reports and copied into detail links. Preserve existing no-argument report defaults.

T013 implements merchant reporting and the additive transaction filter. Keys are `unknown` or `name:` followed by canonical unpadded base64url UTF-8 of the exact trimmed nonempty name. Case and internal whitespace remain significant; invalid UTF-8, NUL, noncanonical encodings and encoded blank names reject with HTTP 400 before database reads. Null and trim-only names share the unknown bucket. SQL trimming uses the same ECMAScript whitespace set as aggregation, and the exact predicate applies before cursor pagination. Reports echo effective inclusive dates/account/category/null filters, preserve decimal-string expense totals and exclude transfers, pending records and positive refunds. Refunds remain available through the same merchant key with an income-direction detail query.

T014 implements monthly review for a required validated `month` and optional `accountId`. It returns exact inclusive dates and income/expense/net cents, the booked non-transfer count, effective account identity and separate contributing income/expense queries. Calendar completeness is `CLOSED`, `CURRENT` or `FUTURE`; `hasBookings` describes observed data and `historyComplete` remains false because imported rows never prove complete bank history. Provenance identifies booked non-transfer actuals, whether accountless records contribute and refunds as income. Empty months remain exact zero actuals with no claimed observations. Existing monthly/overview defaults and response shapes are retained; group scope is integrated by T038.

T016 adds optional `merchantKey` to the existing overview query, using the same canonical predicate before aggregation so income refunds and expense details reconcile independently. Merchant reporting accepts the same optional restriction and echoes it in scope only when supplied; default responses remain unchanged. Direct `/analytics/details` bookmarks use a shared required-from/to schema with direction `INCOME|EXPENSE`, defaulting to expense. The browser never derives a full-period sum from a paginated page. Validated internal return bookmarks preserve date/account/category/merchant/direction through booking details; external or malformed return destinations are discarded.

## Workspace Additions

| Method / route                     | Request                              | Response / rules                                                                                                                  |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| GET /workspace/profile             | None                                 | Current owner's display profile; no credential/hash fields.                                                                       |
| PATCH /workspace/profile           | displayName, optional contactEmail   | Validated saved profile; does not alter username/auth identity.                                                                   |
| GET /account-groups                | None                                 | Groups and unique member IDs.                                                                                                     |
| POST /account-groups               | name, accountIds, optional sortOrder | Saved group; validates all references atomically.                                                                                 |
| PATCH /account-groups/:id          | Editable group fields                | Saved group; memberships replace atomically.                                                                                      |
| DELETE /account-groups/:id         | Existing confirmation in UI          | Existing success envelope; financial rows unchanged.                                                                              |
| PATCH /accounts/:id/presentation   | reserveEligible boolean              | Saved presentation designation; no imported financial field changes.                                                              |
| GET /reserve-goal                  | None                                 | Positive target and eligible observed balance components with dates/missing coverage.                                             |
| PUT /reserve-goal                  | targetCents positive integer string  | Saved goal and current observation-based progress.                                                                                |
| GET /wealth-records                | Existing pagination convention       | Immutable recorded values, coverage and timestamp; no fabricated intervals.                                                       |
| POST /wealth-records               | idempotencyKey only                  | Server-derived immutable record/components from a consistent current observation read. Client cannot supply real balance amounts. |
| GET /notifications                 | Existing pagination convention       | Source-derived application items and acknowledgement state.                                                                       |
| PUT /notifications/acknowledgement | sourceKey                            | Idempotent acknowledgement for a validated source-derived key.                                                                    |

Responses use named shared Zod schemas, inferred transport types, controller input/output validation, and matching OpenAPI declarations. Implementation must verify authorization and absence of side effects when unauthenticated or CSRF-invalid. Multi-user and trading endpoints do not exist in this design.

## Browser-Local Interfaces

Demo actions expose typed state transitions, not HTTP endpoints: buy, sell, create/edit/delete/execute savings plan, transfer synthetic cash, create synthetic account, set scenario, record demo value, confirm reset, edit local role demonstration. Each returns a validated next state or structured user-facing validation error. No action imports `useApi` or real financial entity identifiers.

Preferences expose versioned read/validate/migrate/save functions and subscriptions for language, privacy, modules, chart choice and custom appearance. Blocked storage has an explicit in-memory fallback. Privacy masking covers amounts, chart tooltips, labels and accessible names; it is a display preference, not an access-control feature.

## Compatibility Evidence Required

Tests must prove existing clients accept unchanged existing responses, new filters match aggregate/detail scopes, malformed input does not mutate state, all persistent routes enforce current session/CSRF rules, and exported OpenAPI agrees with shared Zod contracts. Generate OpenAPI using the repository's existing exporter rather than maintaining a competing schema.
