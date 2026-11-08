# Finanzfluss feature migrations

## F3: 202611080001_category_rules

Additive PostgreSQL migration: new CategoryRule table and transaction provenance/classification columns. The migration marks every existing non-null category MANUAL; existing unassigned categories remain NONE. It changes no IDs, amounts, dates, source identities, transfer links or original timestamps. SQL constraints bound the stored enums; rule category deletion cascades rules, while historical rule ID/name snapshots intentionally have no cascading foreign key.

Local proof uses the actual SQL against both clean and populated initial PostgreSQL fixtures, including an amount beyond JavaScript's safe integer range. Migration history is retained; generated Prisma follows the source schema. Production row volume/lock time is not established by these small synthetic fixtures.

Deployment remains separately gated: publish tested immutable images, obtain concrete rollout approval, stop writers, make a fresh encrypted backup and isolated restore verification, run the matching migration image once, start new API/web together and compare original records/identities/annotations. Do not run schema synchronization or destructive resets. No production migration has been executed by this source task.

Old consumers can read the expanded schema, but old writers do not maintain new manual-null/provenance semantics. If application rollback is required, pause writes and use a reviewed forward fix or coordinated recovery; do not promise safe mixed-version writes or drop the new columns to roll back. Restoring pre-migration data requires the verified backup and explicitly accepted handling of any later writes.

## F4: 202611080002_contracts

Adds Contract, time-effective ContractRevision and unique ContractPayment, plus a transaction-level automatic-link block. Forecasts remain derived calendar values and never become bank transactions. Existing financial fields and category/classification metadata remain unchanged. SQL enforces positive forecast amounts, supported intervals, inclusive end ordering, one transaction per occurrence and one contract per actual transaction. Transaction deletion is restricted while linked; service-level contract removal deletes only links/rules and preserves bookings. Old/new mixed writers remain unsupported for attribution semantics; use the same paused-writer migration and recovery gate as F3. Production execution remains unperformed.

Local cases cover month-end/leap years, effective revisions, inclusive endings, duplicate candidate ambiguity, real import hooks, explicit mismatch confirmation, auto-relink blocking, transaction preservation and moving a single contract link during consolidation. Competing links cause atomic rejection before either source is deleted.

## UX1 — 202611080003_import_rollback

Adds nullable creating-import ownership and its index/FK. Conservative SQL backfill requires a single known direct source and transaction creation inside a completed CSV run; ambiguous legacy rows stay unknown. Original monetary fields, timestamps and annotations are unchanged. New ingest records explicit ownership and accountless observations; merged/assigned rows retain source evidence. Rollback is an explicit authenticated/CSRF-protected user action, never migration/startup behavior. It previews protected/manual/linked rows, fingerprints the whole affected state, and atomically removes only owned rows under serializable account/row locks. Retained canonical references remain usable; removed run observations and staging are cleaned. Contract deletion is never implied. Application rollback must still use the paused-writer/compatible recovery procedure.

Verified: actual populated immediately preceding schema upgrade with an exact large BIGINT and unknown-origin record; six dedicated real-database/API/concurrency cases; full 120-case suite before the added sixth case, plus its focused pass; all four desktop/mobile import journeys; lint/types/production builds. No production execution by UX1.
