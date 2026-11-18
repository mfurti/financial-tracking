# UI Contract and Reference Inventory

## Reference Authority

Source: `.local/design-concepts/output/html/integrated/manifest.json` and the three HTML files. Each declares 39 named views. Final rendered overrides take precedence over earlier placeholder markup. The files are ignored local input, so these fingerprints and the route inventory preserve review context. Capture reference screenshots before implementation; screenshots have not been captured during planning.

| File                      | SHA-256                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| haushaltsbuch-pc.html     | 9203eea3c7db6733646105fc31bf46db5914a7e900f766e985995b427ae4e600 |
| haushaltsbuch-tablet.html | 96f6f1bfadc31a8345b79d8bb84068f0c10d3266c61e49013ed39c6692942728 |
| haushaltsbuch-mobile.html | 32e3055680f81f21288bcaf4b2750f2ddaba225d30de01575cfd0fea436cfc2d |

## View Mapping

Paths describe intended destinations. Existing routes are retained; additions are proposed. An embedded view is acceptable when it preserves direct navigation, scope, accessible focus, and back behavior.

| Concept ID         | View                           | Application destination / behavior                                      |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------- |
| seite-03           | Übersicht                      | `/`; compact actual-month review and responsive overview                |
| seite-04           | Umsätze                        | `/transactions`; preserve filters and pagination                        |
| seite-05           | Buchungsdetails                | `/transactions/:id`                                                     |
| analysis-details   | Einnahmen und Ausgaben         | `/analytics/details`; exact scope and bookings                          |
| seite-07           | Kategorien & Regeln            | `/categories`                                                           |
| seite-08           | Verträge                       | `/contracts`                                                            |
| konten             | Konten                         | `/accounts`                                                             |
| konto-detail       | Kontodetails                   | `/accounts/:id`                                                         |
| scalable           | Vermögen                       | `/wealth`; separate observed wealth and labeled investment demo         |
| sparplaene         | Sparpläne                      | `/wealth/demo/plans`; synthetic only                                    |
| scalable-umsatz    | Scalable-Aktivität             | `/wealth/demo/activity`; synthetic only                                 |
| wertpapier         | Wertpapier                     | `/wealth/demo/securities/:id`; synthetic catalog                        |
| seite-17           | Mehr                           | `/more`                                                                 |
| verbindungen       | Bankverbindungen               | `/connections`; retain working real connectors, distinguish demo        |
| darstellung        | Darstellung                    | `/settings/appearance`; reuse existing palette compatibility            |
| seite-02           | Anmelden                       | `/login`; preserve auth and appearance bootstrap                        |
| seite-09           | Vertragsdetails                | `/contracts/:id`                                                        |
| seite-10           | Geplante Vertragskosten        | `/contracts/analysis`; explicit plan/actual distinction                 |
| seite-13           | Importhistorie                 | `/imports`                                                              |
| seite-14           | CSV importieren                | `/imports/csv`                                                          |
| seite-18           | Importfehler klären            | Existing import issue flow within `/imports`; retain selected run/issue |
| seite-19           | Mögliche Doppelbuchung         | Existing duplicate resolution within import flow                        |
| seite-20           | Import rückgängig machen       | Existing rollback preview and confirmation in `/imports`                |
| seite-21           | Buchungen einem Konto zuordnen | Existing AccountAssignment flow with explicit source/target             |
| seite-22           | Zuordnungsregel bearbeiten     | Existing CategoryRules editor within `/categories`                      |
| seite-23           | Vertrag anlegen                | Existing ContractForm in `/contracts`                                   |
| seite-24           | Vertragsvorschläge prüfen      | Existing ContractReview in `/contracts`                                 |
| seite-25           | Bankfreigabe                   | Existing authorization flow in `/connections`; no credential storage    |
| seite-26           | Eigene Umbuchung verknüpfen    | Existing transfer linking from `/transactions/:id`                      |
| seite-06           | Analysen                       | `/analytics`; six configurable modules                                  |
| einstellungen      | Einstellungen                  | `/settings`                                                             |
| theme-konfigurator | Theme-Konfigurator             | `/settings/appearance/custom`; paired tones and contrast feedback       |
| profil             | Persönliche Angaben            | `/settings/profile`; owner display profile                              |
| benachrichtigungen | Benachrichtigungen             | `/notifications`; source-linked in-app items                            |
| banken             | Banken & Konten hinzufügen     | `/accounts/add`; established account/connection forms                   |
| benutzer           | Userverwaltung                 | `/settings/users`; visibly local roles demonstration, no real accounts  |
| kontogruppen       | Kontogruppen                   | `/settings/account-groups`; memberships and deduplicated scope          |
| passwort           | Passwort ändern                | `/settings/password`; reuse `/auth/password`                            |
| vertragskalender   | Vertragskalender               | `/contracts/calendar`; existing recurrence semantics                    |

Category and merchant module selections open `/analytics/details` with a validated category ID or merchant key and the exact effective scope. New deep links must recover on reload and unauthenticated navigation must return through the existing auth middleware.

## Layout and Interaction Acceptance

The refinement in [visual-design.md](visual-design.md) defines mandatory depth, spacing, contrast, tile, and motion behavior, including reference-derived measurements, state rules, and visual acceptance evidence.

- Overview >1100 px: bookings | payments+accounts | categories. At 701–1100 px: bookings+accounts | payments+categories. At <=700 px: bookings, payments, accounts, categories. Other screens follow their own concept composition.
- Preserve compact headings, grouped rows, financial hierarchy, bounded content widths and persistent accessible navigation. Mobile access to accounts/wealth may use More if needed, but every main destination remains reachable.
- Monthly actuals use the chosen Berlin month and disclose partial periods. Completed-month modules use 3/6/12 previous complete months. Filters propagate to drill-down and return navigation.
- Six analysis modules: months, categories, merchants, recorded wealth, reserve, contracts. Chart/ring switch is supported where meaningful and tables/labels provide equivalent values.
- Loaders do not display old results under new filters. Empty states offer the relevant next action. Errors preserve drafts and provide retry. Success reflects confirmed saves, not optimistic fake completion.
- Destructive operations show affected scope before confirmation. Dialogs trap focus, support Escape where dismissible, restore focus, and have accessible names. Touch targets remain usable at 360 px.
- German/English labels, dates, currency, amount masking, reduced motion, existing themes and custom contrast validation apply across routes, tooltips, dialogs and accessible names.
- Demo order/transfer/account/category/plan actions mutate only synthetic state; financial classification/category controls use existing real services. Labels must make this distinction visible before submission.

## Review Evidence

Capture matching reference and implementation screenshots at 390, 768 and 1440 px for overview, analytics, contracts/calendar, wealth/demo and settings; inspect 360/700/701/1100/1101 px for overflow and boundary placement. Check all 39 mappings for navigation/actions, and document intentional adaptations rather than silently dropping screens. Match hierarchy, spacing, density, colors and interactions; do not fabricate pixel-diff thresholds across different financial fixtures.

## Task Ownership and Existing Backlog

The 39 named source views map to these implementation owners. Ownership is not completion; final functional and visual acceptance is T045.

| Concept ID         | Owning task |
| ------------------ | ----------- |
| seite-03           | T008/T009   |
| seite-04           | T016/T022   |
| seite-05           | T022        |
| analysis-details   | T016        |
| seite-07           | T022        |
| seite-08           | T023        |
| konten             | T019        |
| konto-detail       | T019        |
| scalable           | T028/T032   |
| sparplaene         | T033        |
| scalable-umsatz    | T033        |
| wertpapier         | T032        |
| seite-17           | T007        |
| verbindungen       | T025        |
| darstellung        | T040        |
| seite-02           | T007        |
| seite-09           | T023        |
| seite-10           | T023/T024   |
| seite-13           | T021        |
| seite-14           | T020        |
| seite-18           | T021        |
| seite-19           | T021        |
| seite-20           | T021        |
| seite-21           | T022        |
| seite-22           | T022        |
| seite-23           | T023        |
| seite-24           | T023        |
| seite-25           | T025        |
| seite-26           | T022        |
| seite-06           | T015/T017   |
| einstellungen      | T040        |
| theme-konfigurator | T041        |
| profil             | T037        |
| benachrichtigungen | T039        |
| banken             | T019        |
| benutzer           | T043        |
| kontogruppen       | T038        |
| passwort           | T040        |
| vertragskalender   | T024        |

| Existing backlog               | This feature                | Boundary                                                                                                             |
| ------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| docs/todo.md R1                | T004–T012 and story layouts | Compact financial UI; retain original 734/879/1166 px checks alongside new concept breakpoints.                      |
| docs/todo.md I2                | T020                        | Visible keyboard/touch upload; retain cancellation and duplicate protections.                                        |
| docs/todo.md I3                | T020/T021                   | Explicit known booking-text mapping fallback and compact issue groups; original-file acceptance E5 remains separate. |
| docs/todo.md R2/R3             | T022/T023                   | Preserve field-specific errors/drafts and explain contract evidence when adapting these views.                       |
| docs/todo.md P1                | T024                        | Exact due-month totals/calendar using existing recurrence rules; no generated transactions.                          |
| docs/todo.md I1                | Not silently included       | Deep import-history expansion remains separate backlog.                                                              |
| Budget/live-bank/release gates | Not included                | Preserve separate approval and external acceptance.                                                                  |
