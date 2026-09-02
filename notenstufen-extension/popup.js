// Moodle Notenstufen Autofill – popup.js · Version 2.7 · Lizenz: CC BY-SA 4.0

// Gymnasium-Standardwerte (Vorgabe)
const DEFAULT_NOTEN_GYMNASIUM = [
    ['1+', '98,00000'],
    ['1',  '95,00000'],
    ['1-', '90,50000'],
    ['2+', '86,00000'],
    ['2',  '81,50000'],
    ['2-', '77,00000'],
    ['3+', '72,50000'],
    ['3',  '68,00000'],
    ['3-', '63,50000'],
    ['4+', '59,00000'],
    ['4',  '54,50000'],
    ['4-', '50,00000'],
    ['5+', '40,00000'],
    ['5',  '30,00000'],
    ['5-', '20,00000'],
    ['6',  '0,00000'],
];

// Stadtteilschule-Standardwerte (Vorgabe)
const DEFAULT_NOTEN_STADTTEILSCHULE = [
    ['E1+', '97,00'],
    ['E1',  '94,00'],
    ['E1-', '91,00'],
    ['E2+', '86,00'],
    ['E2',  '81,00'],
    ['E2-', '77,00'],
    ['E3+', '73,00'],
    ['E3',  '68,00'],
    ['E3-', '64,00'],
    ['E4+', '59,00'],
    ['E4',  '55,00'],
    ['E4-', '50,00'],
    ['G2+', '46,00'],
    ['G2',  '42,00'],
    ['G2-', '38,00'],
    ['G3+', '34,00'],
    ['G3',  '30,00'],
    ['G3-', '27,00'],
    ['G4+', '24,00'],
    ['G4',  '21,00'],
    ['G4-', '19,00'],
    ['G5+', '16,00'],
    ['G5',  '13,00'],
    ['G5-', '10,00'],
    ['G6',  '0,00'],
];

const tabelle = document.getElementById('tabelle');
const statusEl = document.getElementById('status');

function renderTabelle(noten) {
    tabelle.innerHTML = '';
    noten.forEach((paar, i) => {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.className = 'note-label';
        tdLabel.textContent = `Note ${i + 1}`;

        const tdBuchstabe = document.createElement('td');
        const inputBuchstabe = document.createElement('input');
        inputBuchstabe.type = 'text';
        inputBuchstabe.dataset.idx = i;
        inputBuchstabe.dataset.feld = 'buchstabe';
        inputBuchstabe.value = paar[0];
        tdBuchstabe.appendChild(inputBuchstabe);

        const tdProzent = document.createElement('td');
        const inputProzent = document.createElement('input');
        inputProzent.type = 'text';
        inputProzent.dataset.idx = i;
        inputProzent.dataset.feld = 'prozent';
        inputProzent.value = paar[1];
        tdProzent.appendChild(inputProzent);

        tr.appendChild(tdLabel);
        tr.appendChild(tdBuchstabe);
        tr.appendChild(tdProzent);
        tabelle.appendChild(tr);
    });
}

function leseTabelle() {
    const anzahl = tabelle.querySelectorAll('tr').length;
    const zeilen = Array.from({ length: anzahl }, () => ['', '']);
    tabelle.querySelectorAll('input').forEach(input => {
        const idx = parseInt(input.dataset.idx, 10);
        const feldIndex = input.dataset.feld === 'buchstabe' ? 0 : 1;
        zeilen[idx][feldIndex] = input.value.trim();
    });
    return zeilen;
}

function zeigeStatus(text) {
    statusEl.textContent = text;
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

function speichern(noten) {
    chrome.storage.local.set({ notenstufen: noten }, () => {
        zeigeStatus('Gespeichert ✓');
    });
}

// Beim Öffnen: gespeicherte Werte laden, sonst Gymnasium-Standard
chrome.storage.local.get(['notenstufen'], (result) => {
    const noten = (Array.isArray(result.notenstufen) && result.notenstufen.length > 0)
        ? result.notenstufen
        : DEFAULT_NOTEN_GYMNASIUM;
    renderTabelle(noten);
});

document.getElementById('speichern').addEventListener('click', () => {
    speichern(leseTabelle());
});

document.getElementById('preset-gymnasium').addEventListener('click', () => {
    renderTabelle(DEFAULT_NOTEN_GYMNASIUM);
    speichern(DEFAULT_NOTEN_GYMNASIUM);
});

document.getElementById('preset-stadtteilschule').addEventListener('click', () => {
    renderTabelle(DEFAULT_NOTEN_STADTTEILSCHULE);
    speichern(DEFAULT_NOTEN_STADTTEILSCHULE);
});

document.getElementById('schliessen').addEventListener('click', () => {
    window.close();
});
