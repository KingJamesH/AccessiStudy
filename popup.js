async function sendSettingsToContent(settings, retries = 3) {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) throw new Error('No active tab found');
      
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'applyAccessibility',
          settings: settings
        });
        return true;
      } catch (error) {
        if (retries > 0 && error.message.includes('receiving end')) {
          console.log(`Content script not ready, injecting and retrying... (${retries} attempts left)`);
          await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            files: ['contentScript.js']
          });
          await new Promise(resolve => setTimeout(resolve, 200));
          return sendSettingsToContent(settings, retries - 1);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error sending settings to content script:', error);
      showStatus('Error applying settings. Please refresh the page and try again.');
      return false;
    }
  }
  
  async function injectAndSendMessage(settings) {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) return false;
  
      try {
        return await sendSettingsToContent(settings);
      } catch (err) {
        console.log('Initial send failed, attempting to inject content script...');
        await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['contentScript.js']
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return await sendSettingsToContent(settings);
      }
    } catch (error) {
      console.error('Error in injectAndSendMessage:', error);
      showStatus('Error applying settings. Please refresh the page and try again.');
      return false;
    }
  }
  

// Function to update the theme based on dark mode preference
function updateTheme(isDarkMode) {
  const root = document.documentElement;
  if (isDarkMode) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

// Function to extract main content from the page
async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Inject content script to extract the main content
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to get the main content using common selectors
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

document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const highContrastToggle = document.getElementById('highContrast');
  const textSizeSlider = document.getElementById('textSize');
  const textSizeValue = document.getElementById('textSizeValue');
  const dyslexicFontToggle = document.getElementById('dyslexicFont');
  const textSpacingSlider = document.getElementById('textSpacing');
  const textSpacingValue = document.getElementById('textSpacingValue');
  const lineSpacingSlider = document.getElementById('lineSpacing');
  const lineSpacingValue = document.getElementById('lineSpacingValue');
  const overlayColorPicker = document.getElementById('overlayColor');
  const overlayOpacitySlider = document.getElementById('overlayOpacity');
  const applyBtn = document.getElementById('applyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusEl = document.getElementById('status');
  const darkModeToggle = document.getElementById('darkModeToggle');
  
  // Set dark mode as default and handle theme toggle
  const initializeDarkMode = async () => {
    // Default to dark mode if not set
    const data = await chrome.storage.sync.get('darkMode');
    const isDarkMode = data.darkMode !== undefined ? data.darkMode : true;
    
    // Update UI and theme
    darkModeToggle.checked = isDarkMode;
    updateTheme(isDarkMode);
    
    // Save the preference if it wasn't set
    if (data.darkMode === undefined) {
      await chrome.storage.sync.set({ darkMode: true });
    }
  };
  
  // Initialize dark mode
  initializeDarkMode();
  
  // Toggle dark mode
  darkModeToggle.addEventListener('change', (e) => {
    const isDarkMode = e.target.checked;
    updateTheme(isDarkMode);
    chrome.storage.sync.set({ darkMode: isDarkMode });
  });
  
  // No AI functionality
  
  // Event Listeners
  textSizeSlider.addEventListener('input', () => {
    textSizeValue.textContent = `${textSizeSlider.value}%`;
  });
  
  if (textSpacingValue) {
    textSpacingSlider.addEventListener('input', () => {
      textSpacingValue.textContent = `${textSpacingSlider.value * 100}%`;
    });
  }
  
  if (lineSpacingValue) {
    lineSpacingSlider.addEventListener('input', () => {
      lineSpacingValue.textContent = `${lineSpacingSlider.value * 100}%`;
    });
  }
  
  chrome.storage.sync.get(null, (settings) => {
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
    
    overlayColorPicker.value = settings.overlayColor || '#000000';
    overlayOpacitySlider.value = settings.overlayOpacity || 0;
  });
  
  applyBtn.addEventListener('click', async () => {
    const textSpacingValue = parseFloat(textSpacingSlider.value);
    console.log('Text Spacing Value:', textSpacingValue); 
    
    const settings = {
      highContrast: highContrastToggle.checked,
      textSize: parseInt(textSizeSlider.value),
      dyslexicFont: dyslexicFontToggle.checked,
      textSpacing: parseFloat(textSpacingSlider.value),
      lineSpacing: parseFloat(lineSpacingSlider.value),
      ...(overlayColorPicker && { overlayColor: overlayColorPicker.value }),
      ...(overlayOpacitySlider && { overlayOpacity: parseFloat(overlayOpacitySlider.value) })
    };
    
    if (statusEl) {
      statusEl.textContent = 'Applying settings...';
      statusEl.className = 'status-message info show';
    }
    
    try {
      await chrome.storage.sync.set(settings);
      
      const success = await injectAndSendMessage(settings);
      
      if (success) {
        if (statusEl) {
          statusEl.textContent = 'Settings applied successfully!';
          statusEl.className = 'status-message success show';
        }
      } else {
        throw new Error('Failed to apply settings');
      }
    } catch (error) {
      console.error('Error applying settings:', error);
      if (statusEl) {
        statusEl.textContent = 'Error applying settings. Please try again.';
        statusEl.className = 'status-message error show';
      }
      return; 
    }
    
    // Keep popup open after applying settings
  });
  
  resetBtn.addEventListener('click', async () => {
    // Set default values in the UI
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
    
    if (overlayColorPicker) overlayColorPicker.value = '#000000';
    if (overlayOpacitySlider) overlayOpacitySlider.value = 0;
    
    if (statusEl) {
      statusEl.textContent = 'Resetting to default settings...';
      statusEl.className = 'status-message info show';
    }
    
    const defaultSettings = {
      highContrast: false,
      textSize: 100,
      dyslexicFont: false,
      textSpacing: 1.0,
      lineSpacing: 1.0,
      overlayColor: '#000000',
      overlayOpacity: 0
    };
    
    try {
      await chrome.storage.sync.set(defaultSettings);
      
      const success = await injectAndSendMessage(defaultSettings);
      
      if (success) {
        if (statusEl) {
          statusEl.textContent = 'Settings reset successfully!';
          statusEl.className = 'status-message success show';
        }
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
  
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  const updateSettingsInRealTime = debounce(async () => {
    const settings = {
      highContrast: highContrastToggle.checked,
      textSize: parseInt(textSizeSlider.value),
      dyslexicFont: dyslexicFontToggle.checked,
      textSpacing: parseFloat(textSpacingSlider.value),
      overlayColor: overlayColorPicker.value,
      overlayOpacity: parseFloat(overlayOpacitySlider.value)
    };
    
    try {
      await chrome.storage.sync.set(settings);
      
      await injectAndSendMessage(settings);
    } catch (error) {
      console.error('Error updating settings in real-time:', error);
    }
  }, 150); 

  [highContrastToggle, dyslexicFontToggle].filter(Boolean).forEach(element => {
    element.addEventListener('change', updateSettingsInRealTime);
  });
  
  [textSizeSlider, textSpacingSlider, lineSpacingSlider].filter(Boolean).forEach(element => {
    if (element) {
      element.addEventListener('input', updateSettingsInRealTime);
    }
  });
  
  if (overlayColorPicker) {
    overlayColorPicker.addEventListener('change', updateSettingsInRealTime);
  }
  
  if (overlayOpacitySlider) {
    overlayOpacitySlider.addEventListener('input', updateSettingsInRealTime);
  }
});
