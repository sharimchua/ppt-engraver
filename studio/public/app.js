/**
 * PPT Engraver Studio Frontend Application
 */

// State
let currentScoreFile = '';
let isDirty = false;
let compileDebounceTimer = null;
let currentZoom = 1.0;
let lastCompiledData = null;

// User Preferences
let enableAutocomplete = localStorage.getItem('ppt_enable_autocomplete') !== 'false';
let enableSolfegeColors = localStorage.getItem('ppt_enable_solfege_colors') !== 'false';
let enableCoilSuggestions = localStorage.getItem('ppt_enable_coil_suggestions') !== 'false';
let enableSolfegeContext = localStorage.getItem('ppt_enable_solfege_context') !== 'false';

// --- Domain Keyword Sets ---
const ENUMS_SHOW = [
  'melody', 'harmony', 'harmonyCoil', 'rhythmCoil', 'rhythmGrid', 'chordNames',
  'melodyCoilInterval', 'melodyCoilAbsolute', 'traditionalHarmony'
];

const ENUMS_CLEF = [
  'treble', 'treble_8', 'treble^8', 'bass', 'bass_8', 'bass_15'
];

const ENUMS_NOTEHEAD_STYLE = [
  'ppt', 'sacredHarp', 'aiken', 'funk', 'walker', 'diamond', 'default'
];

const TOKENS_MELODY = [
  'Do', 'Ra', 'Di', 'Re', 'Me', 'Ri', 'Mi', 'Fa', 'Fi', 'Se', 'So', 'Le', 'Si', 'La', 'Te', 'Li', 'Ti',
  'Dox', 'Do^', 'Re^', 'Me^', 'Fa^', 'So^', 'La^', 'Te^', 'Do_', 'Re_', 'Me_', 'Fa_', 'So_', 'La_', 'Te_'
];

const TOKENS_RHYTHM = [
  'Do', 'Fi', 'Me', 'La', 'Mi', 'Le', 'Te', 'Dox', 'DoxDo', 'DoxFi', 'DoxMe', 'DoxLa', 'DoxDoxDo'
];

const TOKENS_HARMONY = [
  'Do', 'DoMe', 'DoSo', 'DoMeTe', 'DoLa', 'DoRe', 'DoSi', 'DoFi',
  '1', '2', '4', '8', '16', '32'
];

const TOP_LEVEL_KEYS = [
  'tapestry:', 'knot:', 'tonic:', 'engraving:', 'title:', 'composer:', 'arranger:', 'tempo:',
  'show:', 'harmonyClef:', 'melodyClef:', 'colorNotes:', 'omitStem:', 'noteheadStyle:',
  'weaves:', 'coils:', 'children:', 'melody:', 'rhythm:', 'harmony:', 'concat:', 'parents:', 'id:'
];

/**
 * Scans the current document text for declared coil and weave IDs.
 */
function scanDeclaredIds(cm) {
  if (!enableCoilSuggestions) return [];
  const text = cm.getValue();
  const ids = new Set();
  
  const coilMapMatch = text.matchAll(/^\s*([_a-zA-Z0-9]+)\s*:/gm);
  for (const m of coilMapMatch) {
    const key = m[1];
    if (!['tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children', 'melody', 'rhythm', 'harmony', 'concat', 'parents', 'show', 'song', 'title', 'composer', 'arranger', 'tempo', 'tonic', 'colorNotes', 'omitStem'].includes(key)) {
      ids.add(key);
    }
  }

  const inlineIdMatch = text.matchAll(/\bid\s*:\s*([_a-zA-Z0-9]+)/g);
  for (const m of inlineIdMatch) {
    ids.add(m[1]);
  }

  return Array.from(ids);
}

/**
 * Determines autocomplete context based on cursor position and line content.
 */
function getContextSuggestions(cm, cursor) {
  const line = cm.getLine(cursor.line);
  const beforeCursor = line.slice(0, cursor.ch);

  // 1. Show layers: show: [ ... ] or under show:
  if (/show\s*:\s*\[?[^\]]*$/i.test(beforeCursor) || /^\s*-\s*(melody|harmony|rhythm|chord)/i.test(line)) {
    return ENUMS_SHOW;
  }
  for (let l = cursor.line - 1; l >= Math.max(0, cursor.line - 8); l--) {
    const prevLine = cm.getLine(l);
    if (/^\s*show\s*:/i.test(prevLine)) {
      return ENUMS_SHOW;
    }
    if (/^\s*[a-zA-Z0-9_]+\s*:/i.test(prevLine) && !/^\s*-\s*/.test(prevLine)) break;
  }

  // 2. Clef settings
  if (/(melodyClef|harmonyClef)\s*:\s*/i.test(beforeCursor)) {
    return ENUMS_CLEF;
  }

  // 3. Notehead style
  if (/noteheadStyle\s*:\s*/i.test(beforeCursor)) {
    return ENUMS_NOTEHEAD_STYLE;
  }

  // 4. Melody array
  if (/melody\s*:\s*\[?[^\]]*$/i.test(beforeCursor) || /^\s*melody\s*:/i.test(line)) {
    return TOKENS_MELODY;
  }

  // 5. Rhythm array
  if (/rhythm\s*:\s*\[?[^\]]*$/i.test(beforeCursor) || /^\s*rhythm\s*:/i.test(line)) {
    return TOKENS_RHYTHM;
  }

  // 6. Harmony array
  if (/harmony\s*:\s*\[?[^\]]*$/i.test(beforeCursor) || /^\s*harmony\s*:/i.test(line)) {
    return TOKENS_HARMONY;
  }

  // 7. Concat / Parents / Coil references
  if (/(concat|parents)\s*:\s*\[?[^\]]*$/i.test(beforeCursor) || /(coil|weave)\s*:\s*[_a-zA-Z0-9]*$/i.test(beforeCursor)) {
    const declaredIds = scanDeclaredIds(cm);
    if (declaredIds.length > 0) {
      return declaredIds;
    }
  }

  // General fallback
  const declared = scanDeclaredIds(cm);
  return Array.from(new Set([...TOKENS_MELODY, ...TOKENS_RHYTHM, ...TOKENS_HARMONY, ...declared, ...TOP_LEVEL_KEYS]));
}

// Solfège Color Overlay Mode for CodeMirror
const SOLFEGE_COLOR_MAP = {
  do: 'ppt-do',
  dox: 'ppt-dox',
  ra: 'ppt-ra',
  di: 'ppt-di',
  re: 'ppt-re',
  me: 'ppt-me',
  ri: 'ppt-ri',
  mi: 'ppt-mi',
  fa: 'ppt-fa',
  se: 'ppt-fa',
  fi: 'ppt-fi',
  so: 'ppt-so',
  si: 'ppt-so',
  le: 'ppt-le',
  la: 'ppt-la',
  li: 'ppt-la',
  te: 'ppt-te',
  ti: 'ppt-te'
};

const solfegeOverlay = {
  token: function(stream) {
    if (stream.eatWhile(/[\w\^_\.]/)) {
      const word = stream.current();
      const baseSyl = word.replace(/[\^_0-9\.]/g, '').toLowerCase();
      if (SOLFEGE_COLOR_MAP[baseSyl]) {
        return SOLFEGE_COLOR_MAP[baseSyl];
      }
    } else {
      stream.next();
    }
    return null;
  }
};

// Initialize CodeMirror Editor
const editorContainer = document.getElementById('editor-container');
const editor = CodeMirror(editorContainer, {
  mode: 'yaml',
  theme: 'dracula',
  lineNumbers: true,
  tabSize: 2,
  indentUnit: 2,
  lineWrapping: true,
  autoCloseBrackets: true,
  matchBrackets: true,
  styleActiveLine: true,
  extraKeys: {
    'Ctrl-S': () => saveScore(),
    'Cmd-S': () => saveScore(),
    'Ctrl-Enter': () => triggerCompile(),
    'Cmd-Enter': () => triggerCompile(),
    'Ctrl-Space': 'autocomplete',
    'Ctrl-/': 'toggleComment',
    'Cmd-/': 'toggleComment',
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

// Enable Solfège Overlay if preferred
if (enableSolfegeColors) {
  editor.addOverlay(solfegeOverlay);
}

// Context-Aware Solfège Autocomplete Hinting
CodeMirror.registerHelper('hint', 'yaml', (cm) => {
  if (!enableAutocomplete) return { list: [], from: cm.getCursor(), to: cm.getCursor() };

  const cur = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const start = token.start;
  const end = cur.ch;
  const word = token.string.slice(0, end - start).replace(/^[\[\s,]+/, '').trim();

  const candidates = getContextSuggestions(cm, cur);
  const list = word ? candidates.filter(k => k.toLowerCase().startsWith(word.toLowerCase())) : candidates;

  return {
    list: list.length > 0 ? list : candidates,
    from: CodeMirror.Pos(cur.line, start + (token.string.length - word.length)),
    to: CodeMirror.Pos(cur.line, end),
  };
});

// Pitch Semitone Map & Scale Information
const SEMITONE_MAP = {
  do: 0, dox: null, ra: 1, di: 1, re: 2, me: 3, ri: 3, mi: 4, fa: 5, fi: 6, se: 6, so: 7, si: 7, le: 8, la: 9, li: 9, te: 10, ti: 11
};

const INTERVAL_NAMES = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7'];
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function getTonicOffset(tonicStr) {
  if (!tonicStr) return 9; // default A
  const t = tonicStr.trim();
  const noteOffsets = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
  return noteOffsets[t] !== undefined ? noteOffsets[t] : 9;
}

function updateSolfegeContextStrip() {
  if (!enableSolfegeContext || !solfegeContextBar) {
    if (solfegeContextBar) solfegeContextBar.classList.add('hidden');
    return;
  }

  const cur = editor.getCursor();
  const docText = editor.getValue();
  const currentLine = editor.getLine(cur.line) || '';

  // Extract tonic from document
  const tonicMatch = docText.match(/^\s*tonic\s*:\s*([A-Ga-g][#b]?)/m);
  const tonicNote = tonicMatch ? tonicMatch[1].toUpperCase() : 'A';
  const tonicOffset = getTonicOffset(tonicNote);

  // Detect current coil/weave ID by looking backward
  let coilId = 'Root';
  for (let l = cur.line; l >= 0; l--) {
    const lineText = editor.getLine(l);
    const m = lineText.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
    if (m && !['tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children', 'melody', 'rhythm', 'harmony', 'concat', 'parents', 'show', 'song', 'title', 'composer', 'arranger', 'tempo', 'tonic', 'colorNotes', 'omitStem'].includes(m[1])) {
      coilId = m[1];
      break;
    }
  }

  // Find melody array: either on current line, or search within coil block
  let melodyLine = '';
  let isCurrentLineMelody = false;
  if (/melody\s*:\s*\[/.test(currentLine)) {
    melodyLine = currentLine;
    isCurrentLineMelody = true;
  } else {
    // Search nearby lines in same block
    for (let l = cur.line - 1; l >= Math.max(0, cur.line - 12); l--) {
      const lineText = editor.getLine(l);
      if (/melody\s*:\s*\[/.test(lineText)) {
        melodyLine = lineText;
        break;
      }
      if (/^\s*[a-zA-Z0-9_]+\s*:/i.test(lineText) && !/^\s*-\s*/.test(lineText)) break;
    }
  }

  if (!melodyLine) {
    solfegeContextBar.classList.add('hidden');
    return;
  }

  // Parse tokens from melody array
  const arrayMatch = melodyLine.match(/melody\s*:\s*\[(.*?)\]/);
  if (!arrayMatch) {
    solfegeContextBar.classList.add('hidden');
    return;
  }

  const rawTokens = arrayMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  if (rawTokens.length === 0) {
    solfegeContextBar.classList.add('hidden');
    return;
  }

  // Find token index under cursor if on melody line
  let activeTokenIndex = -1;
  if (isCurrentLineMelody) {
    const arrayStartCh = melodyLine.indexOf('[');
    let searchPos = arrayStartCh + 1;
    for (let i = 0; i < rawTokens.length; i++) {
      const tokStr = rawTokens[i];
      const tokIdx = melodyLine.indexOf(tokStr, searchPos);
      if (tokIdx !== -1) {
        const tokEnd = tokIdx + tokStr.length;
        if (cur.ch >= tokIdx && cur.ch <= tokEnd) {
          activeTokenIndex = i;
          break;
        }
        searchPos = tokEnd;
      }
    }
  }

  // Render tokens
  solfegeContextBar.classList.remove('hidden');
  contextCoilTitle.textContent = `🎵 Coil: ${coilId} (Melody Tokens)`;
  contextKeyBadge.textContent = `Key: ${tonicNote} (Do = ${tonicNote})`;

  contextTokensGrid.innerHTML = '';
  rawTokens.forEach((tok, idx) => {
    const col = document.createElement('div');
    col.className = 'context-token-col';
    if (idx === activeTokenIndex) col.classList.add('active-token');

    const baseSyl = tok.replace(/[\^_0-9\.]/g, '').toLowerCase();
    const isRest = baseSyl === 'dox';
    const semitones = SEMITONE_MAP[baseSyl];

    // Source token with color class
    const srcSpan = document.createElement('span');
    srcSpan.className = `col-src cm-${SOLFEGE_COLOR_MAP[baseSyl] || 'ppt-do'}`;
    srcSpan.textContent = tok;

    // Absolute Solfège degree
    const absSpan = document.createElement('span');
    absSpan.className = `col-abs cm-${SOLFEGE_COLOR_MAP[baseSyl] || 'ppt-do'}`;
    absSpan.textContent = isRest ? '(rest)' : (baseSyl.charAt(0).toUpperCase() + baseSyl.slice(1));

    // Interval name / offset
    const intSpan = document.createElement('span');
    intSpan.className = 'col-int';
    if (isRest || semitones === null || semitones === undefined) {
      intSpan.textContent = '-';
    } else {
      const intName = INTERVAL_NAMES[semitones % 12];
      intSpan.textContent = `${intName} (+${semitones})`;
    }

    // Absolute Note Name (e.g. A4, C5)
    const noteSpan = document.createElement('span');
    noteSpan.className = 'col-note';
    if (isRest || semitones === null || semitones === undefined) {
      noteSpan.textContent = '—';
    } else {
      const noteIdx = (tonicOffset + semitones) % 12;
      const noteName = CHROMATIC_SCALE[noteIdx];
      const octOffset = (tok.match(/\^/g) || []).length - (tok.match(/_/g) || []).length;
      const octave = 4 + octOffset + Math.floor((tonicOffset + semitones) / 12);
      noteSpan.textContent = `${noteName}${octave}`;
    }

    col.appendChild(srcSpan);
    col.appendChild(absSpan);
    col.appendChild(intSpan);
    col.appendChild(noteSpan);
    contextTokensGrid.appendChild(col);
  });
}

// Editor change event
editor.on('change', () => {
  setDirty(true);
  updateSolfegeContextStrip();
  clearTimeout(compileDebounceTimer);
  compileDebounceTimer = setTimeout(() => {
    triggerCompile();
  }, 500);
});

// Cursor activity event for real-time line context
editor.on('cursorActivity', () => {
  updateSolfegeContextStrip();
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
const solfegeContextBar = document.getElementById('solfege-context-bar');
const contextCoilTitle = document.getElementById('context-coil-title');
const contextKeyBadge = document.getElementById('context-key-badge');
const contextTokensGrid = document.getElementById('context-tokens-grid');
const lilypondCode = document.getElementById('lilypond-code');
const btnCopyLy = document.getElementById('btn-copy-ly');
const onsetsTbody = document.getElementById('onsets-tbody');
const zoomLevel = document.getElementById('zoom-level');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const btnToggleMagnifier = document.getElementById('btn-toggle-magnifier');
const magnifierLens = document.getElementById('magnifier-lens');
const magnifierCanvas = document.getElementById('magnifier-canvas');
const magnifierCtx = magnifierCanvas ? magnifierCanvas.getContext('2d') : null;

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingLilypondPath = document.getElementById('setting-lilypond-path');
const settingStatusHint = document.getElementById('setting-status-hint');
const settingLoupeSize = document.getElementById('setting-loupe-size');
const labelLoupeSize = document.getElementById('label-loupe-size');
const settingLoupePower = document.getElementById('setting-loupe-power');
const labelLoupePower = document.getElementById('label-loupe-power');
const settingEnableAutocomplete = document.getElementById('setting-enable-autocomplete');
const settingEnableSolfegeColors = document.getElementById('setting-enable-solfege-colors');
const settingEnableCoilSuggestions = document.getElementById('setting-enable-coil-suggestions');
const settingEnableSolfegeContext = document.getElementById('setting-enable-solfege-context');

// Split Pane Layout Elements
const mainContainer = document.querySelector('.main-container');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');
const splitGutter = document.getElementById('split-gutter');

// --- Draggable Split Pane Logic ---
const MIN_EDITOR_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 360;
let isDraggingSplitter = false;

// Restore saved width from localStorage if valid
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
      editor.refresh();
      if (pdfZoomMode === 'FitH' && currentPdfDoc) {
        renderPdfPages();
      }
    }
  });
}

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

// PDF.js worker setup
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let currentPdfDoc = null;
let lastPdfBase64 = null;
let pdfZoomMode = 'FitH'; // 'FitH' | 'percent'
let isRenderingPdf = false;

// --- Rendering Functions ---
async function renderPdfPages() {
  if (!currentPdfDoc || isRenderingPdf) return;
  isRenderingPdf = true;

  try {
    scorePlaceholder.style.display = 'none';
    scoreSvgContainer.innerHTML = '';

    const numPages = currentPdfDoc.numPages;
    const containerWidth = scoreCanvas.clientWidth - 40;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await currentPdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let scale = currentZoom;
      if (pdfZoomMode === 'FitH') {
        scale = Math.max(containerWidth / unscaledViewport.width, 0.4);
      }

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      scoreSvgContainer.appendChild(canvas);
      await page.render(renderContext).promise;
    }

    zoomLevel.textContent = pdfZoomMode === 'FitH' ? 'Fit' : `${Math.round(currentZoom * 100)}%`;
  } catch (err) {
    console.error('Error rendering PDF pages:', err);
  } finally {
    isRenderingPdf = false;
  }
}

async function renderPreview(data) {
  if (data.format === 'pdf' && data.pdfBase64) {
    lastPdfBase64 = data.pdfBase64;
    try {
      const binaryString = atob(data.pdfBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      currentPdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      await renderPdfPages();
      return;
    } catch (err) {
      console.error('PDF.js parse error:', err);
    }
  }

  if (data.svg) {
    currentPdfDoc = null;
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
    if (tabId === 'score-view' && currentPdfDoc) {
      renderPdfPages();
    }
  });
});

// Zoom Controls
btnZoomIn.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    renderPdfPages();
  } else {
    currentZoom = Math.min(currentZoom + 0.15, 3.0);
    applyZoom();
  }
});

btnZoomOut.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    currentZoom = Math.max(currentZoom - 0.15, 0.3);
    renderPdfPages();
  } else {
    currentZoom = Math.max(currentZoom - 0.15, 0.3);
    applyZoom();
  }
});

btnZoomReset.addEventListener('click', () => {
  currentZoom = 1.0;
  if (currentPdfDoc) {
    pdfZoomMode = 'percent';
    renderPdfPages();
  } else {
    applyZoom();
  }
});

btnZoomFit.addEventListener('click', () => {
  if (currentPdfDoc) {
    pdfZoomMode = 'FitH';
    renderPdfPages();
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

// Auto-resize on window change if in Fit mode
window.addEventListener('resize', () => {
  if (pdfZoomMode === 'FitH' && currentPdfDoc) {
    renderPdfPages();
  }
});

btnCopyLy.addEventListener('click', () => {
  navigator.clipboard.writeText(lilypondCode.textContent);
  btnCopyLy.textContent = 'Copied!';
  setTimeout(() => { btnCopyLy.textContent = 'Copy Code'; }, 1500);
});

// --- Settings Modal & Preferences ---
let loupeSize = parseInt(localStorage.getItem('ppt_loupe_size') || '220', 10);
let loupePower = parseFloat(localStorage.getItem('ppt_loupe_power') || '2.5');

if (settingLoupeSize && labelLoupeSize) {
  settingLoupeSize.addEventListener('input', (e) => {
    labelLoupeSize.textContent = `${e.target.value} px`;
  });
}

if (settingLoupePower && labelLoupePower) {
  settingLoupePower.addEventListener('input', (e) => {
    labelLoupePower.textContent = `${e.target.value}x`;
  });
}

btnSettings.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    settingLilypondPath.value = data.lilypondPath || '';
    settingStatusHint.textContent = data.exists ? '✓ LilyPond binary verified' : '⚠️ Binary not found at path';
    settingStatusHint.style.color = data.exists ? 'var(--success)' : 'var(--danger)';

    if (settingLoupeSize && labelLoupeSize) {
      settingLoupeSize.value = loupeSize;
      labelLoupeSize.textContent = `${loupeSize} px`;
    }
    if (settingLoupePower && labelLoupePower) {
      settingLoupePower.value = loupePower;
      labelLoupePower.textContent = `${loupePower}x`;
    }

    if (settingEnableAutocomplete) {
      settingEnableAutocomplete.checked = enableAutocomplete;
    }
    if (settingEnableSolfegeColors) {
      settingEnableSolfegeColors.checked = enableSolfegeColors;
    }
    if (settingEnableCoilSuggestions) {
      settingEnableCoilSuggestions.checked = enableCoilSuggestions;
    }
    if (settingEnableSolfegeContext) {
      settingEnableSolfegeContext.checked = enableSolfegeContext;
    }

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
  if (settingLoupeSize) {
    loupeSize = parseInt(settingLoupeSize.value, 10);
    localStorage.setItem('ppt_loupe_size', String(loupeSize));
  }
  if (settingLoupePower) {
    loupePower = parseFloat(settingLoupePower.value);
    localStorage.setItem('ppt_loupe_power', String(loupePower));
  }

  if (settingEnableAutocomplete) {
    enableAutocomplete = settingEnableAutocomplete.checked;
    localStorage.setItem('ppt_enable_autocomplete', String(enableAutocomplete));
  }
  if (settingEnableSolfegeColors) {
    const prev = enableSolfegeColors;
    enableSolfegeColors = settingEnableSolfegeColors.checked;
    localStorage.setItem('ppt_enable_solfege_colors', String(enableSolfegeColors));
    if (enableSolfegeColors && !prev) {
      editor.addOverlay(solfegeOverlay);
    } else if (!enableSolfegeColors && prev) {
      editor.removeOverlay(solfegeOverlay);
    }
  }
  if (settingEnableCoilSuggestions) {
    enableCoilSuggestions = settingEnableCoilSuggestions.checked;
    localStorage.setItem('ppt_enable_coil_suggestions', String(enableCoilSuggestions));
  }
  if (settingEnableSolfegeContext) {
    enableSolfegeContext = settingEnableSolfegeContext.checked;
    localStorage.setItem('ppt_enable_solfege_context', String(enableSolfegeContext));
    updateSolfegeContextStrip();
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lilypondPath: newPath }),
    });
    const data = await res.json();
    alert(data.exists ? 'Settings saved! LilyPond verified.' : 'Settings saved, but LilyPond binary was not found at specified path.');
    settingsModal.classList.add('hidden');
  } catch (err) {
    alert('Failed to save backend settings');
    settingsModal.classList.add('hidden');
  }
});

// --- Magnifier Lens (Loupe) Logic ---
let isMagnifierToggled = false;
let isShiftHeld = false;

function updateMagnifier(e) {
  const active = isMagnifierToggled || isShiftHeld || e.shiftKey;
  if (!active) {
    if (magnifierLens) magnifierLens.classList.add('hidden');
    return;
  }

  // Find canvas element under cursor
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const targetCanvas = elements.find(el => el.classList && el.classList.contains('pdf-page-canvas'));

  if (!targetCanvas || !magnifierCanvas || !magnifierCtx) {
    if (magnifierLens) magnifierLens.classList.add('hidden');
    return;
  }

  magnifierLens.classList.remove('hidden');
  magnifierLens.style.width = `${loupeSize}px`;
  magnifierLens.style.height = `${loupeSize}px`;
  magnifierLens.style.left = `${e.clientX}px`;
  magnifierLens.style.top = `${e.clientY}px`;

  const rect = targetCanvas.getBoundingClientRect();
  const relX = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
  const relY = (e.clientY - rect.top) * (targetCanvas.height / rect.height);

  const dpr = window.devicePixelRatio || 1;
  magnifierCanvas.width = loupeSize * dpr;
  magnifierCanvas.height = loupeSize * dpr;

  const srcW = (loupeSize / loupePower) * (targetCanvas.width / rect.width);
  const srcH = (loupeSize / loupePower) * (targetCanvas.height / rect.height);
  const srcX = relX - srcW / 2;
  const srcY = relY - srcH / 2;

  magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierCtx.fillStyle = '#ffffff';
  magnifierCtx.fillRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
  magnifierCtx.drawImage(targetCanvas, srcX, srcY, srcW, srcH, 0, 0, magnifierCanvas.width, magnifierCanvas.height);
}

if (btnToggleMagnifier) {
  btnToggleMagnifier.addEventListener('click', () => {
    isMagnifierToggled = !isMagnifierToggled;
    btnToggleMagnifier.classList.toggle('active', isMagnifierToggled);
    if (!isMagnifierToggled && !isShiftHeld && magnifierLens) {
      magnifierLens.classList.add('hidden');
    }
  });
}

if (scoreCanvas) {
  scoreCanvas.addEventListener('mousemove', updateMagnifier);
  scoreCanvas.addEventListener('mouseleave', () => {
    if (magnifierLens) magnifierLens.classList.add('hidden');
  });
}

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveScore();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    triggerCompile();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = false;
    if (!isMagnifierToggled && magnifierLens) {
      magnifierLens.classList.add('hidden');
    }
  }
});

// Initialize on Load
fetchScores();
