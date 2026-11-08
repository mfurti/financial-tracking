# Codeprüfung vor dem UI-Ausbau

Stand: 8. November 2026, Quellstand `bab8ddc` einschließlich unverändertem Anwendungscode aus `d193639`. Aufgabe: [Issue #3](https://github.com/mfurti/financial-tracking/issues/3). Auftrag ist zunächst Prüfung und Dokumentation. Keine Produktdatei, Abhängigkeit oder Migration wurde entfernt/geändert; dieser Bericht ist ein Befundprotokoll, kein zusätzlicher Umsetzungsplan.

## Ergebnis

Alle 19 eigenen Vue-Komponenten haben Verweise im Anwendungscode. Keine ganze Komponente und keine direkte Abhängigkeit konnte als sicher entfernbar nachgewiesen werden. Konkrete Aufräumkandidaten sind 16 nicht referenzierte CSS-Klassen und ein überholter Dialogpfad. Kleine UI-Metadaten werden mehrfach gepflegt. Die Bereinigung wird als K1 in [todo.md](todo.md) geführt; R1 bleibt die eigentliche Gestaltung, ohne doppelte Redesign-Aufgabe.

## K1.1 — CSS-Reste ohne Quellverwendung

| Frühere Darstellung         | Klassen                                                            | Fundstelle vor Bereinigung                        |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Kategorienbalken            | category-bar, bar-track                                            | [main.css](../apps/web/app/assets/main.css#L350)  |
| Alter Upload/Schrittfolge   | upload-zone, quick-upload, upload-action, upload-disabled, stepper | [main.css](../apps/web/app/assets/main.css#L517)  |
| Frühere Theme-Vorschau      | appearance-preview                                                 | [main.css](../apps/web/app/assets/main.css#L668)  |
| Erklär-/Onboarding-Blöcke   | workflow-guide, guide-number                                       | [main.css](../apps/web/app/assets/main.css#L806)  |
| Frühere CSS-Donutgrafik     | spending-donut                                                     | [main.css](../apps/web/app/assets/main.css#L838)  |
| Frühere Kategoriehinweise   | category-guide, category-management-entry                          | [main.css](../apps/web/app/assets/main.css#L945)  |
| Alter mobiler Mehr-Dropdown | mobile-more, mobile-more-trigger, mobile-more-menu                 | [main.css](../apps/web/app/assets/main.css#L1160) |

Diese Namen kommen ausschließlich in main.css vor, nicht in aktuellem Anwendungsmarkup, Skripten oder Tests. Dynamische Klassenvergabe/Komponentenauflösung wurde gesondert gesucht; für diese Namen wurde kein Erzeuger gefunden. Generierte Nuxt-Dateien sind kein eigenständiger Benutzungsnachweis.

Vor Entfernen noch eine gezielte Browserprüfung durchführen. Gemischte Selektorgruppen nur aufteilen: Beispielsweise teilen mobile-more und mobile-nav > a eine Regel; workflow-guide und category-insights ebenfalls. Der weiterhin verwendete Teil muss erhalten bleiben. Keine ganze Media-Query und keine aktive Navigations-/Kategorie-Regel pauschal löschen. Die tatsächlich verwendeten ExpenseChart/ExpenseBreakdown und deren übrige spending-Klassen bleiben erhalten.

## K1.2 — Alter Vorschlagsdialogpfad

In [der Vertragsseite](../apps/web/app/pages/contracts/[[id]].vue#L115) nimmt openEditor noch einen optionalen Vorschlag an. Beide verbliebenen Aufrufe liefern keinen: „Vertrag anlegen“ ruft openEditor() auf, „Vertrag bearbeiten“ openEditor(undefined, true). Der lokale suggestion-State wird daher immer null; der zugehörige Vorschlagstitel und dessen Formularübergabe sind über diesen Seitenpfad nicht mehr erreichbar.

Der echte Vorschlagsablauf läuft über [ContractReview](../apps/web/app/components/ContractReview.vue#L267), das ContractForm weiterhin mit einem Vorschlag benötigt. Nur den alten Seitenpfad vereinfachen, nicht die gemeinsame Vorschlagsunterstützung entfernen. Abnahme: manuell anlegen/bearbeiten sowie Prüfkarten bestätigen, überspringen, ablehnen und wiederherstellen bleiben funktionsfähig.

## K1.3 — Kleine Doppelpflege, keine tote Geschäftslogik

Vertragsarten stehen in [ContractForm](../apps/web/app/components/ContractForm.vue#L17), der Vertragsseite und [contract-presentation.ts](../apps/web/app/utils/contract-presentation.ts); Rhythmusoptionen doppelt in Formular und Vertragsseite. Eine vorhandene Präsentationsdatei kann die UI-Optionen tragen. Das API pflegt zusätzlich Gruppenbezeichnungen in contract-summary.ts; dort besteht ein eigener Verbraucher, keine Codeleiche. Keine API-Abhängigkeit auf Browserdateien einführen.

Auch plannedEquivalent im Browser und die monatliche Kostenberechnung im API sind aktiv. Ein gemeinsamer Rechenkern wäre eine gesondert zu prüfende Refaktorierung; nicht als vermeintlich toten Code entfernen oder verschiedene Stichtagssemantiken zusammenlegen. Geld-/Import-/Zuordnungslogik bleibt außerhalb des kleinen Aufräumpakets.

## Bewusst behalten / Fehlalarme

- ExpenseBreakdown wird von Übersicht und Kategorien verwendet; ExpenseChart zusätzlich von Ist- und Vertragsanalyse. Keine überflüssigen alternativen Diagrammkomponenten.
- [Caddyfile](../infrastructure/proxy/Caddyfile) wird in verify-operations.sh für isolierte Linux-HTTPS-/Restore-Prüfungen verwendet. Produktion verwendet Traefik; die Testdatei ist trotzdem aktiv.
- admin.ts und export-openapi.ts werden über bootstrap.mjs geladen; bank-worker.ts über einen Worker-Pfad. Fehlende gewöhnliche Importkanten bedeuten keine toten Einstiegspunkte. CI-/Deployment-/Recovery-Skripte sind ebenfalls angeschlossen.
- @tanstack/charts wird von Nuxt UChart verwendet, @internationalized/date von den Kalenderkomponenten. prisma wird beim Containerstart für Migrationen benötigt, reflect-metadata beim API-Start und rxjs vom Antwortinterceptor. Keine dieser Abhängigkeiten auf Basis eines einfachen App-Importzählers löschen.
- Exportierte Hilfsfunktionen/Typen sind teilweise intern oder von Tests verwendet. Gemeinsame Zod-Schemas referenzieren einander. Die reine Abwesenheit eines Imports aus einer anderen Datei belegt keine überflüssige Implementierung.
- Ein zusätzlicher direkter vue-tsc-Aufruf mit noUnusedLocals/noUnusedParameters meldet sieben validation-Variablen. Alle sind tatsächlich über ref="validation" an UForm gebunden; nicht löschen. Der direkte Aufruf meldete zusätzlich eine fehlende optionale Vue-Router-Pluginauflösung. Er ist kein bestandener Nuxt-Prüflauf und kein Entfernungsbeleg. Der reguläre Nuxt-Typecheck bestand anschließend.
- Wiederholte CSS-Selektoren unter unterschiedlichen Breakpoints und die Theme-Fallbackvariablen sind nicht automatisch tot. Eine pauschale Stylesheet-Neuordnung würde den kleinen Aufräumumfang überschreiten.

## Prüfungen und Grenzen

- 189 versionierte Dateien inventarisiert; Quell-/Konfigurationssuche, Komponenten-/Klassenverweise sowie dynamische Einstiegspunkte und relevante Peer-/Betriebsabhängigkeiten geprüft. Suchskripte und Rohbefunde bleiben lokal unter .local.
- API: TypeScript mit noEmit/noUnusedLocals/noUnusedParameters erfolgreich.
- Web: reguläres pnpm --filter web typecheck erfolgreich. Der zusätzliche direkte Unused-Diagnoselauf war nicht erfolgreich und ist oben eingeordnet; keine Typprüfungsregel wurde geändert.
- Keine neue Browser-, Datenbank-, vollständige Unit-, Build- oder Containerprüfung. Keine Produktionsabfrage und kein Bankzugriff. Eine Laufzeit-/Abdeckungsanalyse sämtlicher Zustände wurde nicht behauptet.
- Dieser Befund belegt Aufräumkandidaten, nicht die Fehlerfreiheit oder vollständige Entbehrlichkeit beliebiger anderer Codepfade. K1 ist noch offen; gezielte Prüfungen nach einer späteren Bereinigung bleiben erforderlich.
