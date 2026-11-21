# Deployment Implementation Evidence

## Authorization and checkout

- Feature: 002-integrated-deployment; [issue #15](https://github.com/mfurti/financial-tracking/issues/15).
- Existing checkout: V:/GitHub/financial-tracking; GitHub-linked branch 15-deploy-integrated-household-finance-workspace.
- Verified main/application candidate: c06e7cc0d0639e4be8092473de696f4b6a3912b0. Planning commit 74594f3b7006c2b5502b8c2eec9d7086c2e6457b was pushed and verified; adbe3f887b39277c6abbe6da79af2c09dee4c7d8 subsequently recorded the separately requested future PWA backlog.
- G0: the user explicitly approved the deployment issue, linked branch and separate planning commit/push.
- G1: the user subsequently invoked speckit-implement and coding-workflow, accepting the presented preparation scope T001–T009: scoped code/docs, read-only target discovery and protected isolated archive recovery. Existing access may be used within that scope; no secret values or private rows are published.
- G2: not granted. No production writer pause, target backup creation, runtime replacement, migration, external reopening or recovery cutover is authorized.
- Human acceptance: pending; no owner observation is inferred from implementation approval.
- Existing documented project/deployment rules govern execution; the constitution remains an unratified template.

## Execution state and evidence policy

Current state: prepared; candidate release and read-only target baseline are established. Recovery rehearsal is not yet completed. The complete state sequence is:

draft → prepared → recovery-rehearsed → awaiting-production-approval → approved → writers-paused → final-backup-verified → migrated → internally-verified → reopened → technically-accepted.

Preflight failure stays blocked without production mutation. Migration/readiness failure enters paused-failure with external access stopped. Recovery uses proven actual-image compatibility or isolated restore; after reopening, new writes require preservation/reconciliation. A historical backup is not proof of the later final paused checkpoint.

Record nonsecret workflow/revision/artifact/digest identities, inventory/coverage/equality outcomes, measured timings and approval provenance. Private archives, identities, configuration and financial row contents remain outside tracked evidence. No successful restore, deployment or personal acceptance is prefilled.

Every completed file-changing task receives a scoped commit and immediate verified push. Record the actual commit SHA in issue #15 after push; do not invent a self-referential hash in this file. Task checkboxes change only after validation and successful push. Read-only proof does not require an empty commit.

## T001 — Setup and gate validation

- prerequisites helper resolved this feature with RequireTasks/IncludeTasks; all expected design documents and 17 ordered tasks are present.
- requirements.md: 15 checked, zero unchecked, PASS. Checklist markers were read only.
- Existing .gitignore/.dockerignore, ESLint flat-config ignores and .prettierignore cover dependencies, generated runtime output, local artifacts, secret/environment paths and logs. No missing critical exclusion was found; no npm publish, Terraform or Helm setup is introduced.
- Branch HEAD before implementation was adbe3f887b39277c6abbe6da79af2c09dee4c7d8, checkout clean. Original integrated tasks remain 48/48 completed and are not regenerated; deployment tasks remain distinct.
- No .specify/extensions.yml exists, so no pre-implementation hook is registered.
- This increment creates the ledger and records G1 in feature metadata. It does not run recovery or contact/change production.

## T002 — Candidate release verification

- Exact main verify/operations/publish passed; artifact ZIP checksum matches GitHub metadata, inner archive/REVISION/runtime allowlist passed, and all three GHCR labels were independently read and matched.
- See [release-readiness.md](release-readiness.md) for actual immutable references and limits. No production runtime changed.
- T001 was separately committed and immediately pushed as d46135acac75825605da579154a03119937abb63; its checkbox changed only after successful push.

## T003 — Read-only target inventory

- Actual application revision d193639, four healthy services, preserved production volume/network topology and byte-identical candidate/deployed Compose were observed.
- Exactly the two planned migrations are pending; all 18 original application tables must be covered, including populated accountless transaction history. Existing encrypted backup metadata was inspected without generating a new archive or changing production.
- See [target-baseline.md](target-baseline.md) for observed identities and remaining execution preflight limits, including the router DHCP fact not independently inspected.
- T002 was separately committed and immediately pushed as dcd3b4a1129600d0a858d0c57df3d0af35024e3c; its checkbox changed only after successful push.

## T004 — Complete original-field comparator

- Added scripts/backup-preservation.ts: dynamically inventories every public application table, column name/type/nullability and exact server-rendered JSON row. The migration ledger is deliberately delegated to T005's dedicated gate.
- Snapshot capture uses an exclusively owned idle connection, one REPEATABLE READ READ ONLY transaction and transaction-local UTC rendering. Exact BIGINT digits, timestamp microseconds, nulls, quoted identifiers, composite/non-id tables and duplicate multiplicity are preserved in memory. Only explicitly reviewed new tables are allowed; diagnostics contain fixed failure codes rather than original values.
- Behavioral tests first failed because the comparator module was absent, then all 10 passed against disposable local PostgreSQL fixtures. They exercise 13 original application tables, including a table beyond the old nine-table list, omitted empty tables/columns, changed signed amounts, types/timestamps, duplicate removal, malformed inventory, row order and timezone independence.
- One sandboxed database attempt was blocked by loopback EACCES; this was not counted as verification. The authorized local-only rerun passed all 10 tests in 6.44 seconds. Scoped ESLint and root strict TypeScript checks passed. No production connection or mutation was involved.
- T003 was separately committed and immediately pushed as b587478009e0bf4345470c7b5bf6e0757b400910; its task marker changed only after successful push.

## Task evidence index

| Task      | Evidence owner                                      | Status                                                              |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| T001      | This setup/authorization ledger                     | Scoped validation; actual pushed commit is recorded in issue #15    |
| T002      | release-readiness.md                                | Release verification passed; pushed commit is recorded in issue #15 |
| T003      | target-baseline.md                                  | Read-only inventory passed                                          |
| T004      | Recovery comparator and 10 focused PostgreSQL tests | Passed scoped lint/types and behavioral checks                      |
| T005      | Recovery harness integration                        | Pending                                                             |
| T006      | recovery-validation.md                              | Pending                                                             |
| T007/T008 | runbook.md / rehearsal.md                           | Pending                                                             |
| T009      | execution-record.md approval packet                 | Pending                                                             |
| T010–T015 | Production execution and technical acceptance       | G2 not granted                                                      |
| T016      | acceptance.md owner decision                        | Pending                                                             |
| T017      | Accurate final handover                             | Pending                                                             |
