# Implementation Plan: Integrated Household Deployment

**Branch**: 15-deploy-integrated-household-finance-workspace | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)
**Issue**: [#15](https://github.com/mfurti/financial-tracking/issues/15), related to completed #13/PR #14. The user explicitly approved issue creation, its linked branch in the existing checkout and a separate planning commit with immediate push.
**Feature context**: 002-integrated-deployment.
**Input**: Deployment follow-up to the completed [integrated implementation](../001-integrated-household-concept/plan.md).
**Status**: Phase 0 research, Phase 1 design and task generation are complete. Issue #15 and its linked branch/planning commit are published. The user approved preparation implementation T001–T009 (G1); execution evidence is in validation.md and task progress in [tasks.md](tasks.md). Production execution (G2 before T010), personal acceptance and merge remain separate decisions.

## Summary

Deploy the integrated household application through the existing immutable-image, runtime-only update procedure. Preserve actual production data and provide candidate-specific recovery proof before writes. Reuse existing scripts, Compose, encrypted backups and CI. A bounded preparation change must close the existing target-backup verifier's incomplete table coverage; it is not implemented by this plan.

Initial application source candidate: c06e7cc0d0639e4be8092473de696f4b6a3912b0, merged PR #14. Its [main CI](https://github.com/mfurti/financial-tracking/actions/runs/44894725587) subsequently completed publication successfully. The actual installed baseline, immutable operational bindings and protected observations are held in the local operator dossier and must be revalidated before execution. Public source identity and successful publication do not grant production authority.

## Technical Context

**Language/Version**: Existing Node >=24.22.1 <25, pnpm 11.25.0, strict TypeScript; existing Bash/Linux runtime operations.
**Primary Dependencies**: Existing NestJS/Nuxt/Prisma application, Docker Compose, PostgreSQL 17, GHCR, age and current Traefik integration. No dependency upgrades.
**Storage**: Preserve the existing production data volume, protected configuration and encrypted backup storage; add no business schema beyond the reviewed candidate migrations.
**Testing**: Existing Vitest migration/operations/bundle coverage and Linux operations CI; complete target-archive preservation rehearsal; exact production-image compatibility; bounded private-HTTPS smoke.
**Target Platform**: Existing Linux Docker deployment, bound through the protected operator manifest. Preserve the observed project, data volume, external networks, assigned address and private HTTPS entry point; revalidate them before execution.
**Project Type**: Operational delivery of the existing web application, plus bounded recovery-verifier preparation.
**Performance Goals**: Measure backup, restore, migration and outage duration. Existing Compose readiness wait is 240 seconds per invocation, not an outage SLA. Approve the actual maintenance window after rehearsal.
**Constraints**: Explicit production approval; paused writers; no production reset/down-migration; no secrets/financial payloads in Git or logs; no server builds, shared network recreation, reboot or live bank operation.
**Scale/Scope**: One owner and existing household records; eight additive candidate tables in two migrations; all actual original application tables/fields covered in preservation verification.

## Constitution Check

The constitution file contains placeholder principles and no ratified policy. It is not represented as satisfied governance. The existing user-accepted project rules remain the baseline; this plan additionally follows docs/deployment.md, infrastructure/DEPLOYMENT.md, docs/recovery.md and docs/feature-migrations.md.

| Gate                                                                     | Before research | After design                                               |
| ------------------------------------------------------------------------ | --------------- | ---------------------------------------------------------- |
| Planning only; production/issue/branch/commit approvals stay separate    | Pass            | Pass; no production commands executed                      |
| Exact candidate and successful main verification/publication             | Defined         | Defined; live execution gate, not claimed complete         |
| Preserve original records and prove recovery in isolation                | Required        | Pass in design; verifier coverage gap explicitly scheduled |
| Immutable runtime-only deployment and existing network/secret boundaries | Required        | Pass in design                                             |
| Compatibility-based recovery without destructive schema reversal         | Required        | Pass in design; actual prior-image proof still needed      |
| Scope and existing task evidence preserved                               | Pass            | Pass; original 48 tasks unchanged                          |

No unresolved design decision remains. Live production facts, publication and maintenance approval are explicit execution prerequisites; failure to obtain them blocks execution.

## Project Structure

### Documentation (this feature)

```text
specs/002-integrated-deployment/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── deployment.md
└── checklists/
    └── requirements.md
```

tasks.md was generated by the subsequently requested speckit-tasks procedure; no task is executed by planning.

### Source Code (repository root)

```text
scripts/verify-target-backup.ts
scripts/backup-preservation.ts
scripts/target-backup-verification.ts
tests/backup-preservation.test.ts
tests/target-backup-verification.test.ts
tests/wealth-migration.test.ts
tests/workspace-migration.test.ts
tests/previous-app-compat.test.ts
tests/operations.test.ts
tests/deployment-bundle.test.ts
infrastructure/compose.yaml
infrastructure/DEPLOYMENT.md
infrastructure/backup/{backup,restore}.sh
scripts/{verify-operations,publish-images}.sh
scripts/package-deployment.mjs
docs/{deployment,recovery,feature-migrations,status,todo}.md
```

**Structure Decision**: Use existing delivery machinery. Preparation may extend the existing verifier and add a focused behavioral test; operational evidence stays nonsecret. Private archives/identities/configuration remain outside tracked artifacts. No new deployment framework or general application feature.

## Phase 0: Research Decisions

[research.md](research.md) resolves release selection, recovery coverage, writer draining, migration order, rollback scope and evidence ownership from actual repository behavior. One read-only research agent inspected operational sources; no server was contacted.

## Phase 1: Delivery Design

1. **Prepare complete recovery verification**: Compare every original application table/field deterministically, including composite/non-id keys, exact BIGINT and nullable values. Explicitly handle migration-ledger additions and the approved ReserveGoal seed. Prove a deliberately changed or omitted field fails; preserve private row content in memory only.
2. **Establish candidate and baseline**: Require successful exact-main verify/operations/publish, downloadable matching package, image labels and digests, actual current production revision/schema, private pulls and host prerequisites. Unexpected drift/pending migrations require reviewed reconciliation.
3. **Rehearse recovery and upgrade**: Restore a fresh representative archive in an owned isolated empty PostgreSQL 17 stack. Apply reviewed pending migrations and perform full preservation comparison before application startup. Test the actual previous production image against expanded schema if selecting image-only rollback. Record recovery and migration times.
4. **Prepare concrete execution approval**: Present exact target, old/new image identities, pending migration set, protected recovery checkpoint, measured rehearsal, maintenance window and selected recovery mode. Planning/implementation approval never authorizes production mutation.
5. **Execute the approved maintenance**: Drain active imports; never interrupt COMMITTING. Stop web/API and backup loop as required, retain PostgreSQL, create the final encrypted quiescent archive, and ensure its restoration/coverage proof is current. Save old runtime configuration securely. Install only the verified bundle configuration and existing secret references; run the candidate migrator explicitly. Preserve the volume/project and stop on failure.
6. **Validate and reopen**: Compare original rows before application startup, verify schema state, start candidate API/backup while external web is stopped, then verify internal readiness and new backup completion. Start web only after these gates pass; this is the write-resume boundary, not a fictitious read-only mode. Verify private HTTPS/login, direct-IP 403 and existing/new read-only journeys during the agreed owner maintenance window. Any later failure requires the recovery policy for the actual write boundary.
7. **Record acceptance**: Capture release/health/digests, archive identifiers, counts/equality outcomes, measured downtime and remaining human acceptance. Update current status/E8 deployment state accurately; retain historical records and unrelated backlog.

See [deployment contract](contracts/deployment.md) for failure stops and [quickstart.md](quickstart.md) for validation commands.

## Validation Strategy

- Documentation planning: validate template/context resolution, local links, requirement coverage, unresolved-marker absence and changed-file formatting.
- Preparation implementation: focused verifier tests must detect a changed field, an omitted table, composite/no-id rows and exact large values; run applicable format/lint/types and related migration/recovery tests before its commit/push.
- Release gate: latest required full CI for the exact candidate and applicable base; successful main publisher and revision-matching deployment artifact. Earlier PR success and old image publication do not substitute.
- Production evidence: live baseline, paused writers, fresh encrypted populated restore with complete original-field comparison, actual old-image/schema compatibility or isolated-restore recovery, migration outcome, healthy runtime, access controls, backup completion and HTTPS smoke.
- Bound limits: no local Windows Docker/production proof claimed; no live bank call or personal acceptance fabricated. Post-resume archive recovery needs explicit data reconciliation.

## Complexity Tracking

No additional architecture or governance exception is introduced. The narrowly scoped verifier correction is required by the existing preservation contract and is covered by working increments T004/T005 in tasks.md.
