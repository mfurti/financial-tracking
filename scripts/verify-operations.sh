#!/usr/bin/env bash
# Isolated Linux acceptance only. Never reads production configuration or networks.
set -euo pipefail
repository="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repository"
mkdir -p .local
ops_dir="$(mktemp -d "$repository/.local/ops.XXXXXX")"
project="ledger-ci-${RANDOM}-${RANDOM}"
restore_name="${project}-restore"
revision="$(git rev-parse HEAD)"
mkdir -p "$ops_dir/backups"
umask 077
openssl rand -hex 32 > "$ops_dir/db_password"
: > "$ops_dir/recipients.txt"
api_image="ledger-verified-api:${revision}"
web_image="ledger-verified-web:${revision}"
backup_image="ledger-verified-backup:${revision}"
docker build --build-arg "VCS_REF=$revision" -f infrastructure/Dockerfile --target api -t "$api_image" .
docker build --build-arg "VCS_REF=$revision" -f infrastructure/Dockerfile --target web -t "$web_image" .
docker build --build-arg "VCS_REF=$revision" -t "$backup_image" infrastructure/backup
cat > "$ops_dir/config.env" <<EOF
API_IMAGE=$api_image
WEB_IMAGE=$web_image
BACKUP_IMAGE=$backup_image
APP_HOST=localhost
PUBLIC_APP_URL=https://localhost
DB_PASSWORD_FILE=$ops_dir/db_password
BACKUP_RECIPIENTS_FILE=$ops_dir/recipients.txt
BACKUP_DIRECTORY=$ops_dir/backups
EOF
docker run --rm --entrypoint age-keygen "$backup_image" > "$ops_dir/identity.txt"
docker run --rm --mount "type=bind,src=$ops_dir/identity.txt,dst=/identity,readonly" --entrypoint age-keygen "$backup_image" -y /identity > "$ops_dir/recipients.txt"
docker compose --project-name "$project" --env-file "$ops_dir/config.env" -f infrastructure/compose.yaml config --format json > "$ops_dir/resolved.json"
python3 - "$ops_dir" "$repository" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); root=Path(sys.argv[2])
d=json.loads((p/'resolved.json').read_text())
d['networks']={'private':{},'edge':{}}
d['volumes']={'postgres_data':{},'caddy_data':{},'caddy_config':{}}
d['services']['web']['networks']={'private':{},'edge':{}}
d['services']['web'].pop('labels',None)
d['services']['proxy']={
 'image':'caddy:2.10','environment':{'APP_HOST':'localhost'},'ports':['127.0.0.1:443:443'],
 'volumes':[str(root/'infrastructure/proxy/Caddyfile')+':/etc/caddy/Caddyfile:ro','caddy_data:/data','caddy_config:/config'],
 'networks':{'edge':{'aliases':['traefik']}},'depends_on':{'web':{'condition':'service_healthy'}}}
# Compose config already re-escapes literal dollars for round trips. Do not escape them twice.
(p/'compose.json').write_text(json.dumps(d))
bad=json.loads(json.dumps(d)); bad['services']['migrate']['entrypoint']=['node','-e','process.exit(1)']; bad['services']['migrate']['command']=[]
(p/'bad-migration.json').write_text(json.dumps(bad))
missing=json.loads(json.dumps(d)); missing['secrets']['db_password']['file']=str(p/'missing-secret')
(p/'missing-secret.json').write_text(json.dumps(missing))
registry=json.loads(json.dumps(d)); registry['services']['web']['image']='127.0.0.1:1/unavailable@sha256:'+'0'*64
(p/'registry.json').write_text(json.dumps(registry))
PY
compose=(docker compose --project-name "$project" -f "$ops_dir/compose.json")
cleanup() {
 docker rm -f "$restore_name" >/dev/null 2>&1 || true
 for item in main bad missing registry; do
  case "$item" in
   main) name="$project"; file=compose;;
   bad) name="${project}-bad"; file=bad-migration;;
   missing) name="${project}-missing"; file=missing-secret;;
   registry) name="${project}-registry"; file=registry;;
  esac
  docker compose --project-name "$name" -f "$ops_dir/$file.json" down --volumes --remove-orphans >/dev/null 2>&1 || true
 done
}
trap cleanup EXIT
diagnose() {
 status=$?
 trap - ERR
 printf 'Isolated operations failure; synthetic-container diagnostics follow.\n' >&2
 "${compose[@]}" ps --all || true
 "${compose[@]}" logs --no-color --tail 25 backup || true
 backup_id="$("${compose[@]}" ps -aq backup)" || true
 if test -n "${backup_id:-}"; then docker inspect "$backup_id" --format '{{json .State.Health}}' || true; fi
 exit "$status"
}
trap diagnose ERR
"${compose[@]}" config --quiet
if docker compose -p "${project}-registry" -f "$ops_dir/registry.json" pull web; then printf 'Unavailable registry unexpectedly succeeded\n' >&2; exit 1; fi
if docker compose -p "${project}-missing" -f "$ops_dir/missing-secret.json" up -d; then printf 'Missing secret unexpectedly succeeded\n' >&2; exit 1; fi
if docker compose -p "${project}-bad" -f "$ops_dir/bad-migration.json" up -d --wait --wait-timeout 90; then printf 'Failed migration unexpectedly succeeded\n' >&2; exit 1; fi
bad_id="$(docker compose -p "${project}-bad" -f "$ops_dir/bad-migration.json" ps -aq migrate)"
test "$(docker inspect "$bad_id" --format '{{.State.ExitCode}}')" = 1
test -z "$(docker ps -q --filter "label=com.docker.compose.project=${project}-bad" --filter label=com.docker.compose.service=api)"
"${compose[@]}" up -d --wait --wait-timeout 240
"${compose[@]}" exec -T proxy cat /data/caddy/pki/authorities/local/root.crt > "$ops_dir/root.crt"
curl --fail --silent --show-error --cacert "$ops_dir/root.crt" https://localhost/api/v1/health/ready | grep -q '"status":"ok"'
status="$(curl --silent --cacert "$ops_dir/root.crt" -o /dev/null -w '%{http_code}' https://localhost/api/v1/accounts)"
test "$status" = 401
# A forged forwarding header on a direct socket must not bypass the proxy peer gate.
"${compose[@]}" exec -T web node -e "fetch('http://web:3000/api/v1/health',{headers:{'x-forwarded-for':'192.168.178.10','x-forwarded-proto':'https','host':'localhost'}}).then(r=>process.exit(r.status===403?0:1))"
"${compose[@]}" exec -T postgres psql -U ledger -d ledger -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "BankConnection" (id,name,"bankCode","connectorType","updatedAt") VALUES ('10000000-0000-4000-8000-000000000001','Synthetic backup bank','69050001','CSV',NOW());
INSERT INTO "Account" (id,"bankConnectionId",name) VALUES ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Synthetic account');
INSERT INTO "Category" (id,name,kind) VALUES ('10000000-0000-4000-8000-000000000003','Synthetic category','EXPENSE');
INSERT INTO "Transaction" (id,"accountId","amountCents","bookingDate",description,"categoryId","isTransfer","updatedAt") VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',-1234,'2026-11-06','Synthetic restore proof','10000000-0000-4000-8000-000000000003',TRUE,NOW());
SQL
"${compose[@]}" stop postgres
"${compose[@]}" exec -T api node -e "fetch('http://127.0.0.1:3001/api/v1/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.status===503?0:1))"
"${compose[@]}" start postgres
for attempt in {1..30}; do if "${compose[@]}" exec -T postgres pg_isready -U ledger -d ledger >/dev/null 2>&1; then break; fi; sleep 1; done
"${compose[@]}" exec -T api node -e "fetch('http://127.0.0.1:3001/api/v1/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1))"
"${compose[@]}" exec -T backup /usr/local/bin/backup.sh
archive="$(find "$ops_dir/backups" -name 'ledger-*.dump.age' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
test -s "$archive"
docker run --detach --rm --name "$restore_name" --network "${project}_private" \
 --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
 -e POSTGRES_USER=ledger -e POSTGRES_DB=ledger -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password \
 "$(docker inspect "$project-postgres-1" --format '{{.Config.Image}}')" >/dev/null
for attempt in {1..60}; do if docker exec "$restore_name" pg_isready -U ledger -d ledger >/dev/null 2>&1; then break; fi; sleep 1; done
docker run --rm --network "${project}_private" --entrypoint bash \
 --mount "type=bind,src=$archive,dst=/restore/archive.age,readonly" \
 --mount "type=bind,src=$ops_dir/identity.txt,dst=/restore/identity,readonly" \
 --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
 -e PGHOST="$restore_name" -e PGUSER=ledger -e PGDATABASE=ledger -e CONFIRM_RESTORE=restore-to-empty-database \
 "$backup_image" /usr/local/bin/restore.sh /restore/archive.age /restore/identity
restored="$(docker exec "$restore_name" psql -U ledger -d ledger -Atqc 'SELECT "amountCents"::text || '\''|'\'' || "isTransfer"::text || '\''|'\'' || c.name FROM "Transaction" t JOIN "Category" c ON c.id=t."categoryId"')"
test "$restored" = '-1234|true|Synthetic category'
"${compose[@]}" up -d --force-recreate --wait --wait-timeout 240
count="$("${compose[@]}" exec -T postgres psql -U ledger -d ledger -Atqc 'SELECT count(*) FROM "Transaction"')"
test "$count" = 1
for image in "$api_image" "$web_image"; do
 docker run --rm --entrypoint node "$image" -e "const fs=require('node:fs');for(const p of ['/app/.git','/app/.env','/app/secrets','/app/apps'])if(fs.existsSync(p))process.exit(1)"
done
if test "${EXPORT_VERIFIED_IMAGES:-0}" = 1; then
 mkdir -p .local/verified-images
 docker save "$api_image" "$web_image" "$backup_image" | gzip > .local/verified-images/images.tar.gz
fi
printf 'Image-only deployment, prerequisite failures, readiness/recovery, proxy boundary, encrypted restore and persistence passed.\n'
