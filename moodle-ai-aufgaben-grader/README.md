# Moodle AI Aufgaben-Grader

**Lädt Datei-Abgaben aus dem Aufgaben-Modul anonymisiert herunter, erzeugt den Auftrags-Prompt für die KI-Bewertung und trägt Note + Feedback automatisch zurück.**

Version 1.0.0 (Beta, noch nicht live getestet) · Lizenz: CC BY-SA 4.0

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
wieder hoch. Sie öffnet dann nacheinander jede Bewerten-Einzelseite (`action=grader`),
trägt die Werte ein und klickt selbst durch „Speichern und nächste anzeigen" — kein
Umweg über Moodles Offline-Bewertungstabelle.

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

1. Bewerten-Übersichtsseite einer Aufgabe öffnen (`action=grading`).
2. Feedback-Stufe wählen (Zwischen- oder Abschlussfeedback) und herunterladen —
   ZIP, CSV-Vorlage und Auftrags-Prompt entstehen in einem Zug.
3. Prompt zusammen mit dem ZIP in Cowork einfügen, KI füllt die CSV
   (`Kuerzel-ID;Note;Feedback`).
4. Ausgefüllte CSV in der Erweiterung hochladen und „Eintragen starten" klicken.
5. Die Erweiterung schaltet automatisch durch alle Personen der CSV; Tab währenddessen
   nicht schließen.

## Grenzen von v1.0

- Nur **Punktebewertung** (`Notenfeld` = einfaches Zahlenfeld). Bewertungsschemata/
  Rubrics werden noch nicht unterstützt.
- Klassenübergreifende Duplikatserkennung ist bewusst nicht eingebaut (Entscheidung
  2026-09-09, unnötige Komplexität für dieses Werkzeug).
- **Erster Bau, noch nicht an einer echten Moodle-Instanz geprüft** — anders als die
  Quiz-Erweiterungen dieser Familie. Ausgabe im Panel und in der Konsole (Filter `[ABG]`)
  zeigt an, wo Selektoren ggf. nachjustiert werden müssen.

---

## Installation

Wie bei den übrigen Erweiterungen dieses Repos: Code herunterladen (ZIP oder Klonen),
unter `chrome://extensions/` den Entwicklermodus aktivieren und den Ordner
`moodle-ai-aufgaben-grader/` über „Entpackte Erweiterung laden" auswählen.

---

Entwickler: Arne Spielhoff · Lizenz: CC BY-SA 4.0
