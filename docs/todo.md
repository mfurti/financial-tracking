# Aktuelle Aufgaben

Stand: 8. November 2026. [Projektstand und Nachweise](status.md). Aufgabe: [Issue #3](https://github.com/mfurti/financial-tracking/issues/3). Letzter belegter Produktivstand: `d193639` aus PR #11. Merge/Rollout abgeschlossen; Benutzerabnahme offen.

Diese Liste ersetzt widersprüchliche parallele Checklisten. Historische Erledigungen und damalige offene Punkte bleiben im [Archiv](archive/todo-2026-11-08-before-audit.md). Ein offener Punkt ist keine automatische Implementierungs- oder Rollout-Freigabe.

## R — Restarbeiten aus dem beauftragten UI-Ausbau

- [ ] **R1 — Gestaltung und Textreduktion vervollständigen.** Abschnittsüberschriften oberhalb der Karten vereinheitlichen, insbesondere Importklärung und Bankverwaltung. Wiederholte Vertrags-/Bedienerklärungen in beschriftete Hilfe-Popover verschieben. Kennzahlen, Planwert, Fehler, Entscheidungen und Löschfolgen sichtbar lassen. Abnahme: Übersicht, Umsätze, Analysen, Verträge, Importe, Konten, Bankverwaltung und Einstellungen bei 360/768/1024/1440 Pixeln, hell/dunkel, Tastatur und reduzierter Bewegung. Ursprung: UX2; nur teilweise erfüllt.
- [ ] **R2 — Formularfehler durchgängig am Feld anzeigen.** Insbesondere zukünftige Vertragsänderungen und manuelle Zahlungszuordnung mit benannten Feldern, gemeinsamer Validierung und Feldfehler-Anbindung versehen. Ursache/nächsten Schritt knapp erklären, Eingaben erhalten. Abnahme: ungültige Beträge/Termine und Serverkonflikte zeigen passende Felder und Fokus, ohne gespeicherte Daten zu verändern. Ursprung: F1/N1 und P1.3; bisher zu pauschal als fertig geführt.
- [ ] **R3 — Belegzahlungen in Vertrags-Prüfkarten verständlich zeigen.** Identische „Buchung ansehen“-Links durch kompakte Belege mit Datum, Betrag und Gegenpartei/Buchungstext ergänzen. Details bleiben verlinkt/aufklappbar. Bearbeitete Karte, Entscheidungen und reine Navigations-Wischgesten erhalten. Abnahme: Vorschläge anhand ihrer Zahlungen vergleichen können, ohne mehrere ununterscheidbare Links öffnen zu müssen. Ursprung: UX4; Kartenfolge und Entscheidungen bereits geliefert.

Für R1–R3 gelten Nuxt UI, gemeinsame Zod-Verträge, Cent-Genauigkeit und Datenerhalt. Je Umsetzungspaket passende Prüfungen und eigener Commit; konkrete Merge-/Rollout-Freigaben bleiben erforderlich.

## I — Erkannte Produktgrenze

- [ ] **I1 — Alte Importe und Klärungen erreichbar machen.** Historie aktuell auf 100 Läufe ohne Nachladen begrenzt. Begrenzten, nachladbaren Zugriff einschließlich alter Klärungen und berechtigter CSV-Rücknahme planen. Abnahme: bei mehr als 100 Läufen einen älteren Lauf finden, Hinweise und Rücknahmevorschau öffnen. Neue Erweiterung über die bisher dokumentierte Begrenzung hinaus; vor Umsetzung einplanen.

## P — Noch nicht gelieferte Vertragsplanung

- [ ] **P1 — Tatsächlich fällige Monatsgesamtsumme.** Vertragsfälligkeiten eines gewählten Monats summieren und Termine zeigen. Jährliche 120 € zählen im Fälligkeitsmonat als 120 €, getrennt vom vorhandenen Monatsdurchschnitt von 10 €. Monatsende, Schaltjahr, zukünftige Preise und einschließlich geltendes Ende beachten. Keine Bankbuchungen erzeugen/Ist-Werte verändern. Abnahme: exakte Gesamtsumme und Drill-down über verschiedene Rhythmen/Monatswechsel. Ursprung: P3.2 und Finanzfluss-Plan; später eigenständig zurückgestellt, nicht umgesetzt. Umfang/Freigabe vor Umsetzung bestätigen.

## B — Budgets: eigener, nicht zur Umsetzung freigegebener Rückstand

Abhängigkeit: gemeinsame Stage-1-Abnahme und gesonderte Budgetfreigabe. Verträge wurden unabhängig davon beauftragt und geliefert; keine erneute Budget-Voraussetzung für Vertragskorrekturen erfinden.

- [ ] **B1 — Modell und API.** Monatsbudget je Ausgabenkategorie, eindeutiger DB-Schlüssel, exakte Centbeträge, Zod/OpenAPI, Anlegen/Bearbeiten/Löschen.
- [ ] **B2 — Vormonat ausdrücklich übernehmen.** Keine automatische Übertragung; Zielbudgets nicht still überschreiben. Konflikte sichtbar entscheiden.
- [ ] **B3 — Verbrauch und Erstattungen.** Nur gebuchte Ausgaben einschließlich kontoloser Buchungen, ohne Vormerkungen/Umbuchungen. Verbrauch = `max(0, Ausgaben - ausdrücklich zugeordnete Erstattungen)`. Gewöhnliche Einnahmen nicht automatisch als Erstattung behandeln. Rest/Überschreitung exakt berechnen.
- [ ] **B4 — Oberfläche und Nachberechnung.** Monatswahl, Budget/Verbrauch/Rest/Überschreitung, beide Modi, Feldfehler und Leerzustände. Spätere Kategorie-/Buchungsänderungen berücksichtigen.
- [ ] **B5 — Prüfung und separate Abnahme.** Migration auf befülltem Altstand, Cent-Grenzen, Monats-/Jahreswechsel, Übernahme-Konflikte, Erstattungen über Ausgaben und Buchungszustände prüfen. Technische Lieferung und gemeinsame Budgetabnahme getrennt dokumentieren.

## C/A — Ältere Detailanforderungen, Umfang vor Umsetzung klären

Diese Punkte stammen aus der ursprünglichen Spezifikation. Sie fehlen im Code, waren aber keine vollständige Zusage der letzten UX-Lieferung. Optionale Funktionen nicht als bereits beauftragte Pflichtkorrektur behandeln.

- [ ] **C1 — Separate Soll-/Haben-Spalten.** Optionales CSV-Mapping mit eindeutigen Vorzeichen-/Leerwertregeln planen. Aktuell nur eine vorzeichenbehaftete Betragsspalte. Abnahme: Soll/Haben, leere Felder, widersprüchliche Doppelbelegung und erneuter Import.
- [ ] **C2 — CSV-Quellsaldo.** Optional einen ausdrücklich zuordenbaren Quellsaldo übernehmen; Konto/Typ/Beobachtungsdatum müssen eindeutig sein. Mapping bisher ohne Saldospalte. Niemals aus Umsatzsummen einen Bankkontostand erfinden.
- [ ] **C3 — Konfigurierbare Importgrenzen.** Aktuell feste 10 MiB/50.000 Zeilen. Falls weiterhin gewünscht, konsistente begrenzte Konfiguration über Browser, Verträge und API planen; vor Verarbeitung sicher begrenzen.
- [ ] **A1 — Mehrere Konten gemeinsam filtern.** Aktuell einzelnes Konto, alle Konten oder „Ohne Konto“, keine ausgewählte Kontomenge. Filtersemantik für Umsätze, Analysen und Drill-down festlegen. Abnahme: mindestens zwei ausgewählte Konten, ausgeschlossene Konten und kontolose Buchungen korrekt behandeln.

## E — Externe Voraussetzungen und Abnahmen

- [ ] **E1 — Eigene FinTS-Registrierung und offizieller Endpunkt.** Eigene Produkt-ID beantragen/erhalten; Sparkasse Bodensee bestätigt Endpunkt, Zugang und TAN-Fähigkeiten. [Anleitung](fints-registration.md). Keine fremde Produkt-ID, keine Zugangsdaten in Chat/Repository.
- [ ] **E2 — Begleiteter realer Banktest.** Nach E1 und separater Freigabe Kontenerkennung, Salden, Historie, TAN/Medien/App-Freigabe, Abbruch und wiederholten Import ohne Doppelzählung prüfen. Bankgrenzen bereinigt dokumentieren. Synthetische Tests ersetzen diesen Nachweis nicht.
- [ ] **E3 — Registry-Berechtigungen minimieren.** Bestehenden geschützten Serverzugang auf ausschließlich lesenden Paketzugriff prüfen/begrenzen. Erfolgreiche Pulls belegen keine minimale Berechtigung.
- [ ] **E4 — Host-Neustart prüfen.** Nur im separat freigegebenen Wartungsfenster. Daten, Startreihenfolge, HTTPS und anschließende Backup-Gesundheit nachweisen. Container-Neustart/CI ersetzen keinen Neustart des gemeinsam genutzten Hosts.
- [ ] **E5 — Original-CSV und Alltagsworkflow abnehmen.** Echten Export, erneuten Upload nach Rücknahme, Kategorien, Vorschläge und Auswertungen gemeinsam prüfen. Keine Finanzdaten in öffentliche Nachweise übernehmen.
- [ ] **E6 — Gemeinsame Produkt-/Stage-1-Abnahme.** Nach Korrekturen Bedienung, Textmenge, Layout, exakte Zahlen, Klärungen und Betriebs-/Bankgrenzen bewerten. Technische Lieferung ist erfolgt; keine vollständige Benutzerabnahme erklärt. Budgetbeginn benötigt zusätzliche ausdrückliche Freigabe.

## D — Dokumentationsbereinigung dieses Auftrags

- [x] **D1 — Statuskorrektur abschließen.** Pläne/Nachweise gekennzeichnet, abgeschlossene Merge-/Rollout-Gates berichtigt, Lücken mit stabilen IDs erfasst und alte To-dos vollständig archiviert. Format-/Lint-/Verweisprüfung erfolgreich; Abschluss im zugehörigen Dokumentations-Commit auf `codex/3-docs-status-audit`. Keine Produktimplementierung oder Serveränderung.

## Bereits geliefert

- CSV-Automatik, Kodierungen, Sparkasse-Kurzjahr, kontoloser Import/spätere Zuordnung, Dublettenschutz und geschützte Rücknahme.
- Kategorienvorlagen/-regeln, geschützte manuelle Entscheidungen, Fix/Variabel.
- Verträge, Zahlungsregeln/-zuordnung, Historie, rollierende Fälligkeiten, Monatsdurchschnitt und Kategorien-/Artenanalyse.
- Mehrmonats-Ist-Analysen mit Durchschnitt/Trend/Aufteilung, exakten Tabellen und Umsatzfiltern.
- Nuxt-UI-Bedienelemente, Datums-/Monatswahl, Theme-Kacheln/sechs Ayu-Varianten, Kreisbutton und überarbeitete Navigation.
- Image-only-Deployment, .33, Compose-Healthchecks, tägliche verschlüsselte Backups mit sieben Kalendertagen Aufbewahrung, befüllter Restore und zuletzt freigegebener Rollout `d193639`.

## Abschlussregeln

Erst nach Umsetzung und passenden Prüfungen abhaken; Benutzerabnahmen separat nachweisen. Historische Haken sind keine pauschale Erfüllung aller Details. Quellcode bleibt lokal. Kein Server-Repository, unbeauftragter Bankzugriff, Reboot oder neuer Merge/Rollout durch diesen Dokumentationsauftrag.
