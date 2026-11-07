# Stage 1 delivery and remaining acceptance

This record separates implemented source from external/live acceptance. Stage 2 budgets and Stage 3 recurring expenses remain unauthorized.

## Source increments

| Increment                           | Commit               | Evidence                                                                                                                                                       |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 baseline                         | `e2e4963`            | Preserved user plan/local documentation; 26 baseline tests and both initial browser profiles                                                                   |
| P1.1 image-only operations          | `4af2e65`, `8512215` | [CI 42367331141](https://github.com/mfurti/financial-tracking/actions/runs/42367331141): verify and Linux operations passed                                    |
| P1.2 accountless CSV                | `07ebc21`            | 42 tests/four browser projects; [CI 42370494493](https://github.com/mfurti/financial-tracking/actions/runs/42370494493) passed                                 |
| P1.3 interface/themes               | `f0ace1c`            | 44 tests/six browser cases; [CI 42371818775](https://github.com/mfurti/financial-tracking/actions/runs/42371818775) passed                                     |
| P1.4 authorization and setup        | `d6d6c2c`, `7f01161` | 56 tests/eight browser cases; [CI 42373191575](https://github.com/mfurti/financial-tracking/actions/runs/42373191575) passed                                   |
| P1.5 final recovery/auth acceptance | `86f7b89`            | [CI 42374488764](https://github.com/mfurti/financial-tracking/actions/runs/42374488764) passed; actual initialized target archive recovered locally            |
| Final transfer correction           | `78f3371`            | [PR CI 42374808449](https://github.com/mfurti/financial-tracking/actions/runs/42374808449): 61 tests, eight browser cases and expanded Linux operations passed |

The CI publisher intentionally skips feature branches. Green feature CI does not mean production images were published or the server was updated.

Source review: [PR #4](https://github.com/mfurti/financial-tracking/pull/4), still open and unmerged. The parallel push run at `78f3371` exposed an intermittent detail-navigation failure despite the green PR run. Investigation reproduced a stale list response rewriting a detail URL. The correction `7754522` passed both [push CI](https://github.com/mfurti/financial-tracking/actions/runs/42386882489) and [PR CI](https://github.com/mfurti/financial-tracking/actions/runs/42386886259), including 61 tests, eight browser cases and expanded Linux operations. The final documentation-only head is verified separately before handoff.

## Target backup recovery, 2026-11-07

A read-only SSH lookup identified the newest existing encrypted target-host archive. Only the encrypted archive was copied locally. The private recovery identity remained in the administrative user's protected configuration directory; it was never uploaded or committed.

- Encrypted archive SHA-256: `98e744cf2644dc6dcc0b3097041763898bc5ca47df567990599abb984201592d`.
- Tools: age 1.3.2 (official GitHub release asset digest checked), PostgreSQL client 17.11 (official EDB binary archive), disposable embedded PostgreSQL 18.6, Node 24.22.1 and the current built API/web.
- Latest successful check: **11 seconds**, including decrypt/import, reviewed forward migration, preservation comparison, actual API/web startup, authentication, accounts/categories/history, monthly report and desktop/mobile geometry.
- Original rows/fields, including the password hash, were compared before/after migration. Only afterward was the password rotated **in the disposable copy** to exercise login without requesting the real password. No production credential changed.
- Decryption streamed directly into `pg_restore --single-transaction`. No plaintext dump file was created. The local app bound loopback ports only; bank configuration was disabled; its disposable database/processes were removed afterward.
- **Limit:** this initialized target backup contains no financial transactions. It proves actual archive/key usability, migration/preservation and app recovery; populated financial restoration is covered separately by synthetic Linux CI. It does not prove restoration of financial rows that were absent from this archive.
- This local PostgreSQL 18 recovery is not a downgrade or a replacement for the production PostgreSQL 17 CI recovery. No production restore, reboot or rollout occurred.

Repeat locally after `pnpm build`, using explicit tool/archive/identity paths:

```text
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/verify-target-backup.ts ARCHIVE.age IDENTITY AGE_EXECUTABLE PG_RESTORE_EXECUTABLE
```

The verifier rejects CI and externally supplied `TEST_DATABASE_URL`, creates its own empty local cluster, suppresses sensitive process output and produces only boolean/hash/timing evidence. Neither the backup nor recovery keys belong in GitHub artifacts. Local helper downloads and evidence remain ignored under `.local`.

## Required external decisions and work

1. Review the feature PR and approve its merge separately. CI must pass for its current head before merge.
2. After the approved main merge, verify private GHCR visibility/permissions, published digests and the exact deployment-only bundle. Give rocky read-only package access through protected Docker credentials.
3. Before assigning `.33`, verify DHCP reservation/exclusion and non-Docker conflicts; recheck the existing `FRITZBOX`/Traefik networks. Prepared Compose is not an allocated/reserved IP.
4. Obtain a separate production window: record old image/config revisions, take/verify a fresh encrypted backup, pause writes, deploy the matching digest-pinned API/web/migrator, validate data/HTTPS/private access/readiness/backup health, then reopen writes.
5. After successful transition, remove only obsolete server source/build material and the old project-specific `/opt` SELinux path rules. Preserve Compose/env/secrets, the existing database volume and backup storage. No cleanup has happened yet.
6. Use the [registration guide](fints-registration.md) to apply for the application's own FinTS product ID and obtain the bank-confirmed endpoint/access. Then separately approve an accompanied live account/balance/history/TAN test. Synthetic success does not close this item.
7. Shared-host reboot acceptance requires a separate approved window. No reboot is included in ordinary feature CI or rollout approval.
8. Jointly accept Stage 1: layout, workflow, exact totals, reconciliation, operations and explicit real-bank limitations. Start neither Stage 2 nor Stage 3 without their separate approvals.

Image-only rollback requires schema compatibility. An incompatible schema requires the verified pre-update backup and matching image set; no automatic down-migration is promised.
