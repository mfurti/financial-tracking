# Observed Production Baseline

**Observed**: 2026-11-21 during approved read-only G1 preparation.
**Target**: rocky, /root/docker/financial-tracking; project household-ledger; Docker 29.9.3.
**Result**: T003 inventory complete. Production was read only; no container, writer state, secret, archive or schema was changed.

## Actual running images

All application services report full OCI revision d193639762a543e9283b62a604804ab5245f30dd, matching the last documented delivery.

| Service    | State             | Pinned image                                                                                                     |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| API        | running / healthy | ghcr.io/mfurti/financial-tracking-api@sha256:155dd14ab5045f7fa9bb6575338d2ad80bd6796e49d50c74c27d7459bc5dea8f    |
| Web        | running / healthy | ghcr.io/mfurti/financial-tracking-web@sha256:b6012a146f767a262346b13a7cbd755474107d011c0501bfcad62da62053688d    |
| Backup     | running / healthy | ghcr.io/mfurti/financial-tracking-backup@sha256:07d197cbdfefba47472c104dad310f63ba02bc5cae9fa02e47ba063bf64172dc |
| PostgreSQL | running / healthy | postgres:17-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994                     |

Actual deployed Compose SHA-256 equals the candidate bundle Compose SHA-256: a7ee4db162bc6a09ceb1b80458118931465433faf95678676f55bb6f591228fb. The topology does not require replacement or a new address.

## Schema and persistence

Six recorded migrations completed successfully, none rolled back: 202611060001_initial, 202611070001_accountless_csv, 202611080001_category_rules, 202611080002_contracts, 202611080003_import_rollback and 202611080004_suggestion_decisions.

Compared with the candidate migration directory, the pending set is exactly:

1. 202611180001_reserve_wealth
2. 202611180002_workspace_settings

There are 18 existing application tables, plus the separately handled migration ledger. Sanitized inventory confirms a populated installation: 505 transaction rows and 1010 transaction identities; account count is zero, so accountless history must remain intact. Table/column inventory was captured without exporting private row contents. The complete preservation comparator must cover all 18 tables, not only nine.

PostgreSQL mounts the existing household-ledger_postgres_data volume. Backup output uses /srv/household-ledger/backups. API, PostgreSQL and other services have no host port bindings.

## Networks, access and capacity

- FRITZBOX exists as macvlan on 192.168.178.0/24, gateway 192.168.178.1; the running web container owns 192.168.178.33.
- traefik-public exists as the shared bridge; the application also uses household-ledger_private. These networks remain external/preserved.
- The router's DHCP reservation was not independently read. This upgrade retains the existing live web address and byte-identical Compose topology; it allocates no new address. Reconfirm ownership/no conflict at the actual execution preflight and resolve any drift before G2 execution.
- Existing runtime .env, compose.yaml and secret-reference files are readable with mode 0600. Only access/modes and secret paths were inspected, never secret values.
- Existing host credentials successfully read all three candidate GHCR manifests/configs. Their minimal privilege is not proven; E3 remains open. No image pull or credential change was performed.
- Runtime and backup filesystem had 394634812 KiB available (18% used) at inspection. Recheck before rehearsal/execution.

## Existing encrypted recovery input

Latest completed archive observed: ledger-20261121T032703-10930.dump.age, 133837 bytes, SHA-256 e24d4c5deac27a0df413b114a568b899a9e72e506bd35372b2f552f6dd0152fd. It already existed before G1 inventory; no target backup was generated.

Older completed encrypted archives were present for the preceding days. A readable archive/healthy backup service is not a completed restore proof. T006 must restore and compare the selected actual archive; T010 later creates/verifies the final quiescent checkpoint only after G2. Private configuration recovery and identity availability are still to be proven in protected recovery work.
