// Oeffnet die Einstellungsseite, wenn das Zahnrad im Content Script darauf
// klickt. Aus dem Content Script heraus laesst sich runtime.openOptionsPage()
// nicht direkt aufrufen (Berechtigung liegt beim Hintergrund-Skript) — daher
// der kleine Umweg ueber eine Nachricht, wie schon in v2.7.0.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: any) => {
    if (message && message.action === 'openOptions') {
      browser.runtime.openOptionsPage();
    }
  });
});
