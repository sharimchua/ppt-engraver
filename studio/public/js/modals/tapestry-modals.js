/**
 * Tapestry Project Management Operations: Create, Delete, Rename & Guard
 */

import { state, setDirty } from '../state.js';
import { apiSaveScore, apiDeleteScore, apiRenameScore } from '../api.js';
import { showRefactorDialog } from './modal-manager.js';

export function confirmDiscardUnsavedChanges() {
  if (state.isDirty) {
    return confirm('You have unsaved changes in the current tapestry score. Do you want to discard them?');
  }
  return true;
}

export async function createTapestry(options = {}) {
  const { onScoreLoaded, onTriggerCompile, onRefreshScores, onSetStatus, onClearPreview, getEditor } = options;
  if (!confirmDiscardUnsavedChanges()) return;

  const result = await showRefactorDialog({
    title: 'Create New Tapestry',
    desc: 'Create a new PPT score with geometric Solfège noteheads and starter motif structure:',
    fields: [
      { type: 'text', name: 'fileName', label: 'File Name (.ppt.yaml):', value: 'new_tapestry', placeholder: 'e.g. moonlight_motif' },
      { type: 'text', name: 'title', label: 'Tapestry Title:', value: 'New Tapestry', placeholder: 'e.g. Moonlight Motif' },
      { type: 'text', name: 'composer', label: 'Composer:', value: 'Composer', placeholder: 'e.g. Midlife Muso' },
      { type: 'text', name: 'tonic', label: 'Tonic Root Pitch:', value: 'C4', placeholder: 'e.g. C4, A4, Eb4' },
    ],
    confirmText: 'Create Tapestry',
  });

  if (!result.confirmed) return;

  const rawName = (result.values.fileName || 'new_tapestry').trim().replace(/\.ppt\.yaml$/, '');
  const fileName = `${rawName}.ppt.yaml`;
  const title = (result.values.title || rawName).trim();
  const composer = (result.values.composer || 'Composer').trim();
  const tonic = (result.values.tonic || 'C4').trim();

  const fullSnip = (state.snippets || []).find(
    (s) => s.id === 'snip-tapestry-full' || s.label === 'New Tapestry Score Scaffold' || s.displayText?.includes('New Tapestry')
  );

  let starterTemplate = '';
  if (fullSnip && fullSnip.snippet) {
    starterTemplate = fullSnip.snippet
      .replace(/tonic:\s*["']?[^"'\n]+["']?/, `tonic: "${tonic}"`)
      .replace(/title:\s*["']?[^"'\n]+["']?/, `title: "${title}"`)
      .replace(/composer:\s*["']?[^"'\n]+["']?/, `composer: "${composer}"`);
  } else {
    starterTemplate = `tapestry:
  knot:
    tonic: "${tonic}"
    weave: song
    engraving:
      title: "${title}"
      composer: "${composer}"
      colorNotes: true
      omitStem: true
      noteheadStyle: ppt
      strongBeatGridWeight: true
      show:
        - melody
        - gridSymbols
        - rhythmGrid
        - chordNames
        - pulseSignature

  weaves:
    song:
      children:
        - coil:
            harmony: [Do, Fa, LaMe, So]
`;
  }

  try {
    onSetStatus?.('compiling', 'Creating...');
    const data = await apiSaveScore(fileName, starterTemplate);
    if (data.success) {
      state.currentScoreFile = data.file;
      onClearPreview?.('Creating & compiling tapestry...');
      getEditor?.()?.setValue(starterTemplate);
      setDirty(false);
      onSetStatus?.('ready', 'Tapestry Created');
      await onRefreshScores?.(data.file);
      onTriggerCompile?.();
    }
  } catch (err) {
    console.error('Failed to create tapestry:', err);
    onSetStatus?.('error', 'Creation Failed');
  }
}

export async function deleteTapestry(options = {}) {
  const { onRefreshScores, onSetStatus, onClearPreview, getEditor } = options;
  if (!state.currentScoreFile) {
    alert('No tapestry is currently loaded to delete.');
    return;
  }

  const result = await showRefactorDialog({
    title: `Delete Tapestry '${state.currentScoreFile}'`,
    desc: `Are you sure you want to permanently delete '${state.currentScoreFile}' and all associated notation and PDF exports? This cannot be undone.`,
    fields: [],
    confirmText: 'Delete Tapestry',
  });

  if (!result.confirmed) return;

  try {
    onSetStatus?.('compiling', 'Deleting...');
    const data = await apiDeleteScore(state.currentScoreFile);
    if (data.success) {
      state.currentScoreFile = '';
      onClearPreview?.();
      getEditor?.()?.setValue('');
      setDirty(false);
      await onRefreshScores?.();
      onSetStatus?.('ready', 'Tapestry Deleted');
    }
  } catch (err) {
    console.error('Failed to delete tapestry:', err);
    onSetStatus?.('error', 'Delete Failed');
  }
}

export async function renameTapestryFile(options = {}) {
  const { onRefreshScores, onSetStatus } = options;
  if (!state.currentScoreFile) {
    alert('No tapestry is currently loaded to rename.');
    return;
  }

  const currentBase = state.currentScoreFile.replace(/\.ppt\.yaml$/, '');
  const result = await showRefactorDialog({
    title: `Rename Tapestry File`,
    desc: `Rename '${state.currentScoreFile}' and its associated compilation artifacts (.notation.ly, .pdf, .ppt-map.json, .svg, etc.):`,
    fields: [
      { type: 'text', name: 'newFileName', label: 'New File Name (.ppt.yaml):', value: currentBase, placeholder: 'e.g. moonlight_motif' }
    ],
    confirmText: 'Rename File & Artifacts',
  });

  if (!result.confirmed) return;

  const rawName = (result.values.newFileName || '').trim().replace(/\.ppt\.yaml$/, '');
  if (!rawName) {
    alert('File name cannot be empty.');
    return;
  }
  const newFileName = `${rawName}.ppt.yaml`;
  if (newFileName === state.currentScoreFile) return;

  try {
    onSetStatus?.('compiling', 'Renaming...');
    const data = await apiRenameScore(state.currentScoreFile, newFileName);
    if (data.success) {
      state.currentScoreFile = data.newFile;
      await onRefreshScores?.(data.newFile);
      onSetStatus?.('ready', `Renamed to ${data.newFile}`);
    } else {
      onSetStatus?.('error', 'Rename Failed');
      alert(`Rename failed: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error('Failed to rename tapestry file:', err);
    onSetStatus?.('error', 'Rename Failed');
  }
}
