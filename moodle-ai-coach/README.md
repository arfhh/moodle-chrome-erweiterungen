# Moodle AI Coach

Bewertet **kurze Freitextantworten** (ein bis drei Sätze) in Moodles Manueller
Bewertung — Punkte **und** Sprachfeedback.

Version 1.6.0 · vierte Erweiterung neben *Moodle AI Grader*, *Moodle AI Reviewer* und
*Notenstufen Autofill* · Lizenz: CC BY-SA 4.0 · A. Spielhoff

---

## Voraussetzungen — womit der Coach arbeitet

Der Coach kontrolliert **ausschließlich Fragen vom Typ „Freitext"** (Moodle-Fragetyp
*Essay*). Andere Fragetypen ignoriert er: Er erkennt eine Freitextfrage daran, dass
die Schülerantwort in einem `textarea.qtype_essay_response` steht. Lückentext- und
Kurzantwortfragen auf derselben Seite werden übersprungen und im Ergebnis als
„keine Freitextfrage" gezählt.

Damit er greift, müssen drei Dinge stimmen:

1. **Fragetyp Freitext.** Die Frage liegt als Essay-Frage in einer Kategorie der
   Fragensammlung.
2. **Als Zufallsfrage in den Test eingebunden.** Die Fragen stehen als Pool
   gleichwertiger Aufgaben in einer Kategorie, und der Test zieht daraus über eine
   **Zufallsfrage** je Slot — so bekommt jede Schülerin eine andere Aufgabe. Der Coach
   läuft die Übersicht der Manuellen Bewertung ab und arbeitet jede gezogene Frage
   einzeln durch; ohne Zufallsfragen funktioniert er genauso, der Pool ist aber der
   Anwendungsfall, für den er gebaut ist.
3. **Erwartungshorizont im Feld „Bewerterinformation".** Steht dort nichts, kann der
   Coach die Frage nicht bewerten — er zeigt sie mit ✗ und schickt dich zu Reiter 3,
   der den Horizont erzeugt und in die Frage schreibt.

**Wofür der Coach NICHT gedacht ist:** Ein-Wort-Antworten. Dafür ist der Fragetyp
**Cloze** das bessere Werkzeug — er bewertet automatisch, verträgt Tippfehler über
abgestufte Antwortvarianten und braucht keine Nachbewertung durch eine KI. Für die
Nachlese solcher Cloze-Fragen gibt es den *Moodle AI Reviewer*. Der Coach beginnt
dort, wo Sätze verlangt sind.

---

## Wozu?

Kurztests bestehen aus einer Frage, die in zwei bis drei Sätzen beantwortet wird —
gezogen aus einem Pool gleichwertiger Zufallsfragen. Moodle kann daran nichts
automatisch bewerten. Von Hand hieße das: jede Antwort lesen, Punkte setzen, eine
Rückmeldung tippen.

**Das eigentliche Produkt ist die Rückmeldung, nicht die Note.** Der Coach zitiert
den fehlerhaften Satz wörtlich und schreibt ihn richtig daneben.

## Das Prinzip: der Erwartungshorizont steht in der Frage

Im Moodle-Feld **Bewerterinformation** (`graderinfo`) jeder Freitextfrage steht, was
eine richtige Antwort ausmacht und welcher Prozentsatz wofür vergeben wird. Der Coach
liest ihn von der Bewertungsseite und baut daraus sofort den Bewertungs-Prompt.

Der Horizont gehört damit zur **Frage**, nicht zu einer Sitzung: einmal erstellt,
gilt er dauerhaft, wandert beim Export mit und funktioniert auch dann, wenn jeder
Schüler eine andere Frage aus dem Pool zieht.

Fehlt er, führt **Reiter 3** durch das Erstellen und schreibt ihn in die Frage.

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

## Wo das Panel erscheint

Nur auf der **Übersicht** der Manuellen Bewertung: `report.php?…&mode=grading`,
ohne `slot=`. Dort blenden weder Grader noch Reviewer etwas ein.

| Seite | Erweiterung | Farbe / Position |
|---|---|---|
| Übersicht `mode=grading` | **Coach** 🎓 | violett, `top 220px` |
| Übersicht mit `includeauto=1` | Reviewer 🔎 | petrol, `top 150px` |
| Einzelfrageseite | Grader 🪄 | blau, `top 80px` |

## Bedienung

**Reiter 1 · Bewerten** — „Freitextaufgaben durchsuchen" lädt jede Frage der
Übersicht im Hintergrund, erkennt die Essay-Fragen und listet sie mit ✓ oder ✗,
je nachdem ob ein Horizont hinterlegt ist. Der Prompt wird **nur aus den ✓-Fragen**
gebaut. Ein halb vorbereiteter Test lässt sich so trotzdem auswerten.

**Reiter 2 · Eintragen** — JSON der KI einfügen, „🔍 Prüfen", **Trockenlauf**
(lädt alle Seiten und prüft die Felder, ohne etwas zu speichern), dann
„Alle eintragen". Nach jedem Speichern wird der tatsächlich gespeicherte Wert
gegengeprüft.

**Reiter 3 · Horizont** — trägt eine rote Zahl, wenn irgendwo einer fehlt. Prompt
kopieren, im KI-Chat erstellen lassen, JSON einfügen, jeden Text bei Bedarf noch
ändern, Trockenlauf, dann „In die Aufgaben eintragen". Vor dem Schreiben kommt eine
Rückfrage — das ändert die **Fragensammlung**, nicht nur eine Bewertung.

## Die Rechnung

**Die KI beurteilt, die Erweiterung rechnet.** Die KI liefert zwei Dinge:

- `inhalt` — Prozentwert nach der Abstufung, die im Horizont steht
- `fehler` — die Liste der gezählten Sprachfehler mit Art und Fundstelle

Daraus rechnet die Erweiterung:

```
Punkte = max × Inhalt%  −  max × Abzug%        (nie unter 0)
```

Der Abzug folgt der Fehlerzahl, **absolut gezählt, nicht als Dichte** — bei 25 Wörtern
greift eine Dichteschwelle nie. Schwere Fehler (Satz ohne Prädikat, unverständlicher
Satzbau) zählen doppelt.

| Fehlerpunkte | 0 | 1 | 2 | 3 | 4 | ab 5 |
|---|---|---|---|---|---|---|
| Anteil vom Höchstabzug | 0 | ⅓ | ½ | ⅔ | ⅚ | 1 |

Der **Höchstabzug** steht unter ⚙ und ist frei einstellbar, Standard **30 %**.
Bei 0 zählt Sprache nicht für die Punkte, das Sprachfeedback wird trotzdem
geschrieben.

Sprache wird **abgezogen**, nicht als zweiter Topf addiert — sonst bekäme eine
inhaltsleere Antwort allein für sauberes Deutsch schon 30 %.

## Einstellungen (⚙)

- **Maximaler Abzug für Sprache und Ausdruck** — Standard 30 %; darunter steht,
  was der Wert konkret bedeutet.
- **KI-Hinweis unter dem Feedback** — der Satz, der unter jede Rückmeldung gesetzt
  wird, solange in Reiter 2 das Häkchen steht.
- **Eigener Bewertungs-Prompt** und **eigener Horizont-Prompt** — Platzhalter
  `[MOODLE_AI_COACH_DATEN]` bzw. `[MOODLE_AI_COACH_AUFGABEN]`.

## Datenschutz

Schülernamen werden **nicht** ausgelesen. Ein Versuch wird nur über seine interne
`qubaid` angesprochen. In den KI-Chat gehen der Aufgabentext, der Erwartungshorizont
und die Antworttexte — keine Namen, keine Kurslisten.

## Wie das Schreiben in `graderinfo` funktioniert

Am 28.08.2026 lesend am Hamburg-LMS verifiziert:

- Das Fragenformular hat eine **pro Aufruf zufällige id** (`mform1_FPrAOJMrRqMWeNX`),
  und das erste `form[method=post]` der Seite ist der Bearbeitungsmodus-Schalter im
  Seitenkopf. Verlässlich ist nur: **das Formular, das `graderinfo[text]` enthält.**
- Das Feld ist ein `textarea[name="graderinfo[text]"]`, daneben liegen
  `graderinfo[format]` (1 = HTML) und `graderinfo[itemid]`.
- Absenden mit **`submitbutton`** („Änderungen speichern"). `updatebutton`
  („Speichern und weiter bearbeiten") und `cancel` bleiben außen vor.
- `form.elements` enthält auch **FIELDSET**-Elemente mit `name` (etwa
  `graderinfoheader`). Sie haben kein `value` und würden als `undefined`
  mitgeschickt — deshalb werden nur INPUT, SELECT und TEXTAREA übernommen.

Ein Trockenlauf mit genau dieser Logik ergab an einer echten Frage: 36 Felder,
`sesskey` dabei, `cancel` nicht dabei, keine `undefined`-Werte, POST ≈ 3,9 KB.

## Stand 1.6.0

Der Bewertungsweg ist **einmal vollständig mit echten Daten gelaufen** (28.08.2026,
Test „🕐 4.1 Kurztest Sicherheit", 78 Antworten auf 11 Freitextfragen): Auslesen,
Prompt, Rechnung, Zurückschreiben, Gegenprobe — 78 Einträge, kein Fehler. Ein
Blindvergleich zweier Sprachmodelle am selben Auszug ergab **76 von 78 gleiche
Bewertungen** — der Beleg dafür, dass der Erwartungshorizont in der Frage funktioniert.

**Fehlerfreie Antworten bekommen keinen Kommentar** (Entscheidung 28.08.2026). Der
Eintrag geht trotzdem ins JSON, damit die Punkte gesetzt werden — nur ohne `text`.

**1.6.0** — **Der Horizont kommt jetzt aus der neuesten Fragenfassung.** Moodle zeigt
  auf der Bewertungsseite immer die Fassung, mit der der Versuch geschrieben wurde
  (Abzeichen „v1 (von 5)"). Änderungen am Horizont landen aber in einer neuen Fassung —
  der Coach las also weiter den alten Maßstab und meldete den frisch eingetragenen
  Marker als fehlend. Er wertet das Abzeichen jetzt aus und holt bei veralteten Fragen
  den Horizont über den Frageverlauf aus der neuesten Fassung; die Zusammenfassung sagt,
  bei wie vielen Fragen das nötig war. Das kostet zwei bis drei zusätzliche Seitenaufrufe
  je betroffener Frage, aber nur einmal je Frage und nur, wenn das Abzeichen es meldet.

**1.5.0** — **Änderungswünsche gehen in den Horizont-Prompt.** Reiter 3 hat ein Feld
  „Was soll anders werden?"; sein Inhalt steht im Prompt als eigener Abschnitt vor den
  Aufgaben, mit dem Vorrang vor allem, was in `horizont_bisher` steht. Ohne dieses Feld
  sah das Sprachmodell beim Neuschreiben nur den bisherigen Horizont — also genau das,
  was geändert werden sollte — und schrieb ihn fort. (Aufgefallen an ChatGPT, das beim
  Löschsand die Metallbrände als Muss beibehielt, obwohl sie entfallen sollten.) Der
  Text überlebt das Neuladen der Seite.

  Dazu zwei Korrekturen am Prompt selbst: Der Kopf behauptet nicht mehr, der Horizont
  „fehle" — er sagt jetzt, dass ein vorhandener der **Ausgangspunkt und keine Vorlage
  zum Abschreiben** ist. Und er weist darauf hin, dass die Kernaussage den Schülerinnen
  und Schülern als Musterantwort gezeigt wird, also als vollständiger, einfacher Satz
  zu schreiben ist.

**1.4.0** — **Die Musterlösung setzt die Erweiterung selbst ein.** Liegt eine Antwort
  unter 100 %, hängt sie unter die Inhalt-Zeile ein „So hättest du es schreiben
  können: …" und trägt dort die **Kernaussage aus dem Erwartungshorizont** ein —
  wörtlich das, was die Lehrkraft hinterlegt hat. Das kostet kein einziges Token beim
  Sprachmodell und kann nicht abweichen. Der Prompt sagt der KI ausdrücklich, dass sie
  die Musterlösung nicht schreiben soll. Bei voller Punktzahl entfällt die Zeile.

**1.3.0** — **Das Feedback ist neu gebaut — für die Schülerinnen und Schüler, nicht
  für die Lehrkraft.** Bisher kam ein Fließtext mit verschachtelten Sätzen und ohne
  Umbrüche; schwache Leser konnten damit nichts anfangen. Jetzt liefert die KI keine
  fertigen Sätze mehr, sondern **Felder** — `lob`, `inhalt`, `rechtschreibung`,
  `grammatik`, `tipp` —, und die Erweiterung baut daraus das Feedback mit Überschrift,
  eigenen Absätzen und unterstrichenen Zwischenüberschriften. Formvorgaben setzt kein
  Prompt zuverlässig durch, deshalb liegt die Form jetzt im Plugin.

  Neu auch der Ton: kurze Hauptsätze, die Regel statt nur der Korrektur („Vor
  ‚Löschsand' kannst du ‚der' setzen. Solche Wörter sind Nomen, und Nomen schreibt man
  groß."), falsch und richtig als Wortpaar statt langer Satzzitate, höchstens zwei
  Korrekturen je Zeile.

  Und: **Ab 95 % wird gelobt, erst dann verbessert.** Eine fehlerfreie Volltreffer-
  Antwort bekommt jetzt ein kurzes Lob statt gar keinen Kommentar — das kehrt die
  frühere Regel um. Die alte Form (`text` als fertiger Satz) wird weiter angenommen,
  damit gespeicherte eigene Prompts nicht brechen.

**1.2.0** — Der Bewertungs-Prompt bekommt einen **Schritt 3: „Horizont nachziehen"**.
  Hat die Lehrkraft in der Prüftabelle Prozentwerte korrigiert, benennt die KI nach dem
  JSON die Regel hinter jeder Korrektur, sagt, was sich im Horizont ändern müsste
  (meist wandert ein Teilaspekt von „Muss enthalten" nach „Auch richtig"), und bietet
  an, die betroffenen Horizonte neu zu schreiben — mit dem Weg dorthin über Reiter 3.
  Wurde nichts geändert, entfällt der Schritt ersatzlos. Grund: Eine Korrektur ist
  keine Einzelfallentscheidung, sondern ein Hinweis, dass der Horizont den Maßstab der
  Lehrkraft an dieser Stelle nicht abbildet — sonst entsteht derselbe Fehler beim
  nächsten Durchgang wieder.

**1.1.1** — Das Nachtragen der Marker zeigt jetzt, dass es läuft: Der Knopf zählt mit
  („Trage nach … 3 von 8: 1.1.2-Löschsand"), und jede Frage bekommt sofort ihre Zeile mit
  ✓ oder ✗, statt erst am Ende. Ursache des alten Eindrucks „es passiert nichts": Die
  8-Sekunden-Uhr aus der Sicherheitsabfrage lief weiter und setzte den Knopftext mitten
  im Lauf auf „nachtragen" zurück. Sie wird beim zweiten Klick jetzt gestoppt.

**1.1.0** — Zwei Dinge am Erwartungshorizont:

  *Fehlalarm beseitigt.* Beim Nachtragen des Markers meldete die Erweiterung „Text nicht
  angekommen", obwohl gespeichert war. Moodle legt beim Speichern eine **neue
  Fragenversion mit neuer Nummer** an; die Gegenprobe las die alte und sah dort
  natürlich nichts. Sie prüft jetzt an der neuen Version, deren Nummer Moodle im
  Parameter `lastchanged` zurückmeldet. Bleibt der aus, meldet die Erweiterung
  ehrlich „nicht gegengeprüft" statt fälschlich einen Fehlschlag.

  *Horizont neu schreiben.* Reiter 3 war bisher nur für fehlende Horizonte da. Jetzt gibt
  es dort ein Häkchen „Auch Fragen einbeziehen, die schon einen Horizont haben" — damit
  lässt sich für alle Aufgaben ein neuer schreiben, etwa wenn der vorhandene aus einer
  anderen Zeit stammt. Der bisherige Horizont geht als `horizont_bisher` in den Prompt,
  damit die KI weiß, wovon sie abweicht. Fehlt nirgends ein Horizont, steht das Häkchen
  von vornherein und der Reiter fragt „Alle Fragen haben einen Horizont. Willst du einen
  neuen für die Aufgaben schreiben?" statt „hier ist nichts zu tun". Aus dem
  Marker-Hinweis in Reiter 1 führt ein zweiter Knopf direkt dorthin.

**1.0.0** — Erste runde Fassung, zugleich die Umstellung auf dreistellige
  Versionsnummern (x.y.z) für alle fünf Erweiterungen. Die Kopfzeile des Panels zeigt
  jetzt die Versionsnummer, direkt aus dem Manifest gelesen — nach „↺ neu laden" ist
  damit ohne Umweg über `chrome://extensions/` sichtbar, welche Fassung aktiv ist.

**0.97.3** — Die Titelzeile heißt jetzt schlicht „AI Coach"; das vorangestellte „Co"
  war der Rückfall-Buchstabe des Knopfsymbols und hatte im Titel nichts zu suchen.
  Außerdem schließt sich der Einstellungs-Reiter nach „Speichern" von selbst und der
  Knopf quittiert kurz mit „✓ Gespeichert" — vorher sah das Panel unverändert aus,
  und man klickte aus Unsicherheit ein zweites Mal.

**0.97.2** — Der Coach hält sich von der Seite mit eingeblendeten automatisch
  bewerteten Fragen (`includeauto=1`) fern: dort ist der *Moodle AI Reviewer*
  zuständig, und beide Panels erschienen bisher nebeneinander. Der Coach bleibt auf
  der Übersicht ohne diesen Schalter — genau dort stehen die unbewerteten
  Freitextantworten. Da sich Grader, Coach und Reviewer damit gegenseitig
  ausschließen, benutzen alle drei dieselbe Panel-Position (oben rechts).

**0.97.1** — Behoben: Chrome verweigerte das Laden mit „Invalid value for
  `web_accessible_resources[0]`. Invalid match pattern." In diesem Manifest-Abschnitt
  erlaubt Chrome nur Muster mit dem Pfad `/*`; der Seitenfilter des Content Scripts
  darf dort nicht stehen. Er wirkt ohnehin an der Stelle, an die er gehört.

**0.97** — **Zuständigkeits-Marker** (siehe „Wer ist zuständig"): Fragen mit
`[moodle-ai-grader]` werden übersprungen, Fragen ohne Marker gemeldet und auf Knopfdruck
nachgetragen, neues Häkchen „nur mit Coach-Marker" in den Einstellungen. Jeder Horizont,
den der Coach selbst schreibt, trägt den Marker automatisch. Außerdem zeigt der
Panel-Knopf jetzt das echte Symbol statt des „Co".

**0.96.2** — läuft jetzt auch auf Moodle-Installationen in einem Unterverzeichnis
(`https://schule.de/moodle/…`): die Wurzel wird aus der eigenen Adresse abgeleitet,
statt auf der Domainwurzel vermutet.

**0.96.1** — neues Symbol (16/32/48/128 px). Am Ablauf ändert sich nichts.

## Bekannte offene Punkte

- **Reiter 3 ist ungetestet.** Das Schreiben des Horizonts in `graderinfo` wurde
  lesend verifiziert, aber noch nie abgeschickt. Beim ersten Einsatz mit **einer**
  Frage anfangen.
- **Noch kein Test mit echten 2–3-Satz-Antworten.** Die bisher benutzten Fragen sind
  Ein-Wort-Aufgaben und dienten nur als technische Kulisse. Ob Sprachregel,
  Abzugsleiter und Feedback-Stil taugen, zeigt sich erst daran.
- Ob Moodle beim Speichern einer bereits benutzten Frage eine **neue Fragenversion**
  anlegt, ließ sich lesend nicht klären. Beim ersten Einsatz mit **einer** Frage
  prüfen und danach in der Fragensammlung nachsehen.
- Noch kein Symbol in der Chrome-Werkzeugleiste außer dem Erweiterungs-Icon selbst —
  der Coach hat keine Werkzeugleisten-Schaltfläche, er arbeitet ausschließlich im
  Panel auf der Moodle-Seite.

---

*Moodle AI Coach · A. Spielhoff · CC BY-SA 4.0*
