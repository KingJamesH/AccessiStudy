document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('notesRoot');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  // Tracks which site sections are expanded
  const expandedSites = new Set();
  let latestExpandedHost = null;
  let cachedNotes = [];

  // Ensure this is available to all handlers
  function updateDeleteVisibility() {
    if (!deleteBtn) return;
    const anyChecked = root.querySelector('input.note-check:checked') !== null;
    deleteBtn.style.display = anyChecked ? 'inline-flex' : 'none';
  }

  // Update delete button visibility when checkboxes change
  root.addEventListener('change', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('note-check')) {
      updateDeleteVisibility();
    }
  });

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
    const siteLatest = new Map(); // host -> latest timestamp
    for (const n of notes) {
      const url = (n.url || '').toString();
      let host = 'Unknown site';
      try { if (url) host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      if (!bySite.has(host)) bySite.set(host, []);
      bySite.get(host).push(n);
      const ts = new Date(n.timestamp || 0).getTime();
      const prev = siteLatest.get(host) || 0;
      if (ts > prev) siteLatest.set(host, ts);
    }

    // Sort sites alphabetically, and notes newest first within each site
    const siteEntries = Array.from(bySite.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    root.innerHTML = '';

    // Determine the most recently active site, expand it by default if no state yet
    if (expandedSites.size === 0) {
      let maxHost = null, maxTs = -1;
      for (const [host, ts] of siteLatest.entries()) {
        if (ts > maxTs) { maxTs = ts; maxHost = host; }
      }
      if (maxHost) {
        expandedSites.add(maxHost);
        latestExpandedHost = maxHost;
      }
    }

    for (const [host, siteNotes] of siteEntries) {
      // Remove any invalid/empty notes from this group before rendering
      const validSiteNotes = siteNotes.filter(n => {
        if (!n || typeof n !== 'object') return false;
        const idOk = typeof n.id === 'string' && n.id.trim() !== '';
        const textVal = (n.text ?? n.content ?? '').toString().trim();
        return idOk && textVal.length > 0;
      });

      if (validSiteNotes.length === 0) continue; // skip empty groups entirely
      const section = document.createElement('section');
      section.style.marginBottom = '16px';

      // Collapsible header
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'site-header';
      header.setAttribute('aria-expanded', expandedSites.has(host) ? 'true' : 'false');
      header.dataset.host = host;
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.width = '100%';
      header.style.background = 'transparent';
      header.style.border = '1px solid var(--border-color)';
      header.style.borderRadius = '6px';
      header.style.padding = '8px 10px';
      header.style.color = 'var(--text-color)';
      header.style.cursor = 'pointer';
      header.innerHTML = `
        <span style="font-size:14px;color:var(--primary-color)">${escapeHtml(host)}</span>
        <span class="chev" style="font-size:12px;color:var(--secondary-text)">
          ${expandedSites.has(host) ? '▾' : '▸'}
        </span>
      `;
      section.appendChild(header);

      const sorted = validSiteNotes.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      const content = document.createElement('div');
      content.className = 'site-content';
      content.style.marginTop = '8px';
      content.style.display = expandedSites.has(host) ? 'block' : 'none';

      for (const n of sorted) {
        const date = new Date(n.timestamp || Date.now());
        const formatted = date.toLocaleString();
        const note = document.createElement('div');
        note.className = 'note-card';
        note.dataset.id = n.id || '';
        const safeText = (n.text || n.content || '').toString();

        const source = (n.source || '').toLowerCase();
        const isAI = source === 'ai';
        const badgeText = isAI ? 'AI' : 'Human';
        const badgeColor = isAI ? '#2563eb' : '#6b7280';

        note.innerHTML = `
          <div class="note-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="note-badge" style="padding:2px 6px;border-radius:999px;font-size:11px;background:${badgeColor};color:white;">${badgeText}</span>
              <input type="checkbox" class="note-check" data-id="${escapeAttr(n.id || '')}" />
              <h3 class="note-title" style="margin:0">${n.title ? escapeHtml(n.title) : 'Note'}</h3>
            </div>
            <div class="note-date">${escapeHtml(formatted)}</div>
          </div>
          <div class="note-text">${escapeHtml(safeText)}</div>
          <div class="note-source">
            ${n.url ? `<a href="${escapeAttr(n.url)}" target="_blank" rel="noopener noreferrer">Open page</a>` : ''}
            ${n.original ? (n.url ? ' • ' : '') + `<span title="Original selection">Original included</span>` : ''}
          </div>
        `;

        content.appendChild(note);
      }

      section.appendChild(content);

      root.appendChild(section);
    }

    // Update delete button visibility after render
    updateDeleteVisibility();
  }

  async function load() {
    try {
      const data = await chrome.storage.sync.get('annotations');
      let notes = Array.isArray(data.annotations) ? data.annotations : [];
      // Normalize: ensure every note has a stable id; persist if we add any
      let changed = false;
      notes = notes.map((n, idx) => {
        if (!n || typeof n !== 'object') return n;
        if (!n.id || typeof n.id !== 'string' || n.id.trim() === '') {
          n.id = `note-${Date.now()}-${idx}`;
          changed = true;
        }
        return n;
      });
      // Prune invalid/empty notes that have no text/content
      const beforeLen = notes.length;
      notes = notes.filter(n => {
        if (!n || typeof n !== 'object') return false;
        const textVal = (n.text ?? n.content ?? '').toString().trim();
        return textVal.length > 0;
      });
      if (notes.length !== beforeLen) changed = true;
      if (changed) {
        await chrome.storage.sync.set({ annotations: notes });
      }
      cachedNotes = notes;
      renderNotes(cachedNotes);
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

  // Toggle site sections (expand/collapse)
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button.site-header');
    if (!btn) return;
    const host = btn.dataset.host;
    if (!host) return;
    if (expandedSites.has(host)) {
      expandedSites.delete(host);
    } else {
      expandedSites.add(host);
      latestExpandedHost = host;
    }
    // Update aria and chevron, and the following content block
    btn.setAttribute('aria-expanded', expandedSites.has(host) ? 'true' : 'false');
    const chev = btn.querySelector('.chev');
    if (chev) chev.textContent = expandedSites.has(host) ? '▾' : '▸';
    const content = btn.parentElement.querySelector('.site-content');
    if (content) content.style.display = expandedSites.has(host) ? 'block' : 'none';
  });

  // Delete selected notes
  deleteBtn?.addEventListener('click', async () => {
    const checks = root.querySelectorAll('input.note-check:checked');
    const ids = Array.from(checks).map(c => c.getAttribute('data-id')).filter(Boolean);
    if (ids.length === 0) {
      alert('No notes selected');
      return;
    }
    if (!confirm(`Delete ${ids.length} selected note${ids.length > 1 ? 's' : ''}?`)) return;
    try {
      const data = await chrome.storage.sync.get('annotations');
      const notes = Array.isArray(data.annotations) ? data.annotations : [];
      const remaining = notes.filter(n => !ids.includes(n.id));
      await chrome.storage.sync.set({ annotations: remaining });
      await load();
      updateDeleteVisibility();
    } catch (err) {
      console.error('Failed to delete notes:', err);
      alert('Failed to delete selected notes');
    }
  });

  refreshBtn?.addEventListener('click', load);
  exportBtn?.addEventListener('click', exportTxt);

  // Hide delete button by default until a selection is made
  if (deleteBtn) deleteBtn.style.display = 'none';

  load();
});
