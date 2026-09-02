# Moodle AI Grader – Browser-Erweiterung für Chrome

**KI-gestützte Bewertung von Schülerantworten direkt in Moodle**

Entwickelt von T. Henken & A. Spielhoff · Lizenz: CC BY-SA 4.0 · Version 2.30

---

## Was macht diese Erweiterung?

Der Moodle AI Grader ist eine Chrome-Erweiterung, die Lehrkräfte bei der Bewertung von Freitextantworten in Moodle unterstützt. Das Plugin führt **keine eigene KI-Inferenz** durch – es erzeugt strukturierte Prompts, die du in eine externe KI (z. B. ChatGPT, Claude) einfügst, und trägt die zurückgegebenen JSON-Bewertungen automatisch in Moodle ein.

Der Workflow läuft in zwei Stufen:

**Stufe 1 – Bewertungshorizont erstellen**
Die Erweiterung liest alle Aufgaben und Maximalpunkte aus Moodle aus und generiert einen Prompt für die KI. Die KI führt dich Schritt für Schritt durch die Erstellung eines vollständigen Bewertungshorizonts mit Punkteverteilung, Operatorenzuordnung und AFB-Einstufung und erzeugt daraus am Ende einen fertigen Korrektur-Prompt.

**Stufe 2 – Schülerantworten bewerten**
Der fertige Bewertungshorizont wird zusammen mit den Schülerantworten – aufgeteilt in Batches – an die KI übergeben. Die KI bewertet jeden Schülertext und gibt Punkte sowie individuelles Feedback als JSON zurück. Die Erweiterung prüft, validiert und trägt alles in Moodle ein.

---

## Voraussetzungen

- Google Chrome (Version 100 oder neuer)
- Zugang zu einer Moodle-Instanz mit Lehrkraft-Rechten
- Ein Account bei einer KI deiner Wahl (ChatGPT, Claude, Perplexity o. ä.)

---

## Installation

Die Erweiterung wird direkt aus einem Ordner auf deinem Computer geladen – kein Chrome Web Store nötig.

### Schritt 1 – ZIP entpacken

Entpacke die Datei `moodle-ai-grader-V2.29.zip` (Doppelklick). Es entsteht ein
Ordner `moodle-ai-grader` mit dieser Struktur:

```
moodle-ai-grader/
├── manifest.json
├── background.js
├── content.js
├── style.css
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

Lege den Ordner an einen festen Platz, den du nicht mehr verschiebst
(z. B. `Dokumente/moodle-ai-grader`). Die Versionsnummer steht bewusst **nicht**
im Ordnernamen: Bei einem Update genügt so ein Klick auf „↺ neu laden" in
`chrome://extensions/`, statt die Erweiterung erneut hinzuzufügen.

### Schritt 2 – Erweiterung in Chrome laden

1. Öffne Chrome und gib in die Adressleiste ein: `chrome://extensions/`
2. Aktiviere oben rechts den Schalter **Entwicklermodus**
3. Klicke auf **Entpackte Erweiterung laden**
4. Wähle den Ordner `moodle-ai-grader` aus
5. Die Erweiterung erscheint in der Liste ✅

> Verschiebe oder benenne den Ordner nach der Installation nicht um. Chrome lädt die Erweiterung immer aus diesem Ordner.

---

## Einstellungen konfigurieren ⚙️

Bevor du mit der Bewertung beginnst, trage deine Kursparameter ein. Klicke dazu auf das **Zahnrad-Symbol** im Panel-Header.

| Einstellung | Beschreibung |
|---|---|
| Fach | z. B. Chemie, Deutsch, Geschichte |
| Jahrgang / Klassenstufe | Bestimmt die Anrede im Feedback (bis Klasse 10: „Du hast …", ab Klasse 11: „Sie haben …"). Eine Live-Vorschau zeigt die gewählte Anrede an. |
| Kursniveau | G = Gymnasial, M = Mittel, E = Einfach |
| Punkteschritte | 0,1 / 0,5 / 1,0 |
| Rechtschreibgewichtung | 0–30 % in 5 %-Schritten (Anteil der **Gesamtpunktzahl**, nicht je Aufgabe) |
| Feedbacklänge | Kurz / Mittel / Ausführlich / Umfangreich |
| Quellenangaben entfernen | Entfernt automatisch KI-Quellenangaben wie `[web:1]` aus dem Feedback |
| KI-Kommentar einfügen | Hängt einen Transparenzhinweis ans Feedback an (siehe unten) |

Die Einstellungen werden dauerhaft gespeichert und beim nächsten Start automatisch geladen.

> **Hinweis zum Prompt-Editor:** Wenn du die Einstellungen speicherst, werden eventuell vorhandene **eigene Prompt-Anpassungen zurückgesetzt**, damit die geänderten Parameter sicher in den Prompt übernommen werden. Passe den Prompt also erst nach den Grundeinstellungen an.

### KI-Transparenzhinweis

Ist die Option **„KI-Kommentar einfügen"** aktiv, ergänzt das Plugin jedes eingetragene Feedback automatisch um folgenden Hinweis (kursiv, kleine Schrift):

> *Dieses Feedback wurde von der Lehrkraft mithilfe von KI-Unterstützung erstellt und geprüft.*

---

## Workflow: Erste Bewertung Schritt für Schritt

### Panel öffnen

Navigiere in Moodle zur manuellen Bewertungsseite einer Freitextaufgabe (Quiz → Ergebnisse → Manuelle Bewertung). Das Plugin-Icon (🪄) erscheint automatisch oben rechts, sobald die Erweiterung eine Bewertungsseite erkennt. Klicke darauf, um das Panel zu öffnen.

> Das Panel erscheint nur auf Seiten mit Freitext- oder Kurzantwort-Bewertungsfeldern. Bei reinen Multiple-Choice-Seiten bleibt es unsichtbar.

> **Tipp – Pagination:** Moodle zeigt standardmäßig nur 20–30 Schüler pro Seite. Stelle „Fragen pro Seite" möglichst auf „Alle", damit alle Antworten erfasst werden. Das Batch-System hilft zusätzlich, große Gruppen aufzuteilen.

---

### Tab 1 – Bewertungshorizont 📋

**Schritt 1 – Prompt für Bewertungshorizont kopieren**

Klicke auf **„Prompt für Bewertungshorizont kopieren"**. Die Erweiterung liest alle Aufgaben und Maximalpunkte aus Moodle aus und kopiert einen vollständigen Prompt in deine Zwischenablage. Mit dem ✏️-Button daneben kannst du den Prompt-Text vorher anpassen.

Öffne nun die KI deiner Wahl und füge den Prompt mit Strg+V ein. Die KI begrüßt dich, zeigt die übernommenen Einstellungen zur Bestätigung und führt dich durch den Prozess:

- Bestätige die Parameter mit **JA** oder passe einzelne Punkte an
- Die KI erstellt den Bewertungshorizont **Aufgabe für Aufgabe einzeln** – mit Punkteverteilung, Operator und AFB-Zuordnung
- Passe jede Aufgabe an, bis sie passt, und bestätige
- Am Ende generiert die KI einen fertigen Korrektur-Prompt als **Markdown-Codeblock**

**Schritt 2 – Bewertungshorizont einfügen**

Kopiere den fertigen Korrektur-Prompt (den Markdown-Codeblock) aus dem KI-Chat und füge ihn in das Textfeld unter Schritt 2 ein. Der Text bleibt über Seitenwechsel hinweg gespeichert. Mit dem 🗑️-Button kannst du das Feld bei Bedarf leeren.

**Schritt 3 – Weiter zur Korrektur**

Klicke auf **„→ Zum Korrektur-Tab"**. Ist das Textfeld leer, erscheint eine Sicherheitsabfrage.

---

### Tab 2 – Korrektur ✅

**Schritt 4 – Batch-Größe wählen**

Das Plugin teilt die Schülerantworten in Batches auf, damit das KI-Kontextfenster nicht überläuft. Die empfohlene Batch-Größe wird automatisch je nach Feedbacklänge vorgeschlagen:

| Feedbacklänge | Schüler/Batch |
|---|---|
| Kurz | 30 |
| Mittel | 15 |
| Ausführlich | 10 |
| Umfangreich | 6 |

Du kannst die Größe jederzeit über das Dropdown ändern. Mit **„📋 Rohdaten"** kopierst du die reinen Daten (Aufgaben + Schülerantworten) als JSON ohne Prompt.

**Schritt 5 – Batches kopieren & in KI einfügen**

Für jeden Batch erscheint ein eigener Button, z. B. **„Batch 1 kopieren (Schüler 1–10)"**. Der Ablauf:

1. Klicke auf **Batch 1 kopieren** und füge den Prompt in einen neuen KI-Chat ein
2. Die KI fragt zunächst, ob du jede Bewertung einzeln prüfen möchtest, und gibt dann das JSON aus – umrahmt von Markierungen wie `=== BATCH 1 ===` … `=== ENDE BATCH 1 ===`
3. Kopiere die KI-Antwort in das Feld unter Schritt 6
4. Kopiere den nächsten Batch und wiederhole

Mit **„✏️ Prompt anpassen"** kannst du den Korrektur-Prompt vor dem Kopieren bearbeiten.

**Schritt 6 – Alle JSON-Antworten einfügen**

Füge alle KI-Antworten nacheinander in das große Textfeld ein. Die Batch-Markierungen helfen dem Plugin, die einzelnen Blöcke zu erkennen. Klicke dann auf **„🔍 Validieren & prüfen"**. Das Plugin prüft:

- **Vollständigkeit** – sind alle Schüler-IDs von 0 bis N vorhanden?
- **Lücken** – fehlende IDs werden namentlich gemeldet (z. B. fehlt noch ein Batch)
- **Duplikate** – doppelt vergebene IDs werden angezeigt

Erst nach erfolgreicher Validierung werden die Buttons in Schritt 7 freigeschaltet.

**Schritt 7 – Bewertungen eintragen**

Du hast zwei Möglichkeiten:

| Option | Wann sinnvoll? |
|---|---|
| **Review starten** | Du möchtest jede Bewertung einzeln prüfen (empfohlen) |
| **Alle eintragen** | Du vertraust der KI-Bewertung und willst schnell sein |

Im **Review-Modus** siehst du für jeden Schüler:

- die Schülerantwort im Original,
- die KI-Begründung mit Punkteaufschlüsselung je Aufgabe (nur für dich sichtbar),
- die vorgeschlagenen Punkte (bearbeitbar),
- das Feedback an den Schüler (bearbeitbar).

Klicke auf **„✅ Eintragen & Weiter"** oder **„Überspringen"**, um zur nächsten Antwort zu gelangen.

> **Sicherheitswarnung:** Hat die KI die Bewertungen **ohne** interaktive Prüfung erstellt (`reviewed: false`), erscheint bei „Alle eintragen" eine Warnung. Du kannst dann den Review starten, trotzdem eintragen oder abbrechen. KI-Bewertungen können Fehler enthalten – prüfe sie im Zweifel.

Nach dem Eintragen aller Bewertungen klickst du in Moodle wie gewohnt auf **„Änderungen speichern"**.

---

## Prompt-Texte anpassen ✏️

Beide Prompts (Bewertungshorizont und Korrektur) lassen sich direkt im Panel bearbeiten. Klicke dazu auf den ✏️-Button neben dem jeweiligen Bereich.

- Der vollständige Prompt-Text ist lesbar und bearbeitbar
- Ein oranger Hinweis erscheint, wenn der Prompt vom Original abweicht
- Mit **„↺ Original"** stellst du den Original-Prompt wieder her
- Änderungen werden dauerhaft gespeichert

Die Platzhalter `[MOODLE_AUFGABEN_DATEN]` und `[MOODLE_SCHÜLER_DATEN]` werden beim Kopieren automatisch mit den echten Daten aus Moodle befüllt.

> Beachte: Beim Speichern der **Grundeinstellungen** werden eigene Prompt-Anpassungen zurückgesetzt, damit Parameteränderungen wirksam werden.

---

## Feedbacklängen im Überblick

| Länge | Struktur |
|---|---|
| **Kurz** | Eine Zeile je Aufgabe mit Symbol (✓ ✗ ⚠) + Endpunktzahl |
| **Mittel** | 2–3 Sätze je Aufgabe + Punkte + kurze Rechtschreibanmerkung |
| **Ausführlich** | Positive Aspekte → Aufgaben (mit Punkten) → Rechtschreibung & Grammatik → Zusammenfassung → Endpunktzahl |
| **Umfangreich** | Wie Ausführlich, zusätzlich Kriterienanalyse, Formulierungsbeispiele und Stilanalyse (Oberstufe) |

Der **Rechtschreibabzug** wird je Aufgabe nur angezeigt, wenn er größer als 0 ist. Der maximale Abzug bezieht sich immer auf die **Gesamtpunktzahl**, nicht auf einzelne Aufgaben.

---

## Wer ist zuständig — Coach oder Grader?

Schreibst du einen Test, in dem **kurze** Freitextfragen (zwei, drei Sätze) und
**längere** Freitextaufgaben nebeneinander vorkommen — womöglich noch als
Zufallsfragen aus einem Pool —, dann stehen zwei Erweiterungen vor derselben Frage.
Der Coach arbeitet die Übersichtsseite ab und würde ohne Kennzeichnung **alle**
Freitextfragen bewerten, auch die, die dem Grader gehören.

Geklärt wird das in der Frage selbst. Die **erste Zeile des Erwartungshorizonts**
(Moodle-Feld *Information für Bewerter/innen*, technisch `graderinfo`) trägt einen
Marker:

```
[moodle-ai-coach]
Erwartungshorizont
Kernaussage: …
```

Warum dort und nicht als Auswahl in der Erweiterung: Der Marker steht **in der Frage**.
Er wird einmal beim Bauen gesetzt und wirkt danach in jedem Test, bei jedem Kollegen,
auch wenn die Frage aus einem Zufallspool gezogen wird. Eine Auswahlliste müsstest du
bei jedem Durchlauf neu setzen — und bei Zufallsfragen weißt du vorher gar nicht,
welche Fragen kommen. Kosten entstehen keine: Beide Erweiterungen lesen den
Erwartungshorizont ohnehin, der Marker fährt einfach mit.

Erkannt wird die Zeile großzügig — mit und ohne eckige Klammern, mit Leer- statt
Bindestrich, und mit weiterem Text dahinter. Im Prompt an die KI taucht der Marker
nicht auf; er wird vorher herausgenommen.

| Erwartungshorizont | Coach | Grader |
|---|---|---|
| `[moodle-ai-coach]` … | bewertet | weist darauf hin, bewertet auf Wunsch trotzdem |
| `[moodle-ai-grader]` … | überspringt | bestätigt kurz |
| Horizont da, kein Marker | bewertet **und meldet es** | sagt nichts |
| leer | bewertet nicht | rät, erst einen Horizont anzulegen |

**Wenn der Horizont leer ist**, ist die Reihenfolge: erst im Grader (Tab 1) den
Bewertungshorizont erzeugen und in die Frage eintragen — dabei wird der Marker
automatisch gesetzt —, danach lässt der Coach die Frage in Ruhe.

**Bestandsfragen** haben den Marker noch nicht. Deshalb bewertet der Coach eine Frage
mit Horizont, aber ohne Marker vorerst mit und listet sie danach auf; ein Knopf trägt
den Marker in einem Rutsch nach. Ist dein Bestand durch, setzt du in den Einstellungen
das Häkchen **„Nur Fragen bewerten, die [moodle-ai-coach] tragen"** — dann ist jede
unmarkierte Frage tabu.

## Datenschutz & Sicherheit

- Die Erweiterung sendet keine Daten an externe Server. Alle Verarbeitung läuft lokal im Browser.
- Schülerantworten werden nur dann in die Zwischenablage kopiert, wenn du aktiv auf einen Kopieren-Button klickst.
- **Namen werden automatisch anonymisiert** (erkannte Anreden wie „Hallo Maria" werden durch `[ANONYMISIERT]` ersetzt), bevor sie in einen Prompt gelangen. Diese Anonymisierung ist immer aktiv und nicht abschaltbar.
- Auf Wunsch hängt das Plugin einen Transparenzhinweis ans Feedback an (Option „KI-Kommentar einfügen").
- Welche Daten du an eine KI sendest, liegt in deiner Verantwortung. Beachte die Datenschutzrichtlinien deiner Schule sowie die Nutzungsbedingungen des jeweiligen KI-Dienstes.

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| Plugin-Icon erscheint nicht | Seite mit Strg+Shift+R neu laden; Erweiterung in `chrome://extensions/` neu laden (↺) |
| „Antwort nicht extrahierbar" | Prüfe, ob du auf der richtigen Moodle-Bewertungsseite bist (Manuelle Bewertung, nicht Übersicht) |
| Punkte werden eingetragen, Feedback aber nicht | Warte, bis die Seite vollständig geladen ist, bevor du einträgst (TinyMCE muss bereit sein) |
| „Ungültiges JSON" | Kopiere den gesamten Codeblock aus der KI – inklusive der ` ```json ` und ` ``` ` Zeilen |
| „Fehlende IDs" bei der Validierung | Es fehlt ein Batch – füge die fehlende KI-Antwort ins JSON-Feld ein und validiere erneut |
| „Doppelte IDs" bei der Validierung | Eine Antwort wurde doppelt eingefügt – entferne das Duplikat |
| KI-Kontextfenster läuft über | Batch-Größe in Schritt 4 reduzieren (besonders bei „Umfangreich") |
| Erweiterung nach Chrome-Update weg | Chrome deaktiviert entpackte Erweiterungen manchmal nach Updates → in `chrome://extensions/` erneut aktivieren |
| Icon-Dateien fehlen | Prüfe, ob der `icons/`-Unterordner mit allen 4 PNG-Dateien im Erweiterungsordner liegt |

---

## Dateiübersicht

| Datei | Beschreibung |
|---|---|
| `manifest.json` | Konfigurationsdatei der Erweiterung (Version, Berechtigungen, Icons) |
| `background.js` | Hintergrunddienst (Service Worker), der Feedback über TinyMCE in Moodle einträgt |
| `content.js` | Hauptlogik: UI, Extraktion, Prompt-Generierung, Batch-System, Validierung, Eintragen |
| `style.css` | Styling des Panels, der Tabs, Buttons und Dialoge |
| `icons/` | Plugin-Icons in den Größen 16, 32, 48 und 128 px |

---

*Moodle AI Grader – Version 2.30 · Entwickelt von T. Henken & A. Spielhoff · CC BY-SA 4.0*
