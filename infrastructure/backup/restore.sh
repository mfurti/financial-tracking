#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ "${CONFIRM_RESTORE:-}" != "restore-to-empty-database" || $# -ne 2 ]]; then
  printf 'Set CONFIRM_RESTORE=restore-to-empty-database; supply encrypted archive and age identity file.\n' >&2
  exit 2
fi
archive="$1"
identity="$2"
test -f "$archive" && test -f "$identity"
export PGPASSWORD
PGPASSWORD="$(cat /run/secrets/db_password)"
tables="$(psql -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
if [[ "$tables" != "0" ]]; then printf 'Restore refused: target public schema is not empty.\n' >&2; exit 3; fi
# Validate the whole encrypted archive before restoring into the explicitly empty target.
temporary="$(mktemp)"
trap 'rm -f -- "$temporary"' EXIT
age --decrypt --identity "$identity" "$archive" > "$temporary"
pg_restore --list "$temporary" > /dev/null
pg_restore --single-transaction --exit-on-error --no-owner --no-acl --dbname "$PGDATABASE" "$temporary"
printf 'restore complete\n'
