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
  

function updateTheme(isDarkMode) {
  const root = document.documentElement;
  if (isDarkMode) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

// Global function to show status messages
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

// Global variable to store the annotations list element
let annotationsList;

// Function to save an annotation to Chrome's sync storage
async function saveAnnotation(annotation) {
  try {
    // Get existing annotations
    const data = await chrome.storage.sync.get('annotations');
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];
    
    // Check if this annotation already exists
    const existingIndex = annotations.findIndex(a => a.id === annotation.id);
    
    if (existingIndex >= 0) {
      // Update existing annotation
      annotations[existingIndex] = annotation;
    } else {
      // Add new annotation
      annotations.push(annotation);
    }
    
    // Save back to storage
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
  
  if (!document.querySelector('.tab-button.active')) {
    tabs[0]?.classList.add('active');
    tabPanes[0]?.classList.add('active');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      tab.classList.add('active');
      const tabId = `${tab.dataset.tab}-tab`;
      const pane = document.getElementById(tabId);
      if (pane) {
        pane.classList.add('active');
        
        // If notes tab is selected, load the annotations
        if (tab.dataset.tab === 'notes') {
          loadAnnotations();
        }
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
  
  // Initialize the global annotationsList variable
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
  
  // showStatus is now in global scope
  
  async function applyAnnotation(action, annotation = null) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        console.error('No active tab found');
        showStatus('No active tab found', true);
        return;
      }
      
      // Check if we can access this URL
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
        // First try to inject the content script if needed
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          });
          // Give it a moment to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (injectError) {
          console.warn('Could not inject content script:', injectError);
          // Continue anyway, the script might already be injected
        }
        
        // Now try to send the message
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        console.warn('Could not communicate with content script:', e);
        // Don't show an error for this case, as it might be expected
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
  
  // Handle note deletion
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.delete-note')) {
      e.preventDefault();
      e.stopPropagation();
      
      const annotationItem = e.target.closest('.annotation-item');
      if (annotationItem) {
        const id = annotationItem.dataset.id;
        if (id && confirm('Are you sure you want to delete this note?')) {
          try {
            // Remove from the page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'removeAnnotation',
                id: id
              }).catch(error => {
                console.log('Content script not available, continuing with storage update');
              });
            }
            
            // Remove from storage
            const data = await chrome.storage.sync.get('annotations');
            const annotations = Array.isArray(data.annotations) ? data.annotations : [];
            const updatedAnnotations = annotations.filter(ann => ann.id !== id);
            await chrome.storage.sync.set({ annotations: updatedAnnotations });
            
            // Remove from UI
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
      // Make sure annotationsList is initialized
      if (!annotationsList) {
        annotationsList = document.getElementById('annotations-list');
        if (!annotationsList) {
          console.error('Could not find annotations list element');
          return;
        }
      }
      
      // Clear existing notes
      annotationsList.innerHTML = '';
      
      // Show loading indicator
      const loading = document.createElement('div');
      loading.className = 'loading-notes';
      loading.textContent = 'Loading notes...';
      loading.style.textAlign = 'center';
      loading.style.padding = '20px';
      loading.style.color = 'var(--secondary-text)';
      annotationsList.appendChild(loading);
      
      try {
        // Get notes from storage
        function saveAnnotation(annotation) {
          // Ensure the annotation has all required fields
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
        
        // Clear loading indicator
        annotationsList.innerHTML = '';
        
        if (annotations.length === 0) {
          // Show a message when there are no notes
          const noNotes = document.createElement('div');
          noNotes.className = 'no-notes';
          noNotes.textContent = 'No notes found. Select text and click "Add Note" to create one.';
          noNotes.style.textAlign = 'center';
          noNotes.style.padding = '20px';
          noNotes.style.color = 'var(--secondary-text)';
          annotationsList.appendChild(noNotes);
        } else {
          // Add all notes to the list
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
      // Create a new annotation item
      const annotationItem = document.createElement('div');
      annotationItem.className = 'annotation-item';
      annotationItem.dataset.id = annotation.id;
      
      // Format the date
      const date = new Date(annotation.timestamp || Date.now());
      const formattedDate = date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Get page title and URL for display
      const pageTitle = annotation.title || 'Current page';
      const pageUrl = annotation.url || '';
      const noteText = annotation.text || annotation.content || 'No content';
      
      // Set the content of the annotation item with the original styling and trash icon
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
      
      // Add to the top of the list
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
    // First get notes from storage
    const data = await chrome.storage.sync.get('annotations');
    let storedNotes = Array.isArray(data.annotations) ? data.annotations : [];
    
    // Process stored notes to ensure they have all required fields
    const processedNotes = storedNotes.map(note => ({
      id: note.id || `note-${Date.now()}`,
      text: note.text || note.content || '',
      color: note.color || '#FFD700',
      timestamp: note.timestamp || new Date().toISOString(),
      url: note.url || '',
      title: note.title || 'Untitled Note',
      // Preserve any additional properties
      ...note
    }));
    
    // Then try to get notes from the current page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          const url = new URL(tab.url);
          const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'safari-web-extension:'];
          
          if (!restrictedProtocols.includes(url.protocol)) {
            // Try to get notes from the page
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
            
            // Merge page notes with stored notes, preferring page versions
            const mergedNotes = [...pageNotes];
            
            // Add stored notes that aren't already in the page notes
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
    
    // If we couldn't get page notes, just return processed stored notes
    return processedNotes;
    
  } catch (error) {
    console.error('Error getting notes:', error);
    showStatus('Error loading notes', true);
    return [];
  }
}

// Download notes as TXT file
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
    const notes = await getAllNotes();
    if (notes.length === 0) {
      showStatus('No notes found to display');
      return;
    }
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Notes (${notes.length})</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6; 
            margin: 0;
            padding: 20px;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            background-color: #f5f5f5;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
          }
          .note {
            border-left: 4px solid #3498db;
            background: white;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .note-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }
          .note-title {
            font-weight: 600;
            color: #2c3e50;
            margin: 0;
          }
          .note-date {
            color: #7f8c8d;
            font-size: 0.9em;
          }
          .note-text {
            white-space: pre-wrap;
            margin: 10px 0;
            line-height: 1.5;
          }
          .note-source {
            font-size: 0.85em;
            color: #7f8c8d;
            margin-top: 10px;
            border-top: 1px dashed #eee;
            padding-top: 8px;
          }
          .note-source a {
            color: #3498db;
            text-decoration: none;
          }
          .note-source a:hover {
            text-decoration: underline;
          }
          .no-notes {
            text-align: center;
            color: #7f8c8d;
            padding: 40px 20px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <h1>My Notes (${notes.length})</h1>
    `;
    
    if (notes.length === 0) {
      htmlContent += '<div class="no-notes">No notes found. Start by adding some notes!</div>';
    } else {
      notes.forEach((note, index) => {
        const date = new Date(note.timestamp || Date.now());
        const formattedDate = date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const noteText = (note.text || note.content || '').replace(/\n/g, '<br>');
        const noteTitle = note.title ? `From: ${note.title}` : '';
        
        htmlContent += `
          <div class="note">
            <div class="note-header">
              <h3 class="note-title">Note ${index + 1}</h3>
              <span class="note-date">${formattedDate}</span>
            </div>
            <div class="note-text">${noteText}</div>
            ${note.url ? `
              <div class="note-source">
                <a href="${note.url}" target="_blank">
                  ${noteTitle || 'View source'}
                </a>
              </div>
            ` : ''}
          </div>
        `;
      });
    }
    
    htmlContent += '</body></html>';
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url: url });
    
  } catch (error) {
    console.error('Error opening notes in new tab:', error);
    showStatus('Error displaying notes', true);
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

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupAnnotationTools();
  
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
//   const darkModeToggle = document.getElementById('darkModeToggle');
  
//   const initializeDarkMode = async () => {
//     // Default to dark mode if not set
//     const data = await chrome.storage.sync.get('darkMode');
//     const isDarkMode = data.darkMode !== undefined ? data.darkMode : true;
    
//     darkModeToggle.checked = isDarkMode;
//     updateTheme(isDarkMode);
    
//     if (data.darkMode === undefined) {
//       await chrome.storage.sync.set({ darkMode: true });
//     }
//   };
  
//   // Initialize dark mode
//   initializeDarkMode();
  
  // Add event listeners for note actions
  document.getElementById('downloadNotesBtn')?.addEventListener('click', downloadNotesAsTxt);
  document.getElementById('openNotesBtn')?.addEventListener('click', openNotesInNewTab);
  document.getElementById('copyNotesBtn')?.addEventListener('click', copyNotesToClipboard);
  
//   // Toggle dark mode
//   darkModeToggle.addEventListener('change', (e) => {
//     const isDarkMode = e.target.checked;
//     updateTheme(isDarkMode);
//     chrome.storage.sync.set({ darkMode: isDarkMode });
//   });
  
  
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
