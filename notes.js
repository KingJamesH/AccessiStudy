document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('notesRoot');
  const refreshBtn = document.getElementById('refreshBtn');
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

    // Group by website (hostname)
    const bySite = new Map();
    for (const n of notes) {
      const url = (n.url || '').toString();
      let host = 'Unknown site';
      try { if (url) host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      if (!bySite.has(host)) bySite.set(host, []);
      bySite.get(host).push(n);
    }

    // Sort sites alphabetically, and notes newest first within each site
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
            <div class="note-date">${escapeHtml(formatted)}</div>
          </div>
          <div class="note-text">${escapeHtml(safeText)}</div>
          <div class="note-source">
            ${n.url ? `<a href="${escapeAttr(n.url)}" target="_blank" rel="noopener noreferrer">Open page</a>` : ''}
            ${n.original ? (n.url ? ' • ' : '') + `<span title="Original selection">Original included</span>` : ''}
          </div>
        `;

        section.appendChild(note);
      }

      root.appendChild(section);
    }
  }

  async function load() {
    try {
      const data = await chrome.storage.sync.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      renderNotes(notes);
    } catch (e) {
      console.error('Failed to load notes:', e);
      renderEmpty();
    }
  }

  async function exportTxt() {
    try {
      const data = await chrome.storage.sync.get('annotations');
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
      a.download = 'accessistudy-notes.txt';
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

  refreshBtn?.addEventListener('click', load);
  exportBtn?.addEventListener('click', exportTxt);

  load();
});
