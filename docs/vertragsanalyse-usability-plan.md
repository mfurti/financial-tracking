# Contract analytics, import rollback and clearer UI

Approved implementation plan, 2026-11-08. Existing checkout, issue #3, branch `codex/3-contracts-import-usability`. Preserve audit `392d988`. Current verified production is `3b990ec`; this task does not authorize another merge, rollout, bank access or reboot.

## Ordered delivery

Each package has its own verified commit; update this record and the checklist after completion.

- [x] UX0: save this plan, synchronize todo/issue and record the completed PR #10 rollout.
- [x] UX1: atomic CSV rollback with impact preview, stale-preview protection and selectable treatment of links.
- [x] UX2: fixed desktop management links, mobile More page, shared section headings, colors/icons and less visible text.
- [x] UX3: rounded monthly contract equivalents and category/kind analytics behind a clickable fixed-cost card.
- [ ] UX4: editable suggestion review cards, navigation-only swipes and durable decisions.
- [ ] UX5: complete documentation, visual/browser/API/migration checks and one feature PR; obtain concrete merge approval.

## CSV rollback

Completed CSV runs expose “Import rückgängig machen”; uncommitted previews retain cancellation. Preview counts deletable/shared/uncertain transactions, manual edits and contract/transfer links. Default keeps linked transactions; an explicit alternative removes their links and import-owned transactions with a second consent. Never delete contracts or the opposite transfer transaction; unlink remaining transfer members consistently. Shared-source and uncertain-origin transactions are protected under either option.

Delete exclusively owned transactions and their identities, the run and its staging/issues. Preserve needed account aliases and foreign source evidence. Reupload recreates deleted transactions while retained records still deduplicate. This is not historical restoration of changes made to retained transactions; explain that limitation in the dialog.

Record creating import on newly created transactions. Infer legacy ownership only from unambiguous direct import identities and compatible creation timestamps; otherwise preserve. Account assignment/merging must preserve ownership/evidence. Preview and execution share one computation and a fingerprint token; changed data requires refreshed confirmation. Execute under existing locks and a serializable transaction, without partial deletion.

## Navigation, formatting and copy

Desktop management links are always visible on the left. Mobile keeps five destinations; More opens a dedicated page with large Nuxt UI links. Shared section headings sit above cards and are stronger than table headers. Contract text is left aligned; amounts/dates right aligned, tabular figures, responsive to long names and 360px screens.

Use income/expense/warning/muted semantic colors and contract-kind icons, always with text or symbols rather than color alone. Respect all themes, focus and reduced motion. No unpaid-warning inference from a merely unlinked occurrence.

Reduce permanent explanatory text throughout overview, transactions, analytics, contracts, imports and settings. Remove repeated introductions and implementation details. Use short titles/actions and compact metrics. Move useful explanations into labelled keyboard/mobile-accessible UPopover help buttons. Keep “Planwert”, “Ohne Kategorie”, average denominator, errors, deletion consequences and required decisions visible. Empty states have one short explanation and an action. No global explanation setting.

## Contract monthly cost analysis

The contracts page links “Durchschnittliche Fixkosten / Monat” to `/contracts/analysis`; show contract count and “Planwert”. Include confirmed contracts started by today and not ended before today, using the revision effective today. Exclude future starts/revisions and suggestions. Divide exact BIGINT cents by interval 1/3/6/12, rounding half up per contract; sum those same displayed cents into groups/total. Never add forecasts to actual expense metrics.

Analysis toggles category/kind, shows monthly total, a Nuxt UI chart and accessible exact-value list, descending groups and matching contract drill-down with rhythm/detail links. Use explicit contract categories, with “Ohne Kategorie” fallback; never infer silently from payments.

## Suggestion review

“Vorschläge prüfen · N” opens one editable card at a time using existing ContractForm and Nuxt UCarousel, no autoplay. Show provider/amount/rhythm/category, expandable evidence, progress and completion. “Bestätigen & weiter” saves atomically then advances; “Später” skips only this session; “Kein Vertrag” persists dismissal. Swipes/arrows only navigate. Prompt before discarding dirty edits; inputs cannot initiate dragging. Background refresh must not replace active edits.

Persist decisions by normalized provider/account/amount/interval signature. Further payments do not resurrect the same dismissal; changed patterns may reappear. Support listing/restoring currently relevant dismissed proposals. Confirm proposal and contract atomically; removing a contract clears its acceptance decision. Full keyboard support and failure/retry states.

## Shared contracts and persistence

All transport schemas remain in `packages/contracts/src/index.ts`, shared by runtime, OpenAPI and browser. Monetary transport remains decimal cent strings. Additive migrations only.

- `GET /imports/{id}/rollback-preview`: impacts, protection reasons, links and token.
- `POST /imports/{id}/rollback`: token, explicit confirmation and linked-record policy; deleted/retained counts.
- `GET /contracts/summary`: as-of date, per-contract monthly cents, total and category/kind groups.
- `GET /contracts/suggestions?dismissed=true`: relevant dismissed proposals.
- `PUT /contracts/suggestions/{key}/decision`: persist rejection.
- `DELETE /contracts/suggestions/{key}/decision`: restore proposal.
- Optional source suggestion key on contract creation, validated and persisted atomically.

## Verification and delivery

Test real PostgreSQL upgrade/preservation, rollback/reupload accountless/account-bound, shared/legacy/manual/link cases, stale previews and concurrency. Verify all rhythms/rounding/start/end/future changes/group totals; review persistence/dirty forms/keyboard/swipes/errors. Check 360/768/1024/1440px, light/dark/themes/large values/long names/reduced motion and accessible help. Run full format/lint/types/unit/integration/build/browser plus current Linux image-only/encrypted restore CI. Keep detailed evidence, task commits and remaining external acceptance separate.

One feature PR. Merge and production rollout each require concrete approval. A rollout uses published immutable images, fresh encrypted backup/restore and controlled write pause. No automatic production import removal.
