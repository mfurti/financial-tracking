# Deployment Implementation Evidence

## Authorization and evidence boundary

Feature 002-integrated-deployment uses [issue #15](https://github.com/mfurti/financial-tracking/issues/15) and its provider-linked preparation branch in the existing selected checkout.

- G0 issue/branch/planning commit and immediate push were explicitly approved.
- G1 preparation T001–T009 was explicitly approved through speckit-implement/coding-workflow: scoped code/docs, read-only discovery and protected isolated recovery.
- G2 production maintenance T010–T015 was explicitly approved. Required current CI and a fresh read-only preflight passed before the writer pause; actual milestones are recorded in execution-record.md. Personal acceptance and PR merge remain separate.
- Personal acceptance remains pending. The original integrated 48-task delivery is preserved; PWA is separate future backlog.
- Existing documented project/deployment rules apply; the constitution remains an unratified template.
- Runtime bindings, private inventory/archive identities and timing measurements stay in the protected local operator dossier. Public tracking contains task/check outcomes and public source provenance only. Original financial rows remain in private memory; no original credentials/private values are logged.

Current state: web paused after the reopening check. The migrated database, original-field verification, internal startup and new encrypted archive passed.

Preflight failure blocks mutation. Later failure keeps access paused and uses a reviewed recovery decision; new writes after reopening require preservation/reconciliation. Absence of an approval is never a passed gate.

## T001 — Setup

Prerequisites resolved the correct feature and 17 tasks. The spec-quality checklist passed 15/15; markers were read only. Existing dependency/generated/secret/local-output ignores were verified without unrelated configuration changes. No extension hook file exists.

G1 was recorded and an evidence ledger established in a separately validated, immediately pushed task commit.

## T002/T003 — Candidate and baseline

The selected application's exact required publication/verification gates, bundle integrity/allowlist and immutable image metadata passed. Read-only target discovery established the actual baseline and pending reviewed chain without changing production. Protected observations and limits are recorded privately; public summaries are in [release-readiness.md](release-readiness.md) and [target-baseline.md](target-baseline.md).

## T004 — Complete comparator

scripts/backup-preservation.ts captures all original public application tables, column names/types/nullability and exact server JSON rows in one read-only repeatable snapshot. It preserves large signed values, nulls, timestamps, quoted/composite/non-id tables and duplicate multiplicity in memory. Diagnostics use fixed codes; only explicitly reviewed new tables are permitted.

Ten real disposable PostgreSQL tests passed after the meaningful missing-module failure. A sandbox loopback denial was not counted as proof; the authorized local-only rerun passed. Scoped lint and root strict types passed.

## T005 — Complete archive upgrade gate

scripts/target-backup-verification.ts and scripts/verify-target-backup.ts verify reviewed SQL bytes, the complete successful original migration prefix, unchanged original ledger fields and only actually pending additive schema/defaults. The restore harness retains its CI/shared-target isolation guards.

Thirteen dedicated integration tests and the existing migration suites passed: 32/32 tests in four files, plus lint/types/format. Negative cases include changed original credentials, journal/checksum/SQL changes, omitted schema, fabricated metadata, wrong seed, empty financial archive and sanitized execution failure. Disposable fixture success was not relabelled as production proof.

## T006 — Protected actual-input recovery

The complete actual-input local harness and independent actual-image PostgreSQL 17 container rehearsal passed. Original-field/history/default preservation, old-schema previous-image recovery and candidate login/report/responsiveness were verified. Original private identity stayed local; one-use recovery material used isolated tmpfs only.

The isolated encrypted post-update archive authenticated. [recovery-validation.md](recovery-validation.md) records methods and limits; exact measured bindings/results remain private. Production resources stayed unchanged and healthy.

## T007 — Reviewed operator procedure

[runbook.md](runbook.md) binds ordered write pause, actual final checkpoint, explicit one-shot migration, complete pre-start comparison, dependency-free startup, backup/readiness and reopening gates to protected parameters. Installed command capabilities were checked.

Original restore isolation guards remain intact. Actual owner login requires an existing session or interactive authentication; no production password reset or forged session is an acceptance shortcut.

## T008 — Failure and success drills

All seven [rehearsal scenarios](rehearsal.md) passed: unavailable image, missing secret, actual migration failure, original-field difference, readiness failure, new-empty-target recovery and controlled Compose success. The success path did not rerun the canonical migrator and produced an authenticated encrypted archive.

Only uniquely owned resources were altered. All temporary test containers, clone volume/network and synthetic runtime/TLS files were removed after protected evidence retention.

## T009 — Concrete proposal

[execution-record.md](execution-record.md) records the pending authority. The local proposal contains exact target/candidate/previous identities, reviewed pending migrations, protected recovery evidence, measured rehearsal and the proposed window/check/abort sequence.

T009 completes proposal preparation. The actual external G2 response was received before T010. Execution milestones contain observed proof from the actual final paused checkpoint.

## Commit and task provenance

Each completed file-changing task was separately committed and immediately pushed; actual source commit provenance is retained by version control and sanitized issue tracking. Task checkboxes change only after validation/push; read-only proof does not require empty commits.

T001–T009 preparation is complete and its task commits were immediately pushed. T010–T015 have not started, T016 needs an actual owner decision, and T017 must report remaining limits accurately.

An automatic review rejected an operationally detailed public issue update. The safe alternative reduced public tracking to task/check outcomes and kept exact bindings locally; no indirect tool was used to publish the rejected payload.
