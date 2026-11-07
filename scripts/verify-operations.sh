#!/usr/bin/env bash
# Isolated Linux acceptance only. Never reads production configuration or networks.
set -euo pipefail
repository="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repository"
mkdir -p .local
ops_dir="$(mktemp -d "$repository/.local/ops.XXXXXX")"
project="ledger-ci-${RANDOM}-${RANDOM}"
restore_name="${project}-restore"
restore_api="${project}-restore-api"
restore_web="${project}-restore-web"
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
# Exercise the publisher's registry-manifest format against the already pinned public database image.
postgres_reference="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["services"]["postgres"]["image"])' "$ops_dir/resolved.json")"
docker buildx imagetools inspect "$postgres_reference" --format '{{json .Manifest}}' | python3 -c 'import json,re,sys; digest=json.load(sys.stdin)["digest"]; assert re.fullmatch(r"sha256:[a-f0-9]{64}",digest); assert digest == sys.argv[1].split("@",1)[1]' "$postgres_reference"
compose=(docker compose --project-name "$project" -f "$ops_dir/compose.json")
cleanup() {
 docker rm -f "$restore_web" "$restore_api" "$restore_name" >/dev/null 2>&1 || true
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
"${compose[@]}" exec -T api node --input-type=module <<'JS'
import {readFile} from 'node:fs/promises';
import {createDb} from './dist/db.js';
import {passwordHash} from './dist/auth.js';
const url=new URL('postgresql://ledger@postgres/ledger');
url.password=(await readFile('/run/secrets/db_password','utf8')).trim();
const db=createDb(url.href);
await db.user.create({data:{username:'restore-check',passwordHash:await passwordHash('synthetic-restore-password-only')}});
await db.$disconnect();
JS
"${compose[@]}" exec -T postgres psql -U ledger -d ledger -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "BankConnection" (id,name,"bankCode","connectorType","updatedAt") VALUES ('10000000-0000-4000-8000-000000000001','Synthetic backup bank','69050001','CSV',NOW());
INSERT INTO "Account" (id,"bankConnectionId",name) VALUES ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Synthetic account');
INSERT INTO "Category" (id,name,kind) VALUES ('10000000-0000-4000-8000-000000000003','Synthetic category','EXPENSE');
INSERT INTO "Transaction" (id,"accountId","amountCents","bookingDate",description,"categoryId","isTransfer","updatedAt") VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002',-1234,'2026-11-06','Synthetic restore proof','10000000-0000-4000-8000-000000000003',TRUE,NOW());
INSERT INTO "ImportRun" (id,source,status,"importedCount","finishedAt") VALUES ('10000000-0000-4000-8000-000000000005','CSV','COMPLETED',1,NOW());
INSERT INTO "Transaction" (id,"accountId","amountCents","bookingDate",description,"categoryId","updatedAt") VALUES ('10000000-0000-4000-8000-000000000006',NULL,-456,'2026-11-06','Synthetic unassigned restore','10000000-0000-4000-8000-000000000003',NOW());
INSERT INTO "TransactionIdentity" (id,"transactionId","accountId",scope,"identityType","identityValue","importRunId") VALUES ('10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000006',NULL,'import:10000000-0000-4000-8000-000000000005','CSV_FINGERPRINT','synthetic-source','10000000-0000-4000-8000-000000000005');
SQL
# Synthetic credential markers exercise the real safe-error/persistence path without bank configuration.
curl --fail --silent --show-error --cacert "$ops_dir/root.crt" -c "$ops_dir/cookies" \
 -H 'Origin: https://localhost' -H 'Content-Type: application/json' \
 --data '{"username":"restore-check","password":"synthetic-restore-password-only"}' https://localhost/api/v1/auth/login > "$ops_dir/login.json"
csrf="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["csrfToken"])' < "$ops_dir/login.json")"
curl --fail --silent --show-error --cacert "$ops_dir/root.crt" -b "$ops_dir/cookies" \
 -H 'Origin: https://localhost' -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
 --data '{"name":"Synthetic unavailable bank","bankCode":"69050001","connectorType":"FINTS","username":"synthetic"}' https://localhost/api/v1/bank-connections > "$ops_dir/connection.json"
connection_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' < "$ops_dir/connection.json")"
status="$(curl --silent --show-error --cacert "$ops_dir/root.crt" -b "$ops_dir/cookies" -o "$ops_dir/safe-error.json" -w '%{http_code}' \
 -H 'Origin: https://localhost' -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
 --data '{"pin":"CANARY_PIN_CI_394ba"}' "https://localhost/api/v1/bank-connections/$connection_id/sync")"
test "$status" = 409
run_id="$("${compose[@]}" exec -T postgres psql -U ledger -d ledger -Atqc "SELECT id FROM \"ImportRun\" WHERE source='FINTS' ORDER BY \"startedAt\" DESC LIMIT 1")"
status="$(curl --silent --show-error --cacert "$ops_dir/root.crt" -b "$ops_dir/cookies" -o "$ops_dir/safe-tan-error.json" -w '%{http_code}' \
 -H 'Origin: https://localhost' -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
 --data '{"tan":"CANARY_TAN_CI_84a2c"}' "https://localhost/api/v1/import-runs/$run_id/challenge")"
test "$status" = 409
python3 - "$ops_dir" <<'PY'
import sys
from pathlib import Path
for name in ['safe-error.json','safe-tan-error.json']:
 data=(Path(sys.argv[1])/name).read_text()
 assert 'CANARY_PIN_CI_' not in data and 'CANARY_TAN_CI_' not in data
PY
"${compose[@]}" stop postgres
"${compose[@]}" exec -T api node -e "fetch('http://127.0.0.1:3001/api/v1/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.status===503?0:1))"
"${compose[@]}" start postgres
for attempt in {1..30}; do if "${compose[@]}" exec -T postgres pg_isready -h 127.0.0.1 -U ledger -d ledger >/dev/null 2>&1; then break; fi; sleep 1; done
"${compose[@]}" exec -T api node -e "fetch('http://127.0.0.1:3001/api/v1/health/ready',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1))"
"${compose[@]}" exec -T backup /usr/local/bin/backup.sh
archive="$(find "$ops_dir/backups" -name 'ledger-*.dump.age' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
test -s "$archive"
docker run --detach --rm --name "$restore_name" --network "${project}_private" \
 --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
 -e POSTGRES_USER=ledger -e POSTGRES_DB=ledger -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password \
 "$(docker inspect "$project-postgres-1" --format '{{.Config.Image}}')" >/dev/null
for attempt in {1..60}; do if docker exec "$restore_name" pg_isready -h 127.0.0.1 -U ledger -d ledger >/dev/null 2>&1; then break; fi; sleep 1; done
docker run --rm --network "${project}_private" --entrypoint bash \
 --mount "type=bind,src=$archive,dst=/restore/archive.age,readonly" \
 --mount "type=bind,src=$ops_dir/identity.txt,dst=/restore/identity,readonly" \
 --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
 -e PGHOST="$restore_name" -e PGUSER=ledger -e PGDATABASE=ledger -e CONFIRM_RESTORE=restore-to-empty-database \
 "$backup_image" -e -c '/usr/local/bin/restore.sh /restore/archive.age /restore/identity; test -z "$(find /tmp -maxdepth 1 -type f -name "tmp.*" -print -quit)"'
restored="$(docker exec "$restore_name" psql -U ledger -d ledger -Atqc 'SELECT "amountCents"::text || '\''|'\'' || "isTransfer"::text || '\''|'\'' || c.name FROM "Transaction" t JOIN "Category" c ON c.id=t."categoryId" WHERE t.id='\''10000000-0000-4000-8000-000000000004'\''')"
test "$restored" = '-1234|true|Synthetic category'
docker run --detach --rm --name "$restore_api" --network "${project}_private" \
 --mount "type=bind,src=$ops_dir/db_password,dst=/run/secrets/db_password,readonly" \
 -e DB_PASSWORD_FILE=/run/secrets/db_password -e DB_HOST="$restore_name" -e PUBLIC_APP_URL=https://localhost "$api_image" >/dev/null
docker run --detach --rm --name "$restore_web" --network "${project}_private" \
 -e "NUXT_API_INTERNAL_URL=http://${restore_api}:3001" -e NUXT_REQUIRE_TRUSTED_PROXY=false "$web_image" >/dev/null
for attempt in {1..60}; do if docker exec "$restore_web" node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec -i "$restore_web" node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const root='http://127.0.0.1:3000/api/v1';
const login=await fetch(root+'/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://localhost'},body:JSON.stringify({username:'restore-check',password:'synthetic-restore-password-only'})});
assert.equal(login.status,201);
const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
for(const [path,count] of [['accounts',1],['categories',1],['imports',2]]) {
 const response=await fetch(root+'/'+path,{headers}); assert.equal(response.status,200); assert.equal((await response.json()).length,count);
}
const transactions=await fetch(root+'/transactions',{headers});
assert.equal(transactions.status,200); assert.equal((await transactions.json()).items.length,2);
const report=await fetch(root+'/analytics/monthly?month=2026-11',{headers});
assert.equal(report.status,200); assert.equal((await report.json()).netCents,'-456');
const page=await fetch('http://127.0.0.1:3000/'); assert.equal(page.status,200);
JS
# Scan data obtained from the decrypted restore, plus actual application/container logs.
docker exec "$restore_name" pg_dump -U ledger -d ledger --no-owner --no-acl | python3 -c 'import sys; data=sys.stdin.buffer.read(); assert b"CANARY_PIN_CI_" not in data and b"CANARY_TAN_CI_" not in data'
for container in "$project-api-1" "$project-web-1" "$project-backup-1" "$restore_api" "$restore_web"; do
 docker logs "$container" 2>&1 | python3 -c 'import sys; data=sys.stdin.buffer.read(); assert b"CANARY_PIN_CI_" not in data and b"CANARY_TAN_CI_" not in data'
done
"${compose[@]}" up -d --force-recreate --wait --wait-timeout 240
count="$("${compose[@]}" exec -T postgres psql -U ledger -d ledger -Atqc 'SELECT count(*) FROM "Transaction"')"
test "$count" = 2
for image in "$api_image" "$web_image"; do
 docker run --rm --entrypoint node "$image" -e "const fs=require('node:fs');for(const p of ['/app/.git','/app/.env','/app/secrets','/app/apps'])if(fs.existsSync(p))process.exit(1)"
done
if test "${EXPORT_VERIFIED_IMAGES:-0}" = 1; then
 mkdir -p .local/verified-images
 docker save "$api_image" "$web_image" "$backup_image" | gzip > .local/verified-images/images.tar.gz
fi
printf 'Image-only deployment, prerequisite failures, readiness/recovery, proxy boundary, encrypted restore and persistence passed.\n'
