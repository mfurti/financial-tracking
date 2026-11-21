# Deployment Research

**Date**: 2026-11-21
**Scope**: Repository and GitHub metadata only; no production access or mutation.

## 1. Exact release identity

- **Decision**: Pin initial candidate c06e7cc0d0639e4be8092473de696f4b6a3912b0 and require successful main verify, operations and publish, plus its revision-matching release bundle and immutable API/web/backup digests.
- **Rationale**: .github/workflows/ci.yml publishes the tested saved images only for successful main pushes; scripts/publish-images.sh validates revision labels; scripts/package-deployment.mjs accepts immutable references and packages only runtime inputs.
- **Alternatives considered**: Deploying PR artifacts, rebuilding on the host, mutable tags or treating merged source as an already published release.
- **Observed snapshot**: Publication was initially pending and subsequently completed successfully. The public readiness summary records the outcome; exact artifact/runtime bindings and timing observations remain in the protected local dossier. Recheck them at execution.

## 2. Existing environment

- **Decision**: Upgrade the existing runtime-only installation using protected bindings while preserving its current storage, configuration, access and network boundaries.
- **Rationale**: docs/deployment.md and infrastructure/DEPLOYMENT.md identify the established target and forbid server source/builds or shared network replacement.
- **Alternatives considered**: New host, router changes, new registry model, credential rotation or application reinstallation.
- **Execution inputs**: Actual live revision, migration ledger, image pull access, disk capacity, IP/DHCP/network state and protected secret/identity access. These require discovery, not guesses in a static plan.

## 3. Complete preservation coverage

- **Decision**: Extend scripts/verify-target-backup.ts or supply equivalent reviewed complete verification before production migration.
- **Rationale**: Its snapshot function currently enumerates only nine tables and sorts by id. It does not establish complete preservation across actual production tables, composite keys or all original fields. Existing tests/wealth-migration.test.ts and tests/workspace-migration.test.ts provide all-table exact-field fixture patterns.
- **Alternatives considered**: Repeating the nine-table helper unchanged or accepting historical 17-table recovery prose as current complete proof.
- **Validation**: Detect omission and changed values in a non-nine-table fixture; compare exact values without exporting private rows. Separate expected migration-ledger changes and new-table seed from unchanged original application rows.

## 4. Pause and backup boundary

- **Decision**: Drain committing imports, stop application writers and the backup loop as necessary, keep PostgreSQL running, create the final encrypted archive from quiescent data and verify it in isolation before production migration.
- **Rationale**: apps/api/src/sync.ts rejects cancellation during COMMITTING; infrastructure/backup/backup.sh provides the existing encrypted custom-format pipeline and success marker. An older rehearsal alone cannot establish a later archive's contents.
- **Alternatives considered**: Killing a commit, relying on an ordinary live backup as proof of the final paused state or migrating via an undifferentiated rolling Compose update.
- **Execution inputs**: Owner maintenance window and actual drain/backup/restore timings. Operator chooses abort rather than overrunning an unapproved window.

## 5. Reviewed migration sequence

- **Decision**: Review the actual pending chain and run the candidate migrate service explicitly before starting API/web.
- **Rationale**: infrastructure/compose.yaml gives migrate and API the same image. apps/api/bootstrap.mjs uses Prisma migrate deploy. Candidate migrations 202611180001_reserve_wealth and 202611180002_workspace_settings add eight tables; only ReserveGoal is seeded to 300000 cents.
- **Alternatives considered**: Schema synchronization, migration reset, down-migrations or inventing default account eligibility/balances/groups.
- **Limit**: Last documented production the observed previous application revision is not automatically the pre-feature source base. Any additional pending migration requires review and matching rehearsal before approval.

## 6. Compatibility-based recovery

- **Decision**: Choose image-only rollback only after proving the actual previous production image against the expanded schema; otherwise restore the verified pre-update archive into a new isolated stack.
- **Rationale**: tests/previous-app-compat.test.ts validates source base 1f8d113bfa9294707bcd3b6ea6a3a03e8e12ec62, not recorded production the observed previous application revision. docs/recovery.md explicitly refuses restore over an active/nonempty database.
- **Alternatives considered**: Claiming an arbitrary old image is compatible, automatic schema reversal or deleting the production volume.
- **Post-resume limit**: A pre-update archive predates new writes. Preserve/reconcile them and obtain the corresponding recovery decision before any cutover that discards them.

## 7. Readiness and owner acceptance

- **Decision**: Verify preservation/internal readiness while web is stopped, then reopen and check actual private HTTPS/login, representative old/new read-only views, backup health and direct-IP denial.
- **Rationale**: Existing Compose health and trusted-proxy controls are implemented. There is no implemented production read-only mode; do not invent one in the runbook. Owner coordination controls the agreed smoke window after web reopening.
- **Alternatives considered**: Treating health alone as data acceptance, changing global Traefik security, using live banking as smoke or marking human acceptance automatically.
- **Outcome**: Technical evidence and the owner's visual/interaction acceptance are separate records.

## 8. Governance and workflow

- **Decision**: Keep this operational follow-up in specs/002-integrated-deployment; retain the original completed 48 tasks. Use existing documented project/deployment rules and preserve the unratified constitution template.
- **Rationale**: Spec Kit feature paths are independent of Git branch. The planning helper resolves this feature on the existing main checkout; no issue/branch/commit or production authorization follows from planning.
- **Alternatives considered**: Overwriting the completed feature plan, regenerating old tasks or introducing a new deployment framework.
- **Next gate**: Review/refine this plan or explicitly generate tasks. Production execution remains a separate concrete decision.
