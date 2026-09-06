# Moodle-Erweiterungen für Chrome

Fünf kleine Chrome-Erweiterungen, die wiederkehrende Handarbeit in Moodle abnehmen —
Bewerten, Nachbewerten, Fragensammlung pflegen, Notenstufen eintragen.

Alle laufen **ausschließlich im Browser**. Keine Erweiterung schickt Daten an einen
Server, keine hat einen eigenen KI-Zugang und keine braucht einen API-Schlüssel.
Wo eine KI im Spiel ist, erzeugt die Erweiterung einen **Prompt zum Kopieren** und
liest die **Antwort als JSON** wieder ein — welchen Chat du benutzt, entscheidest du.

---

## Die fünf Erweiterungen

| Erweiterung | Version | Download | Wofür |
|---|---|---|---|
| **Moodle AI Grader** · [Quelltext](moodle-ai-grader/) | 3.0.1 | **[⬇ ZIP](https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-grader.zip)** | **Klausuren** mit mehreren Aufgaben in einer Freitextfrage: legt Erwartungshorizont und Antwortvorlage in der Frage an, erzeugt Bewertungs-Prompts, rechnet die Punkte und trägt sie mit begründetem Feedback zurück |
| **Moodle AI Reviewer** · [Quelltext](moodle-ai-reviewer/) | 1.5.7 | **[⬇ ZIP](https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-reviewer.zip)** | **Nachbewerten**: findet frei eingetippte Antworten (Cloze-Lücken, Kurzantwort, Numerisch), die Moodle nicht erkannt hat, und trägt Punkte und Feedback nach |
| **Moodle AI Coach** · [Quelltext](moodle-ai-coach/) | 1.4.0 | **[⬇ ZIP](https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-coach.zip)** | **Kurze Freitextantworten** (2–3 Sätze): liest den Erwartungshorizont aus der Frage, bewertet und gibt Sprachfeedback |
| **Moodle Cloze Autofill** · [Quelltext](moodle-cloze-autofill/) | 2.0.4 | **[⬇ ZIP](https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-cloze-autofill.zip)** | **Fragensammlung pflegen**: trägt neue Antwortvarianten in Cloze-Lücken ein, statt Frage für Frage von Hand |
| **Moodle Notenstufen Autofill** · [Quelltext](notenstufen-extension/) | 2.7.0 | **[⬇ ZIP](https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/notenstufen-extension.zip)** | **Notenstufen-Tabelle** eines Kurses auf einen Klick ausfüllen |

Jeder Ordner hat eine eigene, ausführliche `README.md` — dort stehen Bedienung,
Bewertungsmaßstab, Grenzen und die Änderungsgeschichte.

> **Der Coach ist jung (1.4.0).** Der Bewertungsweg ist einmal vollständig mit
> echten Daten gelaufen, das Zurückschreiben des Erwartungshorizonts in die Frage
> aber noch nicht. Beim ersten Einsatz mit **einer** Frage anfangen.

---

## Installation

Chrome kennt diese Erweiterungen nicht aus dem Web Store — sie werden als
*entpackte Erweiterung* geladen. Das ist in drei Minuten erledigt:

1. In der Tabelle oben auf **⬇ ZIP** der gewünschten Erweiterung klicken und das
   Archiv entpacken. Diese Links zeigen immer auf die **aktuelle Fassung** und ändern
   sich nie — man kann sie also weitergeben und in eigene Anleitungen schreiben.
   (Wer alles auf einmal will: **Code → Download ZIP** oben auf dieser Seite. Wer Git
   benutzt: Repo klonen.)
2. Den entpackten Ordner an einen festen Platz legen und **nicht mehr verschieben**.
   Der Ordnername enthält bewusst keine Versionsnummer — so genügt bei einem Update
   ein Klick auf „↺ neu laden“ statt einer Neuinstallation.
3. In Chrome `chrome://extensions/` öffnen.
4. Oben rechts den **Entwicklermodus** einschalten.
5. **Entpackte Erweiterung laden** anklicken und den Ordner auswählen, in dem
   `manifest.json` direkt liegt (also z. B. `moodle-ai-reviewer`, nicht den
   übergeordneten Ordner).

Mehrere Erweiterungen lassen sich gleichzeitig laden; sie kommen sich nicht in die
Quere. Grader und Reviewer liegen zwar auf derselben Moodle-Seite, zeigen ihr Panel
aber unter verschiedenen Bedingungen und in verschiedenen Farben.

**Update:** denselben ⬇-Link noch einmal aufrufen, den alten Ordnerinhalt ersetzen, in
`chrome://extensions/` auf „↺ neu laden“ klicken. Ob die neue Fassung wirklich aktiv
ist, verrät die Versionsnummer auf der Kachel.

**Direktlinks zum Weitergeben** — sie führen immer zur neuesten Fassung:

```
moodle-ai-grader
https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-grader.zip

moodle-ai-reviewer
https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-reviewer.zip

moodle-ai-coach
https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-ai-coach.zip

moodle-cloze-autofill
https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/moodle-cloze-autofill.zip

notenstufen-extension
https://github.com/arfhh/moodle-chrome-erweiterungen/raw/main/dist/notenstufen-extension.zip
```

---

## Vor dem ersten Einsatz

**Coach und Grader teilen sich die Freitextfragen.** Kommen in einem Test kurze und
lange Freitextaufgaben nebeneinander vor, sagt ein Marker in der ersten Zeile des
Erwartungshorizonts, wer zuständig ist — `[moodle-ai-coach]` oder `[moodle-ai-grader]`.
Der Coach überspringt fremde Fragen, der Grader weist nur darauf hin. Ausführlich steht
das im Abschnitt „Wer ist zuständig" in beiden READMEs.

**Fang mit einer Frage an.** Alle Erweiterungen, die schreiben, haben einen
Trockenlauf oder eine Vorschau. Nutze sie beim ersten Mal — und sieh in Moodle nach,
ob wirklich das drinsteht, was du erwartet hast.

**Wer schreibt, hinterlässt Spuren.** Punkte und Kommentare, die eine Erweiterung
einträgt, sind normale manuelle Bewertungen. Sie lassen sich überschreiben, aber
nicht mit einem Knopfdruck zurücknehmen.

**Geteilte Fragensammlung?** Dann Vorsicht mit *Cloze Autofill* — die Erweiterung
schreibt direkt in die Fragen. Wo eine Sammlung im Kollegium geteilt wird, sollte nur
eine Person eintragen; die anderen sammeln ihre Funde mit dem *Reviewer* als CSV und
schicken sie ihr. Wer eine eigene Sammlung pflegt, kann beide direkt hintereinander
benutzen. Näheres in der README des Autofill.

---

## Bekannte Grenzen

- Alle Erweiterungen erkennen ihre Seite am **Moodle-Pfad**, nicht an der Adresse
  davor. Sie laufen deshalb auf jedem Moodle — auch auf einem, das in einem
  Unterverzeichnis liegt (`https://schule.de/moodle/…`). Eine feste Schuladresse
  steht in keinem Manifest.
- Die Oberflächentexte, nach denen gesucht wird, sind auf **Deutsch** ausgerichtet;
  wo es ging, wird primär über Moodle-Feldnamen und IDs gesucht, die
  sprachunabhängig sind. Auf einer englischsprachigen Oberfläche kann trotzdem eine
  Beschriftung nicht erkannt werden — dann bitte ein Issue mit dem sichtbaren Text.
- Grader, Reviewer und Coach sind an der Moodle-Seite **Manuelle Bewertung**
  entwickelt und an einem Moodle-4-Theme erprobt. Andere Themes ändern das HTML —
  wenn ein Panel nicht erscheint, liegt es fast immer daran.
- Um die hinterlegten richtigen Antworten mitzulesen, braucht man das Recht,
  **Fragen zu bearbeiten**. Fehlt es, arbeiten die Erweiterungen ohne diese Angaben
  weiter, die KI beurteilt dann aber blind.

---

## Versionsnummern

Alle fünf Erweiterungen benutzen dieselbe dreistellige Form **`x.y.z`** — auch
dann, wenn die letzte Stelle 0 ist.

| Stelle | Bedeutet | Beispiel |
|---|---|---|
| **x** | Echte neue Fassung: großer Umbau, geänderter Arbeitsablauf | Grader 2.30 → 3.0.0 |
| **y** | Neue Funktion oder spürbare Erweiterung im bestehenden Ablauf | 1.4.2 → 1.5.0 |
| **z** | Laufende Anpassung: Fehlerbehebung, Feinschliff, Text, Symbol, Doku | 1.5.6 → 1.5.7 |

Maßgeblich ist immer die `version` in der `manifest.json` der jeweiligen
Erweiterung; die Tabelle oben und die READMEs werden danach nachgezogen. Grader,
Reviewer und Coach zeigen ihre Versionsnummer außerdem in der Kopfzeile ihres
Panels — direkt aus dem Manifest gelesen. Nach „↺ neu laden" ist damit ohne
Umweg über `chrome://extensions/` sichtbar, welche Fassung wirklich läuft.

---

## Mitmachen

Fehler, Verbesserungen und Erfahrungen aus anderen Moodle-Installationen sind
willkommen — am liebsten als Issue mit Moodle-Version, Theme und dem, was auf dem
Bildschirm passiert ist (oder eben nicht).

---

## Lizenz und Urheber

**CC BY-SA 4.0** — Weitergabe und Bearbeitung erlaubt, mit Namensnennung, und unter
denselben Bedingungen. Siehe [LICENSE](LICENSE).

Entwickelt von **A. Spielhoff** und **T. Henken** für den eigenen Unterricht.
