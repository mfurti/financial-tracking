#!/usr/bin/env bash
set -euo pipefail
umask 077
export PGPASSWORD
PGPASSWORD="$(cat /run/secrets/db_password)"
mkdir -p /backups
temporary="$(mktemp /backups/.ledger-backup.XXXXXX)"
trap 'rm -f -- "$temporary"' EXIT
pg_dump --format=custom --no-owner --no-acl | age --recipients-file /run/secrets/backup_recipients > "$temporary"
test -s "$temporary"
mv -- "$temporary" "/backups/ledger-$(date -u +%Y%m%dT%H%M%S)-${RANDOM}.dump.age"
/usr/local/bin/prune-backups.sh /backups
touch /tmp/backup-success
printf 'backup complete\n'
