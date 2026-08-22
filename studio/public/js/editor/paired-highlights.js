/**
 * Paired Music Layer Token Synchronization & Highlight Markers in CodeMirror
 */

import { getLineIndent, getEnclosingCoilAtPos } from '../core/ast-scanner.js';

let pairedTokenMarks = [];

export function clearPairedTokenHighlights() {
  pairedTokenMarks.forEach(mark => mark.clear());
  pairedTokenMarks = [];
}

export function expandLayerTokensWithOnsets(tokens) {
  const onsets = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const raw = (tok.word || tok.token || '').trim();

    const repeatMatch = raw.match(/^(\d+)(?:\.(\d+))?$/);
    if (repeatMatch && onsets.length > 0) {
      const repeatCount = parseInt(repeatMatch[1], 10);
      const windowSize = repeatMatch[2] ? parseInt(repeatMatch[2], 10) : 1;
      if (repeatCount > 0 && windowSize > 0 && windowSize <= onsets.length) {
        const windowOnsets = onsets.slice(-windowSize);
        for (let r = 0; r < repeatCount; r++) {
          for (let w = 0; w < windowOnsets.length; w++) {
            onsets.push({
              onsetIndex: onsets.length,
              sourceToken: tok,
              originToken: windowOnsets[w].originToken || windowOnsets[w].sourceToken,
              isRepeat: true,
            });
          }
        }
        continue;
      }
    }

    onsets.push({
      onsetIndex: onsets.length,
      sourceToken: tok,
      originToken: tok,
      isRepeat: false,
    });
  }

  return onsets;
}

export function getMusicLayerContext(cm, lineNo) {
  const line = cm.getLine(lineNo) || '';
  if (!line.trim() || /^\s*#/.test(line)) return null;

  const curIndent = getLineIndent(line);

  let isUnderHarmony = false;
  let harmonyHeaderLine = -1;
  for (let l = lineNo - 1; l >= Math.max(0, lineNo - 30); l--) {
    const prevL = cm.getLine(l) || '';
    if (!prevL.trim() || /^\s*#/.test(prevL)) continue;
    const prevIndent = getLineIndent(prevL);
    if (/^\s*harmony\s*:/i.test(prevL) && prevIndent < curIndent) {
      isUnderHarmony = true;
      harmonyHeaderLine = l;
      break;
    }
    if (prevIndent < curIndent && /^\s*[_a-zA-Z0-9]+\s*:/.test(prevL) && !/^\s*-\s+/.test(prevL)) {
      break;
    }
  }

  if (/^\s*(melody|pitches)\s*:/i.test(line)) {
    return { layer: 'melody', isStructuredHarmony: false };
  }
  if (/^\s*rhythm\s*:/i.test(line)) {
    if (isUnderHarmony) {
      return { layer: 'harmonyRhythm', isStructuredHarmony: true, harmonyHeaderLine };
    }
    return { layer: 'rhythm', isStructuredHarmony: false };
  }
  if (/^\s*chords\s*:/i.test(line) || /^\s*-\s*chords\s*:/i.test(line)) {
    return { layer: 'harmonyChords', isStructuredHarmony: isUnderHarmony, harmonyHeaderLine };
  }
  if (/^\s*harmony\s*:/i.test(line)) {
    return { layer: 'harmony', isStructuredHarmony: isUnderHarmony };
  }

  if (/^\s*-\s+/.test(line)) {
    for (let l = lineNo - 1; l >= Math.max(0, lineNo - 40); l--) {
      const prevL = cm.getLine(l) || '';
      if (!prevL.trim() || /^\s*#/.test(prevL)) continue;
      const prevIndent = getLineIndent(prevL);
      if (/^\s*(melody|pitches)\s*:/i.test(prevL)) {
        return { layer: 'melody', isStructuredHarmony: false };
      }
      if (/^\s*rhythm\s*:/i.test(prevL)) {
        return { layer: isUnderHarmony ? 'harmonyRhythm' : 'rhythm', isStructuredHarmony: isUnderHarmony };
      }
      if (/^\s*(harmony|chords)\s*:/i.test(prevL)) {
        return { layer: 'harmony', isStructuredHarmony: isUnderHarmony };
      }
      if (prevIndent < curIndent && /^\s*[a-zA-Z0-9_]+\s*:/.test(prevL) && !/^\s*-\s+/.test(prevL)) {
        break;
      }
    }
  }

  return null;
}

export function findAdjacentStructuredHarmonyLine(cm, curLineNo, targetKey) {
  const curLine = cm.getLine(curLineNo) || '';
  const curIndent = getLineIndent(curLine);
  const lineCount = cm.lineCount();
  const searchRegex = targetKey === 'rhythm'
    ? /^\s*rhythm\s*:/i
    : /^\s*(?:-\s*)?chords\s*:/i;

  for (let l = curLineNo + 1; l < Math.min(lineCount, curLineNo + 15); l++) {
    const lText = cm.getLine(l) || '';
    if (!lText.trim() || /^\s*#/.test(lText)) continue;
    const lIndent = getLineIndent(lText);
    if (lIndent < curIndent && !/^\s*-\s+/.test(lText)) break;
    if (searchRegex.test(lText)) {
      return l;
    }
  }

  for (let l = curLineNo - 1; l >= Math.max(0, curLineNo - 15); l--) {
    const lText = cm.getLine(l) || '';
    if (!lText.trim() || /^\s*#/.test(lText)) continue;
    const lIndent = getLineIndent(lText);
    if (lIndent < curIndent && !/^\s*-\s+/.test(lText)) {
      if (!/^\s*harmony\s*:/i.test(lText)) break;
    }
    if (searchRegex.test(lText)) {
      return l;
    }
  }

  return -1;
}

export function extractTokensForPaired(lineText) {
  if (!lineText) return [];
  const colonIdx = lineText.indexOf(':');
  let content = lineText;
  let offset = 0;
  if (colonIdx !== -1) {
    content = lineText.slice(colonIdx + 1);
    offset = colonIdx + 1;
  } else {
    const bulletMatch = lineText.match(/^\s*-\s+/);
    if (bulletMatch) {
      content = lineText.slice(bulletMatch[0].length);
      offset = bulletMatch[0].length;
    }
  }

  const tokenRegex = /([a-zA-Z0-9\^_~#\/\.\+\-]+)/g;
  const tokens = [];
  let tm;
  while ((tm = tokenRegex.exec(content)) !== null) {
    const raw = tm[1];
    if (raw === '[' || raw === ']' || raw === ',') continue;
    tokens.push({
      word: raw,
      startCh: offset + tm.index,
      endCh: offset + tm.index + raw.length,
    });
  }
  return tokens;
}

export function updatePairedTokenHighlights(cm) {
  if (!cm) return;
  clearPairedTokenHighlights();

  const cur = cm.getCursor();
  const currentLine = cm.getLine(cur.line) || '';
  if (!currentLine.trim() || /^\s*#/.test(currentLine)) return;

  const musicContext = getMusicLayerContext(cm, cur.line);
  if (!musicContext) return;

  const lineTokens = extractTokensForPaired(currentLine);
  if (lineTokens.length === 0) return;

  const activeOnsets = expandLayerTokensWithOnsets(lineTokens);

  const targetOnsetIndices = [];
  activeOnsets.forEach(onset => {
    const srcTok = onset.sourceToken;
    if (cur.ch >= srcTok.startCh && cur.ch <= srcTok.endCh) {
      targetOnsetIndices.push(onset.onsetIndex);
    }
  });

  if (targetOnsetIndices.length === 0) return;

  const coil = getEnclosingCoilAtPos(cm, cur);
  if (!coil) return;

  const targetLayerLines = [];

  function findMelodyOrRhythmLine(layerKey) {
    const totalLines = cm.lineCount();
    const isTarget = (str) => new RegExp(`^\\s*${layerKey}\\s*:`, 'i').test(str);

    for (let l = coil.startLine; l <= coil.endLine; l++) {
      const lText = cm.getLine(l) || '';
      if (isTarget(lText)) return l;
    }

    return -1;
  }

  if (musicContext.isStructuredHarmony) {
    if (musicContext.layer === 'harmonyChords') {
      const adjLine = findAdjacentStructuredHarmonyLine(cm, cur.line, 'rhythm');
      if (adjLine !== -1) {
        targetLayerLines.push({ layer: 'harmonyRhythm', lineNo: adjLine });
      }
    } else if (musicContext.layer === 'harmonyRhythm') {
      const adjLine = findAdjacentStructuredHarmonyLine(cm, cur.line, 'chords');
      if (adjLine !== -1) {
        targetLayerLines.push({ layer: 'harmonyChords', lineNo: adjLine });
      }
    }
  } else if (musicContext.layer === 'melody') {
    targetLayerLines.push({ layer: 'rhythm', lineNo: findMelodyOrRhythmLine('rhythm') });
  } else if (musicContext.layer === 'rhythm') {
    targetLayerLines.push({ layer: 'melody', lineNo: findMelodyOrRhythmLine('melody') });
  }

  targetLayerLines.forEach(({ layer, lineNo }) => {
    let targetLineNo = lineNo;
    if (targetLineNo !== -1 && targetLineNo !== cur.line) {
      let targetLineText = cm.getLine(targetLineNo) || '';
      let targetTokens = extractTokensForPaired(targetLineText);

      if (targetTokens.length === 0 && /:\s*$/.test(targetLineText)) {
        const nextLine = cm.getLine(targetLineNo + 1) || '';
        if (/^\s*-\s+/.test(nextLine)) {
          targetTokens = extractTokensForPaired(nextLine);
          targetLineNo = targetLineNo + 1;
        }
      }

      const targetOnsets = expandLayerTokensWithOnsets(targetTokens);
      const markedTokens = new Set();

      targetOnsetIndices.forEach(oIdx => {
        if (targetOnsets[oIdx]) {
          const tok = targetOnsets[oIdx].sourceToken;
          const tokKey = `${tok.startCh}-${tok.endCh}`;
          if (!markedTokens.has(tokKey)) {
            markedTokens.add(tokKey);
            const mark = cm.markText(
              { line: targetLineNo, ch: tok.startCh },
              { line: targetLineNo, ch: tok.endCh },
              {
                className: 'cm-paired-token-highlight',
                title: `Paired onset #${oIdx + 1} (${tok.word})`,
              }
            );
            pairedTokenMarks.push(mark);
          }
        }
      });
    }
  });
}
