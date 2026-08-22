/**
 * Contextual Keyboard Shortcuts & Structural Navigation for CodeMirror
 */

import { events } from '../state.js';
import {
  getLineIndent,
  scanDeclaredCoilsAndWeaves,
  getEnclosingPropertyBlock,
  RESERVED_SCHEMA_KEYS,
} from '../core/ast-scanner.js';

export const SOLFEGE_CHROMATIC_UP = {
  'So': 'Le',
  'Si': 'La',
  'Le': 'La',
  'La': 'Te',
  'Li': 'Ti',
  'Te': 'Ti',
  'Ti': 'Do',
  'Do': 'Ra',
  'Ra': 'Re',
  'Di': 'Re',
  'Re': 'Me',
  'Me': 'Mi',
  'Ri': 'Mi',
  'Mi': 'Fa',
  'Fa': 'Fi',
  'Se': 'So',
  'Fi': 'So',
};

export const SOLFEGE_CHROMATIC_DOWN = {
  'Fi': 'Fa',
  'Se': 'Fa',
  'Fa': 'Mi',
  'Mi': 'Me',
  'Ri': 'Re',
  'Me': 'Re',
  'Re': 'Ra',
  'Di': 'Do',
  'Ra': 'Do',
  'Do': 'Ti',
  'Ti': 'Te',
  'Li': 'La',
  'Te': 'La',
  'La': 'Le',
  'Si': 'Fi',
  'Le': 'So',
  'So': 'Fi',
};

export function getSolfegeTokensOnLine(lineText) {
  const tokens = [];
  const regex = /[A-Za-z0-9_\^~]+/g;
  let match;
  while ((match = regex.exec(lineText)) !== null) {
    const raw = match[0];
    const subRegex = /(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x)?([\^_]*)/gi;
    let sm;
    while ((sm = subRegex.exec(raw)) !== null) {
      const subStart = match.index + sm.index;
      const subEnd = subStart + sm[0].length;
      let rawSyl = sm[1];
      const baseSyl = rawSyl.charAt(0).toUpperCase() + rawSyl.slice(1).toLowerCase();
      const hasAxis = Boolean(sm[2]);
      const octStr = sm[3] || '';
      tokens.push({
        baseSyl,
        hasAxis,
        octStr,
        fullTokenText: sm[0],
        startCh: subStart,
        endCh: subEnd,
      });
    }
  }
  return tokens;
}

export function transposeSubSyllable(subToken, direction) {
  const { baseSyl, hasAxis, octStr } = subToken;

  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  let newBaseSyl = baseSyl;
  if (direction === 'up') {
    if (baseSyl === 'Fi') {
      newBaseSyl = 'So';
      octShift += 1;
    } else {
      newBaseSyl = SOLFEGE_CHROMATIC_UP[baseSyl] || 'Do';
    }
  } else if (direction === 'down') {
    if (baseSyl === 'So') {
      newBaseSyl = 'Fi';
      octShift -= 1;
    } else {
      newBaseSyl = SOLFEGE_CHROMATIC_DOWN[baseSyl] || 'Ti';
    }
  }

  let result = newBaseSyl;
  if (hasAxis) {
    result += 'x';
  }
  if (octShift > 0) {
    result += '^'.repeat(octShift);
  } else if (octShift < 0) {
    result += '_'.repeat(Math.abs(octShift));
  }

  return result;
}

export function isCursorOnSolfege(cm) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);
  if (tokens.length === 0) return false;
  return tokens.some(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
}

export function shiftSubSyllableOctave(subToken, direction) {
  const { baseSyl, hasAxis, octStr } = subToken;

  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  if (direction === 'up') {
    octShift += 1;
  } else if (direction === 'down') {
    octShift -= 1;
  }

  let result = baseSyl;
  if (hasAxis) {
    result += 'x';
  }
  if (octShift > 0) {
    result += '^'.repeat(octShift);
  } else if (octShift < 0) {
    result += '_'.repeat(Math.abs(octShift));
  }

  return result;
}

export function handleSolfegeTranspose(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return window.CodeMirror ? window.CodeMirror.Pass : undefined;
  }

  let target = tokens.find(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (!target) {
    let minDist = Infinity;
    for (const t of tokens) {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        target = t;
      }
    }
  }

  if (!target) return window.CodeMirror ? window.CodeMirror.Pass : undefined;

  const newText = transposeSubSyllable(target, direction);
  const from = { line: cur.line, ch: target.startCh };
  const to = { line: cur.line, ch: target.endCh };

  cm.replaceRange(newText, from, to);

  const newCursorCh = Math.min(cur.ch, target.startCh + newText.length);
  cm.setCursor({ line: cur.line, ch: newCursorCh });

  events.emit('editor:changed', cm);
}

export function handleSolfegeOctaveShift(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return window.CodeMirror ? window.CodeMirror.Pass : undefined;
  }

  let target = tokens.find(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (!target) {
    let minDist = Infinity;
    for (const t of tokens) {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        target = t;
      }
    }
  }

  if (!target) return window.CodeMirror ? window.CodeMirror.Pass : undefined;

  const newText = shiftSubSyllableOctave(target, direction);
  const from = { line: cur.line, ch: target.startCh };
  const to = { line: cur.line, ch: target.endCh };

  cm.replaceRange(newText, from, to);

  const newCursorCh = Math.min(cur.ch, target.startCh + newText.length);
  cm.setCursor({ line: cur.line, ch: newCursorCh });

  events.emit('editor:changed', cm);
}

export function handleSolfegeNavigation(cm, direction) {
  const cur = cm.getCursor();
  const lineText = cm.getLine(cur.line) || '';
  const tokens = getSolfegeTokensOnLine(lineText);

  if (tokens.length === 0) {
    return window.CodeMirror ? window.CodeMirror.Pass : undefined;
  }

  let activeIdx = tokens.findIndex(t => cur.ch >= t.startCh && cur.ch <= t.endCh);
  if (activeIdx === -1) {
    let minDist = Infinity;
    tokens.forEach((t, idx) => {
      const dist = Math.min(Math.abs(cur.ch - t.startCh), Math.abs(cur.ch - t.endCh));
      if (dist < minDist) {
        minDist = dist;
        activeIdx = idx;
      }
    });
  }

  if (direction === 'left') {
    if (activeIdx > 0) {
      const prev = tokens[activeIdx - 1];
      cm.setCursor({ line: cur.line, ch: prev.startCh });
    } else if (activeIdx === 0) {
      cm.setCursor({ line: cur.line, ch: tokens[0].startCh });
    }
  } else if (direction === 'right') {
    if (activeIdx >= 0 && activeIdx < tokens.length - 1) {
      const next = tokens[activeIdx + 1];
      cm.setCursor({ line: cur.line, ch: next.startCh });
    } else {
      const currentToken = tokens[activeIdx >= 0 ? activeIdx : tokens.length - 1];
      const dupText = currentToken.fullTokenText;

      const closingBracketIdx = lineText.indexOf(']');
      if (closingBracketIdx !== -1) {
        const insertPos = { line: cur.line, ch: closingBracketIdx };
        const insertText = `, ${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line, ch: closingBracketIdx + 2 });
      } else if (/^\s*-\s+/.test(lineText)) {
        const indentMatch = lineText.match(/^(\s*-\s+)/);
        const indent = indentMatch ? indentMatch[1] : '  - ';
        const insertPos = { line: cur.line, ch: lineText.length };
        const insertText = `\n${indent}${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line + 1, ch: indent.length });
      } else {
        const insertPos = { line: cur.line, ch: lineText.length };
        const insertText = ` ${dupText}`;
        cm.replaceRange(insertText, insertPos);
        cm.setCursor({ line: cur.line, ch: lineText.length + 1 });
      }
    }
  }
}

export function navigatePropertySibling(cm, direction) {
  const cur = cm.getCursor();
  const lineCount = cm.lineCount();
  const curLine = cm.getLine(cur.line) || '';
  const curIndent = getLineIndent(curLine);

  let startL = cur.line;
  if (!curLine.trim()) {
    if (direction === 'up') {
      while (startL > 0 && !cm.getLine(startL).trim()) startL--;
    } else {
      while (startL < lineCount - 1 && !cm.getLine(startL).trim()) startL++;
    }
  }

  const step = direction === 'up' ? -1 : 1;
  let targetLine = -1;

  for (let l = startL + step; l >= 0 && l < lineCount; l += step) {
    const line = cm.getLine(l);
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const indent = getLineIndent(line);
    if (indent === curIndent) {
      if (/^\s*(?:-\s*)?[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(line) || /^\s*-\s+/.test(line)) {
        targetLine = l;
        break;
      }
    } else if (indent < curIndent) {
      break;
    }
  }

  if (targetLine !== -1) {
    cm.setCursor({ line: targetLine, ch: getLineIndent(cm.getLine(targetLine)) });
    cm.scrollIntoView({ line: targetLine, ch: 0 }, 30);
  }
}

export function reorderPropertyBlock(cm, direction) {
  const cur = cm.getCursor();
  const block = getEnclosingPropertyBlock(cm, cur);
  if (!block) return;

  const isBlockHeader = (str) => /^\s*-\s+/.test(str) || /^\s*[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(str);
  const lineCount = cm.lineCount();

  if (direction === 'up') {
    let prevStart = -1;
    for (let p = block.startLine - 1; p >= 0; p--) {
      const pLine = cm.getLine(p);
      if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
      const pIndent = getLineIndent(pLine);
      if (pIndent < block.baseIndent) break;
      if (pIndent === block.baseIndent && isBlockHeader(pLine)) {
        prevStart = p;
        break;
      }
    }
    if (prevStart === -1) return;

    const prevBlock = getEnclosingPropertyBlock(cm, { line: prevStart, ch: 0 });
    if (!prevBlock || prevBlock.baseIndent !== block.baseIndent) return;

    const prevText = cm.getRange({ line: prevBlock.startLine, ch: 0 }, { line: prevBlock.endLine, ch: cm.getLine(prevBlock.endLine).length });
    const currentText = cm.getRange({ line: block.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });

    let middleText = '';
    if (block.startLine > prevBlock.endLine + 1) {
      middleText = cm.getRange({ line: prevBlock.endLine + 1, ch: 0 }, { line: block.startLine - 1, ch: cm.getLine(block.startLine - 1).length }) + '\n';
    }

    const newCombined = `${currentText}\n${middleText}${prevText}`;
    cm.replaceRange(newCombined, { line: prevBlock.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });

    const offsetLines = cur.line - block.startLine;
    const newCurLine = prevBlock.startLine + offsetLines;
    cm.setCursor({ line: newCurLine, ch: cur.ch });
  } else {
    let nextStart = -1;
    for (let n = block.endLine + 1; n < lineCount; n++) {
      const nLine = cm.getLine(n);
      if (!nLine.trim() || /^\s*#/.test(nLine)) continue;
      const nIndent = getLineIndent(nLine);
      if (nIndent < block.baseIndent) break;
      if (nIndent === block.baseIndent && isBlockHeader(nLine)) {
        nextStart = n;
        break;
      }
    }
    if (nextStart === -1) return;

    const nextBlock = getEnclosingPropertyBlock(cm, { line: nextStart, ch: 0 });
    if (!nextBlock || nextBlock.baseIndent !== block.baseIndent) return;

    const currentText = cm.getRange({ line: block.startLine, ch: 0 }, { line: block.endLine, ch: cm.getLine(block.endLine).length });
    const nextText = cm.getRange({ line: nextBlock.startLine, ch: 0 }, { line: nextBlock.endLine, ch: cm.getLine(nextBlock.endLine).length });

    let middleText = '';
    if (nextBlock.startLine > block.endLine + 1) {
      middleText = cm.getRange({ line: block.endLine + 1, ch: 0 }, { line: nextBlock.startLine - 1, ch: cm.getLine(nextBlock.startLine - 1).length }) + '\n';
    }

    const newCombined = `${nextText}\n${middleText}${currentText}`;
    cm.replaceRange(newCombined, { line: block.startLine, ch: 0 }, { line: nextBlock.endLine, ch: cm.getLine(nextBlock.endLine).length });

    const nextBlockLength = nextBlock.endLine - nextBlock.startLine + 1;
    const middleLength = nextBlock.startLine > block.endLine + 1 ? (nextBlock.startLine - block.endLine - 1) : 0;
    const offsetLines = cur.line - block.startLine;
    const newCurLine = block.startLine + nextBlockLength + middleLength + offsetLines;
    cm.setCursor({ line: newCurLine, ch: cur.ch });
  }

  events.emit('editor:changed', cm);
}

export function duplicatePropertyBlock(cm) {
  const cur = cm.getCursor();
  const block = getEnclosingPropertyBlock(cm, cur);
  if (!block) return;

  const originalText = cm.getRange(
    { line: block.startLine, ch: 0 },
    { line: block.endLine, ch: cm.getLine(block.endLine).length }
  );

  const declared = scanDeclaredCoilsAndWeaves(cm);
  const allIds = new Set(declared.all);

  let duplicatedText = originalText;
  const firstLine = cm.getLine(block.startLine);

  const idMatch = originalText.match(/^(\s*id\s*:\s*["']?)([_a-zA-Z0-9]+)(["']?.*)$/m);
  const dictMatch = firstLine.match(/^(\s*)([_a-zA-Z0-9]+)(\s*:(?!\s*\[).*)$/);
  const itemMatch = firstLine.match(/^(\s*-\s*(?:coil|weave)\s*:\s*["']?)([_a-zA-Z0-9]+)(["']?.*)$/);

  let targetOldId = null;
  let newId = null;

  if (dictMatch && !RESERVED_SCHEMA_KEYS.has(dictMatch[2].toLowerCase())) {
    targetOldId = dictMatch[2];
  } else if (idMatch) {
    targetOldId = idMatch[2];
  } else if (itemMatch) {
    targetOldId = itemMatch[2];
  }

  if (targetOldId) {
    let suffixNum = 2;
    const numMatch = targetOldId.match(/^(.*?)(?:_?(\d+))$/);
    let baseStem = targetOldId;
    if (numMatch) {
      baseStem = numMatch[1].replace(/_$/, '');
      suffixNum = parseInt(numMatch[2], 10) + 1;
    }

    newId = `${baseStem}_${suffixNum}`;
    while (allIds.has(newId)) {
      suffixNum++;
      newId = `${baseStem}_${suffixNum}`;
    }

    if (dictMatch && !RESERVED_SCHEMA_KEYS.has(dictMatch[2].toLowerCase())) {
      const newFirstLine = `${dictMatch[1]}${newId}${dictMatch[3]}`;
      const lines = duplicatedText.split('\n');
      lines[0] = newFirstLine;
      duplicatedText = lines.join('\n');
    } else if (idMatch) {
      duplicatedText = duplicatedText.replace(
        new RegExp(`^(\\s*id\\s*:\\s*["']?)${targetOldId}(["']?.*)$`, 'm'),
        `$1${newId}$2`
      );
    } else if (itemMatch) {
      const newFirstLine = `${itemMatch[1]}${newId}${itemMatch[3]}`;
      const lines = duplicatedText.split('\n');
      lines[0] = newFirstLine;
      duplicatedText = lines.join('\n');
    }
  }

  const insertLine = block.endLine;
  const insertPos = { line: insertLine, ch: cm.getLine(insertLine).length };
  cm.replaceRange(`\n${duplicatedText}`, insertPos);

  const newBlockStart = block.endLine + 1;
  cm.setCursor({ line: newBlockStart, ch: getLineIndent(cm.getLine(newBlockStart)) });
  cm.scrollIntoView({ line: newBlockStart, ch: 0 }, 50);

  cm.addLineClass(newBlockStart, 'background', 'cm-point-click-flash');
  setTimeout(() => {
    cm.removeLineClass(newBlockStart, 'background', 'cm-point-click-flash');
  }, 1200);

  events.emit('editor:changed', cm);
}

export function handleContextualUp(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeTranspose(cm, 'up');
  }
  return navigatePropertySibling(cm, 'up');
}

export function handleContextualDown(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeTranspose(cm, 'down');
  }
  return navigatePropertySibling(cm, 'down');
}

export function handleContextualAltUp(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeOctaveShift(cm, 'up');
  }
  return reorderPropertyBlock(cm, 'up');
}

export function handleContextualAltDown(cm) {
  if (isCursorOnSolfege(cm)) {
    return handleSolfegeOctaveShift(cm, 'down');
  }
  return reorderPropertyBlock(cm, 'down');
}
