// API Service Implementation (embedded for reliability)
class ConfigManager {
  static async load() {
    try {
      const response = await fetch(chrome.runtime.getURL('config.local.json'));
      if (!response.ok) {
        throw new Error('Config file not found');
      }
      return await response.json();
    } catch (error) {
      console.warn('Config file not found or invalid. AI features will be disabled.');
      return {};
    }
  }
}

class APIService {
  constructor() {
    this.apiKey = null;
    this.model = null;
  }

  async initialize() {
    const config = await ConfigManager.load();
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL || 'gemini-2.0-flash-exp';

    if (!this.apiKey) {
      throw new Error('No API key set. Please add GEMINI_API_KEY to config.local.json');
    }
  }

  async callGemini(prompt, context = '') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async summarizeText(text) {
    const prompt = `Please summarize the following text in a clear, concise way that's easy to understand:\n\n${text}`;
    const context = 'Write a simple summary of the text. Do not include any additional information or context and do not use markdown formatting.';
    return this.callGemini(prompt, context);
  }
}

let apiService = null;

// Initialize API service
async function initializeAPIService() {
  if (!apiService) {
    apiService = new APIService();
    try {
      await apiService.initialize();
    } catch (error) {
      console.warn('Failed to initialize API service:', error);
      apiService = null;
    }
  }
  return apiService;
}

// Summarize text using Gemini
async function summarizeText(text, context = '') {
  const service = await initializeAPIService();
  if (!service) {
    throw new Error('API service not available. Please check your configuration.');
  }
  return service.summarizeText(text);
}

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

    if (request.action === 'summarizeText') {
      (async () => {
        try {
          const summary = await summarizeText(request.text, request.title || '');
          sendResponse({ summary });
        } catch (error) {
          sendResponse({ error: String(error) });
        }
      })();
      return true; // async response
    }

    if (request.action === 'addNote') {
      (async () => {
        try {
          const note = await addNote(request.summary, request.tabInfo, request.originalSelection);
          sendResponse({ note });
        } catch (error) {
          sendResponse({ error: String(error) });
        }
      })();
      return true; // async response
    }
  } catch (e) {
    try { sendResponse({ status: 'error', message: String(e) }); } catch (_) {}
  }
  return false;
});

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
  }
});