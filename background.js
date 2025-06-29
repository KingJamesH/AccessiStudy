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
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      chrome.storage.sync.get(null, (settings) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'applyAccessibility',
          settings: settings
        });
      });
    }
  });
  