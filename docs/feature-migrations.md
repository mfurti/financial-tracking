# Finanzfluss feature migrations

> **Execution status, 2026-11-08:** All four feature migrations described below have now been applied during the separately approved PR #10/#11 rollouts; latest production is `d193639`. Earlier “no production execution” statements describe the individual source tasks, not the current server. Populated backup/row preservation evidence and remaining gates: [status.md](status.md). Migration and recovery rules below still apply.

## F3: 202611080001_category_rules

Additive PostgreSQL migration: new CategoryRule table and transaction provenance/classification columns. The migration marks every existing non-null category MANUAL; existing unassigned categories remain NONE. It changes no IDs, amounts, dates, source identities, transfer links or original timestamps. SQL constraints bound the stored enums; rule category deletion cascades rules, while historical rule ID/name snapshots intentionally have no cascading foreign key.

Local proof uses the actual SQL against both clean and populated initial PostgreSQL fixtures, including an amount beyond JavaScript's safe integer range. Migration history is retained; generated Prisma follows the source schema. Production row volume/lock time is not established by these small synthetic fixtures.

F3 was subsequently applied during the approved PR #10 rollout. Future deployment remains separately gated: publish tested immutable images, obtain concrete rollout approval, stop writers, make a fresh encrypted backup and isolated restore verification, run the matching migration image once, start new API/web together and compare original records/identities/annotations. Do not run schema synchronization or destructive resets.

Old consumers can read the expanded schema, but old writers do not maintain new manual-null/provenance semantics. If application rollback is required, pause writes and use a reviewed forward fix or coordinated recovery; do not promise safe mixed-version writes or drop the new columns to roll back. Restoring pre-migration data requires the verified backup and explicitly accepted handling of any later writes.

## F4: 202611080002_contracts

Adds Contract, time-effective ContractRevision and unique ContractPayment, plus a transaction-level automatic-link block. Forecasts remain derived calendar values and never become bank transactions. Existing financial fields and category/classification metadata remain unchanged. SQL enforces positive forecast amounts, supported intervals, inclusive end ordering, one transaction per occurrence and one contract per actual transaction. Transaction deletion is restricted while linked; service-level contract removal deletes only links/rules and preserves bookings. Old/new mixed writers remain unsupported for attribution semantics; use the same paused-writer migration and recovery gate as F3. F4 was subsequently applied during the approved PR #10 rollout.

Local cases cover month-end/leap years, effective revisions, inclusive endings, duplicate candidate ambiguity, real import hooks, explicit mismatch confirmation, auto-relink blocking, transaction preservation and moving a single contract link during consolidation. Competing links cause atomic rejection before either source is deleted.

## UX1 — 202611080003_import_rollback

Adds nullable creating-import ownership and its index/FK. Conservative SQL backfill requires a single known direct source and transaction creation inside a completed CSV run; ambiguous legacy rows stay unknown. Original monetary fields, timestamps and annotations are unchanged. New ingest records explicit ownership and accountless observations; merged/assigned rows retain source evidence. Rollback is an explicit authenticated/CSRF-protected user action, never migration/startup behavior. It previews protected/manual/linked rows, fingerprints the whole affected state, and atomically removes only owned rows under serializable account/row locks. Retained canonical references remain usable; removed run observations and staging are cleaned. Contract deletion is never implied. Application rollback must still use the paused-writer/compatible recovery procedure.

Initial source verification: actual populated immediately preceding schema upgrade with an exact large BIGINT and unknown-origin record; six dedicated real-database/API/concurrency cases; full 120-case suite before the added sixth case, plus its focused pass; all four desktop/mobile import journeys; lint/types/production builds. The final candidate subsequently passed all eight rollback cases and the complete 131-case main CI. UX1 was applied during the approved PR #11 rollout.

## UX4 — 202611080004_suggestion_decisions

Adds durable hash-keyed DISMISSED/CONFIRMED decisions with a checked state/contract relation. A confirmed decision references its actual contract and cascades only when that contract is removed. No existing financial row is changed. Signatures include normalized provider, account, exact amount and rhythm; further same-pattern payments do not resurrect a dismissal. A changed pattern can reappear. Contract creation validates a current proposal and commits its acceptance/payment matching atomically; repeating an already confirmed key returns the existing contract. PUT/DELETE decisions share authenticated CSRF protection, advisory locking and serializable writes. OpenAPI uses a 64-character hash parameter rather than a UUID. Four dedicated real database/HTTP cases passed, plus existing contract/summarization cases; deletion retains the established auto-link block on old payments. UX4 was applied during the approved PR #11 rollout.
