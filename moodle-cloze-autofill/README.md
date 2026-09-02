# Moodle Cloze Autofill — Version 2.0.3

Trägt neue Antwortvarianten in die Cloze-Lücken der Moodle-Fragensammlung ein,
statt sie Frage für Frage von Hand nachzupflegen.

Lizenz: **CC BY-SA 4.0** · Entwickler: Arne Spielhoff & T. Henken

> ⚠️ **Nur für die eigene Fragensammlung.** Die Erweiterung schreibt direkt in die
> Fragen der Sammlung, in der sie läuft. Wer eine **eigene** Sammlung pflegt, kann
> *Moodle AI Reviewer* und *Cloze Autofill* unmittelbar hintereinander benutzen.
> Wird die Sammlung im Kollegium **geteilt**, trägt dort nur eine Person ein; alle
> anderen sammeln ihre Funde mit dem Reviewer als CSV und schicken sie ihr.

---

## Installation

1. Auf der GitHub-Seite oben auf **Code → Download ZIP** klicken und das Archiv
   entpacken. Darin liegt der Ordner `moodle-cloze-autofill`. Ihn an einen festen Platz legen und
   nicht mehr verschieben — der Ordnername enthält bewusst **keine** Versionsnummer,
   so genügt bei einem Update ein Klick auf „↺ neu laden" in `chrome://extensions/`.
   (Wer Git benutzt: Repo klonen und den Unterordner `moodle-cloze-autofill` verwenden.)
2. In Chrome `chrome://extensions/` öffnen.
3. Oben rechts **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** → den Ordner `moodle-cloze-autofill` auswählen
   (den Ordner, in dem `manifest.json` direkt liegt).

---

## Wozu

Nach jedem Kurztest landen in `Fehlersammlung.csv` die Schülerantworten, die Moodle
nicht erkannt hat — mit einer bereits festgelegten Bewertung. Bisher hieß das: 26 Fragen
einzeln öffnen, den Cloze-Text suchen, den Begriff an der richtigen Stelle einsetzen,
speichern. Diese Erweiterung macht daraus zwei Knopfdrücke.

Wichtig: Ein **Import** der überarbeiteten XML hilft hier nicht. Moodle legt beim Import
immer *neue* Fragen an und aktualisiert nie bestehende — man bekäme jede Frage doppelt in
den Zufallspool. Der einzige Weg, eine Frage wirklich zu ändern, führt über ihr
Bearbeiten-Formular. Genau das benutzt diese Erweiterung, nur eben automatisch.

---

## Wo sie erscheint

Auf der Kategorieansicht der Fragensammlung:
`…/question/edit.php?cmid=…`

Rechts erscheint ein violetter runder Knopf 🧩. Die anderen Erweiterungen arbeiten auf
anderen Seiten (Grader und Reviewer auf der Manuellen Bewertung, Notenstufen auf der
Notenstufen-Seite), es gibt also keine Überschneidung.

**Sie wird niemals von allein tätig.** Angefasst wird nur, was doppelt zutrifft:
in der angezeigten Kategorie *und* namentlich im eingefügten JSON. Einen Modus
„alle Fragen durchgehen" gibt es bewusst nicht.

---

## Ablauf

### 1 · Liste erzeugen (rein lesend)

Liest zu jeder Lückentext-Frage der Ansicht den Cloze-Quelltext aus dem
Bearbeiten-Formular und zerlegt ihn in seine Lücken. Daraus entsteht ein Prompt,
der je Lücke nur Typ und die bereits hinterlegten Varianten samt Prozentwerten enthält —
**kein HTML, kein Kartendesign, keine Bild-URLs.**

Der Vorteil gegenüber dem Weg über die lokale XML: Du siehst den *wirklichen* Stand in
Moodle. Ob die lokale Datei aktueller oder älter ist, spielt keine Rolle mehr.

Zwei Kopierknöpfe wie beim Reviewer:

* **Prompt + Daten** — für einen beliebigen KI-Chat
* **nur die Daten** — für einen Chat, der die Regeln schon über ein Skill kennt

Voreingestellt werden **nur die angehakten Fragen** gelesen. Nimmt man den Haken weg,
gehen alle Lückentext-Fragen der Ansicht mit.

### 2 · Cloze einfügen

JSON einfügen und auf **Prüfen** drücken. Dabei passiert dreierlei, und noch wird
nichts gespeichert:

1. **Abgleich.** Steht der Begriff schon in der Lücke, wird er übersprungen. Steht er
   dort mit einem *anderen* Prozentwert, wird das als Konflikt gemeldet und nichts
   geändert — solche Fälle entscheidest du selbst.
2. **Selbstprüfung.** Nach dem Einsetzen wird nachgerechnet: gleiche Zahl an Lücken,
   Begriff mit richtigem Prozentwert in der richtigen Lücke, alle anderen Lücken
   Byte für Byte unverändert.
3. **Moodles eigener Prüfer.** Jede geänderte Frage geht durch den Knopf
   „Fragetext entschlüsseln und prüfen". Das ist Moodles eingebaute Cloze-Syntaxprüfung
   und speichert nicht.

Erst danach erscheint der rote Knopf **Jetzt eintragen** — und nur für die Fragen, die
alle drei Stufen überstanden haben.

Nach dem Speichern wird jede Frage noch einmal frisch geladen und nachgesehen, ob die
Begriffe wirklich drinstehen. Das Protokoll sagt es Frage für Frage.

---

## JSON-Format

```json
{
  "erweiterung": "moodle-cloze-autofill",
  "eintraege": [
    {
      "frage": "1.1.1-Riechen",
      "qid": "115405757",
      "luecke": 2,
      "begriff": "fächeln",
      "prozent": 75,
      "grund": "Auslassung der Vorsilbe"
    }
  ]
}
```

* `frage` muss genau dem Fragenamen in Moodle entsprechen.
* `qid` ist freiwillig. Steht sie da, wird geprüft, ob sie zum Namen passt — sonst
  wird der Eintrag übersprungen statt geraten.
* `prozent` mit **Punkt**: `0.01`, nicht `0,01`.

Zum **Ändern** eines vorhandenen Werts dient eine zweite Liste im selben JSON:

```json
{
  "erweiterung": "moodle-cloze-autofill",
  "eintraege": [],
  "aenderungen": [
    {
      "frage": "1.1.1-Glasbruch",
      "qid": "115405789",
      "luecke": 1,
      "begriff": "Handschuhe",
      "von": 10,
      "nach": 0.01,
      "grund": "10 gibt es in der Skala nicht"
    }
  ]
}
```

`von` muss dem Wert entsprechen, der gerade in Moodle steht — sonst wird die Änderung
übersprungen.

Zum **Entfernen** einer Variante — in aller Regel eine Dublette — dient eine dritte Liste:

```json
{
  "entfernen": [
    { "frage": "1.1.4-Pipette", "qid": "115318793", "luecke": 1,
      "begriff": "Pipete", "wert": 75, "grund": "steht doppelt" }
  ]
}
```

Steht der Begriff mehrfach mit demselben Wert, fällt genau einer weg. Gesperrt sind die
mit `=` markierte Hauptantwort und die letzte 100-%-Antwort einer Lücke.

Reihenfolge im Lauf: **Änderungen → Entfernungen → Ergänzungen.**
* Begriffe, die mit `%` oder `=` beginnen, werden abgelehnt. Dafür gibt es in der
  Cloze-Syntax keine saubere Maskierung.

---

## Was die Erweiterung nicht kann

Sie legt keine Lücken an, ändert keine Fragetexte und löscht keine Fragen. Innerhalb
einer Lücke kann sie ergänzen, Werte ändern und Einträge entfernen — mehr nicht.

## Was die Erweiterung nicht anfasst

Geändert wird ausschließlich die Antwortliste innerhalb der einen benannten Lücke.
Alles andere im Fragetext bleibt Byte für Byte stehen: das AFB-Kartendesign, die
Inline-Styles, die Bilder.

Das ist kein Komfort, sondern nötig. Im Bearbeiten-Formular stehen Bilder als
`draftfile.php`-URLs, in der lokalen XML dagegen als `@@PLUGINFILE@@`. Wer den Fragetext
im Ganzen ersetzt, zerschießt die Bildbezüge.

Aus demselben Grund wird **TinyMCE nicht angefasst**. Die Erweiterung liest und schreibt
die versteckte Textarea und baut den POST selbst — der Editor bekommt nie die Gelegenheit,
das Karten-HTML zu normalisieren.

---

## Sicherheitsnetze

| Netz | Was es abfängt |
|---|---|
| Doppelter Filter (Ansicht + JSON) | dass eine nicht gemeinte Frage angefasst wird |
| Konfliktmeldung statt Überschreiben | dass ein vorhandener Prozentwert still geändert wird |
| Selbstprüfung nach dem Einsetzen | Maskierungs- und Positionsfehler |
| Moodles `analyzequestion` | kaputte Cloze-Syntax |
| Gegenprobe nach dem Speichern | dass ein Speichern still gescheitert ist |
| Moodles Fragen-Versionierung | alles andere — die alte Version bleibt erhalten |

Zufallsfragen ziehen immer die neueste Version. Laufende Tests brauchen nach einer
Änderung nichts.

---

## Stand der Erprobung

**Am 28.08.2026 erfolgreich abgeschlossen.** An `1.1.1-Abwaschen-Aufräumen` acht Begriffe
in zwei Lücken eingetragen; danach am neuen Stand nachgelesen: alle acht drin, korrekt
nach Prozentwert einsortiert, beide Bilder und das AFB-Kartendesign unverändert,
weiterhin genau zwei Lücken. Frage von v2 auf v3.

Der Weg dorthin ging über zwei echte Fehler, die beide in den Änderungen zu 1.3 und 1.4
beschrieben sind (Draft-Dateibereich, Fragen-ID der neuen Version).

**Wichtig für jeden weiteren Lauf:** nach dem Eintragen tragen die Fragen neue IDs.
Vor einem zweiten Durchgang Seite neu laden und in Tab 1 eine frische Liste erzeugen.

Die Syntaxprüfung lässt sich nicht absichtlich zum Anschlagen bringen, indem man einen
Begriff mit `{` schickt: die Erweiterung maskiert ihn zu `\{`, und das ist gültige
Cloze-Syntax. Netz 4 bleibt insofern ungetestet; der belastbare Beweis ist die
Versionsnummer und die Gegenprobe nach dem Speichern.

## Dateien

```
moodle-cloze-autofill/
├── manifest.json     Manifest V3 — kanonische Quelle der Versionsnummer
├── content.js        alles: Auslesen, Prompt, Einsetzen, Schreiben, Oberfläche
├── style.css         violettes Panel
├── README.md         diese Datei
└── icons/            icon16/32/48/128.png
```

Testfälle für die reine Logik (56 Prüfungen) liegen unter
`Chrom Erweiterungen/_tests/cloze-autofill/test-cloze-autofill.js`.
Sie schneiden den geprüften Block direkt aus `content.js` heraus, statt ihn zu kopieren —
Aufruf mit `node test-cloze-autofill.js`. Stand: 56 Prüfungen, alle bestanden.

---

## Änderungen

### 2.0.3 — 01.09.2026

* Der Panel-Knopf auf der Moodle-Seite zeigt das echte Symbol statt des Puzzleteils 🧩.
  Fällt auf das Puzzleteil zurück, wenn das Bild nicht geladen werden kann.

### 2.0.2 — 01.09.2026

* **Moodle-Installationen in einem Unterverzeichnis werden unterstützt.** Das
  Bearbeiten-Formular wird jetzt relativ zur erkannten Moodle-Wurzel geladen, nicht
  mehr fest ab der Domainwurzel.
* Seitenfilter im Manifest auf `*://*/*question/edit.php*` erweitert.

### 2.0.1 — 01.09.2026

* Neues Symbol (16/32/48/128 px), einheitlich mit den übrigen Erweiterungen.
* Installationsabschnitt ergänzt, Weitergabe-Hinweis neu gefasst: entscheidend ist
  nicht die Erweiterung, sondern ob die Fragensammlung geteilt wird.
* Die Fehlersammlung heißt seit 30.08.2026 `Fehlersammlung.csv`, nicht mehr `.xlsx`.

### 2.0 — 28.08.2026

* **Dritte Liste `entfernen`.** Damit ist der Satz vollständig: ergänzen, ändern,
  entfernen. Anlass sind Dubletten — steht ein Begriff zweimal in einer Lücke, ist der
  niedrigere Eintrag wirkungslos, weil Moodle den besten Treffer nimmt. Bis 1.9 ließ
  sich das nur von Hand bereinigen.
  Absicherungen: der Eintrag wird über Begriff **und** Wert gefunden; bei mehreren
  gleichen fällt der letzte weg und der erste bleibt; die mit `=` markierte
  Hauptantwort und die letzte 100-%-Antwort einer Lücke sind gesperrt, weil eine Lücke
  ohne richtige Antwort die Frage kaputtmacht. In der Vorschau stehen Entfernungen rot
  mit `−`.
* **Knopf „Protokoll kopieren".** Das Protokoll ist der einzige Beleg dafür, was
  wirklich durchgegangen ist, und wird nach jedem Lauf gebraucht — jetzt ein Klick statt
  Markieren im schmalen Kasten. Kopf mit Version, Kategorie und Zeitpunkt inklusive.
* Der Prompt dokumentiert die neue Liste und fragt Dubletten aktiv ab.

### 1.9 — 28.08.2026

* **Der Prompt kennt jetzt die lokale XML als dritte Quelle.** Neue Regel 4: vor jeder
  eigenen Einschätzung in der lokalen Datei der Kategorie nachsehen — Arnes
  Entscheidungen stehen dort oft schon, und die lokale Datei ist häufig *voraus*, nicht
  hinterher. Abweichungen zwischen lokal und live sind zu melden, nicht stillschweigend
  aufzulösen. Anlass: am 28.08. wurden sieben Skala-Werte hergeleitet, die in der
  lokalen Datei längst festgelegt waren; einer davon geriet falsch nach Moodle.
* **Der Prompt dokumentiert jetzt auch die Liste `aenderungen`** samt Beispiel. Bis 1.8
  stand sie nur in dieser README — die KI konnte also gar nicht wissen, dass sie
  Wertänderungen vorschlagen darf.
* Der Prompt bittet außerdem, mehrfach vorkommende Begriffe in einer Lücke zu melden
  (der niedrigere Eintrag ist wirkungslos).

### 1.8 — 28.08.2026

* **Die Seite lädt sich nach einem Lauf selbst neu** (8 Sekunden Bedenkzeit, mit
  Ausstieg). Das Protokoll wird vorher gesichert und danach wieder eingeblendet.
  Grund: nach einem Lauf zeigen alle Links der Seite noch auf die **alten**
  Fragen-Versionen. Wer von dort eine Frage öffnet und speichert, veröffentlicht den
  alten Inhalt als neue Version und macht die Änderung damit rückgängig — am
  28.08.2026 genau so passiert.

### 1.7 — 28.08.2026

* **Vorhandene Prozentwerte lassen sich jetzt ändern**, über eine eigene Liste
  `aenderungen` im JSON. Bis dahin konnte die Erweiterung nur ergänzen; für das
  Vereinheitlichen der Skala (Werte wie 10 oder 5, die es in der 6-Stufen-Skala nicht
  gibt) und für Umstufungen fehlte der Weg.
  Absicherung: jede Änderung nennt den **bisherigen** Wert (`von`). Stimmt der nicht
  mit dem überein, was gerade in Moodle steht, wird übersprungen statt überschrieben —
  eine veraltete Liste kann so keine frischere Bewertung zerstören. Die Zahl der
  Varianten muss nach der Änderung gleich bleiben, sonst greift die Selbstprüfung.
  In der Vorschau stehen Änderungen orange (`~`) über den grünen Ergänzungen (`+`).

### 1.6 — 28.08.2026

* „Nur die angehakten Fragen" ist jetzt **voreingestellt**. Haken weg = alle Fragen der
  Ansicht. So ist der eingeschränkte Fall der Normalfall und der weite die bewusste
  Entscheidung.

### 1.5 — 28.08.2026

* Panel auf **Gelb** umgestellt (vorher Violett) — auf Wunsch, zur besseren
  Unterscheidung von den anderen Erweiterungen. Auf allen gelben Flächen steht
  dunkle Schrift; der Panel-Hintergrund ist nur leicht getönt, damit das Protokoll
  lesbar bleibt. Der rote „Eintragen"-Knopf bleibt rot.

### 1.4 — 28.08.2026

* **Gegenprobe nimmt jetzt die neue Fragen-Version.** Moodle legt beim Speichern eine
  neue Version mit **neuer Fragen-ID** an; die alte ID zeigt weiter auf den alten Stand.
  1.3 hat die alte ID nachgeladen und deshalb „gespeichert, aber Begriffe stehen nicht
  drin" gemeldet, obwohl alles geklappt hatte. Die neue ID kommt aus dem
  `lastchanged`-Parameter der Weiterleitung, ersatzweise über den Fragenamen aus der
  zurückgelieferten Fragensammlung.
* Nach einem Lauf verschwindet der rote Knopf, mit dem Hinweis, für einen weiteren
  Durchgang eine frische Liste zu erzeugen: **die Fragen tragen danach neue IDs**,
  ein zweiter Lauf mit demselben JSON würde an der qid-Prüfung scheitern.

### 1.3 — 28.08.2026

* **Der Fragetext wird jetzt im Moment des Absendens gebaut, nicht vorher.**
  Bis 1.2 wurde der neue Text beim Prüfen erzeugt und beim Speichern wiederverwendet.
  Moodle legt aber bei *jedem* Aufruf des Bearbeiten-Formulars einen neuen
  Draft-Dateibereich an und schreibt dessen Nummer in die `draftfile.php`-URLs der
  Bilder im Fragetext. Der mitgeschleppte Text zeigte damit auf einen alten Bereich —
  Moodle suchte die Bilder dort vergeblich und antwortete mit
  **HTTP 404 „Unbekannter Fehler mit lokalen Dateien (File does not exist)"**.
  `sendeFormular()` bekommt deshalb jetzt die Einsetzungen übergeben, nicht den
  fertigen Text, und baut ihn aus dem frisch geladenen Formular.
* Ein Fehlerstatus wird nicht mehr als Erfolg durchgewunken. 1.2 meldete nach dem
  404 „gespeichert, aber Begriffe stehen nicht drin" — irreführend, es war gar nichts
  gespeichert worden. Jetzt: „nicht gespeichert — HTTP 404".
* Begriffe, die zwischen Prüfen und Speichern von jemandem anders eingetragen wurden,
  werden übersprungen und protokolliert statt doppelt gesetzt.

### 1.2 — 28.08.2026

* **Versionsnummer steht jetzt im Panel-Kopf**, gelesen aus dem geladenen Manifest.
  Ohne sie ließ sich nach einem Neuladen nicht erkennen, welcher Code wirklich läuft —
  und das ist die Standardprobe.

### 1.1 — 28.08.2026

* **Protokoll sagt jetzt, was Moodle geantwortet hat.** Zu jedem Prüf- und
  Speichervorgang steht eine Zeile mit HTTP-Status, Seitentitel, etwaiger
  Moodle-Meldung und der Ziel-URL im Log. Anlass: beim ersten Testlauf wurde nichts
  gespeichert, und das alte Protokoll sagte nicht, woran es lag.
* Kam beim Prüfen kein Formular zurück, blockiert das nicht mehr den ganzen Lauf.
  Die Frage gilt als „unklar geprüft"; mit einem ausdrücklichen Häkchen lässt sie sich
  trotzdem eintragen. Die Gegenprobe nach dem Speichern läuft unverändert weiter und
  bleibt der eigentliche Beweis.

### 1.0 — 28.08.2026

* Erste Fassung.
* Knopf 1 „Liste erzeugen": liest die Lücken der angezeigten Lückentext-Fragen aus
  Moodle und baut daraus einen Prompt (mit Prompt-Override in den Einstellungen).
* Knopf 2 „Cloze einfügen": Abgleich, Selbstprüfung, Moodle-Syntaxprüfung, dann
  Eintragen mit Gegenprobe.
* Bewusst kein Modus, der ohne Liste alle Fragen durchgeht.
* Wird nicht exportiert.

---

*Moodle Cloze Autofill 2.0.3 — CC BY-SA 4.0*
