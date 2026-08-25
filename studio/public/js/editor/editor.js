/**
 * CodeMirror Editor Manager & Integration
 */

import { state, events, setDirty } from '../state.js';
import { registerSolfegeOverlayMode, solfegeOverlay } from './solfege-mode.js';
import { registerAutocomplete } from './autocomplete.js';
import { setupGoToDefinition, triggerGoToDefinition } from './definition.js';
import { updateInlineSolfegeWidget, clearInlineWidget } from './solfege-strip.js';
import { updatePairedTokenHighlights, clearPairedTokenHighlights } from './paired-highlights.js';
import { updateScoreHighlights } from '../preview/score-highlighter.js';
import {
  handleContextualUp,
  handleContextualDown,
  handleContextualAltUp,
  handleContextualAltDown,
  handleSolfegeNavigation,
  duplicatePropertyBlock,
} from './shortcuts.js';
import { scanDeclaredCoilsAndWeaves } from '../core/ast-scanner.js';

let editorInstance = null;
let compileDebounceTimer = null;
let cursorDebounceTimer = null;

export function initEditor(container, commandHandlers = {}) {
  const CodeMirror = window.CodeMirror;
  if (!CodeMirror) {
    throw new Error('CodeMirror library not loaded');
  }

  // Register custom modes & autocomplete helpers
  registerSolfegeOverlayMode(CodeMirror);
  registerAutocomplete(CodeMirror);

  editorInstance = CodeMirror(container, {
    mode: 'yaml',
    theme: 'dracula',
    lineNumbers: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    tabSize: 2,
    indentUnit: 2,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    extraKeys: {
      'Ctrl-S': () => commandHandlers.saveScore?.(),
      'Cmd-S': () => commandHandlers.saveScore?.(),
      'Ctrl-O': () => commandHandlers.openTapestryPicker?.(),
      'Cmd-O': () => commandHandlers.openTapestryPicker?.(),
      'Ctrl-Alt-N': () => commandHandlers.createTapestry?.(),
      'Cmd-Alt-N': () => commandHandlers.createTapestry?.(),
      'Alt-N': () => commandHandlers.createTapestry?.(),
      'Ctrl-Enter': () => commandHandlers.triggerCompile?.(),
      'Cmd-Enter': () => commandHandlers.triggerCompile?.(),
      'Ctrl-Shift-P': (cm) => commandHandlers.openCommandPalette?.(cm),
      'Cmd-Shift-P': (cm) => commandHandlers.openCommandPalette?.(cm),
      'Shift-Ctrl-P': (cm) => commandHandlers.openCommandPalette?.(cm),
      'Shift-Cmd-P': (cm) => commandHandlers.openCommandPalette?.(cm),
      'Ctrl-Shift-E': () => commandHandlers.exportPdf?.(),
      'Cmd-Shift-E': () => commandHandlers.exportPdf?.(),
      'Shift-Ctrl-E': () => commandHandlers.exportPdf?.(),
      'Shift-Cmd-E': () => commandHandlers.exportPdf?.(),
      'F1': (cm) => commandHandlers.openCommandPalette?.(cm),
      'Ctrl-Shift-M': () => commandHandlers.toggleMidi?.(),
      'Cmd-Shift-M': () => commandHandlers.toggleMidi?.(),
      'Shift-Ctrl-M': () => commandHandlers.toggleMidi?.(),
      'Shift-Cmd-M': () => commandHandlers.toggleMidi?.(),
      'F2': (cm) => commandHandlers.renameSymbol?.(cm),
      'F12': (cm) => triggerGoToDefinition(cm),
      'Ctrl-G': (cm) => commandHandlers.openGotoReferencePalette?.(cm),
      'Cmd-G': (cm) => commandHandlers.openGotoReferencePalette?.(cm),
      'Ctrl-Alt-Enter': (cm) => duplicatePropertyBlock(cm),
      'Cmd-Alt-Enter': (cm) => duplicatePropertyBlock(cm),
      'Ctrl-Alt-P': (cm) => commandHandlers.extractParentCoil?.(cm),
      'Cmd-Alt-P': (cm) => commandHandlers.extractParentCoil?.(cm),
      'Ctrl-Alt-C': (cm) => commandHandlers.extractInlineCoil?.(cm),
      'Cmd-Alt-C': (cm) => commandHandlers.extractInlineCoil?.(cm),
      'Ctrl-Alt-W': (cm) => commandHandlers.extractWeave?.(cm),
      'Cmd-Alt-W': (cm) => commandHandlers.extractWeave?.(cm),
      'Ctrl-Alt-I': (cm) => commandHandlers.inlineParentCoil?.(cm),
      'Cmd-Alt-I': (cm) => commandHandlers.inlineParentCoil?.(cm),
      'Ctrl-Alt-A': (cm) => commandHandlers.refactorConvertMelody?.(cm, 'auto'),
      'Cmd-Alt-A': (cm) => commandHandlers.refactorConvertMelody?.(cm, 'auto'),
      'Ctrl-Space': 'autocomplete',
      'Ctrl-/': 'toggleComment',
      'Cmd-/': 'toggleComment',
      'Ctrl-Q': (cm) => cm.foldCode(cm.getCursor()),
      'Cmd-Q': (cm) => cm.foldCode(cm.getCursor()),
      'Ctrl-Up': (cm) => handleContextualUp(cm),
      'Cmd-Up': (cm) => handleContextualUp(cm),
      'Ctrl-Down': (cm) => handleContextualDown(cm),
      'Cmd-Down': (cm) => handleContextualDown(cm),
      'Ctrl-Alt-Up': (cm) => handleContextualAltUp(cm),
      'Cmd-Alt-Up': (cm) => handleContextualAltUp(cm),
      'Ctrl-Alt-Down': (cm) => handleContextualAltDown(cm),
      'Cmd-Alt-Down': (cm) => handleContextualAltDown(cm),
      'Ctrl-Left': (cm) => handleSolfegeNavigation(cm, 'left'),
      'Cmd-Left': (cm) => handleSolfegeNavigation(cm, 'left'),
      'Ctrl-Right': (cm) => handleSolfegeNavigation(cm, 'right'),
      'Cmd-Right': (cm) => handleSolfegeNavigation(cm, 'right'),
      'Tab': (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.replaceSelection('  ', 'end');
        }
      },
      'Shift-Tab': (cm) => cm.indentSelection('subtract'),
    },
  });

  if (state.preferences.solfegeColors) {
    editorInstance.addOverlay(solfegeOverlay);
  }

  setupGoToDefinition(editorInstance);

  editorInstance.on('change', (cm, change) => {
    if (change.origin === 'setValue') return;
    setDirty(true);
    scanDeclaredCoilsAndWeaves(cm);
    updateInlineSolfegeWidget(cm);
    updatePairedTokenHighlights(cm);
    updateScoreHighlights(cm);
    events.emit('editor:change', cm);

    if (state.preferences.autocompile) {
      clearTimeout(compileDebounceTimer);
      compileDebounceTimer = setTimeout(() => {
        commandHandlers.triggerCompile?.();
      }, 700);
    }
  });

  editorInstance.on('cursorActivity', (cm) => {
    clearTimeout(cursorDebounceTimer);
    cursorDebounceTimer = setTimeout(() => {
      updateInlineSolfegeWidget(cm);
      updatePairedTokenHighlights(cm);
      updateScoreHighlights(cm);
      events.emit('editor:cursorActivity', cm);
    }, 40);
  });

  events.on('preference:changed', ({ key, value }) => {
    if (key === 'solfegeColors') {
      if (value) {
        editorInstance.addOverlay(solfegeOverlay);
      } else {
        editorInstance.removeOverlay(solfegeOverlay);
      }
    } else if (key === 'solfegeContext') {
      if (value) {
        updateInlineSolfegeWidget(editorInstance);
      } else {
        clearInlineWidget();
      }
    }
  });

  events.on('editor:changed', (cm) => {
    scanDeclaredCoilsAndWeaves(cm);
    updateInlineSolfegeWidget(cm);
    updatePairedTokenHighlights(cm);
    updateScoreHighlights(cm);
    events.emit('editor:cursorActivity', cm);
  });

  return editorInstance;
}

export function getEditor() {
  return editorInstance;
}

export function setEditorValue(content) {
  if (editorInstance) {
    scanDeclaredCoilsAndWeaves(content || '');
    editorInstance.setValue(content || '');
    editorInstance.clearHistory();
    setDirty(false);
    scanDeclaredCoilsAndWeaves(editorInstance);
    editorInstance.refresh();
  }
}

export function foldAllSections(cm) {
  const totalLines = cm.lineCount();
  for (let l = 0; l < totalLines; l++) {
    cm.foldCode({ line: l, ch: 0 }, null, 'fold');
  }
}

export function unfoldAllSections(cm) {
  const totalLines = cm.lineCount();
  for (let l = 0; l < totalLines; l++) {
    cm.foldCode({ line: l, ch: 0 }, null, 'unfold');
  }
}
