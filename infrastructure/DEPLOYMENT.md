# Deployment-only household ledger bundle

This directory contains only Compose, configuration templates, instructions, and the tested application revision. Runtime scripts and migrations are already in images. Do not clone a repository, copy source, or build images on rocky.

## Prepare the existing host

1. Use `/root/docker/financial-tracking`. Preserve the current PostgreSQL volume `household-ledger_postgres_data`, database password, and public backup recipients. Keep the private age identity on a separate administrative machine. Do not run `down --volumes` or provision a second user over restored/existing data.
2. Inspect the other Compose projects and existing `FRITZBOX` / `traefik-public` networks. Verify DHCP reservation/exclusion and absence of conflicts for `192.168.178.33`. The web container receives this IP; the browser URL remains `https://haushaltsbuch.mfurti.de`. Never recreate a shared network or add router forwarding.
3. Keep the existing Traefik `websecure`, `netcup` certificate resolver, `secured@file` middleware, and a Docker DNS alias `traefik` on `traefik-public`. Web accepts application traffic only from socket peers resolving to that alias, not from spoofed forwarding headers. Direct LAN access to web must return 403. Only loopback `/health` bypasses this peer rule.
4. Authenticate Docker interactively to private GHCR using a protected token with read-only package access. Never put this token in `.env`, shell arguments, Git, or Compose. Use an appropriate credential store; restrict root's Docker configuration. Revoke/rotate the token in GitHub and replace the saved credential with `docker logout ghcr.io` followed by an interactive login when access changes.
5. Copy `.env.example` to `.env`. Keep the provided immutable image digests. Set the host's actual backup directory, hostname/origin, and confirmed secret paths. Store `secrets/db_password` and `secrets/backup_recipients` with restrictive host permissions. Configure SELinux labels only for these dedicated bind paths; do not disable SELinux or relabel shared system directories.

## Install or update

Obtain the bundle built by successful CI for the intended full revision. A failed/unfinished publisher or PR artifact is not a production release. Record existing digests/configuration, verify a fresh encrypted pre-update backup, and agree on the maintenance window. Stop writes before applying a reviewed data migration. Keep the old deployment recovery copy encrypted off-server until acceptance.

```sh
cd /root/docker/financial-tracking
docker compose --env-file .env config --quiet
docker compose --env-file .env pull
docker compose --env-file .env up -d --wait --wait-timeout 240
docker compose --env-file .env ps --all
```

The migrator uses the same API digest and runs after PostgreSQL is healthy. A migration failure prevents API/web startup; investigate without resetting data. API health checks database readiness; web health checks its API/database dependency. For an existing running application, an update must also follow the reviewed migration/write-pause sequence; Compose health alone is not a safe rolling schema migration strategy.

On a genuinely fresh installation only, provision the single user interactively:

```sh
docker compose --env-file .env run --rm --no-deps -it api admin
```

Do not supply passwords in arguments. Use the domain through the home network, sign in, and verify expected accounts, exact amounts, categories, reports, and import history. Verify that direct-IP access is denied and API/database have no published ports. Only after successful migration, persistence, backup, HTTPS, and user acceptance may the old server source tree and obsolete application path rules be removed. Keep `.env`, secrets, database volume, and backup storage intact.

## Backups and recovery

Backups start immediately after migration and every 24 hours. Every generated encrypted snapshot from the seven preceding full UTC calendar days plus today is retained; extra manual runs do not evict daily archives. Files from unrelated tools are not pruned. Health becomes unhealthy when no completed backup exists or the last completion is more than 25 hours old. Healthchecks do not send external alerts, and recurring off-host copying is not configured.

Restore a populated encrypted backup only into an isolated empty PostgreSQL 17/application stack using the backup image's `/usr/local/bin/restore.sh` and explicit `CONFIRM_RESTORE=restore-to-empty-database`. Temporarily provide the private identity only to the isolated recovery environment or decrypt on the separate administrative machine; remove temporary plaintext/identity mounts afterward. Verify login, transactions, identities, categories, transfers and reports before considering a switch. Record recovery duration and compatible image/schema revisions.

Image rollback is safe only for a compatible schema. Otherwise recover the verified pre-update backup using its compatible image set; never promise an automatic down-migration or restore over the active database. Shared-host reboot, production data migration, and a real bank login remain separate approved actions. FinTS requires the user's own product ID and confirmed bank configuration; never put PIN/TAN in configuration.
