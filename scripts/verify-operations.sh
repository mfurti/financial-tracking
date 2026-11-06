#!/usr/bin/env bash
# Isolated CI acceptance only; never reads production configuration or volumes.
set -euo pipefail
repository="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repository"
ops_dir="$(mktemp -d "$repository/.local/ops.XXXXXX")"
project="ledger-ci-${RANDOM}-${RANDOM}"
restore_name="${project}-restore"
mkdir -p "$ops_dir/backups"
umask 077
openssl rand -hex 32 > "$ops_dir/db_password"
: > "$ops_dir/recipients.txt"
cat > "$ops_dir/config.env" <<EOF
PRIVATE_BIND_IP=127.0.0.1
APP_HOST=localhost
PUBLIC_APP_URL=https://localhost
DB_PASSWORD_FILE=$ops_dir/db_password
BACKUP_RECIPIENTS_FILE=$ops_dir/recipients.txt
BACKUP_DIRECTORY=$ops_dir/backups
EOF
compose=(docker compose --project-name "$project" --env-file "$ops_dir/config.env" -f infrastructure/compose.yaml)
cleanup() { docker rm -f "$restore_name" >/dev/null 2>&1 || true; "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${compose[@]}" build
backup_image="$("${compose[@]}" images -q backup)"
if [[ -z "$backup_image" ]]; then backup_image="${project}-backup"; fi
docker run --rm --entrypoint age-keygen "$backup_image" > "$ops_dir/identity.txt"
docker run --rm --mount "type=bind,src=$ops_dir/identity.txt,dst=/identity,readonly" --entrypoint age-keygen "$backup_image" -y /identity > "$ops_dir/recipients.txt"
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 180
"${compose[@]}" exec -T proxy cat /data/caddy/pki/authorities/local/root.crt > "$ops_dir/root.crt"
curl --fail --silent --show-error --cacert "$ops_dir/root.crt" https://localhost/api/v1/health | grep -q '"status":"ok"'
status="$(curl --silent --cacert "$ops_dir/root.crt" -o /dev/null -w '%{http_code}' https://localhost/api/v1/accounts)"
test "$status" = 401
"${compose[@]}" exec -T postgres psql -U ledger -d ledger -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "BankConnection" (id,name,"bankCode","connectorType","updatedAt") VALUES ('10000000-0000-4000-8000-000000000001','Synthetic backup bank','69050001','CSV',NOW());
INSERT INTO "Account" (id,"bankConnectionId",name) VALUES ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Synthetic account');
INSERT INTO "Category" (id,name,kind) VALUES ('10000000-0000-4000-8000-000000000003','Synthetic category','EXPENSE');
INSERT INTO "Transaction" (id,"accountId","amountCents","bookingDate",description,"categoryId","isTransfer","updatedAt") VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',-1234,'2026-11-06','Synthetic restore proof','10000000-0000-4000-8000-000000000003',TRUE,NOW());
SQL
"${compose[@]}" exec -T backup /usr/local/bin/backup.sh
archive="$(find "$ops_dir/backups" -name 'ledger-*.dump.age' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
test -s "$archive"
docker run --detach --rm --name "$restore_name" --network "${project}_private" \
  --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
  -e POSTGRES_USER=ledger -e POSTGRES_DB=ledger -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password postgres:17-bookworm >/dev/null
for attempt in {1..60}; do if docker exec "$restore_name" pg_isready -U ledger -d ledger >/dev/null 2>&1; then break; fi; sleep 1; done
docker run --rm --network "${project}_private" --entrypoint bash \
  --mount "type=bind,src=$archive,dst=/restore/archive.age,readonly" \
  --mount "type=bind,src=$ops_dir/identity.txt,dst=/restore/identity,readonly" \
  --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
  -e PGHOST="$restore_name" -e PGUSER=ledger -e PGDATABASE=ledger -e CONFIRM_RESTORE=restore-to-empty-database \
  "$backup_image" /usr/local/bin/restore.sh /restore/archive.age /restore/identity
restored="$(docker exec "$restore_name" psql -U ledger -d ledger -Atqc 'SELECT "amountCents"::text || '\''|'\'' || "isTransfer"::text || '\''|'\'' || c.name FROM "Transaction" t JOIN "Category" c ON c.id=t."categoryId"')"
test "$restored" = '-1234|true|Synthetic category'
printf 'Private HTTPS, authentication boundary, encrypted backup and isolated restore passed.\n'
