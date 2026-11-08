# Private Linux deployment

> **Delivery status, 2026-11-08:** Private publication, immutable target pulls, runtime-only migration and deployment are complete at `d193639`; [status.md](status.md) records the evidence. Minimal scope of the existing registry credential (E3) and separately approved shared-host reboot acceptance (E4) remain unverified. Future deployments still require their own concrete approval and the checks below.

## Production contract

Source development stays local. GitHub Actions builds API/web/backup images, tests them in an isolated Linux installation, and saves the exact verified images. Only a push to main whose verify and operations jobs succeed may publish those saved images to private GHCR. The publisher checks full-revision image labels and does not rebuild after testing. It then creates a versioned downloadable deployment bundle and records published image digests in the job summary.

The production directory is `/root/docker/financial-tracking` on rocky. It contains only `compose.yaml`, `.env`, and required secrets/configuration. No repository, Dockerfiles, source mounts, or server builds. PostgreSQL uses the recorded upstream digest; migrate/API share one immutable API digest. The bundle's `.env.example` contains immutable app-image references, never registry credentials, database passwords, or bank PIN/TAN.

Use the bundle's [operator instructions](../infrastructure/DEPLOYMENT.md) for installation/update commands and prerequisite checks. The source `infrastructure/.env.example` intentionally contains release placeholders; only packaging with validated digests fills them. Do not replace them with `latest` or invent unverified digests.

## Network and readiness

Reinspect existing Compose projects, DHCP reservations and live conflicts before allocating `192.168.178.33`. Reuse external `FRITZBOX` / `traefik-public`; do not recreate shared networks. The web container gets the LAN address, but the browser URL remains `https://haushaltsbuch.mfurti.de` via existing Traefik, Netcup TLS, and `secured@file`. API/database remain on the application's own bridge without LAN addresses or host port mappings. The bridge permits outbound bank requests.

Web rejects direct application requests unless the socket peer resolves for `traefik.traefik-public`; the network-qualified alias selects the same bridge endpoint as Traefik's Docker routing. With both peers on the LAN and bridge, unqualified `traefik` can resolve to the LAN endpoint and reject legitimate HTTPS. Forged forwarding headers do not establish trust. Only a loopback `/health` probe bypasses that peer check. Local development does not require a proxy; the isolated direct-browser test launcher explicitly disables the production proxy gate. Never disable it for the deployed Macvlan service.

`GET /api/v1/health` reports liveness; `GET /api/v1/health/ready` performs a bounded database probe and returns a safe 503 on failure. Web `/health` checks the API/database dependency. These probes return no financial data, database details, or credentials. Compose waits for healthy PostgreSQL, successful migration, and healthy API before web. Backup starts only after successful migration so the first snapshot includes the schema.

## Secrets, persistence and updates

Preserve `household-ledger` project naming, `household-ledger_postgres_data`, existing user/category/transaction data, the database password, backup public recipients, and backup directory. Store secret files with restrictive permissions and dedicated SELinux file contexts. The bootstrap reads the password before dropping to UID/GID 1000. The private age identity stays separately managed, not in server source/configuration/images.

Private GHCR pulls need protected read-only package credentials in Docker's credential configuration; never Compose environment literals. Document rotation/revocation with the operator. Actual private publication and target-host pulls have been verified through the approved rollouts. Minimal scope of the existing server credential remains unverified (E3); successful pulls do not establish it. Future candidates need their own successful publication/pull evidence.

Before an approved production update, verify a fresh encrypted backup, record current image digests/configuration, agree on a maintenance window, stop writers, and run the reviewed migration on the exact candidate. A migration failure must leave access stopped without volume resets or automatic schema reversal. Image rollback requires schema compatibility; otherwise restore the tested pre-update backup into a new isolated stack with compatible images. See [recovery.md](recovery.md).

The old server source tree and obsolete path rules were removed after the approved transition and verification. Keep the runtime-only layout; never delete secrets, persistent volumes, or backups as cleanup. A shared-host reboot and real-bank access require separate explicit authorization.

## Backups and evidence

The default backup container creates an age-encrypted custom-format dump after migration and every 24 hours. Retention preserves all generated snapshots from the preceding seven full UTC calendar days plus today, including extra manual runs. Incomplete pipelines never publish a final archive. Backup health uses the last successful completion and becomes unhealthy after 25 hours; no automatic external notifications or recurring off-host copies are configured.

Local checks cover Compose structure, real pruning fixtures, bundle allowlisting/immutable references, API readiness errors, and proxy address decisions. Linux operations CI builds runtime images, validates image-only startup, registry/missing-secret/migration failures, real dependency recovery, direct-socket denial, encrypted restore and persistent data after recreation. These checks must actually pass for the candidate revision before completion is claimed; Windows has no Docker runtime.

Historical target-host TLS/restore and initial-delivery CI evidence is recorded in [progress.md](progress.md) and [initial-implementation-checklist.md](initial-implementation-checklist.md). It does not prove the new deployment candidate or real Sparkasse compatibility.
