import { defineConfig } from 'wxt';

export default defineConfig({
  // Nicht .output/: ein Punkt am Anfang macht den Ordner im Finder unsichtbar,
  // und geladen wird bei WXT der BAU-Ordner, nicht der Projektordner.
  // 'Erweiterung' statt 'build': npm run paket benennt die Browser-Unterordner darin nach
  // Veroeffentlichungsnamen um und packt sie mit README zu dist/<name>.zip.
  outDir: 'Erweiterung',
  // Gebaut wird direkt in den Ordner, der auch geladen wird. Kein chrome-mv3
  // daneben, das man versehentlich laedt oder vergisst nachzuziehen.
  // Die Schreibweise "chrom" bleibt: Chrome leitet bei einer entpackten
  // Erweiterung die ID aus dem PFAD ab — ein anderer Ordnername heisst neue ID
  // und damit leerer Speicher, also gespeicherte Notenskalen weg.
  outDirTemplate: 'notenstufen-autofill-{{browser}}',
  // Firefox baut WXT sonst als MV2. Wir erzwingen ueberall MV3, damit nicht
  // zwei strukturell verschiedene Manifeste entstehen (1-browser-wxt, Abschnitt 4).
  manifestVersion: 3,
  manifest: {
    name: 'Moodle Notenstufen Autofill',
    version: '2.7.0',
    description:
      'Füllt die Notenstufen-Tabelle in Moodle-Kursen automatisch aus - in jeder Moodle-Installation, auch in einem Unterverzeichnis. Werte im Popup individuell anpassbar.',
    permissions: ['storage'],
    // Als eigener Tab, nicht eingebettet in chrome://extensions — die
    // Einstellungsseite (Zahnrad im Content Script UND Toolbar-Icon-Popup)
    // war schon in Version 2.x ein eigener, frei bedienbarer Tab.
    options_ui: { page: 'popup.html', open_in_tab: true },
    action: { default_title: 'Notenstufen-Einstellungen' },
    browser_specific_settings: {
      gecko: {
        id: 'notenstufen-autofill@spielhoff.de',
        strict_min_version: '142.0',
        // Sammelt nichts: keine Telemetrie, kein Netzverkehr, alles bleibt lokal
        // in browser.storage.local.
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
});
