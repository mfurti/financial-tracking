# Aktueller Projektstand

Stand: 8. November 2026. Diese Seite und [todo.md](todo.md) sind die zentrale Statusquelle. Alte Pläne beschreiben Anforderungen und historische Entscheidungen, nicht automatisch den aktuellen Erledigungsstand. Aufgabe: [Issue #3](https://github.com/mfurti/financial-tracking/issues/3).

## Belegter Lieferstand

- PR #10 wurde als `3b990ec` gemergt und separat freigegeben ausgerollt.
- [PR #11](https://github.com/mfurti/financial-tracking/pull/11) wurde als `d193639762a543e9283b62a604804ab5245f30dd` gemergt und separat freigegeben ausgerollt. Das ist der zuletzt geprüfte Produktivstand.
- [Main-CI 42499226320](https://github.com/mfurti/financial-tracking/actions/runs/42499226320) war erfolgreich: 131 Unit-/Integrationstests, 20 Browserfälle, Linux-Container-/Restore-Prüfung und Image-Veröffentlichung.
- Frisches verschlüsseltes Backup vor dem Rollout isoliert wiederhergestellt: 10 Sekunden, tatsächlich befüllte Finanzdaten, alle ursprünglichen Felder und Datensätze aus 17 Anwendungstabellen erhalten. Wartungspause: 212 Sekunden. Beide additiven Migrationen aus PR #11 wurden angewendet.
- Vier Laufzeitdienste waren gesund; HTTPS, Zugriffsschutz, exakte Ist-Analysen, monatliche Vertragsplanwerte und lesende API-Prüfungen waren erfolgreich. Konfiguration/Secrets blieben erhalten; verschlüsselte Konfiguration zusätzlich geprüft außerhalb des Servers gesichert.
- Laufzeitverzeichnis `/root/docker/financial-tracking`, Web-IP `192.168.178.33`, nur Compose/Konfiguration/Secrets und veröffentlichte GitHub-Images. Kein Server-Repository, Server-Build, Reboot oder echter Bankzugriff.

Rolloutnachweis: [Issue #3, Kommentar 6724648706](https://github.com/mfurti/financial-tracking/issues/3#issuecomment-6724648706). Lokale Detailnachweise liegen ignoriert unter `.local/releases/d193639`. Archive und private Schlüssel gehören nicht ins Repository. Der aktuelle Dokumentationsabgleich verwendet vorhandene Nachweise und Quellcode; er behauptet keine neue Serverprobe oder Wiederholung der Anwendungstests.

## Funktionen und offene Grenzen

| Bereich    | Vorhanden                                                                                                                                          | Noch offen                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CSV        | Formaterkennung, Sparkasse-Kurzjahr, automatischer gültiger Upload, kontolose Buchungen, Dublettenklärung, spätere Zuordnung, geschützte Rücknahme | Originaldatei-/Alltagsabnahme; ältere optionale Detailanforderungen C1–C3                   |
| Kategorien | Vorlagen, Verwaltung, geordnete Regeln, manueller Vorrang einschließlich leerer Kategorie, Fix/Variabel                                            | Gemeinsame fachliche Abnahme                                                                |
| Verträge   | Vorschläge, Bestätigung, Versionierung, Zahlungszuordnung, Historie, nächste Fälligkeit, Monatsdurchschnitt und Kategorien-/Artenanalyse           | Aussagekräftige Belegvorschau R3; tatsächliche Gesamtbelastung eines ausgewählten Monats P1 |
| Analysen   | Mehrmonatswerte, Durchschnitt, Trend, Kategorienanteile, Fix/Variabel, exakte Tabellen, Umsatz-Drill-down                                          | Gemeinsame Auswahl mehrerer Konten A1                                                       |
| Oberfläche | Nuxt-UI-Bedienelemente, Datums-/Monatswahl, Desktop-Verwaltung, mobile Mehr-Seite, 23 Theme-Kacheln/sechs Ayu-Varianten                            | Überschriften/Textreduktion R1 und Feldfehler R2 nicht durchgängig                          |
| Importe    | Historie und Rücknahme sichtbarer abgeschlossener CSV-Läufe                                                                                        | Auf 100 Läufe begrenzt, kein Nachladen; ältere Klärungen regulär nicht erreichbar I1        |
| Budgets    | Nicht implementiert                                                                                                                                | Separater, bisher nicht zur Umsetzung freigegebener Rückstand B1–B5                         |
| FinTS      | Adapter, manuelle Oberfläche und synthetische Autorisierungstests                                                                                  | Eigene Registrierung, bestätigter Endpunkt und begleiteter Banktest E1–E2                   |

## Korrigierte Paketbewertung

| Paket        | Aktueller Status                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| F0           | Dokumentation geliefert; spätere Statuswidersprüche durch diesen Abgleich korrigiert.                                    |
| F1 / N1–N2   | Nuxt-UI-Umstellung und Datums-/Monatswahl geliefert; konsistente Feldfehler nur teilweise erfüllt, siehe R2.             |
| F2 / N3      | Theme-Kacheln implementiert und technisch geprüft.                                                                       |
| F3 / N5      | Kategorienregeln und Klassifizierung implementiert; keine pauschale Benutzerabnahme.                                     |
| F4 / N6      | Vertragskern implementiert. Aggregierte Monatsbelastung aus dem Plan zurückgestellt, nicht geliefert: P1.                |
| F5 / N4 / N7 | Ist-Analysen und Navigation implementiert; neuere Gestaltungskorrekturen und ältere Mehrkontenanforderung separat offen. |
| F6 / N8      | Technische Lieferung einschließlich Merge/Rollout abgeschlossen; gemeinsame Produktabnahme offen.                        |
| UX0–UX1      | Planaufzeichnung und Import-Rücknahme geliefert.                                                                         |
| UX2          | Teilweise erfüllt: Navigation/Farben/Symbole vorhanden, Überschriften/Textreduktion nicht durchgängig: R1.               |
| UX3          | Monatsdurchschnitt und Vertragsanalyse geliefert; keine tatsächlich fällige Monatsgesamtsumme.                           |
| UX4          | Kartenfolge und Entscheidungen geliefert; Belegvorschau rudimentär: R3.                                                  |
| UX5          | Technische Lieferung, aktuelle CI, Merge und Rollout abgeschlossen; Benutzerabnahme offen.                               |

## Verbindliche Einordnung

- Aufgaben mit stabilen IDs, Prüfkriterien und Abhängigkeiten stehen ausschließlich in [todo.md](todo.md).
- R1–R3 sind Restarbeiten aus beauftragten Oberflächenanforderungen. Diese Dokumentationsbereinigung implementiert sie nicht und genehmigt keinen neuen Merge/Rollout.
- Budgets, Monatsbelastungsplanung und ältere optionale CSV-/Mehrkontenanforderungen bleiben getrennt vom gelieferten Umfang. Vor Umsetzung Umfang und erforderliche Freigaben klären.
- Die spätere ausdrückliche Freigabe des Vertragsausbaus ersetzte dessen frühere Budget-Abhängigkeit. Budgets wurden dadurch weder umgesetzt noch freigegeben.
- Gemeinsame Zod-Verträge ersetzen die ursprünglich vorgesehenen class-validator-/generierten Client-Duplikate. Konto-unabhängiger automatischer CSV-Import ersetzt Pflichtkonto und routinemäßige Bestätigung bei vollständig gültigen Dateien. Die spätere Vertragsfreigabe erlaubt eindeutige automatische Zahlungszuordnung; die alte Beschränkung auf ausschließlich manuelle Zuordnung gilt nicht mehr. Diese ersetzten Anforderungen sind keine offenen Implementierungslücken.
- Grüne Tests ersetzen weder vollständige Planerfüllung noch gemeinsame fachliche/visuelle Abnahme. Historische Checklisten sind keine zweite aktuelle Aufgabenliste.

## Dokumente lesen

| Dokument                                                                                                                                                                         | Rolle                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [todo.md](todo.md)                                                                                                                                                               | Einzige aktuelle Aufgabenliste                                                    |
| [Grundplan](plan.md), [Spezifikation](haushaltsbuch-implementierungsspezifikation.md), [initiale Checkliste](initial-implementation-checklist.md)                                | Historischer Grundumfang und damalige Nachweise; geänderte Anforderungen beachten |
| [Ausbauplan](ausbauplan.md), [Stufenplan](HAUSHALTSBUCH_CODEX_PLAN.md)                                                                                                           | Stufenanforderungen; offene Budgets/Monatsplanung im aktuellen Rückstand          |
| [Finanzfluss-Plan](finanzfluss-umsetzungsplan.md), [Usability-Plan](vertragsanalyse-usability-plan.md)                                                                           | Gelieferte und teilweise erfüllte Erweiterungen; korrigierte Bewertung oben       |
| [Stage-1-Abnahme](stage-one-acceptance.md), [Finanzfluss-Abnahme](finanzfluss-abnahme.md), [Usability-Abnahme](vertragsanalyse-usability-abnahme.md), [Fortschritt](progress.md) | Datierte technische Nachweise, keine pauschale Produktabnahme                     |
| [API](api.md), [Darstellung](appearance.md), [Bankintegration](banking.md), [Registrierung](fints-registration.md), [Bedienung](user-guide.md)                                   | Funktionsreferenz; bekannte Grenzen zusätzlich in todo.md                         |
| [Deployment](deployment.md), [Migrationen](feature-migrations.md), [Recovery](recovery.md), [Coding-Guidelines](coding-guidelines.md)                                            | Betriebs-/Entwicklungsregeln                                                      |
| [Archivierte To-dos](archive/todo-2026-11-08-before-audit.md)                                                                                                                    | Historische Aufgabeninhalte mit ausdrücklich damaligem Status                     |
