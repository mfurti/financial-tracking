# Eigene FinTS-Produktregistrierung vorbereiten

Stand: 7. November 2026. Du hast noch keine Registrierung beantragt. Diese Anleitung bereitet deine nächsten Schritte vor; sie ist weder eine eingereichte Registrierung noch eine Bankfreigabe.

## 1. Originalformular öffnen

Öffne die offizielle [FinTS-Produktregistrierung der Deutschen Kreditwirtschaft](https://www.fints.org/de/hersteller/produktregistrierung) und lade dort das aktuelle Originalformular über „Registrierungsprozess“ herunter. Verwende den Link auf dieser Seite: direkte Downloadadressen sind zeitlich begrenzt. Der automatisierte Abruf des verlinkten PDF war hier nicht möglich; die folgenden Angaben ersetzen deshalb nicht die aktuellen Formularfelder.

## 2. Anwendung beschreiben

Diese Angaben kannst du als Grundlage verwenden:

| Angabe                             | Vorschlag für dieses Projekt                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Vorgang                            | Neuregistrierung                                                                                                           |
| Produktbezeichnung                 | Haushaltsbuch                                                                                                              |
| Produkt-Eigner / Herstellerkontakt | Deine tatsächlichen Angaben als Verantwortlicher dieser Anwendung; keine erfundene Firma                                   |
| Produktkategorie                   | Web-Server: Die Anwendung auf deinem Server spricht mit der Bank; der Browser spricht mit deiner Anwendung                 |
| Beschreibung, falls gefragt        | Privat betriebenes Haushaltsbuch mit manuellem lesendem Konto-, Saldo- und Umsatzabruf über FinTS. Keine Zahlungsaufträge. |
| Kontakt-E-Mail                     | Eine Adresse, unter der du Rückfragen und die Registrierungsantwort empfangen kannst                                       |
| Produktregistrierungsnummer        | Bei einer Neubeantragung frei lassen                                                                                       |
| Produktversion                     | Wird separat im FinTS-Dialog übertragen; der aktuelle Adapter verwendet `0.1`                                              |

Kategorie, leere Registrierungsnummer bei Neubeantragung und Trennung von Produkt/Version folgen den [offiziellen FAQ](https://www.fints.org/de/hersteller/faq-produktregistrierung). Wenn die aktuellen Pflichtfelder ausschließlich Firmenangaben vorsehen, frage die Registrierungsstelle nach der korrekten Eintragung für deine privat betriebene Anwendung. Registriere die Anwendung selbst; eine fremde Bibliothekskennung ersetzt ihre Registrierung nicht.

## 3. Selbst einreichen

Prüfe das vollständig ausgefüllte Originalformular und sende es selbst an die auf der offiziellen Registrierungsseite genannte Stelle: **registrierung@hbci-zka.de**. Ich habe keine Nachricht versendet. PIN, TAN und Online-Banking-Passwort gehören nicht in das Formular.

Die Registrierungsseite nennt üblicherweise **10–15 Werktage** bis zur Zuteilung. Bis dahin bleiben CSV, Kategorisierung und Auswertungen unabhängig nutzbar. Eine erhaltene ID wird später in der geschützten Serverkonfiguration hinterlegt, nicht in Git.

## 4. Bankendpunkt und Zugang bestätigen

Frage Sparkasse Bodensee nach diesen konkreten Angaben:

> Ich möchte meine privat betriebene, registrierte Finanzanwendung für lesende Konto-, Saldo- und Umsatzabfragen über FinTS 3.0 mit PIN/TAN nutzen. Bitte bestätigen Sie für BLZ 69050001 die aktuelle HTTPS-Kommunikationsadresse, ob mein Zugang dafür freigeschaltet ist, die verfügbaren TAN-Verfahren/TAN-Medien und den abrufbaren Umsatzzeitraum. Unterstützt mein Verfahren eine entkoppelte Freigabe in der Banking-App?

Die BLZ ist im [offiziellen Impressum der Sparkasse Bodensee](https://www.sparkasse-bodensee.de/de/home/toolbar/impressum.html) angegeben. Eine aktuelle offizielle FinTS-URL wurde bei dieser Recherche nicht bestätigt. URLs anderer Sparkassen, insbesondere Sparkasse Schwaben-Bodensee, dürfen nicht ungeprüft übernommen werden.

## 5. Danach gemeinsam testen

- Rückmeldung: Registrierung beantragt / ID erhalten / Endpunkt bestätigt. Keine PIN oder TAN hier senden.
- Geschützte Konfiguration und ein getrennt freigegebener, begleiteter Live-Test folgen erst danach.
- Prüfen: Kontenerkennung, gemeldeter Saldo, gebuchte Umsätze/Zeitraum, gewähltes TAN-Medium, App-Freigabe, Abbruch und erneuter Abruf ohne doppelte Zählung.
- Ergebnis und Einschränkungen werden ohne Zugangsdaten dokumentiert. Bis zu diesem Nachweis bleibt die reale Bankkompatibilität offen.
