/**
 * Non-Destructive Tonic & Mode Pitch Transposition Modal
 */

import { events } from '../state.js';
import { showRefactorDialog } from './modal-manager.js';
import { pitchNameToMidi, calculateTonicShift, transposeSolfegeToken, transposeHarmonyToken } from '../core/pitch.js';
import { getEnclosingCoilAtPos } from '../core/ast-scanner.js';

export async function showTonicModeTranspositionModal(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const yamlText = cm.getValue();
  const currentTonicMatch = yamlText.match(/\btonic\s*:\s*["']?([A-Ga-g](?:#|b|♭)?\d+)["']?/);
  const currentTonic = currentTonicMatch ? currentTonicMatch[1] : 'C4';

  const modeOptions = [
    { id: 'aeolian', label: 'Aeolian (Natural Minor / La / -3 st)' },
    { id: 'ionian', label: 'Ionian (Major / Do / 0 st)' },
    { id: 'dorian', label: 'Dorian (Re / +2 st)' },
    { id: 'phrygian', label: 'Phrygian (Me / +3 st)' },
    { id: 'lydian', label: 'Lydian (Fa / +5 st)' },
    { id: 'mixolydian', label: 'Mixolydian (So / +7 st)' },
    { id: 'locrian', label: 'Locrian (Ti / -1 st)' },
    { id: 'custom_pitch', label: 'Custom Tonic Pitch (e.g. Eb4, A3, G4)...' },
  ];

  const result = await showRefactorDialog({
    title: 'Transpose Tonic & Mode (Preserve Pitch)',
    desc: 'Shift the root "Do" anchor across modes non-destructively while preserving exact sounding concert pitches:',
    fields: [
      {
        type: 'select',
        name: 'targetMode',
        label: 'Target Mode / Shift Preset:',
        value: 'aeolian',
        options: modeOptions,
        onChange: (e, fieldsEl) => {
          const val = e.target.value;
          const tonicInput = fieldsEl.querySelector('input[name="newTonic"]');
          if (!tonicInput) return;
          try {
            const currentMidi = pitchNameToMidi(currentTonic);
            let semitoneDelta = 0;
            if (val === 'aeolian') semitoneDelta = -3;
            else if (val === 'ionian') semitoneDelta = 0;
            else if (val === 'dorian') semitoneDelta = 2;
            else if (val === 'phrygian') semitoneDelta = 3;
            else if (val === 'lydian') semitoneDelta = 5;
            else if (val === 'mixolydian') semitoneDelta = 7;
            else if (val === 'locrian') semitoneDelta = -1;

            if (val !== 'custom_pitch') {
              const newMidi = currentMidi + semitoneDelta;
              const noteIndex = ((newMidi % 12) + 12) % 12;
              const octave = Math.floor(newMidi / 12) - 1;
              const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
              tonicInput.value = `${NAMES[noteIndex]}${octave}`;
            }
          } catch {
            // Ignored
          }
        },
      },
      {
        type: 'text',
        name: 'newTonic',
        label: 'New Tonic Root Pitch:',
        value: 'A3',
        placeholder: 'e.g. A3, Eb4, G4, D4',
      },
      {
        type: 'radios',
        name: 'scope',
        label: 'Scope:',
        options: [
          { id: 'entire', label: 'Entire Tapestry (All Knots, Melodies & Harmonies)', checked: true },
          { id: 'active_coil', label: 'Active Coil Only' },
        ],
      },
      {
        type: 'checkboxes',
        name: 'preservePitch',
        label: 'Concert Pitch:',
        options: [
          { id: 'preserve', label: 'Preserve sounding pitch (transpose Solfège and Tonic inversely)', checked: true },
        ],
      },
    ],
    confirmText: 'Transpose Tonic',
  });

  if (!result.confirmed) return;

  const targetTonic = (result.values.newTonic || currentTonic).trim();
  const preservePitch = (result.values.preservePitch || []).includes('preserve');
  const scope = result.values.scope || 'entire';

  let shiftSemitones = 0;
  try {
    const shift = calculateTonicShift(currentTonic, targetTonic);
    shiftSemitones = shift.semitones;
  } catch (err) {
    alert(`Invalid tonic pitch: ${targetTonic}`);
    return;
  }

  if (!preservePitch) {
    shiftSemitones = 0;
  }

  const lines = cm.getValue().split('\n');
  const coil = scope === 'active_coil' ? getEnclosingCoilAtPos(cm, cm.getCursor()) : null;
  const startL = coil ? coil.startLine : 0;
  const endL = coil ? coil.endLine : lines.length - 1;

  for (let l = startL; l <= endL; l++) {
    let line = lines[l];
    const melMatch = line.match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*)(\]\s*)$/i);
    if (melMatch) {
      const tokens = melMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      const transposed = tokens.map(tok => transposeSolfegeToken(tok, shiftSemitones));
      lines[l] = `${melMatch[1]}${transposed.join(', ')}${melMatch[3]}`;
      continue;
    }

    const harmMatch = line.match(/^(\s*(?:harmony|chords)\s*:\s*\[)(.*)(\]\s*)$/i);
    if (harmMatch) {
      const tokens = harmMatch[2].split(',').map(s => s.trim()).filter(Boolean);
      const transposed = tokens.map(tok => transposeHarmonyToken(tok, shiftSemitones));
      lines[l] = `${harmMatch[1]}${transposed.join(', ')}${harmMatch[3]}`;
      continue;
    }

    if (scope === 'entire') {
      const tonicMatch = line.match(/^(\s*tonic\s*:\s*["']?)([^"'\s]+)(["']?.*)$/i);
      if (tonicMatch) {
        lines[l] = `${tonicMatch[1]}${targetTonic}${tonicMatch[3]}`;
      }
    }
  }

  cm.setValue(lines.join('\n'));
  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Transposed tonic from ${currentTonic} to ${targetTonic} (${shiftSemitones >= 0 ? '+' : ''}${shiftSemitones} st)`);
}
