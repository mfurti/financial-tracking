# Phase 0 research

- **Reference**: Final integrated exports and existing reference captures. Use their rendered cascade rather than early HTML scaffolding. Existing acceptance screenshots demonstrate concrete layout divergences.
- **Architecture**: Reuse Vue routes, the existing FinanceDialog and financial APIs. Avoid a prototype embed, duplicate calculations and fabricated sample data.
- **Verification**: Existing Playwright Chromium and synthetic data permit repeatable three-width comparison. Direct side-by-side inspection is needed in addition to structural tests.
- **Theme and hover**: The final HTML uses a pointer-origin polygon reveal over 1700 ms and an immediate reduced-motion fallback. Its final hover treatment brightens tile graphics without movement or shadow. Earlier prototype overrides were rejected.
- **Dialogs**: The final rendering uses centered, internally scrollable panels. At the reference sizes the calendar panel measures approximately 488, 488 and 356 px wide. Preserve Escape and focus return rather than cloning static markup.
- **Analysis**: Use up to six recent real expense bars and real category, merchant and positive observed wealth shares for rings. Use the existing report scope for drill-down; do not copy synthetic amounts.
- **Contracts**: The concept shows Expenses / month, Income / month and Projected remainder. The real contract model contains outgoing obligations only. Keep the two unsupported values explicitly unavailable; historical income and zero are not valid substitutes.
