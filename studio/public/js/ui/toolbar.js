/**
 * Top Toolbar & Score / Knot Dropdowns
 */

import { state, setPreference } from '../state.js';
import { apiExportPdf } from '../api.js';

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
    btnExportPdf.addEventListener('click', async () => {
      try {
        await apiExportPdf(state.currentScoreFile, state.currentKnotId);
      } catch (err) {
        console.error('Failed to export PDF:', err);
      }
    });
  }
}
