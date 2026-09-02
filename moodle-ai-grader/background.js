// Lauscht auf Nachrichten vom content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setTinyMCE') {
        // executeScript injiziert eine echte Funktion in den Seitenkontext
        // Das umgeht die CSP-Beschränkung komplett
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN', // Wichtig: MAIN = Zugriff auf window.tinymce
            func: (textareaId, htmlContent) => {
                if (typeof tinymce === 'undefined') return false;
                const editor = tinymce.get(textareaId);
                if (!editor) return false;
                editor.setContent(htmlContent);
                editor.save();
                const textarea = document.getElementById(textareaId);
                if (textarea) textarea.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            },
            args: [message.textareaId, message.htmlContent]
        }).then(results => {
            sendResponse({ success: results?.[0]?.result === true });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true; // Wichtig: Hält den Kanal für sendResponse offen
    }
});