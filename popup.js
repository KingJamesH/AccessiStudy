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
          // Give the script a bit more time to initialize before retrying
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

    // Check if we're on a valid URL
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

    // Wait and ping until listener is ready
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

function showStatus(message, isError = false) {
  const statusElement = document.getElementById('status-message');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

let annotationsList;

async function saveAnnotation(annotation) {
  try {
    const data = await chrome.storage.sync.get('annotations');
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];
    
    const existingIndex = annotations.findIndex(a => a.id === annotation.id);
    
    if (existingIndex >= 0) {
      annotations[existingIndex] = annotation;
    } else {
      annotations.push(annotation);
    }
    
    await chrome.storage.sync.set({ annotations });
    console.log('Annotation saved:', annotation.id);
    return annotation;
    
  } catch (error) {
    console.error('Error saving annotation:', error);
    showStatus('Error saving note', true);
    throw error;
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
  
  // Hide all tab panes first
  tabPanes.forEach(pane => {
    pane.style.display = 'none';
  });
  
  // Show only the active tab pane
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) {
    const tabId = `${activeTab.dataset.tab}-tab`;
    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.style.display = 'block';
    }
  } else if (tabs.length > 0) {
    // If no active tab, activate the first one
    tabs[0].classList.add('active');
    const firstTabId = `${tabs[0].dataset.tab}-tab`;
    const firstPane = document.getElementById(firstTabId);
    if (firstPane) {
      firstPane.style.display = 'block';
    }
  }

  // Add click handlers for tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and hide all panes
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(pane => {
        pane.style.display = 'none';
      });

      // Activate clicked tab and show its pane
      tab.classList.add('active');
      const tabId = `${tab.dataset.tab}-tab`;
      const pane = document.getElementById(tabId);
      if (pane) {
        pane.style.display = 'block';
      }
    });
  });
}

function setupAnnotationTools() {
  const highlightBtn = document.getElementById('highlightBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const boldBtn = document.getElementById('boldBtn');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const clearFormattingBtn = document.getElementById('clearFormattingBtn');
  const highlightColor = document.getElementById('highlightColor');
  
  annotationsList = document.getElementById('annotations-list');
  
  let currentTool = null;
  const tools = [highlightBtn, underlineBtn, boldBtn, addNoteBtn];
  
  chrome.storage.sync.get('highlightColor', (data) => {
    if (data.highlightColor) {
      highlightColor.value = data.highlightColor;
    }
  });
  
  highlightColor?.addEventListener('change', (e) => {
    chrome.storage.sync.set({ highlightColor: e.target.value });
  });
  
  function setActiveTool(selectedTool) {
    tools.forEach(tool => {
      if (tool) tool.classList.toggle('active', tool === selectedTool);
    });
    currentTool = selectedTool?.id.replace('Btn', '') || null;
  }
  
  highlightBtn?.addEventListener('click', () => {
    setActiveTool(highlightBtn === currentTool ? null : highlightBtn);
  });
  
  underlineBtn?.addEventListener('click', () => {
    setActiveTool(underlineBtn === currentTool ? null : underlineBtn);
  });
  
  boldBtn?.addEventListener('click', () => {
    setActiveTool(boldBtn === currentTool ? null : boldBtn);
  });
  
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
  
  async function applyAnnotation(action, annotation = null) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        console.error('No active tab found');
        showStatus('No active tab found', true);
        return;
      }
      
      try {
        const url = new URL(tab.url);
        const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'safari-web-extension:'];
        if (restrictedProtocols.includes(url.protocol)) {
          console.log('Cannot apply annotations on this type of page:', url.protocol);
          showStatus('Annotations not available on this page', true);
          setActiveTool(null);
          return;
        }
      } catch (e) {
        console.warn('Could not parse URL, proceeding with caution');
      }
      
      const colorPicker = document.getElementById('highlightColor');
      const color = colorPicker?.value || '#FFEB3B';
      
      const message = { action };
      
      if (action === 'highlight') {
        message.color = color;
      }
      
      if (annotation) {
        message.annotation = annotation;
      }
      
      try {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (injectError) {
          console.warn('Could not inject content script:', injectError);
        }
        
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        console.warn('Could not communicate with content script:', e);
      }
      
      setActiveTool(null);
      
    } catch (error) {
      console.error(`Error applying ${action}:`, error);
      showStatus(`Error applying ${action}. Please try again.`, true);
    }
  }
  
  function setupToolHandlers() {
    // highlightBtn?.addEventListener('click', async () => {
    //   if (currentTool === 'highlight') {
    //     setActiveTool(null);
    //     return;
    //   }
    //   setActiveTool(highlightBtn);
    //   await applyAnnotation('highlight');
    // });
    
    // underlineBtn?.addEventListener('click', async () => {
    //   if (currentTool === 'underline') {
    //     setActiveTool(null);
    //     return;
    //   }
    //   setActiveTool(underlineBtn);
    //   await applyAnnotation('underline');
    // });
    
    // boldBtn?.addEventListener('click', async () => {
    //   if (currentTool === 'bold') {
    //     setActiveTool(null);
    //     return;
    //   }
    //   setActiveTool(boldBtn);
    //   await applyAnnotation('bold');
    // });
    
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
  
  setupToolHandlers();
  
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
          color: '#FFEB3B',
          url: tab?.url || '',
          domain: tab?.url ? new URL(tab.url).hostname.replace('www.', '') : '',
          title: tab?.title || 'Untitled Page'
        };
        
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
        
        addAnnotationToList(annotation);
        saveAnnotation(annotation);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setActiveTool(null);
    }
  });
  
  function handleAnnotationAction(e) {
  setActiveTool(addNoteBtn);
  
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.delete-note')) {
      e.preventDefault();
      e.stopPropagation();
      
      const annotationItem = e.target.closest('.annotation-item');
      if (annotationItem) {
        const id = annotationItem.dataset.id;
        if (id && confirm('Are you sure you want to delete this note?')) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'removeAnnotation',
                id: id
              }).catch(error => {
                console.log('Content script not available, continuing with storage update');
              });
            }
            
            const data = await chrome.storage.sync.get('annotations');
            const annotations = Array.isArray(data.annotations) ? data.annotations : [];
            const updatedAnnotations = annotations.filter(ann => ann.id !== id);
            await chrome.storage.sync.set({ annotations: updatedAnnotations });
            
            annotationItem.remove();
            showStatus('Note deleted');
            
          } catch (error) {
            console.error('Error deleting annotation:', error);
            showStatus('Error deleting note', true);
          }
        }
      }
    }
  });
  }
  
  async function loadAnnotations() {
    try {
      if (!annotationsList) {
        annotationsList = document.getElementById('annotations-list');
        if (!annotationsList) {
          console.error('Could not find annotations list element');
          return;
        }
      }
      
      annotationsList.innerHTML = '';
      
      const loading = document.createElement('div');
      loading.className = 'loading-notes';
      loading.textContent = 'Loading notes...';
      loading.style.textAlign = 'center';
      loading.style.padding = '20px';
      loading.style.color = 'var(--secondary-text)';
      annotationsList.appendChild(loading);
      
      try {
        function saveAnnotation(annotation) {
          const annotationToSave = {
            id: annotation.id || `note-${Date.now()}`,
            text: annotation.text || '',
            color: annotation.color || '#FFD700',
            timestamp: annotation.timestamp || new Date().toISOString(),
            url: annotation.url || '',
            title: annotation.title || 'Untitled Note'
          };
          
          return new Promise((resolve, reject) => {
            chrome.storage.sync.get('annotations', (data) => {
              const annotations = Array.isArray(data.annotations) ? data.annotations : [];
              const existingIndex = annotations.findIndex(a => a.id === annotationToSave.id);
              
              if (existingIndex >= 0) {
                annotations[existingIndex] = annotationToSave;
              } else {
                annotations.push(annotationToSave);
              }
              
              chrome.storage.sync.set({ annotations }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error saving annotation:', chrome.runtime.lastError);
                  showStatus('Failed to save note', true);
                  reject(chrome.runtime.lastError);
                } else {
                  showStatus('Note saved');
                  resolve(annotationToSave);
                }
              });
            });
          });
        }
        
        function deleteAnnotation(id) {
          return new Promise((resolve, reject) => {
            chrome.storage.sync.get('annotations', (data) => {
              const annotations = Array.isArray(data.annotations) ? data.annotations : [];
              const index = annotations.findIndex(a => a.id === id);
              
              if (index >= 0) {
                annotations.splice(index, 1);
              }
              
              chrome.storage.sync.set({ annotations }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error deleting annotation:', chrome.runtime.lastError);
                  showStatus('Failed to delete note', true);
                  reject(chrome.runtime.lastError);
                } else {
                  showStatus('Note deleted');
                  resolve();
                }
              });
            });
          });
        }
        
        const data = await chrome.storage.sync.get('annotations');
        const annotations = Array.isArray(data.annotations) ? data.annotations : [];
        
        annotationsList.innerHTML = '';
        
        if (annotations.length === 0) {
          const noNotes = document.createElement('div');
          noNotes.className = 'no-notes';
          noNotes.textContent = 'No notes found. Select text and click "Add Note" to create one.';
          noNotes.style.textAlign = 'center';
          noNotes.style.padding = '20px';
          noNotes.style.color = 'var(--secondary-text)';
          annotationsList.appendChild(noNotes);
        } else {
          annotations.forEach(annotation => addAnnotationToList(annotation));
          showStatus(`Loaded ${annotations.length} note${annotations.length !== 1 ? 's' : ''}`);
        }
      } catch (error) {
        console.error('Error loading annotations:', error);
        showStatus('Error loading notes', true);
      }
    } catch (error) {
      console.error('Unexpected error in loadAnnotations:', error);
      showStatus('Failed to load notes', true);
    }
  }
  
  function addAnnotationToList(annotation) {
    if (!annotationsList) {
      console.error('Annotations list element not found');
      return;
    }
    
    try {
      const annotationItem = document.createElement('div');
      annotationItem.className = 'annotation-item';
      annotationItem.dataset.id = annotation.id;
      
      const date = new Date(annotation.timestamp || Date.now());
      const formattedDate = date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const pageTitle = annotation.title || 'Current page';
      const pageUrl = annotation.url || '';
      const noteText = annotation.text || annotation.content || 'No content';
      
      annotationItem.innerHTML = `
        <div class="annotation-header">
          <div class="annotation-source">
            <i class="fas fa-globe"></i>
            ${pageUrl ? 
              `<a href="${pageUrl}" target="_blank" class="annotation-url" title="${pageTitle}">
                ${new URL(pageUrl).hostname.replace('www.', '')}
              </a>` : 
              '<span>Current page</span>'
            }
          </div>
          <div class="annotation-time">${formattedDate}</div>
        </div>
        <div class="annotation-text">${noteText.replace(/\n/g, '<br>')}</div>
        <div class="annotation-actions">
          <button class="delete-note" title="Delete note">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      
      if (annotationsList.firstChild) {
        annotationsList.insertBefore(annotationItem, annotationsList.firstChild);
      } else {
        annotationsList.appendChild(annotationItem);
      }
      
    } catch (error) {
      console.error('Error rendering annotation:', error);
      showStatus('Error displaying note', true);
      annotationItem.textContent = annotation.content || 'Invalid note';
      annotationsList.prepend(annotationItem);
    }
  }
  
  loadAnnotations();
  
  annotationsList?.addEventListener('click', handleAnnotationAction);
  
  setupAnnotationToolButtons();
  
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
      
      if (currentTool !== 'addNote') {
        setActiveTool(null);
      }
    }
  });
}

async function getAllNotes() {
  try {
    const data = await chrome.storage.sync.get('annotations');
    let storedNotes = Array.isArray(data.annotations) ? data.annotations : [];
    
    const processedNotes = storedNotes.map(note => ({
      id: note.id || `note-${Date.now()}`,
      text: note.text || note.content || '',
      color: note.color || '#FFD700',
      timestamp: note.timestamp || new Date().toISOString(),
      url: note.url || '',
      title: note.title || 'Untitled Note',
      ...note
    }));
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          const url = new URL(tab.url);
          const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'safari-web-extension:'];
          
          if (!restrictedProtocols.includes(url.protocol)) {
            const result = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {
                const notes = [];
                document.querySelectorAll('.annotation-note').forEach(note => {
                  notes.push({
                    id: note.dataset.id || `note-${Date.now()}`,
                    text: note.textContent.trim(),
                    color: note.dataset.color || '#FFD700',
                    timestamp: note.dataset.timestamp || new Date().toISOString(),
                    url: window.location.href,
                    title: document.title
                  });
                });
                return notes;
              }
            });
            
            const pageNotes = result[0]?.result || [];
            
            const mergedNotes = [...pageNotes];
            
            processedNotes.forEach(storedNote => {
              if (!mergedNotes.some(note => note.id === storedNote.id)) {
                mergedNotes.push(storedNote);
              }
            });
            
            return mergedNotes;
          }
        } catch (e) {
          console.warn('Could not get notes from page:', e);
        }
      }
    } catch (e) {
      console.warn('Could not access tab info:', e);
    }
    
    return processedNotes;
    
  } catch (error) {
    console.error('Error getting notes:', error);
    showStatus('Error loading notes', true);
    return [];
  }
}

async function downloadNotesAsTxt() {
  const notes = await getAllNotes();
  if (notes.length === 0) {
    showStatus('No notes found to download');
    return;
  }
  
  let textContent = 'My Notes\n=========\n\n';
  notes.forEach((note, index) => {
    textContent += `Note ${index + 1}:\n${note.text}\n\n`;
  });
  
  const blob = new Blob([textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-notes.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('Notes downloaded successfully!');
}

async function openNotesInNewTab() {
  try {
    // Open the notes.html page directly
    const url = chrome.runtime.getURL('notes.html');
    await chrome.tabs.create({ url });
  } catch (error) {
    console.error('Error opening notes:', error);
    showStatus('Error opening notes: ' + error.message, true);
  }
}

async function copyNotesToClipboard() {
  const notes = await getAllNotes();
  if (notes.length === 0) {
    showStatus('No notes found to copy');
    return;
  }
  
  let textToCopy = 'My Notes\n=========\n\n';
  notes.forEach((note, index) => {
    textToCopy += `Note ${index + 1}:\n${note.text}\n\n`;
  });
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    showStatus('Notes copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy notes:', error);
    showStatus('Failed to copy notes to clipboard', true);
  }
}

const overlayColorPicker = document.getElementById('overlayColor');
const overlayOpacitySlider = document.getElementById('overlayOpacity');

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
        chrome.storage.sync.set({ [sectionId]: !isExpanded });
      }
    });
  });
  
  chrome.storage.sync.get(['text-settings', 'display-settings'], (result) => {
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

function showStatusMessage(message, type = 'info') {
  const statusElement = document.getElementById('summaryStatus');
  statusElement.textContent = message;
  statusElement.className = 'status-message';
  statusElement.classList.add(type);
  statusElement.style.display = 'block';
  
  if (type !== 'error') {
    setTimeout(() => {
      if (statusElement.textContent === message) {
        statusElement.style.display = 'none';
      }
    }, 5000);
  }
}

// Gemini API configuration
let GEMINI_API_KEY = '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1/models';
const GEMINI_MODEL = 'gemini-1.5-pro';
const GEMINI_API_VERSION = 'v1';

function getGeminiApiUrl() {
  if (!GEMINI_API_KEY) throw new Error('API key not set');
  return `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
}

function toggleSections(hasApiKey) {
  try {
    const apiKeySection = document.getElementById('apiKeySection');
    const aiTab = document.getElementById('ai-tab');
    
    if (!apiKeySection) {
      console.warn('API key section not found in the DOM');
      return;
    }
    
    if (hasApiKey) {
      apiKeySection.style.display = 'none';
      if (aiTab) {
        aiTab.style.display = 'block';
      }
    } else {
      apiKeySection.style.display = 'block';
      if (aiTab) {
        aiTab.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error toggling sections:', error);
  }
}

async function loadApiKey() {
  try {
    console.log('Loading API key...');
    
    // 1) Try local config file first (highest priority)
    try {
      const response = await fetch(chrome.runtime.getURL('config.local.json'));
      if (response.ok) {
        const config = await response.json();
        const localKey = (config.geminiApiKey || '').trim();
        if (localKey) {
          console.log('Found API key in config.local.json');
          GEMINI_API_KEY = localKey;
          // Save to sync storage for future use
          await chrome.storage.sync.set({ geminiApiKey: localKey });
          
          // Update UI if elements exist
          const apiEl = document.getElementById('apiKey');
          if (apiEl) {
            apiEl.value = localKey;
          }
          
          toggleSections(true);
          return true;
        }
      }
    } catch (e) {
      console.log('No config.local.json found or error reading it:', e.message);
    }
    
    // 2) Try stored key from sync storage
    try {
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      const stored = (result.geminiApiKey || '').trim();
      if (stored) {
        console.log('Found API key in sync storage');
        GEMINI_API_KEY = stored;
        
        // Update UI if elements exist
        const apiEl = document.getElementById('apiKey');
        if (apiEl) {
          apiEl.value = stored;
        }
        
        toggleSections(true);
        return true;
      }
    } catch (e) {
      console.error('Error reading from sync storage:', e);
    }
    
    // 3) No key found anywhere
    console.log('No API key found in config.local.json or sync storage');
    toggleSections(false);
    return false;
    
  } catch (error) {
    console.error('Error in loadApiKey:', error);
    // Make sure to show the API key input section if there's an error
    toggleSections(false);
    return false;
  }
}

async function saveApiKey(key) {
  const trimmedKey = key.trim();
  const statusElement = document.getElementById('apiKeyStatus') || document.createElement('div');
  statusElement.id = 'apiKeyStatus';
  
  if (!trimmedKey) {
    showStatusMessage('Please enter an API key', 'error');
    return false;
  }
  
  try {
    // Update UI
    if (statusElement) {
      statusElement.textContent = 'Validating API key...';
      statusElement.className = 'status-message info';
      statusElement.style.display = 'block';
      
      // Ensure status element is in the DOM
      if (!document.getElementById('apiKeyStatus')) {
        const apiKeyContainer = document.querySelector('.api-key-container');
        if (apiKeyContainer) {
          apiKeyContainer.appendChild(statusElement);
        }
      }
    }
    
    // Test the API key
    GEMINI_API_KEY = trimmedKey;
    const testResult = await testGeminiKey();
    
    if (!testResult.valid) {
      throw new Error(testResult.error || 'Failed to validate API key');
    }
    
    // Save to storage
    await chrome.storage.sync.set({ geminiApiKey: trimmedKey });
    
    // Update the input field
    const apiEl = document.getElementById('apiKey');
    if (apiEl) {
      apiEl.value = trimmedKey;
    }
    
    // Show success message
    showStatusMessage('API key saved and validated successfully!', 'success');
    
    // Toggle sections to show the summarize section
    toggleSections(true);
    
    return true;
  } catch (error) {
    console.error('Error saving API key:', error);
    const statusElement = document.getElementById('apiKeyStatus') || document.createElement('div');
    statusElement.id = 'apiKeyStatus';
    statusElement.textContent = error.message || 'Failed to validate API key. Please check your connection and try again.';
    statusElement.className = 'status-message error';
    statusElement.style.display = 'block';
    
    if (!document.getElementById('apiKeyStatus')) {
      const apiKeyContainer = document.querySelector('.api-key-container');
      if (apiKeyContainer) {
        apiKeyContainer.appendChild(statusElement);
      }
    }
    
    return false;
  }
}

function setupApiKeyHandlers() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveApiKey');
  const changeApiKeyBtn = document.getElementById('changeApiKey');
  
  // Only set up event listeners if the elements exist
  if (saveButton && apiKeyInput) {
    saveButton.addEventListener('click', async () => {
      const key = apiKeyInput.value.trim();
      await saveApiKey(key);
    });
    
    apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && saveButton) {
        saveButton.click();
      }
    });
  }
  
  changeApiKeyBtn?.addEventListener('click', () => {
    chrome.storage.sync.remove('geminiApiKey');
    GEMINI_API_KEY = '';
    apiKeyInput.value = '';
    toggleSections(false);
    apiKeyInput.focus();
  });
}

async function testGeminiKey() {
  if (!GEMINI_API_KEY) {
    return { valid: false, error: 'No API key provided' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(getGeminiApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Test connection" }]
        }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 100
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      let errorMessage = 'API request failed';
      
      if (response.status === 400) {
        errorMessage = 'Invalid API key format';
      } else if (response.status === 403) {
        errorMessage = 'API key is invalid or disabled';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded';
      }
      
      return { 
        valid: false, 
        error: error.error?.message || errorMessage,
        details: error,
        status: response.status
      };
    }

    return { 
      valid: true, 
      model: GEMINI_MODEL, 
      version: GEMINI_API_VERSION,
      error: null 
    };
  } catch (error) {
    console.error('Error testing API key:', error);
    return { 
      valid: false, 
      error: error.name === 'AbortError' ? 'Request timed out' : (error.message || 'Failed to connect to API'),
      details: error
    };
  }
}

async function generateAISummary(content, title) {
  if (!GEMINI_API_KEY) {
    showStatusMessage('Please set your Gemini API key in the settings', 'error');
    document.getElementById('apiKey')?.focus();
    throw new Error('API key not set');
  }

  try {
    const prompt = `Please provide a concise summary (2-3 paragraphs) of the following content. Focus on the main points and key information.

Title: ${title || 'Untitled'}

Content:
${content.substring(0, 25000)}`;

    const response = await fetch(getGeminiApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1000,
            stopSequences: []
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      throw new Error(error.error?.message || 'Failed to generate summary');
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!summary) {
      console.error('Unexpected API response format:', data);
      throw new Error('No summary was generated - unexpected response format');
    }

    return summary;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(
      error.message.includes('quota') ? 'API quota exceeded. Check your Google AI Studio account.' :
      error.message.includes('API key') ? 'Invalid API key.' :
      error.message.includes('rate_limit') ? 'Rate limit exceeded. Try again later.' :
      'Failed to generate summary. Please try again.'
    );
  }
}

async function summarizePage() {
  const keyTest = await testGeminiKey();
  if (!keyTest.valid) {
    console.error('Gemini API Key Test Failed:', keyTest.error);
    showStatusMessage(`API Error: ${keyTest.error}`, 'error');
    return;
  }
  console.log('Gemini API Key is valid. Using model:', keyTest.model);
  const button = document.getElementById('summarizeButton');
  const resultElement = document.getElementById('summaryResult');
  
  try {
    button.disabled = true;
    showStatusMessage('Generating summary...', 'loading');
    resultElement.style.display = 'none';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
      throw new Error('Please set your Gemini API key in the popup.js file');
    }
    
    const pageContent = await extractPageContent();
    if (!pageContent || pageContent.trim().length < 100) {
      throw new Error('Not enough content on this page to generate a meaningful summary');
    }
    
    const summary = await generateAISummary(pageContent, tab.title);
    
    resultElement.innerHTML = summary.replace(/\n/g, '<br>'); 
    resultElement.style.display = 'block';
    showStatusMessage('Summary generated successfully!', 'success');
    
  } catch (error) {
    console.error('Error generating summary:', error);
    showStatusMessage(`Error: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI components
  setupTabs();
  await loadApiKey();
  setupApiKeyHandlers();
  setupCollapsibleSections();
  
  // Initialize form elements
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
  const summarizeButton = document.getElementById('summarizeButton');
  
  // Initialize annotations after a short delay to ensure DOM is ready
  console.log('Starting initialization...');
  setTimeout(() => {
    try {
      console.log('Initializing annotation tools...');
      setupAnnotationTools();
      console.log('Annotation tools initialized');
    } catch (error) {
      console.error('Error initializing annotation tools:', error);
    }
    
    // Log button states after initialization
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

  // Set up event listeners
  if (summarizeButton) {
    summarizeButton.addEventListener('click', summarizePage);
  }
  
  // Set up notes buttons
  document.getElementById('downloadNotesBtn')?.addEventListener('click', downloadNotesAsTxt);
  document.getElementById('openNotesBtn')?.addEventListener('click', openNotesInNewTab);
  document.getElementById('copyNotesBtn')?.addEventListener('click', copyNotesToClipboard);
  
  
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
  // Apply Settings button: apply current values on demand
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

      status('Applying settings...');
      
      try {
        console.log('Getting current tab...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          throw new Error('No active tab found');
        }
        
        console.log('Tab found:', tab);
        
        // Get current settings from the form with null checks
        const settings = {
          highContrast: highContrastToggle?.checked || false,
          textSize: textSizeSlider ? parseInt(textSizeSlider.value) : 100,
          dyslexicFont: dyslexicFontToggle?.checked || false,
          textSpacing: textSpacingSlider ? parseFloat(textSpacingSlider.value) : 1.0,
          lineSpacing: lineSpacingSlider ? parseFloat(lineSpacingSlider.value) : 1.5,
          overlayColor: overlayColorPicker?.value || '#000000',
          overlayOpacity: overlayOpacitySlider ? parseFloat(overlayOpacitySlider.value) : 0.5
        };
        
        console.log('Sending settings to content script:', settings);
        
        // Save settings to storage
        await chrome.storage.sync.set(settings);
        console.log('Settings saved to storage');
        
        // Inject and send message to content script
        const success = await injectAndSendMessage(settings);
        
        if (success) {
          status('Settings applied successfully!');
          // Hide status after 3 seconds
          setTimeout(() => {
            if (statusEl) statusEl.style.display = 'none';
          }, 3000);
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
  
  // Reset to Defaults button
  if (resetBtn) {
    console.log('Setting up Reset button event listener');
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Reset button clicked');
      
      if (statusEl) {
        statusEl.textContent = 'Resetting to defaults...';
        statusEl.className = 'status-message info show';
        statusEl.style.display = 'block';
      } else {
        console.error('Status element not found');
      }
      
      try {
        console.log('Processing reset...');
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
    
        const defaultSettings = {
          highContrast: false,
          textSize: 100,
          dyslexicFont: false,
          textSpacing: 1.0,
          lineSpacing: 1.0,
          overlayColor: '#000000',
          overlayOpacity: 0
        };
        
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
  }
  
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Disable auto-apply: only update the inline value labels on input
  // The actual applying happens when Apply is clicked
});
