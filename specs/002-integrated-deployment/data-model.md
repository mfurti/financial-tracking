# Deployment Evidence Model

This plan adds no application tables, API entities or business migrations. The existing candidate contains eight additive tables described in ../001-integrated-household-concept/data-model.md. The records below are operational evidence, not a new database service.

## ReleaseCandidate

- Full revision, exact main workflow/attempt, verify/operations/publish outcomes.
- Runtime bundle identifier/checksum and REVISION.
- Immutable api, web and backup image references plus inspected revision labels.
- Readiness state and observation time.
- Reject mutable/mismatched references, incomplete publication, missing/expired bundle or another revision.

## TargetBaseline

- Observed target/project, existing volume/network identities, old image references and migration-ledger state.
- Protected configuration/recovery-copy location, confirmed storage capacity and secret accessibility.
- Actual pending migration set and approved compatibility/recovery mode.
- Never store credentials, full configuration content or personal financial rows in public evidence.

## RecoveryCheckpoint

- Encrypted archive identifier, creation timestamp, quiescent-write boundary and protected off-host copy.
- Isolated empty target identity; compatible old and candidate image identities.
- Original table/column inventory and in-memory exact comparison result per table.
- Restore/migration duration, archive authentication result and cleanup of temporary identity/plaintext inputs.
- Expected differences: reviewed migration-ledger additions and candidate new-table seed only; compare unchanged original application rows before API startup.
- Every original table/field must be covered, including non-id/composite-key rows, nulls, timestamps and large signed BIGINT values. Missing coverage fails.

## DeploymentExecution

- Candidate, baseline and recovery-checkpoint references.
- Explicit approval evidence, maintenance window, write pause/resume timestamps.
- Import drain result, final archive verification, candidate migrator outcome, preservation/readiness and reopening checks.
- Recovery decision, actual running images, successful post-update archive and measured downtime.
- State sequence: draft → prepared → recovery-rehearsed → awaiting-production-approval → approved → writers-paused → final-backup-verified → migrated → internally-verified → reopened → technically-accepted.
- Pre-migration gate failure stays blocked without production mutation. Migration/readiness failure enters paused-failure; access stays stopped.
- Recovery from paused-failure chooses proven compatible old binaries or isolated pre-update restore.
- Reopened failures require recorded post-resume writes and reconciliation; no unconditional older-archive recovery.

## OwnerAcceptance

- Candidate/deployment reference, checks for spacing/depth/contrast/tiles/motion and representative financial workflows.
- State: pending, accepted or findings-recorded; actor and actual observation time.
- Technical tests do not change this state automatically.

## Evidence Storage

Tracked documents contain public source provenance and sanitized task/check outcomes. Exact runtime bindings, target inventories, archive identities and operational timing samples remain in the protected local operator dossier. Encrypted archives, secrets, identities, private screenshots and runtime configuration remain outside tracked files. Original financial rows stay in private memory; ignored local diagnostics must not contain unprotected personal data.
