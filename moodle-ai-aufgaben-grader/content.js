/*
 * Moodle AI Aufgaben-Grader — content.js
 * Version 1.3.1
 *
 * Erscheint im Aufgaben-Modul (mod/assign) in der Bewerten-Ansicht:
 *  - action=grading  → Übersichtstabelle: Abgaben anonymisiert als ZIP + CSV
 *                       herunterladen, Auftrags-Prompt erzeugen.
 *  - Das Zurückschreiben läuft seit v1.2.0 über Moodles eigene
 *    SCHNELLBEWERTUNG (quickgrading=1): dort stehen alle Personen mit
 *    Notenfeld und Kommentarfeld untereinander auf EINER Seite, gespeichert
 *    wird mit EINEM Knopf. Die Erweiterung füllt die Felder, Arne sieht alles
 *    auf einen Blick und speichert selbst. Der frühere Weg (jede Bewerten-
 *    Einzelseite einzeln öffnen, eintragen, "Speichern und nächste anzeigen")
 *    ist damit entfallen — er war langsam und blieb im Live-Test nach der
 *    ersten Person hängen (Arne, 10.09.2026).
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
  if (action !== 'grading') return;

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

  // SHA-256 über den Dateiinhalt — dient doppelt: als stabiler Namensbestandteil und
  // als Erkennung, ob sich eine Abgabe seit dem letzten Lauf geändert hat.
  async function sha256Hex(bytes) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Rückfallebene ohne WebCrypto: einfacher Prüfwert, reicht zur Unterscheidung.
      let h = 0;
      for (let i = 0; i < bytes.length; i++) h = ((h << 5) - h + bytes[i]) | 0;
      return 'x' + (h >>> 0).toString(16).padStart(8, '0');
    }
  }

  // Arbeitsblatt-Nummer am ANFANG des Dateinamens. Auf die Nummer folgt in dieser
  // Materialreihe die NIVEAUSTUFE — Ziffer plus Großbuchstabe, z. B. "1D", "3F", "4G".
  // Die gehört NICHT zur Nummer: "4.-1D-Sicherheitsbelehrung" hat die Nummer "4.",
  // "4.1-01-4G-Atomgroesse" die Nummer "4.1-01". Ohne diese Grenze frisst der
  // Nummernausdruck die Stufe mit auf (Arne, 11.09.2026).
  function blattNummer(name) {
    const s = String(name);
    const mitStufe = /^\s*([\d]+[\d.\-]*?)-\d[A-Za-z]-/.exec(s);
    if (mitStufe) return mitStufe[1].replace(/-$/, '');
    const ohne = /^\s*(\d+(?:[.\-]\d+){0,3})/.exec(s);
    return ohne ? ohne[1] : null;
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
  // 2b · Einstellungen (kursübergreifend, einmal gesetzt)
  //      Bewusst nur Rahmenangaben — WAS eine gute Antwort ist, steht in der
  //      Bewertungs-Skill der jeweiligen Lehrkraft, nie in der Erweiterung.
  // ---------------------------------------------------------------------
  // Wortlaut wie in Reviewer und Coach, damit die SuS überall denselben Satz lesen.
  // ACHTUNG: Das Kommentarfeld der Schnellbewertung ist ein schlichtes Textfeld —
  // dort ist keine Kursivschrift möglich, der Hinweis steht als Klartext.
  const KI_HINWEIS_STANDARD =
    'Dieses Feedback wurde von der Lehrkraft mithilfe von KI-Unterstützung erstellt und geprüft.';

  const EINST_KEY = 'abgEinstellungen';
  // modus: 'schnell' = Voreinstellung. Unveränderte Abgaben werden gar nicht erst
  //                     geladen. Das ist gefahrlos, weil die Sicherung NICHT im
  //                     einzelnen ZIP liegt, sondern im Output-Ordner: dort bleiben
  //                     unveränderte Dateien über alle Runden eines Themas liegen und
  //                     neue/geänderte kommen nach dem Sichten dazu (Arne, 10.09.2026 —
  //                     Moodle hat ihm schon einmal die Dateien einer Schülerin verloren).
  //         'backup'  = alles laden, alles ins ZIP. Für den ersten Lauf eines Themas,
  //                     nach einem Rechnerwechsel oder wenn der Output-Ordner fehlt.
  const EINST_STANDARD = { skill: '', duplikate: true, loesungen: true, modus: 'schnell',
    kiHinweis: true, kiHinweisText: KI_HINWEIS_STANDARD };

  async function einstellungenLaden() {
    const d = await storageGet([EINST_KEY]);
    return Object.assign({}, EINST_STANDARD, d[EINST_KEY] || {});
  }
  async function einstellungenSpeichern(e) {
    await storageSet({ [EINST_KEY]: e });
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

  // Lesbare Namen für den ZIP-Dateinamen (statt Kurs-/Aufgaben-ID) — derselbe
  // Kurs-Link wie in ermittleCourseKey(), plus die Aufgaben-Überschrift.
  function ermittleAnzeigeNamen() {
    const link = document.querySelector('a[href*="/course/view.php?id="]')
      || document.querySelector('nav.breadcrumb a[href*="course/view.php"]');
    const kurs = link ? link.textContent.trim() : null;
    const h1 = document.querySelector('h1');
    const aufgabe = h1 ? h1.textContent.trim() : null;
    return { kurs, aufgabe };
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

    // Eingeklappt bleibt nur ein rundes Icon stehen — Text wäre auf der ohnehin
    // vollen Bewerten-Seite unnötig breit (Arne, 10.09.2026). icons/ ist in
    // web_accessible_resources eingetragen, sonst lädt das Bild auf der Moodle-Seite
    // nicht; ohne chrome.runtime bleibt ein Buchstabe als Rückfallebene.
    const toggle = document.createElement('button');
    toggle.id = 'abg-toggle';
    toggle.title = 'Moodle AI Aufgaben-Grader öffnen';
    toggle.setAttribute('aria-label', 'Moodle AI Aufgaben-Grader öffnen');
    let iconUrl = '';
    try { iconUrl = chrome.runtime.getURL('icons/icon32.png'); } catch (e) { iconUrl = ''; }
    if (iconUrl) {
      const bild = document.createElement('img');
      bild.src = iconUrl;
      bild.alt = '';
      toggle.appendChild(bild);
    } else {
      toggle.textContent = 'A';
    }
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
  // Übersichtstabelle (action=grading) — der einzige Ort, an dem die Erweiterung wirkt
  // =======================================================================
  async function modusUebersicht(body) {
    const courseKey = ermittleCourseKey();

    // Zwei Reiter statt nummerierter Schritte — Familienkonvention wie bei
    // MAG/Reviewer/Coach (.abg-reiter/.abg-tab/.abg-inhalt, Funktion zeige()).
    const reiter = document.createElement('div');
    reiter.className = 'abg-reiter';
    reiter.innerHTML = `
      <button class="abg-tab abg-aktiv" data-tab="download">Download</button>
      <button class="abg-tab" data-tab="einfuegen">Einfügen</button>
      <button class="abg-tab" data-tab="einstellungen">Einstellungen</button>
    `;
    body.appendChild(reiter);

    const panelDownload = document.createElement('div');
    panelDownload.className = 'abg-inhalt';
    panelDownload.dataset.panel = 'download';
    panelDownload.innerHTML = `
      <label for="abg-art">Feedback-Stufe</label>
      <select id="abg-art">
        <option value="zwischen">Zwischenfeedback (ohne Note)</option>
        <option value="abschluss">Abschlussfeedback (mit Note)</option>
      </select>
      <button id="abg-download">ZIP (Abgaben + CSV) erzeugen</button>
      <div class="abg-hinweis">Baut das ZIP selbst aus der Tabelle — kein Umweg über Moodles eigenen Bulk-Export. Nur Kürzel-IDs in Dateinamen, Klarnamen bleiben in Moodle. Liest immer alle Seiten der Übersichtstabelle, unabhängig von der eingestellten Seitengröße.</div>
    `;
    body.appendChild(panelDownload);

    const panelEinfuegen = document.createElement('div');
    panelEinfuegen.className = 'abg-inhalt';
    panelEinfuegen.dataset.panel = 'einfuegen';
    panelEinfuegen.hidden = true;
    const hatSchnellbewertung = !!document.querySelector('textarea[name^="quickgrade_comments_"]');
    panelEinfuegen.innerHTML = hatSchnellbewertung ? `
      <label for="abg-csv">Ausgefüllte CSV (Kürzel-ID;Note;Feedback)</label>
      <input type="file" id="abg-csv" accept=".csv,text/csv">
      <button id="abg-start" disabled>In die Tabelle eintragen</button>
      <div class="abg-hinweis">Trägt Note und Feedback in die Schnellbewertungs-Tabelle dieser Seite ein. Gespeichert wird nichts — du prüfst die Einträge und drückst danach selbst Moodles Knopf „Speichern".</div>
    ` : `
      <div class="abg-hinweis abg-schritt">Die <strong>Schnellbewertung</strong> ist auf dieser Seite nicht eingeschaltet. Nur mit ihr stehen Noten- und Kommentarfeld aller Personen untereinander auf einer Seite — darüber trägt die Erweiterung ein.</div>
      <button id="abg-schnell-an">Schnellbewertung einschalten</button>
      <div class="abg-hinweis">Lädt die Seite mit Schnellbewertung und allen Personen neu. Danach hier weitermachen.</div>
    `;
    body.appendChild(panelEinfuegen);

    // Reiter 3: Einstellungen — was in JEDEN Auftrags-Prompt übernommen wird.
    const einst = await einstellungenLaden();
    const panelEinstellungen = document.createElement('div');
    panelEinstellungen.className = 'abg-inhalt';
    panelEinstellungen.dataset.panel = 'einstellungen';
    panelEinstellungen.hidden = true;
    panelEinstellungen.innerHTML = `
      <label for="abg-skill">Bewertungs-Skill / Regelwerk (Name)</label>
      <input type="text" id="abg-skill" placeholder="z. B. 3-chemie-arbeitshefte">
      <div class="abg-hinweis">Die beiden Haken schalten nichts in der Erweiterung ein — sie bestimmen nur, welche Arbeitsschritte im erzeugten Prompt stehen, also was die KI tun soll.</div>
      <label class="abg-check"><input type="checkbox" id="abg-dupl"> Die KI soll auf abgeschriebene Abgaben prüfen</label>
      <label class="abg-check"><input type="checkbox" id="abg-loes"> Die KI soll vorhandene Lösungen als Maßstab nehmen</label>
      <label for="abg-modus">Umfang des Downloads</label>
      <select id="abg-modus">
        <option value="schnell">Schnell — nur neue und geänderte Abgaben laden</option>
        <option value="backup">Vollständig — alle Abgaben laden (erster Lauf, neuer Rechner)</option>
      </select>
      <label class="abg-check"><input type="checkbox" id="abg-ki"> KI-Hinweis unter jedes Feedback setzen</label>
      <label for="abg-ki-text">Wortlaut des KI-Hinweises</label>
      <textarea id="abg-ki-text" rows="2"></textarea>
      <div class="abg-hinweis">Wird beim Eintragen angehängt, nicht von der KI geschrieben. Leeres Feld stellt den Standardsatz wieder her. Im Kommentarfeld der Schnellbewertung ist keine Kursivschrift möglich — der Hinweis steht als Klartext.</div>
      <button class="abg-sekundaer" id="abg-reset">Stand dieser Aufgabe zurücksetzen</button>
      <div class="abg-hinweis">Zurücksetzen vergisst, was beim letzten Lauf schon geladen war — der nächste Durchlauf holt dann wieder alles. Nötig, wenn der Output-Ordner verloren gegangen ist.</div>
      <button class="abg-sekundaer" id="abg-einst-speichern">Einstellungen speichern</button>
      <div class="abg-hinweis">Diese Angaben landen im Auftrags-Prompt. Die Erweiterung selbst bewertet nichts — sie sagt der KI nur, nach welchem Regelwerk sie arbeiten soll.</div>
    `;
    body.appendChild(panelEinstellungen);
    panelEinstellungen.querySelector('#abg-skill').value = einst.skill || '';
    panelEinstellungen.querySelector('#abg-dupl').checked = !!einst.duplikate;
    panelEinstellungen.querySelector('#abg-loes').checked = !!einst.loesungen;
    panelEinstellungen.querySelector('#abg-modus').value = einst.modus === 'backup' ? 'backup' : 'schnell';
    panelEinstellungen.querySelector('#abg-ki').checked = einst.kiHinweis !== false;
    panelEinstellungen.querySelector('#abg-ki-text').value = einst.kiHinweisText || KI_HINWEIS_STANDARD;
    panelEinstellungen.querySelector('#abg-reset').addEventListener('click', async () => {
      await storageRemove(['abgStand_' + cmid]);
      logZeile(body, 'Stand zurückgesetzt — der nächste Download holt wieder alle Abgaben.', 'ok');
    });
    panelEinstellungen.querySelector('#abg-einst-speichern').addEventListener('click', async () => {
      einst.skill = panelEinstellungen.querySelector('#abg-skill').value.trim();
      einst.duplikate = panelEinstellungen.querySelector('#abg-dupl').checked;
      einst.loesungen = panelEinstellungen.querySelector('#abg-loes').checked;
      einst.modus = panelEinstellungen.querySelector('#abg-modus').value;
      einst.kiHinweis = panelEinstellungen.querySelector('#abg-ki').checked;
      einst.kiHinweisText = panelEinstellungen.querySelector('#abg-ki-text').value.trim() || KI_HINWEIS_STANDARD;
      await einstellungenSpeichern(einst);
      logZeile(body, 'Einstellungen gespeichert.', 'ok');
    });

    function zeige(name) {
      body.querySelectorAll('.abg-inhalt').forEach((n) => { n.hidden = n.dataset.panel !== name; });
      body.querySelectorAll('.abg-tab').forEach((t) => t.classList.toggle('abg-aktiv', t.dataset.tab === name));
    }
    reiter.querySelectorAll('.abg-tab').forEach((t) => t.addEventListener('click', () => zeige(t.dataset.tab)));

    panelDownload.querySelector('#abg-download').addEventListener('click', () => {
      herunterladen(body, courseKey, panelDownload.querySelector('#abg-art').value, einst)
        .catch((e) => logZeile(body, 'Fehler beim Herunterladen: ' + e.message, 'fehler'));
    });

    if (!hatSchnellbewertung) {
      panelEinfuegen.querySelector('#abg-schnell-an').addEventListener('click', () => {
        const u = new URL(location.href);
        u.searchParams.set('action', 'grading');
        u.searchParams.set('quickgrading', '1');
        u.searchParams.set('perpage', '-1');
        location.href = u.toString();
      });
    } else {
      let ausgewaehlteCsv = null;
      panelEinfuegen.querySelector('#abg-csv').addEventListener('change', (ev) => {
        ausgewaehlteCsv = ev.target.files[0] || null;
        panelEinfuegen.querySelector('#abg-start').disabled = !ausgewaehlteCsv;
      });
      panelEinfuegen.querySelector('#abg-start').addEventListener('click', async () => {
        if (!ausgewaehlteCsv) { logZeile(body, 'Bitte zuerst eine CSV-Datei wählen.', 'fehler'); return; }
        try {
          await inSchnellbewertungEintragen(body, courseKey, ausgewaehlteCsv);
        } catch (e) {
          logZeile(body, 'Fehler beim Einlesen der CSV: ' + e.message, 'fehler');
        }
      });
    }
  }

  // ---- Tabelle auslesen ------------------------------------------------
  const KOPFVARIANTEN = {
    name: ['Vollständiger Name', 'Vorname / Nachname', 'Vorname', 'Name', 'Full name'],
    status: ['Status'],
    abgabe: ['Dateiabgabe', 'Datei-Einreichungen', 'Online-Text', 'Abgabe', 'Submission'],
  };

  // Spaltenköpfe, die trotz passendem Stichwort NIE die gesuchte Spalte sein können —
  // "Abgabe" als Variante trifft sonst auch auf "Zuletzt geändert (Abgabe)" (Datum) und
  // "Abgabekommentare", die beide vor der eigentlichen Dateiabgabe-Spalte stehen können.
  const KOPF_AUSSCHLUSS = ['geändert', 'kommentar'];

  function findeSpaltenTabelle(root) {
    root = root || document;
    // ID variiert je Moodle-Version/Theme: "submissions" ist der aktuelle Standard
    // (live geprüft 10.09.2026), "mod_assign_grading_table" eine ältere/andere Fassung.
    let tabelle = root.querySelector('#submissions')
      || root.querySelector('#mod_assign_grading_table');
    if (!tabelle) {
      // Fallback: irgendeine Tabelle, deren Kopfzeile einen Namens-Spaltentitel trägt.
      tabelle = Array.from(root.querySelectorAll('table')).find((t) => {
        const kopf = t.querySelector('thead');
        return kopf && /Vollständiger Name|Full name|Vorname/i.test(kopf.textContent);
      });
    }
    return tabelle;
  }

  function spaltenIndex(tabelle) {
    // :scope verhindert, dass Kopfzellen verschachtelter Tabellen (z. B. die
    // Datei-Baumansicht in der Dateiabgabe-Spalte) mitgezählt werden.
    const kopfZellen = Array.from(tabelle.querySelectorAll(':scope > thead th, :scope > thead td'));
    const idx = {};
    Object.keys(KOPFVARIANTEN).forEach((schluessel) => {
      const varianten = KOPFVARIANTEN[schluessel];
      const i = kopfZellen.findIndex((z) => {
        const txt = z.textContent.trim().toLowerCase();
        if (KOPF_AUSSCHLUSS.some((a) => txt.includes(a))) return false;
        return varianten.some((v) => txt.includes(v.toLowerCase()));
      });
      if (i >= 0) idx[schluessel] = i;
    });
    return idx;
  }

  const STATUS_ABGEGEBEN = ['abgegeben', 'submitted'];
  const STATUS_AUSSCHLUSS = ['keine abgabe', 'no submission'];

  function tabelleAuslesen(root) {
    const tabelle = findeSpaltenTabelle(root);
    if (!tabelle) throw new Error('Bewertungstabelle nicht gefunden (Selektor prüfen).');
    const idx = spaltenIndex(tabelle);
    if (idx.name === undefined) throw new Error('Spalte "Vollständiger Name" nicht gefunden.');

    // :scope beschränkt auf die direkten Zeilen/Zellen der Einreichungstabelle — manche
    // Abgabespalten enthalten eine verschachtelte Datei-Baumansicht (eigene <table>,
    // <tbody>, <tr>, <td>), die sonst als zusätzliche Zeilen/Spalten mitgezählt würde.
    const zeilen = Array.from(tabelle.querySelectorAll(':scope > tbody > tr'));
    const ergebnis = [];
    zeilen.forEach((tr) => {
      const zellen = tr.querySelectorAll(':scope > td');
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
      // Personen ohne jede Abgabe werden NICHT verworfen, sondern mitgeführt: sonst
      // stehen sie in keiner CSV und können auch keine Rückmeldung bekommen, obwohl
      // gerade sie eine brauchen (Arne, 11.09.2026).
      const ohneAbgabe = idx.status !== undefined
        && STATUS_AUSSCHLUSS.some((x) => statusKlein.includes(x));

      const dateien = [];
      const abgabeZelle = idx.abgabe !== undefined ? zellen[idx.abgabe] : tr;
      if (abgabeZelle) {
        abgabeZelle.querySelectorAll('a[href*="pluginfile.php"]').forEach((a) => {
          const teile = decodeURIComponent(a.href).split('/');
          const dateiname = teile[teile.length - 1].split('?')[0] || 'abgabe.pdf';
          dateien.push({ url: a.href, dateiname, zeit: dateiZeit(a) });
        });
      }

      ergebnis.push({ userid, name, statusText: statusText.trim(), ohneAbgabe, dateien, grUrl: bewertenLink ? bewertenLink.href : null });
    });
    return ergebnis;
  }

  // Moodle schreibt neben jeden Abgabe-Link den Hochladezeitpunkt dieser einen Datei
  // (div.fileuploadsubmissiontime). Damit lässt sich VOR dem Herunterladen erkennen,
  // ob eine Datei seit dem letzten Lauf unverändert ist — live geprüft 10.09.2026.
  function dateiZeit(a) {
    let el = a;
    for (let i = 0; i < 5 && el; i++) {
      const z = el.querySelector && el.querySelector('.fileuploadsubmissiontime');
      if (z && z.textContent.trim()) return z.textContent.trim().replace(/\s+/g, ' ');
      el = el.parentElement;
    }
    return '';
  }

  // Die Übersichtstabelle ist standardmäßig seitenweise (10/20/50/100 oder "Alle" =
  // perpage -1) — für ZIP/CSV müssen IMMER alle Teilnehmenden erfasst werden, egal
  // welche Seitengröße gerade eingestellt ist. Deshalb wird die aktuelle Seite zusätzlich
  // einmal mit perpage=-1 nachgeladen, statt sich auf die sichtbar gerenderte Tabelle zu
  // verlassen (live geprüft 10.09.2026: Standardeinstellung zeigte nur 7 von mehr Abgaben).
  async function vollstaendigesDokumentHolen(body) {
    const url = new URL(location.href);
    url.searchParams.set('perpage', '-1');
    try {
      const resp = await fetch(url.toString(), { credentials: 'include' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Ohne <base> werden relative Links (action=grader, pluginfile.php) im
      // abgetrennten Dokument gegen "about:blank" statt gegen die echte Moodle-URL
      // aufgelöst — a.href liefert dann falsche/unvollständige Adressen.
      const base = doc.createElement('base');
      base.href = location.origin;
      if (doc.head) doc.head.prepend(base);
      return doc;
    } catch (e) {
      logZeile(body, `Konnte nicht alle Seiten nachladen (${e.message}) — verwende nur die sichtbare Seite.`, 'fehler');
      return document;
    }
  }

  // ---- Schritt 1: Herunterladen -----------------------------------------
  async function herunterladen(body, courseKey, feedbackArt, einst) {
    logZeile(body, 'Lese Bewertungstabelle (alle Seiten) …');
    const vollDoc = await vollstaendigesDokumentHolen(body);
    const teilnehmer = tabelleAuslesen(vollDoc);
    if (!teilnehmer.length) { logZeile(body, 'Keine abgegebenen Abgaben gefunden.', 'fehler'); return; }
    logZeile(body, `${teilnehmer.length} Abgabe(n) erkannt.`);

    const karte = await kuerzelZuweisen(courseKey, teilnehmer.map((t) => ({ userid: t.userid, name: t.name })));

    const garnichts = teilnehmer.filter((t) => t.ohneAbgabe);
    if (garnichts.length) {
      logZeile(body, `${garnichts.length} Person(en) ohne jede Abgabe — sie stehen mit in der CSV, damit sie eine Rückmeldung bekommen können: ${garnichts.map((t) => karte[t.userid].kuerzel).join(', ')}`);
    }
    const ohneDatei = teilnehmer.filter((t) => !t.ohneAbgabe && !t.dateien.length);
    if (ohneDatei.length) {
      logZeile(body, `${ohneDatei.length} Abgabe(n) ohne erkannte Datei (z. B. Online-Text statt Datei-Abgabe): ${ohneDatei.map((t) => karte[t.userid].kuerzel).join(', ')}`, 'fehler');
    }

    // Ein einziger Wurzelordner im ZIP, mit STABILEM Namen (Kurs + Aufgabe, ohne
    // Datum) — damit derselbe Kurs bei jeder Feedback-Runde wieder im gleich
    // benannten Ordner landet und der Abgleich "was ist neu seit dem letzten Lauf"
    // ohne Namensraten funktioniert (Arne, 10.09.2026). Der ZIP-Dateiname behält
    // das Datum, sonst hängt Chrome bei mehreren Downloads pro Tag " (1)" an.
    // Weil im ZIP genau EIN Element auf oberster Ebene liegt, entpacken macOS und
    // Windows direkt zu diesem Ordner statt einen zweiten drumherum zu bauen.
    const { kurs, aufgabe } = ermittleAnzeigeNamen();
    const ordnerName = kuerzen(dateiNameSicher([kurs, aufgabe].filter(Boolean).join(' - ')) || courseKey, 60);

    // Stand des letzten Laufs: je Person die Dateien mit Zeitstempel und Prüfsumme.
    // Damit lässt sich eine Datei schon an Name + Hochladezeit als unverändert erkennen,
    // ohne sie herunterzuladen — und die Prüfsumme bestätigt es, wo geladen wurde.
    const standKey = 'abgStand_' + cmid;
    const gespeichert = (await storageGet([standKey]))[standKey] || {};
    const alt = gespeichert.sus || {};                 // userid -> { dateien: [...] }
    const alteHashes = {};                             // pruefsumme -> true
    const alteBlaetter = {};                           // "kuerzel|blatt" -> true
    Object.keys(alt).forEach((uid) => {
      const k = (karte[uid] && karte[uid].kuerzel) || uid;
      (alt[uid].dateien || []).forEach((d) => {
        if (d.pruefsumme) alteHashes[d.pruefsumme] = true;
        alteBlaetter[k + '|' + (d.blatt || 'ohne')] = true;
      });
    });

    const kennenWirDieAufgabe = Object.keys(alt).length > 0;
    // Beim allerersten Lauf einer Aufgabe gibt es nichts zu vergleichen — dann wird
    // immer alles geladen, egal was eingestellt ist.
    const schnell = !!(einst && einst.modus === 'schnell') && kennenWirDieAufgabe;
    logZeile(body, schnell
      ? 'Schnelldurchlauf: es werden nur neue und geänderte Abgaben geladen. Die unveränderten liegen bereits im Output-Ordner.'
      : (kennenWirDieAufgabe
        ? 'Vollständiger Durchlauf: alle Abgaben werden geladen.'
        : 'Erster Lauf für diese Aufgabe — es wird alles geladen.'));
    logZeile(body, 'Lade Dateien von Moodle …');

    const zipDateien = [];
    const inhalt = [];
    const neuerStand = {};
    const zaehler = { neu: 0, geaendert: 0, unveraendert: 0, uebersprungen: 0 };

    for (const t of teilnehmer) {
      const kuerzel = karte[t.userid].kuerzel;
      const frueher = (alt[t.userid] && alt[t.userid].dateien) || [];
      const eigene = [];

      for (const d of t.dateien) {
        const blatt = blattNummer(d.dateiname);
        // Schlüssel für die Änderungserkennung aus dem GANZEN Dateinamen, nicht aus
        // der Nummer: dieselbe Nummer kann für zwei verschiedene Arbeitsblätter
        // vergeben sein (belegt: "4.1-01-…-Sicherheitsbelehrung" und
        // "4.1-01-…-Atomgroesse" im selben Thema). Über die Nummer allein würden
        // die beiden als ein und dasselbe Blatt gelten.
        // Beim zweiten Herunterladen hängen Browser und Betriebssystem ein " 2"
        // oder " 3" an den Namen — es bleibt dasselbe Arbeitsblatt. Ohne diese
        // Entdoppelung gilt eine erneut hochgeladene Fassung als neues Blatt statt
        // als geänderte (Arne, 11.09.2026).
        const bkey = kuerzel + '|' + dateiNameSicher(d.dateiname)
          .replace(/[ _-]\d{1,2}(?=\.[a-z0-9]+$)/i, '').toLowerCase();

        // Vorfilter: gleicher Dateiname UND gleiche Hochladezeit wie beim letzten Lauf.
        const bekannt = d.zeit
          ? frueher.find((f) => f.original === d.dateiname && f.zeit === d.zeit && f.pruefsumme)
          : null;

        if (bekannt && schnell) {
          // Nicht laden. Eintrag aus dem letzten Lauf unverändert übernehmen.
          eigene.push({ datei: bekannt.datei, original: d.dateiname, blatt: bekannt.blatt || null,
                        zeit: d.zeit, pruefsumme: bekannt.pruefsumme, status: 'unveraendert',
                        im_zip: false, name_ersetzt: !!bekannt.name_ersetzt });
          zaehler.unveraendert += 1; zaehler.uebersprungen += 1;
          continue;
        }

        try {
          const resp = await fetch(d.url, { credentials: 'include' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const buf = new Uint8Array(await resp.arrayBuffer());
          const hash = await sha256Hex(buf);

          // Dateiname bleibt, wie er ist — er trägt die Arbeitsblatt-Bezeichnung und ist
          // damit von Lauf zu Lauf stabil und lesbar. NUR wenn der Name keinen
          // Aufgabenbezug hat, wird er ersetzt: SuS benennen Dateien gelegentlich nach
          // sich selbst, und ein Klarname im Dateinamen hebelt die Anonymisierung aus.
          // Ersatzname trägt die Prüfsumme statt einer laufenden Nummer, damit er sich
          // nicht verschiebt, wenn später weitere Dateien dazukommen (Arne, 10.09.2026).
          const endung = (/\.([a-z0-9]{1,5})$/i.exec(d.dateiname) || [null, 'pdf'])[1].toLowerCase();
          let sicher, ersetzt = false;
          if (blatt) {
            sicher = dateiNameSicher(d.dateiname);
          } else {
            sicher = `${kuerzel}_ohne-Aufgabennummer_${hash.slice(0, 8)}.${endung}`;
            ersetzt = true;
            logZeile(body, `Dateiname von ${kuerzel} trug keine Aufgabennummer und wurde ersetzt (mögliche Klarnamen im Dateinamen).`);
          }

          let status = 'neu';
          if (alteHashes[hash] || (bekannt && bekannt.pruefsumme === hash)) status = 'unveraendert';
          else if (alteBlaetter[bkey]) status = 'geaendert';
          zaehler[status] += 1;

          zipDateien.push({ name: `${ordnerName}/${kuerzel}/${sicher}`, data: buf });
          eigene.push({ datei: sicher, original: d.dateiname, blatt: blatt || null, zeit: d.zeit || '',
                        pruefsumme: hash, status, im_zip: true, name_ersetzt: ersetzt });
        } catch (e) {
          logZeile(body, `Datei von ${kuerzel} konnte nicht geladen werden (${e.message}).`, 'fehler');
        }
      }

      inhalt.push({ kuerzel, ohne_abgabe: !!t.ohneAbgabe, dateien: eigene.map((x) => ({
        datei: x.datei, blatt: x.blatt, status: x.status, im_zip: x.im_zip,
        pruefsumme: x.pruefsumme.slice(0, 16), name_ersetzt: x.name_ersetzt,
      })) });
      neuerStand[t.userid] = { dateien: eigene };
    }
    await storageSet({ [standKey]: { sus: neuerStand, stand: Date.now() } });
    logZeile(body, `Abgleich mit dem letzten Lauf: ${zaehler.neu} neu, ${zaehler.geaendert} geändert, ${zaehler.unveraendert} unverändert`
      + (zaehler.uebersprungen ? ` (davon ${zaehler.uebersprungen} nicht geladen).` : '.'));

    const anzahlAbgabeDateien = zipDateien.length;
    if (!anzahlAbgabeDateien) {
      logZeile(body, 'Keine neue oder geänderte Datei — es entsteht trotzdem ein ZIP mit CSV und Laufzettel.');
    }

    const heute = new Date().toISOString().slice(0, 10);

    // CSV-Vorlage liegt MIT im ZIP (im Wurzelordner, neben den Kürzel-Ordnern) statt
    // als zweiter, separater Download — auf Arnes Wunsch (10.09.2026): ein Download.
    // Fester Name "bewertung.csv", damit Prompt und Skill sie ohne Namensraten finden.
    const csvZeilen = ['Kuerzel-ID;Note;Feedback'];
    teilnehmer.forEach((t) => csvZeilen.push(`${csvZelle(karte[t.userid].kuerzel)};;`));
    const csvText = '\ufeff' + csvZeilen.join('\r\n');
    zipDateien.push({ name: `${ordnerName}/bewertung.csv`, data: new TextEncoder().encode(csvText) });

    // Maschinenlesbarer Laufzettel: trägt Datum, Aufgabe und Lauf-Art, die aus dem
    // stabilen Ordnernamen bewusst herausgefallen sind. Enthält KEINE Klarnamen —
    // die Zuordnung Kürzel→Name bleibt ausschließlich im Browser-Speicher.
    const lauf = {
      erweiterung: 'Moodle AI Aufgaben-Grader',
      version: version(),
      erzeugt: new Date().toISOString(),
      datum: heute,
      kurs: kurs || null,
      aufgabe: aufgabe || null,
      cmid,
      ordner: ordnerName,
      csv: 'bewertung.csv',
      laufart: feedbackArt === 'abschluss' ? 'abschluss' : 'zwischen',
      duplikatpruefung: !!(einst && einst.duplikate),
      loesungen: !!(einst && einst.loesungen),
      skill: (einst && einst.skill) || null,
      anzahl_abgaben: teilnehmer.length,
      anzahl_dateien: anzahlAbgabeDateien,
      abgleich: zaehler,
      modus: schnell ? 'schnell' : 'vollstaendig',
      zip_enthaelt_alle_abgaben: !schnell,
      abgaben: inhalt,
    };
    zipDateien.push({
      name: `${ordnerName}/_lauf.json`,
      data: new TextEncoder().encode(JSON.stringify(lauf, null, 2)),
    });

    const zipName = `${ordnerName}_${heute}.zip`;
    const zipBlob = zipBauen(zipDateien);
    download(zipBlob, zipName);
    logZeile(body, `ZIP heruntergeladen: ${zipName} — entpackt zum Ordner "${ordnerName}" (${anzahlAbgabeDateien} Abgabedatei(en) + bewertung.csv + _lauf.json)`, 'ok');

    const prompt = promptErzeugen(lauf);
    zeigePrompt(body, prompt);
  }

  // Kürzt einen Ordnernamen auf eine handhabbare Länge, ohne mitten im Wort zu enden.
  function kuerzen(text, max) {
    text = String(text).trim();
    if (text.length <= max) return text;
    const kurz = text.slice(0, max);
    const luecke = kurz.lastIndexOf(' ');
    return (luecke > max * 0.6 ? kurz.slice(0, luecke) : kurz).trim();
  }

  // Der Prompt bleibt bewusst kurz: er nennt nur Ort, Umfang und Lauf-Art und
  // verweist für alles Fachliche auf die Bewertungs-Skill. Das spart Token und
  // hält die Erweiterung fach- und lehrkraftunabhängig.
  function promptErzeugen(lauf) {
    const stufe = lauf.laufart === 'abschluss'
      ? 'Abschlussfeedback MIT Note'
      : 'Zwischenfeedback OHNE Note';
    const z = [];
    z.push('Aufgaben-Bewertung starten.');
    z.push('');
    z.push(`Ordner:   ${lauf.ordner}`);
    if (lauf.kurs) z.push(`Kurs:     ${lauf.kurs}`);
    if (lauf.aufgabe) z.push(`Aufgabe:  ${lauf.aufgabe}`);
    z.push(`Lauf:     ${stufe} (${lauf.datum})`);
    z.push(`Umfang:   ${lauf.anzahl_abgaben} Kürzel-ID(s), ${lauf.anzahl_dateien} Datei(en) im ZIP`);
    if (lauf.abgleich) z.push(`Abgleich: ${lauf.abgleich.neu} neu, ${lauf.abgleich.geaendert} geändert, ${lauf.abgleich.unveraendert} unverändert`);
    if (lauf.modus === 'schnell') z.push('Hinweis:  Unveränderte Dateien liegen nicht im ZIP (Schnelldurchlauf).');
    z.push('');
    z.push('Ablauf:');
    let n = 1;
    z.push(`${n++}. "${lauf.ordner}/_lauf.json" lesen — Aufgabe, Lauf-Art, Kürzel-IDs und je Datei ein Feld "status" (neu, geaendert, unveraendert).`);
    z.push(`${n++}. Das laufende Archiv dieses Themas liegt in Output/${lauf.ordner}/ mit "_status.json" (je Kürzel-ID und Arbeitsblatt: Stufe, Datum, letztes Feedback). Der Import-Ordner enthält nur, was seit dem letzten Lauf dazugekommen oder geändert ist.`);
    z.push(`${n++}. Nur die Dateien aus dem Import-Ordner ansehen. Für alles andere das Feedback aus "_status.json" übernehmen und beim Zusammensetzen nach Aktualität kürzen.`);
    if (lauf.duplikatpruefung) {
      z.push(`${n++}. Duplikatprüfung: die neuen Abgaben gegen das gesamte Archiv im Output-Ordner prüfen, nicht nur untereinander. Eindeutige Fälle melden, Graubereich beurteilen statt automatisch werten.`);
    }
    if (lauf.loesungen) {
      z.push(`${n++}. Falls eine passende Lösung oder ein Erwartungshorizont vorliegt, diese als Maßstab nehmen; sonst allein die Aufgabenstellung in der Abgabe zugrunde legen.`);
    }
    z.push(`${n++}. Je Kürzel-ID Feedback schreiben${lauf.laufart === 'abschluss' ? ' und Note vergeben' : ' (kein Notenfeld füllen)'} — anonym, keine Vergleiche zwischen Abgaben im Feedbacktext.`);
    z.push(`${n++}. "${lauf.ordner}/${lauf.csv}" ausfüllen: Spalten Kuerzel-ID;Note;Feedback unverändert, semikolongetrennt. Zeilenumbrüche im Feedbackfeld sind erlaubt, das Feld dann in Anführungszeichen setzen; keine geraden doppelten Anführungszeichen im Text selbst.`);
    z.push(`${n++}. Die gesichteten Dateien aus dem Import- in den Output-Ordner übernehmen (gleicher Kürzel-Unterordner, geänderte Fassung ersetzt die alte), "_status.json" fortschreiben und den Import-Ordner leeren. Das Archiv im Output-Ordner enthält danach wieder ALLE Abgaben dieses Themas.`);
    z.push(`${n++}. Ausgefüllte CSV zurückgeben — sie wird über den Reiter „Einfügen" wieder in Moodle eingetragen.`);
    z.push('');
    if (lauf.laufart === 'abschluss') {
      z.push('Da dies der Abschlusslauf ist: Nach dem Eintragen der Noten kann das Archiv im Output-Ordner gelöscht werden.');
      z.push('');
    }
    z.push(lauf.skill
      ? `Bewertungsregeln: Skill „${lauf.skill}".`
      : 'Bewertungsregeln: [Name der Bewertungs-Skill hier ergänzen — dauerhaft hinterlegbar im Reiter „Einstellungen".]');
    return z.join('\n');
  }

  // Die Prompt-Karte gehört in den Reiter "Download" — sie ist das Ergebnis des
  // Downloads. Im Reiter "Einfügen" hat sie nichts zu suchen (Arne, 10.09.2026).
  function zeigePrompt(body, text) {
    const ziel = body.querySelector('.abg-inhalt[data-panel="download"]') || body;
    let feld = ziel.querySelector('#abg-prompt');
    if (!feld) {
      const box = document.createElement('div');
      box.className = 'abg-karte';
      box.innerHTML = `
        <h4>Auftrags-Prompt</h4>
        <div class="abg-hinweis abg-schritt">Zuerst das heruntergeladene ZIP entpacken und den entstandenen Ordner in den <strong>Import-Ordner</strong> legen. Danach diesen Prompt in die KI einfügen.</div>
        <textarea id="abg-prompt" readonly></textarea>
        <button id="abg-prompt-kopieren">Prompt in die Zwischenablage kopieren</button>
      `;
      ziel.appendChild(box);
      feld = box.querySelector('#abg-prompt');
      const kopf = box.querySelector('#abg-prompt-kopieren');
      kopf.addEventListener('click', () => {
        navigator.clipboard.writeText(feld.value)
          .then(() => {
            const alt = kopf.textContent;
            kopf.textContent = 'Kopiert';
            setTimeout(() => { kopf.textContent = alt; }, 1500);
          })
          .catch(() => { feld.select(); });
      });
    }
    feld.value = text;
  }

  // ---- Schritt 2: Bewertungen in die Schnellbewertung eintragen ---------
  // Moodles Schnellbewertung (quickgrading=1) stellt pro Person zwei Felder auf
  // dieselbe Seite: input[name="quickgrade_<userid>"] für die Note und
  // textarea[name="quickgrade_comments_<userid>"] für den Kommentar (schlichtes
  // Textfeld, KEIN TinyMCE — Zeilenumbrüche gehen also direkt hinein). Gespeichert
  // wird alles zusammen mit dem einen Speichern-Knopf des Formulars.
  // Live geprüft am 10.09.2026.
  // Die Erweiterung füllt nur — abgeschickt wird von Hand, damit Arne vorher
  // alle Einträge auf einen Blick prüfen kann.
  async function inSchnellbewertungEintragen(body, courseKey, datei) {
    const text = await datei.text();
    const zeilen = csvLesen(text);
    if (zeilen.length < 2) throw new Error('CSV enthält keine Datenzeilen.');
    const kopf = zeilen[0].map((x) => x.trim().toLowerCase());
    const iKuerzel = kopf.findIndex((x) => x.includes('kürzel') || x.includes('kuerzel'));
    const iNote = kopf.findIndex((x) => x.includes('note') || x.includes('punkt'));
    const iFeedback = kopf.findIndex((x) => x.includes('feedback'));
    if (iKuerzel < 0) throw new Error('Spalte "Kuerzel-ID" nicht in der CSV gefunden.');

    const karte = await kuerzelKarteLaden(courseKey);
    const kuerzelZuUserid = {};
    Object.entries(karte).forEach(([uid, e]) => { kuerzelZuUserid[e.kuerzel] = uid; });

    const einst = await einstellungenLaden();
    const hinweis = einst.kiHinweis !== false ? (einst.kiHinweisText || KI_HINWEIS_STANDARD).trim() : '';

    let getroffen = 0, noten = 0, kommentare = 0;
    const unbekannt = [], nichtAufSeite = [];

    for (let i = 1; i < zeilen.length; i++) {
      const z = zeilen[i];
      const kuerzel = (z[iKuerzel] || '').trim();
      if (!kuerzel) continue;
      const userid = kuerzelZuUserid[kuerzel];
      if (!userid) { unbekannt.push(kuerzel); continue; }

      const notenFeld = document.querySelector(`input[name="quickgrade_${userid}"]`);
      const kommentarFeld = document.querySelector(`textarea[name="quickgrade_comments_${userid}"]`);
      if (!notenFeld && !kommentarFeld) { nichtAufSeite.push(kuerzel); continue; }

      const note = iNote >= 0 ? (z[iNote] || '').trim() : '';
      let feedback = iFeedback >= 0 ? (z[iFeedback] || '').trim() : '';
      // Hinweis anhängen — aber nur einmal, falls die CSV ihn schon enthält.
      if (feedback && hinweis && feedback.indexOf(hinweis) === -1) {
        feedback = feedback + '\n\n' + hinweis;
      }

      if (note !== '' && notenFeld) {
        notenFeld.value = note;
        notenFeld.dispatchEvent(new Event('input', { bubbles: true }));
        notenFeld.dispatchEvent(new Event('change', { bubbles: true }));
        noten += 1;
      }
      if (feedback !== '' && kommentarFeld) {
        kommentarFeld.value = feedback;
        kommentarFeld.dispatchEvent(new Event('input', { bubbles: true }));
        kommentarFeld.dispatchEvent(new Event('change', { bubbles: true }));
        kommentarFeld.style.outline = '2px solid #d3070f';
        kommentare += 1;
      }
      getroffen += 1;
    }

    if (unbekannt.length) {
      logZeile(body, `Diese Kürzel-IDs sind diesem Kurs nicht bekannt und wurden übersprungen: ${unbekannt.join(', ')}`, 'fehler');
    }
    if (nichtAufSeite.length) {
      logZeile(body, `Nicht auf dieser Seite sichtbar (Seitengröße?): ${nichtAufSeite.join(', ')} — Seite mit "Alle" anzeigen und erneut eintragen.`, 'fehler');
    }
    if (!getroffen) { logZeile(body, 'Keine einzige Zeile konnte zugeordnet werden.', 'fehler'); return; }

    logZeile(body, `${getroffen} Person(en) ausgefüllt: ${kommentare} Feedback, ${noten} Note(n). NICHT gespeichert.`
      + (hinweis ? ' KI-Hinweis angehängt.' : ' Ohne KI-Hinweis.'), 'ok');
    logZeile(body, 'Jetzt in der Tabelle prüfen und Moodles Knopf „Speichern" ganz unten drücken.', 'ok');

    // Panel einklappen: ab hier wird in der Tabelle geprüft und dort gespeichert,
    // das Panel würde nur die Sicht verstellen (Arne, 11.09.2026).
    const panel = document.getElementById('abg-panel');
    const knopf = document.getElementById('abg-toggle');
    if (panel && knopf) { panel.hidden = true; knopf.hidden = false; }

    const ersteMarkierung = document.querySelector('textarea[name^="quickgrade_comments_"][style*="outline"]');
    if (ersteMarkierung) ersteMarkierung.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------------------------------------------------------------------
  // 7 · Start
  // ---------------------------------------------------------------------
  (async () => {
    const body = panelBauen();
    try { await modusUebersicht(body); }
    catch (e) { logZeile(body, 'Fehler: ' + e.message, 'fehler'); }
  })();

})();
