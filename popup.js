async function sendSettingsToContent(settings, retries = 5) {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) throw new Error('No active tab found');
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'applyAccessibility',
          settings: settings
        });
        if (response && response.status === 'success') {
          return true;
        } else {
          console.warn('Content script responded without success:', response);
          throw new Error('Apply did not confirm success');
        }
      } catch (error) {
        const raw = (error && error.message) ? error.message : String(error);
        const msg = raw.toLowerCase();
        if (retries > 0 && (msg.includes('receiving end') || msg.includes('could not establish connection'))) {
          console.log(`Content script not ready, injecting and retrying... (${retries} attempts left)`);
          await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            files: ['contentScript.js']
          });
          await new Promise(resolve => setTimeout(resolve, 600));
          return sendSettingsToContent(settings, retries - 1);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error sending settings to content script:', error);
      return false;
    }
  }
  
  async function injectAndSendMessage(settings) {
  console.log('injectAndSendMessage called with settings:', settings);
  try {
    console.log('Querying for active tab...');
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    console.log('Active tab found:', tab?.url);
    
    if (!tab) {
      console.error('No active tab found');
      return false;
    }

    try {
      const url = new URL(tab.url);
      const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'safari-web-extension:'];
      if (restrictedProtocols.includes(url.protocol)) {
        console.warn('Cannot inject into restricted protocol:', url.protocol);
        return false;
      }
    } catch (e) {
      console.error('Invalid URL:', tab.url, e);
      return false;
    }

    console.log('Injecting content script...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScript.js']
      });
      console.log('Content script injected successfully');
    } catch (injectError) {
      console.error('Error injecting content script:', injectError);
      return false;
    }

    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Pinging content script (attempt ${attempt}/${maxAttempts})...`);
        const pong = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        console.log('Ping response:', pong);
        if (pong && pong.status === 'pong') {
          console.log('Content script is ready');
          break;
        }
      } catch (e) {
        console.log(`Ping attempt ${attempt} failed:`, e);
        if (attempt === maxAttempts) {
          console.warn('Content script did not respond to ping after', maxAttempts, 'attempts');
          return false;
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }

    console.log('Sending settings to content script...');
    const result = await sendSettingsToContent(settings);
    console.log('Settings applied successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in injectAndSendMessage:', error);
    return false;
  }
}

async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selectors = [
          'main',
          'article',
          '[role="main"]',
          '.main-content',
          '.article',
          '.post',
          'body'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim().length > 100) {
            return element.innerText.trim();
          }
        }
        
        return document.body.innerText.trim();
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error extracting content:', error);
    throw new Error('Could not extract page content');
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabPanes.forEach(pane => {
    pane.style.display = 'none';
  });
  
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) {
    const tabId = `${activeTab.dataset.tab}-tab`;
    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.style.display = 'block';
    }
  } else if (tabs.length > 0) {
    tabs[0].classList.add('active');
    const firstTabId = `${tabs[0].dataset.tab}-tab`;
    const firstPane = document.getElementById(firstTabId);
    if (firstPane) {
      firstPane.style.display = 'block';
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(pane => {
        pane.style.display = 'none';
      });

      tab.classList.add('active');
      const tabId = `${tab.dataset.tab}-tab`;
      const pane = document.getElementById(tabId);
      if (pane) {
        pane.style.display = 'block';
      }
    });
  });
}


function setupCollapsibleSections() {
  const collapsibles = document.querySelectorAll('.collapsible-section');

  collapsibles.forEach(section => {
    const content = section.nextElementSibling;
    const isExpanded = section.getAttribute('aria-expanded') === 'true';

    section.setAttribute('aria-expanded', isExpanded);
    content.style.display = isExpanded ? 'block' : 'none';

    section.addEventListener('click', () => {
      const isExpanded = section.getAttribute('aria-expanded') === 'true';
      section.setAttribute('aria-expanded', !isExpanded);

      if (isExpanded) {
        content.style.display = 'none';
      } else {
        content.style.display = 'block';
      }

      const sectionId = section.getAttribute('aria-controls');
      if (sectionId) {
        chrome.storage.local.set({ [sectionId]: !isExpanded });
      }
    });
  });

  chrome.storage.local.get(['text-settings', 'display-settings'], (result) => {
    if (result['text-settings'] !== undefined) {
      const section = document.querySelector('[aria-controls="text-settings"]');
      if (section) {
        section.setAttribute('aria-expanded', result['text-settings']);
        const content = section.nextElementSibling;
        content.style.display = result['text-settings'] ? 'block' : 'none';
      }
    }

    if (result['display-settings'] !== undefined) {
      const section = document.querySelector('[aria-controls="display-settings"]');
      if (section) {
        section.setAttribute('aria-expanded', result['display-settings']);
        const content = section.nextElementSibling;
        content.style.display = result['display-settings'] ? 'block' : 'none';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const highContrastToggle = document.getElementById('highContrast');
  const textSizeSlider = document.getElementById('textSize');
  const textSizeValue = document.getElementById('textSizeValue');
  const dyslexicFontToggle = document.getElementById('dyslexicFont');
  const textSpacingSlider = document.getElementById('textSpacing');
  const textSpacingValue = document.getElementById('textSpacingValue');
  const lineSpacingSlider = document.getElementById('lineSpacing');
  const lineSpacingValue = document.getElementById('lineSpacingValue');
  const applyBtn = document.getElementById('applyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusEl = document.getElementById('status');
  
  console.log('Starting initialization...');
  setTimeout(() => {
    console.log('Apply button state:', {
      exists: !!applyBtn,
      type: applyBtn?.type,
      disabled: applyBtn?.disabled
    });
    
    console.log('Reset button state:', {
      exists: !!resetBtn,
      type: resetBtn?.type,
      disabled: resetBtn?.disabled
    });
  }, 100);
  
  textSizeSlider.addEventListener('input', () => {
    textSizeValue.textContent = `${textSizeSlider.value}%`;
  });
  
  if (textSpacingValue) {
    textSpacingSlider.addEventListener('input', () => {
      const pct = Math.round(parseFloat(textSpacingSlider.value) * 100);
      textSpacingValue.textContent = `${pct}%`;
    });
  }
  
  if (lineSpacingValue) {
    lineSpacingSlider.addEventListener('input', () => {
      const pct = Math.round(parseFloat(lineSpacingSlider.value) * 100);
      lineSpacingValue.textContent = `${pct}%`;
    });
  }
  
  chrome.storage.local.get(null, (settings) => {
    highContrastToggle.checked = settings.highContrast || false;
    textSizeSlider.value = settings.textSize || 100;
    textSizeValue.textContent = `${textSizeSlider.value}%`;
    dyslexicFontToggle.checked = settings.dyslexicFont || false;
    
    const defaultTextSpacing = 1.0;
    const minTextSpacing = 1.0;  
    const maxTextSpacing = 3.0;  
    
    const currentTextSpacing = Math.min(Math.max(settings.textSpacing || defaultTextSpacing, minTextSpacing), (minTextSpacing+maxTextSpacing)/2);
    
    textSpacingSlider.min = minTextSpacing;
    textSpacingSlider.max = maxTextSpacing;
    textSpacingSlider.step = 0.1;  
    textSpacingSlider.value = currentTextSpacing;
    
    if (textSpacingValue) {
      textSpacingValue.textContent = `${Math.round(currentTextSpacing * 100)}%`;
    }
    
    const defaultLineSpacing = 1.0;
    const currentLineSpacing = Math.min(Math.max(settings.lineSpacing || defaultLineSpacing, minTextSpacing), (minTextSpacing+maxTextSpacing)/2);
    
    lineSpacingSlider.min = minTextSpacing;
    lineSpacingSlider.max = maxTextSpacing;
    lineSpacingSlider.step = 0.1;
    lineSpacingSlider.value = currentLineSpacing;
    
    if (lineSpacingValue) {
      lineSpacingValue.textContent = `${Math.round(currentLineSpacing * 100)}%`;
    }
  });

  if (applyBtn) { 
    console.log('Setting up Apply button event listener');
    applyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Apply button clicked');

      const status = (message, isError = false) => {
        console.log(`[Status] ${message}`, isError ? '(Error)' : '');
        if (statusEl) {
          statusEl.textContent = message;
          statusEl.className = isError ? 'status-message error show' : 'status-message info show';
          statusEl.style.display = 'block';
        }
      };

      // Apply settings silently
      
      try {
        console.log('Getting current tab...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          throw new Error('No active tab found');
        }
        
        console.log('Tab found:', tab);

        const settings = {
          highContrast: highContrastToggle?.checked || false,
          textSize: textSizeSlider ? parseInt(textSizeSlider.value) : 100,
          dyslexicFont: dyslexicFontToggle?.checked || false,
          textSpacing: textSpacingSlider ? parseFloat(textSpacingSlider.value) : 1.0,
          lineSpacing: lineSpacingSlider ? parseFloat(lineSpacingSlider.value) : 1.5,
        };
        
        console.log('Sending settings to content script:', settings);
        
        await chrome.storage.local.set(settings);
        console.log('Settings saved to storage');
        
        const success = await injectAndSendMessage(settings);
        
        if (success) {
          // Settings applied silently - no status message
        } else {
          throw new Error('Failed to apply settings to the page');
        }
    } catch (error) {
      console.error('Error applying settings:', error);
      if (statusEl) {
        statusEl.textContent = 'Error applying settings. Please try again.';
        statusEl.className = 'status-message error show';
        statusEl.style.display = 'block';
      }
    }
    });
  }
  
  if (resetBtn) {
    console.log('Setting up Reset button event listener');
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Reset button clicked');
      
      try {
        console.log('Processing reset...');
        highContrastToggle.checked = false;
        textSizeSlider.value = 100;
        textSizeValue.textContent = '100%';
        dyslexicFontToggle.checked = false;
    
        const defaultTextSpacing = 1.0;
        textSpacingSlider.value = defaultTextSpacing;
        if (textSpacingValue) {
          textSpacingValue.textContent = '100%';
        }
        
        lineSpacingSlider.value = defaultTextSpacing;
        if (lineSpacingValue) {
          lineSpacingValue.textContent = '100%';
        }
    
        const defaultSettings = {
          highContrast: false,
          textSize: 100,
          dyslexicFont: false,
          textSpacing: 1.0,
          lineSpacing: 1.0,
        };
        
        await chrome.storage.local.set(defaultSettings);
        
        const success = await injectAndSendMessage(defaultSettings);
        
        if (success) {
          // Settings reset silently - no status message
        } else {
          throw new Error('Failed to apply default settings');
        }
      } catch (error) {
        console.error('Error resetting settings:', error);
        if (statusEl) {
          statusEl.textContent = 'Error resetting settings. Please try again.';
          statusEl.className = 'status-message error show';
        }
      }
    });
  }



  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
});
