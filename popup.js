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

// Tab switching functionality
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  // Initialize first tab as active if none are active
  if (!document.querySelector('.tab-button.active')) {
    tabs[0]?.classList.add('active');
    tabPanes[0]?.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and panes
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked tab and corresponding pane
      tab.classList.add('active');
      const tabId = `${tab.dataset.tab}-tab`;
      const pane = document.getElementById(tabId);
      if (pane) {
        pane.classList.add('active');
      }
    });
  });
}

// Annotation functionality
function setupAnnotationTools() {
  const highlightBtn = document.getElementById('highlightBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const boldBtn = document.getElementById('boldBtn');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const clearFormattingBtn = document.getElementById('clearFormattingBtn');
  const highlightColor = document.getElementById('highlightColor');
  const annotationsList = document.getElementById('annotations-list');
  
  let currentTool = null;
  const tools = [highlightBtn, underlineBtn, boldBtn, addNoteBtn];
  
  // Initialize color from storage or use default
  chrome.storage.sync.get('highlightColor', (data) => {
    if (data.highlightColor) {
      highlightColor.value = data.highlightColor;
    }
  });
  
  // Save color preference when changed
  highlightColor?.addEventListener('change', (e) => {
    chrome.storage.sync.set({ highlightColor: e.target.value });
  });
  
  // Toggle tool selection
  function setActiveTool(selectedTool) {
    tools.forEach(tool => {
      if (tool) tool.classList.toggle('active', tool === selectedTool);
    });
    currentTool = selectedTool?.id.replace('Btn', '') || null;
  }
  
  // Highlight button
  highlightBtn?.addEventListener('click', () => {
    setActiveTool(highlightBtn === currentTool ? null : highlightBtn);
  });
  
  // Underline button
  underlineBtn?.addEventListener('click', () => {
    setActiveTool(underlineBtn === currentTool ? null : underlineBtn);
  });
  
  // Bold button
  boldBtn?.addEventListener('click', () => {
    setActiveTool(boldBtn === currentTool ? null : boldBtn);
  });
  
  // Clear formatting button
  clearFormattingBtn?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'clearFormatting' 
      });
      setActiveTool(null);
    } catch (error) {
      console.error('Error clearing formatting:', error);
      showStatus('Error clearing formatting. Please try again.');
    }
  });
  
  // Show status message
  function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
      statusElement.style.display = 'block';
      
      // Hide after 3 seconds
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
  
  // Apply annotation to selected text
  async function applyAnnotation(action, annotation = null) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        console.error('No active tab found');
        return;
      }
      
      // Get highlight color from the color picker or use default
      const colorPicker = document.getElementById('highlightColor');
      const color = colorPicker?.value || '#FFEB3B';
      
      // Prepare the message
      const message = { action };
      
      // Only add color for highlight action
      if (action === 'highlight') {
        message.color = color;
      }
      
      // Add annotation data if provided
      if (annotation) {
        message.annotation = annotation;
      }
      
      // Send message to content script with retry logic
      try {
        // Try to send the message
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        console.warn('Could not communicate with content script, continuing with UI update');
      }
      
      // Update UI regardless of content script success
      setActiveTool(null);
      
    } catch (error) {
      console.error(`Error applying ${action}:`, error);
      showStatus(`Error applying ${action}. Please try again.`, true);
    }
  }
  
  // Set up annotation tool button handlers
  function setupToolHandlers() {
    // Highlight button
    highlightBtn?.addEventListener('click', async () => {
      if (currentTool === 'highlight') {
        setActiveTool(null);
        return;
      }
      setActiveTool(highlightBtn);
      await applyAnnotation('highlight');
    });
    
    // Underline button
    underlineBtn?.addEventListener('click', async () => {
      if (currentTool === 'underline') {
        setActiveTool(null);
        return;
      }
      setActiveTool(underlineBtn);
      await applyAnnotation('underline');
    });
    
    // Bold button
    boldBtn?.addEventListener('click', async () => {
      if (currentTool === 'bold') {
        setActiveTool(null);
        return;
      }
      setActiveTool(boldBtn);
      await applyAnnotation('bold');
    });
    
    // Add note button
    addNoteBtn?.addEventListener('click', async () => {
      if (currentTool === 'addNote') {
        setActiveTool(null);
        return;
      }
      
      setActiveTool(addNoteBtn);
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const note = prompt('Enter your note:');
        
        if (note) {
          const annotation = {
            id: 'note-' + Date.now(),
            content: note,
            timestamp: new Date().toISOString(),
            color: document.getElementById('highlightColor')?.value || '#FFEB3B',
            url: tab?.url || '',
            domain: tab?.url ? new URL(tab.url).hostname.replace('www.', '') : '',
            title: tab?.title || 'Untitled Page'
          };
          
          await applyAnnotation('addNote', annotation);
          addAnnotationToList(annotation);
          saveAnnotation(annotation);
        }
      } catch (error) {
        console.error('Error adding note:', error);
      } finally {
        setActiveTool(null);
      }
    });
  }
  
  // Initialize tool handlers
  setupToolHandlers();
  
  // Add a note
  addNoteBtn?.addEventListener('click', async () => {
    if (currentTool === 'addNote') {
      setActiveTool(null);
      return;
    }
    
    setActiveTool(addNoteBtn);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const note = prompt('Enter your note:');
      
      if (note) {
        // Create annotation without trying to access highlightColor.value directly
        const annotation = {
          id: 'note-' + Date.now(),
          content: note,
          timestamp: new Date().toISOString(),
          color: '#FFEB3B', // Default color
          url: tab?.url || '',
          domain: tab?.url ? new URL(tab.url).hostname.replace('www.', '') : '',
          title: tab?.title || 'Untitled Page'
        };
        
        // Only try to send message if we have a valid tab ID
        if (tab?.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { 
              action: 'addNote',
              annotation: annotation
            });
          } catch (e) {
            console.log('Note saved locally (content script not available)');
          }
        }
        
        // Update UI and storage regardless of content script availability
        addAnnotationToList(annotation);
        saveAnnotation(annotation);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setActiveTool(null);
    }
  });
  
  // Handle annotation actions
  function handleAnnotationAction(e) {
    // Handle delete button click
    if (e.target.closest('.delete-note')) {
      e.preventDefault();
      e.stopPropagation();
      
      const annotationItem = e.target.closest('.annotation-item');
      const annotationId = annotationItem?.dataset.id;
      
      if (annotationId) {
        // Show confirmation before deleting
        if (confirm('Are you sure you want to delete this note?')) {
          deleteAnnotation(annotationId);
        }
      }
      return false;
    }
  }
  
  // Save annotation to storage
  function saveAnnotation(annotation) {
    chrome.storage.sync.get('annotations', (data) => {
      const annotations = data.annotations || [];
      annotations.push(annotation);
      chrome.storage.sync.set({ annotations });
    });
  }
  
  // Delete annotation from storage
  function deleteAnnotation(id) {
    // First remove from storage
    chrome.storage.sync.get('annotations', (data) => {
      const annotations = (data.annotations || []).filter(a => a.id !== id);
      chrome.storage.sync.set({ annotations });
      
      // Try to remove from the page if content script is available
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Try to send message to content script
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'removeAnnotation',
            id: id
          }).catch(error => {
            console.log('Content script not available, continuing with UI update');
          });
        }
      });
    });
    
    // Remove from UI immediately for better responsiveness
    const annotationItem = document.querySelector(`.annotation-item[data-id="${id}"]`);
    if (annotationItem) {
      annotationItem.remove();
    }
  }
  
  // Load saved annotations
  function loadAnnotations() {
    chrome.storage.sync.get('annotations', (data) => {
      const annotations = data.annotations || [];
      annotations.forEach(annotation => {
        addAnnotationToList(annotation);
      });
    });
  }
  
  // Add annotation to the list
  function addAnnotationToList(annotation) {
    if (!annotationsList) return;
    
    const annotationItem = document.createElement('div');
    annotationItem.className = 'annotation-item';
    annotationItem.dataset.id = annotation.id;
    
    try {
      // Format timestamp
      const date = new Date(annotation.timestamp || new Date().toISOString());
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      // Create a safe title and domain
      const safeTitle = annotation.title || 'Untitled Page';
      const safeDomain = annotation.domain || (annotation.url ? new URL(annotation.url).hostname.replace('www.', '') : 'Current page');
      
      annotationItem.innerHTML = `
        <div class="annotation-header">
          <div class="annotation-source">
            <i class="fas fa-globe"></i>
            ${annotation.url ? 
              `<a href="${annotation.url}" target="_blank" class="annotation-url" title="${safeTitle}">
                ${safeDomain}
              </a>` : 
              '<span>Current page</span>'
            }
          </div>
          <div class="annotation-time">${formattedDate}</div>
        </div>
        <div class="annotation-text">${annotation.content || ''}</div>
        <div class="annotation-actions">
          <button class="delete-note" title="Delete note">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      annotationsList.prepend(annotationItem);
    } catch (error) {
      console.error('Error rendering annotation:', error);
      // Fallback to simple display if there's an error
      annotationItem.textContent = annotation.content || 'Invalid note';
      annotationsList.prepend(annotationItem);
    }
  }
  
  // Load saved annotations when popup opens
  loadAnnotations();
  
  // Listen for annotation actions using event delegation
  annotationsList?.addEventListener('click', handleAnnotationAction);
  
  // Setup annotation tool buttons
  setupAnnotationToolButtons();
  
  // Function to handle annotation tool buttons
  async function setupAnnotationToolButtons() {
    const buttons = [
      { id: 'highlightBtn', action: 'applyAnnotation', type: 'highlight' },
      { id: 'underlineBtn', action: 'applyAnnotation', type: 'underline' },
      { id: 'boldBtn', action: 'applyAnnotation', type: 'bold' },
      { id: 'clearFormattingBtn', action: 'clearFormatting' }
    ];
    
    for (const { id, action, type } of buttons) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            let color = null;
            if (type === 'highlight') {
              const colorPicker = document.getElementById('highlightColor');
              color = colorPicker ? colorPicker.value : '#FFEB3B';
            }
            
            await chrome.tabs.sendMessage(tab.id, { 
              action,
              type,
              color
            });
            
            // Update UI feedback
            if (action === 'clearFormatting') {
              setActiveTool(null);
            } else {
              setActiveTool(btn);
            }
          } catch (error) {
            console.error(`Error with ${action}:`, error);
            showStatus(`Error applying ${type || 'formatting'}. Please try again.`);
          }
        });
      }
    }
  }
  annotationsList?.addEventListener('click', handleAnnotationAction);
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applyAnnotation' && currentTool) {
      let color = null;
      if (currentTool === 'highlight') {
        const colorPicker = document.getElementById('highlightColor');
        color = colorPicker ? colorPicker.value : '#FFEB3B';
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'applyAnnotation',
          type: currentTool,
          color: color
        });
      });
      
      // Only clear selection for non-note tools
      if (currentTool !== 'addNote') {
        setActiveTool(null);
      }
    }
  });
}

// Move these to the top level scope
const overlayColorPicker = document.getElementById('overlayColor');
const overlayOpacitySlider = document.getElementById('overlayOpacity');

document.addEventListener('DOMContentLoaded', () => {
  // Setup tabs and annotation tools
  setupTabs();
  setupAnnotationTools();
  
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
    
    if (overlayColorPicker) {
      overlayColorPicker.value = settings.overlayColor || '#000000';
    }
    if (overlayOpacitySlider) {
      overlayOpacitySlider.value = settings.overlayOpacity || 0;
    }
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
