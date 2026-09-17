import '../lib/style.css';
import { starteReviewer } from '../lib/rev-core.js';

// Das Content Script bleibt bewusst duenn: es meldet nur matches und Zeitpunkt
// an und ruft dann den Kern auf. Der Kern ist zeilengleich mit der bewaehrten
// content.js v1.5.9 — einzige Aenderungen beim Umzug: chrome.* -> browser.*,
// die IIFE wurde zu einer exportierten Funktion, und der Icon-Pfad wechselt
// von icons/icon128.png (Hand-MV3) zu icon/128.png (WXT-Struktur).
export default defineContentScript({
  matches: ['*://*/*mod/quiz/report.php*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    starteReviewer();
  },
});
