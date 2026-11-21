# Direct concept comparison

1. Open each final HTML export in Chromium and record the relevant marked view/state at 1440×1000 (PC), 768×1024 (tablet) and 390×844 (phone).
2. Run the existing isolated browser stack with synthetic data using `pnpm test:e2e`. Reuse the concept-coverage fixtures and capture equivalent app states at the same widths and appearance. Preserve auth isolation; never capture production records.
3. Compare overview, transactions, accounts, analytics, contracts, and More side by side. Open all relevant dialogs and exercise next/previous month, five-booking cap, hover/focus, and theme animation with normal and reduced motion.
4. Record each browser comment as verified or outstanding. Verify title/label contrast and missing/error/loading state before treating a synthetic visual difference as resolved.
