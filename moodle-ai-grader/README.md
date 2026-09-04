# Moodle AI Grader

**Version 3.0** · Chrome-Erweiterung (Manifest V3)
Entwickelt von **T. Henken & A. Spielhoff** · Lizenz **CC BY-SA 4.0**

Bewertet Klausuren mit mehreren Aufgaben in **einer** Moodle-Freitextfrage: legt den
Erwartungshorizont und die Antwortvorlage in der Frage an, erzeugt daraus den
Bewertungsauftrag für einen KI-Chat und trägt Punkte und begründetes Feedback zurück
in Moodle ein.

Die Erweiterung greift **nicht selbst auf eine KI zu**. Sie erzeugt Prompts, die du in
ChatGPT, Claude oder einen anderen Chat einfügst, und liest die Antwort wieder ein.

---

## Was in Version 3 anders ist

| | v2 | v3 |
|---|---|---|
| Erwartungshorizont | im Plugin gespeichert | **in der Frage** (Moodle-Feld „Information zur Bewertung") |
| Punkte und Abzüge | die KI rechnet | **die Erweiterung rechnet** |
| Antwortvorlage | — | wird mit angelegt, gliedert die Abgabe je Aufgabe |
| Wirkt auf | jede Seite | nur Bewertungsseite **und** Frage-Bearbeiten |
| Berechtigungen | „alle Daten auf allen Websites" | nur `storage` |
| Sicherheitsnetze | Warnung vor dem Eintragen | Prüfen · Trockenlauf · Gegenprobe |

**Warum die Erweiterung rechnet:** Sprachmodelle beurteilen Sprache zuverlässig, rechnen
aber unzuverlässig. In einer früheren Fassung bestätigte die KI in der Tabelle 75 % und
schrieb anschließend die volle Punktzahl ins JSON. Seit die Rechnung im Code liegt, kann
das nicht mehr passieren.

---

## Installation

1. Repo herunterladen (**Code → Download ZIP**) und entpacken.
2. In Chrome `chrome://extensions/` öffnen, **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** → den Ordner `moodle-ai-grader` auswählen.

Beim Update genügt „↺ neu laden" — der Ordnername bleibt ohne Versionsnummer.

Beim Installieren fragt Chrome nur nach Zugriff auf die Bewertungs- und die
Fragen-Bearbeiten-Seite deines Moodle. Die Warnung „alle Daten auf allen Websites" gibt es
seit Version 3 nicht mehr.

---

## Ablauf

### 1 · Vor der Klausur — Erwartungshorizont und Antwortvorlage anlegen

Frage in der Fragensammlung zum **Bearbeiten** öffnen. Rechts erscheint der Knopf **AI**.

1. Reiter **Erwartungshorizont** → „📋 Prompt kopieren".
2. In den KI-Chat einfügen. Die KI zerlegt die Aufgabenstellung in Teilaufgaben, schlägt
   Operator, AFB-Stufe, Punkte und den Erwartungshorizont vor und fragt nach, bis es passt.
3. Den JSON-Block der KI in das Feld einfügen → **🔍 Prüfen**. Je Aufgabe erscheint ein
   Textfeld; du kannst jeden Horizont noch ändern.
4. Reiter **Antwortvorlage** → Vorschau ansehen, dann **Horizont + Antwortvorlage eintragen**.

Beides wird in **einem** Speichervorgang geschrieben und danach gegengeprüft.

**Die Antwortvorlage** wird den Lernenden beim Öffnen der Frage in das Eingabefeld geladen:
je Aufgabe eine Kopfzeile mit Nummer, AFB-Stufe, Schlagwort und Punktzahl, darunter Platz
zum Schreiben. Sie gibt der Klasse Struktur — und erlaubt der Erweiterung später, die
Abgabe verlässlich Aufgabe für Aufgabe zu zerlegen.

### 2 · Nach der Klausur — bewerten

**Test → Ergebnisse → Manuelle Bewertung**, dann den Knopf **AI**.

1. Reiter **Korrektur**. Die Erweiterung schlägt vor, wie viele Abgaben in einen Durchgang
   passen — hergeleitet aus der tatsächlichen Textlänge, nicht aus einer festen Zahl.
2. „📋 Prompt kopieren" → in den KI-Chat → Antwort zurück in das Feld → **🔍 Prüfen**.
3. Je Abgabe erscheint eine Zeile mit alter und neuer Punktzahl, den Prozentwerten je
   Aufgabe und der Fehlerdichte. Das Feedback lässt sich vorher noch bearbeiten.
4. **Trockenlauf** prüft, ob jedes Punkte- und Kommentarfeld wirklich auf der Seite steht.
   Das fängt den häufigsten Fehler ab: ein JSON aus einem anderen Auslese-Durchlauf.
5. **Alle eintragen.** Danach lädt die Erweiterung die Seite erneut und vergleicht jeden
   gespeicherten Wert mit dem gewollten. Es wird nichts als Erfolg gemeldet, was nicht
   wirklich angekommen ist.

Fehlt der Erwartungshorizont, springt die Erweiterung von selbst in den Horizont-Reiter —
er lässt sich auch hier noch nachtragen.

---

## Bewertungsmaßstab

**Inhalt.** Die KI vergibt je Aufgabe einen Erfüllungsgrad in den Stufen
100 / 75 / 50 / 25 / 0 Prozent und verankert ihn am hinterlegten Erwartungshorizont.
Punkte, Rundung und Summe rechnet die Erweiterung.

**Sprache — als Abzug, nicht als zweiter Topf.** Ein inhaltsleerer, aber sauber
geschriebener Text bekäme sonst allein für die Form Punkte. Der Höchstabzug ist ein
Prozentsatz der **Gesamtpunktzahl**, nicht je Aufgabe, und wird proportional verteilt.

Gestaffelt wird nach **Fehlern je 100 Wörtern**:

| Strenge | kein Abzug | ⅓ | ⅔ | voll |
|---|---|---|---|---|
| mild | bis 1,5 | bis 3,0 | bis 5,0 | darüber |
| normal | bis 1,0 | bis 2,0 | bis 3,5 | darüber |
| streng | bis 0,5 | bis 1,5 | bis 2,5 | darüber |

Unter 40 Wörtern greift eine Dichte nicht — dort zählt die absolute Fehlerzahl.
Bei „keine" wird kein Punkt abgezogen, das Sprachfeedback aber trotzdem geschrieben.
Schwere Fehler (Satz ohne Prädikat, abgebrochener Satz, Satzbau zum zweimal Lesen)
zählen doppelt.

**Operatoren** fließen immer in die Bewertung ein. Einen eigenen Abschnitt
„Operatorerfüllung" im Feedback bekommt nur die Stufe „Umfangreich"; bei „Ausführlich"
steht die Operatorverfehlung im laufenden Begründungstext.

**Jede Aufgabe bekommt eine Begründung** — auch eine mit voller Punktzahl.

---

## Einstellungen (⚙)

Fach · Jahrgang (ab 11 wird gesiezt) · Kursniveau · Punkteschritte ·
Rechtschreibung (Höchstabzug in % und Strenge) · Feedbacklänge ·
KI-Transparenzhinweis · Quellenangaben entfernen.

Die Werte werden **nicht** nur in den Prompt geschrieben, sondern von der Erweiterung
angewandt. Wer den Prompt selbst anpassen will, kann ihn über ✏️ überschreiben;
beim Speichern der Grundeinstellungen werden eigene Prompts zurückgesetzt, damit keine
veralteten Parameter eingebettet bleiben.

---

## Ohne Antwortvorlage und ohne Kartendesign

Die Erweiterung setzt **nichts** davon voraus. Sie erkennt selbst, was sie vorfindet:

1. **Gegliederte Abgabe** → zerlegt je Aufgabe. Bester Fall.
2. **Keine Gliederung, aber Horizont** → die ganze Abgabe geht am Stück an die KI.
3. **Kein Horizont** → die Erweiterung bietet an, einen zu erzeugen.

Die Antwortvorlage wird standardmäßig **neutral** gestaltet; die Farblogik nach
AFB-Stufen ist eine Option.

Wer in seinem Moodle keine Fragen bearbeiten darf, kann den Horizont stattdessen in der
Erweiterung ablegen — im Reiter „Erwartungshorizont" ganz unten.

---

## Datenschutz

- **Keine Schülernamen** werden ausgelesen oder kopiert; zur Zuordnung dient nur die
  laufende Nummer der Abgabe auf der Seite.
- Die Erweiterung sendet nichts an fremde Server. Sie liest Seiten deiner eigenen
  Moodle-Instanz mit deiner bestehenden Anmeldung.
- Daten verlassen den Browser erst, wenn du selbst auf „Prompt kopieren" klickst.
- Kein Zugriff auf Seiten-JavaScript, kein Hintergrunddienst, keine Netzwerkrechte
  außerhalb deines Moodle.

## Grenzen

- Eine Moodle-Freitextfrage je Bewertungsseite. Für Kurztests mit Zufallsfragen ist der
  **Moodle AI Coach** zuständig, für Cloze-Lücken der **Moodle AI Reviewer**.
- Die Erweiterung ändert nichts an Fragen, die sie nicht kennt: Geschrieben wird nur, was
  du im Trockenlauf gesehen und dann bestätigt hast.
- Anhänge und Dateiabgaben werden nicht gelesen.
