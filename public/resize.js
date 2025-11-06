document.addEventListener('DOMContentLoaded', () => {
  // Initialize resizable panels
  initResizablePanels();
});

function initResizablePanels() {
  const container = document.querySelector('.container');
  const sidebar = document.querySelector('.sidebar');
  const editor = document.querySelector('.editor');
  const editorBody = document.querySelector('.editor-body');
  const noteEditor = document.querySelector('#noteEditor');
  const preview = document.querySelector('.preview');

  let isResizing = false;
  let currentResizer = null;
  let initialX;
  let initialWidth;
  let nextInitialWidth;

  // Add resize handlers to editor and preview only (sidebar is docked)
  [noteEditor, preview].forEach(panel => {
    if (!panel) return;
    const resizer = panel.querySelector('.resizer') || panel;
    resizer.addEventListener('mousedown', initResize);
  });

  function initResize(e) {
    if (!e.target.classList.contains('resizer') && e.target === e.currentTarget) return;
    
    isResizing = true;
    currentResizer = e.target;
    initialX = e.clientX;
    
  const panel = e.target.closest('#noteEditor, .preview');
  initialWidth = panel.offsetWidth;
    
    if (panel.nextElementSibling) {
      nextInitialWidth = panel.nextElementSibling.offsetWidth;
    }

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  }

  function resize(e) {
    if (!isResizing) return;

    const dx = e.clientX - initialX;
    const panel = currentResizer.closest('.sidebar, #noteEditor, .preview');
    
    // Only preview is adjustable here; editor adjustments happen via split-resize separator
    if (panel.classList.contains('preview')) {
      const newWidth = Math.max(200, Math.min(window.innerWidth * 0.6, initialWidth + dx));
      panel.style.width = `${newWidth}px`;
    }
  }

  function stopResize() {
    isResizing = false;
    currentResizer = null;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }
}