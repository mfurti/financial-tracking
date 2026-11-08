# Haushaltsbuch bedienen

## Dein Überblick

Die App sammelt deine Buchungen und zeigt, wie viel im ausgewählten Monat eingenommen und ausgegeben wurde. Die große **Monatsbilanz** ist die Differenz dieser Geldflüsse. Sie ist kein verfügbarer Kontostand und keine Prognose. Darunter siehst du die Ausgabenverteilung und die letzten Buchungen; tatsächliche Bank-Kontostände stehen getrennt daneben.

Am Computer findest du die Seiten links. Auf dem Telefon stehen **Übersicht**, **Umsätze**, **Kategorien** und **Importieren** unten. Unter **Mehr** erreichst du Konten, Importhistorie, Bankverbindungen und Einstellungen. Das Menü schließt nach der Navigation, beim Klicken außerhalb oder mit Escape. Das Zahnrad oben öffnet die Einstellungen direkt.

## Erste Buchungen

Unter **Importieren** wählst du deine CSV-Datei aus. Die App erkennt Format und bekannte Spalten, übernimmt vollständig gültige Buchungen automatisch und öffnet die echte Monatsauswertung. Eine Bankverbindung oder Kontoanlage ist nicht nötig. Bei Dateien mit mehreren Monaten wird der letzte enthaltene Monat geöffnet; die übrigen Buchungen bleiben in ihren tatsächlichen Monaten sichtbar. Die Erfolgsmeldung zeigt neue und bereits bekannte Buchungen.

Nur bei unklaren Spalten, fehlerhaften Zeilen oder möglichen Dubletten ist eine Entscheidung nötig. Unter **Importoptionen** kannst du bei Bedarf ein bestehendes Zielkonto oder ein anderes Dateiformat wählen. Ohne Konto zählen Buchungen trotzdem sofort; eine spätere Zuordnung bleibt möglich. Es werden keine Platzhalterkonten angelegt.

Sparkasse-Daten wie **07.11.26** werden automatisch als **07.11.2026** gelesen, auch bei der Wertstellung. Zweistellige Jahre stehen ausdrücklich für 2000–2099. Für ältere Buchungen verwende ein vierstelliges Jahr. `TT.MM.JJJJ` und `JJJJ-MM-TT` funktionieren weiterhin; ungültige Kalendertage werden zurückgewiesen.

**Kodierung** beschreibt, wie Dateibytes zu Buchstaben und Sonderzeichen werden. Eine Bankdatei kann beispielsweise Windows-1252 statt UTF-8 verwenden; der bisherige UTF-8-Fehler bedeutet nicht, dass deine Buchungen kaputt sind. Die automatische Erkennung prüft UTF-8 und UTF-16 mit Erkennungsmarkierung; andernfalls versucht sie Windows-1252. Ältere Einbyte-Kodierungen sind nicht immer eindeutig unterscheidbar. Prüfe daher die angezeigten Umlaute. Unter **Dateiformat anpassen** kannst du UTF-8, Windows-1252/ANSI, ISO-8859-15/Latin-9 und UTF-16 LE/BE auswählen. Latin-9 kann bei einem falsch dargestellten Eurozeichen helfen. Eine Änderung liest dieselbe Datei erneut; du musst sie nicht noch einmal auswählen.

**Trennzeichen** trennt die Spalten: Semikolon, Komma oder Tabulator. Bei einer langen statt mehrerer einzelner Spalten wähle das passende Zeichen manuell. **Spaltenüberschriften** sind die Namen in der ersten CSV-Zeile, etwa Buchungstag, Betrag und Verwendungszweck. Die Anwendung schlägt bekannte Namen vor; bei mehreren passenden Spalten entscheidest du selbst.

Für den Import brauchst du **Buchungsdatum**, **Betrag** und **Buchungstext**. Verwende gültige Daten als TT.MM.JJJJ oder JJJJ-MM-TT und Beträge mit Dezimalkomma; negative Beträge sind Ausgaben. Unter **Weitere Angaben zuordnen** findest du optionale Informationen mit Erklärungen. Eine Bankreferenz darf nur genau eine Buchung identifizieren; Mandats- oder Kundenreferenzen besser leer lassen. Ohne Währungsspalte wird EUR angenommen; es findet keine Währungsumrechnung statt.

Bei ungültigen Zeilen bleibt die Übernahme stehen und zeigt das konkrete Problem, etwa Datum, Betrag oder fehlenden Text. Korrigiere den Export oder bestätige ausdrücklich, nur gültige Buchungen zu übernehmen. Ohne diese Zustimmung wird kein Teilimport ausgeführt. Mögliche Dubletten landen unter **Buchungen klären** und werden nicht still doppelt gezählt.

Fehlt nach der Übernahme die Serverantwort, prüft die App denselben Importstatus. Es wird nicht automatisch eine zweite Übernahme erzeugt. Mit **Importstatus prüfen** lässt sich der bestehende Vorgang erneut lesen. Beim Verlassen einer noch nicht übernommenen Vorschau wird sie abgebrochen; eine bereits laufende Übernahme wird nicht durch einen späten Seitenwechsel zurückgesetzt.

Gebuchte kontolose Umsätze zählen sofort in der Monatsübersicht. Unter **Umsätze → Konto → Ohne Konto** findest du sie wieder und kannst Kategorien vergeben. Der Filter für ein bestimmtes Konto enthält sie erst nach einer Zuordnung.

## Später einem Konto zuordnen

Wähle einzelne Buchungen oder mehrere Kontrollkästchen und anschließend das Zielkonto. Prüfe bei möglichen Überschneidungen Datum, Betrag, Text, Quelle, Referenzen, Status und Kategorie.

- **Bank-/Zieldaten übernehmen:** eine bestehende Buchung mit den ausgewählten Zieldaten behalten; die zusätzliche CSV-Buchung geht darin auf.
- **CSV-Daten übernehmen:** zusammenführen und die finanziellen Daten aus der CSV behalten.
- **Separat behalten:** beide tatsächlichen Buchungen erhalten. Beide zählen weiterhin, sofern sie gebucht und keine eigenen Umbuchungen sind.
- **Überspringen:** die Buchung bleibt ohne Konto und kann später zugeordnet werden.

Abweichende manuelle Kategorien musst du ausdrücklich auswählen. Veränderte Vergleichsdaten erfordern eine neue Vorschau. Eine wiederholte identische Bestätigung zählt die Buchung nicht erneut.

Die Importhistorie zeigt zusätzliche Prüfungen aus wiederholten oder überlappenden Dateien. Dort kannst du vorhandene Daten behalten, Importdaten übernehmen, separat behalten oder die neue Zeile überspringen. Ähnliche Buchungen werden nicht allein wegen ihres Aussehens zusammengeführt.

## Zahlen richtig lesen

**Bekannte Kontostände** stammen aus einer Bankabfrage. Fehlende oder alte Salden sind entsprechend gekennzeichnet; CSV-Umsätze ergeben keinen verlässlichen Kontostand.

**Einnahmen, Ausgaben und Monatssaldo** beziehen sich auf das Buchungsdatum im ausgewählten Monat, einschließlich gebuchter Umsätze ohne Konto. Vorgemerkte Umsätze und als eigene Umbuchungen markierte Buchungen bleiben außerhalb dieser Auswertung. Erstattungen mit positivem Betrag erscheinen als Einnahmen. Alle Beträge werden centgenau berechnet.

## Kategorien verstehen

**Kategorien** zeigt die monatlichen Einnahmen, Ausgaben und noch nicht zugeordneten Buchungen. Im Diagramm erscheinen ausschließlich Ausgaben; klicke eine Gruppe an, um genau die zugehörigen gebuchten Ausgaben dieses Monats zu sehen. Die Gruppen „Lebensmittel“ oder „Wohnen“ helfen beim Vergleichen, verändern aber keine Beträge.

**Nicht kategorisiert** heißt: Die Buchung ist bereits übernommen und mitgerechnet. Über **Buchungen zuordnen** öffnest du die betroffenen Umsätze und wählst ihre Kategorie. Fehlende Kategorien werden beim CSV-Import nicht geraten. Unter **Kategorien verwalten** kannst du eigene Gruppen anlegen, umbenennen oder deaktivieren. Löschen entfernt nur die Kategorie und ihre Zuordnungen, keine Buchungen.

## Darstellung und Fehler

Ein einzelner **kreisrunder Sonne/Mond-Button** wechselt auf der Anmeldeseite und in der Anwendung zwischen Hell und Dunkel. Ohne eigene Auswahl folgt die Darstellung deinem Gerät. Ein Klick speichert die gewünschte Helligkeit auf diesem Gerät, auch nach Neuladen. Symbol und Farben wechseln weich; bei „Bewegung reduzieren“ erfolgt der Wechsel ohne Animation. Der Button ist per Tabulator und Leertaste bedienbar; „Dunkelmodus gedrückt“ bedeutet, dass Dunkel aktiv ist.

Unter **Einstellungen → Farben & Darstellung** wählst du aus 18 Farbwelten, darunter VS Code Modern, GitHub, One Dark Pro, Dracula, Nord, Monokai, Solarized und Catppuccin. Die Farben sind für die App mit hellen und dunklen Gegenstücken angepasst. Auch diese Auswahl bleibt auf diesem Gerät gespeichert und gilt auf der Anmeldeseite. Über **Helligkeit → Wie mein Gerät** stellst du die automatische Systemwahl wieder her.

Fehlerhafte Formularfelder werden markiert. Bei Servervalidierung springt der Tastaturfokus zum ersten betroffenen Feld. Korrigiere die Eingabe und sende erneut; gewöhnliche Formulare behalten ihren Entwurf. Passwörter, PIN und TAN werden nach einem Versuch gelöscht. Bei abgelaufener Sitzung ist eine neue Anmeldung erforderlich.

Der Link **Zum Inhalt springen** ist per Tabulator erreichbar. Er überspringt die Navigation und setzt den Fokus auf den Seiteninhalt.

## Bankabruf

CSV bleibt jederzeit unabhängig nutzbar. Ein echter Sparkasse-Abruf benötigt zunächst die eigene FinTS-Produktregistrierung, einen bestätigten Bankendpunkt und die separate Prüfung deines Zugangs. Die aktuelle Anleitung und der belegte Kompatibilitätsstatus stehen in [banking.md](banking.md). Eine synthetische Prüfung bestätigt keine reale Bankkompatibilität.

## Datum und Auswahlfelder

Datumsfelder erlauben direkte Eingabe, Kalenderauswahl und Löschen. Der Monatsfilter öffnet eine Monatsauswahl. Lange Auswahllisten lassen sich durchsuchen; mit Escape schließt du die Liste. Unter **Buchungen klären** unterscheiden die Hinweise fehlerhafte Zeilen von möglichen Doppelbuchungen. Die angezeigten Ursachen und Vergleichswerte erklären die erforderliche Entscheidung. Das Löschen einer Kategorie verlangt eine Bestätigung und erhält die Buchungen.

## Theme-Kacheln

Unter Einstellungen wählst du eine der 23 Vorschaukacheln. Die Markierung zeigt die aktive Farbwelt; Pfeiltasten bewegen den Fokus, die Leertaste wählt. Ayu Light, Dark und Mirage gibt es jeweils mit und ohne Kartenrahmen. Die Ayu-Auswahl setzt auch Hell oder Dunkel. Der Kreis wechselt zu Light und zurück zum zuletzt gewählten Dark oder Mirage; die Rahmenwahl bleibt erhalten. Vorhandene gespeicherte Farbwelten bleiben gültig.

## Automatische Kategorien und Fix/Variabel

Unter **Kategorien & Regeln** legst du Regeln an: Die Gegenpartei muss vollständig passen oder der Buchungstext einen bewusst gewählten Text enthalten. Groß-/Kleinschreibung spielt keine Rolle. Begrenze eine Regel bei Bedarf auf Ausgaben oder Einnahmen. Kleinere Prioritätszahlen greifen zuerst. Widersprechen sich gleichrangige Treffer, bleibt die Buchung mit Hinweis ungeklärt; es wird keine Kategorie geraten.

Neue Regeln gelten für neue Buchungen. Mit **Regeln auf Bestandsbuchungen anwenden** kannst du vorhandene automatische/ungeklärte Zuordnungen ausdrücklich neu bewerten. Die Bestätigung erklärt, dass alte automatische Zuordnungen ersetzt oder entfernt werden können. Manuelle Kategorien und bewusst leere Auswahl bleiben geschützt. Die Umsatzliste zeigt den Namen einer automatisch angewendeten Regel. Löschen einer Regel entfernt keine Buchung und ändert keine bisherige Kategorie.

Die Vorlagen ergänzen Alltagskategorien, etwa Mode, Technik und Essen gehen. Passende vorhandene Kategorien werden wiederverwendet, eigene Namen nicht verändert. In einem Umsatz oder nach Auswahl mehrerer Umsätze kannst du **Fix** oder **Variabel** festlegen. **Automatisch / nicht eingeordnet** entfernt diese manuelle Festlegung. Bestätigte Vertragszahlungen gelten dann als fix, alle anderen bleiben nicht eingeordnet. Diese Kennzeichnung verändert keine Beträge.
