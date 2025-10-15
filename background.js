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

  // Create context menu for selected text
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'accessistudy-summarize-selection',
        title: 'Summarize selection',
        contexts: ['selection']
      });
    });
  } catch (e) {
    // ignore
  }
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

// ---------------- Context Menu Summarize Flow ----------------

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent';

async function loadApiKeyForBG() {
  // 1) storage
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    const stored = (result.geminiApiKey || '').trim();
    if (stored) return stored;
  } catch {}
  // 2) config.local.json
  try {
    const url = chrome.runtime.getURL('config.local.json');
    const resp = await fetch(url);
    if (resp.ok) {
      const cfg = await resp.json();
      const localKey = (cfg.geminiApiKey || '').trim();
      if (localKey) return localKey;
    }
  } catch {}
  return '';
}

async function summarizeText(text, pageTitle) {
  const key = await loadApiKeyForBG();
  if (!key) throw new Error('No API key set');

  const prompt = `Explain this like I'm in 5th grade. Use short, simple sentences (2-3 sentences).\n\nTitle: ${pageTitle || ''}\nText: ${text.slice(0, 25000)}`;

  const res = await fetch(`${GEMINI_API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to generate summary');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available';
}

async function addNote(summaryText, tabInfo, originalSelection) {
  const annotation = {
    id: 'note-' + Date.now(),
    text: summaryText,
    color: '#FFD700',
    timestamp: new Date().toISOString(),
    url: tabInfo?.url || '',
    title: tabInfo?.title ? `Summary: ${tabInfo.title}` : 'Summary of selection',
    original: originalSelection?.slice(0, 2000) || ''
  };

  const data = await chrome.storage.sync.get('annotations');
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  annotations.push(annotation);
  await chrome.storage.sync.set({ annotations });
  return annotation;
}

async function openNotesPage() {
  const url = chrome.runtime.getURL('notes.html');
  await chrome.tabs.create({ url });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'accessistudy-summarize-selection') {
    const selection = (info.selectionText || '').trim();
    if (!selection) return;
    try {
      const summary = await summarizeText(selection, tab?.title || '');
      await addNote(summary, tab, selection);
      await openNotesPage();
    } catch (err) {
      console.error('Context summarize failed:', err);
      // Optional: show a basic notification
      try {
        chrome.notifications?.create?.({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'AccessiStudy',
          message: `Failed to summarize: ${String(err.message || err)}`
        });
      } catch {}
    }
  } else if (info.menuItemId === 'accessistudy-save-as-note') {
    const selection = (info.selectionText || '').trim();
    if (!selection) return;
    try {
      await addNote(selection, tab, selection);
      await openNotesPage();
    } catch (err) {
      console.error('Context save as note failed:', err);
      // Optional: show a basic notification
      try {
        chrome.notifications?.create?.({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'AccessiStudy',
          message: `Failed to save as note: ${String(err.message || err)}`
        });
      } catch {}
    }
  } else if (info.menuItemId === 'accessistudy-open-notes-page') {
    await openNotesPage();
  }
});