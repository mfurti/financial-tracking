# Concept comparison and local verification

## T001 — Checkout and adoption baseline

Issue [#17](https://github.com/mfurti/financial-tracking/issues/17) uses its linked feature branch in a separate checkout created from `main` at `c06e7cc`. Planning commit `80c4745` adds only feature documents. The prior deployment checkout is the source of the reviewed local corrections. Its deployment commits and pending acceptance edit remain in that checkout.

The adoption allowlist covers the modified and new files under `apps/web/app/` and `tests/e2e/` only. Their base files match the corresponding application and test files on `main`. Paths and baseline hashes are recorded locally so subsequent scoped commits can be compared with the original correction pass. The earlier 21 browser passes and synthetic comparison are baseline evidence; candidate verification remains a separate step.

## Baseline visual comparison

The review compares the final integrated HTML with a locally built application and disposable PostgreSQL data. Width × height: 1440 × 1000, 768 × 1024 and 390 × 844. Use the local `.local/concept-parity/index.html` viewer for the paired captures. The comparison uses dark appearance as in the owner’s marks. Application and concept fixture values differ.

The final run passed 15 Chromium cases across the three widths and six desktop/mobile regression cases. These include navigation fit, stationary tile highlight, the theme reveal and reduced-motion fallback, calendar scope, confirmed wealth records, and keyboard dialog dismissal with focus return. The local production build, Vue/root type checks and lint of the affected source passed. No public production data was captured.

| Comments               | Revised surface and check                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 19                  | Overview month control has previous/month/next. Secondary controls are separate.                                                                                    |
| 2, 20                  | Overview preview requests at most five booked records and uses one compact secondary line.                                                                          |
| 3, 13                  | Expenses and negative trend use the negative token; major labels and numeric signs still carry meaning.                                                             |
| 4                      | Theme reveal uses a pointer-origin polygon over 1700 ms. Reduced motion changes the palette immediately.                                                            |
| 5, 6, 27               | The standalone notification icon was removed; the profile launches account management with a notifications entry.                                                   |
| 7, 8, 9, 21, 22        | Transactions have a compact primary filter, month navigation, date-grouped rows and right-aligned signed amounts. Advanced filters and inline edits stay available. |
| 10, 23                 | Account cards have shorter copy and a type filter. Keep the observed total and unknown state distinct from simulated holdings.                                      |
| 11, 30                 | Wealth is available directly in the bottom navigation.                                                                                                              |
| 12, 14, 15, 24, 25, 26 | Restored the analytics hierarchy, Wealth/Distribution pair, real mini bars and rings, and in-place detail dialogs.                                                  |
| 16, 17, 29             | Contracts show three plan cards; calendar opens in place with non-monthly and all-contract modes.                                                                   |
| 18, 31                 | More is grouped into My Money and Manage.                                                                                                                           |
| 28                     | Account groups open in place. Selected group applies to monthly totals and bookings using the existing group scope.                                                 |

## Differences retained for review

- The production app uses its existing palette and type system. Navigation controls, account status and balance provenance retain production semantics. A concept demo balance is never substituted for a missing observed balance.
- The existing model records outgoing contracts. Income and remainder previews explicitly show unavailable states. The concept’s income-contract workflow would need a product and model change.
- Full tables, chart preferences, date/account filters, real category edits and focused drill-down routes remain available alongside the shorter landing surfaces. These can still make the application more dense than the concept.
- Acceptance of these differences is still open. The work is local and has not been deployed.
