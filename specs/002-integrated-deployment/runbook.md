# Reviewed Deployment Operator Runbook

**Authority**: Issue #15 preparation produces this runbook; it does not authorize production execution. The exact application/old-image identities, target, paths, timing proposal and approval response are bound in a protected local operator manifest. They are intentionally not duplicated in the public issue or this document.

## 0. Bind and verify the concrete proposal

The operator loads the protected manifest as data, validates every expected field and produces shell-quoted arguments. Never source untrusted JSON or print an interpolated runtime environment. Required bindings include target/project, runtime Compose/env paths and expected Compose identity; old/new immutable images and source revisions; original PostgreSQL/volume/network identity; protected backup/configuration locations; reviewed pending migrations; administrative identity/tool paths; and the maintenance/abort decision.

Reject unknown target/identity drift, mutable image references, missing publication or a changed pending migration set. Compare current private bindings with the actual target immediately before execution. Require the actual G2 response for this proposal before writer pause, target backup creation, runtime edits or migration. No preparation approval, elapsed time or checked source task is a substitute.

Public progress contains only task/check outcomes; protected operational bindings and private comparison evidence remain local. Existing source and release identities are distinct from the preparation-tooling commit.

## 1. Stage the tested candidate

Verify the candidate's successful main verification/operations/publication, matching nonexpired bundle, artifact checksum, runtime-file allowlist and image revision labels. Pull only its three immutable images; retain the old images and protected configuration. Compare the staged Compose bytes with the active runtime before selecting any replacement. No server repository, Dockerfile or source build is allowed.

Shell fragments below run only in the validated protected target context. The actual values are supplied by the reviewed manifest:

```sh
cd -- "$RUNTIME_DIRECTORY"
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" config --quiet
docker pull "$CANDIDATE_API_IMAGE"
docker pull "$CANDIDATE_WEB_IMAGE"
docker pull "$CANDIDATE_BACKUP_IMAGE"
```

Do not replace the existing environment with .env.example. Preserve every non-image setting and secret reference. No shared network, router, registry credential or host reboot change belongs to this runbook.

## 2. Begin the approved window and drain writers — T010

Check import/synchronization state without publishing rows. Never terminate COMMITTING. Stop web to prevent new browser work, then recheck active commits before stopping API; wait within the approved bound or abort/resume the old release before any schema change. Stop the backup loop to control the final archive boundary. Keep PostgreSQL and its original volume running.

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" stop web
# Recheck/drain existing commits here; abort on an unapproved window overrun.
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" stop api backup
```

The operator's exclusive administrative database connection captures all original application tables/fields with capturePreservationSnapshot in memory after the pause, plus exact original migration-ledger records. It uses the existing protected database secret without displaying a connection string. This read-only comparison is distinct from running the restore harness against production, which is forbidden.

## 3. Create and verify the final checkpoint — T010

Using the still-active old environment/image binding, generate one fresh encrypted checkpoint:

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" run --rm --no-deps -T --entrypoint /usr/local/bin/backup.sh backup
```

Identify the exact new archive by before/after filename inventory, not an assumed timestamp. Copy ciphertext off-host, verify its checksum and authenticate using the original private identity on the administrative machine. Verify protected configuration equality and retain the old images/configuration.

Restore this actual final archive into a newly empty, uniquely owned isolated PostgreSQL target. The reviewed existing restore script must reject nonempty targets; any one-use recovery identity/plaintext is confined to temporary isolated memory. The original private identity stays separately managed. Compare restored original fields with the paused production snapshot, rehearse the exact reviewed pending candidate upgrade and retain the original snapshot in administrative memory until production preservation is complete.

An earlier rehearsal is not proof of this later archive. If any archive/authentication/coverage/window gate fails, do not migrate; select the approved pre-migration abort path. Remove only verified task-owned temporary inputs.

## 4. Install only the approved runtime bindings — T011

Revalidate old runtime identity, configuration ownership/mode and approved image references. Because the reviewed topology is unchanged, keep the matching Compose file and alter only the three image-reference assignments atomically in the existing protected environment. Verify each old assignment before replacement, retain every other byte/setting and preserve restrictive permissions. Do not log or commit the environment.

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" config --quiet
```

If configuration validation fails before migration, restore the protected old configuration and leave access stopped until the approved abort check succeeds.

## 5. Run exactly the reviewed migrator and compare — T011

API and migrate must resolve to the same approved API digest. Execute the candidate one-shot explicitly; do not rely on an existing Compose migration container or a generic rolling update:

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" run --rm --no-deps -T migrate
```

Only a successful exit permits further checks. With API/web still stopped, compare every original table/field against the in-memory paused baseline using verifyPreservation and only the reviewed additive table allowlist. Verify every expected new table, exact reviewed ledger/checksum/status additions and unchanged old ledger fields; permit only the approved initial seed and empty new metadata. Existing original reserve/profile/group/wealth values must never be reset.

Never run scripts/verify-target-backup.ts against production or remove its isolation guards. Its reusable read-only comparator is the production comparison primitive; actual production migration remains the separately approved image command above.

On migration/preservation failure keep web/API stopped. Inspect only sanitized evidence and choose reviewed repair or the proven isolated-restore route. No reset, destructive down-migration, volume removal or speculative image-only rollback is permitted.

If the administrative process loses its in-memory baseline, leave access paused and reconstruct it from the verified final encrypted checkpoint in a new isolated empty target. Do not replace private memory evidence with an unprotected row file or assume preservation.

## 6. Verify internal startup and backup — T012

After explicit migration and preservation success, bypass dependency traversal so the successful one-shot cannot be silently rerun:

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" up -d --no-deps --wait --wait-timeout 240 api backup
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" ps --all
```

The 240-second readiness wait is a command bound, not an outage promise. Verify actual image labels/digests, original storage, bounded database/API readiness and expected startup behavior. Identify, authenticate and retain the actual new encrypted post-update archive; health markers alone are insufficient. External web remains stopped. Failure enters paused-failure and the selected recovery decision.

## 7. Reopen and mark the write boundary — T013

Only after all prior gates pass:

```sh
docker compose --project-name "$APPLICATION_PROJECT" --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" up -d --no-deps --wait --wait-timeout 240 web
```

Record the actual write-resume time and outage duration. This enables ordinary writes; there is no implemented production read-only mode. Check actual private HTTPS/login-page response immediately. Stop web again on failure and assess new writes before any older-checkpoint recovery.

## 8. Technical and owner acceptance — T014–T016

Verify actual private HTTPS/trusted-proxy behavior, direct-address denial, absence of API/database host ports, persistent data and completed backup. Use an existing authenticated owner session or interactive owner login for the read-only financial/UI checks. Never reset the production password, forge an owner session or request secret values in chat to make acceptance appear complete.

Read-only checks cover existing financial history and representative integrated destinations without a live bank run or new financial/demo mutation. Anonymous health/login-page success is not authenticated workflow acceptance. Record unavailable checks honestly.

The owner's assessment of depth/spacing/contrast/tiles/motion and normal workflows is a separate observed decision. Technical checks do not mark it accepted.

## 9. Recovery and abort decisions

| Boundary                                 | Required action                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before migration                         | Keep or restore the protected old runtime configuration; verify old health before the approved abort resumes access                                 |
| Migration/preservation/readiness failure | Keep access paused and storage intact; use reviewed repair or isolated restore                                                                      |
| Selected restore route                   | Restore the verified final checkpoint into a new empty isolated stack with the actual previous images; verify before an explicitly approved cutover |
| Image-only rollback                      | Not selected: old-image compatibility on the expanded schema has not been established                                                               |
| After write resume                       | Preserve/reconcile new writes before any older-checkpoint cutover; obtain the concrete recovery decision                                            |
| Window overrun                           | Stop at the approved abort point; never invent permission to extend the outage                                                                      |

Do not restore over the active database, use down --volumes, reset migrations, drop additive metadata, delete backups/secrets or change shared-host/network/security state.

## 10. Evidence and completion

Keep private operational bindings and full preservation input in protected local storage/memory. Public evidence contains sanitized check/task outcomes only. Record actual candidate/tooling identities, archive integrity, migration/preservation/readiness/reopen outcomes and measured durations in the protected execution record.

Commit/push each completed file-changing task immediately under the project workflow, without losing the live in-memory comparison baseline. Read-only proof does not require an empty commit. Do not claim T010–T017 complete from preparation or mark personal acceptance without an actual response.
