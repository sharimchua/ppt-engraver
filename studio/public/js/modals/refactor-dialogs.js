/**
 * Structural Refactorings: Extract Parent Coil, Extract Inline Coil,
 * Inline Parent Coil, Extract Weave, Rename Symbol, and Convert Melody Mode
 */

import { events } from '../state.js';
import { showRefactorDialog } from './modal-manager.js';
import {
  getEnclosingCoilAtPos,
  findDefinitionInYaml,
  getTargetIdAtPos,
  getLineIndent,
} from '../core/ast-scanner.js';
import {
  parseMelodyToken,
  convertIntervalToAbsoluteMelody,
  convertAbsoluteToIntervalMelody,
} from '../core/pitch.js';

export async function extractParentCoil(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil) {
    alert('Please place the cursor inside a coil (in coils: or stitch:) to extract a parent.');
    return;
  }

  const availableLayers = [];
  const lines = cm.getValue().split('\n');
  let coilMelody = '';
  let coilRhythm = '';
  let coilHarmony = '';

  for (let l = coil.startLine; l <= coil.endLine; l++) {
    const line = lines[l] || '';
    const m = line.match(/^\s*(?:melody|pitches)\s*:\s*(.+)$/i);
    if (m) coilMelody = m[1].trim();
    const r = line.match(/^\s*rhythm\s*:\s*(.+)$/i);
    if (r) coilRhythm = r[1].trim();
    const h = line.match(/^\s*(?:harmony|chords)\s*:\s*(.+)$/i);
    if (h) coilHarmony = h[1].trim();
  }

  if (coilRhythm) availableLayers.push({ id: 'rhythm', label: `Rhythm (${coilRhythm})`, checked: true });
  if (coilHarmony) availableLayers.push({ id: 'harmony', label: `Harmony (${coilHarmony})`, checked: true });
  if (coilMelody) availableLayers.push({ id: 'melody', label: `Melody (${coilMelody})`, checked: !coilRhythm && !coilHarmony });

  if (availableLayers.length === 0) {
    alert('The current coil does not have any extractable layers (melody, rhythm, harmony).');
    return;
  }

  const defaultId = `_parent_${coil.coilId || 'base'}`;

  const destinationOptions = [
    { id: 'tapestry', label: 'Top-Level tapestry.coils:', checked: true }
  ];

  const result = await showRefactorDialog({
    title: 'Extract into Parent Coil',
    desc: `Extract shared layers from '${coil.coilId || 'current coil'}' into a reusable parent coil definition and link via parents:`,
    fields: [
      { type: 'text', name: 'parentId', label: 'New Parent Coil ID:', value: defaultId, placeholder: 'e.g. _verse_base' },
      { type: 'checkboxes', name: 'layers', label: 'Layers to Extract:', options: availableLayers },
      { type: 'radios', name: 'destination', label: 'Target Destination:', options: destinationOptions },
    ],
    confirmText: 'Extract Parent Coil',
  });

  if (!result.confirmed) return;

  const parentId = (result.values.parentId || '').trim();
  const selectedLayers = result.values.layers || [];

  if (!parentId) {
    alert('Parent Coil ID cannot be empty.');
    return;
  }
  if (selectedLayers.length === 0) {
    alert('Please select at least one layer to extract.');
    return;
  }

  const parentIndent = '  ';
  const layerIndent = '    ';
  const parentLines = [`${parentIndent}${parentId}:`];

  if (selectedLayers.includes('rhythm') && coilRhythm) parentLines.push(`${layerIndent}rhythm: ${coilRhythm}`);
  if (selectedLayers.includes('harmony') && coilHarmony) parentLines.push(`${layerIndent}harmony: ${coilHarmony}`);
  if (selectedLayers.includes('melody') && coilMelody) parentLines.push(`${layerIndent}melody: ${coilMelody}`);

  const parentYaml = parentLines.join('\n');

  let insertLine = -1;
  for (let l = 0; l < lines.length; l++) {
    if (/^\s*coils\s*:/i.test(lines[l])) {
      insertLine = l + 1;
      break;
    }
  }

  if (insertLine === -1) {
    lines.push('coils:', parentYaml);
  } else {
    lines.splice(insertLine, 0, parentYaml);
  }

  cm.setValue(lines.join('\n'));

  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Extracted parent coil '${parentId}'`);
}

export async function extractInlineCoil(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil || coil.type !== 'inline-child') {
    alert('Please place cursor inside an inline stitch coil (- coil:) within a stitch block.');
    return;
  }

  const defaultId = coil.coilId || 'extracted_coil';

  const result = await showRefactorDialog({
    title: 'Extract Inline Coil to Named Coil',
    desc: 'Move this inline coil definition into the coils dictionary and replace with a named reference:',
    fields: [
      { type: 'text', name: 'coilId', label: 'New Coil ID:', value: defaultId, placeholder: 'e.g. verse_motif' }
    ],
    confirmText: 'Extract Named Coil',
  });

  if (!result.confirmed) return;

  const coilId = (result.values.coilId || '').trim();
  if (!coilId) {
    alert('Coil ID cannot be empty.');
    return;
  }

  const lines = cm.getValue().split('\n');
  const targetIndent = '  ';
  const fieldIndent = '    ';
  const defLines = [`${targetIndent}${coilId}:`];

  for (let l = coil.startLine; l <= coil.endLine; l++) {
    const line = lines[l];
    if (/^\s*-\s*coil\s*:/i.test(line) || /\bid\s*:/i.test(line)) continue;
    const stripped = line.trim();
    if (stripped) {
      defLines.push(`${fieldIndent}${stripped}`);
    }
  }

  const defYaml = defLines.join('\n');

  let inserted = false;
  for (let l = 0; l < lines.length; l++) {
    if (/^\s*coils\s*:/i.test(lines[l])) {
      lines.splice(l + 1, 0, defYaml);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    lines.push('coils:', defYaml);
  }

  cm.setValue(lines.join('\n'));

  const updatedCoil = getEnclosingCoilAtPos(cm, cur);
  if (updatedCoil) {
    const updatedLines = cm.getValue().split('\n');
    const childIndentMatch = updatedLines[updatedCoil.startLine].match(/^(\s*)/);
    const childIndent = childIndentMatch ? childIndentMatch[1] : '        ';
    updatedLines.splice(updatedCoil.startLine, (updatedCoil.endLine - updatedCoil.startLine + 1), `${childIndent}- coil: ${coilId}`);
    cm.setValue(updatedLines.join('\n'));
  }

  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Extracted named coil '${coilId}'`);
}

export async function inlineParentCoil(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  if (!coil) {
    alert('Please place cursor inside a coil to inline its parent.');
    return;
  }

  const lines = cm.getValue().split('\n');
  let parentRef = null;
  let parentsLineNo = -1;

  for (let l = coil.startLine; l <= coil.endLine; l++) {
    const line = lines[l] || '';
    const m = line.match(/^\s*(?:parents|parent)\s*:\s*(.+)$/i);
    if (m) {
      parentRef = m[1].replace(/[\[\]'"]/g, '').split(',')[0].trim();
      parentsLineNo = l;
      break;
    }
  }

  if (!parentRef) {
    alert('The current coil does not have a parent coil defined (parents:).');
    return;
  }

  const def = findDefinitionInYaml(cm.getValue(), parentRef);
  if (!def) {
    alert(`Could not locate parent coil definition '${parentRef}' in score.`);
    return;
  }

  const parentCoil = getEnclosingCoilAtPos(cm, def);
  if (!parentCoil) {
    alert(`Could not parse parent coil '${parentRef}'.`);
    return;
  }

  const layersToCopy = [];
  for (let l = parentCoil.startLine; l <= parentCoil.endLine; l++) {
    const pLine = lines[l] || '';
    const match = pLine.match(/^\s*(melody|rhythm|harmony|chords|pitches)\s*:\s*(.+)$/i);
    if (match) {
      layersToCopy.push({ layer: match[1], value: match[2].trim() });
    }
  }

  const childIndent = coil.type === 'inline-child' ? '        ' : '      ';

  lines.splice(parentsLineNo, 1);

  layersToCopy.forEach((item, idx) => {
    lines.splice(coil.startLine + 1 + idx, 0, `${childIndent}${item.layer}: ${item.value}`);
  });

  cm.setValue(lines.join('\n'));
  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Inlined parent coil '${parentRef}'`);
}

export async function extractWeave(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const selectedText = cm.getSelection();
  const defaultId = 'section_weave';

  const result = await showRefactorDialog({
    title: 'Group Selection into Weave',
    desc: 'Extract selected child items into a new named weave in the weaves dictionary:',
    fields: [
      { type: 'text', name: 'weaveId', label: 'New Weave ID:', value: defaultId, placeholder: 'e.g. chorus_part' }
    ],
    confirmText: 'Create Weave',
  });

  if (!result.confirmed) return;

  const weaveId = (result.values.weaveId || '').trim();
  if (!weaveId) {
    alert('Weave ID cannot be empty.');
    return;
  }

  const lines = cm.getValue().split('\n');
  const childrenContent = selectedText.trim()
    ? selectedText.split('\n').map(l => `      ${l.trim()}`).join('\n')
    : `      - coil: verse`;

  const newWeaveYaml = `    ${weaveId}:\n      stitch:\n${childrenContent}`;

  let insertLine = -1;
  for (let l = 0; l < lines.length; l++) {
    if (/^\s*weaves\s*:/i.test(lines[l])) {
      insertLine = l + 1;
      break;
    }
  }

  if (insertLine !== -1) {
    lines.splice(insertLine, 0, newWeaveYaml);
    cm.setValue(lines.join('\n'));

    if (selectedText.trim()) {
      cm.replaceSelection(`        - weave: ${weaveId}`);
    }
  }

  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Created weave '${weaveId}'`);
}

export async function renameSymbol(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const cur = cm.getCursor();
  const target = getTargetIdAtPos(cm, cur);
  const oldId = target ? target.id : null;

  if (!oldId) {
    alert('Please place cursor on a coil or weave ID to rename.');
    return;
  }

  const result = await showRefactorDialog({
    title: `Rename Symbol '${oldId}'`,
    desc: `Rename '${oldId}' across its definition and all references (parents:, concat:, coil:, weave:, harmony:, rhythm:, melody:, from:, use:, etc.) throughout the score:`,
    fields: [
      { type: 'text', name: 'newId', label: 'New ID Name:', value: oldId, placeholder: 'e.g. verse_theme' }
    ],
    confirmText: 'Rename All References',
  });

  if (!result.confirmed) return;

  const newId = (result.values.newId || '').trim();
  if (!newId || newId === oldId) return;

  const docText = cm.getValue();
  const lines = docText.split('\n');
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const oldIdEsc = escapeRegex(oldId);

  let replacementCount = 0;

  for (let l = 0; l < lines.length; l++) {
    let line = lines[l];
    if (/^\s*#/.test(line)) continue;

    const origLine = line;

    line = line.replace(new RegExp(`^(\\s*)${oldIdEsc}(\\s*:)`), `$1${newId}$2`);
    line = line.replace(new RegExp(`(\\bid\\s*:\\s*["']?)${oldIdEsc}(["']?)`, 'g'), `$1${newId}$2`);
    line = line.replace(new RegExp(`(\\b(?:parents|parent|concat|harmony|chords|rhythm|melody|pitches|coil|weave|from|use)\\s*:\\s*)(.+)`, 'i'), (match, prefix, val) => {
      const replacedVal = val.replace(new RegExp(`\\b${oldIdEsc}\\b`, 'g'), newId);
      return prefix + replacedVal;
    });

    if (/^\s*-\s*/.test(line)) {
      line = line.replace(new RegExp(`^(\\s*-\\s*(?:(?:coil|weave)\\s*:\\s*["']?)?)${oldIdEsc}\\b`, 'g'), `$1${newId}`);
    }

    if (line !== origLine) {
      replacementCount++;
    }
    lines[l] = line;
  }

  cm.setValue(lines.join('\n'));
  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Renamed '${oldId}' → '${newId}' across ${replacementCount} line(s)`);
}

export function refactorConvertMelody(cm, targetMode = 'auto', options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const cur = cm.getCursor();
  const curLineNo = cur.line;
  const curLineText = cm.getLine(curLineNo) || '';

  let targetLineNo = -1;
  let melodyArrayMatch = curLineText.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*?)(\])\s*$/);

  if (melodyArrayMatch) {
    targetLineNo = curLineNo;
  } else {
    const coil = getEnclosingCoilAtPos(cm, cur);
    if (coil) {
      const lines = cm.getValue().split('\n');
      for (let l = coil.startLine; l <= coil.endLine; l++) {
        const line = lines[l] || '';
        const m = line.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*?)(\])\s*$/);
        if (m) {
          targetLineNo = l;
          melodyArrayMatch = m;
          break;
        }
      }
    }
  }

  if (targetLineNo !== -1 && melodyArrayMatch) {
    const prefix = melodyArrayMatch[1];
    const innerTokensText = melodyArrayMatch[2];
    const suffix = melodyArrayMatch[3];

    const rawTokens = innerTokensText.split(',').map(s => s.trim()).filter(Boolean);
    if (rawTokens.length === 0) {
      alert('Melody array is empty.');
      return;
    }

    const firstParsed = parseMelodyToken(rawTokens[0]);
    const isCurrentlyInterval = firstParsed.hasAxis;

    let newTokens = [];
    let convertedTo = '';

    if (targetMode === 'absolute' || (targetMode === 'auto' && isCurrentlyInterval)) {
      newTokens = convertIntervalToAbsoluteMelody(rawTokens);
      convertedTo = 'Absolute';
    } else {
      newTokens = convertAbsoluteToIntervalMelody(rawTokens);
      convertedTo = 'Interval';
    }

    const newLineText = `${prefix}${newTokens.join(', ')}${suffix}`;
    cm.replaceRange(newLineText, { line: targetLineNo, ch: 0 }, { line: targetLineNo, ch: cm.getLine(targetLineNo).length });

    events.emit('editor:changed', cm);
    onTriggerCompile?.();
    onSetStatus?.('ready', `Converted melody to ${convertedTo}`);
    return;
  }

  alert('Please place your cursor on a melody line or within a coil with a melody array.');
}
