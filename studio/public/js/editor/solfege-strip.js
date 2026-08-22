/**
 * Text-Aligned Floating Solfège Preview Strip & Dual Melody Representation Widget
 */

import { state } from '../state.js';
import { isValidSolfegeToken } from '../core/solfege.js';
import { createSolfegeGlyphSvg } from '../core/glyphs.js';
import { parseMelodyToken, convertIntervalToAbsoluteMelody, convertAbsoluteToIntervalMelody } from '../core/pitch.js';
import { extractTokensFromLine } from '../core/ast-scanner.js';

export function splitSyllables(word) {
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
    const octStr = m[2] || '';
    let octaveShift = 0;
    for (const ch of octStr) {
      if (ch === '^') octaveShift++;
      else if (ch === '_') octaveShift--;
    }
    parts.push({
      canonical,
      baseSyl,
      hasAxis,
      octStr,
      octaveShift,
    });
  }
  return parts;
}

let currentInlineWidget = null;
let currentInlineWidgetLine = -1;

export function clearInlineWidget() {
  if (currentInlineWidget) {
    currentInlineWidget.clear();
    currentInlineWidget = null;
    currentInlineWidgetLine = -1;
  }
}

export function updateInlineSolfegeWidget(editor) {
  if (!editor || !state.preferences.solfegeContext) {
    clearInlineWidget();
    return;
  }

  const cur = editor.getCursor();
  const currentLine = editor.getLine(cur.line) || '';

  const isMusicLine =
    /^\s*(melody|harmony|rhythm|chords|pitches)\s*:\s*\[/i.test(currentLine) ||
    /^\s*(melody|harmony|rhythm|chords|pitches)\s*:/i.test(currentLine) ||
    /^\s*-\s*\[/i.test(currentLine) ||
    /^\s*-\s+(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti|Dox)/i.test(currentLine);

  if (!isMusicLine) {
    clearInlineWidget();
    return;
  }

  let isMelody = /^\s*(melody|pitches)\s*:/i.test(currentLine);
  if (!isMelody && /^\s*-\s+/.test(currentLine)) {
    const curLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;
    for (let l = cur.line - 1; l >= Math.max(0, cur.line - 40); l--) {
      const prevL = editor.getLine(l) || '';
      const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
      if (/^\s*(melody|pitches)\s*:/i.test(prevL)) {
        isMelody = true;
        break;
      } else if (/^\s*(rhythm|harmony|chords)\s*:/i.test(prevL) || (prevIndent < curLineIndent && /^\s*[a-zA-Z0-9_]+\s*:/.test(prevL))) {
        break;
      }
    }
  }

  const lineTokens = extractTokensFromLine(currentLine);
  const matches = [];
  for (const tok of lineTokens) {
    const word = tok.word || tok.token;
    const parts = splitSyllables(word);
    if (parts.length > 0 || /^\d+(?:\.\d+)?$/.test(word) || word === 'R' || word === '~') {
      matches.push({
        word,
        parts,
        startCh: tok.startCh !== undefined ? tok.startCh : tok.start,
        endCh: tok.endCh !== undefined ? tok.endCh : tok.end,
      });
    }
  }

  if (matches.length === 0) {
    clearInlineWidget();
    return;
  }

  const stripNode = document.createElement('div');

  if (isMelody) {
    stripNode.className = 'cm-token-solfege-strip cm-token-solfege-strip-dual';

    const rawWords = matches.map(tok => tok.word);
    const firstParsed = parseMelodyToken(rawWords[0]);
    const isInterval = firstParsed.hasAxis;

    let altWords = [];
    let altBadgeText = '';
    let mainBadgeText = '';

    if (isInterval) {
      altWords = convertIntervalToAbsoluteMelody(rawWords);
      altBadgeText = 'ALT: ABS';
      mainBadgeText = 'INT';
    } else {
      altWords = convertAbsoluteToIntervalMelody(rawWords);
      altBadgeText = 'ALT: INT';
      mainBadgeText = 'ABS';
    }

    // 1. Upper Row (Alternative view)
    const altRow = document.createElement('div');
    altRow.className = 'cm-token-solfege-row cm-token-solfege-row-alt';
    altRow.title = `Alternative Melody View (${isInterval ? 'Absolute' : 'Interval'})`;

    const altBadge = document.createElement('span');
    altBadge.className = 'cm-token-solfege-badge alt-badge';
    altBadge.textContent = altBadgeText;
    altRow.appendChild(altBadge);

    matches.forEach((tok, idx) => {
      const altWord = altWords[idx] || tok.word;
      const altParts = splitSyllables(altWord);

      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const altItem = document.createElement('div');
      altItem.className = 'cm-token-solfege-item';
      altItem.style.left = `${centerLeft}px`;
      altItem.title = `Alt (${altBadgeText}): ${altWord}`;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        altItem.classList.add('active-token');
      }

      if (altParts.length === 1) {
        altItem.innerHTML = createSolfegeGlyphSvg(altParts[0].baseSyl, altParts[0].hasAxis, 16, altParts[0].octaveShift);
      } else if (altParts.length > 1) {
        altItem.innerHTML = altParts.map((p, pIdx) => {
          const size = pIdx === 0 ? 14 : 10;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      } else {
        altItem.textContent = altWord;
      }

      altRow.appendChild(altItem);
    });

    // 2. Lower Row (Written view)
    const mainRow = document.createElement('div');
    mainRow.className = 'cm-token-solfege-row cm-token-solfege-row-main';
    mainRow.title = `Written Melody View (${isInterval ? 'Interval' : 'Absolute'})`;

    const mainBadge = document.createElement('span');
    mainBadge.className = 'cm-token-solfege-badge main-badge';
    mainBadge.textContent = mainBadgeText;
    mainRow.appendChild(mainBadge);

    matches.forEach(tok => {
      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const item = document.createElement('div');
      item.className = 'cm-token-solfege-item';
      item.style.left = `${centerLeft}px`;
      item.title = `Written (${mainBadgeText}): ${tok.word}`;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        item.classList.add('active-token');
      }

      if (tok.parts.length === 1) {
        item.innerHTML = createSolfegeGlyphSvg(tok.parts[0].baseSyl, tok.parts[0].hasAxis, 17, tok.parts[0].octaveShift);
      } else {
        item.innerHTML = tok.parts.map((p, pIdx) => {
          const size = pIdx === 0 ? 15 : 11;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      }

      mainRow.appendChild(item);
    });

    stripNode.appendChild(altRow);
    stripNode.appendChild(mainRow);
  } else {
    // Single row for rhythm, harmony, chords
    stripNode.className = 'cm-token-solfege-strip cm-token-solfege-strip-single';

    const row = document.createElement('div');
    row.className = 'cm-token-solfege-row cm-token-solfege-row-main';

    let layerBadgeText = 'NOTE';
    if (/^\s*rhythm\s*:/i.test(currentLine)) layerBadgeText = 'RHY';
    else if (/^\s*(harmony|chords)\s*:/i.test(currentLine)) layerBadgeText = 'HARM';

    const badge = document.createElement('span');
    badge.className = 'cm-token-solfege-badge main-badge';
    badge.textContent = layerBadgeText;
    row.appendChild(badge);

    matches.forEach(tok => {
      const startCoord = editor.cursorCoords({ line: cur.line, ch: tok.startCh }, 'local');
      const endCoord = editor.cursorCoords({ line: cur.line, ch: tok.endCh }, 'local');
      const centerLeft = Math.round((startCoord.left + endCoord.left) / 2);

      const item = document.createElement('div');
      item.className = 'cm-token-solfege-item';
      item.style.left = `${centerLeft}px`;
      item.title = tok.word;

      if (cur.ch >= tok.startCh && cur.ch <= tok.endCh) {
        item.classList.add('active-token');
      }

      if (tok.parts.length === 1) {
        item.innerHTML = createSolfegeGlyphSvg(tok.parts[0].baseSyl, tok.parts[0].hasAxis, 18, tok.parts[0].octaveShift);
      } else {
        item.innerHTML = tok.parts.map((p, pIdx) => {
          const size = pIdx === 0 ? 16 : 11;
          return createSolfegeGlyphSvg(p.baseSyl, p.hasAxis, size, p.octaveShift);
        }).join('');
      }

      row.appendChild(item);
    });

    stripNode.appendChild(row);
  }

  clearInlineWidget();
  currentInlineWidget = editor.addLineWidget(cur.line, stripNode, {
    above: true,
    coverGutter: false,
    noHScroll: false,
  });
  currentInlineWidgetLine = cur.line;
}
