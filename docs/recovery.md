# Backup restoration

Restore into a **new empty PostgreSQL database**, never over an existing database. Keep the running server and its volumes intact until the replacement has been verified. The restore script checks that the public schema has no tables and refuses a nonempty target.

1. Prepare an isolated Linux/Docker environment with PostgreSQL 17 and a new empty database. Use a distinct Compose project/volume, private bind address, and backup output directory; do not point it at production services.
2. Recover the database password/configuration, chosen encrypted archive, and private age identity. Mount the archive and identity read-only into a temporary container built from `infrastructure/backup/Dockerfile`; mount the target's password at `/run/secrets/db_password`.
3. Set PGHOST, PGUSER, and PGDATABASE to that explicitly empty target. Execute:

```sh
CONFIRM_RESTORE=restore-to-empty-database \
  bash /usr/local/bin/restore.sh /restore/ledger-backup.dump.age /restore/age-identity.txt
```

Use the backup image with `--entrypoint bash` when starting the one-shot restore container; do not run the backup loop against the target. Attach only the isolated target network. The script verifies age authentication and pg_restore's archive structure before transactional restore. Its temporary plaintext file is removed on exit; use a disposable `--rm` container.

4. With the restored database, run Prisma migrations for the selected compatible application version, then start the API/web/proxy. Do not rerun admin creation over a restored user.
5. Check login, accounts, exact transaction counts/amounts, manual categories, transfers, monthly totals, and import history. The first API startup marks interrupted FinTS runs failed rather than restoring secrets. Verify that a new CSV import works; a new live bank run needs a new PIN and potentially TAN.
6. Record archive timestamp, target, application revision, and observed checks. Only switch the private hostname after verification. Remove the temporary identity mount and restore container.

Local PostgreSQL schema/import tests are not proof that the Docker backup/age/restore procedure works. Production acceptance requires an actual encrypted backup restoration on the target environment. No such Docker execution is claimed on the Windows workstation.

The isolated Linux operations job passed in [CI run 42299354331](https://github.com/mfurti/financial-tracking/actions/runs/42299354331): custom-format dump, age encryption/decryption, fresh-database restore, and exact synthetic amount/transfer/category checks. This verifies the container procedure; restoration of the operator's own backup and private-network setup remains a target-host acceptance step.
