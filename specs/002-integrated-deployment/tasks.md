# Tasks: Integrated Household Deployment

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [deployment contract](contracts/deployment.md), [quickstart.md](quickstart.md).
**Generated**: 2026-11-21.
**Authorization**: The user approved task generation, deployment issue #15, its linked branch and separate planning commit/push, then explicitly invoked speckit-implement/coding-workflow for the presented T001–T009 preparation scope. G0/G1 are approved. Production mutation (G2 before T010), personal acceptance and merge remain separately gated; no task is completed by approval alone.
**Checkout**: Reuse the existing V:/GitHub/financial-tracking checkout on the GitHub-linked branch 15-deploy-integrated-household-finance-workspace, verified starting at origin/main c06e7cc0d0639e4be8092473de696f4b6a3912b0. It predates this follow-up. Track work in [deployment issue #15](https://github.com/mfurti/financial-tracking/issues/15). Original issue #13/PR #14 are completed; do not reopen them or regenerate their 48 tasks.
**Governance**: Existing documented project/deployment rules apply. The constitution remains an unratified template. No dependency upgrade, new business schema, hosting framework, network replacement, credential rotation, reboot or live bank operation.

## Format and execution rules

- Use sequential T001–T017 IDs. Story tasks carry US1/US2/US3. [P] identifies disjoint work after prerequisites, not authorization to spawn agents.
- Each code task includes its behavioral tests, implementation and documentation as one working increment. The plan explicitly requires recovery-verifier tests: observe a meaningful failure first, then make it pass before committing. Do not commit a deliberately failing test-only increment.
- After issue/branch/planning-commit approval, create the provider-linked issue branch in this checkout and commit/push planning separately. Then ask to implement. Every completed implementation task with file changes has its own scoped commit and immediate successful push; no batching or empty verification commits.
- Evidence filenames below are future implementation targets. Create them when their owning task executes, never prefill successful results. Record task validation/commit SHAs in the deployment issue and validation.md. Pure read-only proof may update tracking without an empty commit.
- Candidate application images initially remain c06e7cc. Preparation-tooling commits do not silently replace the application candidate. Record the exact approved tooling revision separately. A different application revision requires its own verification/publication and reviewed approval.
- Reuse Node 24.22.1/pnpm 11.25.0, strict TypeScript/JSDoc and established checks. No Changesets tooling is configured. Apply candidate release-readiness and database-preservation specialist checks proportionally; neither authorizes production execution.
- Current candidate/current tooling CI matters; do not replay historical intermediate CI. Review or merge of the preparation PR remains a separate workflow decision.

## Authorization boundaries

| Boundary                        | Tasks       | Required before dependent action                                                                                                                                         |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G0 — Tracking                   | Before T001 | Explicit approval for deployment issue, linked branch and separate planning commit/push                                                                                  |
| G1 — Preparation implementation | T001–T009   | Separate implementation approval for scoped code/docs, read-only target discovery and protected isolated recovery; obtain missing access inputs without exposing secrets |
| G2 — Production maintenance     | T010–T015   | Explicit approval of the concrete T009 packet: exact target/candidate/old images, pending migrations, recovery route, maintenance window, write pause/resume and checks  |
| Human acceptance                | T016        | Actual owner observations/decision; implementation or deployment approval is not personal acceptance                                                                     |
| Completion                      | T017        | Accurate technical handover; T016 may remain explicitly pending, but overall task completion must not be claimed then                                                    |

No production writer pause, backup creation on the target, runtime configuration replacement or migration occurs before G2. Read-only inventory and use of an existing protected archive for an isolated rehearsal belong to disclosed G1 preparation; they never permit mutation of the live database.

## Phase 1: Setup

**Purpose**: Reconcile approvals, selected checkout and evidence ownership before executable work.

- [x] T001 Establish the deployment execution/evidence ledger in specs/002-integrated-deployment/validation.md using spec.md, tasks.md and data-model.md; record G0/G1 approvals, candidate/tooling identities and task/check/commit provenance, preserve the existing 48-task delivery, and define the exact state sequence "draft → prepared → recovery-rehearsed → awaiting-production-approval → approved → writers-paused → final-backup-verified → migrated → internally-verified → reopened → technically-accepted"; failed preflight stays blocked and migration/readiness failure enters paused-failure without recording fictional success.

**Acceptance**: Selected checkout/issue/branch and actual approvals are recorded; no live change or incomplete task is marked complete.

## Phase 2: Foundational prerequisites

**Purpose**: Establish one candidate and one observed target before recovery/deployment stories.
**Dependencies**: T001 first; T002 and T003 are independent.

- [x] T002 [P] Record candidate release readiness in specs/002-integrated-deployment/release-readiness.md from .github/workflows/ci.yml, scripts/publish-images.sh and scripts/package-deployment.mjs: verify exact revision c06e7cc0d0639e4be8092473de696f4b6a3912b0, successful main verify/operations/publish, nonexpired matching bundle/checksum/REVISION, runtime-only allowlist, immutable API/web/backup digests and revision labels; enforce "Reject mutable/mismatched references, incomplete publication, missing/expired bundle or another revision." Keep incomplete publication blocked rather than treating verified-images/PR artifacts as a release.
- [x] T003 [P] Record read-only target discovery in specs/002-integrated-deployment/target-baseline.md using infrastructure/DEPLOYMENT.md and docs/deployment.md: inspect actual rocky runtime revision/images, migration ledger/pending chain, household-ledger project/volume, secret references, backup location, disk capacity, registry access, shared networks and IP/DHCP state; preserve "Never store credentials, full configuration content or personal financial rows in public evidence." Reconcile drift from documented d193639 and any additional pending migrations before dependent work; do not pause writers, change credentials or create a target backup.

**Checkpoint**: Actual candidate and target are known; missing publication/access/drift evidence remains a visible blocker.

## Phase 3: User Story 1 — Recover existing household records (P1, MVP)

**Goal**: Complete preservation comparison and candidate-specific isolated recovery before risking production.
**Dependencies**: T002/T003 complete, then T004 → T005 → T006.
**Independent Test**: Restore an existing fresh encrypted populated archive in isolation, migrate the copy, compare every original field/table and prove the selected recovery route without touching production.

- [x] T004 [US1] Implement reusable read-only preservation comparison in scripts/backup-preservation.ts with focused tests/backup-preservation.test.ts, following tests/wealth-migration.test.ts and tests/workspace-migration.test.ts patterns; enforce "Every original table/field must be covered, including non-id/composite-key rows, nulls, timestamps and large signed BIGINT values. Missing coverage fails." Test reordered rows, composite/no-id keys, duplicate-row multiplicity, an extra legacy table beyond the current nine, omitted tables/columns and changed exact/null/timestamp/large-value fields; keep raw rows in memory and error output sanitized. Record focused tests and applicable lint/type/format results in specs/002-integrated-deployment/validation.md before committing the working increment.
- [x] T005 [US1] Integrate complete comparison into scripts/verify-target-backup.ts through the testable scripts/target-backup-verification.ts gate with tests/target-backup-verification.test.ts and update docs/recovery.md: replace the nine-table/id-only snapshot, keep owned-empty-target guards and private identity/decryption handling, and enforce "Expected differences: reviewed migration-ledger additions and candidate new-table seed only; compare unchanged original application rows before API startup." Prove original rows remain exact while expected new migration entries/eight candidate tables and the 300000-cent ReserveGoal seed are recognized; omit no production table or field, do not weaken access/restore guards, and do not execute this recovery harness against the live database.
- [x] T006 [US1] Write actual recovery results to specs/002-integrated-deployment/recovery-validation.md by restoring an existing fresh encrypted populated target archive into a distinct empty PostgreSQL 17 stack using infrastructure/backup/restore.sh and the reviewed tooling, applying the actual pending candidate chain and running complete comparison before app startup; measure restore/migration times, verify archive population/login/read views in the copy, and test the actual previous production image against the expanded schema only if selecting image-only rollback. Otherwise select isolated-restore recovery explicitly; source-base 1f8d113 compatibility does not prove d193639/live-image compatibility. Protect the configuration/archive off-host and remove only owned temporary identity/plaintext inputs.

**MVP checkpoint**: T001–T006 provide a verified recovery capability and candidate/target baseline. They do not deploy, authorize maintenance, mark owner acceptance or promise an unmeasured outage time.

## Phase 4: User Story 2 — Upgrade the existing installation (P1)

**Goal**: Rehearse the exact update and execute only separately approved maintenance.
**Dependencies**: US1 complete, then T007 → T008 → T009; STOP for G2 before T010 → T011 → T012 → T013.
**Independent Test**: Rehearse the pinned release/configuration, write-pause ordering, migration/preservation and failure stops in an isolated populated stack; later observe the approved production sequence with zero unexplained original-field changes.

### Preparation under G1

- [ ] T007 [US2] Produce the candidate/target-specific operator runbook in specs/002-integrated-deployment/runbook.md and align infrastructure/DEPLOYMENT.md where necessary: bind staging/pulls, protected old configuration, import drain, stop web/api/backup while retaining PostgreSQL, one-shot final encrypted backup from the stopped-loop old backup image, explicit candidate migrator and pre-start preservation comparison to exact commands. Define a protected administrative-memory comparison method reusing scripts/backup-preservation.ts without copying source/building on rocky or logging row payloads; do not run the restore harness against production. After the explicit successful one-shot migration/readiness checks, bind --no-deps application starts so Compose dependency traversal cannot silently rerun or bypass the migration gate. Include aborts, compatible-image rollback versus isolated restore, the web write-resume boundary and post-resume reconciliation.
- [ ] T008 [US2] Rehearse specs/002-integrated-deployment/runbook.md against the restored isolated stack and record results in specs/002-integrated-deployment/rehearsal.md: exercise successful upgrade and controlled missing-secret, unavailable-image, migration-failure, preservation-difference and readiness-failure stops without live bank traffic; prove failed gates keep external access stopped and storage intact, verify the selected recovery path and fresh post-migration archive, and measure drain/backup/restore/migration/startup durations for the proposed window. Reuse existing operations/bundle tests for changed boundaries; do not change production or weaken protections.
- [ ] T009 [US2] Prepare the concrete production approval packet in specs/002-integrated-deployment/execution-record.md from release-readiness.md, target-baseline.md, recovery-validation.md, rehearsal.md and runbook.md: identify exact application/tooling revision and old/new digests, actual pending migrations, protected recovery evidence/location, selected recovery mode, measured timings, proposed maintenance window and resume/check/abort criteria. Present it for explicit G2 approval and record the actual response; do not perform production mutation while the packet is pending.

### Execution only after G2

- [ ] T010 [US2] Execute only the approved drain/write-pause/final-checkpoint stages of specs/002-integrated-deployment/runbook.md and append actual timestamps/outcomes to specs/002-integrated-deployment/execution-record.md: wait for COMMITTING work instead of interrupting it, stop application writers and the backup loop as planned, keep PostgreSQL, create the fresh encrypted quiescent pre-update archive with the old pinned backup image, protect an off-host recovery copy/configuration, and verify this actual final archive in isolation with the complete comparator. Abort before migration if archive/preservation/window gates fail; an earlier rehearsal is not proof of this later archive.
- [ ] T011 [US2] Apply only the approved runtime bundle/configuration and reviewed pending candidate migration chain through infrastructure/compose.yaml and specs/002-integrated-deployment/runbook.md, recording the exact image/migration outcome and complete original-field comparison in specs/002-integrated-deployment/execution-record.md before API startup. Migrate/API must use the same immutable API digest; preserve project, volume, secrets and recipients; allow only reviewed migration-ledger/new-table seed differences. On failure retain the paused state and existing storage; never reset schema or invent a down-migration.
- [ ] T012 [US2] Execute internal candidate startup/readiness from specs/002-integrated-deployment/runbook.md with external web still stopped and record results in specs/002-integrated-deployment/execution-record.md: verify postgres/API/backup identity and readiness, actual approved image digests, expected startup state and a successful encrypted post-update archive. Keep access paused on failure and choose the previously approved compatible-image or isolated-restore route; do not switch schema/image sets speculatively.
- [ ] T013 [US2] Reopen only the approved candidate web service after internal checks pass using specs/002-integrated-deployment/runbook.md, and record write-resume time, actual revision and measured outage in specs/002-integrated-deployment/execution-record.md. Starting web permits ordinary writes; do not claim a read-only mode. Immediately check private HTTPS/login, stop access again on failure, and preserve/reconcile any new writes before proposing an older-archive recovery or cutover.

**Checkpoint**: Approved runtime is running with a documented recovery/write boundary; technical and human acceptance are still separate.

## Phase 5: User Story 3 — Verify delivery and obtain owner acceptance (P2)

**Goal**: Prove deployed behavior and accurately record the owner's decision.
**Dependencies**: T013 first; T014/T015 can run independently, then T016.
**Independent Test**: Complete all technical checks with observed outcomes; have the owner inspect the actual interface and record acceptance/findings without fabricating that decision.

- [ ] T014 [P] [US3] Record read-only deployed user-flow evidence in specs/002-integrated-deployment/acceptance.md: verify private HTTPS/login, actual existing accounts/transactions/categories/import history/contracts/monthly totals and reserve/wealth/settings/demo destinations; reconcile exact amounts and unknown states against the preserved baseline, exercise representative desktop/mobile navigation and capture no unprotected personal screenshots. No real bank login, new import, demo mutation or financial write is part of this smoke; record failures with the actual candidate rather than calling CI a production check.
- [ ] T015 [P] [US3] Record runtime/persistence/access/backup evidence in specs/002-integrated-deployment/execution-record.md using infrastructure/DEPLOYMENT.md: verify expected persistent volume/data after the controlled candidate starts, healthy postgres/API/web/backup, no API/DB host ports, enabled trusted-proxy configuration, direct-IP application 403, private HTTPS and successful post-update encrypted archive. Confirm actual running digests and outage against the approved window; report limits without a shared-host reboot or extra unapproved restarts.
- [ ] T016 [US3] Present the actual deployed candidate and representative depth/spacing/contrast/tiles/motion/financial-workflow checks to the owner and record the real decision in specs/002-integrated-deployment/acceptance.md, preserving "State: pending, accepted or findings-recorded; actor and actual observation time." Technical checks or elapsed time must not mark it accepted; leave this task pending until an actual owner response, and return material implementation findings to the applicable scope/approval decision.

**Checkpoint**: T014/T015 establish technical acceptance; T016 alone establishes the owner's observed acceptance or recorded findings.

## Phase 6: Polish and cross-cutting handover

- [ ] T017 Finalize specs/002-integrated-deployment/validation.md and quickstart.md, docs/status.md, docs/todo.md and docs/deployment.md with actual candidate/digest/run/backup/recovery/timing evidence and remaining limits; split E8's completed merge/deployment facts from any still-pending personal acceptance, preserve unrelated E1–E6/R2/R3/I1/budget/backlog items, and verify documentation links, changed-file format/whitespace and required latest tooling checks. Retain encrypted recovery material; remove only task-owned temporary identity/plaintext inputs after path/ownership verification. Synchronize task/issue/PR status and mark no unavailable production or human proof complete.

T017 may hand over technical completion after T014/T015 with T016 explicitly pending. Do not report all 17 tasks complete until T016 has an observed outcome.

## Dependencies and execution order

```text
G0 tracking/planning commit → G1 preparation approval
T001 → {T002, T003} → T004 → T005 → T006 (US1 / MVP)
     → T007 → T008 → T009 (US2 preparation)
     → G2 concrete production approval
     → T010 → T011 → T012 → T013 (US2 execution)
     → {T014, T015} → T016 (US3 owner response)
T014 + T015 → T017 technical handover; preserve T016 pending if needed
```

The stories are independently verifiable increments, not independent production deployments: US2 safety requires US1; US3 requires the actual US2 target. Do not reorder writer pause, final checkpoint, migration, preservation, internal start and external reopening.

## Parallel examples

- **Foundation**: T002 release metadata and T003 read-only target inventory after T001; separate evidence files. Neither may modify the production runtime.
- **US1**: No whole-task parallel pair. T004 comparator must precede T005 harness integration and T006 protected recovery.
- **US2**: No whole-task parallel pair. Preparation, concrete approval and write-boundary stages are serialized; never overlap final backup with active business writes.
- **US3**: T014 read-only flow checks and T015 read-only runtime/access/backup inspection after T013; separate evidence files and no unapproved restarts.
- Four [P] tasks form two pairs. They indicate dependency-compatible work only; no agent/team spawning is authorized.

## Requirement and entity coverage

| Requirement                                         | Tasks                       |
| --------------------------------------------------- | --------------------------- |
| FR-D001 exact verified release                      | T002, T009                  |
| FR-D002 actual target and pending upgrade           | T003, T006, T009            |
| FR-D003 concrete production approval                | T009, G2 before T010        |
| FR-D004 drain and stop writers                      | T007, T008, T010            |
| FR-D005 complete archive/preservation proof         | T004–T006, T008, T010       |
| FR-D006 preserve data/identities/defaults           | T005, T006, T011, T014      |
| FR-D007 existing runtime/storage/network boundaries | T003, T007, T011, T015      |
| FR-D008 paused failure and compatible recovery      | T006–T008, T011–T013        |
| FR-D009 internal-before-external validation         | T012–T015                   |
| FR-D010 post-update backup and persistence          | T012, T015                  |
| FR-D011 technical versus personal acceptance        | T014–T017                   |
| FR-D012 post-resume reconciliation                  | T007, T009, T013            |
| SC-D001 successful candidate gates                  | T002, T009                  |
| SC-D002 zero unexplained original-field changes     | T004–T006, T010, T011       |
| SC-D003 populated isolated restoration and timing   | T006, T008, T010            |
| SC-D004 observed bounded acceptance                 | T014–T017                   |
| SC-D005 actual running release/backup/resume        | T012, T013, T015            |
| SC-D006 measured approved outage                    | T008, T009, T013, T015      |
| ReleaseCandidate                                    | T002, T009                  |
| TargetBaseline                                      | T003, T009                  |
| RecoveryCheckpoint                                  | T004–T006, T010             |
| DeploymentExecution                                 | T001, T007–T013, T015, T017 |
| OwnerAcceptance                                     | T014, T016, T017            |

## Implementation strategy

1. Finish the current tasks review; ask to create the deployment issue/linked branch and separate planning commit/push. Do not reuse earlier feature approvals for new actions.
2. After the planning commit, ask for scoped preparation implementation (G1) starting with T001. Reuse the existing checkout, scripts and configured checks.
3. Deliver MVP T001–T006: candidate/target identity, complete tested preservation verifier and isolated populated recovery. No production deployment is implied.
4. Prepare/rehearse T007–T009 and present the concrete production packet. A draft preparation PR can show scoped code/evidence if execution stops at G2; do not create a second duplicate feature PR or bypass its separate merge approval.
5. After explicit G2, execute T010–T015 in the documented maintenance sequence and complete technical handover. No production migration/reboot/bank/credential/network changes are inferred beyond the concrete approved packet.
6. Record the actual owner response for T016; T017 retains pending acceptance truthfully if it has not arrived.

## Generated summary

- **17 tasks**: setup 1; foundation 2; US1 3; US2 7; US3 3; final handover 1.
- **MVP**: T001–T006 (6 tasks), ending in complete recovery proof without production mutation.
- **Parallel opportunities**: T002/T003 and T014/T015 only.
- **All tasks initially pending**. Generating this file performs no implementation, restoration or deployment.
