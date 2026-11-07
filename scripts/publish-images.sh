#!/usr/bin/env bash
set -euo pipefail
test "${GITHUB_EVENT_NAME:-}" = push
test "${GITHUB_REF:-}" = refs/heads/main
revision="${GITHUB_SHA:?Missing tested revision}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
mkdir -p .local
: > .local/published-images.env
for service in api web backup; do
  tested="ledger-verified-${service}:${revision}"
  actual="$(docker image inspect "$tested" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
  test "$actual" = "$revision"
  destination="ghcr.io/mfurti/financial-tracking-${service}:${revision}"
  docker tag "$tested" "$destination"
  docker push "$destination"
  # Loaded artifacts retain local aliases; resolve the just-pushed registry manifest itself.
  digest="$(docker buildx imagetools inspect "$destination" --format '{{json .Manifest}}' | node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(0,"utf8")).digest ?? "")')"
  [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
  reference="ghcr.io/mfurti/financial-tracking-${service}@${digest}"
  [[ "$reference" =~ ^ghcr\.io/mfurti/financial-tracking-${service}@sha256:[a-f0-9]{64}$ ]]
  printf '%s_IMAGE=%s\n' "${service^^}" "$reference" >> .local/published-images.env
done
