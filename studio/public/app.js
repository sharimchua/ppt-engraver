/**
 * PPT Engraver Studio Frontend Application
 */

// State
let currentScoreFile = '';
let isDirty = false;
let compileDebounceTimer = null;
let currentZoom = 1.0;
let lastCompiledData = null;

// Solfège keywords for autocompletion
const SOLFEGE_KEYWORDS = [
  'Do', 'Ra', 'Di', 'Re', 'Me', 'Ri', 'Mi', 'Fa', 'Fi', 'Se', 'So', 'Le', 'Si', 'La', 'Te', 'Li', 'Ti',
  'Dox', 'Rax', 'Dix', 'Rex', 'Mex', 'Rix', 'Mix', 'Fax', 'Fix', 'Sex', 'Sox', 'Lex', 'Six', 'Lax', 'Tex', 'Lix', 'Tix',
  'DoMe', 'DoSo', 'DoMeTe', 'DoLa', 'DoRe', 'DoMi', 'DoSi', 'DoFi',
  'DoxDo', 'DoxFi', 'DoxMe', 'DoxDoxDo',
  'tapestry', 'knot', 'tonic', 'engraving', 'show', 'melody', 'harmony', 'rhythm', 'coils', 'weaves', 'children',
  'melodyCoilInterval', 'melodyCoilAbsolute', 'rhythmCoil', 'harmonyCoil', 'traditionalHarmony', 'rhythmGrid', 'chordNames',
  'colorNotes', 'omitStem', 'harmonyClef', 'melodyClef', 'zoom', 'title', 'composer', 'arranger'
];

// Initialize CodeMirror Editor
const editorContainer = document.getElementById('editor-container');
const editor = CodeMirror(editorContainer, {
  mode: 'yaml',
  theme: 'dracula',
  lineNumbers: true,
  tabSize: 2,
  indentUnit: 2,
  lineWrapping: true,
  extraKeys: {
    'Ctrl-S': () => saveScore(),
    'Cmd-S': () => saveScore(),
    'Ctrl-Enter': () => triggerCompile(),
    'Cmd-Enter': () => triggerCompile(),
    'Ctrl-Space': 'autocomplete',
  },
});

// Custom Solfège Autocomplete Hinting
CodeMirror.registerHelper('hint', 'yaml', (cm) => {
  const cur = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const start = token.start;
  const end = cur.ch;
  const word = token.string.slice(0, end - start).trim();

  const list = SOLFEGE_KEYWORDS.filter(k => k.toLowerCase().startsWith(word.toLowerCase()));
  return {
    list: list.length > 0 ? list : SOLFEGE_KEYWORDS,
    from: CodeMirror.Pos(cur.line, start),
    to: CodeMirror.Pos(cur.line, end),
  };
});

// Editor change event
editor.on('change', () => {
  setDirty(true);
  clearTimeout(compileDebounceTimer);
  compileDebounceTimer = setTimeout(() => {
    triggerCompile();
  }, 500);
});

// DOM Elements
const scoreSelect = document.getElementById('score-select');
const btnNewScore = document.getElementById('btn-new-score');
const btnCompile = document.getElementById('btn-compile');
const btnSave = document.getElementById('btn-save');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnSettings = document.getElementById('btn-settings');
const statusBadge = document.getElementById('status-badge');
const saveStatus = document.getElementById('save-status');
const metricsText = document.getElementById('metrics-text');
const errorBanner = document.getElementById('error-banner');
const errorContent = document.getElementById('error-content');
const scoreCanvas = document.getElementById('score-canvas');
const scoreSvgContainer = document.getElementById('score-svg-container');
const scorePlaceholder = document.getElementById('score-placeholder');
const lilypondCode = document.getElementById('lilypond-code');
const btnCopyLy = document.getElementById('btn-copy-ly');
const onsetsTbody = document.getElementById('onsets-tbody');
const zoomLevel = document.getElementById('zoom-level');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const btnZoomFit = document.getElementById('btn-zoom-fit');

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingLilypondPath = document.getElementById('setting-lilypond-path');
const settingStatusHint = document.getElementById('setting-status-hint');

// --- API Helpers ---
async function fetchScores() {
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    scoreSelect.innerHTML = '';
    
    if (data.scores && data.scores.length > 0) {
      data.scores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.path;
        opt.textContent = s.name;
        scoreSelect.appendChild(opt);
      });
      // Load first score by default
      loadScore(data.scores[0].path);
    } else {
      scoreSelect.innerHTML = '<option value="">No scores found</option>';
    }
  } catch (err) {
    console.error('Failed to load scores list:', err);
  }
}

async function loadScore(filePath) {
  try {
    setStatus('loading', 'Loading...');
    const res = await fetch(`/api/score?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content) {
      currentScoreFile = filePath;
      scoreSelect.value = filePath;
      editor.setValue(data.content);
      setDirty(false);
      triggerCompile();
    }
  } catch (err) {
    console.error('Failed to load score:', err);
  }
}

async function saveScore() {
  const content = editor.getValue();
  let fileName = currentScoreFile || 'score.ppt.yaml';
  
  try {
    setStatus('compiling', 'Saving...');
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName, content }),
    });
    const data = await res.json();
    if (data.success) {
      currentScoreFile = data.file;
      setDirty(false);
      setStatus('ready', 'Saved');
      fetchScores();
    }
  } catch (err) {
    console.error('Failed to save score:', err);
    setStatus('error', 'Save Failed');
  }
}

async function triggerCompile() {
  const yaml = editor.getValue();
  if (!yaml.trim()) return;

  setStatus('compiling', 'Compiling...');
  hideError();

  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml }),
    });
    const data = await res.json();
    lastCompiledData = data;

    if (data.success) {
      setStatus('ready', `⚡ ${data.metrics?.totalTimeMs || 0}ms`);
      metricsText.textContent = `Compile: ${data.metrics?.compileTimeMs || 0}ms | LilyPond: ${data.metrics?.lilyTimeMs || 0}ms`;
      renderPreview(data);
      renderLilyPond(data.lilypondSource);
      renderOnsets(data.onsets);
    } else {
      setStatus('error', 'Compile Error');
      showError(data.error + (data.stderr ? `\n\n${data.stderr}` : ''));
      if (data.lilypondSource) {
        renderLilyPond(data.lilypondSource);
      }
    }
  } catch (err) {
    setStatus('error', 'Network Error');
    showError(String(err));
  }
}

async function exportPdf() {
  const yaml = editor.getValue();
  const file = currentScoreFile || 'score.ppt.yaml';

  try {
    setStatus('compiling', 'Exporting PDF...');
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml, file }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus('ready', `Exported ${data.pdfFile}`);
      alert(`Successfully exported PDF to scores/${data.pdfFile}!`);
    } else {
      setStatus('error', 'Export Failed');
      alert(`Export failed: ${data.error}`);
    }
  } catch (err) {
    setStatus('error', 'Export Error');
  }
}

let lastPdfBase64 = null;
let pdfZoomMode = 'FitH';

// --- Rendering Functions ---
function updatePdfFrame() {
  const frame = document.getElementById('pdf-preview-frame');
  if (!frame || !lastPdfBase64) return;
  const zoomParam = pdfZoomMode === 'FitH'
    ? '#view=FitH&toolbar=0&navpanes=0'
    : `#zoom=${Math.round(currentZoom * 100)}&toolbar=0&navpanes=0`;
  frame.src = `data:application/pdf;base64,${lastPdfBase64}${zoomParam}`;
  zoomLevel.textContent = pdfZoomMode === 'FitH' ? 'Fit' : `${Math.round(currentZoom * 100)}%`;
}

function renderPreview(data) {
  if (data.format === 'pdf' && data.pdfBase64) {
    lastPdfBase64 = data.pdfBase64;
    scorePlaceholder.style.display = 'none';
    const zoomParam = pdfZoomMode === 'FitH'
      ? '#view=FitH&toolbar=0&navpanes=0'
      : `#zoom=${Math.round(currentZoom * 100)}&toolbar=0&navpanes=0`;
    scoreSvgContainer.innerHTML = `
      <iframe
        id="pdf-preview-frame"
        src="data:application/pdf;base64,${data.pdfBase64}${zoomParam}"
        style="width: 100%; height: 100%; border: none; display: block;"
        title="Score Preview"
      ></iframe>
    `;
    zoomLevel.textContent = pdfZoomMode === 'FitH' ? 'Fit' : `${Math.round(currentZoom * 100)}%`;
    return;
  }

  if (data.svg) {
    scorePlaceholder.style.display = 'none';
    scoreSvgContainer.innerHTML = data.svg;
    applyZoom();
    return;
  }

  scorePlaceholder.style.display = 'block';
  scoreSvgContainer.innerHTML = '';
}

function renderSvg(svgString) {
  renderPreview({ svg: svgString });
}

function renderLilyPond(lySource) {
  lilypondCode.textContent = lySource || '';
}

function renderOnsets(onsets) {
  onsetsTbody.innerHTML = '';
  if (!onsets || onsets.length === 0) {
    onsetsTbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No onsets resolved</td></tr>';
    return;
  }

  onsets.forEach((onset, index) => {
    const tr = document.createElement('tr');
    const triadStr = Array.isArray(onset.chordMidi) ? onset.chordMidi.join(', ') : '';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${onset.tag || '-'}</td>
      <td><strong>${onset.isRest ? '(rest)' : onset.scaleDegree}</strong></td>
      <td>${onset.melodyMidi || '-'}</td>
      <td>${onset.chordRoot || '-'}</td>
      <td>${triadStr}</td>
      <td>${onset.rhythmToken || '-'}</td>
      <td>${onset.duration || '-'}</td>
    `;
    onsetsTbody.appendChild(tr);
  });
}

// --- UI State Helpers ---
function setStatus(type, text) {
  statusBadge.className = `badge ${type}`;
  statusBadge.textContent = text;
}

function setDirty(dirty) {
  isDirty = dirty;
  saveStatus.className = `save-status ${dirty ? 'unsaved' : ''}`;
  saveStatus.textContent = dirty ? 'Unsaved' : 'Saved';
}

function showError(msg) {
  errorContent.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
  errorContent.textContent = '';
}

function applyZoom() {
  scoreSvgContainer.style.transform = `scale(${currentZoom})`;
  zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
}

// --- Event Listeners ---
scoreSelect.addEventListener('change', (e) => {
  if (e.target.value) {
    loadScore(e.target.value);
  }
});

btnNewScore.addEventListener('click', () => {
  const name = prompt('Enter score name (e.g. "my_song"):');
  if (name) {
    currentScoreFile = `${name.replace(/\.ppt\.yaml$/, '')}.ppt.yaml`;
    const template = `tapestry:
  knot:
    tonic: "C4"
    engraving:
      title: "${name}"
      show:
        - melody
        - rhythmCoil
        - harmonyCoil
        - rhythmGrid
  weaves:
    song:
      children:
        - coil:
            id: motif
            melody: [Do, Re, Mi, Fa, So]
            harmony: [Do]
            rhythm: [Do, Fi, Do, Fi, Do]
`;
    editor.setValue(template);
    saveScore();
  }
});

btnCompile.addEventListener('click', () => triggerCompile());
btnSave.addEventListener('click', () => saveScore());
btnExportPdf.addEventListener('click', () => exportPdf());

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(tabId)?.classList.add('active');
  });
});

// Zoom Controls
btnZoomIn.addEventListener('click', () => {
  if (lastPdfBase64) {
    pdfZoomMode = 'percent';
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    updatePdfFrame();
  } else {
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    applyZoom();
  }
});

btnZoomOut.addEventListener('click', () => {
  if (lastPdfBase64) {
    pdfZoomMode = 'percent';
    currentZoom = Math.max(currentZoom - 0.15, 0.4);
    updatePdfFrame();
  } else {
    currentZoom = Math.max(currentZoom - 0.15, 0.3);
    applyZoom();
  }
});

btnZoomReset.addEventListener('click', () => {
  currentZoom = 1.0;
  if (lastPdfBase64) {
    pdfZoomMode = 'percent';
    updatePdfFrame();
  } else {
    applyZoom();
  }
});

btnZoomFit.addEventListener('click', () => {
  if (lastPdfBase64) {
    pdfZoomMode = 'FitH';
    updatePdfFrame();
  } else {
    const containerWidth = scoreCanvas.clientWidth - 48;
    const svgElem = scoreSvgContainer.querySelector('svg');
    if (svgElem) {
      const svgWidth = svgElem.clientWidth || svgElem.getBoundingClientRect().width || 800;
      currentZoom = Math.min(Math.max(containerWidth / svgWidth, 0.4), 2.0);
      applyZoom();
    }
  }
});

btnCopyLy.addEventListener('click', () => {
  navigator.clipboard.writeText(lilypondCode.textContent);
  btnCopyLy.textContent = 'Copied!';
  setTimeout(() => { btnCopyLy.textContent = 'Copy Code'; }, 1500);
});

// Settings Modal
btnSettings.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    settingLilypondPath.value = data.lilypondPath || '';
    settingStatusHint.textContent = data.exists ? '✓ LilyPond binary verified' : '⚠️ Binary not found at path';
    settingStatusHint.style.color = data.exists ? 'var(--success)' : 'var(--danger)';
    settingsModal.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  const newPath = settingLilypondPath.value.trim();
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lilypondPath: newPath }),
    });
    const data = await res.json();
    alert(data.exists ? 'Settings saved! LilyPond found.' : 'Settings saved, but binary was not found at specified path.');
    settingsModal.classList.add('hidden');
  } catch (err) {
    alert('Failed to save settings');
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveScore();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    triggerCompile();
  }
});

// Initialize on Load
fetchScores();
