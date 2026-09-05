// Moodle Notenstufen Autofill – background.js · Version 2.7.0 · Lizenz: CC BY-SA 4.0

chrome.runtime.onMessage.addListener((message) => {
    if (message && message.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
    }
});
