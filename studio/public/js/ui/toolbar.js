/**
 * Top Toolbar & Score / Knot Dropdowns
 */

import { state, setPreference } from '../state.js';

export function updateKnotDropdown(availableKnots, selectedKnotId) {
  const knotSelect = document.getElementById('knot-select');
  if (!knotSelect) return;
  knotSelect.innerHTML = '';

  const knots = (availableKnots && availableKnots.length > 0)
    ? availableKnots
    : [{ id: selectedKnotId || 'default', name: 'Default' }];

  knots.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k.id;
    opt.textContent = k.name || k.title || k.id;
    if (k.id === selectedKnotId) {
      opt.selected = true;
    }
    knotSelect.appendChild(opt);
  });

  const effectiveSelected = selectedKnotId || knots[0].id;
  knotSelect.value = effectiveSelected;
  state.currentKnotId = effectiveSelected;
}

export function updateScoresDropdown(scores, selectedPath) {
  const scoreSelect = document.getElementById('score-select');
  if (!scoreSelect) return;
  scoreSelect.innerHTML = '';

  if (scores && scores.length > 0) {
    scores.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.path;
      opt.textContent = s.title ? `${s.title} (${s.name})` : s.name;
      if (s.path === selectedPath) {
        opt.selected = true;
      }
      scoreSelect.appendChild(opt);
    });
  } else {
    scoreSelect.innerHTML = '<option value="">No tapestries found</option>';
  }
}

export function setupToolbar(options = {}) {
  const {
    onLoadScore,
    onSaveScore,
    onExportPdf,
    onTriggerCompile,
    onCreateTapestry,
    onDeleteTapestry,
    onKnotChanged,
  } = options;

  const scoreSelect = document.getElementById('score-select');
  const knotSelect = document.getElementById('knot-select');
  const btnCompile = document.getElementById('btn-compile');
  const chkAutocompile = document.getElementById('chk-autocompile');
  const btnSave = document.getElementById('btn-save');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnNewScore = document.getElementById('btn-new-score');
  const btnDeleteScore = document.getElementById('btn-delete-score');
  const btnMidiToggle = document.getElementById('btn-midi-toggle');
  const midiStatusText = document.getElementById('midi-status-text');

  function updateMidiButtonUi() {
    if (!btnMidiToggle || !midiStatusText) return;
    const isEnabled = Boolean(state.preferences.midiEnabled);
    const status = state.midiStatus;

    btnMidiToggle.classList.remove('midi-active', 'midi-inactive', 'midi-disconnected');

    if (!isEnabled) {
      btnMidiToggle.classList.add('midi-inactive');
      midiStatusText.textContent = 'MIDI: Off';
      btnMidiToggle.title = 'MIDI Solfège Typing is OFF (Click to Enable / Ctrl+Shift+M)';
    } else if (status === 'unsupported' || status === 'denied') {
      btnMidiToggle.classList.add('midi-disconnected');
      midiStatusText.textContent = 'No MIDI';
      btnMidiToggle.title = 'Web MIDI API unavailable or permission denied';
    } else if (state.midiDevices && state.midiDevices.length > 0) {
      btnMidiToggle.classList.add('midi-active');
      const devName = state.preferences.midiDeviceId === 'all'
        ? `${state.midiDevices.length} Device${state.midiDevices.length > 1 ? 's' : ''}`
        : (state.midiDevices.find(d => d.id === state.preferences.midiDeviceId || d.name === state.preferences.midiDeviceId)?.name || 'Device');
      midiStatusText.textContent = `MIDI: ${devName}`;
      btnMidiToggle.title = `MIDI Typing Active listening to ${devName} (Click to toggle / Ctrl+Shift+M)`;
    } else {
      btnMidiToggle.classList.add('midi-active');
      midiStatusText.textContent = 'MIDI: On';
      btnMidiToggle.title = 'MIDI Typing Active (Connect a controller / Ctrl+Shift+M)';
    }
  }

  if (btnMidiToggle) {
    updateMidiButtonUi();
    btnMidiToggle.addEventListener('click', () => {
      const nextState = !state.preferences.midiEnabled;
      setPreference('midiEnabled', nextState);
      updateMidiButtonUi();
    });
  }

  if (scoreSelect) {
    scoreSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        state.currentKnotId = null;
        onLoadScore?.(e.target.value);
      }
    });
  }

  if (knotSelect) {
    knotSelect.addEventListener('change', (e) => {
      const selectedKnot = e.target.value;
      if (selectedKnot) {
        state.currentKnotId = selectedKnot;
        onKnotChanged?.(selectedKnot);
        onTriggerCompile?.(selectedKnot);
      }
    });
  }

  if (btnCompile) {
    btnCompile.addEventListener('click', () => onTriggerCompile?.());
  }

  if (chkAutocompile) {
    chkAutocompile.checked = state.preferences.autocompile;
    chkAutocompile.addEventListener('change', (e) => {
      setPreference('autocompile', e.target.checked);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => onSaveScore?.());
  }

  if (btnNewScore) {
    btnNewScore.addEventListener('click', () => onCreateTapestry?.());
  }

  if (btnDeleteScore) {
    btnDeleteScore.addEventListener('click', () => onDeleteTapestry?.());
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => onExportPdf?.());
  }

  return {
    updateMidiButtonUi,
  };
}
