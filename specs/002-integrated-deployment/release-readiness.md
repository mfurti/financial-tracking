# Candidate Release Readiness

**Observed**: 2026-11-21, approved G1 preparation, issue #15.
**Application candidate**: c06e7cc0d0639e4be8092473de696f4b6a3912b0 (merged PR #14).
**Result**: T002 release prerequisites passed; no production authorization/deployment claimed.

## Exact main publication

[Main run 44894725587](https://github.com/mfurti/financial-tracking/actions/runs/44894725587) completed successfully for the exact revision: verify, operations and publish passed. The publisher loaded the saved Linux-tested images, validated their full-revision OCI labels and published without rebuilding. Independent read-only GHCR image-config inspection confirmed all three labels and linux/amd64.

| Service        | Immutable reference                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| API / migrator | ghcr.io/mfurti/financial-tracking-api@sha256:dde67463d875b51f5cda93c842133c2659c4d850d8e35abae8fdeb52b455607f    |
| Web            | ghcr.io/mfurti/financial-tracking-web@sha256:ff69047161484aaea9cc4612bec5e1dec1206cb17308116a64f149255aec6234    |
| Backup         | ghcr.io/mfurti/financial-tracking-backup@sha256:0c66d58ce82166651ce1e2ebecd87871dff441bf45762773bd222137aa121272 |

The workstation credential could download the artifact but did not establish package-manifest access. The existing protected rocky registry login successfully performed read-only manifest/config inspection instead. No token was printed/copied or credential changed; no candidate image was pulled or runtime changed. Successful reads do not prove minimum privilege (existing E3 remains open).

## Bundle integrity and allowlist

- Artifact financial-tracking-deployment-c06e7cc0d0639e4be8092473de696f4b6a3912b0, ID 14704422311; nonexpired at inspection, expires 2026-12-21T10:59:56Z.
- Downloaded artifact ZIP SHA-256 dd1eae17f96de68ec19e3772487fdb253e6efbb937435ef6b36d8849f86faa9b equals GitHub metadata.
- Inner financial-tracking-c06e7cc0d0639e4be8092473de696f4b6a3912b0.tar.gz SHA-256 c708fa8f65ef880e586b333e07e452a506d6f11f2195bc131abf336a1106b409.
- Before extraction, member paths/types were checked: only the root directory and four regular files compose.yaml, .env.example, README.md and REVISION.
- REVISION matches the full candidate; .env.example has the three immutable references above. No source, Dockerfile, secret or runtime .env is packaged.
- Downloads and sanitized registry proof reside in ignored .local/releases/c06e7cc, not on the production runtime.

## Remaining gates

Actual target/pending migrations, complete protected populated recovery, actual previous-image compatibility or selected isolated restore, measured maintenance proposal and G2 approval remain separate tasks. Recheck availability/identity before execution; never substitute mutable tags or an unreviewed newer candidate.
