# Data Model

Status: source implementation in progress. T026 implements the reserve/wealth expansion and T036 adds workspace metadata, validated in disposable databases only. Workspace services and UI remain their owning tasks. Existing financial entities and identifiers are preserved. Single-owner/shared-ledger access is unchanged. No production migration is implied.

## Existing Records

`Account`, `BalanceSnapshot`, `Transaction`, `Category`, `CategoryRule`, `TransferGroup`, `ImportRun`, assignment receipts, contracts/revisions/payments, `User`, and `Session` remain authoritative. Existing balance observations retain required import provenance. No migration backfills fabricated historical wealth or demo records.

## Proposed Persistent Records

| Entity                      | Fields and validation                                                                                                                | Relationships / invariants                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OwnerProfile                | userId UUID primary key, displayName 1–80 trimmed characters, optional validated contactEmail <=254 characters, updatedAt            | One-to-one existing User. Contact email is display/contact data, not a new login/recovery channel.                                                           |
| AccountGroup                | id UUID, name 1–60 trimmed characters, sortOrder nonnegative integer, timestamps                                                     | Group membership references existing accounts. Reject duplicate names ignoring case in the service. Delete group without deleting accounts.                  |
| AccountGroupMember          | groupId UUID, accountId UUID                                                                                                         | Composite unique key; group deletion cascades memberships, account deletion removes membership. Aggregate selected account IDs as a set.                     |
| AccountPresentation         | accountId UUID primary key, reserveEligible boolean default false                                                                    | Explicit Tagesgeld designation; existing unknown savings types remain unclassified, not automatically eligible. Account currency must be EUR to contribute.  |
| ReserveGoal                 | fixed singleton key, targetCents positive BigInt, updatedAt                                                                          | Default 300000 cents; eligibility from AccountPresentation. No artificial balance row. No stored derived current total.                                      |
| WealthRecord                | id UUID, recordedAt timestamp, totalCents signed BigInt, coverage COMPLETE/PARTIAL, idempotencyKey unique bounded string             | Frozen point-in-time observation. Total equals exact component sum; empty/unknown coverage is explicit. Repeated key returns the same record.                |
| WealthRecordComponent       | id UUID, recordId UUID, nullable accountId UUID, sourceLabel, amountCents nullable BigInt, observedAt nullable timestamp, sourceType | Missing amount means unknown, never zero. Retain sourceLabel/amount/date on account removal; account link uses SetNull. Components immutable after creation. |
| NotificationAcknowledgement | userId UUID, sourceKey bounded string, acknowledgedAt timestamp                                                                      | Composite unique key. Source key uses event kind + source identity + revision/due date; financial sources are not mutated.                                   |

Application validations bound strings, reject unsupported IDs and unknown fields, and validate public outputs. Monetary fields use integer cents and decimal strings on transport. Profile fields are never logged. New relationships are additive, preserve all existing rows, and use explicit delete behavior.

Task-generation clarification: new `idempotencyKey` values are limited to 128 characters, new `sourceLabel` values to 120, new `sourceType` values to 64, and notification `sourceKey` values to 256. These bounds apply to the proposed records and shared transport schemas, not existing imported bank/source fields. Invalid or overlong keys reject without truncation or mutation.

## Derived Reports

- **Merchant bucket**: opaque identity, nullable exact trimmed counterparty name, display label, expenseCents string, count, and contributing scope. Unknown counterparty is a dedicated bucket; no fuzzy grouping.
- **Monthly review**: inclusive dates, selected account/group scope, income/expense/net strings, transfer exclusion, completeness and provenance labels.
- **Reserve progress**: target, known observed sum, eligible account observations, missing/stale disclosure; negative balances remain signed. Percentage may be clamped visually while signed actual values remain visible.
- **Contract calendar**: existing contract ID and recurrence-derived due date, planned amount, actual payment link/status where present. No duplicate calendar recurrence engine.
- **Notification**: source-derived stable key, kind, title, target route, source revision/date, acknowledgement state. Initial sources: import issues and upcoming contract obligations. No push/email scheduler.

## Device Preferences

A versioned preference object contains language `de|en`, maskAmounts boolean, ordered unique analysis module IDs, chart choice, and validated custom light/dark semantic colors. Preserve `haushaltsbuch-palette` and `haushaltsbuch-theme`; define fallback/migration for older values. Bootstrap masking before financial content becomes visible. Custom colors must meet 4.5:1 normal text and 3:1 large text/control contrast against applicable backgrounds; invalid values never replace a working theme. These fields do not contain real financial amounts or credentials.

T006 supplies a null custom-tone slot until T041's contrast-validated editor is delivered; arbitrary stored colors are never applied early. Device-local in-app notification choices are `payments` and `imports` booleans, without push/email scheduling. Full translated labels and accessible masked amount strings are integrated by T042; early display masking is not an authorization boundary.

## Isolated Synthetic State

`DemoState`: schemaVersion, revision, seed identity, synthetic accounts/cash, security catalog, positions, orders, savings plans, activity, market scenario basis points, recorded demo snapshots (maximum 48), and local role demonstration entries. Use a dedicated storage key with no session or real entity IDs.

- Quantities: whole integers 1–1000 per order. Prices and balances: integer-cent strings; calculate with BigInt.
- Scenario: integer basis points -3000 through +3000; deterministic cent rounding. A scenario changes valuation, not a real quote or ledger record.
- Plan: positive cent amount, supported synthetic security and valid execution day. Execution uses an explicit action; no implicit background trading. A plan execution key prevents duplicate execution of the same plan period.
- Buy/sell/transfer: validate entire operation before constructing and committing one next state. Insufficient cash/holdings or identical transfer accounts reject without partial mutation.
- Persistence: parse and validate before use; corrupt/unsupported state offers confirmed demo reset. Blocked storage keeps in-memory operation with a visible persistence notice. Persisted revision detects stale-tab edits before commit; conflicting writers must reload or retry, not silently overwrite.
- Demo history: append only when aggregate value changes; cap at 48; label as recorded simulation values, not bank history.

## State Transitions and Preservation

- Real saves: idle -> validating -> saving -> saved or recoverable error. Retain user drafts on failure.
- Recorded wealth: preview -> explicit record -> immutable saved record. Capturing reads all eligible observations in one consistent database transaction; never duplicate on retry.
- Demo order: draft -> validated -> committed activity or rejected unchanged state.
- Demo reset: confirmation -> replace only dedicated synthetic state with seed; cancel preserves state.
- Password change: reuse existing service/session revocation behavior; local roles never affect authorization.

## Migration Validation and Rollback

Add tables/columns without dropping or rewriting existing financial fields. Apply migration over a populated disposable pre-feature database and compare every existing row/field, counts, IDs, and balances before/after. Validate new uniqueness and foreign keys. Previous application should continue reading old fields; disable feature UI before binary rollback. Do not provide a destructive down migration that erases new user data. Production migration/deployment is a separate authorized operation.
