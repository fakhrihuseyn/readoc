async function fetchNotes() {
  const res = await fetch('/api/notes');
  return res.json();
}

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else e.appendChild(c); });
  return e;
}

// Make loadNotes available globally
// Set up dropdown functionality
function executeEditorCommand(cmd) {
  const ta = document.getElementById('noteEditor');
  if (!ta) return;

  if (cmd === 'bold') wrapSelection(ta, '**', '**');
  else if (cmd === 'italic') wrapSelection(ta, '*', '*');
  else if (cmd.startsWith('h')) toggleHeading(ta, parseInt(cmd.slice(1)));
  else if (cmd === 'ul') togglePrefixOnSelection(ta, '- ');
  else if (cmd === 'ol') togglePrefixOnSelection(ta, '1. ');
  else if (cmd === 'quote') togglePrefixOnSelection(ta, '> ');
  else if (cmd === 'code') wrapSelection(ta, '```\n', '\n```');
  else if (cmd === 'link') wrapSelection(ta, '[', '](http://)');
  else if (cmd === 'hr') replaceSelectedLines(ta, '\n---\n', getSelectedLines(ta));
  else if (cmd.startsWith('align-')) applyAlignment(ta, cmd.replace('align-', ''));
}

function initializeDropdowns() {
  let activeDropdown = null;

  // Handle dropdown trigger clicks
  document.querySelectorAll('.toolbar-dropdown .dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      const dropdown = this.closest('.toolbar-dropdown');
      
      // Close other dropdowns
      document.querySelectorAll('.toolbar-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
      });

      // Toggle current dropdown
      dropdown.classList.toggle('active');
      
      // Update active dropdown reference
      activeDropdown = dropdown.classList.contains('active') ? dropdown : null;
    });
  });

  // Handle ALL editor toolbar buttons including dropdown items
  document.querySelectorAll('.editor-toolbar button[data-cmd]').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const cmd = this.getAttribute('data-cmd');
      if (cmd) {
        executeEditorCommand(cmd);
      }
      // If this is a dropdown item, close the dropdown after action
      const dropdown = this.closest('.toolbar-dropdown');
      if (dropdown) {
        dropdown.classList.remove('active');
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      activeDropdown.classList.remove('active');
      activeDropdown = null;
    }
  });

  // Close dropdowns on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && activeDropdown) {
      activeDropdown.classList.remove('active');
      activeDropdown = null;
    }
  });
}

window.loadNotes = async function loadNotes() {
  const list = document.getElementById('notesList');
  list.innerHTML = '';
  const notes = await fetchNotes();
  const currentFileId = (document.getElementById('noteId') && document.getElementById('noteId').getAttribute('data-file-id')) || '';
  for (const n of notes) {
    const li = el('li');
    const a = el('a', { href: '#', 'data-id': n.id }, n.title);
  // anchor selected class not used; full .note-item is highlighted instead
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await openNote(n.id);
      // refresh list so the selected item is highlighted immediately
      await loadNotes();
    });
    // rename button
    const renameBtn = el('button', { 'data-id': n.id, title: 'Rename note', class: 'icon-btn' });
  const editImg = document.createElement('img');
  editImg.src = '/icons/edit.svg';
  editImg.alt = 'edit';
  editImg.width = 16; editImg.height = 16;
  renameBtn.appendChild(editImg);
    renameBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Inline rename: replace the anchor text with an input
      const parentItem = renameBtn.closest('.note-item');
      const link = parentItem ? parentItem.querySelector('a[data-id]') : null;
      if (!link) return;

      // Prevent multiple rename inputs
      if (parentItem.querySelector('input.rename-input')) return;

      const oldTitle = n.title;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = oldTitle;
      input.className = 'rename-input';
      input.setAttribute('aria-label', 'Rename note');

      // hide the link text and insert input
      link.style.display = 'none';
      link.parentNode.insertBefore(input, link);
      input.focus();
      input.select();

      let finished = false;

      async function applyRename() {
        if (finished) return;
        finished = true;
        const newTitle = input.value.trim();
        // cleanup UI
        input.remove();
        link.style.display = '';
        if (!newTitle || newTitle === oldTitle) return;
        try {
          const res = await fetch('/api/notes/' + encodeURIComponent(n.id) + '/rename', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle })
          });
          if (!res.ok) { const txt = await res.text(); throw new Error(txt || 'rename failed'); }
          // refresh notes and if this note is open update header
          const json = await res.json();
          // if currently open note was renamed, update header
          const noteEl = document.getElementById('noteId');
          if (noteEl && noteEl.getAttribute('data-file-id') === n.id) {
            noteEl.setAttribute('data-file-id', json.id);
            const t = document.getElementById('noteIdText'); if (t) t.textContent = newTitle;
          }
          await loadNotes();
        } catch (err) {
          alert('Rename failed: ' + (err && err.message ? err.message : 'unknown'));
        }
      }

      function cancelRename() {
        if (finished) return; finished = true;
        input.remove();
        link.style.display = '';
      }

      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); applyRename(); }
        if (ev.key === 'Escape') { ev.preventDefault(); cancelRename(); }
      });
      input.addEventListener('blur', () => { applyRename(); });
    });

    // delete (recycle) button using SVG
    const del = el('button', { 'data-id': n.id, title: 'Delete note', class: 'icon-btn' });
  const delImg = document.createElement('img');
  delImg.src = '/icons/delete.svg';
  delImg.alt = 'delete';
  delImg.width = 16; delImg.height = 16;
  del.appendChild(delImg);
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = confirm('Delete this note?');
      if (!ok) return;
      const res = await fetch('/api/notes/' + encodeURIComponent(n.id), { method: 'DELETE' });
      if (!res.ok) { alert('delete failed'); return; }
      await loadNotes();
      // if this note was open, clear editor
      const noteEl = document.getElementById('noteId');
      const current = noteEl && noteEl.getAttribute('data-file-id');
      if (current === n.id) {
        if (noteEl) {
          noteEl.setAttribute('data-file-id', '');
          const t = document.getElementById('noteIdText'); if (t) t.textContent = '';
        }
        document.getElementById('noteEditor').value = '';
        document.getElementById('preview').innerHTML = '';
      }
    });

  const itemWrap = el('div', { class: 'note-item' });
    const rightWrap = el('div');
    rightWrap.appendChild(renameBtn);
    rightWrap.appendChild(del);
  itemWrap.appendChild(a);
  itemWrap.appendChild(rightWrap);
  // highlight whole item area when selected
  if (n.id === currentFileId) itemWrap.classList.add('selected');
    li.appendChild(itemWrap);
    list.appendChild(li);
  }
}

// Make openNote available globally
window.openNote = async function openNote(id) {
  try {
    const res = await fetch('/api/notes/' + encodeURIComponent(id));
    if (!res.ok) {
      throw new Error('Failed to load note');
    }
    
    const data = await res.json();
    if (!data || !data.content) {
      throw new Error('Invalid note data received');
    }

    const noteEl = document.getElementById('noteId');
    if (noteEl) {
      noteEl.setAttribute('data-file-id', data.id);
      const t = document.getElementById('noteIdText'); if (t) t.textContent = data.id.replace(/\.md$/, '');
    }
    const ta = document.getElementById('noteEditor');
    
    // set value programmatically and reset undo/redo stacks
    isProgrammaticChange = true;
    ta.value = data.content;
    isProgrammaticChange = false;
    
  document.getElementById('preview').innerHTML = '';
    
    // reset history stacks; first user edit will be recorded via beforeinput
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    
  console.log('Note opened successfully:', { id, contentLength: data.content.length });
    return data;
  } catch (error) {
    console.error('Error opening note:', error);
    alert('Failed to load note: ' + error.message);
    throw error;
  }
}

async function saveNote() {
  // derive file id from data-file-id if present
  const noteEl = document.getElementById('noteId');
  let id = noteEl && noteEl.getAttribute('data-file-id');
  if (!id) {
    const newTitle = document.getElementById('newTitle').value.trim();
    id = newTitle ? newTitle.replace(/\s+/g, '-') + '.md' : 'untitled.md';
  }
  const content = document.getElementById('noteEditor').value;
  const res = await fetch('/api/notes/' + encodeURIComponent(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  if (!res.ok) { const j = await res.json(); const msg = (j && j.error) || res.statusText; showSaveStatus('Error: ' + msg, false); return; }
  await loadNotes();
  // store file id and update visible title
  if (noteEl) {
    noteEl.setAttribute('data-file-id', id);
    const t = document.getElementById('noteIdText'); if (t) t.textContent = id.replace(/\.md$/, '');
  }
  showSaveStatus('Saved', true);
}

async function createNote() {
  const title = document.getElementById('newTitle').value;
  if (!title) { alert('enter title'); return; }
  const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  if (!res.ok) { const j = await res.json(); alert('create failed: ' + (j.error || res.statusText)); return; }
  const json = await res.json();
  // open the created note and refresh list to show selection
  await openNote(json.id);
  await loadNotes();
}

document.getElementById('saveBtn').addEventListener('click', saveNote);
document.getElementById('createBtn').addEventListener('click', createNote);
document.getElementById('previewBtn').addEventListener('click', async () => {
  renderPreview();
});

// show save status next to Save button; success = true shows green then fades
function showSaveStatus(text, success = true) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = text;
  if (success) el.classList.add('success');
  // clear any existing fade classes
  el.classList.remove('fade-out');
  // auto-fade for success
  if (success) {
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => { el.textContent = ''; el.classList.remove('success','fade-out'); }, 500);
    }, 1200);
  }
}

window.addEventListener('load', async () => {
  await loadNotes();
  // initial preview rendering
  renderPreview();
  // live preview as user types
  document.getElementById('noteEditor').addEventListener('input', renderPreview);
});

// --- Undo / Redo history management ---
let undoStack = [];
let redoStack = [];
let isProgrammaticChange = false; // to avoid recording undo while applying undo/redo

function pushState() {
  if (isProgrammaticChange) return;
  const ta = document.getElementById('noteEditor');
  // avoid consecutive duplicate states
  const cur = ta.value;
  if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== cur) {
    undoStack.push(cur);
    // limit stack size
    if (undoStack.length > 200) undoStack.shift();
  }
  // whenever new user input occurs, clear redo
  redoStack = [];
  updateUndoRedoButtons();
}

function undo() {
  const ta = document.getElementById('noteEditor');
  if (undoStack.length === 0) return;
  isProgrammaticChange = true;
  const current = ta.value;
  const prev = undoStack.pop();
  // push current into redo
  redoStack.push(current);
  ta.value = prev;
  isProgrammaticChange = false;
  renderPreview();
  updateUndoRedoButtons();
}

function redo() {
  const ta = document.getElementById('noteEditor');
  if (redoStack.length === 0) return;
  isProgrammaticChange = true;
  const next = redoStack.pop();
  // push current into undo
  undoStack.push(ta.value);
  ta.value = next;
  isProgrammaticChange = false;
  renderPreview();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// beforeinput allows capturing state before the change
// Improved logic: group typing into word-sized undo steps.
document.getElementById('noteEditor').addEventListener('beforeinput', (e) => {
  if (isProgrammaticChange) return;
  const ta = document.getElementById('noteEditor');
  const inputType = e.inputType || '';
  const data = e.data || '';

  // If user is inserting text (usually single characters), only push state at the
  // start of a new word so typing a whole word becomes one undo step.
  if (inputType === 'insertText') {
    // if the inserted char is a word character (letter/number/underscore)
    if (/^\w$/.test(data)) {
      const caret = ta.selectionStart;
      const before = ta.value[caret - 1];
      // if caret is at start or previous char is whitespace or punctuation, this is
      // the start of a word — record state now (pre-word)
      if (before === undefined || before === '' || /\s|[.,;:!?(){}\[\]"'`~@#%^&*+=<>\\/|\-]/.test(before)) {
        pushState();
      }
      // otherwise we're continuing a word; don't push state so characters are grouped
      return;
    }
    // non-word char (space, punctuation) — push state so the previous word is committed
    pushState();
    return;
  }

  // For paste/drop or replacement operations, record state once before change
  if (inputType.startsWith('insert') || inputType === 'insertFromPaste' || inputType === 'insertFromDrop' || inputType === 'insertFromComposition') {
    pushState();
    return;
  }

  // For deletions, selection replacements, and other input types, record state.
  // This keeps undo behavior intuitive for non-typing edits.
  pushState();
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  // Undo: Ctrl/Cmd+Z (without shift)
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
  if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});

// toolbar buttons for undo/redo will be wired below (buttons added to HTML)
// wire undo/redo toolbar buttons (if present)
const undoBtnEl = document.getElementById('undoBtn');
const redoBtnEl = document.getElementById('redoBtn');
if (undoBtnEl) undoBtnEl.addEventListener('click', (e) => { e.preventDefault(); undo(); });
if (redoBtnEl) redoBtnEl.addEventListener('click', (e) => { e.preventDefault(); redo(); });
// initialize button states
updateUndoRedoButtons();

// Editor toolbar functionality

function wrapSelection(textarea, before, after = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  textarea.value = val.slice(0, start) + before + val.slice(start, end) + after + val.slice(end);
  textarea.focus();
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
}

function getSelectedLines(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = val.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
  const selected = val.slice(lineStart, lineEnd);
  const lines = selected.split('\n');
  return { lineStart, lineEnd, lines };
}

function replaceSelectedLines(textarea, newText, sel) {
  const val = textarea.value;
  textarea.value = val.slice(0, sel.lineStart) + newText + val.slice(sel.lineEnd);
  textarea.selectionStart = sel.lineStart;
  textarea.selectionEnd = sel.lineStart + newText.length;
  textarea.focus();
}

function togglePrefixOnSelection(textarea, prefix) {
  const sel = getSelectedLines(textarea);
  const toggled = sel.lines.map(line => {
    if (line.startsWith(prefix)) return line.slice(prefix.length);
    if (line.trim() === '') return line;
    return prefix + line;
  }).join('\n');
  replaceSelectedLines(textarea, toggled, sel);
}

function toggleHeading(textarea, level) {
  const prefix = '#'.repeat(level) + ' ';
  const sel = getSelectedLines(textarea);
  // if every non-empty line starts with the prefix, remove it; else add
  const allHave = sel.lines.filter(l => l.trim() !== '').every(l => l.startsWith(prefix));
  const toggled = sel.lines.map(line => {
    if (line.trim() === '') return line;
    if (allHave) return line.replace(prefix, '');
    return prefix + line;
  }).join('\n');
  replaceSelectedLines(textarea, toggled, sel);
}

function applyAlignment(textarea, align) {
  // Wrap selected block in a div with style text-align
  const sel = getSelectedLines(textarea);
  const hasWrapper = sel.lines[0].startsWith('<div') && sel.lines[sel.lines.length - 1].endsWith('</div>');
  if (hasWrapper) {
    // remove wrapper
    const inner = sel.lines.slice(1, -1).join('\n');
    replaceSelectedLines(textarea, inner, sel);
    return;
  }
  const wrapped = '<div style="text-align:' + align + ';">\n' + sel.lines.join('\n') + '\n</div>';
  replaceSelectedLines(textarea, wrapped, sel);
}

// Editor commands are now handled by executeEditorCommand

document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
  const size = e.target.value + 'px';
  document.getElementById('noteEditor').style.fontSize = size;
});

// Initialize dropdowns
initializeDropdowns();

// font selection handling
const fontSelectEl = document.getElementById('fontSelect');
if (fontSelectEl) {
  fontSelectEl.addEventListener('change', (e) => {
    const ff = e.target.value;
    document.getElementById('noteEditor').style.fontFamily = ff;
    document.getElementById('preview').style.fontFamily = ff;
  });
  // set initial font family from default selected option
  const initialFont = fontSelectEl.value;
  if (initialFont) {
    document.getElementById('noteEditor').style.fontFamily = initialFont;
    document.getElementById('preview').style.fontFamily = initialFont;
  }
}
document.getElementById('textColorPicker').addEventListener('input', function () {
  const ta = document.getElementById('noteEditor');
  const color = this.value;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  if (start !== end) {
    // Wrap selected text in a span with color style
    const before = ta.value.slice(0, start);
    const selected = ta.value.slice(start, end);
    const after = ta.value.slice(end);
    ta.value = before + `<span style="color:${color}">${selected}</span>` + after;
    // Move cursor after inserted span
    ta.selectionStart = ta.selectionEnd = start + `<span style="color:${color}">`.length + selected.length + `</span>`.length;
    ta.focus();
    // Optionally, trigger preview update
    if (typeof renderPreview === 'function') renderPreview();
  }
});
``

// Preview helper using marked
function renderPreview() {
  const md = document.getElementById('noteEditor').value || '';
  if (window.marked) {
    // basic config
    marked.setOptions({ gfm: true, breaks: true });
    const html = marked.parse(md);
    // basic protection: disallow <script> tags by replacing them
    document.getElementById('preview').innerHTML = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  } else {
    document.getElementById('preview').innerText = md;
  }
}
