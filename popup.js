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

let GEMINI_API_KEY = ''; 
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent';

function toggleSections(hasApiKey) {
  const apiKeySection = document.getElementById('apiKeySection');
  const summarizeSection = document.getElementById('summarizeSection');
  
  if (hasApiKey) {
    apiKeySection.style.display = 'none';
    summarizeSection.style.display = 'block';
  } else {
    apiKeySection.style.display = 'block';
    summarizeSection.style.display = 'none';
  }
}

async function loadApiKey() {
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    if (result.geminiApiKey) {
      GEMINI_API_KEY = result.geminiApiKey;
      document.getElementById('apiKey').value = result.geminiApiKey;
      toggleSections(true);
    } else {
      toggleSections(false);
    }
  } catch (error) {
    console.error('Error loading API key:', error);
    toggleSections(false);
  }
}

async function saveApiKey(key) {
  if (!key.trim()) {
    showStatusMessage('Please enter an API key', 'error');
    return false;
  }
  
  try {
    const statusElement = document.getElementById('apiKeyStatus');
    if (statusElement) {
      statusElement.textContent = 'Validating API key...';
      statusElement.style.display = 'block';
      statusElement.className = 'status-message info';
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 
    
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${key}`;
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Test' }] }],
        generationConfig: { maxOutputTokens: 10 }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = 'Invalid API key';
      
      if (response.status === 400) {
        errorMessage = 'Invalid API key format';
      } else if (response.status === 403) {
        errorMessage = 'API key is invalid or disabled';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      throw new Error(errorMessage);
    }
    
    await chrome.storage.sync.set({ geminiApiKey: key });
    GEMINI_API_KEY = key;
    
    if (statusElement) {
      statusElement.textContent = 'API key saved successfully!';
      statusElement.className = 'status-message success';
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
    
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
  
  saveButton.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    await saveApiKey(key);
  });
  
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });
  
  changeApiKeyBtn?.addEventListener('click', () => {
    chrome.storage.sync.remove('geminiApiKey');
    GEMINI_API_KEY = '';
    apiKeyInput.value = '';
    toggleSections(false);
    apiKeyInput.focus();
  });
}

async function testGeminiKey() {
  try {
    console.log('Testing Gemini API key...');
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Hello, how are you?'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data.error?.message || 'Unknown error');
      throw new Error('Invalid API key or API error');
    }

    return { valid: true, model: 'gemini-1.5-flash-8b' };
  } catch (error) {
    console.error('Gemini API Key Test Error:', error);
    return {
      valid: false,
      error: error.message
    };
  }
}

async function generateAISummary(content, title) {
  if (!GEMINI_API_KEY) {
    showStatusMessage('Please set your Gemini API key in the settings', 'error');
    document.getElementById('apiKey').focus();
    throw new Error('API key not set');
  }

  try {
    const prompt = `Summarize this web page in one paragraph (2-3 sentences):
    Title: ${title}
    Content: ${content.substring(0, 25000)}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Failed to generate summary');
    
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available';
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
  setupTabs();
  setupAnnotationTools();
  setupApiKeyHandlers();
  await loadApiKey();
  setupCollapsibleSections();
  
  const summarizeButton = document.getElementById('summarizeButton');
  if (summarizeButton) {
    summarizeButton.addEventListener('click', summarizePage);
  }
  
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
  
//   initializeDarkMode();
  
  document.getElementById('downloadNotesBtn')?.addEventListener('click', downloadNotesAsTxt);
  document.getElementById('openNotesBtn')?.addEventListener('click', openNotesInNewTab);
  document.getElementById('copyNotesBtn')?.addEventListener('click', copyNotesToClipboard);
  
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
