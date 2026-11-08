# Finanzfluss feature acceptance

> **Current status, 2026-11-08:** PR #11 is merged and separately approved deployment `d193639` is complete. [status.md](status.md) is the current delivery/acceptance record; [todo.md](todo.md) is the only active checklist. Dated evidence below remains historical. Technical delivery does not imply full product acceptance; R1–R3 remain incomplete.

## Source delivery

| Package | Commit                                | Evidence                                                                                                         |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F0      | 8f423da                               | Approved plan/task record; preserved audit 392d988                                                               |
| F1      | 2328a7d                               | Shared Nuxt UI controls, date/month inputs, existing desktop/mobile journeys                                     |
| F2      | dee4bc8                               | 23 theme cards; six Ayu variants; contrast/bootstrap/browser persistence                                         |
| F3      | 2e174b9                               | Literal rules/templates; protected manual category clearing; classification; additive upgrade and merge proof    |
| F4      | bd1df09                               | Confirmed contracts, anchored/versioned recurrence, unique actual links, unlink/delete/merge preservation        |
| F5      | d31e748                               | Exact multi-month reports, disclosed averages/trends, Nuxt UI charts, matching drill-down and focused navigation |
| F6      | 8e9333a / 94dc12c / 4ebf409 / 0320fd0 | Final proof, Linux viewport correction, 115 tests, 20 browser cases and encrypted restore; PR #10                |

## Current verification

- 115 unit/integration tests passed, including real disposable PostgreSQL and real guarded HTTP responses. All 20 real desktop/mobile/empty-account browser scenarios passed in the final complete run. Linux [CI 42479998163](https://github.com/mfurti/financial-tracking/actions/runs/42479998163) passed on code revision 0320fd0, including all 20 browser cases and extended encrypted restore.
- Format/lint/strict type checks, Prisma validation and production API/web builds passed. New API patch regression protects omitted rule priority/direction/active values from creation defaults. Minimum signed BIGINT expenses are not suggested as unrepresentable positive BIGINT forecasts.
- Desktop analysis screenshot visually inspected; source and exact totals are synthetic. The 360/768/1024/1440 light/dark screenshot matrix passed; desktop/light and mobile/dark synthetic views were visually inspected. Local artifacts remain ignored under .local.
- Linux CI passed actual container builds, image-only start, readiness/proxy denial, encrypted backup and isolated restore. Local Windows checks are recorded separately.
- The extended restore fixture preserves manual provenance/classification, automatic rule attribution, a confirmed contract/revision/payment link and actual analytics, without adding bank transactions.

## Delivery boundaries

Two additive migrations require a coordinated writer pause and matching images. See feature-migrations.md. Do not use old/new mixed writers for new attribution semantics. Production execution requires a new concrete rollout approval, published immutable GitHub images and fresh encrypted backup with isolated restore verification.

The source task did not itself deploy. The subsequent separately approved PR #10 rollout completed at `3b990ec`; PR #11 is now deployed at `d193639`. No reboot, real-bank access or budget implementation occurred. Real Sparkasse compatibility still needs the application's own FinTS product registration, confirmed endpoint and user-assisted test. Everyday acceptance of the user's actual CSV remains external. A selected-month forecast total across all contracts is separate future planning work (P1); next-due sorting and per-contract payment history are delivered. Consistent field-level errors remain R2 rather than fully accepted F1/N1.

## Review and release

[PR #10](https://github.com/mfurti/financial-tracking/pull/10) was merged after current green CI; its merge commit preserves audit 392d988 and the package commits. Its separately approved rollout completed. PR #11 also completed merge, publication and its separately approved rollout. Current evidence is in [status.md](status.md); future changes retain their own merge/rollout gates. Historical passing checks do not close the remaining product corrections or user acceptance.
