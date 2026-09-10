/*
 * Moodle AI Aufgaben-Grader — content.js
 * Version 1.0.0
 *
 * Erscheint im Aufgaben-Modul (mod/assign) in der Bewerten-Ansicht:
 *  - action=grading  → Übersichtstabelle: Abgaben anonymisiert als ZIP + CSV
 *                       herunterladen, Auftrags-Prompt erzeugen.
 *  - action=grader   → Einzelansicht: Note + Feedback aus einer zuvor
 *                       hochgeladenen CSV automatisch eintragen und mit
 *                       "Speichern und nächste anzeigen" weiterschalten.
 *
 * Bewusst subjekt- und lehrkraftunabhängig: die Erweiterung kennt nur
 * Moodle-Mechanik, nie Bewertungsinhalte. Siehe Begleitdatei
 * moodle-ai-aufgaben-grader.md in 3-moodle-erweiterungen.
 *
 * WICHTIG (Stand Erstbau): Die DOM-Selektoren für die Aufgaben-Bewerten-
 * Seiten sind nach dem Moodle-Standardschema gewählt, aber noch NICHT an
 * einer echten Live-Instanz geprüft (anders als die Selektoren der
 * Quiz-Erweiterungen, die mehrfach verifiziert sind). Erster Live-Test
 * zeigt, welche Fallbacks tatsächlich greifen — Protokoll im Panel und in
 * der Konsole (Filter "[ABG]") hilft dabei.
 *
 * © 2026 A. Spielhoff — CC BY-SA 4.0
 */
(function () {
  'use strict';

  const PREFIX = '[ABG]';
  function logKonsole(...args) { console.log(PREFIX, ...args); }

  // ---------------------------------------------------------------------
  // 1 · Seiten-Erkennung (Gegenprobe, siehe 1-chrome-mv3 Abschnitt 2)
  // ---------------------------------------------------------------------
  const url = new URL(location.href);
  if (!/\/mod\/assign\/view\.php/.test(url.pathname)) return;
  const action = url.searchParams.get('action');
  if (action !== 'grading' && action !== 'grader') return;

  const cmid = url.searchParams.get('id'); // Kurs-Modul-ID der Aufgabe
  if (!cmid) return;

  // Landmarke, die es auf einer echten Aufgaben-Bewerten-Seite geben muss.
  // Ohne sie könnte "mod/assign/view.php" theoretisch auch von einer
  // fremden Anwendung mit ähnlichem Pfad kommen.
  function istEchteAssignSeite() {
    return !!(document.querySelector('body#page-mod-assign-view')
      || document.querySelector('[data-region="grade-panel"]')
      || document.querySelector('#mod_assign_grading_table')
      || document.querySelector('input[name="grade"]')
      || document.title.match(/Aufgabe|Assignment/i));
  }
  if (!istEchteAssignSeite()) { logKonsole('Keine erkennbare Assign-Seite, breche ab.'); return; }

  if (document.getElementById('abg-panel') || document.getElementById('abg-toggle')) return; // kein Doppel-Einbau

  // ---------------------------------------------------------------------
  // 2 · Kleine Hilfsfunktionen
  // ---------------------------------------------------------------------
  const HAT_STORAGE = (typeof chrome !== 'undefined' && !!chrome.storage);

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (!HAT_STORAGE) return resolve({});
      chrome.storage.local.get(keys, (r) => resolve(r || {}));
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      if (!HAT_STORAGE) return resolve();
      chrome.storage.local.set(obj, () => resolve());
    });
  }
  function storageRemove(keys) {
    return new Promise((resolve) => {
      if (!HAT_STORAGE) return resolve();
      chrome.storage.local.remove(keys, () => resolve());
    });
  }

  function qparam(href, name) {
    try { return new URL(href, location.href).searchParams.get(name); }
    catch (e) { return null; }
  }

  function version() {
    try {
      return (chrome && chrome.runtime && chrome.runtime.getManifest)
        ? chrome.runtime.getManifest().version : '';
    } catch (e) { return ''; }
  }

  function dateiNameSicher(s) {
    return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  }

  function csvZelle(s) {
    s = (s === undefined || s === null) ? '' : String(s);
    if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // CSV lesen: Trennzeichen ; , UTF-8-BOM wird toleriert, einfache
  // Anführungszeichen-Behandlung (reicht für Note/Feedback ohne Formeln).
  function csvLesen(text) {
    text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const zeilen = [];
    let feld = '', zeile = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { feld += '"'; i++; } else { inQuotes = false; }
        } else feld += c;
      } else if (c === '"') { inQuotes = true; }
      else if (c === ';') { zeile.push(feld); feld = ''; }
      else if (c === '\n') { zeile.push(feld); feld = ''; zeilen.push(zeile); zeile = []; }
      else feld += c;
    }
    if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
    return zeilen.filter((z) => z.some((f) => f.trim() !== ''));
  }

  // ---------------------------------------------------------------------
  // 3 · Kurs-ID ermitteln (für die kursweite Kürzel-ID-Karte)
  // ---------------------------------------------------------------------
  function ermittleCourseKey() {
    const link = document.querySelector('a[href*="/course/view.php?id="]')
      || document.querySelector('nav.breadcrumb a[href*="course/view.php"]');
    if (link) {
      const cid = qparam(link.href, 'id');
      if (cid) return 'kurs' + cid;
    }
    logKonsole('Konnte Kurs-ID nicht ermitteln, verwende Aufgaben-ID als Ersatzschlüssel (Kürzel gelten dann nur für diese Aufgabe).');
    return 'cmid' + cmid;
  }

  // ---------------------------------------------------------------------
  // 4 · Kürzel-ID-Verwaltung
  // ---------------------------------------------------------------------
  function initialen(name) {
    const teile = name.trim().split(/\s+/).filter(Boolean);
    if (teile.length === 0) return 'XX';
    const vorname = teile[0];
    const nachname = teile[teile.length - 1];
    return ((vorname[0] || 'X') + (nachname[0] || 'X')).toUpperCase();
  }

  async function kuerzelKarteLaden(courseKey) {
    const key = 'abgKuerzel_' + courseKey;
    const data = await storageGet([key]);
    return data[key] || {}; // { userid: { kuerzel, name } }
  }
  async function kuerzelKarteSpeichern(courseKey, karte) {
    await storageSet({ ['abgKuerzel_' + courseKey]: karte });
  }

  // teilnehmer: [{userid, name}] — neue SuS bekommen fortlaufend die
  // nächste freie Nummer, bestehende behalten ihr Kürzel unverändert.
  async function kuerzelZuweisen(courseKey, teilnehmer) {
    const karte = await kuerzelKarteLaden(courseKey);
    let maxNr = 0;
    Object.values(karte).forEach((e) => {
      const m = /-(\d+)$/.exec(e.kuerzel || '');
      if (m) maxNr = Math.max(maxNr, parseInt(m[1], 10));
    });
    const neue = teilnehmer
      .filter((t) => !karte[t.userid])
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    neue.forEach((t) => {
      maxNr += 1;
      karte[t.userid] = { kuerzel: initialen(t.name) + '-' + String(maxNr).padStart(2, '0'), name: t.name };
    });
    await kuerzelKarteSpeichern(courseKey, karte);
    return karte;
  }

  // ---------------------------------------------------------------------
  // 5 · Minimaler ZIP-Bau (nur "gespeichert", keine Kompression nötig für
  //     PDFs — spart eine Zusatzbibliothek im Repo)
  // ---------------------------------------------------------------------
  const CRC_TABELLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function u16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
  function u32(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]; }
  function dosZeit() {
    const d = new Date();
    const zeit = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
    const datum = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    return { zeit, datum };
  }

  // dateien: [{ name: 'MB-03/arbeit.pdf', data: Uint8Array }]
  function zipBauen(dateien) {
    const { zeit, datum } = dosZeit();
    const teile = [];
    const zentral = [];
    let offset = 0;
    const enc = new TextEncoder();

    dateien.forEach((f) => {
      const nameBytes = enc.encode(f.name.replace(/\\/g, '/'));
      const data = f.data;
      const crc = crc32(data);

      const lokalHeader = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, // Local file header signature
        20, 0,                   // Version needed
        0, 0,                    // Flags
        0, 0,                    // Methode 0 = gespeichert (keine Kompression)
        ...u16(zeit), ...u16(datum),
        ...u32(crc),
        ...u32(data.length), ...u32(data.length), // komprimiert = unkomprimiert
        ...u16(nameBytes.length), ...u16(0),
      ]);
      teile.push(lokalHeader, nameBytes, data);

      const zentralHeader = new Uint8Array([
        0x50, 0x4b, 0x01, 0x02,
        20, 0, 20, 0,
        0, 0,
        0, 0,
        ...u16(zeit), ...u16(datum),
        ...u32(crc),
        ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]);
      zentral.push(zentralHeader, nameBytes);
      offset += lokalHeader.length + nameBytes.length + data.length;
    });

    const zentralStart = offset;
    let zentralGroesse = 0;
    zentral.forEach((t) => { zentralGroesse += t.length; });

    const eocd = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06,
      0, 0, 0, 0,
      ...u16(dateien.length), ...u16(dateien.length),
      ...u32(zentralGroesse),
      ...u32(zentralStart),
      0, 0,
    ]);

    return new Blob([...teile, ...zentral, eocd], { type: 'application/zip' });
  }

  function download(blob, dateiname) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  // ---------------------------------------------------------------------
  // 6 · Panel-Grundgerüst
  // ---------------------------------------------------------------------
  function panelBauen() {
    const wrap = document.createElement('div');
    wrap.id = 'abg-panel';
    wrap.innerHTML = `
      <div class="abg-head">
        <strong>Moodle AI Aufgaben-Grader</strong>
        <span class="abg-version">v${version()}</span>
        <span class="abg-close" title="Einklappen">–</span>
      </div>
      <div class="abg-body"></div>
    `;
    document.body.appendChild(wrap);

    const toggle = document.createElement('button');
    toggle.id = 'abg-toggle';
    toggle.textContent = 'Abgabengrader';
    toggle.hidden = true;
    document.body.appendChild(toggle);

    wrap.querySelector('.abg-close').addEventListener('click', () => {
      wrap.hidden = true; toggle.hidden = false;
    });
    toggle.addEventListener('click', () => { wrap.hidden = false; toggle.hidden = true; });

    return wrap.querySelector('.abg-body');
  }

  function logZeile(body, text, art) {
    let log = body.querySelector('.abg-log');
    if (!log) {
      log = document.createElement('div');
      log.className = 'abg-log';
      body.appendChild(log);
    }
    const z = document.createElement('div');
    if (art) z.className = 'abg-' + art;
    const zeit = new Date().toLocaleTimeString('de-DE');
    z.textContent = `[${zeit}] ${text}`;
    log.appendChild(z);
    log.scrollTop = log.scrollHeight;
    logKonsole(text);
  }

  // =======================================================================
  // MODUS A: Übersichtstabelle (action=grading)
  // =======================================================================
  async function modusUebersicht(body) {
    const courseKey = ermittleCourseKey();

    const schritt1 = document.createElement('div');
    schritt1.className = 'abg-schritt';
    schritt1.innerHTML = `
      <h4>① Abgaben herunterladen</h4>
      <label for="abg-art">Feedback-Stufe</label>
      <select id="abg-art">
        <option value="zwischen">Zwischenfeedback (ohne Note)</option>
        <option value="abschluss">Abschlussfeedback (mit Note)</option>
      </select>
      <button id="abg-download">ZIP + CSV + Prompt erzeugen</button>
      <div class="abg-hinweis">Baut das ZIP selbst aus der Tabelle — kein Umweg über Moodles eigenen Bulk-Export. Nur Kürzel-IDs in Dateinamen, Klarnamen bleiben in Moodle.</div>
    `;
    body.appendChild(schritt1);

    const schritt2 = document.createElement('div');
    schritt2.className = 'abg-schritt';
    schritt2.innerHTML = `
      <h4>② Bewertungen einspielen</h4>
      <label for="abg-csv">Ausgefüllte CSV (Kürzel-ID;Note;Feedback)</label>
      <input type="file" id="abg-csv" accept=".csv,text/csv">
      <button id="abg-start" abg-disabled>Eintragen starten</button>
      <div class="abg-hinweis">Öffnet nacheinander jede Bewerten-Einzelseite, trägt Note + Feedback ein und speichert automatisch weiter. Bitte den Tab währenddessen nicht schließen.</div>
    `;
    body.appendChild(schritt2);

    schritt1.querySelector('#abg-download').addEventListener('click', () => {
      herunterladen(body, courseKey, schritt1.querySelector('#abg-art').value)
        .catch((e) => logZeile(body, 'Fehler beim Herunterladen: ' + e.message, 'fehler'));
    });

    let ausgewaehlteCsv = null;
    schritt2.querySelector('#abg-csv').addEventListener('change', (ev) => {
      ausgewaehlteCsv = ev.target.files[0] || null;
      schritt2.querySelector('#abg-start').removeAttribute('abg-disabled');
    });
    schritt2.querySelector('#abg-start').addEventListener('click', async () => {
      if (!ausgewaehlteCsv) { logZeile(body, 'Bitte zuerst eine CSV-Datei wählen.', 'fehler'); return; }
      try {
        await bewertungenVorbereiten(body, courseKey, ausgewaehlteCsv);
      } catch (e) {
        logZeile(body, 'Fehler beim Einlesen der CSV: ' + e.message, 'fehler');
      }
    });
  }

  // ---- Tabelle auslesen ------------------------------------------------
  const KOPFVARIANTEN = {
    name: ['Vollständiger Name', 'Name', 'Full name'],
    status: ['Status'],
    abgabe: ['Datei-Einreichungen', 'Online-Text', 'Abgabe', 'Submission'],
  };

  function findeSpaltenTabelle() {
    let tabelle = document.querySelector('#mod_assign_grading_table');
    if (!tabelle) {
      // Fallback: irgendeine Tabelle, deren Kopfzeile "Vollständiger Name" trägt.
      tabelle = Array.from(document.querySelectorAll('table')).find((t) => {
        const kopf = t.querySelector('thead');
        return kopf && /Vollständiger Name|Full name/i.test(kopf.textContent);
      });
    }
    return tabelle;
  }

  function spaltenIndex(tabelle) {
    const kopfZellen = Array.from(tabelle.querySelectorAll('thead th, thead td'));
    const idx = {};
    Object.keys(KOPFVARIANTEN).forEach((schluessel) => {
      const varianten = KOPFVARIANTEN[schluessel];
      const i = kopfZellen.findIndex((z) => varianten.some((v) => z.textContent.trim().toLowerCase().includes(v.toLowerCase())));
      if (i >= 0) idx[schluessel] = i;
    });
    return idx;
  }

  const STATUS_ABGEGEBEN = ['abgegeben', 'submitted'];
  const STATUS_AUSSCHLUSS = ['keine abgabe', 'no submission'];

  function tabelleAuslesen() {
    const tabelle = findeSpaltenTabelle();
    if (!tabelle) throw new Error('Bewertungstabelle nicht gefunden (Selektor prüfen).');
    const idx = spaltenIndex(tabelle);
    if (idx.name === undefined) throw new Error('Spalte "Vollständiger Name" nicht gefunden.');

    const zeilen = Array.from(tabelle.querySelectorAll('tbody tr'));
    const ergebnis = [];
    zeilen.forEach((tr) => {
      const zellen = tr.querySelectorAll('td');
      if (!zellen.length) return;
      const nameZelle = zellen[idx.name];
      if (!nameZelle) return;
      const nameLink = nameZelle.querySelector('a[href*="user/view.php"]') || nameZelle.querySelector('a');
      const name = (nameLink ? nameLink.textContent : nameZelle.textContent).trim();
      if (!name) return;

      // userid: bevorzugt aus einem "Bewerten"-Link mit action=grader, sonst aus dem Namenslink.
      const bewertenLink = tr.querySelector('a[href*="action=grader"]');
      let userid = bewertenLink ? qparam(bewertenLink.href, 'userid') : null;
      if (!userid && nameLink) userid = qparam(nameLink.href, 'id');
      if (!userid) return;

      const statusText = idx.status !== undefined ? (zellen[idx.status] || {}).textContent || '' : '';
      const statusKlein = statusText.trim().toLowerCase();
      const ausgeschlossen = STATUS_AUSSCHLUSS.some((s) => statusKlein.includes(s));
      if (idx.status !== undefined && ausgeschlossen) return; // keine Abgabe → überspringen

      const dateien = [];
      const abgabeZelle = idx.abgabe !== undefined ? zellen[idx.abgabe] : tr;
      if (abgabeZelle) {
        abgabeZelle.querySelectorAll('a[href*="pluginfile.php"]').forEach((a) => {
          const teile = decodeURIComponent(a.href).split('/');
          const dateiname = teile[teile.length - 1].split('?')[0] || 'abgabe.pdf';
          dateien.push({ url: a.href, dateiname });
        });
      }

      ergebnis.push({ userid, name, statusText: statusText.trim(), dateien, grUrl: bewertenLink ? bewertenLink.href : null });
    });
    return ergebnis;
  }

  // ---- Schritt 1: Herunterladen -----------------------------------------
  async function herunterladen(body, courseKey, feedbackArt) {
    logZeile(body, 'Lese Bewertungstabelle …');
    const teilnehmer = tabelleAuslesen();
    if (!teilnehmer.length) { logZeile(body, 'Keine abgegebenen Abgaben gefunden.', 'fehler'); return; }
    logZeile(body, `${teilnehmer.length} Abgabe(n) erkannt.`);

    const karte = await kuerzelZuweisen(courseKey, teilnehmer.map((t) => ({ userid: t.userid, name: t.name })));

    const ohneDatei = teilnehmer.filter((t) => !t.dateien.length);
    if (ohneDatei.length) {
      logZeile(body, `${ohneDatei.length} Abgabe(n) ohne erkannte Datei (z. B. Online-Text statt Datei-Abgabe) — nur in der CSV enthalten, keine Datei im ZIP: ${ohneDatei.map((t) => karte[t.userid].kuerzel).join(', ')}`, 'fehler');
    }

    logZeile(body, 'Lade Dateien von Moodle …');
    const zipDateien = [];
    for (const t of teilnehmer) {
      const kuerzel = karte[t.userid].kuerzel;
      for (const d of t.dateien) {
        try {
          const resp = await fetch(d.url, { credentials: 'include' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const buf = new Uint8Array(await resp.arrayBuffer());
          zipDateien.push({ name: kuerzel + '/' + dateiNameSicher(d.dateiname), data: buf });
        } catch (e) {
          logZeile(body, `Datei von ${kuerzel} konnte nicht geladen werden (${e.message}).`, 'fehler');
        }
      }
    }

    if (!zipDateien.length) { logZeile(body, 'Keine Datei konnte geladen werden — ZIP wird nicht erzeugt.', 'fehler'); return; }

    const heute = new Date().toISOString().slice(0, 10);
    const basisname = `Abgaben_${courseKey}_${cmid}_${heute}`;

    const zipBlob = zipBauen(zipDateien);
    download(zipBlob, basisname + '.zip');
    logZeile(body, `ZIP heruntergeladen: ${basisname}.zip (${zipDateien.length} Datei(en))`, 'ok');

    const csvZeilen = ['Kuerzel-ID;Note;Feedback'];
    teilnehmer.forEach((t) => csvZeilen.push(`${csvZelle(karte[t.userid].kuerzel)};;`));
    const csvBlob = new Blob(['﻿' + csvZeilen.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    download(csvBlob, basisname + '.csv');
    logZeile(body, `CSV-Vorlage heruntergeladen: ${basisname}.csv`, 'ok');

    const prompt = promptErzeugen(feedbackArt, teilnehmer.length, basisname);
    zeigePrompt(body, prompt);
  }

  function promptErzeugen(feedbackArt, anzahl, basisname) {
    const stufe = feedbackArt === 'abschluss'
      ? 'Abschlussfeedback mit Note/Prozentwert (nach der projekteigenen Notenskala)'
      : 'Zwischenfeedback ohne Note';
    return [
      `Auftrag: ${anzahl} Abgaben aus "${basisname}.zip" bewerten.`,
      '',
      `Feedback-Stufe: ${stufe}.`,
      '',
      'In der ZIP liegt pro Kürzel-ID ein eigener Ordner mit der/den Abgabedatei(en).',
      `Die Bewertung erfolgt anonymisiert — die Kürzel-IDs stehen in "${basisname}.csv".`,
      '',
      `Bitte "${basisname}.csv" mit Note (leer lassen, falls kein Zwischenfeedback verlangt) und`,
      'Feedback je Kürzel-ID ausfüllen und als gleichnamige Datei zurückgeben — Spaltenreihenfolge',
      'und -namen (Kuerzel-ID;Note;Feedback) unverändert lassen, Semikolon-getrennt, ohne Zeilenumbrüche',
      'im Feedback-Feld.',
      '',
      '[Hier die fachlichen Bewertungsregeln der jeweiligen Projekt-Skill ergänzen.]',
    ].join('\n');
  }

  function zeigePrompt(body, text) {
    let feld = body.querySelector('#abg-prompt');
    if (!feld) {
      const box = document.createElement('div');
      box.className = 'abg-schritt';
      box.innerHTML = `
        <h4>Auftrags-Prompt</h4>
        <textarea id="abg-prompt" readonly></textarea>
        <button class="abg-sekundaer" id="abg-prompt-kopieren">In Zwischenablage kopieren</button>
      `;
      body.insertBefore(box, body.querySelector('.abg-log') || null);
      feld = box.querySelector('#abg-prompt');
      box.querySelector('#abg-prompt-kopieren').addEventListener('click', () => {
        navigator.clipboard.writeText(feld.value).catch(() => {});
      });
    }
    feld.value = text;
  }

  // ---- Schritt 2: Bewertungen einspielen --------------------------------
  async function bewertungenVorbereiten(body, courseKey, datei) {
    const text = await datei.text();
    const zeilen = csvLesen(text);
    if (zeilen.length < 2) throw new Error('CSV enthält keine Datenzeilen.');
    const kopf = zeilen[0].map((s) => s.trim().toLowerCase());
    const iKuerzel = kopf.findIndex((s) => s.includes('kürzel') || s.includes('kuerzel'));
    const iNote = kopf.findIndex((s) => s.includes('note'));
    const iFeedback = kopf.findIndex((s) => s.includes('feedback'));
    if (iKuerzel < 0) throw new Error('Spalte "Kuerzel-ID" nicht in der CSV gefunden.');

    const karte = await kuerzelKarteLaden(courseKey);
    const kuerzelZuUserid = {};
    Object.entries(karte).forEach(([uid, e]) => { kuerzelZuUserid[e.kuerzel] = uid; });

    const rows = [];
    for (let i = 1; i < zeilen.length; i++) {
      const z = zeilen[i];
      const kuerzel = (z[iKuerzel] || '').trim();
      if (!kuerzel) continue;
      const userid = kuerzelZuUserid[kuerzel];
      if (!userid) { logZeile(body, `Kürzel-ID "${kuerzel}" ist keinem bekannten Teilnehmer zugeordnet — Zeile übersprungen.`, 'fehler'); continue; }
      rows.push({
        userid,
        kuerzel,
        note: iNote >= 0 ? (z[iNote] || '').trim() : '',
        feedback: iFeedback >= 0 ? (z[iFeedback] || '').trim() : '',
        done: false,
      });
    }
    if (!rows.length) throw new Error('Keine verwertbare Zeile in der CSV.');

    await storageSet({ ['abgQueue_' + cmid]: { rows, erstellt: Date.now() } });
    logZeile(body, `${rows.length} Bewertung(en) vorgemerkt. Starte Eintragen …`, 'ok');

    const ersteUrl = `${location.origin}${location.pathname}?id=${cmid}&action=grader&userid=${rows[0].userid}`;
    location.href = ersteUrl;
  }

  // =======================================================================
  // MODUS B: Einzelansicht (action=grader)
  // =======================================================================
  async function modusEinzelansicht(body) {
    const key = 'abgQueue_' + cmid;
    const data = await storageGet([key]);
    const queue = data[key];

    if (!queue || !queue.rows || !queue.rows.length) {
      body.innerHTML = `<div class="abg-hinweis">Kein aktiver Eintrage-Vorgang. Über die Übersichtstabelle (Bewerten-Ansicht) eine CSV hochladen, um Bewertungen automatisch einzutragen.</div>`;
      return;
    }

    logZeile(body, `Automatischer Ablauf aktiv: ${queue.rows.filter((r) => !r.done).length} von ${queue.rows.length} noch offen.`);

    const aktuelleUserid = url.searchParams.get('userid');
    const zeile = queue.rows.find((r) => r.userid === aktuelleUserid && !r.done);

    if (!zeile) {
      logZeile(body, `Für diese Person (userid=${aktuelleUserid}) liegt keine offene Bewertung vor — versuche weiterzuschalten.`);
      await weiterOhneSpeichern(body, queue);
      return;
    }

    logZeile(body, `Trage Bewertung für ${zeile.kuerzel} ein …`);
    try {
      await feldFuellen(zeile);
      zeile.done = true;
      await storageSet({ [key]: queue });
      const offenNoch = queue.rows.some((r) => !r.done);
      logZeile(body, offenNoch ? 'Gespeichert — schalte weiter zur nächsten Person.' : 'Gespeichert — das war die letzte Person.', 'ok');
      await speichernUndWeiter(body);
    } catch (e) {
      logZeile(body, `Konnte Felder nicht füllen (${e.message}). Automatischer Ablauf angehalten — bitte prüfen und manuell speichern.`, 'fehler');
    }
  }

  function findeGradeFeld() {
    return document.querySelector('#id_grade')
      || document.querySelector('input[name="grade"]')
      || document.querySelector('select[name="grade"]');
  }

  async function wartenAufTinymce(editorId, versucheMax) {
    for (let i = 0; i < (versucheMax || 20); i++) {
      const tm = window.tinymce || window.tinyMCE;
      if (tm && tm.get && tm.get(editorId)) return tm.get(editorId);
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  async function feldFuellen(zeile) {
    if (zeile.note !== '') {
      const gradeFeld = findeGradeFeld();
      if (!gradeFeld) throw new Error('Notenfeld nicht gefunden (evtl. Bewertungsschema statt Punktebewertung — von v1.0 nicht unterstützt)');
      gradeFeld.value = zeile.note;
      gradeFeld.dispatchEvent(new Event('input', { bubbles: true }));
      gradeFeld.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (zeile.feedback !== '') {
      const textarea = document.querySelector('textarea[name="assignfeedbackcomments_editor[text]"]')
        || document.querySelector('textarea[id^="id_assignfeedbackcomments_editor"]');
      if (!textarea) throw new Error('Feedback-Feld nicht gefunden');
      const editorId = textarea.id;
      const ed = await wartenAufTinymce(editorId);
      const html = '<p>' + String(zeile.feedback).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, '</p><p>') + '</p>';
      if (ed) {
        ed.setContent(html);
        ed.save(); // schreibt in das darunterliegende textarea zurück, siehe fragetext-live-aendern
      } else {
        // Kein TinyMCE gefunden (z. B. Editor deaktiviert) — direkt ins textarea schreiben.
        textarea.value = html;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  async function speichernUndWeiter(body) {
    const knopf = document.querySelector('#id_saveandshownext')
      || document.querySelector('input[name="saveandshownext"]')
      || document.querySelector('button[name="saveandshownext"]');
    if (knopf) { knopf.click(); return; }

    logZeile(body, '"Speichern und nächste anzeigen" nicht gefunden — versuche normalen Speichern-Knopf (danach ggf. manuell weiterschalten).', 'fehler');
    const speichern = document.querySelector('#id_submitbutton') || document.querySelector('input[name="submitbutton"]');
    if (speichern) knopf ? knopf.click() : speichern.click();
    else logZeile(body, 'Kein Speichern-Knopf gefunden. Bitte manuell speichern.', 'fehler');
  }

  async function weiterOhneSpeichern(body, queue) {
    const nochOffen = queue.rows.some((r) => !r.done);
    if (!nochOffen) {
      logZeile(body, 'Alle vorgemerkten Bewertungen sind eingetragen.', 'ok');
      await storageRemove(['abgQueue_' + cmid]);
      return;
    }
    const naechster = document.querySelector('a[title*="Nächst" i]')
      || document.querySelector('a[title*="next" i]')
      || document.querySelector('.mod_assign_next a');
    if (naechster) { naechster.click(); return; }
    logZeile(body, 'Kein "Weiter"-Knopf gefunden — automatischer Ablauf angehalten. Bitte manuell zur nächsten offenen Kürzel-ID wechseln.', 'fehler');
  }

  // ---------------------------------------------------------------------
  // 7 · Start
  // ---------------------------------------------------------------------
  const body = panelBauen();
  if (action === 'grading') modusUebersicht(body).catch((e) => logZeile(body, 'Fehler: ' + e.message, 'fehler'));
  else modusEinzelansicht(body).catch((e) => logZeile(body, 'Fehler: ' + e.message, 'fehler'));
})();
