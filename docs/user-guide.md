# Haushaltsbuch bedienen

## Erste Buchungen

Unter **CSV importieren** kannst du sofort eine Datei auswählen. **Ohne Konto** ist die Voreinstellung; eine Bankverbindung ist dafür nicht nötig. Kodierung und Trennzeichen werden zunächst automatisch ermittelt. Prüfe anschließend Spaltenzuordnung und Vorschau. Fehlerhafte Zeilen werden nur nach ausdrücklicher Zustimmung übersprungen. Ein abgebrochener Import übernimmt keine Buchungen.

**Kodierung** beschreibt, wie Dateibytes zu Buchstaben und Sonderzeichen werden. Eine Bankdatei kann beispielsweise Windows-1252 statt UTF-8 verwenden; der bisherige UTF-8-Fehler bedeutet nicht, dass deine Buchungen kaputt sind. Die automatische Erkennung prüft UTF-8 und UTF-16 mit Erkennungsmarkierung; andernfalls versucht sie Windows-1252. Ältere Einbyte-Kodierungen sind nicht immer eindeutig unterscheidbar. Prüfe daher die angezeigten Umlaute. Unter **Dateiformat anpassen** kannst du UTF-8, Windows-1252/ANSI, ISO-8859-15/Latin-9 und UTF-16 LE/BE auswählen. Latin-9 kann bei einem falsch dargestellten Eurozeichen helfen. Eine Änderung liest dieselbe Datei erneut; du musst sie nicht noch einmal auswählen.

**Trennzeichen** trennt die Spalten: Semikolon, Komma oder Tabulator. Bei einer langen statt mehrerer einzelner Spalten wähle das passende Zeichen manuell. **Spaltenüberschriften** sind die Namen in der ersten CSV-Zeile, etwa Buchungstag, Betrag und Verwendungszweck. Die Anwendung schlägt bekannte Namen vor; bei mehreren passenden Spalten entscheidest du selbst.

Für den Import brauchst du **Buchungsdatum**, **Betrag** und **Buchungstext**. Verwende gültige Daten als TT.MM.JJJJ oder JJJJ-MM-TT und Beträge mit Dezimalkomma; negative Beträge sind Ausgaben. Unter **Weitere Angaben zuordnen** findest du optionale Informationen mit Erklärungen. Eine Bankreferenz darf nur genau eine Buchung identifizieren; Mandats- oder Kundenreferenzen besser leer lassen. Ohne Währungsspalte wird EUR angenommen; es findet keine Währungsumrechnung statt.

**Vorschau erstellen** speichert noch keine Buchungen. Die Zeilenhinweise benennen das konkrete Problem, etwa ungültiges Datum, Betrag oder fehlenden Text. Korrigiere den Export und wähle ihn erneut oder bestätige ausdrücklich, nur gültige Zeilen zu übernehmen. Erst **Import bestätigen** übernimmt diese Buchungen. Ohne gesetzte Zustimmung bleibt ein Teilimport gesperrt.

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

## Darstellung und Fehler

Ein einzelner **Sonne/Mond-Button** wechselt auf der Anmeldeseite und in der Anwendung zwischen Hell und Dunkel. Ohne eigene Auswahl folgt die Darstellung deinem Gerät. Ein Klick speichert die gewünschte Darstellung auf diesem Gerät, auch nach Neuladen. Der Schieber und die Farben wechseln weich; bei der Geräteeinstellung „Bewegung reduzieren“ erfolgt der Wechsel ohne Animation. Der Button ist per Tabulator und Leertaste bedienbar; „Dunkelmodus gedrückt“ bedeutet, dass Dunkel aktiv ist.

Fehlerhafte Formularfelder werden markiert. Bei Servervalidierung springt der Tastaturfokus zum ersten betroffenen Feld. Korrigiere die Eingabe und sende erneut; gewöhnliche Formulare behalten ihren Entwurf. Passwörter, PIN und TAN werden nach einem Versuch gelöscht. Bei abgelaufener Sitzung ist eine neue Anmeldung erforderlich.

Der Link **Zum Inhalt springen** ist per Tabulator erreichbar. Er überspringt die Navigation und setzt den Fokus auf den Seiteninhalt.

## Bankabruf

CSV bleibt jederzeit unabhängig nutzbar. Ein echter Sparkasse-Abruf benötigt zunächst die eigene FinTS-Produktregistrierung, einen bestätigten Bankendpunkt und die separate Prüfung deines Zugangs. Die aktuelle Anleitung und der belegte Kompatibilitätsstatus stehen in [banking.md](banking.md). Eine synthetische Prüfung bestätigt keine reale Bankkompatibilität.
