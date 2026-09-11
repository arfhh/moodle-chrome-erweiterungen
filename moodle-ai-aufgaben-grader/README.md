# Moodle AI Aufgaben-Grader

**Lädt Datei-Abgaben aus dem Aufgaben-Modul anonymisiert herunter, erzeugt den Auftrags-Prompt für die KI-Bewertung und trägt Note + Feedback automatisch zurück.**

Version 1.3.3 (Beta, im Live-Test) · Lizenz: CC BY-SA 4.0

> Anders als die übrigen Erweiterungen dieser Familie (Grader, Reviewer, Coach — alle für
> Testfragen) bewertet der Abgabengrader **Datei-Abgaben** im Aufgaben-Modul (`mod/assign`):
> PDF-Arbeitshefte, Berichte und Ähnliches. Er löst den bisher manuellen
> Moodle-Download/-Upload ab.

---

## Wozu?

Wer Datei-Abgaben (PDFs, Arbeitshefte, Berichte) über eine KI bewerten lässt, kopiert
bisher jede Abgabe einzeln, anonymisiert von Hand und trägt Note + Feedback am Ende
wieder Zeile für Zeile ins Moodle ein. Diese Erweiterung übernimmt beide Enden davon.

Auf der Bewerten-Übersichtsseite (`action=grading`) baut sie **selbst** — ohne Moodles
eigenen Bulk-ZIP-Export — ein ZIP mit einem Ordner pro **Kürzel-ID** (z. B. `MB-03`),
dazu eine anonymisierte CSV-Vorlage und einen fertigen Auftrags-Prompt zum Einfügen in
ein Cowork-Projekt. Klarnamen bleiben ausschließlich in Moodle; die KI sieht nur
Kürzel-IDs.

Ist die CSV mit Note und Feedback ausgefüllt, lädt man sie über dieselbe Erweiterung
wieder hoch. Sie trägt die Werte in Moodles **Schnellbewertung** ein — dort stehen
Notenfeld und Kommentarfeld aller Personen untereinander auf einer Seite. Die
Erweiterung füllt nur; geprüft und gespeichert wird von Hand mit Moodles eigenem
Speichern-Knopf. Kein Umweg über die Offline-Bewertungstabelle, und nichts wird
ungesehen gespeichert.

Die Erweiterung selbst kennt nur Moodle-Mechanik und beurteilt nie Inhalte — welche
Bewertungsregeln gelten, steht in der jeweiligen Projekt-Skill der Lehrkraft.

---

## Kürzel-ID-Schema

Anfangsbuchstabe Vorname + Anfangsbuchstabe Nachname + fortlaufende Nummer, z. B.
`MB-03`. Die Nummer ist **pro Kurs** eindeutig und bleibt über mehrere Aufgaben
derselben Klasse hinweg stabil — ein einmal vergebenes Kürzel ändert sich nicht mehr.
Zwei Personen mit gleichen Initialen unterscheiden sich allein über die Nummer.

Die Zuordnung Kürzel-ID ↔ Moodle-Nutzer bleibt ausschließlich lokal im Browser
(`chrome.storage.local`) und verlässt ihn nie.

---

## Ablauf

0. Einmalig im Reiter **Einstellungen**: Name der eigenen Bewertungs-Skill eintragen,
   Duplikatprüfung und Lösungs-Bewertungshorizont an- oder abwählen. Diese Angaben
   gehen danach in jeden erzeugten Prompt ein.
1. Bewerten-Übersichtsseite einer Aufgabe öffnen (`action=grading`).
2. Feedback-Stufe wählen (Zwischen- oder Abschlussfeedback) und herunterladen —
   ZIP, CSV-Vorlage und Auftrags-Prompt entstehen in einem Zug.
3. ZIP entpacken, Ordner in den Import-Ordner legen, Prompt in Cowork einfügen; die KI
   füllt `bewertung.csv` (`Kuerzel-ID;Note;Feedback`).
4. Zurück in Moodle: Schnellbewertung einschalten (der Reiter „Einfügen" bietet dafür
   einen Knopf an) und alle Personen anzeigen lassen.
5. Ausgefüllte CSV im Reiter „Einfügen" wählen und „In die Tabelle eintragen" klicken.
   Die gefüllten Kommentarfelder werden rot umrandet.
6. Einträge prüfen und Moodles Knopf „Speichern" unter der Tabelle drücken.

### Was im ZIP liegt

Genau **ein** Wurzelordner, benannt nach Kurs und Aufgabe **ohne Datum** — bei jeder
Feedback-Runde derselbe Name, damit der Abgleich „was ist seit dem letzten Lauf neu?"
ohne Namensraten funktioniert:

```
26-29 Chemie a - 1.1 Aufgaben (PDF)/
├── MB-03/…pdf
├── …
├── bewertung.csv     ← fester Name, wird von der KI ausgefüllt
└── _lauf.json        ← Laufzettel: Datum, Aufgabe, Lauf-Art, Kürzel-IDs (keine Klarnamen)
```

Der **ZIP-Dateiname** trägt zusätzlich das Datum, sonst hängt Chrome bei mehreren
Downloads am selben Tag „ (1)" an.

## Grenzen

- Nur **Punktebewertung**. Bewertungsschemata und Rubriken werden nicht unterstützt —
  bei ihnen bietet Moodle keine Schnellbewertung an.
- Klassenübergreifende Duplikatserkennung ist bewusst nicht eingebaut (Entscheidung
  2026-09-09, unnötige Komplexität für dieses Werkzeug).
- Duplikatprüfung und der Abgleich „neu seit dem letzten Lauf" passieren **nicht** in der
  Erweiterung, sondern auf der KI-Seite; die Erweiterung fordert sie im Prompt nur an.
- Die Erweiterung wirkt ausschließlich auf der Bewerten-Übersicht (`action=grading`).
  Auf der Bewerten-Einzelseite erscheint sie seit v1.2.0 gar nicht mehr.
- Das Zurückschreiben braucht Moodles **Schnellbewertung**. Ist sie aus, bietet der Reiter
  „Einfügen" an, sie einzuschalten.

---

## Installation

Wie bei den übrigen Erweiterungen dieses Repos: Code herunterladen (ZIP oder Klonen),
unter `chrome://extensions/` den Entwicklermodus aktivieren und den Ordner
`moodle-ai-aufgaben-grader/` über „Entpackte Erweiterung laden" auswählen.

---

Entwickler: Arne Spielhoff · Lizenz: CC BY-SA 4.0
