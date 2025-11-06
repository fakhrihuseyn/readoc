document.addEventListener('DOMContentLoaded', () => {
  // Get references to DOM elements
  const fileUpload = document.getElementById('fileUpload');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadLabel = document.querySelector('.upload-label');

  // Import loadNotes function from window object (defined in app.js)
  const loadNotesList = window.loadNotes;

  // Handle drag and drop
  uploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = '#0ea5e9';
    uploadLabel.style.color = '#0ea5e9';
  });

  uploadLabel.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = '#e2e8f0';
    uploadLabel.style.color = '#64748b';
  });

  uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = '#e2e8f0';
    uploadLabel.style.color = '#64748b';
    
    const files = e.dataTransfer.files;
    handleFiles(files);
  });

  // Handle file selection
  fileUpload.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  function handleFiles(files) {
    uploadProgress.innerHTML = ''; // Clear previous progress
    
    Array.from(files).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.md') && !file.name.toLowerCase().endsWith('.markdown')) {
        showProgress(file.name, false, 'Only Markdown files (.md, .markdown) are allowed');
        return;
      }

    const reader = new FileReader();
    const progressItem = showProgress(file.name, null, 'Reading file...');

      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          // Keep the original filename without extension
          const fileName = file.name.replace(/\.md$|\.markdown$/i, "");
          
          // Create the note with the file's content
          const result = await saveNote(fileName, content);
          
          if (result && result.id) {
            progressItem.className = 'progress-item success';
            const status = progressItem.querySelector('.pi-status');
            if (status) status.textContent = 'Uploaded successfully';
            
            // Open the newly created note
            if (typeof window.openNote === 'function') {
              await window.openNote(result.id);
            }
            
            // Refresh the notes list
            if (typeof loadNotesList === 'function') {
              await loadNotesList();
            }
            // auto-dismiss success message after short delay
            scheduleRemove(progressItem, 1500);
          } else {
            throw new Error('Failed to save note: No ID returned');
          }
          
        } catch (error) {
          progressItem.className = 'progress-item error';
          const status = progressItem.querySelector('.pi-status');
          if (status) status.textContent = 'Error: ' + error.message;
        }
      };

      reader.onerror = () => {
        progressItem.className = 'progress-item error';
        const status = progressItem.querySelector('.pi-status');
        if (status) status.textContent = 'Error reading file';
      };

      reader.readAsText(file);
    });
  }

  function showProgress(fileName, success = null, message = '') {
    const item = document.createElement('div');
    item.className = 'progress-item' + (success === true ? ' success' : success === false ? ' error' : '');

    const icon = document.createElement('span');
    icon.className = 'pi-icon';
    icon.textContent = success === true ? '✓' : success === false ? '✕' : '↻';

    const main = document.createElement('div');
    main.className = 'pi-main';

    const text = document.createElement('div');
    text.className = 'pi-text';
    text.textContent = fileName;

    const status = document.createElement('div');
    status.className = 'pi-status';
    status.textContent = message || '';

  main.appendChild(text);
  main.appendChild(status);

    item.appendChild(icon);
    item.appendChild(main);
    uploadProgress.appendChild(item);

    return item;
  }

  // removed snippet preview to save UI space

  async function saveNote(title, content) {
    try {
      // Validate content
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid content: Content must be a non-empty string');
      }

      // Ensure title is valid
      if (!title || typeof title !== 'string') {
        throw new Error('Invalid title: Title must be a non-empty string');
      }

      // Create a safe filename that matches the server's create logic
      const safeBase = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
      const filename = safeBase + '.md';

      console.log('Saving note to:', filename, { contentLength: content.length });

      // Use the save (create/update) endpoint which accepts content
      const response = await fetch('/api/notes/' + encodeURIComponent(filename), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save note: ${errorText}`);
      }

      const result = await response.json();
      if (!result || !result.id) throw new Error('Invalid server response');
      return { id: result.id };
    } catch (err) {
      console.error('Error saving note:', err);
      throw err;
    }
  }

  // Schedule a fade-out and removal for transient messages
  function scheduleRemove(el, delay = 1500) {
    if (!el) return;
    // ensure we don't schedule multiple times
    if (el._removeScheduled) return;
    el._removeScheduled = true;
    setTimeout(() => {
      el.classList.add('fade-out');
      // remove from DOM after animation
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    }, delay);
  }
});