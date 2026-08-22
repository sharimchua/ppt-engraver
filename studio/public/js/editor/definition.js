/**
 * Go-To-Definition (Ctrl+Click / F12) and ID Hover Underlines for CodeMirror
 */

import { events } from '../state.js';
import { getTargetIdAtPos, findDefinitionInYaml } from '../core/ast-scanner.js';

export function setupGoToDefinition(editor) {
  let currentHoverMark = null;

  function clearIdHover() {
    if (currentHoverMark) {
      currentHoverMark.clear();
      currentHoverMark = null;
    }
  }

  const wrapper = editor.getWrapperElement();

  wrapper.addEventListener('mousemove', (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      clearIdHover();
      return;
    }

    const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
    const target = getTargetIdAtPos(editor, pos);

    if (target) {
      clearIdHover();
      currentHoverMark = editor.markText(target.range.from, target.range.to, {
        className: 'cm-id-reference-hover',
      });
      return;
    }
    clearIdHover();
  });

  wrapper.addEventListener('mousedown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;

    const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
    const target = getTargetIdAtPos(editor, pos);

    if (target) {
      const def = findDefinitionInYaml(editor.getValue(), target.id);
      if (def) {
        e.preventDefault();
        e.stopPropagation();
        clearIdHover();

        editor.setCursor(def);
        editor.scrollIntoView(def, 150);
        editor.focus();

        editor.addLineClass(def.line, 'background', 'cm-point-click-flash');
        setTimeout(() => {
          editor.removeLineClass(def.line, 'background', 'cm-point-click-flash');
        }, 1200);

        events.emit('editor:cursorActivity', editor);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      clearIdHover();
    }
  });
}

export function triggerGoToDefinition(editor) {
  const cur = editor.getCursor();
  const target = getTargetIdAtPos(editor, cur);
  if (target) {
    const def = findDefinitionInYaml(editor.getValue(), target.id);
    if (def) {
      editor.setCursor(def);
      editor.scrollIntoView(def, 150);
      editor.focus();

      editor.addLineClass(def.line, 'background', 'cm-point-click-flash');
      setTimeout(() => {
        editor.removeLineClass(def.line, 'background', 'cm-point-click-flash');
      }, 1200);

      events.emit('editor:cursorActivity', editor);
      return true;
    }
  }
  return false;
}
