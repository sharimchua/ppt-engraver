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

const SOLFEGE_SYLLABLES_LIST = [
  'dox', 'rax', 'dix', 'rex', 'mex', 'rix', 'mix', 'fax', 'fix', 'sex', 'sox', 'lex', 'six', 'lax', 'tex', 'lix', 'tix',
  'do', 'ra', 'di', 're', 'me', 'ri', 'mi', 'fa', 'fi', 'se', 'so', 'le', 'si', 'la', 'te', 'li', 'ti'
];

const ALL_SYLLABLES_REGEX = /^(?:(?:Do[xX]?|Ra[xX]?|Di[xX]?|Re[xX]?|Me[xX]?|Ri[xX]?|Mi[xX]?|Fa[xX]?|Fi[xX]?|Se[xX]?|So[xX]?|Le[xX]?|Si[xX]?|La[xX]?|Te[xX]?|Li[xX]?|Ti[xX]?)(?:[\^_]*))+$/i;

function isValidSolfegeToken(word) {
  return ALL_SYLLABLES_REGEX.test(word);
}

const solfegeOverlay = {
  token: function(stream) {
    const line = stream.string;
    const colonIdx = line.indexOf(':');

    // If on a "key: value" line and before the colon, it's a YAML key - skip!
    if (colonIdx !== -1 && stream.pos <= colonIdx) {
      stream.next();
      return null;
    }

    // Check if we are at the start of a word
    const rest = line.slice(stream.pos);
    const wordMatch = rest.match(/^[A-Za-z0-9\^_]+/);
    if (!wordMatch) {
      stream.next();
      return null;
    }

    const fullWord = wordMatch[0];

    // Only highlight if the word is a valid Solfège expression
    if (!isValidSolfegeToken(fullWord)) {
      // Advance past this entire non-solfege word
      stream.pos += fullWord.length;
      return null;
    }

    // Incrementally match and color each sub-syllable of the valid Solfège word
    for (const syl of SOLFEGE_SYLLABLES_LIST) {
      if (stream.match(new RegExp('^' + syl, 'i'))) {
        const baseSyl = syl.replace(/x$/i, '').toLowerCase();
        return SOLFEGE_COLOR_MAP[baseSyl] || 'ppt-do';
      }
    }

    // Advance past octave indicators (^, _) or modifiers
    stream.next();
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

// --- Solfège SVG Glyph Definitions (PPT Geometric Rotations & Palettes) ---
const SVG_PATH_BASE = 'M 0.262 0.806 L 0.389 0.674 L 0.559 0.498 L 0.750 0.302 L 0.848 0.000 L 0.750 -0.302 L 0.714 -0.412 L 0.686 -0.498 L 0.405 -0.702 L 0.262 -0.806 L 0.000 -0.848 L -0.262 -0.806 L -0.405 -0.702 L -0.686 -0.498 L -0.714 -0.412 L -0.750 -0.302 L -0.848 0.000 L -0.750 0.302 L -0.559 0.498 L -0.389 0.674 L -0.262 0.806 L -0.250 0.432 L -0.330 0.381 L -0.407 0.292 L -0.440 0.254 L -0.473 0.216 L -0.483 0.142 L -0.504 0.000 L -0.483 -0.142 L -0.445 -0.226 L -0.393 -0.340 L -0.330 -0.381 L -0.250 -0.432 L -0.209 -0.458 L -0.147 -0.498 L 0.000 -0.504 L 0.147 -0.498 L 0.209 -0.458 L 0.250 -0.432 L 0.330 -0.381 L 0.393 -0.340 L 0.445 -0.226 L 0.483 -0.142 L 0.504 0.000 L 0.483 0.142 L 0.473 0.216 L 0.440 0.254 L 0.407 0.292 L 0.330 0.381 L 0.250 0.432 Z';

const SVG_PATH_SHARP = 'M 0.00 1.00 L 0.00 0.807 L 0.001 0.806 L 0.262 0.806 L 0.389 0.674 L 0.447 0.615 L 0.462 0.599 L 0.559 0.498 L 0.288 0.498 L 0.148 0.740 L 0.110 0.806 L 0.000 0.806 L 0.000 0.520 L 0.072 0.499 L 0.146 0.499 L 0.147 0.498 L 0.073 0.498 L 0.209 0.458 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.257 0.444 L -0.288 0.498 L -0.560 0.498 L -0.668 0.386 L -0.697 0.356 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.811 0.408 L 0.863 0.498 L 0.866 0.500 L 0.707 0.707 L 0.500 0.866 L 0.259 0.966 L 0.000 1.000 Z';

const SVG_PATH_FLAT = 'M 0.00 1.00 L -0.259 0.966 L -0.500 0.866 L -0.707 0.707 L -0.866 0.500 L -0.863 0.498 L -0.811 0.408 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.697 0.356 L 0.668 0.386 L 0.559 0.498 L 0.288 0.498 L 0.257 0.444 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.073 0.498 L -0.147 0.498 L -0.146 0.499 L -0.072 0.499 L 0.000 0.520 L 0.000 0.806 L -0.110 0.806 L -0.148 0.740 L -0.288 0.498 L -0.560 0.498 L -0.463 0.599 L -0.447 0.615 L -0.389 0.675 L -0.262 0.806 L -0.001 0.806 L 0.000 0.807 L 0.000 1.000 Z';

const SOLFEGE_GLYPH_SPECS = {
  Do: { glyphType: 'base', rotation: 0, colorHex: '#E13610' },
  Ra: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Di: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Re: { glyphType: 'flat', rotation: 270, colorHex: '#F98016' },
  Me: { glyphType: 'base', rotation: 270, colorHex: '#F5D432' },
  Ri: { glyphType: 'base', rotation: 270, colorHex: '#F5D432' },
  Mi: { glyphType: 'sharp', rotation: 270, colorHex: '#F5D432' },
  Fa: { glyphType: 'flat', rotation: 180, colorHex: '#43A440' },
  Fi: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  Se: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  So: { glyphType: 'sharp', rotation: 180, colorHex: '#0032A4' },
  Le: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4' },
  Si: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4' },
  La: { glyphType: 'base', rotation: 90, colorHex: '#5300A4' },
  Te: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4' },
  Li: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4' },
  Ti: { glyphType: 'flat', rotation: 0, colorHex: '#F158A4' },
};

function createSolfegeGlyphSvg(syllable, hasAxis = false, size = 18) {
  const cleanSyl = syllable.replace(/[\^_0-9\.xX]/g, '');
  const spec = SOLFEGE_GLYPH_SPECS[cleanSyl] || SOLFEGE_GLYPH_SPECS['Do'];

  const color = spec ? spec.colorHex : '#E13610';
  const rot = spec ? spec.rotation : 0;
  const glyphType = spec ? spec.glyphType : 'base';

  let pathD = SVG_PATH_BASE;
  if (glyphType === 'sharp') pathD = SVG_PATH_SHARP;
  else if (glyphType === 'flat') pathD = SVG_PATH_FLAT;

  const axisSvg = hasAxis
    ? `<line x1="-1.1" y1="0" x2="1.1" y2="0" stroke="${color}" stroke-width="0.22" stroke-linecap="round" />`
    : '';

  return `
    <svg viewBox="-1.25 -1.25 2.5 2.5" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle; overflow:visible;">
      <g transform="scale(1, -1) rotate(${rot})">
        <path d="${pathD}" fill="${color}" stroke="#1e2127" stroke-width="0.08" stroke-linejoin="round" />
        ${axisSvg}
      </g>
    </svg>
  `;
}

function splitSyllables(word) {
  if (!isValidSolfegeToken(word)) {
    return [];
  }
  const SYL_REGEX = /(Dox|Rax|Dix|Rex|Mex|Rix|Mix|Fax|Fix|Sex|Sox|Lex|Six|Lax|Tex|Lix|Tix|Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)([\^_]*)/gi;
  const parts = [];
  let m;
  while ((m = SYL_REGEX.exec(word)) !== null) {
    const raw = m[1];
    const canonical = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const hasAxis = /x$/i.test(canonical);
    const baseSyl = canonical.replace(/x$/i, '');
    parts.push({
      canonical,
      baseSyl,
      hasAxis,
      octStr: m[2] || '',
    });
  }
  return parts;
}

// Inline Line Widget State
let currentInlineWidget = null;
let currentInlineWidgetLine = -1;

function clearInlineWidget() {
  if (currentInlineWidget) {
    currentInlineWidget.clear();
    currentInlineWidget = null;
    currentInlineWidgetLine = -1;
  }
}

function updateInlineSolfegeWidget() {
  if (!enableSolfegeContext) {
    clearInlineWidget();
    return;
  }

  const cur = editor.getCursor();
  const currentLine = editor.getLine(cur.line) || '';

  // Strictly scope preview to melody, harmony, and rhythm lines
  const isMusicLine = /^\s*(melody|harmony|rhythm)\s*:\s*\[/i.test(currentLine) ||
                      /^\s*(melody|harmony|rhythm)\s*:/i.test(currentLine) ||
                      /^\s*-\s+(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)/i.test(currentLine);

  if (!isMusicLine) {
    clearInlineWidget();
    return;
  }

  const colonIdx = currentLine.indexOf(':');

  // Extract all words on this line (only after key colon if present)
  const wordRegex = /\b([A-Za-z0-9\^_]+)\b/g;
  const matches = [];
  let m;
  while ((m = wordRegex.exec(currentLine)) !== null) {
    if (colonIdx !== -1 && m.index <= colonIdx) {
      continue; // Skip the property name key (e.g. "melody", "harmony", "rhythm")
    }
    const rawWord = m[1];
    const parts = splitSyllables(rawWord);
    if (parts.length > 0) {
      matches.push({
        word: rawWord,
        parts,
        startCh: m.index,
        endCh: m.index + rawWord.length,
      });
    }
  }

  if (matches.length === 0) {
    clearInlineWidget();
    return;
  }

  // Create lightweight strip container
  const stripNode = document.createElement('div');
  stripNode.className = 'cm-token-solfege-strip';

  matches.forEach(tok => {
    // Calculate exact pixel coords from CodeMirror
    const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
    const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
    const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

    const item = document.createElement('div');
    item.className = 'cm-token-solfege-item';
    item.style.left = `${centerLeft}px`;

    // Highlight active token if cursor is within token boundary
    if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
      item.classList.add('active-token');
    }

    if (tok.parts.length === 1) {
      item.innerHTML = createSolfegeGlyphSvg(tok.parts[0].baseSyl, tok.parts[0].hasAxis, 18);
    } else {
      // Multiple sub-syllables (e.g. FaMe, DoMeTe, DoxDo)
      item.innerHTML = tok.parts.map((p, idx) => {
        const size = idx === 0 ? 16 : 11;
        return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size);
      }).join('');
    }

    stripNode.appendChild(item);
  });

  clearInlineWidget();
  currentInlineWidget = editor.addLineWidget(cur.line, stripNode, {
    above: true,
    coverGutter: false,
    noHScroll: false
  });
  currentInlineWidgetLine = cur.line;
}

// Editor change event
editor.on('change', () => {
  setDirty(true);
  updateInlineSolfegeWidget();
  clearTimeout(compileDebounceTimer);
  compileDebounceTimer = setTimeout(() => {
    triggerCompile();
  }, 500);
});

// Cursor activity event for real-time line context
editor.on('cursorActivity', () => {
  updateInlineSolfegeWidget();
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

let isInitialScoreLoadDone = false;

// --- URL & Deeplinking Helpers ---
function getScoreFromUrlOrStorage(scoreList) {
  if (!scoreList || scoreList.length === 0) return null;

  // 1. Check URL search param (?score=...)
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

  // 2. Check URL hash (#...)
  if (window.location.hash) {
    const hashScore = window.location.hash.slice(1).toLowerCase().replace(/^scores[\\/]/, '');
    const match = scoreList.find(s => 
      s.name.toLowerCase() === hashScore ||
      s.path.toLowerCase().endsWith(hashScore)
    );
    if (match) return match.path;
  }

  // 3. Check localStorage
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

  // 4. Default to first score
  return scoreList[0].path;
}

function updateUrlAndStorage(filePath) {
  if (!filePath) return;
  localStorage.setItem('ppt_active_score', filePath);

  const cleanName = filePath.replace(/^scores[\\/]/, '');
  const newUrl = `${window.location.pathname}?score=${encodeURIComponent(cleanName)}`;
  window.history.replaceState({ score: cleanName }, '', newUrl);
}

// --- API Helpers ---
async function fetchScores(targetPath = null) {
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

      if (!isInitialScoreLoadDone) {
        isInitialScoreLoadDone = true;
        const initialScore = targetPath || getScoreFromUrlOrStorage(data.scores);
        currentScoreFile = initialScore;
        scoreSelect.value = initialScore;
        loadScore(initialScore);
      } else {
        const selected = targetPath || currentScoreFile || data.scores[0].path;
        currentScoreFile = selected;
        scoreSelect.value = selected;
        updateUrlAndStorage(selected);
      }
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
      updateUrlAndStorage(filePath);
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
      updateUrlAndStorage(data.file);
      await fetchScores(data.file); // Refresh list without reloading or recompiling editor!
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
    latestSidecarMap = data.sidecarMap || null;
    latestLilypondSource = data.lilypondSource || '';
    latestOnsets = data.onsets || [];

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

// Point-and-Click State & Navigation (Preview -> Code Editor)
let latestSidecarMap = null;
let latestLilypondSource = '';
let latestOnsets = [];

function findYamlTarget(yamlText, coilId, onsetIndex) {
  if (!yamlText || !coilId) return { targetLine: -1, targetCh: 0 };
  const lines = yamlText.split('\n');

  let coilStartLine = -1;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    // Match "id: <coilId>"
    if (new RegExp(`^\\s*id\\s*:\\s*["']?${coilId}["']?\\s*$`).test(line)) {
      coilStartLine = l;
      break;
    }
    // Match "<coilId>:"
    if (new RegExp(`^\\s*${coilId}\\s*:`).test(line)) {
      coilStartLine = l;
      break;
    }
    // Match "- coil: <coilId>"
    if (new RegExp(`^\\s*-\\s*coil\\s*:\\s*["']?${coilId}["']?\\s*$`).test(line)) {
      coilStartLine = l;
      break;
    }
  }

  // Substring fallback
  if (coilStartLine === -1) {
    for (let l = 0; l < lines.length; l++) {
      if (lines[l].includes(coilId)) {
        coilStartLine = l;
        break;
      }
    }
  }

  if (coilStartLine === -1) {
    return { targetLine: -1, targetCh: 0 };
  }

  let targetLine = coilStartLine;
  let targetCh = 0;
  const maxLookahead = Math.min(lines.length, coilStartLine + 35);

  for (let l = coilStartLine; l < maxLookahead; l++) {
    const line = lines[l];
    if (l > coilStartLine && (/^\s*-\s*coil\s*:/.test(line) || /^\s*[_a-zA-Z0-9]+\s*:\s*$/.test(line))) {
      break;
    }

    if (/^\s*(melody|harmony|rhythm)\s*:\s*\[/.test(line)) {
      targetLine = l;
      const arrayMatch = line.match(/\[(.*?)\]/);
      if (arrayMatch) {
        const rawTokens = arrayMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        const tokIdx = Math.max(0, Math.min(onsetIndex - 1, rawTokens.length - 1));
        const targetTokenStr = rawTokens[tokIdx];
        if (targetTokenStr) {
          const chStart = line.indexOf(targetTokenStr, line.indexOf('['));
          if (chStart !== -1) {
            targetCh = chStart;
          }
        }
      }
      break;
    }
  }

  return { targetLine, targetCh };
}

function handlePointAndClick(url) {
  if (!url || !url.includes('textedit:')) return;

  // Format: textedit:...:line:col:endCol or textedit:...:line:col
  const match = url.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
  if (!match) return;

  const lyLineNum = parseInt(match[1], 10);
  if (!latestLilypondSource) return;

  const lyLines = latestLilypondSource.split('\n');

  // Search around lyLineNum for \tag #'ppt_...
  let tag = null;
  const startL = Math.max(0, lyLineNum - 6);
  const endL = Math.min(lyLines.length - 1, lyLineNum + 5);

  for (let l = Math.min(lyLines.length - 1, lyLineNum - 1); l >= startL; l--) {
    const tm = lyLines[l].match(/\\tag\s*#'(ppt_[a-zA-Z0-9_]+)/);
    if (tm) {
      tag = tm[1];
      break;
    }
  }
  if (!tag) {
    for (let l = lyLineNum; l <= endL; l++) {
      const tm = lyLines[l].match(/\\tag\s*#'(ppt_[a-zA-Z0-9_]+)/);
      if (tm) {
        tag = tm[1];
        break;
      }
    }
  }

  let coilId = null;
  let onsetIndex = 1;

  if (tag && latestSidecarMap && latestSidecarMap[tag]) {
    coilId = latestSidecarMap[tag].coilId;
    onsetIndex = latestSidecarMap[tag].onsetIndex;
  } else if (tag) {
    const parts = tag.replace(/^ppt_/, '').split('_');
    onsetIndex = parseInt(parts[parts.length - 1], 10) || 1;
    coilId = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  }

  if (!coilId) return;

  const doc = editor.getDoc();
  const yamlText = doc.getValue();
  const { targetLine, targetCh } = findYamlTarget(yamlText, coilId, onsetIndex);

  if (targetLine !== -1) {
    editor.setCursor({ line: targetLine, ch: targetCh });
    editor.scrollIntoView({ line: targetLine, ch: targetCh }, 150);
    editor.focus();

    // Trigger cursor update so inline preview strip updates immediately
    updateInlineSolfegeWidget();

    // Flash animation on the target line
    editor.addLineClass(targetLine, 'background', 'cm-point-click-flash');
    setTimeout(() => {
      editor.removeLineClass(targetLine, 'background', 'cm-point-click-flash');
    }, 1200);
  }
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
      const displayViewport = page.getViewport({ scale: scale });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.style.width = `${viewport.width / dpr}px`;
      pageWrapper.style.height = `${viewport.height / dpr}px`;

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      pageWrapper.appendChild(canvas);

      // Fetch annotations from page (LilyPond Point & Click)
      const annotations = await page.getAnnotations();
      if (annotations && annotations.length > 0) {
        const annotLayer = document.createElement('div');
        annotLayer.className = 'pdf-annotation-layer';

        annotations.forEach(annot => {
          const rawUrl = annot.unsafeUrl || annot.url || '';
          if (rawUrl && (rawUrl.startsWith('textedit:') || rawUrl.includes('textedit'))) {
            const rect = displayViewport.convertToViewportRectangle(annot.rect);
            const minX = Math.min(rect[0], rect[2]);
            const minY = Math.min(rect[1], rect[3]);
            const width = Math.abs(rect[2] - rect[0]);
            const height = Math.abs(rect[3] - rect[1]);

            const linkEl = document.createElement('div');
            linkEl.className = 'pdf-point-click-link';
            linkEl.style.position = 'absolute';
            linkEl.style.left = `${minX - 2}px`;
            linkEl.style.top = `${minY - 2}px`;
            linkEl.style.width = `${Math.max(width + 4, 16)}px`;
            linkEl.style.height = `${Math.max(height + 4, 16)}px`;
            linkEl.style.cursor = 'pointer';
            linkEl.style.pointerEvents = 'auto';
            linkEl.title = `Point & Click: Jump to source in YAML`;

            linkEl.addEventListener('click', (e) => {
              e.stopPropagation();
              handlePointAndClick(rawUrl);
            });

            annotLayer.appendChild(linkEl);
          }
        });

        pageWrapper.appendChild(annotLayer);
      }

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      scoreSvgContainer.appendChild(pageWrapper);
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

// SVG Click listener for Point & Click
scoreSvgContainer.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('xlink:href') || link.getAttribute('href');
    if (href && href.startsWith('textedit://')) {
      e.preventDefault();
      handlePointAndClick(href);
    }
  }
});

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

window.addEventListener('popstate', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramScore = urlParams.get('score');
  if (paramScore && scoreSelect.options.length > 0) {
    const cleanParam = paramScore.toLowerCase().replace(/^scores[\\/]/, '');
    for (let i = 0; i < scoreSelect.options.length; i++) {
      const opt = scoreSelect.options[i];
      if (opt.value.toLowerCase().endsWith(cleanParam)) {
        scoreSelect.value = opt.value;
        loadScore(opt.value);
        break;
      }
    }
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
    updateInlineSolfegeWidget();
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
