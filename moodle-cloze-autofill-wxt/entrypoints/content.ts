import '../lib/style.css';
import { starteClozeAutofill } from '../lib/cloze-core.js';

// Das Content Script bleibt bewusst duenn: es meldet nur matches und Zeitpunkt
// an und ruft dann den Kern auf. Der Kern ist zeilengleich mit der bewaehrten
// content.js v2.0.4 — einzige Aenderungen beim Umzug: chrome.* -> browser.*,
// die IIFE wurde zu einer exportierten Funktion, und der Icon-Pfad wechselt
// von icons/icon128.png (Hand-MV3) zu icon/128.png (WXT-Struktur).
export default defineContentScript({
  matches: ['*://*/*question/edit.php*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    starteClozeAutofill();
  },
});
