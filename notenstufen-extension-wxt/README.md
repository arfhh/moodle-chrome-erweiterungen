# Moodle Notenstufen Autofill

*Version 2.7.0 · Entwickelt von A. Spielhoff · Lizenz: CC BY-SA 4.0*

Eine kleine Browser-Erweiterung, die die Notenstufen-Tabelle eines
Moodle-Kurses automatisch ausfüllt, statt sie Zeile für Zeile per
Hand einzutragen. Sie läuft in **jedem Moodle**, unabhängig davon,
unter welcher Adresse es erreichbar ist — und seit dieser Fassung in
**Chrome, Firefox und Edge** aus derselben Codebasis (siehe
„WXT-Umstellung" unten).


## Installation

Die Erweiterung liegt entpackt in drei Browser-Ordnern vor:
`notenstufen-autofill-chrom`, `notenstufen-autofill-firefox`,
`notenstufen-autofill-edge`. Den zum eigenen Browser passenden Ordner
verwenden.

**Chrome / Edge:**
1. `chrome://extensions` bzw. `edge://extensions` öffnen.
2. Oben rechts den **Entwicklermodus** aktivieren.
3. Auf **„Entpackte Erweiterung laden"** klicken und genau den Ordner
   `notenstufen-autofill-chrom` (bzw. `-edge`) auswählen — den Ordner, in
   dem die Manifest-Datei direkt drinliegt.
4. Fertig. Bei einem Update genügt „↺ neu laden" an derselben Stelle,
   solange der Ordner am selben Platz bleibt (Chrome leitet die
   Erweiterungs-ID aus dem Pfad ab — ein verschobener oder umbenannter
   Ordner heißt neue ID und damit leere, neu einzustellende Notenskala).

**Firefox:**
1. `about:debugging#/runtime/this-firefox` öffnen.
2. **„Temporäres Add-on laden…"** klicken und eine beliebige Datei im
   Ordner `notenstufen-autofill-firefox` auswählen (z. B. `manifest.json`).
3. Diese temporäre Installation gilt bis zum nächsten Firefox-Neustart.
   Für eine dauerhafte Installation braucht Firefox eine Signierung durch
   Mozilla oder den Entwicklermodus.

Die Erweiterung braucht keine besonderen Rechte.


## Benutzung

1. In Moodle zu einem Kurs → **Bewertungen → Notenstufen** navigieren.
2. Egal ob man auf der Übersichtsseite oder schon auf der
   „Notenstufen bearbeiten"-Seite landet: Oben rechts erscheint ein
   grüner Button.
   - Auf der Übersichtsseite heißt er
     **„⚡ Bearbeiten & Notenstufen ausfüllen"** – ein Klick genügt,
     die Erweiterung klickt selbst auf „Bearbeiten" und macht danach
     automatisch weiter.
   - Auf der Bearbeiten-Seite selbst heißt er
     **„⚡ Notenstufen automatisch ausfüllen"**.
3. Die Erweiterung setzt automatisch den Haken bei
   „Voreinstellungen überschreiben", legt bei Bedarf zusätzliche
   Zeilen an (falls das Formular anfangs zu wenige hat) und trägt
   alle Noten samt Prozentgrenzen ein.
4. Kurz prüfen, dann ganz normal auf **„Änderungen speichern"**
   klicken.
5. Bei jedem weiteren Kurs denselben Ablauf wiederholen.


## Eigene Notenskala einstellen

Neben dem grünen Button sitzt ein kleines **Zahnrad (⚙️)**. Ein Klick
öffnet die Einstellungsseite in einem neuen Tab. Dieselbe Oberfläche
öffnet sich auch über das Symbol der Erweiterung in der Symbolleiste
(Toolbar-Icon).

Dort lassen sich:

- alle Buchstaben/Noten und Prozentgrenzen einzeln bearbeiten,
- per Klick auf **„Gymnasium-Standard"** oder
  **„Stadtteilschule-Standard"** eine der beiden vorgegebenen Skalen
  laden (wird sofort gespeichert),
- mit **„Speichern"** eigene, manuell angepasste Werte sichern,
- mit **„Schließen"** der Tab wieder geschlossen werden.

Die gespeicherten Werte gelten **nur für den eigenen Browser**
(lokal über `browser.storage.local`). Installiert eine Kollegin oder
ein Kollege dieselbe Erweiterung bei sich, hat sie/er eine eigene,
unabhängige Einstellung – niemand überschreibt die Werte einer
anderen Person.


## Hinterlegte Standard-Notenskalen

**Gymnasium** (16 Stufen):
1+ ≥98 %, 1 ≥95 %, 1- ≥90,5 %, 2+ ≥86 %, 2 ≥81,5 %, 2- ≥77 %,
3+ ≥72,5 %, 3 ≥68 %, 3- ≥63,5 %, 4+ ≥59 %, 4 ≥54,5 %, 4- ≥50 %,
5+ ≥40 %, 5 ≥30 %, 5- ≥20 %, 6 ≥0 %

**Stadtteilschule** (25 Stufen):
E1+ ≥97 %, E1 ≥94 %, E1- ≥91 %, E2+ ≥86 %, E2 ≥81 %, E2- ≥77 %,
E3+ ≥73 %, E3 ≥68 %, E3- ≥64 %, E4+ ≥59 %, E4 ≥55 %, E4- ≥50 %,
G2+ ≥46 %, G2 ≥42 %, G2- ≥38 %, G3+ ≥34 %, G3 ≥30 %, G3- ≥27 %,
G4+ ≥24 %, G4 ≥21 %, G4- ≥19 %, G5+ ≥16 %, G5 ≥13 %, G5- ≥10 %,
G6 ≥0 %


## Technische Hinweise

- Wirkt nur auf Moodle-Seiten, deren Pfad `…/grade/edit/letter/…`
  enthält — die Adresse davor ist beliebig, ein Moodle in einem
  Unterverzeichnis (`https://schule.de/moodle/…`) eingeschlossen.
  Zusätzlich prüft die Erweiterung, ob die Seite wirklich die
  Notenstufen-Tabelle oder den „Bearbeiten"-Knopf zeigt; sonst
  erscheint gar kein Knopf.
- Die Bedienelemente werden sprachunabhängig gesucht: primär über
  die Moodle-Feldnamen und die Formular-ID `id_override`, erst
  danach über die Beschriftung (deutsch **und** englisch).
- Speichert keine Daten außerhalb des eigenen Browsers, sendet
  nichts ins Internet.
- Erkennt Formularzeilen primär über die Moodle-Feldnamen
  `gradeletter[N]` / `gradeboundary[N]`. Nur wenn die fehlen, greift
  ersatzweise die Erkennung über die Legende „Note X".
- „X Feld(er) zum Formular hinzufügen" ist in Moodle ein echter
  Submit-Button: jeder Klick lädt die Seite neu. Die Erweiterung
  merkt sich das über `localStorage` und setzt den Vorgang auf der
  neu geladenen Seite selbst fort – auch über mehrere Runden hinweg.
- Hat der Kurs mehr Zeilen als die eingestellte Skala, werden die
  überzähligen Zeilen geleert. Sonst würden deren alte Werte beim
  Speichern mit übernommen, weil „Voreinstellungen überschreiben"
  gesetzt ist.


## Dateien in diesem Ordner

| Datei/Ordner              | Zweck                                              |
|----------------------------|----------------------------------------------------|
| `wxt.config.ts`            | Manifest-Angaben (Name, Version, Berechtigungen)   |
| `entrypoints/content.ts`   | Meldet `matches` an, ruft den Kern auf             |
| `lib/notenstufen-core.js`  | Füllt das Formular auf der Moodle-Seite aus        |
| `entrypoints/background.ts`| Öffnet die Einstellungsseite über das Zahnrad      |
| `entrypoints/popup/`       | Einstellungsseite über das Toolbar-Icon            |
| `entrypoints/options/`     | dieselbe Einstellungsseite über das Zahnrad         |
| `lib/notenstufen-ui.js`    | gemeinsame Tabellen-/Speicherlogik für Popup+Options |
| `scripts/paketieren.sh`    | baut alle drei Browser und packt `dist/notenstufen-autofill.zip` |


## WXT-Umstellung (17.09.2026)

Ab dieser Fassung wird die Erweiterung mit **WXT** gebaut (siehe Skill
`1-browser-wxt`) — eine Codebasis, drei Browser (Chrome, Firefox, Edge).
Der fachliche Kern liegt in `lib/notenstufen-core.js` und ist zeilengleich
mit der bewährten `content.js` bis 2.7.0; einzige Änderungen:
`chrome.*` -> `browser.*` (Polyfill), Top-Level-Code -> `export function
starteNotenstufen()`. Die Einstellungsseite (`popup.js`) ist entsprechend
nach `lib/notenstufen-ui.js` gewandert und wird jetzt sowohl vom
Toolbar-Popup als auch von der Options-Seite verwendet.

Befehle: `npm run dev` (Chrome-Testlauf), `npm run build-all` (alle drei
Browser), `npm run paket` (baut, benennt um, packt zu
`dist/notenstufen-autofill.zip`). Details in `1-browser-wxt`.

## Änderungen

**2.7**

- **Läuft jetzt auf jedem Moodle.** Die feste Adresse
  `https://lms.lernen.hamburg/` ist aus dem Manifest verschwunden; maßgeblich ist
  nur noch der Moodle-Pfad `…/grade/edit/letter/…`. Damit funktioniert die
  Erweiterung auch in Bayern, an Hochschulen und bei einem Moodle in einem
  Unterverzeichnis.
- Als Gegengewicht dazu erscheint der Knopf nur noch, wenn die Seite auch
  wirklich die Notenstufen-Tabelle oder den „Bearbeiten"-Knopf enthält.
- „Bearbeiten"-Knopf und Überschreiben-Häkchen werden zusätzlich auf
  englischsprachigen Oberflächen erkannt; gibt es im Formular nur einen Knopf,
  wird dieser genommen, egal wie er heißt.

**2.6**

- **Erstmals ein eigenes Symbol** (16/32/48/128 px) — vorher zeigte Chrome das
  graue Puzzleteil. Es erscheint jetzt auch auf der Schaltfläche in der
  Werkzeugleiste.
- Installationsanleitung auf GitHub umgestellt; die ZIP-Weitergabe entfällt.

**2.5**

- Behoben: Nach dem automatischen Ergänzen von Formularzeilen wurden die
  Werte nicht eingetragen, ein zweiter Klick war nötig. Ursache war der
  Seiten-Neuladevorgang durch „Felder hinzufügen"; der Ablauf setzt sich
  jetzt über beliebig viele Neuladungen hinweg selbst fort.
- Behoben: Überzählige Formularzeilen behielten ihre alten Werte und
  wurden mitgespeichert. Sie werden jetzt geleert.
- Robuster: Zeilenerkennung über die Moodle-Feldnamen statt über
  Bootstrap-CSS-Klassen, die sich bei Theme-Updates ändern können.
- Das blockierende Meldungsfenster am Ende ist durch eine dezente
  Statusanzeige oben rechts ersetzt.

**2.4**

- Umstellung von `sessionStorage` auf `localStorage` beim Wechsel von der
  Übersichts- zur Bearbeiten-Seite.
