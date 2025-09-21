chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    highContrast: false,
    textSize: 100,
    dyslexicFont: false,
    textSpacing: 1.0,
    lineSpacing: 1.0,
    overlayColor: '#000000',
    overlayOpacity: 0
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'updateSettings') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'applyAccessibility',
            settings: request.settings
          });
        }
        sendResponse({ status: 'ok' });
      });
      return true; // async response
    }

    if (request.action === 'injectCSS') {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ status: 'error', message: 'No sender tab' });
        return false;
      }
      chrome.scripting.insertCSS({
        target: { tabId },
        css: request.css || ''
      }).then(() => sendResponse({ status: 'ok' }))
        .catch(err => sendResponse({ status: 'error', message: String(err) }));
      return true; // async
    }
  } catch (e) {
    try { sendResponse({ status: 'error', message: String(e) }); } catch (_) {}
  }
  return false;
});

// Do NOT auto-apply on tab updates. Apply only on explicit popup action.