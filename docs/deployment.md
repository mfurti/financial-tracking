# Private Linux deployment

## Requirements and configuration

Docker Engine with Compose v2, a Linux home/VPN interface, private DNS, and an age key pair for backups. No bank credentials are required for a CSV-only installation. Docker execution has not been verified on the Windows development workstation.

Copy `infrastructure/.env.example` to `infrastructure/.env`. Set PRIVATE_BIND_IP to the actual home/VPN interface address, APP_HOST to a privately resolved hostname, and PUBLIC_APP_URL to its HTTPS origin. Never use `0.0.0.0` or publish a router port. Check both IPv4/IPv6 and Docker's firewall integration on the target host.

Create `infrastructure/secrets/db_password` with a strong random database password and restrictive host permissions. Generate an age identity on a separate secure administrative machine. Put only its public recipient line(s) in `infrastructure/secrets/backup_recipients`. Keep the private age identity separately from this server and test that it decrypts a backup. Configure BACKUP_DIRECTORY on durable storage with enough capacity; copy encrypted backups to another physical location as appropriate.

No database password, bank PIN/TAN, session token, or private age key belongs in Git, images, Compose environment literals, CI, or screenshots. The API bootstrap reads the mounted database password and encodes it into an in-process connection URL, then drops root privileges to UID/GID 1000 before running application or migration code. Product ID and confirmed bank endpoint are optional server configuration; see [banking.md](banking.md).

## Initial installation

From the repository root:

```sh
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml config --quiet
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml build
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml up -d
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml run --rm -it api admin
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml ps
```

The one-shot migrator runs before the API starts. Administrative initialization prompts interactively for username/password (at least twelve characters), provisions the only user and default categories, and refuses to create a second user. Do not put a password in shell arguments.

Caddy uses its internal CA for the private hostname. Export the CA's public root certificate from the Caddy data volume and install it as trusted on authorized client devices. Never export its private key. Only port 443 is published, bound to PRIVATE_BIND_IP. API/PostgreSQL have no host port mappings. Visit PUBLIC_APP_URL via the home network or VPN, sign in, create a connection/account, and import CSV.

The web server uses `NUXT_API_INTERNAL_URL=http://api:3001` inside Compose. This is private runtime configuration; clients call `/api/v1` on their own origin. No external telemetry or analytics is configured.

## Backups and health

The backup container starts by default, takes an encrypted custom-format PostgreSQL dump immediately and every 24 hours, and retains the newest seven archives. Failed pipelines never publish a final archive. Its health check detects missing backups after 25 hours; inspect container health and the stable `backup complete`/`backup failed` messages. There are no automatic external notifications.

Backups include the database's actual financial data and session hashes but no bank PIN/TAN. Caddy certificate volumes, server configuration, database password, and the separately held age identity also need an operator-managed recovery copy. See [recovery.md](recovery.md).

## Updates

1. Record the running commit/image and take a fresh encrypted backup; verify its availability.
2. Stop web/API access for the maintenance window. Wait for or cancel active bank runs before shutdown.
3. Build the reviewed version. Run the migrator explicitly using `docker compose ... run --rm migrate` with the same env/file options as above.
4. Start/recreate the application services, verify health, login, categories, account balances, and a known monthly report.
5. If a migration fails, keep the application stopped and inspect safe diagnostics. Do not delete volumes or automatically reverse migrations. Restore the pre-update backup into a fresh database and use the recorded compatible image if rollback is necessary.

Before product use, run target-host acceptance: HTTPS trust, home/VPN-only reachability, real session cookies, initial install, daily backup health, and isolated restoration. These target-host checks remain open until actually executed.
