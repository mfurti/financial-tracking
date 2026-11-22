# Quickstart: Validate the Rebuilt Ledger

Run the following after implementation from the repository root. Use the Node and pnpm versions pinned in CI with disposable PostgreSQL 17 and Chromium. Use the README and recovery guide for local setup and backup restoration. Select a disposable database for every migration and test.

## Build and Contract Checks

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter api exec prisma validate
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: pinned Querry Kit packages resolve with compatible peers, build in both apps, and are exercised through an actual route. Local results are recorded separately from remote CI. Linux/Docker operations use `bash scripts/verify-operations.sh` as in CI.

## Browser Journeys

1. Start the built API and web apps using the README and a synthetic fixture with several accounts, currencies, date boundaries, and more than one transaction page.
2. At 390 px and 1440 px open Overview, switch period and account scope, and follow an income or expense card. Verify the table shows the corresponding period and account set, including accountless entries when applicable. Change filters, follow browser back/forward, and refresh a deep link.
3. Sort and page the transaction table, edit a classification, and verify the same scope stays active. Remove the last matching row from a page and verify paging recovers. Simulate loading, no matches, and a read failure with retry.
4. Complete the primary flows in German and English and by keyboard. Enable masking, refresh, and inspect initial UI, chart labels and accessibility output for unmasked amounts. Confirm account and contract details, imports, settings, and the separate synthetic demo are reachable.
5. Verify an anonymous request cannot read table rows or counts and a failed CSRF check prevents writes. Confirm protected endpoints, runtime schemas, and documented OpenAPI contracts agree and that the existing cursor contract still works.

## Existing Data and Cleanup

1. Restore a synthetic or anonymized pre-rebuild backup into disposable PostgreSQL using the recovery guide. Capture IDs, counts, key relations, totals, and observations described in [data-model.md](data-model.md).
2. Bring up the rebuild against the restore and repeat the capture. Compare exact amounts, relationships, known/unknown coverage and representative reviewed workflows. Run applicable existing import rollback and backup verification checks.
3. Review the removed-file diff and search the remaining tree for retired paths, routes, references and configuration. Follow the active user, API, deployment, and recovery links. Confirm the test replacement or retirement reason for each removed fixture or plan.
