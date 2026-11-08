# Contract analytics, import rollback and clearer UI

> **Current status, 2026-11-08:** PR #11 is merged and separately approved deployment `d193639` is complete. [status.md](status.md) is the current delivery/acceptance record; [todo.md](todo.md) is the only active checklist. Dated evidence below remains historical. Technical delivery does not imply full product acceptance; R1–R3 remain incomplete.

Approved implementation plan, 2026-11-08. Existing checkout, issue #3, branch `codex/3-contracts-import-usability`. Preserve audit `392d988`. The implementation baseline was `3b990ec`. PR #11 was subsequently merged and separately approved deployment `d193639` completed. No new merge, rollout, bank access or reboot is authorized by this documentation update.

## Ordered delivery

Latest reference decision: the user's new feedback makes **Finanzguru the first design reference again**. Earlier Finanzfluss-inspired analytical behavior remains valid; it is no longer the overriding visual reference. The documentation-only addition below does not authorize implementation or production changes.

Each package has its own verified commit; update this record and the checklist after completion.

- [x] UX0: save this plan, synchronize todo/issue and record the completed PR #10 rollout.
- [x] UX1: atomic CSV rollback with impact preview, stale-preview protection and selectable treatment of links.
- [ ] UX2: navigation, colors and icons delivered; section headings and text reduction remain only partially complete. Finish R1 in todo.md.
- [x] UX3: rounded monthly contract equivalents and category/kind analytics behind a clickable fixed-cost card.
- [ ] UX4: editable review cards, navigation-only swipes and durable decisions delivered; meaningful inline payment evidence remains R3 in todo.md.
- [x] UX5 technical delivery: PR #11 merged, current main CI passed and separately approved rollout completed. This does not close R1/R3 or user acceptance E5/E6.

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

## Nutzerfeedback: App-Charakter und Import — 8. November 2026

Auftrag: Rückmeldungen in diesen vorhandenen Plan einarbeiten, Dopplungen prüfen und mit dem aktuellen Quell-/Lieferstand abgleichen. Keine Produktimplementierung. Grundlage: acht Nutzerkommentare, Habit-Tracker-Kopf und Importfehler-Screenshot. Finanzguru hat visuell Priorität; Nuxt UI und die Architektur bleiben gesetzt. „Vollwertige App“ beschreibt hier Bedienung, Dichte und Hierarchie, keinen zusätzlich beauftragten nativen Client, Offline-Modus oder PWA-Ausbau.

### Abgleich und Zuordnung ohne doppelte Aufgaben

| Feedback                                    | Aktueller Stand / Beleg                                                                                              | Zuordnung                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Kommentar 1: Monatskästen unpassend         | MonthPicker funktioniert; Monatskopf weiterhin normale Toolbar mit separatem Aktualisieren-Button.                   | R1 erweitern; keine zweite Monatswahl-Aufgabe.                             |
| Kommentar 2: Fragezeichen                   | HelpPopover rendert wörtlich „?“, zunächst kein belegter Icon-Ladefehler. Hilfen auch separat innerhalb von Karten.  | R1: gezielte, einheitliche kontextbezogene Hilfe.                          |
| Kommentar 3: letzte Buchungen zu groß       | Zeilen/Karten benötigen viel Höhe; Nutzer hat die Wirkung nicht abgenommen.                                          | R1: kompaktere Zeilen, weniger Wiederholungen/Leerraum.                    |
| Kommentar 4: Überschriften ohne Mehrwert    | Layout mit workspace-label, Seiten zusätzlich H1 und teils gleichnamige Reiter.                                      | R1: klare Hierarchie statt gleicher Titel mehrfach.                        |
| Kommentar 5: Monatskopf wie Habit Tracker   | Vorbild mit links/rechts, mittiger Periode und Heute-Aktion; Finanz-App bislang MonthPicker/Toolbar.                 | R1: Monatsnavigation nach demselben Muster.                                |
| Kommentar 6: Einstellungen ohne Überschrift | Benutzer-/App-Informationen als section.panel mit dl ohne Abschnittstitel.                                           | Bereits R1/UX2; konkretisieren statt duplizieren.                          |
| Kommentar 7: Helligkeit unpassend           | Separates Formularfeld „Helligkeit“ mit Select neben Theme-Kacheln und Kreisbutton.                                  | R1: kompakte Hell/Dunkel/System-Wahl, Speicherung/Theme-Paarung erhalten.  |
| Kommentar 8: Umsatzfilter wie Büroformular  | Umfangreiche Filter dauerhaft als mehrspaltiges Formular mit Anwenden-Button.                                        | R1: kompakte Suche, weitere Filter bei Bedarf, aktive Auswahl sichtbar.    |
| Allgemein: mehr App, weniger Text           | Vorhandene Nuxt-UI-Umstellung/Tests belegen Funktion, nicht gewünschte Gestaltung; Kopf/Fuß/Erklärblöcke zu präsent. | R1 bleibt ausdrücklich offen trotz gelieferter Navigation/Themes.          |
| Dateiauswahl nicht intuitiv                 | UFileUpload mit „CSV-Datei auswählen“ vorhanden; automatische Verarbeitung löst Auffindbarkeit nicht.                | Neu I2, vorhandene Upload-Automatik nicht erneut als fehlend führen.       |
| Fehlender Buchungstext                      | Textspalten-Mechanismus synthetisch nachvollzogen, echte Zeileninhalte unbekannt.                                    | Neu I3; von optionalem Soll/Haben C1 und Originaldatei-Abnahme E5 trennen. |

### Interaktion und Abnahme für R1

- Kompakter Monatskopf: Zurück, Monatsname/Jahr, Vorwärts und „Dieser Monat“. Direkter Monatssprung bleibt erreichbar. Jahreswechsel, Browser-Zurück/Vorwärts und month-URL-Parameter bleiben konsistent; Neuladen startet keinen Bankabruf.
- Bilanz, Einnahmen/Ausgaben, Verteilung und letzte Buchungen benötigen weniger Fläche. Keine großen leeren Zustandskarten oder verschachtelten Kästen nur für Erklärungen; kurze Leerzustände mit passender Aktion.
- Buchungszeilen primär Gegenpartei/Text, rechts Betrag; sekundär nur nötige Informationen. Lange Texte begrenzen, Details erreichbar halten. Auswahl, Vertragsbadge und Zuordnungen bleiben bedienbar.
- Eine aussagekräftige Seitenüberschrift statt wiederholter gleichnamiger Kopfzeile. Vorhandene Hauptnavigation erhalten, keine parallele Navigation einführen.
- Hilfen mit konsistentem Nuxt-UI-Symbol/Trigger dort, wo fachlich nötig. Keine unbeschrifteten/dekorativen Fragezeichen; Tastatur/Touch erhalten. Fehler, Löschfolgen und Einwilligungen sichtbar lassen.
- Umsätze mit kompakter Suche und sichtbaren aktiven Filtern. Weitere Filter in passender Nuxt-UI-Ansicht; Datum/Konto/Kategorie/Status/Richtung/Fix-Variabel und Mehrfachaktionen erhalten. Anwenden/Zurücksetzen vor Umsetzung im Detail festlegen.
- Einstellungen: Abschnittstitel für Benutzer-/App-Informationen, kompakte Moduswahl. Systempräferenz, Theme-Kacheln, sechs Ayu-Varianten, Kreisbutton, frühe Wiederherstellung und reduzierte Bewegung erhalten.
- Übersicht, Umsätze, Analysen, Einstellungen und passende Vertrags-/Importansichten bei 360/768/1024/1440 Pixeln prüfen; zusätzlich kommentierte 734/879/1166 bei 884 Pixel Höhe. Pointer-Ziele, Fokus, Lesbarkeit und horizontale Überläufe prüfen. Synthetische visuelle Prüfung und Nutzerabnahme getrennt halten.

### Importbefund und Grenzen für I2/I3

Codebefund: suggestCsvMapping in apps/web/app/utils/csv-file.ts bevorzugt Verwendungszweck gegenüber Buchungstext. Das gemeinsame Mapping besitzt nur ein description-Feld. previewCsv in apps/api/src/csv.ts verwirft ein leeres Feld dieser Spalte ohne Prüfung einer Alternative. imports/csv.vue wiederholt denselben Fehlertext je Zeile in einem großen UAlert.

Synthetisch wird eine Zeile mit gültigem Datum/Betrag, leerem Verwendungszweck und gefülltem Buchungstext als CSV_INVALID_ROW zurückgewiesen. Der Mechanismus ist reproduziert; für die Originaldatei bleiben andere Ursachen wie vollständig leere Texte möglich. Keine weiteren realen Buchungszeilen eingesehen, keine Annahme über deren Inhalt. E5 bleibt offen.

Für spätere Korrektur Fallback-Reihenfolge und ausdrückliche manuelle Spaltenwahl trennen. Nötige Änderungen gemeinsam in Zod/API/Browser führen. Quellidentitäten, wiederholte Dateien, Zusammenführungen und manuelle Anmerkungen schützen. Buchungen nicht allein wegen ungünstiger automatischer Textwahl verwerfen; wirklich ungültige Zeilen weder erfinden noch still auslassen.

### Umfang und nächste Schritte

Prio 1: R1, I2 und I3. R2/R3, Budgets, Monatsplanung und externe Bank-/Betriebsabnahmen bleiben offen. Bestehende UX2-/R1-Anforderungen werden erweitert; keine zusätzliche parallele UI-Roadmap angelegt. Diese Ergänzung sammelt Anforderungen und Ist-Befunde. Konkrete technische Planung/Implementierung und spätere Merge-/Rollout-Freigaben folgen separat.
