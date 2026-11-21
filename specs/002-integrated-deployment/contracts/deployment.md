# Deployment Execution Contract

## Inputs and authority

The selected release is c06e7cc0d0639e4be8092473de696f4b6a3912b0 initially. A later candidate needs its own exact verification/publication evidence. Existing project rules and infrastructure/DEPLOYMENT.md define execution primitives.

Plan/task/issue approval does not grant implementation or target access. Any read-only target discovery and protected isolated archive handling must be disclosed in the subsequent preparation-implementation approval. That preparation approval does not permit production mutation or migration. Before any production writer pause or update, present the exact target, candidate/old image digests, actual pending migrations, verified recovery checkpoint/mode, measured rehearsal, agreed maintenance window and planned checks. Obtain explicit production authorization for that concrete proposal.

## Preconditions

1. Exact-main verify/operations/publish succeeded; matching downloadable runtime bundle and image revision labels/digests verified.
2. Live target/project/volume/configuration/network identities inspected; no unexplained drift or unreviewed pending migrations.
3. Registry pulls, protected secret references, private recovery identity access and storage capacity verified without printing secrets.
4. Complete original-table/field preservation verifier validated and isolated populated recovery rehearsed.
5. Actual previous production-image/schema compatibility proven for binary rollback, or isolated restore selected.
6. Owner maintenance window and write-resume boundary agreed. No active COMMITTING work may be terminated.

## Ordered operations

| Phase            | Contract                                                                                                                                                                            | Failure behavior                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Stage            | Stage verified runtime bundle and pull immutable candidate images while retaining old configuration/images                                                                          | Abort without changing the active release                                          |
| Drain            | Let commits finish; cancel only cancellable work; stop web/API writers and backup loop when needed; retain PostgreSQL                                                               | Keep old release or pause; never kill a financial commit to meet the window        |
| Final checkpoint | Create a fresh encrypted archive after writer pause, protect old configuration and off-host recovery copy, verify that actual archive in isolation with complete preservation proof | Leave migration unstarted; resume old release only through the approved abort path |
| Configure        | Install reviewed runtime-only bundle/configuration using existing secrets and project/volume/network identities                                                                     | Restore protected old runtime configuration; do not replace secrets                |
| Migrate          | Candidate migrate service, same API digest; only reviewed pending migrations                                                                                                        | Leave web/API stopped; inspect ledger/schema; no reset or automatic down-migration |
| Preserve         | Compare original application records before API startup and verify expected seed/schema results                                                                                     | Keep paused; choose proven recovery or reviewed repair                             |
| Internal start   | Start candidate API/backup with web stopped; check readiness, identities, expected startup behavior and successful encrypted post-update archive                                    | Stop candidate writers/access; choose recovery by actual schema state              |
| Reopen           | Start web only after internal gates pass; this permits ordinary writes and marks the recovery boundary                                                                              | Check HTTPS/login immediately; stop web again on failure and assess any new writes |
| Accept           | Verify actual HTTPS/trusted-proxy behavior, financial read views, representative new UI, persistence and backup health                                                              | Record findings; never silently mark personal acceptance complete                  |

## Existing runtime commands

The later executable runbook must bind commands to the inspected configuration and approved phase. Existing primitives include:

- docker compose --env-file .env config --quiet
- docker compose --env-file .env pull
- docker compose --env-file .env stop web api backup
- /usr/local/bin/backup.sh from the selected existing backup image
- docker compose --env-file .env run --rm --no-deps migrate
- docker compose --env-file .env up -d --wait --wait-timeout 240 api backup
- docker compose --env-file .env up -d --wait --wait-timeout 240 web
- docker compose --env-file .env ps --all

These are phase-specific primitives, not an authorized copy/paste production script. Dependency restarts and the one-shot migrator's state must be checked against the actual Compose configuration. Do not allow a generic up invocation to bypass the explicit reviewed migration gate.

## Postconditions

- Actual running revision and all candidate digests match approved evidence.
- Original financial/auth/import/contract records and exact values have no unexplained migration differences.
- Expected additive schema/defaults exist; no invented balances, wealth history, account eligibility, profiles or groups.
- PostgreSQL/API/web/backup healthy; API/DB have no published host ports.
- Private HTTPS and login work; direct-IP application access returns 403; trusted-proxy configuration remains enabled.
- Existing-data overview/accounts/transactions/reports/contracts/import history and new reserve/wealth/settings/demo destinations are reachable; no real bank call or deliberate production demo mutation is required.
- A successful post-update encrypted archive and measured outage are recorded. Personal acceptance remains explicit.

## Recovery contract

- Before migration: return to the protected old configuration and existing data only through the approved abort path.
- After migration, before reopening: use previous images only with proven actual image/schema compatibility; retain additive tables. Otherwise recover the verified archive into a new isolated empty stack and verify before switching.
- After reopening: preserve/reconcile any new writes. Restoring the pre-update archive is not lossless and requires a concrete recovery/cutover decision.
- Never restore over the active database, run down --volumes, reset migrations, auto-drop new tables, rebuild source on rocky, recreate shared networks, disable proxy/security or reboot the shared host.

## Evidence and interfaces

This is an operational contract; no public application API changes are introduced. Record nonsecret release IDs, gate outcomes, table coverage/equality, archive identifiers, timings and acceptance results. Keep private backup/configuration/identity material outside Git and logs.
