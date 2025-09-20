chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
      highContrast: false,
      textSize: false,
      dyslexicFont: false,
      textSpacing: 3,
      overlayColor: '#000000',
      overlayOpacity: 0
    });
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSettings') {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'applyAccessibility',
            settings: request.settings
          });
        }
      });
    }
    return true;
  });
  
  // Do NOT auto-apply settings on every page load.
// We only apply when the user explicitly clicks Apply in the popup.