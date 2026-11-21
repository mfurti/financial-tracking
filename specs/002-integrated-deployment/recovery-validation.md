# Candidate-Specific Recovery Validation

**Observed**: 2026-11-21 under approved G1 preparation, issue #15.
**Application candidate**: c06e7cc0d0639e4be8092473de696f4b6a3912b0.
**Tooling**: T004 d0e40dec2646e48222556034ce103aac6575603a and T005 170efe47d8aa32c01fee86d2018441e51bb1cb50.
**Result**: T006 recovery prerequisites passed; no production maintenance or owner acceptance claimed.

## Actual protected inputs

The existing completed production archive ledger-20261121T032703-10930.dump.age was copied read-only and matched SHA-256 e24d4c5deac27a0df413b114a568b899a9e72e506bd35372b2f552f6dd0152fd. No new production backup was generated.

The protected off-host configuration archive usability-d193639-config.tar.age authenticated successfully (SHA-256 69b0f7438fc2da905ba7006b8e86399716a2c188d81a7dc785751ff4d5fa6165). Its Compose, .env, database-password and backup-recipient bytes match the actual runtime files; only equality booleans were emitted, never secret values or their fingerprints.

The original private age identity remained on the administrative machine. Original archives were authenticated there. For Linux testing, the authenticated database dump was re-encrypted in memory to a one-use recovery identity; only this one-use identity entered the isolated restore container's tmpfs. The original private identity never entered the host/runtime/configuration/images. Restore plaintext and one-use identity files were confined to tmpfs and removed with the one-shot container. No plaintext dump or private row file was written on the workstation.

## Local complete-harness proof

The copied original archive passed scripts/verify-target-backup.ts in 49 seconds using an owned disposable local PostgreSQL database, Windows age and PostgreSQL 17 restore tooling. All 18 original application tables, 135 original columns and 1538 original rows were preserved; the two pending migrations, original ledger and new-table/default gates passed. Isolated password rotation/login, account/category/history access, exact monthly report and responsive UI passed without screenshots.

This local database used the repository's embedded PostgreSQL version and is independent supporting evidence, not the Linux PostgreSQL 17 claim below.

## Isolated Linux/PostgreSQL 17 image rehearsal

Resources were uniquely owned by preparation 15-c06e7cc under /root/docker/financial-tracking-rehearsal-15-c06e7cc, separate from project household-ledger and its production volume. The test network is internal; no test API/database/web host ports were published. Administrative access used SSH tunnels to the isolated container IPs. PostgreSQL/API/web were bounded to 256 MiB and 0.5 CPU per container, with old/new web/API exercised sequentially; the one-shot migrator was bounded to 512 MiB. No source repository/build was placed on the host.

- Engine: PostgreSQL 17.11 from the already pinned production PostgreSQL image.
- Actual backup image: candidate c06e7cc immutable digest recorded in release-readiness.md; its unchanged /usr/local/bin/restore.sh required an empty target, authenticated the one-use encrypted archive, inspected custom-dump structure and restored transactionally.
- First explicitly empty database: ledger_recovery. Actual previous d193639 API/web images served this original-schema recovery copy successfully; login, exact monthly report and 390/1440 px layout passed.
- Second explicitly empty database: ledger_candidate, independently restored from the same authenticated original dump. The actual candidate API image ran its Prisma migrator against this copy.
- Complete post-migration comparison passed for all 18 original tables, 135 fields and 1538 rows, including original credentials/session/history values before any application startup or disposable password rotation.
- Exactly 202611180001_reserve_wealth and 202611180002_workspace_settings were applied. Old ledger rows remained exact; new metadata/schema/defaults matched the reviewed SQL.
- Actual candidate API/web images then passed login, exact monthly report and responsive checks. Bank configuration was disabled and the internal network blocked external traffic; no real bank call or private screenshot occurred.
- A local administrative TLS fixture retained the production HTTPS-origin requirement; test-only trusted-proxy bypass was limited to the isolated web fixture. No production proxy/security configuration was changed.

The first fixture attempts exposed test-network port isolation and the old image's intentional HTTPS-origin requirement. Those attempts were not counted as passes. They were corrected through direct SSH forwarding and owned TLS termination, not by weakening the production images. Ownership-checked test resources were removed/recreated before the successful run.

## Measured results and chosen recovery

| Check                                                      | Observed result                      |
| ---------------------------------------------------------- | ------------------------------------ |
| Linux original-schema restore                              | 1 second                             |
| Linux independent candidate restore                        | 2 seconds                            |
| Candidate migrator plus complete comparison                | 5 seconds                            |
| Successful complete container rehearsal                    | 33 seconds with cached/staged images |
| Old-image recovery login/report/responsiveness             | Passed                               |
| Candidate-image login/report/responsiveness                | Passed                               |
| Original-table/field preservation and ledger/default gates | Passed                               |

Selected recovery mode: **restore the verified pre-update archive into a new empty isolated database/stack with the actual compatible previous images**. The old images were tested on the original recovered schema. Image-only rollback on the expanded schema was not tested and is not claimed.

These small measured samples are not a production lock/outage guarantee and exclude cold image pulls. Final quiescent backup proof, agreed maintenance window and G2 approval remain mandatory.

## Isolated post-update archive and cleanup

The candidate backup image generated ledger-20261121T114642-15132.dump.age only from the isolated candidate database. Its off-host encrypted copy authenticated with the existing original private identity and passed custom-dump structure inspection; 27 table-data entries account for 26 application tables plus the migration ledger. Ciphertext SHA-256: 3922df73526382faaee62075a8b0e7d36161d0011548631509ccf0021cb489f8.

The restored copies' passwords/sessions were changed only after preservation checks to exercise isolated login; this archive is rehearsal evidence, not a replacement production checkpoint. One-shot restore/migrate/backup containers were removed, old/new fixture web/API were stopped, and the owned PostgreSQL was stopped to release memory. Owned encrypted outputs and stopped rehearsal resources are retained for T008 failure drills.

All four actual household-ledger production services remained healthy, running their original images and original volume after the rehearsal. Protected nonsecret proof JSON resides in ignored .local/releases/c06e7cc. No production writer pause, migration, configuration replacement or source build occurred.
