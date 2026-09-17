import '../lib/style.css';
import { starteCoach } from '../lib/coach-core.js';

// Das Content Script bleibt bewusst duenn: es meldet nur matches und Zeitpunkt
// an und ruft dann den Kern auf. Der Kern ist zeilengleich mit der bewaehrten
// content.js v1.8.10 — einzige Aenderungen beim Umzug: chrome.* -> browser.*
// und die IIFE wurde zu einer exportierten Funktion (sonst liefe sie schon
// beim Erzeugen der Typen los, wo es kein `location` gibt).
export default defineContentScript({
  matches: ['*://*/*mod/quiz/report.php*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    starteCoach();
  },
});
