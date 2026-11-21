# Direct concept comparison

1. Open each final HTML export in Chromium and record the relevant marked view/state at 1440×1000 (PC), 768×1024 (tablet) and 390×844 (phone).
2. Run the existing isolated browser stack with synthetic data using `pnpm test:e2e`. Reuse the concept-coverage fixtures and capture equivalent app states at the same widths and appearance. Preserve auth isolation; never capture production records.
3. Compare overview, transactions, accounts, analytics, contracts, and More side by side. Open all relevant dialogs and exercise next/previous month, five-booking cap, hover/focus, and theme animation with normal and reduced motion.
4. Record each browser comment as verified or outstanding. Verify title/label contrast and missing/error/loading state before treating a synthetic visual difference as resolved.

## Candidate checks

Run the three concept projects with `pnpm test:e2e concept-parity.spec.ts --project=concept-390 --project=concept-768 --project=concept-1440`. The comparison test defaults to dark appearance. Set `FEATURE_PARITY_SCHEME=light` in the child process and rerun it for the light captures. Run `account-groups.spec.ts` on the same projects to verify populated, empty, and cleared group scope through the dashboard, analytics and calendar. Keep the runtime fixtures disposable and the screenshots outside Git.
