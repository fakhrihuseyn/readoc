document.addEventListener('DOMContentLoaded', () => {
  const editorBody = document.querySelector('.editor-body');
  if (!editorBody) return;

  // Create and insert the separator
  const separator = document.createElement('div');
  separator.className = 'preview-separator';
  separator.setAttribute('role', 'separator');
  separator.setAttribute('aria-label', 'Resize editor and preview');
  
  // Insert separator between editor and preview
  const preview = document.querySelector('.preview');
  if (preview) {
    preview.parentNode.insertBefore(separator, preview);
  }

  let isResizing = false;
  let startX;
  let startWidths;
  let totalWidth;

  separator.addEventListener('mousedown', initResize);

  function initResize(e) {
    isResizing = true;
    startX = e.clientX;
    
    const editor = document.querySelector('#noteEditor');
    const preview = document.querySelector('.preview');
    
    // Store initial widths and total available width
    startWidths = {
      editor: editor.getBoundingClientRect().width,
      preview: preview.getBoundingClientRect().width
    };
    totalWidth = startWidths.editor + startWidths.preview;

    // Add event listeners for drag and end
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  function resize(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const editor = document.querySelector('#noteEditor');
    const preview = document.querySelector('.preview');

    // Calculate new widths as percentages of total width
    let newEditorWidth = ((startWidths.editor + deltaX) / totalWidth * 100);
    let newPreviewWidth = ((startWidths.preview - deltaX) / totalWidth * 100);

    // Enforce minimum widths (20%)
    if (newEditorWidth < 20) {
      newEditorWidth = 20;
      newPreviewWidth = 80;
    } else if (newPreviewWidth < 20) {
      newEditorWidth = 80;
      newPreviewWidth = 20;
    }

    // Apply new widths as percentages
    editor.style.flex = `0 0 ${newEditorWidth}%`;
    preview.style.flex = `0 0 ${newPreviewWidth}%`;
  }

  function stopResize() {
    if (!isResizing) return;
    
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
});