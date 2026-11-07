#!/usr/bin/env bash
set -euo pipefail
test "$#" -eq 1 && test -d "$1"
# Preserve the seven preceding full UTC calendar days plus today, including manual snapshots.
cutoff="$(date -u -d '7 days ago 00:00:00' +%s)"
while IFS= read -r -d '' archive; do
  name="${archive##*/}"
  if [[ "$name" =~ ^ledger-[0-9]{8}T[0-9]{6}-[0-9]+\.dump\.age$ ]]; then
    rm -- "$archive"
  fi
done < <(find "$1" -maxdepth 1 -type f -name 'ledger-*.dump.age' ! -newermt "@$((cutoff - 1))" -print0)
