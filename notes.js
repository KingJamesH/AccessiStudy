
if (!chrome?.runtime?.id) {
  document.addEventListener('DOMContentLoaded', () => {
    alert('This page must be opened from the WebAble extension. Please open it through the extension popup.');
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #ff6b6b;">
        <h2>Error: Invalid Context</h2>
        <p>This page must be opened from the WebAble extension.</p>
        <p>Please open it through the extension popup.</p>
      </div>`;
  });
  throw new Error('Not running in extension context');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Running in extension context');
  const root = document.getElementById('notesRoot');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportBtn = document.getElementById('exportBtn');

  function renderEmpty() {
    root.innerHTML = `
      <div class="empty-state">
        No notes yet. Select text, right-click, and choose
        <strong>"Summarize selection"</strong> to add one.
      </div>
    `;
  }

  function renderNotes(notes) {
    if (!Array.isArray(notes) || notes.length === 0) {
      renderEmpty();
      return;
    }

    const bySite = new Map();
    for (const n of notes) {
      const url = (n.url || '').toString();
      let host = 'Unknown site';
      try { if (url) host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      if (!bySite.has(host)) bySite.set(host, []);
      bySite.get(host).push(n);
    }

    const siteEntries = Array.from(bySite.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    root.innerHTML = '';

    for (const [host, siteNotes] of siteEntries) {
      const section = document.createElement('section');
      section.style.marginBottom = '16px';

      const header = document.createElement('h2');
      header.textContent = host;
      header.style.fontSize = '14px';
      header.style.margin = '8px 0';
      header.style.color = 'var(--primary-color)';
      section.appendChild(header);

      const sorted = siteNotes.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      for (const n of sorted) {
        const date = new Date(n.timestamp || Date.now());
        const formatted = date.toLocaleString();
        const note = document.createElement('div');
        note.className = 'note-card';
        note.dataset.id = n.id || '';
        const safeText = (n.text || n.content || '').toString();

        note.innerHTML = `
          <div class="note-header">
            <h3 class="note-title">${n.title ? escapeHtml(n.title) : 'Note'}</h3>
            <div class="note-actions">
              <button class="delete-note-btn" data-id="${escapeAttr(n.id)}" title="Delete note">🗑️</button>
            </div>
          </div>
          <div class="note-text">${escapeHtml(safeText)}</div>
          <div class="note-source">
            <small>${escapeHtml(formatted)}</small>
            ${n.url ? ` • <a href="${escapeAttr(n.url)}" target="_blank" rel="noopener noreferrer">Open page</a>` : ''}
            ${n.original ? ` • <span title="Original selection">Original included</span>` : ''}
          </div>
        `;

        section.appendChild(note);
      }

      root.appendChild(section);
    }
  }

  async function load() {
    try {
      console.log('Loading notes from storage...');
      const data = await chrome.storage.local.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      console.log(`Found ${notes.length} notes in storage`);
      
      console.log('Parsed notes:', notes);
      
      if (notes.length === 0) {
        console.log('No notes found in any storage');
      } else {
        console.log(`Found ${notes.length} notes`);
      }
      
      renderNotes(notes);

      document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const noteId = e.target.dataset.id;
          if (confirm('Are you sure you want to delete this note?')) {
            await deleteNote(noteId);
            load();
          }
        });
      });
    } catch (e) {
      console.error('Failed to load notes:', e);
      renderEmpty();
    }
  }

  async function deleteNote(noteId) {
    try {
      const data = await chrome.storage.local.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      const filtered = notes.filter(n => n.id !== noteId);
      await chrome.storage.local.set({ annotations: filtered });
      console.log('Note deleted:', noteId);
    } catch (e) {
      console.error('Failed to delete note:', e);
      alert('Failed to delete note');
    }
  }

  async function clearAllNotes() {
    try {
      const data = await chrome.storage.local.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      if (notes.length === 0) {
        alert('No notes to clear');
        return;
      }

      if (confirm(`Are you sure you want to delete all ${notes.length} notes? This action cannot be undone.`)) {
        await chrome.storage.local.set({ annotations: [] });
        console.log('All notes cleared');
        load();
      }
    } catch (e) {
      console.error('Failed to clear notes:', e);
      alert('Failed to clear notes');
    }
  }

  async function exportTxt() {
    try {
      const data = await chrome.storage.local.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      if (notes.length === 0) {
        alert('No notes to export');
        return;
      }
      let text = 'My Notes\n==========\n\n';
      const sorted = [...notes].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
      sorted.forEach((n, i) => {
        const date = new Date(n.timestamp || Date.now()).toLocaleString();
        text += `Note ${i + 1} (${date})\n`;
        text += `${n.title ? n.title + '\n' : ''}`;
        text += `${n.text || n.content || ''}\n`;
        if (n.url) text += `Source: ${n.url}\n`;
        if (n.original) text += `Original: ${n.original}\n`;
        text += '\n';
      });

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'webable-notes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Failed to export notes');
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  if (refreshBtn) refreshBtn.addEventListener('click', load);
  if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllNotes);
  if (exportBtn) exportBtn.addEventListener('click', exportTxt);

  
  try {
    await load();
    console.log('Notes loaded ');
  } catch (error) {
    console.error('Error loading notes:', error);
    renderEmpty();
    
    const root = document.getElementById('notesRoot');
    if (root) {
      const errorDiv = document.createElement('div');
      errorDiv.style.color = '#ff6b6b';
      errorDiv.style.padding = '16px';
      errorDiv.style.border = '1px solid #ff6b6b';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.margin = '16px 0';
      errorDiv.innerHTML = `
        <h3>Error loading notes</h3>
        <p>${error.message || 'Unknown error occurred'}</p>
        <p>Please try refreshing the page.</p>
      `;
      root.prepend(errorDiv);
    }
  }
});
