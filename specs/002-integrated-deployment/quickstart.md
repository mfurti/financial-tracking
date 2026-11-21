# Deployment Plan Validation Guide

## Prerequisites

Use the existing selected checkout and Node 24.22.1/pnpm 11.25.0. This guide validates planning/release readiness; it does not authorize production deployment. See [deployment contract](contracts/deployment.md) and [evidence model](data-model.md).

## 1. Resolve the intended planning context

PowerShell, repository root:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = 'specs/002-integrated-deployment'
$env:SPECIFY_FEATURE_NO_PERSIST = '1'
& ./.specify/scripts/powershell/check-prerequisites.ps1 -PathsOnly -Json
git status --short
```

Expected: FEATURE_DIR resolves to this deployment feature in the existing selected checkout, now on approved issue branch 15-deploy-integrated-household-finance-workspace. Issue #15 and a separate planning commit/push are approved; any pending changes must be scoped to this feature. Running path/format validation does not authorize preparation implementation or production execution.

## 2. Check the candidate release without changing it

```powershell
gh run view 44894725587 --repo mfurti/financial-tracking --json headSha,status,conclusion,jobs,url
gh api repos/mfurti/financial-tracking/actions/runs/44894725587/artifacts --jq '[.artifacts[] | {id,name,expired,expires_at}]'
```

Expected before production execution: full revision c06e7cc0d0639e4be8092473de696f4b6a3912b0, successful verify/operations/publish and a nonexpired financial-tracking-deployment-c06e7cc0d0639e4be8092473de696f4b6a3912b0 artifact. A verified-images artifact alone is insufficient. Recheck instead of relying on the planning snapshot. Do not rerun a successful workflow merely to generate planning evidence.

Download the final bundle only after it exists into a new ignored local directory; verify its REVISION, runtime-file allowlist, integrity and immutable image references before preparing execution approval. Never treat application images as a place to store credentials.

## 3. Verify planning artifacts

```powershell
pnpm exec prettier --check 'specs/002-integrated-deployment/**/*.md'
git diff --check
```

Expected: formatting passes, all local documentation links resolve, FR-D001–FR-D012 have matching design/contract coverage, and no unresolved template/clarification markers remain. Untracked artifacts also require explicit file/link inspection because git diff does not inspect them.

## 4. Prepare bounded recovery-verifier implementation

After task-generation, issue and implementation approvals, extend the existing target-backup preservation comparison or provide equivalent reviewed complete proof. Focused tests must fail for an omitted original table/field, a changed exact value, and unsupported non-id/composite keys. Then run affected format/lint/type/migration/recovery checks; commit/push each completed task under the project workflow.

The current nine-table helper is not full target-preservation evidence. Do not run it against production or expose private row contents to make a test pass.

## 5. Rehearse with protected target evidence

After appropriate access/restore authorization, use docs/recovery.md and the selected backup image to restore an actual fresh encrypted populated archive into an explicitly empty isolated PostgreSQL 17 stack. Compare every original application field before/after the exact reviewed pending migration chain. Verify the actual prior production image if selecting binary rollback; record timings and clean up temporary identity/plaintext mounts.

Expected: zero unexplained original-field differences, complete table inventory, matching candidate images and measured recovery/upgrade durations. Synthetic CI fixtures and source-base compatibility are supporting evidence, not substitutes.

## 6. Production execution and acceptance

Present the concrete candidate/target/window/migrations/recovery/checks for separate approval. Execute only after all prerequisites in the [contract](contracts/deployment.md) pass. Record the write pause/resume, migration/preservation/readiness/HTTPS/direct-IP results and successful post-update archive.

Technical success does not automatically complete the owner's visual/interaction acceptance. No shared-host reboot, bank operation, data reset or credential/network change belongs to this plan.
