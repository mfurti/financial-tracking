# Contract usability acceptance

> **Current status, 2026-11-08:** PR #11 is merged and separately approved deployment `d193639` is complete. [status.md](status.md) is the current delivery/acceptance record; [todo.md](todo.md) is the only active checklist. Dated evidence below remains historical. Technical delivery does not imply full product acceptance; R1–R3 remain incomplete.

## Candidate and scope

Implementation baseline: `3b990ecaba356c0bfe85a79bb87915c41eac0967`. Approved plan: [contract usability](https://github.com/mfurti/financial-tracking/blob/740f2103a068c9401d9c1e194b3986a12983eeae/docs/vertragsanalyse-usability-plan.md), issue #3, former branch `codex/3-contracts-import-usability`. Audit `392d988` remains in ancestry. PR #11 was subsequently merged and separately approved rollout `d193639` completed. This record distinguishes that technical delivery from incomplete R1/R3 details and outstanding user acceptance.

| Package | Source commit / result                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| UX0     | `342e06e`: plan, issue and current production delivery recorded.                                                   |
| UX1     | `564d86d`: previewed CSV rollback, provenance/link protection and reupload.                                        |
| UX2     | `3310721`: permanent management links, mobile More page, external headings, compact accessible help, colors/icons. |
| UX3     | `f62d67d`: exact per-contract monthly costs and category/kind drill-down.                                          |
| UX4     | `b843a85`: editable Nuxt review cards, dirty-edit guards and durable decisions.                                    |
| UX5     | Final documentation/regressions and Linux restore fixture; current CI evidence is tracked in issue #3.             |

## Local evidence

- Complete unit/integration run: 130 tests in 24 files passed. After adding the >100-row preview boundary case, all eight rollback tests passed, including the unchanged preceding cases. The candidate therefore contains 131 cases; full current-candidate Linux execution remains a separate gate.
- Real PostgreSQL tests cover immediate-previous-schema ownership backfill, exact large BIGINT preservation, shared/unknown provenance, both contract/transfer policies, stale snapshots, concurrent confirmations, a concurrent repeated import and deletion beyond the bounded preview list.
- HTTP tests exercise actual cookie authentication, Origin/CSRF on POST/PUT/DELETE, invalid queries/keys, shared output serialization, hash-key OpenAPI, atomic invalid confirmation and safe idempotent confirmation retry.
- Monthly planning tests cover all four rhythms, per-row half-up rounding, exact group/total equality, inclusive terms, today's price versus future revisions, future starts, zero-rounded values and totals above an individual BIGINT ceiling.
- Full browser suite: all 20 desktop/mobile scenarios passed. Journeys exercise upload/rollback/reupload, cancellation, duplicate decisions, manual rule protection, both analytics groupings, real carousel drag, skip/reopen, dirty-close/card navigation, persistent dismissal/restore and loss of an already committed contract-confirmation response followed by safe retry.
- Existing appearance/accessibility tests cover all 23 tiles/six Ayu variants, early restoration, light/dark, reduced motion, keyboard/focus, 360/768/1024/1440 widths and existing bank-dialog fixtures. No real bank is contacted.
- Format, lint, strict workspace/test types, Prisma validation, production build and Bash syntax passed. The final targeted dialog check also keeps its title/footer visible for long forms and removes modal animation under reduced motion.
- Synthetic analytics, contract analysis and mobile review screenshots were inspected. Useful descriptions are available through labelled help popovers; important monetary meaning, errors and destructive consequences remain visible. No user financial screenshots were captured.

## Linux and migration delivery gates

Full Linux source acceptance passed at 2f93e95 in run 42497875724: 131 tests across 24 files, all 20 browser scenarios and image-only encrypted backup/restore, including the new provenance/decision checks. This is actual container execution, distinct from the Windows checks. The final documentation head and merged main subsequently passed current CI; main run 42499226320 completed verification, operations and publication.

The operations fixture now seeds creating-import ownership and both confirmed/dismissed decisions, verifies those after encrypted restore, and checks authenticated rollback preview/monthly summary on the restored runtime images. Actual Docker execution is performed by Linux CI, not claimed on this Windows workstation. CI failure artifacts include the new synthetic contract analysis/review screenshots.

Two additive migrations are reviewed in [feature-migrations.md](feature-migrations.md). They do not delete financial data on deployment. Rollback deletes actual import-owned rows only after a user's preview and explicit confirmation. Existing consumers can read expanded fields, but mixed-version writes do not maintain all ownership/decision semantics; use a controlled write pause. Do not drop columns or promise historical financial restoration as application rollback.

[PR #11](https://github.com/mfurti/financial-tracking/pull/11) is merged as `d193639`. Its separately approved rollout used published immutable GitHub images, a fresh encrypted populated backup/isolated restore and a controlled migration pause; all original fields/rows across 17 application tables were preserved. See [status.md](status.md) for delivery evidence. No server repository, reboot or real bank test occurred. UX2 headings/text reduction and UX4 payment evidence remain R1/R3; full user acceptance remains E5/E6. Budgets and the selected-month all-contract forecast remain separate backlog. Future merges and rollouts require new concrete approvals.
