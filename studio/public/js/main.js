/**
 * Prime Period Theory Studio - Main Application Bootstrap
 */

import { state, setDirty, events } from './state.js';
import {
  apiGetScores,
  apiGetScore,
  apiSaveScore,
  apiCompileScore,
  apiGetSnippets,
} from './api.js';
import { initEditor, setEditorValue, foldAllSections, unfoldAllSections } from './editor/editor.js';
import { setSnippetDefinitions } from './editor/autocomplete.js';
import { initPreview } from './preview/preview.js';
import { setupToolbar, updateScoresDropdown, updateKnotDropdown } from './ui/toolbar.js';
import { setupSplitPane } from './ui/split-pane.js';
import { setupZoomControls } from './ui/zoom-controls.js';
import { setupNotifications } from './ui/notifications.js';
import { setupSettingsModal } from './modals/settings-modal.js';
import { setupCommandPalette } from './modals/command-palette.js';
import { setupModalManagerListeners } from './modals/modal-manager.js';
import { createTapestry, deleteTapestry, renameTapestryFile, confirmDiscardUnsavedChanges } from './modals/tapestry-modals.js';
import { showTonicModeTranspositionModal } from './modals/tonic-modal.js';
import { showRhythmicPeriodTranspositionModal } from './modals/rhythm-modal.js';
import {
  extractParentCoil,
  extractInlineCoil,
  inlineParentCoil,
  extractWeave,
  renameSymbol,
  refactorConvertMelody,
} from './modals/refactor-dialogs.js';
import { resolveTagFromLyLine, findYamlTarget } from './core/ast-scanner.js';
import { updateScoreHighlights } from './preview/score-highlighter.js';

document.addEventListener('DOMContentLoaded', async () => {
  const notifications = setupNotifications();
  setupModalManagerListeners();

  let editor = null;
  let lastCompiledData = null;

  // --- Point and Click Navigation ---
  function handlePointAndClick(url) {
    if (!url || !url.includes('textedit:') || !editor) return;
    const match = url.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
    if (!match) return;

    const lyLineNum = parseInt(match[1], 10);
    const tagInfo = resolveTagFromLyLine(
      lyLineNum,
      lastCompiledData?.onsets,
      lastCompiledData?.sidecarMap,
      lastCompiledData?.lilypondSource
    );
    if (!tagInfo || !tagInfo.coilId) return;

    const yamlText = editor.getValue();
    const { targetLine, targetCh } = findYamlTarget(
      yamlText,
      tagInfo.coilId,
      tagInfo.targetLayer === 'melody'
        ? (tagInfo.melodyOnsetIndex || tagInfo.sourceOnsetIndex || tagInfo.onsetIndex)
        : (tagInfo.sourceOnsetIndex || tagInfo.onsetIndex),
      tagInfo.targetLayer,
      tagInfo.voiceIndex || 1,
      tagInfo.parentCoilId
    );

    if (targetLine !== -1) {
      editor.setCursor({ line: targetLine, ch: targetCh });
      editor.scrollIntoView({ line: targetLine, ch: targetCh }, 150);
      editor.focus();

      editor.addLineClass(targetLine, 'background', 'cm-point-click-flash');
      setTimeout(() => {
        editor.removeLineClass(targetLine, 'background', 'cm-point-click-flash');
      }, 1200);

      events.emit('editor:cursorActivity', editor);
      updateScoreHighlights(editor);
    }
  }

  // --- Preview Panel Coordinator ---
  const preview = initPreview({
    onTriggerCompile: () => triggerCompile(),
    onOpenTapestryPicker: () => commandPalette.openTapestryPicker(),
    onPointAndClick: handlePointAndClick,
    getEditor: () => editor,
  });

  // --- URL & Persistence Sync ---
  function getScoreFromUrlOrStorage(scoreList) {
    if (!scoreList || scoreList.length === 0) return null;
    const urlParams = new URLSearchParams(window.location.search);
    const paramScore = urlParams.get('score');
    if (paramScore) {
      const cleanParam = paramScore.toLowerCase().replace(/^scores[\\/]/, '');
      const match = scoreList.find(s =>
        s.path.toLowerCase() === paramScore.toLowerCase() ||
        s.name.toLowerCase() === cleanParam ||
        s.path.toLowerCase().endsWith(cleanParam)
      );
      if (match) return match.path;
    }

    const savedScore = localStorage.getItem('ppt_active_score');
    if (savedScore) {
      const cleanSaved = savedScore.toLowerCase().replace(/^scores[\\/]/, '');
      const match = scoreList.find(s =>
        s.path.toLowerCase() === savedScore.toLowerCase() ||
        s.name.toLowerCase() === cleanSaved ||
        s.path.toLowerCase().endsWith(cleanSaved)
      );
      if (match) return match.path;
    }

    return scoreList[0].path;
  }

  function getKnotFromUrlOrStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramKnot = urlParams.get('knot');
    if (paramKnot) return paramKnot;
    return localStorage.getItem('ppt_active_knot') || null;
  }

  function updateUrlAndStorage(filePath, knotId = state.currentKnotId) {
    if (!filePath) return;
    localStorage.setItem('ppt_active_score', filePath);
    if (knotId) {
      localStorage.setItem('ppt_active_knot', knotId);
    } else {
      localStorage.removeItem('ppt_active_knot');
    }

    const cleanName = filePath.replace(/^scores[\\/]/, '');
    let newUrl = `${window.location.pathname}?score=${encodeURIComponent(cleanName)}`;
    if (knotId) {
      newUrl += `&knot=${encodeURIComponent(knotId)}`;
    }
    window.history.replaceState({ score: cleanName, knot: knotId }, '', newUrl);
  }

  // --- Compile Score ---
  async function triggerCompile(customKnotId = null) {
    if (!editor) return;
    const yaml = editor.getValue();
    if (!yaml.trim()) return;

    const targetKnotId = customKnotId || state.currentKnotId || getKnotFromUrlOrStorage();

    notifications.setStatus('compiling', 'Compiling...');
    notifications.hideError();

    try {
      const data = await apiCompileScore(yaml, targetKnotId);
      lastCompiledData = data;

      if (data.success) {
        notifications.setStatus('ready', 'Compiled');
        notifications.setMetrics(`Render: ${data.metrics?.renderTimeMs || 0}ms`);
        updateKnotDropdown(data.availableKnots, data.selectedKnotId);
        state.currentKnotId = data.selectedKnotId;
        updateUrlAndStorage(state.currentScoreFile, data.selectedKnotId);

        await preview.renderResult(data);
      } else {
        notifications.setStatus('error', 'Error');
        notifications.showError(data.error || 'Compilation failed');
      }
    } catch (err) {
      notifications.setStatus('error', 'Network Error');
      notifications.showError(String(err));
    }
  }

  // --- Load Score ---
  async function loadScore(filePath, force = false) {
    if (!force && state.isDirty && state.currentScoreFile && filePath !== state.currentScoreFile) {
      if (!confirmDiscardUnsavedChanges()) {
        updateScoresDropdown(state.scores, state.currentScoreFile);
        return;
      }
    }

    try {
      notifications.setStatus('loading', 'Loading...');
      preview.clearPreviewWindow('Loading & compiling tapestry sheet music...');
      const data = await apiGetScore(filePath);
      if (data.content) {
        state.currentScoreFile = filePath;
        updateScoresDropdown(state.scores, filePath);
        updateUrlAndStorage(filePath, state.currentKnotId);
        setEditorValue(data.content);
        await triggerCompile(state.currentKnotId);
      }
    } catch (err) {
      console.error('Failed to load score:', err);
      notifications.setStatus('error', 'Load Failed');
    }
  }

  // --- Save Score ---
  async function saveScore() {
    if (!editor) return;
    const content = editor.getValue();
    const fileName = state.currentScoreFile || 'score.ppt.yaml';

    try {
      notifications.setStatus('compiling', 'Saving...');
      const data = await apiSaveScore(fileName, content);
      if (data.success) {
        state.currentScoreFile = data.file;
        setDirty(false);
        notifications.setStatus('ready', 'Tapestry Saved');
        updateUrlAndStorage(data.file, state.currentKnotId);
        await fetchScoresList(data.file);
      }
    } catch (err) {
      console.error('Failed to save score:', err);
      notifications.setStatus('error', 'Save Failed');
    }
  }

  // --- Fetch Score List ---
  async function fetchScoresList(targetPath = null) {
    try {
      const data = await apiGetScores();
      state.scores = data.scores || [];
      const selected = targetPath || state.currentScoreFile || getScoreFromUrlOrStorage(state.scores);
      updateScoresDropdown(state.scores, selected);
      return selected;
    } catch (err) {
      console.error('Failed to load scores list:', err);
      return null;
    }
  }

  // --- All Commands List for Command Palette ---
  function getAllCommandsList() {
    return [
      {
        id: 'project-open-tapestry',
        title: 'Open Tapestry...',
        category: 'Project',
        icon: '📂',
        shortcut: 'Ctrl+O',
        action: () => commandPalette.openTapestryPicker(),
      },
      {
        id: 'project-create-tapestry',
        title: 'Create Tapestry...',
        category: 'Project',
        icon: '✨',
        shortcut: 'Ctrl+N',
        action: () => createTapestry({
          onSetStatus: notifications.setStatus,
          onClearPreview: preview.clearPreviewWindow,
          onRefreshScores: fetchScoresList,
          onTriggerCompile: triggerCompile,
          getEditor: () => editor,
        }),
      },
      {
        id: 'project-save-tapestry',
        title: 'Save Tapestry',
        category: 'Project',
        icon: '💾',
        shortcut: 'Ctrl+S',
        action: () => saveScore(),
      },
      {
        id: 'project-rename-tapestry',
        title: 'Rename Tapestry File...',
        category: 'Project',
        icon: '✏️',
        action: () => renameTapestryFile({
          onSetStatus: notifications.setStatus,
          onRefreshScores: fetchScoresList,
        }),
      },
      {
        id: 'project-delete-tapestry',
        title: 'Delete Tapestry...',
        category: 'Project',
        icon: '🗑️',
        action: () => deleteTapestry({
          onSetStatus: notifications.setStatus,
          onClearPreview: preview.clearPreviewWindow,
          onRefreshScores: fetchScoresList,
          getEditor: () => editor,
        }),
      },
      {
        id: 'compile-trigger',
        title: 'Compile Tapestry Score',
        category: 'Engraving',
        icon: '▶',
        shortcut: 'Ctrl+Enter',
        action: () => triggerCompile(),
      },
      {
        id: 'refactor-transpose-tonic',
        title: 'Transpose Tonic & Mode (Preserve Pitch)...',
        category: 'Music Theory & Pitch',
        icon: '🎯',
        action: (cm) => showTonicModeTranspositionModal(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-transpose-rhythm',
        title: 'Transpose Rhythmic Period & Optimize Grammar...',
        category: 'Music Theory & Rhythm',
        icon: '⏳',
        action: (cm) => showRhythmicPeriodTranspositionModal(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-convert-melody-auto',
        title: 'Toggle Melody Mode (Interval ↔ Absolute)',
        category: 'Refactor',
        icon: '🔄',
        shortcut: 'Ctrl+Alt+A',
        action: (cm) => refactorConvertMelody(cm, 'auto', {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-extract-parent-coil',
        title: 'Extract into Parent Coil...',
        category: 'Refactor',
        icon: '🧩',
        shortcut: 'Ctrl+Alt+P',
        action: (cm) => extractParentCoil(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-extract-inline-coil',
        title: 'Extract Inline Coil to Named Coil...',
        category: 'Refactor',
        icon: '📦',
        shortcut: 'Ctrl+Alt+C',
        action: (cm) => extractInlineCoil(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-inline-parent-coil',
        title: 'Inline Parent Coil Properties...',
        category: 'Refactor',
        icon: '📥',
        shortcut: 'Ctrl+Alt+I',
        action: (cm) => inlineParentCoil(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-extract-weave',
        title: 'Group Selection into Weave...',
        category: 'Refactor',
        icon: '🧶',
        shortcut: 'Ctrl+Alt+W',
        action: (cm) => extractWeave(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'refactor-rename-symbol',
        title: 'Rename Symbol Under Cursor (All References)...',
        category: 'Refactor',
        icon: '🏷️',
        shortcut: 'F2',
        action: (cm) => renameSymbol(cm, {
          onTriggerCompile: triggerCompile,
          onSetStatus: notifications.setStatus,
        }),
      },
      {
        id: 'nav-goto-symbol',
        title: 'Go to Symbol in Score...',
        category: 'Navigation',
        icon: '🔍',
        shortcut: 'Ctrl+G',
        action: () => commandPalette.openGotoReferencePalette(),
      },
      {
        id: 'view-fold-all',
        title: 'Fold All Sections & Blocks',
        category: 'View',
        icon: '📁',
        action: (cm) => foldAllSections(cm),
      },
      {
        id: 'view-unfold-all',
        title: 'Unfold All Sections & Blocks',
        category: 'View',
        icon: '📂',
        action: (cm) => unfoldAllSections(cm),
      },
    ];
  }

  // --- Command Palette ---
  const commandPalette = setupCommandPalette({
    getEditor: () => editor,
    getAllCommandsList,
    onLoadScore: (path) => loadScore(path),
  });

  // --- Initialize CodeMirror Editor ---
  const editorContainer = document.getElementById('editor-container');
  editor = initEditor(editorContainer, {
    saveScore,
    openTapestryPicker: () => commandPalette.openTapestryPicker(),
    createTapestry: () => createTapestry({
      onSetStatus: notifications.setStatus,
      onClearPreview: preview.clearPreviewWindow,
      onRefreshScores: fetchScoresList,
      onTriggerCompile: triggerCompile,
      getEditor: () => editor,
    }),
    triggerCompile,
    openCommandPalette: () => commandPalette.openCommandPalette(),
    renameSymbol: (cm) => renameSymbol(cm, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
    openGotoReferencePalette: () => commandPalette.openGotoReferencePalette(),
    extractParentCoil: (cm) => extractParentCoil(cm, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
    extractInlineCoil: (cm) => extractInlineCoil(cm, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
    extractWeave: (cm) => extractWeave(cm, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
    inlineParentCoil: (cm) => inlineParentCoil(cm, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
    refactorConvertMelody: (cm, mode) => refactorConvertMelody(cm, mode, { onTriggerCompile: triggerCompile, onSetStatus: notifications.setStatus }),
  });

  // --- Setup UI Subsystems ---
  setupToolbar({
    onLoadScore: (path) => loadScore(path),
    onSaveScore: saveScore,
    onTriggerCompile: triggerCompile,
    onCreateTapestry: () => createTapestry({
      onSetStatus: notifications.setStatus,
      onClearPreview: preview.clearPreviewWindow,
      onRefreshScores: fetchScoresList,
      onTriggerCompile: triggerCompile,
      getEditor: () => editor,
    }),
    onDeleteTapestry: () => deleteTapestry({
      onSetStatus: notifications.setStatus,
      onClearPreview: preview.clearPreviewWindow,
      onRefreshScores: fetchScoresList,
      getEditor: () => editor,
    }),
    onKnotChanged: (knotId) => updateUrlAndStorage(state.currentScoreFile, knotId),
  });

  setupSplitPane(() => {
    editor.refresh();
  });

  setupZoomControls({
    getEditor: () => editor,
    onPointAndClick: handlePointAndClick,
    sidecarMap: lastCompiledData?.sidecarMap,
    lilypondSource: lastCompiledData?.lilypondSource,
    onsets: lastCompiledData?.onsets,
  });

  setupSettingsModal();

  // Listen to dirty state changes
  events.on('dirty:changed', (dirty) => {
    notifications.setSaveStatus(dirty);
  });

  // Window beforeunload safety guard
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  // Window popstate navigation
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramScore = urlParams.get('score');
    const paramKnot = urlParams.get('knot');

    if (paramScore && state.scores.length > 0) {
      const cleanParam = paramScore.toLowerCase().replace(/^scores[\\/]/, '');
      const match = state.scores.find(s => s.path.toLowerCase().endsWith(cleanParam));
      if (match && match.path !== state.currentScoreFile) {
        state.currentKnotId = paramKnot || null;
        loadScore(match.path, true);
      }
    }
  });

  // Load snippets into autocomplete
  try {
    const snippetsData = await apiGetSnippets();
    if (snippetsData.snippets) {
      setSnippetDefinitions(snippetsData.snippets);
    }
  } catch (err) {
    console.warn('Failed to load autocomplete snippets:', err);
  }

  // Initial score fetch and load
  const initialScorePath = await fetchScoresList();
  if (initialScorePath) {
    state.currentScoreFile = initialScorePath;
    state.currentKnotId = getKnotFromUrlOrStorage();
    await loadScore(initialScorePath, true);
  }
});
