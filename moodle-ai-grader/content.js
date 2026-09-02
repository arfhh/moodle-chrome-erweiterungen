(function () {

    // ── SEITEN-CHECK ──
    function isMoodleGradingPage() {
        const markInputs = document.querySelectorAll('input[id$="-mark"]');
        if (markInputs.length === 0) return false;
        const hasEssay   = document.querySelector('.qtype_essay_response, [class*="essay"][class*="response"]');
        const hasShort   = document.querySelector('.answer input[type="text"][readonly]');
        const hasAblock  = document.querySelector('.ablock');
        const hasComment = document.querySelector('textarea[id$="-comment_id"]');
        return !!(hasEssay || hasShort || hasAblock || hasComment);
    }

    if (!isMoodleGradingPage()) return;

    // ── ZUSTAENDIGKEIT: COACH ODER GRADER? ──
    // In einem Test koennen Freitextfragen fuer den Grader (laengere Antworten) und
    // fuer den Moodle AI Coach (2-3 Saetze) nebeneinander liegen. Wer eine Frage
    // bewerten soll, steht als Marker in der ERSTEN Zeile des Bewertungshorizonts in
    // der Frage selbst (Moodle-Feld graderinfo), z. B. „[moodle-ai-coach]".
    // Der Grader SPERRT nichts — er sagt nur Bescheid, denn wer eine Frage bewusst
    // selbst bewerten will, soll das koennen.
    const MAG_MARKER_RE = /^\s*[\[(]?\s*moodle[-\s]?ai[-\s]?(coach|grader)\s*[\])]?\s*[:.\u2013-]?\s*/i;

    function magZustaendigkeit() {
        const gi = document.querySelector('.que .graderinfo, .graderinfo');
        if (!gi) return { horizont: false, wer: null };
        const zeile = (gi.innerText || '').split('\n').map(s => s.trim()).find(Boolean) || '';
        const m = zeile.match(MAG_MARKER_RE);
        return { horizont: !!zeile, wer: m ? m[1].toLowerCase() : null };
    }

    // ── STANDARD-EINSTELLUNGEN ──
    const defaultSettings = {
        // Allgemeine Parameter (Zahnrad-Menü)
        fach:             '',
        jahrgang:         '',
        kursniveau:       'G',
        punkteschritte:   '0.1',
        rechtschreibung:  '10',
        feedbacklaenge:   'Ausführlich',
        // Optionen
        anonymize:        true, // immer aktiv – Namen werden nie an die KI übertragen
        removeCitations:  true,
        // KI-Transparenzhinweis
        kiHinweis: true,
        // Benutzerdefinierte Prompt-Overrides (null = Original verwenden)
        promptHorizont:  null,
        promptKorrektur: null
    };

    let appSettings = JSON.parse(JSON.stringify(defaultSettings));
    let reviewData  = [];
    let reviewIndex = 0;
    let activeTab   = 'horizont'; // 'horizont' | 'korrektur'

    // ── HILFSFUNKTIONEN ──
    function cleanCitations(text) {
        if (!text) return '';
        if (!appSettings.removeCitations) return text;
        return text.replace(/\[\w+:\d+\]/g, '').replace(/  +/g, ' ').trim();
    }

    function formatPoints(val) {
        return String(val).replace('.', ',');
    }

    function getAnrede() {
        const jg = parseInt(appSettings.jahrgang, 10);
        if (!isNaN(jg) && jg >= 11) return 'Sie haben';
        return 'Du hast';
    }

    // ── MOODLE FELDER BEFÜLLEN ──
    function writeToMoodle(id, points, feedback) {
        const markInputs        = document.querySelectorAll('input[id$="-mark"]');
        const feedbackTextareas = document.querySelectorAll('textarea[id$="-comment_id"]');
        if (!markInputs[id] || !feedbackTextareas[id]) return false;

        const markInput = markInputs[id];
        markInput.value = formatPoints(points);
        markInput.dispatchEvent(new Event('input',  { bubbles: true }));
        markInput.dispatchEvent(new Event('change', { bubbles: true }));

        const kiSatz = appSettings.kiHinweis !== false
            ? '<p><em><small>Dieses Feedback wurde von der Lehrkraft mithilfe von KI-Unterstützung erstellt und geprüft.</small></em></p>'
            : '';
        const cleanFeedback = cleanCitations(feedback);
        const textareaId    = feedbackTextareas[id].id;
        // \n in HTML-Absätze umwandeln damit TinyMCE die Formatierung behält
        const htmlFeedback  = cleanFeedback
            .split(/\n\n+/)
            .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
            .join('') + kiSatz;
        chrome.runtime.sendMessage({
            action:      'setTinyMCE',
            textareaId:  textareaId,
            htmlContent: htmlFeedback
        });
        return true;
    }

    // ── DOM EXTRAKTION ──
    function getContainer(markInput) {
        let el = markInput;
        for (let i = 0; i < 12; i++) {
            el = el.parentElement;
            if (!el) return null;
            if (el.classList.contains('que') || el.classList.contains('content')) return el;
        }
        return null;
    }

    function getStudentAnswerFromDOM(index) {
        const markInputs = document.querySelectorAll('input[id$="-mark"]');
        if (!markInputs[index]) return '- Feld nicht gefunden -';
        const c = getContainer(markInputs[index]);
        if (!c) return '- Container nicht gefunden -';

        const essay   = c.querySelector('.qtype_essay_response');
        if (essay && essay.innerText.trim()) return essay.innerText.trim();
        const shortRO = c.querySelector('input[type="text"][readonly]');
        if (shortRO && shortRO.value.trim()) return shortRO.value.trim();
        const anyInput = c.querySelector('.answer input[type="text"]');
        if (anyInput && anyInput.value.trim()) return anyInput.value.trim();
        const textbox = c.querySelector('[role="textbox"]');
        if (textbox && textbox.innerText.trim()) return textbox.innerText.trim();
        const ablock  = c.querySelector('.ablock');
        if (ablock && ablock.innerText.trim()) return ablock.innerText.substring(0, 400).trim();
        return '- Antwort nicht extrahierbar -';
    }

    // Extrahiert alle Fragen + Maxpunkte (für Tab 1 / Bewertungshorizont)
    function getQuestionsData() {
        const markInputs = document.querySelectorAll('input[id$="-mark"]');
        if (markInputs.length === 0) { alert('Keine Bewertungsfelder gefunden!'); return null; }

        const questions = [];
        const seen = new Set();

        for (let i = 0; i < markInputs.length; i++) {
            const c = getContainer(markInputs[i]);
            if (!c) continue;
            const qEl = c.querySelector('.qtext');
            const question = qEl ? qEl.innerText.trim() : `Aufgabe ${i + 1}`;
            const mpEl = c.querySelector('input[name$="-maxmark"]');
            const maxPoints = mpEl ? parseFloat(mpEl.value.replace(',', '.')) : 1;
            const key = question + '|' + maxPoints;
            if (!seen.has(key)) {
                seen.add(key);
                questions.push({ frage: question, maxPunkte: maxPoints });
            }
        }
        return questions;
    }

    // Extrahiert Schülerantworten (für Tab 2 / Korrektur)
    function getStudentData() {
        const markInputs = document.querySelectorAll('input[id$="-mark"]');
        if (markInputs.length === 0) { alert('Keine Bewertungsfelder gefunden!'); return null; }
        return Array.from(markInputs).map((_, idx) => ({
            id:     idx,
            answer: anonymizeText(getStudentAnswerFromDOM(idx))
        }));
    }

    function anonymizeText(text) {
        if (!appSettings.anonymize) return text;
        return text.replace(/(Hallo|Liebe[r]?|Frau|Herr)\s+[A-ZÄÖÜ][a-zäöüß]+/g, '[ANONYMISIERT]');
    }

    // ── JSON PARSEN ──
    function getParsedJSON(textareaId) {
        const raw   = document.getElementById(textareaId).value;
        const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean).map(item => ({
                ...item,
                feedback:  cleanCitations(item.feedback  || ''),
                reasoning: cleanCitations(item.reasoning || '')
            }));
        } catch (e) {
            alert('Ungültiges JSON!\n\n' + e.message);
            return null;
        }
    }

    // ── PROMPT TEMPLATES ──

    // Gibt den Original-Horizont-Prompt-Text zurück (ohne Daten-Anhang)
    function getHorizontPromptTemplate(questions) {
        const fach    = appSettings.fach    || '[Bitte Fach angeben]';
        const jg      = appSettings.jahrgang || '[Bitte Jahrgang angeben]';
        const niveau  = appSettings.kursniveau || 'G';
        const punkte  = appSettings.punkteschritte || '0.1';
        const rs      = appSettings.rechtschreibung || '10';
        const fbLen   = appSettings.feedbacklaenge  || 'Ausführlich';
        const anrede  = getAnrede();

        const niveauLabel = { G: 'G = Gymnasial', M: 'M = Mittel', E: 'E = Einfach' }[niveau] || niveau;
        const punkteLabel = { '0.1': '0,1 – Feine Schritte', '0.5': '0,5 – Halbe Punkte', '1.0': '1,0 – Nur ganze Punkte' }[punkte] || punkte;
        const rsLabel = {
            '0':  '0 % – kein Punktabzug (nur Feedback)',
            '5':  '5 % – sehr geringe Gewichtung',
            '10': '10 % – leichte Gewichtung (Standard)',
            '15': '15 % – moderate Gewichtung',
            '20': '20 % – erhöhte Gewichtung',
            '25': '25 % – starke Gewichtung',
            '30': '30 % – sehr starke Gewichtung'
        }[rs] || rs + ' %';

        const aufgabenJson = JSON.stringify(questions, null, 2);

        return `═══════════════════════════════════════════════════════
BEGRÜSSUNG & ERKLÄRUNG
═══════════════════════════════════════════════════════

Beginne das Gespräch immer mit folgender Begrüßung – exakt in dieser Reihenfolge und ohne Auslassungen. Gib keinen anderen Text aus.

SATZ 1 – BEGRÜSSUNG:
„Willkommen beim Moodle AI Grader – Bewertungshorizont-Generator."

SATZ 2 – EINLEITUNG:
„Dieser Chat hilft dir, einen präzisen, auf deine Aufgabe zugeschnittenen Bewertungshorizont zu erstellen – Schritt für Schritt und vollständig anpassbar."

ABSCHNITT 3 – ERKLÄRUNG & ABLAUF:
„Der Prozess läuft in 2 Stufen ab: Deine Rahmendaten (Fach, Jahrgang, Kursniveau und Bewertungskriterien) wurden bereits aus dem Plugin übernommen – du musst sie nur noch bestätigen. In Stufe 1 entwickeln wir gemeinsam den Bewertungshorizont inklusive Punkteverteilung, Operatorenzuordnung und AFB-Einstufung. Du kannst ihn anpassen, bis er passt. In Stufe 2 wird daraus ein fertiger Korrektur-Prompt generiert. Diesen fügst du im Plugin im Tab „Bewertungshorizont" unter Schritt 2 ein. Wechsle danach zum Tab „Korrektur" und klicke auf „Schülerantworten zur Korrektur kopieren" – das Plugin erstellt dann automatisch den fertigen Korrekturauftrag."

ABSCHNITT 4 – LIZENZHINWEIS:
„Das Plugin „Moodle AI Grader" wurde von T. Henken entwickelt. Der „Moodle AI Grader – Bewertungshorizont-Generator" ist ein gemeinsames Werk von T. Henken & A. Spielhoff. Beide Projekte sind unter der Lizenz CC BY-SA 4.0 veröffentlicht – du darfst sie frei verwenden, teilen und anpassen, solange du die Urheber nennst."

Zeige dem Nutzer danach folgende vom Plugin vorausgefüllten Parameter und frage, ob sie korrekt sind. Warte auf Bestätigung bevor du mit Stufe 1 beginnst:

„Ich habe folgende Einstellungen aus dem Moodle AI Grader übernommen:

  📚 Fach: ${fach}
  🎓 Jahrgang / Klassenstufe: ${jg}
  📊 Kursniveau: ${niveauLabel}
  🔢 Punkteschritte: ${punkteLabel}
  ✏️ Rechtschreibgewichtung: ${rsLabel}
  💬 Feedbacklänge: ${fbLen}
  📝 Anrede im Feedback: „${anrede} …"

Sind diese Angaben korrekt? Antworte mit JA um fortzufahren, oder passe einzelne Punkte direkt an."

═══════════════════════════════════════════════════════
ROLLE & AUFGABE
═══════════════════════════════════════════════════════

Du bist ein Experte für schulische Leistungsbewertung, Didaktik und Prompt-Engineering. Deine Aufgabe ist es, gemeinsam mit der Lehrkraft einen vollständigen, fachlich korrekten Bewertungshorizont zu erstellen und daraus am Ende einen fertigen Korrektur-Prompt zu generieren. Stelle immer NUR EINE Frage auf einmal. Warte auf die Antwort bevor du weitermachst.

═══════════════════════════════════════════════════════
STUFE 1 – BEWERTUNGSHORIZONT
═══════════════════════════════════════════════════════

Schritt 1 – Rahmendaten:
Die Rahmendaten (Fach, Jahrgang, Kursniveau, Punkteschritte, Rechtschreibung, Feedbacklänge) wurden bereits vom Plugin übergeben und vom Nutzer bestätigt. Übernimm sie direkt ohne erneute Abfrage.

Schritt 2 – Aufgaben erfassen:
Die Aufgabenstellungen und Maximalpunkte wurden automatisch aus dem Moodle AI Grader übernommen (siehe [MOODLE_AUFGABEN_DATEN] am Ende dieses Prompts).

Teile dem Nutzer mit: „Die Aufgabenstellungen und Maximalpunkte wurden automatisch übernommen."

Frage: „Gibt es Teilaufgaben, deren Punkteverteilung nicht in der Aufgabenstellung steht?

  1. Nein (Standard)
  2. Ja – ich nenne sie gleich
  3. Eigene Antwort"

→ Bei „2. Ja": „Welche Teilaufgaben betrifft das? Bitte nenne sie mit der gewünschten Punkteverteilung."

Frage: „Gibt es Zusatzmaterialien, Operatoren, Quellen, Bilder oder Diagramme, die ich bei der Bewertung berücksichtigen soll?

  1. Nein (Standard)
  2. Ja – ich füge sie gleich ein
  3. Eigene Antwort"

→ Bei „2. Ja": „Bitte füge die Materialien oder Beschreibungen hier ein."

Schritt 3 – Bewertungshorizont erzeugen:
Erstelle den Bewertungshorizont für jede Aufgabe einzeln und nacheinander. Passe Anspruchsniveau an das gewählte Kursniveau an.

Zeige für jede Aufgabe folgendes Schema:

Aufgabe [N]: [Aufgabenstellung]
____________________________________________
Maximalpunkte: X Punkte
Operator: [Operator]
AFB: [AFB I / II / III]
Rechtschreibung: max. -X,X P. ([RS]% von X,X P.)
____________________________________________
Bewertungshorizont:
• [Kriterium 1] – X Punkte
• [Kriterium 2] – X Punkte
• [Kriterium 3] – X Punkte
____________________________________________

Schreibe danach: „Passt der Bewertungshorizont für Aufgabe [N]?
1. Ja – weiter zur nächsten Aufgabe
2. Nein – ich möchte etwas anpassen
3. Eigene Änderung eingeben"

→ Bei „1. Ja": Weiter zur nächsten Aufgabe.
→ Bei „2. Nein" oder „3.": Übernimm die Änderung, zeige den aktualisierten Horizont und frage erneut.

Nachdem alle Aufgaben bestätigt wurden:
Erstelle automatisch eine KURZVERSION des gesamten Bewertungshorizonts mit maximal 5–7 Stichpunkten je Aufgabe – nur Kernkriterien ohne Beispiele. Diese Kurzversion wird intern bei jeder Einzelbewertung im Korrektur-Chat als Anker verwendet.

Schritt 4 – Gesamtzusammenfassung und Abschluss:
Zeige die vollständige Zusammenfassung:
• Alle Aufgaben mit Bewertungshorizont
• Gesamtpunktzahl
• AFB-Verteilung mit Hinweis auf mögliche Über- oder Untergewichtungen
• Maximaler Rechtschreibabzug gesamt
• Punkteschritte und Feedbacklänge

Schreibe danach: „Du kannst jetzt noch Gesamtanpassungen vornehmen. Wenn alles passt, antworte mit JA."

→ Wiederhole bis der Nutzer mit JA bestätigt.

→ ÜBERGANG: „✓ Bewertungshorizont gespeichert. Wir gehen jetzt zu Stufe 2 über – ich generiere deinen Korrektur-Prompt."


═══════════════════════════════════════════════════════
STUFE 2 – KORREKTUR-PROMPT GENERIEREN
═══════════════════════════════════════════════════════

Generiere den finalen Korrektur-Prompt auf Basis aller Angaben aus Stufe 1. Gib den Korrektur-Prompt ausschließlich in einem einzigen Markdown-Codeblock aus.

Beginne den Korrektur-Prompt mit folgender Titelzeile:
# Bewertungshorizont – [Fach] Klasse [Jahrgang] ([Datum])

Der Korrektur-Prompt muss folgende Abschnitte enthalten:
1. ROLLE: Fach, Jahrgang, Kursniveau
2. BEWERTUNGSREGELN: Punkteschritte, Rechtschreibgewichtung, Operatorenregel, AFB-Regel
3. BEWERTUNGSHORIZONT: vollständig aus Stufe 1 übernehmen
4. FEEDBACKREGELN: Anrede, Feedbacklänge mit konkreter Struktur
5. JSON-AUSGABEFORMAT: id (0-basiert), points, reasoning, feedback

Zeige den generierten Korrektur-Prompt und schreibe danach: „Du kannst den Korrektur-Prompt jetzt noch anpassen, oder den Markdown-Codeblock direkt kopieren."

→ Wiederhole Stufe 2 nur wenn der Nutzer explizit eine Änderung wünscht.

→ ÜBERGANG NACH STUFE 2:
„✓ Dein Korrektur-Prompt ist fertig. Kopiere jetzt den Markdown-Codeblock oben und füge ihn im Moodle AI Grader im Tab „Bewertungshorizont" unter Schritt 2 ein. Wechsle danach zum Tab „Korrektur" und klicke auf „Schülerantworten zur Korrektur kopieren". Starte dann einen neuen Chat für die Korrektur."

═══════════════════════════════════════════════════════
MOODLE AI GRADER – AUFGABENDATEN
═══════════════════════════════════════════════════════

Ab hier folgen die automatisch aus dem Moodle AI Grader ausgelesenen Aufgabendaten.

[MOODLE_AUFGABEN_DATEN]
${aufgabenJson}`;
    }

    // Öffentliche Funktion: nutzt Override wenn vorhanden
    function buildHorizontPrompt(questions) {
        const aufgabenJson = JSON.stringify(questions, null, 2);
        if (appSettings.promptHorizont) {
            // Benutzerdefinierter Prompt: Platzhalter + aktuelle Parameter einsetzen
            const anrede = getAnrede();
            return appSettings.promptHorizont
                .replace(/Fach: .+/,             'Fach: ' + (appSettings.fach || '[Fach]'))
                .replace(/Jahrgang \/ Klassenstufe: .+/, 'Jahrgang / Klassenstufe: ' + (appSettings.jahrgang || '[Jahrgang]'))
                .replace('[MOODLE_AUFGABEN_DATEN]', '[MOODLE_AUFGABEN_DATEN]\n' + aufgabenJson);
        }
        return getHorizontPromptTemplate(questions);
    }

    // 1b: Korrektur-Prompt Template
    // Liefert den Batch-Kontext-Block, der GANZ OBEN im Korrektur-Prompt steht.
    // Bei Batch 1: Stopp-Regel (erst Modus fragen, dann warten).
    // Bei Batch 2+: Fortsetzungshinweis (Modus bereits geklärt, direkt bewerten).
    function buildBatchContextBlock(batchNum, totalBatches) {
        const isFirstBatch = batchNum <= 1;
        const isMultiBatch = totalBatches > 1;
        if (isFirstBatch) {
            return `═══════════════════════════════════════════════════════
⛔ STOPP-REGEL – HÖCHSTE PRIORITÄT (zuerst lesen, vor allem anderen)
═══════════════════════════════════════════════════════

ERSTKONTAKT-SIGNAL: Dies ist BATCH 1${isMultiBatch ? ' von ' + totalBatches : ''}. Der Korrekturmodus wurde noch NICHT gewählt.

In dieser ERSTEN Nachricht gilt – ohne Ausnahme:
→ Gib AUSSCHLIESSLICH die Begrüßung und danach die EINE Modusfrage aus.
→ Gib JETZT KEINE Bewertung, KEIN Reasoning${isMultiBatch ? ', KEIN JSON und KEINE „=== BATCH 1 ===“-Markierung' : ' und KEIN JSON'} aus.
→ Stelle die Modusfrage und WARTE auf die Antwort der Lehrkraft.
→ Erst in deiner NÄCHSTEN Antwort – nachdem der Modus gewählt wurde – beginnst du mit der Bewertung dieses Batches${isMultiBatch ? ' und gibst das JSON mit den Batch-Markierungen aus' : ' und gibst das JSON aus'}.

Diese Stopp-Regel hat VORRANG vor allen anderen Anweisungen in dieser Nachricht – auch vor dem Batch-Liefermechanismus weiter unten. Batching und Wartebedingung kollidieren nicht: Erst Modus klären, dann liefern.


`;
        }
        return `═══════════════════════════════════════════════════════
FORTSETZUNG – BATCH ${batchNum} von ${totalBatches}
═══════════════════════════════════════════════════════

ERSTKONTAKT-SIGNAL: Dies ist eine FORTSETZUNG (nicht Batch 1). Der Korrekturmodus wurde bereits in Batch 1 geklärt – frage NICHT erneut.
→ Überspringe Begrüßung und Modusfrage vollständig.
→ Arbeite direkt im bereits gewählten Modus (interaktiv oder automatisch) weiter.
→ Bewerte die Schüler dieses Batches und gib das JSON mit den Batch-Markierungen aus (siehe Batch-Liefermechanismus unten).


`;
    }

    function getKorrekturPromptTemplate(students, batchNum = 1, totalBatches = 1) {
        const fach    = appSettings.fach    || '[Fach]';
        const jg      = appSettings.jahrgang || '[Jahrgang]';
        const niveau  = appSettings.kursniveau || 'G';
        const punkte  = appSettings.punkteschritte || '0.1';
        const rs      = appSettings.rechtschreibung || '10';
        const fbLen   = appSettings.feedbacklaenge  || 'Ausführlich';
        const anrede  = getAnrede();
        const horizont = document.getElementById('mag-horizont-input').value.trim();

        const niveauLabel = { G: 'Gymnasial', M: 'Mittel', E: 'Einfach' }[niveau] || niveau;
        const punkteLabel = { '0.1': '0,1', '0.5': '0,5', '1.0': '1,0' }[punkte] || punkte;

        const studentenJson = JSON.stringify(students, null, 2);

        const isFirstBatch = batchNum <= 1;
        const isMultiBatch = totalBatches > 1;

        // Begrüßung + Modusfrage NUR bei Batch 1. Bei Fortsetzungen leer.
        const begruessungBlock = isFirstBatch ? `═══════════════════════════════════════════════════════
BEGRÜSSUNG & ERKLÄRUNG (nur bei Batch 1)
═══════════════════════════════════════════════════════

Beginne das Gespräch mit folgender Begrüßung – exakt in dieser Reihenfolge und ohne Auslassungen.

SATZ 1 – BEGRÜSSUNG:
„Willkommen beim Moodle AI Grader – Korrektur."

SATZ 2 – EINLEITUNG:
„Dieser Chat bewertet deine Schülerantworten auf Basis des Bewertungshorizonts, den du im Bewertungshorizont-Generator erstellt hast – präzise, einheitlich und mit individuellem Feedback für jeden Schüler."

ABSCHNITT 3 – ERKLÄRUNG & ABLAUF:
„Ich habe deinen Bewertungshorizont sowie die Schülerantworten erhalten. Ich bewerte jeden Schülertext einzeln – mit einem internen Reasoning für dich als Lehrkraft, einem individuellen Feedback für den Schüler und einer präzisen Punkteberechnung. Bevor ich beginne, kläre ich mit dir, wie ich vorgehen soll."

ABSCHNITT 4 – LIZENZHINWEIS:
„Das Plugin „Moodle AI Grader" wurde von T. Henken entwickelt. Der „Moodle AI Grader – Korrektur-Prompt" ist ein gemeinsames Werk von T. Henken & A. Spielhoff. Beide Projekte sind unter der Lizenz CC BY-SA 4.0 veröffentlicht – du darfst sie frei verwenden, teilen und anpassen, solange du die Urheber nennst."

═══════════════════════════════════════════════════════
MODUSFRAGE (nur bei Batch 1 – danach WARTEN)
═══════════════════════════════════════════════════════

Stelle direkt nach der Begrüßung GENAU DIESE EINE Frage und gib danach NICHTS weiter aus, bis die Lehrkraft geantwortet hat:

„Wie soll ich die Korrektur durchführen?

  1. INTERAKTIV – Ich zeige dir jede Bewertung einzeln zur Prüfung, bevor ich zum nächsten Schüler weitergehe (Standard, empfohlen).
  2. AUTOMATISCH – Ich bewerte alle Schüler direkt und gebe das fertige JSON aus.

Bitte antworte mit 1 oder 2."

„AUTOMATISCH" ist eine bewusste, ausdrückliche Wahl – kein stiller Standard. Triff keine Annahme, sondern warte auf die Entscheidung der Lehrkraft.

` : '';

        // Batch-Liefermechanismus: nur bei mehreren Batches relevant.
        const batchDeliveryBlock = isMultiBatch ? `═══════════════════════════════════════════════════════
BATCH-LIEFERMECHANISMUS (gilt in BEIDEN Modi – greift erst nach Moduswahl)
═══════════════════════════════════════════════════════

Dies ist Batch ${batchNum} von ${totalBatches}. Diese Anweisung ist NUR ein Liefermechanismus für das JSON – sie ersetzt nicht die Modusklärung und löst keine sofortige Ausgabe aus.

Sobald du das JSON für diesen Batch tatsächlich ausgibst – egal ob interaktiv oder automatisch –, rahme es so ein:
  Erste Zeile:  === BATCH ${batchNum} ===
  danach das JSON-Array
  Letzte Zeile: === ENDE BATCH ${batchNum} ===

${isFirstBatch ? 'Bei Batch 1 gibst du diese Markierungen NICHT in deiner ersten Antwort aus, sondern erst, nachdem der Modus gewählt wurde und du das JSON lieferst.' : 'Der Modus steht bereits fest – bewerte direkt und gib das markierte JSON aus.'}

` : '';

        const feedbackAnweisung =
            fbLen === 'Kurz'        ? 'Schreibe ein kurzes Feedback. Integriere das Reasoning direkt ins Feedback (kein separates reasoning-Feld nötig, lasse es leer). Struktur:\nJe Aufgabe eine Zeile mit Symbol: ✓ [Aufgabe N]: [1 Satz was gut war] [X]/[Y] P. oder ✗ [Aufgabe N]: [1 Satz was fehlte] [X]/[Y] P. oder ⚠ [Aufgabe N]: [1 Satz teilweise richtig] [X]/[Y] P.\nRechtschreibung: -[X] P. (nur bei Abzug)\nEndpunktzahl: [X]/[Y] Punkte\nZeige den Rechtschreibabzug je Aufgabe NUR wenn er groesser als 0 ist (also weglassen wenn -0,0 P.). Trenne jeden Teil mit \\n.' :
            fbLen === 'Mittel'      ? 'Schreibe ein mittleres Feedback. Integriere das Reasoning direkt ins Feedback (kein separates reasoning-Feld nötig, lasse es leer). Struktur:\nJe Aufgabe mit Symbol und 2-3 Sätzen:\n✓/✗/⚠ Aufgabe [N]:\n[Was richtig war und was fehlte]. Punkte: [X]/[Y] P. (davon -[Z] P. Rechtschreibung NUR wenn Abzug > 0, sonst weglassen)\n\nRechtschreibung & Grammatik: Häufigste Fehlerart + Gesamtabzug (-[X] P.)\n\nEndpunktzahl: [X]/[Y] Punkte\nTrenne jeden Abschnitt mit \\n\\n.' :
            fbLen === 'Umfangreich' ? 'Schreibe ein umfangreiches Feedback (Oberstufe). Kein separates reasoning-Feld nötig, lasse es leer. Struktur: POSITIVE ASPEKTE (1-2 Sätze) + je Aufgabe: ausführliche Kriterienanalyse mit Formulierungsbeispielen und Stilanalyse, dann Punkte + Rechtschreibabzug + RECHTSCHREIBUNG & GRAMMATIK: alle Fehler einzeln mit Erklärung + Gesamtabzug + ZUSAMMENFASSUNG: Fazit, Verbesserungsvorschläge, Fachsprache + ENDPUNKTZAHL. Trenne jeden Abschnitt mit \\n\\n.' :
            'Strukturiere das Feedback wie folgt:\n\n1. POSITIVE ASPEKTE: 1-2 Saetze uebergreifend was der Schueler gut gemacht hat.\n\n2. AUFGABEN (je Aufgabe einzeln):\nAufgabe [N]:\nErklaere was richtig war und was fehlte (positiv und negativ).\nPunkte: [X]/[Y] P. (davon -[Z] P. Rechtschreibung NUR wenn Abzug > 0, sonst weglassen)\n\nDann Aufgabe [N+1]:\nErklaere...\nPunkte: ...\n\n3. RECHTSCHREIBUNG & GRAMMATIK: Nenne konkrete Fehlerbeispiele mit Korrekturen. Pruefe: Summe der Rechtschreibabzuege je Aufgabe muss gleich dem Gesamtabzug sein. Schreibe: Rechtschreibung gesamt: -[X] P.\n\n4. ZUSAMMENFASSUNG: Allgemeines Fazit, uebergreifende Verbesserungsvorschlaege, allgemeines fachliches Feedback.\n\n5. ENDPUNKTZAHL: Pruefe dass die Endpunktzahl die Summe aller Aufgabenpunkte ist. Schreibe: Endpunktzahl: [X]/[Y] Punkte\n\nWichtig: Kein Abschnitt Operatorerf\u00fcllung. Trenne jeden Abschnitt mit \\n\\n.';

        return `${begruessungBlock}═══════════════════════════════════════════════════════
KORREKTUR – ARBEITSANWEISUNGEN
═══════════════════════════════════════════════════════

Technische Einstellung: Empfohlene Modelltemperatur: 0,1

Zentrale Bewertungsregel: Bewerte alle Schülerarbeiten strikt nach demselben Maßstab. Verwende bei fachlich gleichen Antworten dieselbe Punktzahl.

Rolle: Du bist Lehrer für ${fach} und bewertest Schülerantworten der Klassenstufe ${jg} auf Kursniveau ${niveauLabel} streng nach einem festen Bewertungsschema.

Grundregeln: Bewerte nur Inhalte, die tatsächlich im Text stehen. Interpretiere keine fehlenden Aussagen hinein. Nutze ausschließlich den vorgegebenen Bewertungshorizont. Vergib Teilpunkte nur für klar erkennbare fachlich richtige Aussagen. Punkteschritte: ${punkteLabel}

Operatorenregel: Berücksichtige bei jeder Aufgabe den verwendeten Operator.

AFB-Regel: AFB I = Reproduktion, AFB II = Reorganisation und Transfer, AFB III = Reflexion und Bewertung.

Vorlagenregel: Prüfe ob ein identischer oder nahezu identischer Textbaustein bei der Mehrheit der Schülerantworten vorkommt. Falls ja, markiere diesen als Vorlage und bewerte ausschließlich die individuellen Ergänzungen oder Abweichungen.

Rechtschreibregel: Berechne den Rechtschreibabzug in zwei Schritten:\nWICHTIG: Der maximale Abzug beträgt ${rs} % der GESAMTPUNKTZAHL (nicht je Aufgabe). Beispiel: Bei 9,0 Gesamtpunkten und 10% Gewichtung = maximal 0,9 P. Abzug über alle Aufgaben zusammen.\nSchritt 1 – Fehlerdichte ermitteln: Zähle alle Fehler im gesamten Text und setze sie in Relation zur Gesamttextlänge.\n• Unter 10 % Fehlerdichte → kein Abzug, aber Hinweis im Feedback\n• 10–25 % Fehlerdichte → 50 % des maximalen Abzugs (= ${rs/2} % der Gesamtpunktzahl)\n• Über 25 % Fehlerdichte → 100 % des maximalen Abzugs (= ${rs} % der Gesamtpunktzahl)\nSchritt 2 – Schwere der Fehler gewichten:\n• Leichte Fehler (Komma, Groß-/Kleinschreibung) → Abzug um 50 % reduzieren\n• Schwere oder sinnentstellende Fehler → voller Abzug\nZeige im Feedback die Berechnung transparent: z.B. „Maximaler Abzug: 0,9 P. (10% von 9,0 P.) – Fehlerdichte: mittel → tatsächlicher Abzug: -0,3 P.“\nVerteile den Gesamtabzug anteilig auf die Aufgaben (proportional zur Aufgabenpunktzahl). Zeige den Abzug je Aufgabe bei den Punkten NUR wenn er größer als 0 ist, z.B.: Punkte: 1,5/3,0 P. (davon -0,2 P. Rechtschreibung). Wenn kein Abzug: nur Punkte: 1,5/3,0 P. ohne Klammerzusatz.\nDer maximale Abzug beträgt ${rs} % der Gesamtpunktzahl.\nRechtschreibung im Feedback – je nach Feedbackstil:\na) Kurz: Rechtschreibung in einem Halbsatz erwähnen. Nur bei Abzug konkret benennen.\nb) Mittel: Rechtschreibung in einem Satz kommentieren. Häufigste Fehlerart kurz nennen.\nc) Ausführlich: Rechtschreibung und Grammatik in einem eigenen Abschnitt besprechen. Konkrete Fehler mit Beispielen nennen: „Du hast / Sie haben folgende Fehler gemacht: • [Fehler 1] → Korrektur: [richtige Schreibweise] • [Fehler 2] → Korrektur: [richtige Schreibweise]" Gesamteinschätzung zum Ausdrucksvermögen.\nd) Umfangreich: Ausführliche Grammatik- und Stilanalyse in einem eigenen Abschnitt. Alle Fehler einzeln aufführen mit Erklärung warum es ein Fehler ist: „• [Fehler] → Korrektur: [richtige Schreibweise] Erklärung: [warum ist das falsch?]" Einschätzung des Ausdrucksvermögens und der Fachsprache mit konkreten Verbesserungsvorschlägen. Hinweis ob Fehler die fachliche Verständlichkeit beeinträchtigen.

Feedbackstil – Anrede: „${anrede} …" (Klasse ${jg})

Feedbacklänge: ${fbLen}
${feedbackAnweisung}

Konsistenz-Selbstcheck: Nach je 5 Schülern prüfe intern: Sind meine letzten 5 Bewertungen konsistent mit dem Bewertungshorizont?

Pflichtprüfung vor jeder JSON-Ausgabe – für jeden Schüler einzeln:
1. Summenprüfung Punkte: Addiere alle Aufgabenpunkte und subtrahiere den Rechtschreibabzug. Das Ergebnis muss exakt mit dem "points"-Wert im JSON übereinstimmen.
2. Übereinstimmung Feedback/JSON: Die Endpunktzahl im Feedback-Text muss exakt mit dem "points"-Wert im JSON übereinstimmen. Wenn nicht – korrigiere den "points"-Wert im JSON auf die rechnerisch korrekte Summe.
3. Rechtschreibabzug-Prüfung: Die Summe der Einzelabzüge je Aufgabe muss exakt dem Gesamtabzug entsprechen.
Gib das JSON erst aus wenn alle drei Prüfungen bestanden sind.

═══════════════════════════════════════════════════════
ABLAUF NACH DER MODUSWAHL
═══════════════════════════════════════════════════════

Die folgenden Anweisungen greifen ERST, NACHDEM der Modus geklärt ist. Reihenfolge zwingend:
1. (nur Batch 1) Modus klären → 2. warten → 3. im gewählten Modus arbeiten → 4. JSON ausgeben (bei mehreren Batches mit „=== BATCH X ===“-Markierung).
Bei Batch 2/3 ist der Modus bereits geklärt – starte direkt bei Schritt 3.

Im INTERAKTIVEN Modus (Modus 1): Zeige für jeden Schüler folgendes Schema und warte auf Bestätigung, bevor du zum nächsten Schüler weitergehst:

Schüler-ID: [ID]
____________________________________________
AUFGABEN & ANTWORTEN DES SCHÜLERS:
Aufgabe 1: [Aufgabenstellung]
Antwort: [Antwort des Schülers]
Aufgabe 2: [Aufgabenstellung]
Antwort: [Antwort des Schülers]
...
____________________________________________
KI-BEWERTUNG:
Reasoning: [Interne Begründung je Aufgabe]
____________________________________________
Feedback: [Feedback-Text für den Schüler]
____________________________________________
Punkteübersicht:
Aufgabe 1: X von Y Punkten
Aufgabe 2: X von Y Punkten
...
Rechtschreibabzug: -Z Punkte
Endpunktzahl: X von Y Punkten
____________________________________________
Möchtest du etwas anpassen?
1. OK – weiter zum nächsten Schüler (reviewed: true)
2. Punkte anpassen
3. Feedback anpassen
4. Komplette Bewertung neu ausgeben

→ Bei „1. OK“: Setze reviewed: true für diesen Schüler und gehe zum nächsten.
→ Bei „2.“ / „3.“ / „4.“: Führe die Änderung durch, zeige das aktualisierte Schema und frage erneut.
→ Nach dem letzten Schüler dieses Batches: Gib das finale JSON für alle Schüler dieses Batches aus.

Im AUTOMATISCHEN Modus (Modus 2): Bewerte alle Schüler dieses Batches direkt nacheinander – ohne Zwischenrückfrage – und gib anschließend das finale JSON für den gesamten Batch aus.

Finales JSON – Ausgabeformat:
\`\`\`json
[
  {
    "id": 0,
    "points": 4.5,
    "reviewed": false,
    "reasoning": "Aufgabe 1: 3/5 Punkte – Begründung.\nAufgabe 2: 2/2 Punkte – Vollständig.\nGesamteindruck: ...",
    "feedback": "Punkteübersicht:\nAufgabe 1: 3/5 Punkte – Kernaspekte genannt, Begründung fehlt.\n\nPositive Aspekte:\nDu hast ...\n\nVerbesserungsvorschläge:\n...\n\nRechtschreibung:\n...\n\nEndpunktzahl: 4,5/15,0 Punkte"
  }
]
\`\`\`

Wichtig: Verwende sowohl im feedback- als auch im reasoning-Feld \n für Zeilenumbrüche zwischen Abschnitten. Jeder Abschnitt beginnt auf einer neuen Zeile.

Setze "reviewed": true für jeden Schüler, dessen Bewertung du gemeinsam mit dem Nutzer im interaktiven Review-Modus geprüft hast. Setze "reviewed": false wenn die Bewertung ohne Prüfung durch den Nutzer erstellt wurde.

Reasoning-Feld: Bei Feedbacklänge "Kurz" und "Mittel" das reasoning-Feld leer lassen ("reasoning": ""), da das Reasoning direkt ins Feedback integriert wird. Bei "Ausführlich" und "Umfangreich" ebenfalls leer lassen ("reasoning": ""), da das Feedback selbsterklärend ist.

${batchDeliveryBlock}═══════════════════════════════════════════════════════
MOODLE AI GRADER – BEWERTUNGSHORIZONT
═══════════════════════════════════════════════════════

${horizont || '[Kein Bewertungshorizont eingefügt – bitte zuerst Tab 1 verwenden]'}

═══════════════════════════════════════════════════════
MOODLE AI GRADER – SCHÜLERDATEN
═══════════════════════════════════════════════════════

[MOODLE_SCHÜLER_DATEN]
${studentenJson}`;
    }

    // Öffentliche Funktion: nutzt Override wenn vorhanden
    function buildKorrekturPrompt(students, batchNum = 1, totalBatches = 1) {
        if (appSettings.promptKorrektur) {
            const horizont      = document.getElementById('mag-horizont-input').value.trim();
            const studentenJson = JSON.stringify(students, null, 2);
            const customBody = appSettings.promptKorrektur
                .replace('[BEWERTUNGSHORIZONT_AUS_GENERATOR]', horizont || '[Kein Bewertungshorizont]')
                .replace('[MOODLE_SCHÜLER_DATEN]', studentenJson);
            // Batch-Kontext (Stopp-Regel / Fortsetzung) auch bei eigenem Prompt voranstellen,
            // damit Batch 1 zuerst den Modus erfragt.
            return buildBatchContextBlock(batchNum, totalBatches) + customBody;
        }
        return buildBatchContextBlock(batchNum, totalBatches) + getKorrekturPromptTemplate(students, batchNum, totalBatches);
    }

    // ── UI AUFBAUEN ──
    const toggleBtn = document.createElement('button');
    toggleBtn.id        = 'mag-toggle-btn';
    toggleBtn.title     = 'Moodle AI Grader';
    // Echtes Logo aus dem icons-Ordner anzeigen statt des 🪄-Emojis.
    // Fällt auf das Emoji zurück, falls das Bild nicht geladen werden kann.
    try {
        const iconUrl = chrome.runtime.getURL('icons/icon128.png');
        const iconImg = document.createElement('img');
        iconImg.src   = iconUrl;
        iconImg.alt   = 'MAG';
        iconImg.className = 'mag-toggle-icon';
        iconImg.addEventListener('error', () => {
            iconImg.remove();
            toggleBtn.textContent = '🪄';
        });
        toggleBtn.appendChild(iconImg);
    } catch (e) {
        toggleBtn.textContent = '🪄';
    }
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'moodle-ai-grader-panel';
    panel.innerHTML = `
        <header>
            <span>🪄 Moodle AI Grader</span>
            <div style="display:flex;gap:8px;align-items:center;">
                <button id="mag-btn-settings" title="Einstellungen (Alt+Klick für erweiterte Optionen)" class="mag-icon-btn">⚙️</button>
                <button id="mag-close" class="mag-icon-btn">✖</button>
            </div>
        </header>

        <div id="mag-zustaendig" style="display:none;"></div>

        <!-- TABS -->
        <div class="mag-tabs">
            <button class="mag-tab mag-tab-active" data-tab="horizont">📋 Bewertungshorizont</button>
            <button class="mag-tab" data-tab="korrektur">✅ Korrektur</button>
        </div>

        <!-- TAB 1: BEWERTUNGSHORIZONT -->
        <div class="mag-tab-content mag-content" id="mag-tab-horizont">
            <div class="mag-step">
                <div class="mag-step-header"><span class="mag-step-num">1</span> Fragen &amp; Punkte extrahieren</div>
                <p class="mag-step-desc">Liest alle Aufgaben und Maximalpunkte aus Moodle aus und generiert den Prompt für den Bewertungshorizont-Generator.</p>
                <div class="mag-flex-row">
                    <button id="mag-btn-horizont-prompt" class="mag-btn mag-btn-primary" style="flex:4;margin:0;">Prompt für Bewertungshorizont kopieren</button>
                    <button id="mag-btn-edit-horizont"   class="mag-btn mag-btn-outline" style="flex:1;margin:0;" title="Prompt bearbeiten">✏️</button>
                </div>
                <div id="mag-status-horizont" class="mag-status"></div>
            </div>

            <div class="mag-step">
                <div class="mag-step-header">
                    <span class="mag-step-num">2</span> Bewertungshorizont einfügen
                    <button id="mag-btn-clear-horizont" title="Bewertungshorizont löschen" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:14px;color:#999;" >🗑️</button>
                </div>
                <p class="mag-step-desc">Füge hier den fertigen Bewertungshorizont aus dem KI-Chat ein.</p>
                <textarea id="mag-horizont-input" rows="5" placeholder="Fertigen Bewertungshorizont hier einfügen …"></textarea>
            </div>

            <div class="mag-step" style="border-bottom:none;margin-bottom:0;">
                <div class="mag-step-header"><span class="mag-step-num">3</span> Weiter zur Korrektur</div>
                <p class="mag-step-desc">Wenn der Bewertungshorizont fertig ist, wechsle zum Korrektur-Tab.</p>
                <button id="mag-btn-goto-korrektur" class="mag-btn mag-btn-success">→ Zum Korrektur-Tab</button>
            </div>
        </div>

        <!-- TAB 2: KORREKTUR -->
        <div class="mag-tab-content mag-content" id="mag-tab-korrektur" style="display:none;">

            <div class="mag-step">
                <div class="mag-step-header"><span class="mag-step-num">4</span> Batch-Größe wählen</div>
                <p class="mag-step-desc">Das Plugin teilt die Schülerantworten in Batches auf. Die Größe wird automatisch vorgeschlagen.</p>
                <div style="display:flex;align-items:center;gap:8px;">
                    <label style="font-size:12px;color:#555;white-space:nowrap;">Schüler pro Batch:</label>
                    <select id="mag-batch-size" style="flex:1;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="8">8</option>
                        <option value="10">10</option>
                        <option value="12">12</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30 (alle)</option>
                    </select>
                    <button id="mag-btn-download-raw" class="mag-btn mag-btn-outline" style="margin:0;padding:6px 10px;white-space:nowrap;">📋 Rohdaten</button>
                </div>
            </div>

            <div class="mag-step">
                <div class="mag-step-header"><span class="mag-step-num">5</span> Batches kopieren &amp; in KI einfügen</div>
                <p class="mag-step-desc">Kopiere jeden Batch, füge ihn in die KI ein und warte auf die JSON-Antwort. Dann den nächsten Batch.</p>
                <div id="mag-batch-buttons" style="display:flex;flex-direction:column;gap:6px;"></div>
                <div id="mag-status-korrektur" class="mag-status"></div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
                    <button id="mag-btn-edit-korrektur" class="mag-btn mag-btn-outline" style="margin:0;padding:6px 10px;font-size:11px;">✏️ Prompt anpassen</button>
                </div>
            </div>

            <div class="mag-step">
                <div class="mag-step-header"><span class="mag-step-num">6</span> Alle JSON-Antworten einfügen</div>
                <p class="mag-step-desc">Füge alle KI-Antworten nacheinander in das Feld ein. Die Batch-Markierungen (=== BATCH 1 ===) helfen beim Erkennen der Blöcke.</p>
                <textarea id="mag-ai-json" rows="6" placeholder="Alle JSON-Antworten hier einfügen …&#10;&#10;=== BATCH 1 ===&#10;[{...}]&#10;=== ENDE BATCH 1 ===&#10;&#10;=== BATCH 2 ===&#10;[{...}]&#10;=== ENDE BATCH 2 ==="></textarea>
                <button id="mag-btn-validate-json" class="mag-btn mag-btn-primary" style="margin-top:6px;">🔍 Validieren &amp; prüfen</button>
                <div id="mag-status-validate" class="mag-status"></div>
            </div>

            <div class="mag-step" style="border-bottom:none;margin-bottom:0;">
                <div class="mag-step-header"><span class="mag-step-num">7</span> Bewertungen eintragen</div>
                <div class="mag-flex-row">
                    <button id="mag-btn-start-review" class="mag-btn mag-btn-success" style="margin:0;" disabled>Review starten</button>
                    <button id="mag-btn-paste-all"    class="mag-btn mag-btn-outline"  style="margin:0;" disabled>Alle eintragen</button>
                </div>
                <p id="mag-validate-hint" style="font-size:11px;color:#888;margin:6px 0 0;text-align:center;">Bitte zuerst validieren.</p>
            </div>
        </div>

        <!-- SETTINGS PANEL (normales Zahnrad) -->
        <div id="mag-settings-panel" style="display:none;">
            <div class="mag-content">
                <div class="mag-settings-title">⚙️ Einstellungen</div>
                <div class="mag-group">
                    <label>Fach</label>
                    <input type="text" id="mag-fach" placeholder="z. B. Biologie, Geschichte …">
                </div>
                <div class="mag-group">
                    <label>Jahrgang / Klassenstufe</label>
                    <input type="text" id="mag-jahrgang" placeholder="z. B. 10, 12 …">
                    <div class="mag-hint" id="mag-anrede-hint"></div>
                </div>
                <div class="mag-group">
                    <label>Kursniveau</label>
                    <select id="mag-kursniveau">
                        <option value="G">G – Gymnasial</option>
                        <option value="M">M – Mittel</option>
                        <option value="E">E – Einfach</option>
                    </select>
                </div>
                <div class="mag-group">
                    <label>Punkteschritte</label>
                    <select id="mag-punkteschritte">
                        <option value="0.1">0,1 – Feine Schritte (empfohlen)</option>
                        <option value="0.5">0,5 – Halbe Punkte</option>
                        <option value="1.0">1,0 – Nur ganze Punkte</option>
                    </select>
                </div>
                <div class="mag-group">
                    <label>Rechtschreibgewichtung</label>
                    <select id="mag-rechtschreibung">
                        <option value="0">0 % – Kein Punktabzug (nur Feedback)</option>
                        <option value="5">5 % – Sehr gering (z. B. Grundschule)</option>
                        <option value="10" selected>10 % – Leicht (Standard, Mittelstufe)</option>
                        <option value="15">15 % – Moderat (sprachbetonte Fächer)</option>
                        <option value="20">20 % – Erhöht (z. B. Deutsch, Fremdsprachen)</option>
                        <option value="25">25 % – Stark (Oberstufe, Klausuren)</option>
                        <option value="30">30 % – Sehr stark (z. B. Sprachprüfungen)</option>
                    </select>
                </div>
                <div class="mag-group">
                    <label>Feedbacklänge</label>
                    <select id="mag-feedbacklaenge">
                        <option value="Ausführlich">Ausführlich (Standard)</option>
                        <option value="Kurz">Kurz (1–2 Sätze)</option>
                        <option value="Mittel">Mittel (3–4 Sätze)</option>
                        <option value="Umfangreich">Umfangreich (Oberstufe)</option>
                    </select>
                </div>
                <div class="mag-group">
                    <label class="mag-checkbox-label">
                        <input type="checkbox" id="mag-remove-citations"> Quellenangaben entfernen <span style="color:#888;font-size:11px;">([web:1] etc.)</span>
                    </label>
                    <label class="mag-checkbox-label" style="margin-top:6px;">
                        <input type="checkbox" id="mag-ki-hinweis"> KI-Kommentar einfügen <span style="color:#888;font-size:11px;">(Transparenzhinweis am Ende)</span>
                    </label>
                </div>
                <div class="mag-flex-row">
                    <button id="mag-btn-save-settings"   class="mag-btn mag-btn-success" style="margin:0;">Speichern</button>
                    <button id="mag-btn-cancel-settings" class="mag-btn mag-btn-secondary" style="margin:0;">Abbrechen</button>
                </div>
            </div>
        </div>

        <!-- PROMPT EDITOR -->
        <div id="mag-prompt-editor" style="display:none;">
            <div class="mag-content">
                <div class="mag-settings-title" id="mag-prompt-editor-title">✏️ Prompt bearbeiten</div>
                <p style="font-size:12px;color:#666;margin:0 0 6px;">
                    Bearbeite den Prompt-Text direkt. Die Platzhalter
                    <code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:11px;">[MOODLE_AUFGABEN_DATEN]</code> und
                    <code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:11px;">[MOODLE_SCHÜLER_DATEN]</code>
                    werden beim Kopieren automatisch befüllt.
                </p>
                <div id="mag-prompt-modified-badge" style="display:none;font-size:11px;color:#e67e00;margin-bottom:6px;">⚠️ Prompt wurde angepasst – weicht vom Original ab.</div>
                <textarea id="mag-prompt-editor-text" style="width:100%;height:320px;font-family:monospace;font-size:11px;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;resize:vertical;line-height:1.5;"></textarea>
                <div class="mag-flex-row" style="margin-top:8px;">
                    <button id="mag-btn-save-prompt"   class="mag-btn mag-btn-success"   style="margin:0;">Speichern</button>
                    <button id="mag-btn-reset-prompt"  class="mag-btn mag-btn-outline"   style="margin:0;">↺ Original</button>
                    <button id="mag-btn-cancel-prompt" class="mag-btn mag-btn-secondary" style="margin:0;">Abbrechen</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // Hinweis zur Zustaendigkeit einblenden, sobald das Panel steht.
    (function magZustaendigkeitAnzeigen() {
        const box = panel.querySelector('#mag-zustaendig');
        if (!box) return;
        const z = magZustaendigkeit();
        if (z.wer === 'coach') {
            box.style.display = 'block';
            box.className = 'mag-zust mag-zust-warn';
            box.textContent = '⚠️ Diese Frage ist für den Moodle AI Coach gebaut — ihr '
                + 'Bewertungshorizont beginnt mit [moodle-ai-coach]. Du kannst sie trotzdem '
                + 'hier bewerten; gedacht ist sie für den Coach auf der Übersichtsseite.';
        } else if (z.wer === 'grader') {
            box.style.display = 'block';
            box.className = 'mag-zust mag-zust-ok';
            box.textContent = '✅ Diese Frage ist für den Moodle AI Grader gebaut.';
        } else if (!z.horizont) {
            box.style.display = 'block';
            box.className = 'mag-zust mag-zust-info';
            box.textContent = 'ℹ️ Diese Frage hat keinen Bewertungshorizont in Moodle. '
                + 'Leg ihn in Tab 1 an und trag ihn in die Frage ein — dann weiß auch der '
                + 'Moodle AI Coach, dass sie ihm nicht gehört.';
        }
    })();

    // ── REVIEW OVERLAY ──
    const reviewOverlay = document.createElement('div');
    reviewOverlay.id = 'mag-review-overlay';
    reviewOverlay.innerHTML = `
        <div id="mag-review-box">
            <header>
                <span id="rev-title">Bewertung</span>
                <span id="rev-counter" style="font-size:13px;opacity:.85;"></span>
            </header>
            <div class="mag-review-body">
                <div class="rev-block">
                    <strong>Schülerantwort</strong>
                    <textarea id="rev-answer" style="width:100%;min-height:80px;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;resize:vertical;font-family:Arial,sans-serif;font-size:13px;background:#f8f9fa;" readonly></textarea>
                </div>
                <div class="rev-reasoning-box" id="rev-reasoning-box">
                    <strong>KI-Begründung (nur für dich)</strong>
                    <div id="rev-reasoning"></div>
                </div>
                <div class="rev-block">
                    <strong>Punkte</strong>
                    <input type="text" id="rev-points" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;">
                </div>
                <div class="rev-block">
                    <strong>Feedback an Schüler</strong>
                    <textarea id="rev-feedback" rows="10" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;resize:vertical;"></textarea>
                </div>
            </div>
            <div class="mag-review-footer">
                <button id="rev-btn-apply"        class="mag-btn mag-btn-primary"   style="margin:0;">✅ Eintragen &amp; Weiter</button>
                <button id="rev-btn-skip"         class="mag-btn mag-btn-outline"   style="margin:0;">Überspringen</button>
                <button id="rev-btn-close-review" class="mag-btn mag-btn-secondary" style="margin:0;">Abbrechen</button>
            </div>
        </div>
    `;
    document.body.appendChild(reviewOverlay);

    // ── WARNING MODAL ──
    const warningModal = document.createElement('div');
    warningModal.id = 'mag-warning-modal';
    warningModal.innerHTML = `
        <div id="mag-warning-box">
            <div class="mag-warning-icon">⚠️</div>
            <h3 class="mag-warning-title">Bewertungen nicht geprüft</h3>
            <p class="mag-warning-text">Die KI hat diese Bewertungen ohne interaktive Prüfung erstellt. KI-Bewertungen können Fehler enthalten – bitte prüfe sie bevor du sie einträgst.</p>
            <div class="mag-warning-buttons">
                <button id="mag-warn-review"  class="mag-btn mag-btn-primary"   style="margin:0;">👁️ Review starten</button>
                <button id="mag-warn-confirm" class="mag-btn mag-btn-secondary" style="margin:0;">Trotzdem eintragen</button>
                <button id="mag-warn-cancel"  class="mag-btn mag-btn-outline"   style="margin:0;">Abbrechen</button>
            </div>
        </div>
    `;
    document.body.appendChild(warningModal);

    // ── EINSTELLUNGEN LADEN ──
    function applySettingsToForm() {
        const s = appSettings;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
        set('mag-fach',           s.fach || '');
        set('mag-jahrgang',       s.jahrgang || '');
        set('mag-kursniveau',     s.kursniveau || 'G');
        set('mag-punkteschritte', s.punkteschritte || '0.1');
        set('mag-rechtschreibung',s.rechtschreibung || '10');
        set('mag-feedbacklaenge', s.feedbacklaenge || 'Ausführlich');
        setChk('mag-remove-citations', !!s.removeCitations);
        setChk('mag-ki-hinweis',       s.kiHinweis !== false);
        updateAnredeHint();
    }

    function updateAnredeHint() {
        const hint = document.getElementById('mag-anrede-hint');
        if (!hint) return;
        const jg = parseInt(document.getElementById('mag-jahrgang')?.value, 10);
        if (!isNaN(jg)) {
            hint.textContent = jg >= 11 ? '→ Anrede im Feedback: „Sie haben …"' : '→ Anrede im Feedback: „Du hast …"';
        } else {
            hint.textContent = '';
        }
    }

    function saveSettingsFromForm(callback) {
        appSettings.fach            = document.getElementById('mag-fach').value.trim();
        appSettings.jahrgang        = document.getElementById('mag-jahrgang').value.trim();
        appSettings.kursniveau      = document.getElementById('mag-kursniveau').value;
        appSettings.punkteschritte  = document.getElementById('mag-punkteschritte').value;
        appSettings.rechtschreibung = document.getElementById('mag-rechtschreibung').value;
        appSettings.feedbacklaenge  = document.getElementById('mag-feedbacklaenge').value;
        appSettings.anonymize       = true; // immer aktiv
        appSettings.removeCitations = document.getElementById('mag-remove-citations').checked;
        appSettings.kiHinweis       = document.getElementById('mag-ki-hinweis').checked;
        if (typeof chrome !== 'undefined' && chrome.storage) {
            // Erst alten Eintrag löschen, dann neu setzen
            chrome.storage.local.remove('magSettings', () => {
                chrome.storage.local.set({ magSettings: appSettings }, () => {
                    if (callback) callback();
                });
            });
        } else {
            if (callback) callback();
        }
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['magSettings', 'magHorizont'], result => {
            if (result.magSettings) {
                // Vollständig überschreiben statt mergen um alte Werte zu vermeiden
                appSettings = Object.assign({}, defaultSettings, result.magSettings);
            }
            if (result.magHorizont) {
                const el = document.getElementById('mag-horizont-input');
                if (el) el.value = result.magHorizont;
            }
            applySettingsToForm();
        });
    } else {
        applySettingsToForm();
    }

    // ── STATUS MELDUNGEN ──
    function showStatus(id, msg, isError) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? '#c0392b' : '#27ae60';
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }

    // ── TAB WECHSEL ──
    function switchTab(tabName) {
        activeTab = tabName;
        document.querySelectorAll('.mag-tab').forEach(t => {
            t.classList.toggle('mag-tab-active', t.dataset.tab === tabName);
        });
        document.getElementById('mag-tab-horizont').style.display = tabName === 'horizont' ? 'block' : 'none';
        document.getElementById('mag-tab-korrektur').style.display = tabName === 'korrektur' ? 'block' : 'none';
    }

    document.querySelectorAll('.mag-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // ── PANEL SICHTBARKEIT ──
    const PANELS = ['mag-tab-horizont', 'mag-tab-korrektur', 'mag-settings-panel', 'mag-prompt-editor'];

    function showPanel(name) {
        // Tabs-Leiste: sichtbar nur bei Haupt-Ansicht
        document.querySelector('.mag-tabs').style.display = name === 'main' ? 'flex' : 'none';
        PANELS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (name === 'main') {
                // Beide Tab-Inhalte: nur aktiver Tab sichtbar
                if (id === 'mag-tab-horizont') el.style.display = activeTab === 'horizont' ? 'block' : 'none';
                else if (id === 'mag-tab-korrektur') el.style.display = activeTab === 'korrektur' ? 'block' : 'none';
                else el.style.display = 'none';
            } else {
                el.style.display = id === name ? 'block' : 'none';
            }
        });
    }

    // Alias für Lesbarkeit
    function showMainView() { showPanel('main'); }

    toggleBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('mag-close').addEventListener('click', () => {
        panel.style.display = 'none';
    });

    // ── ZAHNRAD: normaler Klick = Einstellungen, Alt+Klick = Erweitert ──
    document.getElementById('mag-btn-settings').addEventListener('click', () => {
        applySettingsToForm();
        showPanel('mag-settings-panel');
    });

    document.getElementById('mag-jahrgang').addEventListener('input', updateAnredeHint);

    document.getElementById('mag-btn-save-settings').addEventListener('click', () => {
        // Custom-Prompts zurücksetzen wenn Parameter geändert wurden
        appSettings.promptHorizont  = null;
        appSettings.promptKorrektur = null;
        saveSettingsFromForm(() => {
            showMainView();
            alert('✅ Einstellungen gespeichert!');
        });
    });

    document.getElementById('mag-btn-cancel-settings').addEventListener('click', showMainView);



    // ── PROMPT EDITOR ──
    let promptEditorTarget = null; // 'horizont' | 'korrektur'

    function openPromptEditor(target) {
        promptEditorTarget = target;
        const isHorizont = target === 'horizont';
        document.getElementById('mag-prompt-editor-title').textContent =
            isHorizont ? '✏️ 1a – Bewertungshorizont-Prompt' : '✏️ 1b – Korrektur-Prompt';

        // Aktuellen Text laden: Override wenn vorhanden, sonst Original
        const current = isHorizont
            ? (appSettings.promptHorizont || getTemplateForEditor(target))
            : (appSettings.promptKorrektur || getTemplateForEditor(target));

        document.getElementById('mag-prompt-editor-text').value = current;

        // Badge zeigen wenn Override aktiv
        const hasOverride = isHorizont ? !!appSettings.promptHorizont : !!appSettings.promptKorrektur;
        document.getElementById('mag-prompt-modified-badge').style.display = hasOverride ? 'block' : 'none';

        // Panel wechseln
        showPanel('mag-prompt-editor');
    }

    function getTemplateForEditor(target) {
        // Gibt den Template-Text ohne die dynamischen Daten zurück
        if (target === 'horizont') {
            return getHorizontPromptTemplate([]).split('\n' + JSON.stringify([], null, 2))[0]
                .replace('\n[MOODLE_AUFGABEN_DATEN]\n[]', '\n[MOODLE_AUFGABEN_DATEN]');
        } else {
            return getKorrekturPromptTemplate([]).split('\n' + JSON.stringify([], null, 2))[0]
                .replace('\n[MOODLE_SCHÜLER_DATEN]\n[]', '\n[MOODLE_SCHÜLER_DATEN]');
        }
    }

    document.getElementById('mag-btn-edit-horizont').addEventListener('click', () => openPromptEditor('horizont'));
    document.getElementById('mag-btn-edit-korrektur').addEventListener('click', () => openPromptEditor('korrektur'));

    document.getElementById('mag-btn-save-prompt').addEventListener('click', () => {
        const text = document.getElementById('mag-prompt-editor-text').value;
        if (promptEditorTarget === 'horizont') {
            appSettings.promptHorizont = text;
        } else {
            appSettings.promptKorrektur = text;
        }
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ magSettings: appSettings });
        }
        showMainView();
        showStatus(promptEditorTarget === 'horizont' ? 'mag-status-horizont' : 'mag-status-korrektur',
            '✅ Prompt gespeichert!');
    });

    document.getElementById('mag-btn-reset-prompt').addEventListener('click', () => {
        if (!confirm('Prompt auf Original zurücksetzen? Deine Änderungen gehen verloren.')) return;
        if (promptEditorTarget === 'horizont') {
            appSettings.promptHorizont = null;
        } else {
            appSettings.promptKorrektur = null;
        }
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ magSettings: appSettings });
        }
        // Editor neu laden mit Original
        document.getElementById('mag-prompt-editor-text').value = getTemplateForEditor(promptEditorTarget);
        document.getElementById('mag-prompt-modified-badge').style.display = 'none';
        showStatus(promptEditorTarget === 'horizont' ? 'mag-status-horizont' : 'mag-status-korrektur',
            '✅ Original wiederhergestellt.');
        showMainView();
    });

    document.getElementById('mag-btn-cancel-prompt').addEventListener('click', showMainView);

    // ── TAB 1: BEWERTUNGSHORIZONT-PROMPT ──
    document.getElementById('mag-btn-horizont-prompt').addEventListener('click', () => {
        const questions = getQuestionsData();
        if (!questions || questions.length === 0) return;
        // Einstellungen frisch aus Storage laden bevor Prompt gebaut wird
        const buildAndCopy = () => {
            const prompt = buildHorizontPrompt(questions);
            navigator.clipboard.writeText(prompt)
                .then(() => showStatus('mag-status-horizont', '✅ Prompt für Bewertungshorizont kopiert!'))
                .catch(() => showStatus('mag-status-horizont', '❌ Kopieren fehlgeschlagen.', true));
        };
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['magSettings'], result => {
                if (result.magSettings) appSettings = Object.assign({}, defaultSettings, result.magSettings);
                buildAndCopy();
            });
        } else {
            buildAndCopy();
        }
    });

    // Horizont automatisch in Storage speichern wenn sich der Text ändert
    document.getElementById('mag-horizont-input').addEventListener('input', () => {
        const val = document.getElementById('mag-horizont-input').value;
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ magHorizont: val });
        }
    });

    document.getElementById('mag-btn-clear-horizont').addEventListener('click', () => {
        if (document.getElementById('mag-horizont-input').value.trim() === '') return;
        if (!confirm('Bewertungshorizont wirklich löschen?')) return;
        document.getElementById('mag-horizont-input').value = '';
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove('magHorizont');
        }
    });

    document.getElementById('mag-btn-goto-korrektur').addEventListener('click', () => {
        const horizont = document.getElementById('mag-horizont-input').value.trim();
        if (!horizont) {
            if (!confirm('Kein Bewertungshorizont eingefügt. Trotzdem zum Korrektur-Tab wechseln?')) return;
        }
        switchTab('korrektur');
        applyBatchDefault();
    });

    // ── TAB 2: BATCH-SYSTEM ──

    // Vorgeschlagene Batch-Größe je Feedbacklänge
    const BATCH_DEFAULTS = { 'Kurz': 30, 'Mittel': 15, 'Ausführlich': 10, 'Umfangreich': 6 };
    let validatedData = null; // gespeicherte validierte Daten

    function getBatchSize() {
        return parseInt(document.getElementById('mag-batch-size').value, 10) || 10;
    }

    function renderBatchButtons() {
        const students = getStudentData();
        if (!students || students.length === 0) return;
        const batchSize  = getBatchSize();
        const total      = students.length;
        const numBatches = Math.ceil(total / batchSize);
        const container  = document.getElementById('mag-batch-buttons');
        container.innerHTML = '';

        for (let b = 0; b < numBatches; b++) {
            const start  = b * batchSize;
            const end    = Math.min(start + batchSize, total);
            const batch  = students.slice(start, end);
            const isLast = b === numBatches - 1;

            const btn = document.createElement('button');
            btn.className = 'mag-btn mag-btn-primary';
            btn.style.margin = '0';
            btn.textContent = `Batch ${b + 1} kopieren (Schüler ${start + 1}–${end})`;
            btn.addEventListener('click', () => {
                const horizont = document.getElementById('mag-horizont-input').value.trim();
                if (!horizont) {
                    showStatus('mag-status-korrektur', '⚠️ Kein Bewertungshorizont – bitte erst Tab 1 verwenden.', true);
                    return;
                }
                // Einstellungen frisch aus Storage laden bevor Prompt gebaut wird
                const buildAndCopy = () => {
                    const prompt = buildKorrekturPromptBatch(batch, b + 1, numBatches);
                    navigator.clipboard.writeText(prompt).then(() => {
                        const nextMsg = isLast
                            ? `✅ Batch ${b + 1} kopiert! Füge jetzt alle KI-Antworten nacheinander in das Feld unten ein und klicke auf Validieren.`
                            : `✅ Batch ${b + 1} kopiert! Füge die KI-Antwort unten ein, dann kopiere Batch ${b + 2}.`;
                        showStatus('mag-status-korrektur', nextMsg);
                    }).catch(() => showStatus('mag-status-korrektur', '❌ Kopieren fehlgeschlagen.', true));
                };
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.get(['magSettings'], result => {
                        if (result.magSettings) appSettings = Object.assign({}, defaultSettings, result.magSettings);
                        buildAndCopy();
                    });
                } else {
                    buildAndCopy();
                }
            });
            container.appendChild(btn);
        }
    }

    // Batch-Größe automatisch vorschlagen wenn Tab geöffnet wird
    function applyBatchDefault() {
        const fl  = appSettings.feedbacklaenge || 'Ausführlich';
        const def = BATCH_DEFAULTS[fl] || 10;
        const sel = document.getElementById('mag-batch-size');
        // Nächste Option wählen
        let best = '10';
        Array.from(sel.options).forEach(o => {
            if (parseInt(o.value) <= def) best = o.value;
        });
        sel.value = best;
        renderBatchButtons();
    }

    document.getElementById('mag-batch-size').addEventListener('change', renderBatchButtons);

    // Beim Tab-Wechsel Buttons rendern
    const origSwitchTab = switchTab;
    switchTab = function(tabName) {
        origSwitchTab(tabName);
        if (tabName === 'korrektur') {
            applyBatchDefault();
        }
    };

    // Korrektur-Prompt für einen Batch generieren.
    // Die Batch-Info wird jetzt in den Prompt integriert (Stopp-Regel oben,
    // Liefermechanismus unten) statt widersprüchlich ans Ende angehängt.
    function buildKorrekturPromptBatch(students, batchNum, totalBatches) {
        return buildKorrekturPrompt(students, batchNum, totalBatches);
    }

    // ── ROHDATEN KOPIEREN ──
    document.getElementById('mag-btn-download-raw').addEventListener('click', () => {
        const questions = getQuestionsData();
        const students  = getStudentData();
        if (!questions || !students) return;
        const exportData = {
            exportiert_am: new Date().toLocaleString('de-DE'),
            fach:          appSettings.fach     || '',
            jahrgang:      appSettings.jahrgang || '',
            aufgaben:      questions,
            schueler:      students
        };
        navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
            .then(() => showStatus('mag-status-korrektur', '✅ Rohdaten kopiert!'))
            .catch(() => showStatus('mag-status-korrektur', '❌ Kopieren fehlgeschlagen.', true));
    });

    // ── JSON VALIDIERUNG ──
    function parseAllBatches(raw) {
        const results = [];

        // Strategie 1: Batch-Markierungen === BATCH N === ... === ENDE BATCH N ===
        const batchRegex = /=== BATCH \d+ ===\s*([\s\S]*?)\s*=== ENDE BATCH \d+ ===/g;
        let match;
        let foundBatches = false;
        while ((match = batchRegex.exec(raw)) !== null) {
            foundBatches = true;
            const clean = match[1].replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);
            results.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        }
        if (foundBatches) return results;

        // Strategie 2: Mehrere ```json ... ``` Blöcke
        const codeBlockRegex = /```json\s*([\s\S]*?)```/g;
        let foundBlocks = false;
        while ((match = codeBlockRegex.exec(raw)) !== null) {
            foundBlocks = true;
            const parsed = JSON.parse(match[1].trim());
            results.push(...(Array.isArray(parsed) ? parsed : [parsed]));
        }
        if (foundBlocks) return results;

        // Strategie 3: Alle [...] Arrays im Text finden
        const arrayRegex = /\[\s*\{[\s\S]*?\}\s*\]/g;
        let foundArrays = false;
        while ((match = arrayRegex.exec(raw)) !== null) {
            try {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id !== undefined) {
                    foundArrays = true;
                    results.push(...parsed);
                }
            } catch(e) { /* ungültiger Block, weiter */ }
        }
        if (foundArrays) return results;

        // Strategie 4: Gesamten Text als ein JSON parsen (letzter Fallback)
        const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        return Array.isArray(parsed) ? parsed : [parsed];
    }

    function validateData(data) {
        const ids     = data.map(d => d.id).sort((a, b) => a - b);
        const missing = [];
        const dupes   = [];
        const seen    = new Set();

        for (let i = 0; i < ids.length; i++) {
            if (seen.has(ids[i])) dupes.push(ids[i]);
            seen.add(ids[i]);
        }
        // Lücken finden
        if (ids.length > 0) {
            for (let i = ids[0]; i <= ids[ids.length - 1]; i++) {
                if (!seen.has(i)) missing.push(i);
            }
        }
        return { missing, dupes, ids };
    }

    document.getElementById('mag-btn-validate-json').addEventListener('click', () => {
        const raw = document.getElementById('mag-ai-json').value.trim();
        if (!raw) {
            showStatus('mag-status-validate', '⚠️ Bitte zuerst JSON einfügen.', true);
            return;
        }
        try {
            const data = parseAllBatches(raw).map(item => ({
                ...item,
                feedback:  cleanCitations(item.feedback  || ''),
                reasoning: cleanCitations(item.reasoning || '')
            }));

            const { missing, dupes, ids } = validateData(data);

            if (dupes.length > 0) {
                showStatus('mag-status-validate', `❌ Doppelte IDs gefunden: ${dupes.join(', ')} – bitte prüfen.`, true);
                return;
            }
            if (missing.length > 0) {
                showStatus('mag-status-validate', `❌ Fehlende IDs: ${missing.join(', ')} – bitte fehlenden Batch einfügen.`, true);
                return;
            }

            // Alles OK
            validatedData = data;
            showStatus('mag-status-validate', `✅ ${data.length} Schüler vollständig (IDs ${ids[0]}–${ids[ids.length-1]}). Bereit zum Eintragen.`);

            // Buttons freischalten
            document.getElementById('mag-btn-start-review').disabled = false;
            document.getElementById('mag-btn-paste-all').disabled    = false;
            document.getElementById('mag-validate-hint').style.display = 'none';

        } catch (e) {
            showStatus('mag-status-validate', '❌ Ungültiges JSON: ' + e.message, true);
        }
    });

    function pasteAll(data) {
        let count = 0;
        data.forEach(item => { if (writeToMoodle(item.id, item.points, item.feedback)) count++; });
        alert(`✅ ${count} von ${data.length} Bewertungen eingetragen!`);
    }

    document.getElementById('mag-btn-paste-all').addEventListener('click', () => {
        const data = validatedData;
        if (!data) return;
        const allReviewed = data.every(item => item.reviewed === true);
        if (allReviewed) {
            pasteAll(data);
        } else {
            document.getElementById('mag-warning-modal').style.display = 'flex';
            const btnConfirm = document.getElementById('mag-warn-confirm');
            const btnReview  = document.getElementById('mag-warn-review');
            const btnCancel  = document.getElementById('mag-warn-cancel');
            const close = () => document.getElementById('mag-warning-modal').style.display = 'none';
            btnConfirm.onclick = () => { close(); pasteAll(data); };
            btnReview.onclick  = () => {
                close();
                reviewData  = data;
                reviewIndex = 0;
                reviewOverlay.style.display = 'flex';
                updateReviewUI();
            };
            btnCancel.onclick = close;
        }
    });

    document.getElementById('mag-btn-start-review').addEventListener('click', () => {
        const data = validatedData;
        if (!data || data.length === 0) return;
        reviewData  = data;
        reviewIndex = 0;
        reviewOverlay.style.display = 'flex';
        updateReviewUI();
    });

    // ── REVIEW ──
    document.getElementById('rev-btn-close-review').addEventListener('click', () => {
        reviewOverlay.style.display = 'none';
    });
    reviewOverlay.addEventListener('click', e => {
        if (e.target === reviewOverlay) reviewOverlay.style.display = 'none';
    });

    function updateReviewUI() {
        if (reviewIndex >= reviewData.length) {
            reviewOverlay.style.display = 'none';
            alert(`✅ Review abgeschlossen! ${reviewData.length} Schüler bewertet.`);
            return;
        }
        const item = reviewData[reviewIndex];
        document.getElementById('rev-title').innerText     = `Bewertung – Schüler ${item.id + 1}`;
        document.getElementById('rev-counter').innerText   = `${reviewIndex + 1} / ${reviewData.length}`;
        const answerEl = document.getElementById('rev-answer');
        answerEl.value = getStudentAnswerFromDOM(item.id);
        const reasoning = (item.reasoning || '').replace(/\\n/g, '\n').trim();
        const reasoningBox = document.getElementById('rev-reasoning-box');
        if (reasoning) {
            document.getElementById('rev-reasoning').innerText = reasoning;
            reasoningBox.style.display = 'block';
        } else {
            reasoningBox.style.display = 'none';
        }
        document.getElementById('rev-points').value        = formatPoints(item.points);
        document.getElementById('rev-feedback').value      = (item.feedback || '').replace(/\\n/g, '\n');
    }

    document.getElementById('rev-btn-apply').addEventListener('click', () => {
        const pts = document.getElementById('rev-points').value;
        const fb  = document.getElementById('rev-feedback').value;
        if (!writeToMoodle(reviewData[reviewIndex].id, pts, fb)) {
            alert(`⚠️ Feld für Schüler ${reviewData[reviewIndex].id} nicht gefunden!`);
        }
        reviewIndex++;
        updateReviewUI();
    });

    document.getElementById('rev-btn-skip').addEventListener('click', () => {
        reviewIndex++;
        updateReviewUI();
    });

})();
