/**
 * Draggable Split-Pane Layout & Persistence
 */

export function setupSplitPane(onResize) {
  const mainContainer = document.querySelector('.main-container');
  const editorPanel = document.getElementById('editor-panel');
  const splitGutter = document.getElementById('split-gutter');

  const MIN_EDITOR_WIDTH = 320;
  const MIN_PREVIEW_WIDTH = 360;
  let isDraggingSplitter = false;

  const savedSplitWidth = localStorage.getItem('ppt_split_editor_width');
  if (savedSplitWidth && editorPanel && mainContainer) {
    const widthNum = parseInt(savedSplitWidth, 10);
    const containerWidth = mainContainer.clientWidth || window.innerWidth;
    if (widthNum >= MIN_EDITOR_WIDTH && widthNum <= (containerWidth - MIN_PREVIEW_WIDTH)) {
      editorPanel.style.width = `${widthNum}px`;
      editorPanel.style.flex = `0 0 ${widthNum}px`;
    }
  }

  if (splitGutter && editorPanel && mainContainer) {
    splitGutter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDraggingSplitter = true;
      document.body.classList.add('resizing-panels');
      splitGutter.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingSplitter) return;
      const containerRect = mainContainer.getBoundingClientRect();
      let newWidth = e.clientX - containerRect.left;

      const maxWidth = containerRect.width - MIN_PREVIEW_WIDTH;
      if (newWidth < MIN_EDITOR_WIDTH) newWidth = MIN_EDITOR_WIDTH;
      if (newWidth > maxWidth) newWidth = maxWidth;

      editorPanel.style.width = `${newWidth}px`;
      editorPanel.style.flex = `0 0 ${newWidth}px`;
      localStorage.setItem('ppt_split_editor_width', String(Math.round(newWidth)));
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingSplitter) {
        isDraggingSplitter = false;
        document.body.classList.remove('resizing-panels');
        splitGutter.classList.remove('dragging');
        onResize?.();
      }
    });
  }
}
