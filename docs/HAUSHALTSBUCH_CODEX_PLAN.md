# Haushaltsbuch – verbindlicher Umsetzungsplan für Codex

> **Geprüfter Dokumentationsstand, 2026-11-07:** PR #8/#9 sind zusätzlich gemergt und als `1e33afa` auf rocky ausgerollt; 95 Tests, 16 Browserfälle und Wiederherstellung sind belegt. Die gemeinsame Abnahme und Originaldatei-Abnahme bleiben offen. Der neue Auftrag verwendet **Finanzfluss Copilot als Hauptvorbild** und ergänzt konsequente Nuxt-UI-Bedienelemente, Analysen, Verträge und Theme-Kacheln. Fehlende Funktionen und historische Erledigungen sind in [todo.md](todo.md) getrennt; dieser Abgleich implementiert keine neuen Funktionen.
>
> **Ursprüngliche Planungsgrenze:** Beim damaligen Anlegen dieses Dokuments waren Änderungen und Serverzugriffe ausgeschlossen. P0 und Stufe 1 wurden anschließend ausdrücklich beauftragt; neue Merge-/Rollout-Aktionen benötigen weiterhin ihre jeweilige Freigabe.

## Neuer Nutzerauftrag: Finanzfluss, Nuxt UI und verständliche Auswertungen

**Nachfolgende Freigabe:** Der Nutzer hat den vollständigen Plan nach dem Planmodus ausdrücklich zur Umsetzung beauftragt. [finanzfluss-umsetzungsplan.md](finanzfluss-umsetzungsplan.md) konkretisiert den aktuellen Auftrag; F0–F6 in todo.md dokumentieren dessen tatsächlichen Fortschritt. Die folgenden Hinweise auf noch nötige Planung beschreiben den vorherigen Audit-Stand.

Der Nutzer verlangt die Prüfung der offenen Aufgaben und sagt Go zum beschriebenen Ausbau: alle Bedienelemente konsistent aus Nuxt UI; Datumswahl nach dem offiziellen InputDate-Beispiel; Theme-Kacheln wie im lokalen Habit Tracker und alle sechs Ayu-Varianten; klare Importklärung und Kategorienregeln; Analysen mit Durchschnitt, Trend und Aufteilung; echte Vertrags-/Abo-/Mietübersicht. Finanzfluss ersetzt Finanzguru als Hauptreferenz für den nächsten Ausbau. Das ist kein Auftrag zum Wechsel auf eine andere UI-Bibliothek.

Die Anforderungen N1–N8 in todo.md beschreiben den geprüften fehlenden Umfang. Für neue Auswertungssemantik, gemeinsame Zod/API-Verträge und Vertragspersistenz ist vor der Umsetzung ein detaillierter Plan im Planmodus nach coding-workflow nötig. Der bisherige Budget-Zwischenschritt ist keine Voraussetzung für den jetzt ausdrücklich gewünschten Vertragsausbau; Budgets selbst bleiben eigener Rückstand. Keine neue Serveränderung, kein Merge/Rollout, Bankzugriff oder Neustart ist allein mit diesem Dokumentationsabgleich freigegeben.

Referenzen: [Finanzfluss Budget-Analyse](https://www.finanzfluss.de/copilot/hilfe/budget/), [Nuxt UI InputDate als Datepicker](https://ui.nuxt.com/docs/components/input-date#as-a-date-picker), [Ayu-Varianten](https://github.com/ayu-theme/vscode-ayu). Lokales Kachelvorbild: `V:/GitHub/habit-tracker/web/app/pages/theme.vue` und `ThemePreview.vue`; keine Habit-Tracker-Dateien wurden verändert.

## Umgesetzte Ergänzung bis PR #8/#9: einfach hochladen, verstehen und auswerten

Der Nutzer beauftragt die Umsetzung dieser Ergänzung im bestehenden Stufe-1-Auftrag. Sie konkretisiert die bisherigen Import- und UI-Anforderungen und ersetzt die zusätzliche Bestätigung im fehlerfreien Standardimport. Stufe 2/3 bleiben gesondert freizugeben.

1. **CSV ohne Einstellungsarbeit:** Eine erkannte, vollständig gültige Datei wird nach Auswahl automatisch gelesen, zugeordnet, mit bestehendem Dublettenschutz übernommen und im richtigen Monat ausgewertet. Kein Pflichtkonto und keine routinemäßigen Spalten-/Bestätigungsschritte. Nur echte Unklarheiten, ungültige Zeilen oder mögliche Dubletten erfordern eine Entscheidung. Ungültige Zeilen werden weiterhin nur nach ausdrücklicher Zustimmung ausgelassen. Optionen bleiben als Ausnahme erreichbar.
2. **Finanzguru als Gestaltungsreferenz:** Neue visuelle Hierarchie mit großzügigen Karten, prägnanter Monatsbilanz, Einnahmen/Ausgaben, verständlicher Kategorienauswertung, Konten als ergänzender Information und kompakter mobiler Navigation. Die App erklärt auf jeder Hauptseite, was dort geschieht und welche Daten zugrunde liegen. Monatsbilanz bleibt ausdrücklich von einem bankgemeldeten Kontostand getrennt.
3. **Kreis für Hell/Dunkel:** Ein kreisrunder Button mit einem zustandsabhängigen Symbol, Tastaturbedienung und reduzierter Bewegung. Kein Schiebeschalter und keine zweite sichtbare Modusfläche.
4. **Themes in den Einstellungen:** Auswahl angepasster App-Farbwelten nach gängigen VS-Code-Themes: VS Code Modern, GitHub, One Dark Pro, Dracula, Nord, Monokai, Solarized, Catppuccin, Tokyo Night, Gruvbox, Night Owl, Material, Ayu, Rosé Pine, Cobalt2, SynthWave '84 und hoher Kontrast; zusätzlich das neue Standarddesign. Hell/Dunkel bleibt unabhängig umschaltbar. App-spezifische helle Gegenstücke werden nicht als Originalvarianten der Vorlagen ausgegeben. Auswahl lokal speichern und früh wiederherstellen; Text- und Bedienelementkontraste prüfen.
5. **Kategorien verständlich machen:** Monatliche Beträge, Buchungszahlen und nicht kategorisierte Buchungen zeigen. Erklären, wie eine Kategorie die Auswertung verändert und wie sie einer Buchung zugewiesen wird. Bearbeitung/Anlegen/Löschen klar als Verwaltung kennzeichnen. Unbekannte Kategorien bleiben ehrlich als nicht kategorisiert sichtbar.
6. **Offene Punkte aufräumen:** Gemergte und ausgerollte Schritte nachprüfbar abhaken. Originaldatei-Abnahme, echte Bankregistrierung/-prüfung, minimale Paketberechtigungen, separat freizugebender Neustart und gemeinsame Stufe-1-Abnahme als reale offene Punkte erhalten. Keine Budgets oder Vertragsverwaltung allein aufgrund der Designreferenz einführen.

Arbeitspakete, konkrete Dateien und Prüfungen: Abschnitt „Aktuelle Erlebnis-Überarbeitung“ in [ausbauplan.md](ausbauplan.md); Status in [todo.md](todo.md).

## 0. Unveränderliche Vorgaben

1. Das bestehende Monorepo mit **Nuxt UI, NestJS, PostgreSQL und gemeinsamer Zod-Library** weiterverwenden. Keine Neuimplementierung ohne belegten Grund.
2. Entwicklung ausschließlich lokal; GitHub Actions prüft und baut API-, Web- und Backup-Images. `rocky` zieht fertige Images aus privater GHCR.
3. Unter `/root/docker/financial-tracking` auf `rocky` liegen nur `compose.yaml`, `.env` und notwendige Secrets/Konfigurationen. **Kein Repository, keine Dockerfiles, keine Builds auf dem Server.** Persistente Daten/Volumes bleiben erhalten.
4. Vorhandene lokale Änderungen, uncommittete Arbeit, To-dos und Fortschrittsdokumentation erhalten und integrieren; nicht blind überschreiben, zurücksetzen oder löschen.
5. **Nach Stufe 1 gemeinsam prüfen und ausdrückliche Nutzerfreigabe einholen. Stufe 2 niemals automatisch beginnen.** Ebenso Stufe 3 erst nach gesonderter Abnahme/Freigabe von Stufe 2.
6. Keine Erfolgsmeldung ohne tatsächliche Prüfresultate. Offene Aufgaben, Blocker und notwendige Nutzeraktionen benennen.
7. Keine Geheimnisse, PINs, TANs, Bankdaten oder Registry-Tokens in Git, Logs oder Dokumentationsbeispielen veröffentlichen.
8. Bestehende Format-, Lint-, Typ-, Vertrags-, Datenbank-, Browser- und Containerprüfungen bleiben verbindlich.

## 1. Arbeitsmodus für Codex

### 1.1 Startprotokoll (P0)

- [ ] `git status`, Branch, lokale Commits, unversionierte Dateien und vorhandene Änderungen erfassen. **Kein `git reset --hard`, `git clean` oder ungefragtes Stashing.**
- [ ] Repository-Struktur, Paketmanager, Scripts, Dockerfiles, Compose-Dateien, GitHub-Workflows, Migrationen, Tests und Architektur lesen.
- [ ] Bestehende To-do-, Plan-, Roadmap- und Fortschrittsdateien suchen und mit diesem Plan konsolidieren. Vorhandene Dokumente nicht durch eine zweite widersprüchliche Wahrheit ersetzen.
- [ ] Vorhandene Funktionen in `fertig und geprüft`, `teilweise`, `fehlend`, `blockiert` einteilen; keine pauschale Neuentwicklung.
- [ ] Baseline-Tests ausführen, soweit lokal möglich, und bestehende Fehler getrennt von neuen Regressionen protokollieren.
- [ ] Tatsächliche Pfade, Befehle, Umgebungsvariablen und betroffene Komponenten bestimmen; hier genannte Vorschläge nicht ungeprüft als Repository-Fakten behandeln.
- [ ] Aufgabenliste mit ID, Status, Abhängigkeit, betroffenen Dateien, Testnachweis, Commit und offenen Entscheidungen aktualisieren.

**P0-Ergebnis:** Ist-Analyse und priorisierte, dateibezogene To-do-Liste. Vor Codeänderungen etwaige Konflikte und migrationskritische Entscheidungen benennen.

### 1.2 Vorgehen pro Arbeitspaket

1. Bestehende Implementierung und lokale Änderungen untersuchen.
2. Kleinste sichere, konsistente Änderung an Datenmodell, Zod-Verträgen, API, UI und Tests planen.
3. Implementieren, ohne unbeteiligte Änderungen zu überschreiben.
4. Relevante Format-, Lint-, Typ-, Vertrags-, Unit-, Integrations-, Datenbank-, Browser- und Containerprüfungen tatsächlich ausführen.
5. Tests mit Befehl, Ergebnis und ggf. Fehlergrund dokumentieren. Nicht ausgeführte Tests ausdrücklich als solche markieren.
6. Dokumentation und Aufgabenstatus synchronisieren.
7. Einen oder mehrere nachvollziehbare Commits erstellen, sofern vom Nutzer für die Umsetzung autorisiert; fremde lokale Änderungen nicht versehentlich mitcommitten.
8. Kurz berichten: geändert, geprüft, noch offen, Nutzeraktion erforderlich, Commit-ID.

**Definition of Done:** Anforderungen erfüllt, Regressionen geprüft, Datenbestand geschützt, Tests nachweislich erfolgreich, Dokumentation aktualisiert, Commit nachvollziehbar. Ein Blocker bleibt offen statt als erledigt markiert zu werden.

## 2. Stufe 1 – Haushaltsbuch zuverlässig fertigstellen

### P1.1 – CI, Images und Produktionsbetrieb

**Ziel:** Reproduzierbarer Betrieb ausschließlich aus geprüften, digest-fixierten Registry-Images.

#### CI / Registry

- [ ] GitHub Actions: Format, Lint, Typen, gemeinsame Zod-Verträge, Datenbank-/Integrationstests, relevante Browserprüfungen und Container-Builds verketten.
- [ ] API-, Web- und Backup-Images erst nach erfolgreichen Pflichtprüfungen veröffentlichen; Release-Berechtigungen und Workflow-Trigger absichern.
- [ ] Images mit vollständigem Commit-SHA taggen, OCI-Metadaten setzen, Digests im Release-/Deployment-Nachweis dokumentieren.
- [ ] Produktions-Compose referenziert feste `sha256`-Digests; Commit-Tags allein sind nicht unveränderlich.
- [ ] Private GHCR-Pakete als Standard. `rocky` erhält nur lesenden Paket-/Registry-Zugang; Credentials geschützt in Docker-Credential-Konfiguration, nicht in Git oder Compose-Klartext. Rotation und Widerruf dokumentieren.
- [ ] Optional Signaturen/Provenance ergänzen, sofern mit bestehender CI sinnvoll integrierbar.

#### Compose / Startreihenfolge

- [ ] Eigenständige Produktions-`compose.yaml` **ohne `build:` und Repository-Mounts** bereitstellen.
- [ ] Dienste: PostgreSQL, einmaliger Migrator, API, Web, Backup. Migrator verwendet **denselben API-Image-Digest** mit Migrationskommando.
- [ ] DB-Healthcheck; Migrator startet nach gesunder DB; API startet nur nach erfolgreich abgeschlossenem Migrator (`service_completed_successfully`). Fehlerhafte Migration verhindert API-Start.
- [ ] Compose-Healthchecks ausdrücklich für PostgreSQL, API **inklusive DB-Bereitschaft**, Web und Alter der letzten erfolgreich abgeschlossenen Sicherung definieren.
- [ ] Bestehendes PostgreSQL-Volume und Secrets erhalten. Nur notwendige Daten-/Secret-/Konfigurationsmounts.
- [ ] Keine LAN-IP und keine Host-Portfreigabe für API oder DB. API und DB nur über erforderliche interne Netze erreichbar.
- [ ] Neustart, fehlende Secrets, nicht erreichbare Registry und Migrationsfehler testen.

#### Netz / Traefik

- [ ] Vor Umsetzung andere Compose-Projekte, DHCP-Bereich, Reservierungen, Netzkonfiguration und IP-Konflikte **erneut** prüfen.
- [ ] Bestehendes externes Macvlan `FRITZBOX` mit `192.168.178.0/24`, Gateway `192.168.178.1`, Parent `eno1` berücksichtigen; keine unkontrollierte Neuerstellung.
- [ ] Webcontainer erhält **`192.168.178.33`** und zusätzlich Anbindung an `traefik-public` sowie eigenes Backend-Netz.
- [ ] Zugriff über **`haushaltsbuch.mfurti.de`** mit vorhandenen Traefik-Zertifikaten und LAN-Beschränkung erhalten. Traefik-Netz und Service-Port eindeutig konfigurieren.
- [ ] Prüfen, ob die direkte Macvlan-IP die Traefik-LAN-Beschränkung umgehen könnte; nötigenfalls separat absichern.

#### Backup / Aufräumen

- [ ] Aufbewahrung mindestens **sieben Kalendertage**; nicht lediglich sieben Dateien. Manuelle Zusatzbackups dürfen automatische Tagessicherungen nicht verdrängen.
- [ ] Backup-Healthcheck an Abschlusszeit der letzten erfolgreichen Sicherung binden; fehlgeschlagene oder alte Sicherungen erkennen.
- [ ] Verschlüsselung, Speicherort, Secret-Schutz, Sicherungsintegrität und isolierten Restore dokumentieren und prüfen.
- [ ] Bisherigen Server-Quellcode und obsolete Pfadregeln **erst nach erfolgreicher Umstellung und Prüfung** entfernen.

**P1.1-Abnahme:** CI veröffentlicht ausschließlich geprüfte Images; Digests fest; Compose ohne Builds/Repo; Startreihenfolge, Netze, Zugriff, Backups und Healthchecks nachweislich geprüft.

### P1.2 – CSV vollständig ohne Konto oder Bankanbindung

**Ziel:** CSV ohne vorhandene Konten importieren, kategorisieren, auswerten und später zuordnen; Überschneidungen sicher behandeln.

#### Modell und Identitäten

- [ ] Buchungen mit tatsächlich optionaler Konto-Referenz modellieren; bestehende Konto-Zuordnungen unverändert erhalten.
- [ ] Alle Queries und Reports auf implizite `INNER JOIN`-Annahmen prüfen; kontolose Buchungen dürfen nicht verschwinden.
- [ ] Importlauf, Quelltyp, expliziten **nicht leeren** Identitätsbereich und Quellidentität modellieren. Nullable Konto-IDs dürfen Unique-Constraints nicht aushebeln.
- [ ] Identitäten kontoloser Dateien zunächst importbezogen halten. Wiederholte/überlappende Dateien lösen gegebenenfalls Vergleich aus; identische Referenzen aus verschiedenen Quellen nicht blind zusammenführen.
- [ ] Eine logische Buchung kann mehrere nachvollziehbare Quellidentitäten erhalten, wenn CSV und FinTS zusammengeführt wurden. Exakte Tabellenstruktur anhand des Bestands bestimmen.
- [ ] Migrationen und Constraints mit vorhandenen Buchungen und Konten testen; keine Datenverluste.

#### Upload / Prüfung / Bestätigung

- [ ] CSV direkt hochladen, Spalten zuordnen, Vorschau mit Datums-/Betrags-/Textvalidierung anzeigen und bestätigen – **auch bei leerer Kontenliste**.
- [ ] Fehlerhafte Zeilen und Teilimporte explizit behandeln; Import nicht unbemerkt teilweise als vollständig melden.
- [ ] Kontolose Umsätze unter **„Ohne Konto“** anzeigen; kategorisierbar; sofort in Gesamt- und Monatsauswertungen berücksichtigen.
- [ ] Kontofilter berücksichtigen ausschließlich zugeordnete Umsätze. „Ohne Konto“ als eigene Filteroption.
- [ ] Spätere Kontozuordnung für einzelne und mehrere Buchungen anbieten; Kategorie und Umbuchungsmarkierung erhalten.

#### Dubletten und atomare Zusammenführung

- [ ] Identische Quellidentität von **fachlich ähnlicher Buchung** unterscheiden; Ähnlichkeit ist nur ein Vorschlag.
- [ ] Mögliche CSV-/CSV- und CSV-/FinTS-Überschneidungen mit Datum, Betrag, Text, Referenz, Quelle, Konto, Kategorie und Status vergleichbar anzeigen.
- [ ] Pro Treffer vier Entscheidungen: **Bankdaten übernehmen**, **CSV-Daten übernehmen**, **separat behalten**, **Zuordnung überspringen**.
- [ ] Kategorien und Umbuchungsmarkierungen standardmäßig bewahren; Konflikte vor Bestätigung anzeigen und ausdrücklich auflösen.
- [ ] Zusammenführung und Quellidentitäts-Verknüpfung **atomar in einer Datenbanktransaktion**; keine doppelte Zählung.
- [ ] Wiederholte Bestätigungen idempotent behandeln; parallele Änderungen/Konflikte erkennen.
- [ ] Nach späterer Kontozuordnung erneut relevante Überschneidungen prüfen.

#### Verträge und Tests

- [ ] Gemeinsame Zod-Schemas, NestJS-API, OpenAPI, Importlogik und Auswertungen zusammen aktualisieren.
- [ ] Tests: leere Kontenliste, kontoloser Upload, spätere Einzel-/Mehrfachzuordnung, alle vier Entscheidungen, wiederholte Dateien, Quellen mit gleicher Referenz, Teilimport, parallele Bestätigung, Monats- und Gesamtsummen.

**P1.2-Abnahme:** CSV funktioniert ohne Bank/Konto vollständig; kontolose Buchungen zählen korrekt; Zuordnung und Vergleichsentscheidungen sind sicher und nachvollziehbar.

### P1.3 – Oberfläche vollständig überarbeiten

**Ziel:** Ruhiges, konsistentes, responsives Finanzlayout mit korrekten Zuständen und zugänglicher Bedienung.

- [ ] Informationsarchitektur für Dashboard, Umsätze, Importe, Konten, Bankabruf, Einstellungen konsolidieren; Budget/Fixkosten noch nicht aktivieren.
- [ ] Konsistente Nuxt-UI-Komponenten, semantische Theme-Tokens, lesbare Tabellen, klare Navigation und verständliche Formulare verwenden.
- [ ] Dashboard: Monatswahl inklusive Jahreswechsel, Einnahmen, Ausgaben, Differenz, Kategorien, offene Importprüfungen; kontolose Daten sichtbar kennzeichnen.
- [ ] Einheitliche fachliche Regeln für gebucht/vorgemerkt/Umbuchung in allen Auswertungen verwenden.
- [ ] Umsatzliste: Zeitraum-, Kategorie-, Konto-, Status- und Textfilter; Mehrfachaktionen; mobil Karten/Listen statt überbreiter Tabellen.
- [ ] Dark-/Light-Schalter **auch auf Loginseite**. Beim ersten Besuch Systemeinstellung, ausdrückliche Auswahl lokal speichern und nach Reload erhalten; Theme-Flackern vermeiden.
- [ ] Eigene Farben auf gemeinsame Theme-Variablen umstellen; Kontrast und Fokus prüfen.
- [ ] Strukturierte API-Fehler mit Feldpfaden bis zu Formularfeldern durchreichen; IBAN normalisieren und Format/Prüfziffer konsistent validieren.
- [ ] Lade-, Leer-, Fehler-, Teilimport- und abgelaufene-Sitzung-Zustände vollständig behandeln.
- [ ] Tastaturbedienung, Dialog-Fokusführung, Fehlermeldungen und mobile Interaktion testen.

**P1.3-Abnahme:** Kernabläufe auf Desktop/Mobil und in beiden Themes browsergeprüft; Formfehler verständlich und korrekt zugeordnet.

### P1.4 – Manuelle FinTS-Live-Abfrage

**Ziel:** Bestehenden Adapter sicher vervollständigen; CSV bleibt unabhängig davon nutzbar.

- [ ] Vorhandenen FinTS-Adapter und manuellen Abruf prüfen; Kontenerkennung, Salden, Buchungen, Status, Abbruch und bankseitige Referenzen vervollständigen.
- [ ] TAN-Verfahrenswahl, App-Freigabe, wartende Zustände, Timeout und Neustart behandeln.
- [ ] Bei entsprechendem Schritt gemeinsam eigene FinTS-Produkt-ID registrieren und offiziellen Sparkassen-Endpunkt sowie geeigneten Zugang klären: https://www.fints.org/de/hersteller/produktregistrierung
- [ ] **Keine fremde Produkt-ID** verwenden.
- [ ] PIN/TAN ausschließlich im Speicher während eines **manuell gestarteten** Abrufs halten; keine Speicherung, keine automatische Wiederholung bei falscher PIN, keine sensiblen Logs.
- [ ] Fehlende Bankkonfiguration konkret im UI erklären; CSV jederzeit ohne FinTS nutzbar halten.
- [ ] FinTS-Buchungen mit P1.2-Quellidentitäten und Überschneidungsprüfung verbinden.
- [ ] Adapterzustände mit simulierten Antworten testen: Erfolg, falsche PIN, TAN-Auswahl, Freigabe, Timeout, Abbruch, Neustart.
- [ ] Echten Abruf **nur separat und mit ausdrücklicher Nutzerbeteiligung** testen; nur bereinigte Ergebnisse dokumentieren.
- [ ] Ohne erfüllte Bankvoraussetzungen Live-Echttest ausdrücklich als **offen/blockiert** kennzeichnen, nicht als bestanden.

**P1.4-Abnahme:** Technische Tests erfolgreich; reale Bankabnahme nur bei tatsächlich erfolgreichem Echttest.

### P1.5 – Tests, Wiederherstellung und Produktionsumstellung

#### Vollständige Prüfmatrix

- [ ] Login, Sitzungsablauf, Login-Begrenzung, strukturierte Feldfehler, IBAN.
- [ ] Jahres-/Monatswechsel, vorgemerkt/gebucht, Umbuchungen, Kategorien.
- [ ] Kontoloser CSV-Import, spätere Zuordnung, Teilimport, Überschneidungen, alle vier Zusammenführungsentscheidungen, korrekte Monatsbeträge.
- [ ] FinTS-TAN/Freigabe, Timeout, Abbruch, Neustart und fehlende Konfiguration.
- [ ] Beide Themes, Login-Theme, Tastatur/Fokus, Mobilansicht.
- [ ] Healthchecks, Registry-Pull, Migration, Neustart und Backup-Alter.

#### Betriebsbundle / Restore

- [ ] Versioniertes, herunterladbares Betriebsbundle mit Compose, Konfigurationsvorlagen und Anleitung erstellen; **keine echten Secrets im Bundle**.
- [ ] Neuinstallation ausschließlich aus Bundle und heruntergeladenen Registry-Images testen; kein Repository, keine Dockerfiles, keine Server-Builds.
- [ ] **Befülltes Backup isoliert** wiederherstellen; Login, Buchungen, Kategorien, Berichte und Summen prüfen. Niemals Restore über laufende Produktionsdatenbank testen.
- [ ] Wiederherstellungsdauer und benötigte Image-/Schema-Versionen dokumentieren.

#### Produktivumstellung

- [ ] Vorab Netzwerk/IP-Konflikte, Volumes, Secrets, Digests und freien Speicher erneut prüfen.
- [ ] Wartungsfenster vereinbaren; schreibende Zugriffe kontrolliert stoppen.
- [ ] Verschlüsseltes, konsistentes Backup vor Migration erzeugen und prüfen.
- [ ] Bundle bereitstellen, Digests pullen, einmalige Migration ausführen, API/Web starten, Healthchecks und fachliche Smoke-Tests prüfen.
- [ ] Alten Server-Quellcode und obsolete Pfadregeln erst nach erfolgreichem Betrieb entfernen.
- [ ] Rollback nur auf altes Image, wenn Schema kompatibel; sonst geprüfter Restore mit passendem alten Softwarestand. Keine automatische Rückmigration versprechen.

#### Verbindliche Freigabeschranke

- [ ] **Gemeinsame Prüfung nach Deployment**: Bedienbarkeit, Zahlen, Importentscheidungen, Themes/Mobil, Backup-Status, Live-Status.
- [ ] Offene Bankvoraussetzungen, nicht durchgeführte Tests und andere Einschränkungen ausdrücklich im Abnahmeprotokoll aufführen.
- [ ] **Codex muss hier stoppen und die ausdrückliche Nutzerfreigabe für Stufe 2 abwarten.** Keine Budgetmigration, Budget-UI oder sonstige Arbeiten aus Stufe 2 vorher beginnen.

**P1.5-Abnahme:** Tatsächliche Prüfresultate und Nutzerentscheidung dokumentiert. Eine technisch offene FinTS-Bankvoraussetzung bleibt sichtbar offen und darf nicht als erfolgreiche Live-Abnahme ausgegeben werden.

## 3. Stufe 2 – Budgetplanung (nur nach Freigabe von Stufe 1)

### P2.1 Modell / Verträge

- [ ] Monatsbudget pro Ausgabenkategorie (Jahr, Monat, Kategorie, Betrag/Währung) anlegen, bearbeiten, löschen und ausdrücklich aus Vormonat übernehmen.
- [ ] Eindeutigkeit je Kategorie/Monat per DB-Constraint; bestehende Zielbudgets bei Übernahme nicht stillschweigend überschreiben.
- [ ] Gemeinsame Zod-Verträge, NestJS-Endpunkte, OpenAPI und Berechtigungstests ergänzen.
- [ ] Beträge centgenau speichern/rechnen (Integer-Cents oder exakte Dezimalarithmetik, keine binären Floats).

### P2.2 Verbrauchsregeln

- [ ] Nur **gebuchte** Ausgaben berücksichtigen, einschließlich „Ohne Konto“; Umbuchungen und vorgemerkte Buchungen ausschließen.
- [ ] Verbrauch = `max(0, Kategorieausgaben - eindeutig zugeordnete Erstattungen)`.
- [ ] Restbetrag = `Budget - Verbrauch`; negativer Rest zeigt Überschreitung.
- [ ] Keine automatische Budgetübertragung; Vormonatsübernahme nur nach Nutzeraktion.
- [ ] Nachträgliche Buchungs-/Kategorienänderungen korrekt nachführen; gewöhnliche Einnahmen nicht pauschal als Erstattung behandeln.

### P2.3 UI / Abnahme

- [ ] Monatswahl, Budgets je Kategorie, Verbrauch, Rest, Überschreitung und Vormonatsübernahme implementieren.
- [ ] Leere Zustände, Mobilansicht, beide Themes und Formularfehler abdecken.
- [ ] Tests für Centbeträge, Monats-/Jahreswechsel, Erstattungen über Ausgaben, kontolose Umsätze, vorgemerkt/gebucht, Umbuchungen, nachträgliche Kategorieänderung und Übernahme-Konflikte.
- [ ] **Eigenständige gemeinsame Abnahme; Codex stoppt vor Stufe 3 und wartet auf ausdrückliche Freigabe.**

## 4. Stufe 3 – Fixkostenplanung (nur nach Freigabe von Stufe 2)

### P3.1 Modell / Fälligkeiten

- [ ] Wiederkehrende Ausgabe mit Bezeichnung, Betrag, Kategorie, Beginn, optionalem Ende und Intervall **monatlich/quartalsweise/jährlich** verwalten.
- [ ] Planpositionen separat von echten Buchungen speichern; **keine automatischen Ist-Buchungen** erzeugen.
- [ ] Fälligkeiten deterministisch vom ursprünglichen Startdatum ableiten. Fehlt der Ankertag im Zielmonat, letzten Kalendertag verwenden; im nächsten passenden Monat wieder ursprünglichen Tag verwenden.
- [ ] Enddatum-Semantik eindeutig definieren und testen.

### P3.2 Auswertungen / Zuordnung

- [ ] Nächste Fälligkeiten und **tatsächlich geplante Monatsbelastung** aus den im Monat fälligen Planpositionen berechnen.
- [ ] **Monatsdurchschnitt separat** anzeigen: monatlich `B`, quartalsweise `B/3`, jährlich `B/12`; erst für Darstellung runden.
- [ ] Planpositionen dürfen Ist-Auswertungen und Budgets nicht verändern.
- [ ] Echte Buchungen nur nach ausdrücklicher Aktion zu einer konkreten Fälligkeit zuordnen; doppelte Zuordnung verhindern.
- [ ] Für die erste Version eindeutige 1:1-Zuordnung vorsehen, soweit Bestand/Anforderungen nichts anderes erfordern; Teilzahlungen/Sammelabbuchungen als separate Entscheidung behandeln.

### P3.3 UI / Tests / Abnahme

- [ ] Fixkostenliste, Formulare, nächste Fälligkeiten, Monatsbelastung, Durchschnitt und zugeordnete Ist-Buchungen darstellen.
- [ ] Tests für 28./29./30./31. des Monats, Schaltjahre, Quartals-/Jahreswechsel, Laufzeitende, nachträgliche Änderungen und doppelte Zuordnung.
- [ ] Abschließende fachliche und technische Abnahme dokumentieren.

## 5. Querschnittliche Architektur- und Qualitätsregeln

- Gemeinsame Zod-Library ist Vertragsschnittstelle zwischen UI und API; Änderungen an Schemas, Endpunkten, OpenAPI, Tests und UI zusammenführen.
- Fachliche Summenregeln zentral definieren und in Dashboard, Umsatzlisten, Budgets und Berichten konsistent anwenden.
- Migrationen versionieren und produktiv angewendete Migrationen nicht nachträglich umschreiben.
- Finanzbeträge exakt berechnen; Zeitzonen, Buchungsdatum, Monatsgrenzen und vorgemerkt/gebucht explizit testen.
- Sicherheitsrelevante Fehler ohne Preisgabe von Secrets protokollieren; Session- und Login-Schutz regressionsprüfen.
- Keine destruktiven Server- oder Datenbankoperationen ohne geprüfte Sicherung und ausdrückliche Autorisierung.
- Vor jedem Deployment prüfen, dass das Release-Bundle keine lokalen Entwicklungsartefakte oder Credentials enthält.

## 6. Commit- und Dokumentationsstrategie

Mindestens ein nachvollziehbarer Abschluss-Commit je P1-Paket sowie je späterer Stufe; bei Bedarf mehrere kleine, logisch getrennte Commits. Vorhandene Commit-Konventionen bevorzugen. Beispiele:

- `docs: consolidate roadmap and existing project status`
- `ci: publish verified production images`
- `ops: prepare digest-pinned production deployment`
- `feat: support accountless csv transactions`
- `feat: reconcile overlapping transactions`
- `feat: improve financial tracking interface`
- `feat: complete manual fints synchronization`
- `test: verify production migration and restore`
- `feat: implement monthly category budgets`
- `feat: implement recurring expense planning`

Bestehende Dokumentationsstruktur zuerst ermitteln; nur falls sinnvoll folgende Dokumente nutzen bzw. integrieren:

| Dokument       | Inhalt                                                      |
| -------------- | ----------------------------------------------------------- |
| Roadmap/Plan   | Stufen, Arbeitspakete, Abhängigkeiten, Freigaben            |
| To-dos         | Aufgaben-ID, Status, Blocker, betroffene Dateien            |
| Fortschritt    | Datum, konkrete Änderungen, Tests, Commit-IDs, Restaufgaben |
| Architektur    | Komponenten, Datenmodell, Verträge, Berechnungsregeln       |
| Deployment     | CI, Digests, Compose, Netzwerke, Registry, Betriebsbundle   |
| Backup/Restore | Aufbewahrung, Verschlüsselung, isolierte Wiederherstellung  |
| Abnahme        | Testmatrix, tatsächliche Resultate, Nutzerentscheidung      |

**Fortschrittsprotokoll pro Paket:** `ID | Status | Änderungen | Tests (Befehl + Resultat) | Commit | offene Punkte | Nutzeraktion`.

## 7. Abhängigkeiten und Umsetzungstakt

1. **P0** Repository, Änderungen, Dokumente, Baseline.
2. **P1.1 Grundlagen** CI/Images/Compose vorbereiten, noch nicht produktiv umstellen.
3. **P1.2** Datenmodell, CSV, Identitäten und Dubletten; zuerst Backend/Verträge, dann UI.
4. **P1.3** Dashboard, Umsatz- und Importoberflächen, Themes, Fehlerzustände.
5. **P1.4** FinTS-Adapter und UI; Bankregistrierung/Echttest separat mit Nutzer.
6. **P1.5** vollständige Prüfungen, Betriebsbundle, isolierter Restore, kontrolliertes Deployment, gemeinsame Abnahme.
7. **STOPP: Nutzerfreigabe für Stufe 2 erforderlich.**
8. **Stufe 2**, danach gesonderte Abnahme und **STOPP**.
9. **Stufe 3**, danach Gesamtabnahme.

Arbeitspakete können bei klaren Abhängigkeiten teilweise parallel vorbereitet werden; die Freigabeschranken bleiben absolut. Produktive Migration erst nach lokalen Tests und Restore-Vorbereitung.

## 8. Offene Entscheidungen und Risiken

| Thema           | Vor Umsetzung klären / absichern                                              |
| --------------- | ----------------------------------------------------------------------------- |
| Lokaler Bestand | Änderungen, offene To-dos, bisherige Fortschrittsdateien                      |
| Macvlan         | Existenz von `FRITZBOX`, DHCP, Konflikte für `.33`, Zugriff an Traefik vorbei |
| GHCR            | Lesender Zugang, Rotation, Release-Freigabe, Digest-Nachweis                  |
| Datenmigration  | Bestehende Kontozuordnungen, Unique-Constraints, Schema-Kompatibilität        |
| CSV             | Identitätsbereich, Wiederholungsimport, Teilimport, Konfliktentscheidung      |
| Backup          | Frequenz, Aufbewahrungsgrenze, Speicherort, Verschlüsselung, Restore          |
| FinTS           | Eigene Produkt-ID, offizieller Endpunkt, Bankzugang, TAN-Verfahren            |
| Budget          | Eindeutige Zuordnung von Erstattungen statt Verrechnung beliebiger Einnahmen  |
| Fixkosten       | Laufzeit-Ende, Umgang mit Teilzahlungen und Sammelbuchungen                   |

**Nicht als erledigt markieren**, solange diese Entscheidungen oder die jeweiligen Nachweise fehlen.

## 9. Verbindliche Abschlussberichte und Stopps

Nach jedem Paket berichten:

```text
Arbeitspaket:
Status: offen | in Arbeit | blockiert | prüfbereit | abgenommen
Umgesetzt:
Betroffene Dateien:
Ausgeführte Tests (Befehl / Ergebnis):
Nicht ausgeführte Prüfungen und Grund:
Migration / Datenrisiko:
Commit(s):
Offene Punkte:
Erforderliche Nutzeraktion:
Nächster zulässiger Schritt:
```

**Nach P1.5:** Gemeinsam Bedienbarkeit, Zahlen, Importentscheidungen, Live-Status und Restore-Ergebnisse prüfen; offene Bankvoraussetzungen nennen. **Ohne explizite Freigabe keine Budgetplanung implementieren.**

**Nach Stufe 2:** Budgetberechnungen gemeinsam prüfen. **Ohne explizite Freigabe keine Fixkostenplanung implementieren.**

**Nach Stufe 3:** Gesamtbericht mit realen Prüfresultaten, verbleibenden Aufgaben und Nutzeraktionen.

---

## 10. Nächste Anweisung an Codex

> Lies diesen Plan zusammen mit den bestehenden Projekt-To-dos und Fortschrittsdateien. Beginne bei einer ausdrücklich beauftragten Umsetzung mit **P0**: Prüfe zuerst Repository, lokale Änderungen, bereits vorhandene Implementierungen und Tests. Erstelle daraus eine konkrete, priorisierte, dateibezogene Aufgabenliste. Bewahre sämtliche vorhandenen lokalen Änderungen. Arbeite anschließend die Stufe 1 in nachvollziehbaren Paketen ab und dokumentiere echte Testresultate und Commits. **Stoppe nach der gemeinsamen Stufe-1-Abnahme und warte auf meine ausdrückliche Freigabe.** Beginne Stufe 2 und 3 nicht eigenständig. Frage bei fehlenden Zugangsdaten, produktiven Risiken oder fachlichen Mehrdeutigkeiten gezielt nach, statt Annahmen als Fakten zu behandeln.
