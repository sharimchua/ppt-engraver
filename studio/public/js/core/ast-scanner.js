/**
 * YAML Document Scanner, Token & AST Traversal Utilities
 */

import { isValidSolfegeToken } from './solfege.js';

export const RESERVED_SCHEMA_KEYS = new Set([
  'tapestry', 'knot', 'knots', 'weaves', 'coils', 'children', 'stitch', 'stitches',
  'melody', 'rhythm', 'harmony', 'chords', 'pitches', 'parent', 'parents',
  'concat', 'root', 'repeat', 'title', 'composer', 'arranger', 'tagline', 'tonic',
  'tempo', 'engraving', 'clef', 'harmonyclef', 'show', 'colornotes', 'omitstem',
  'traditionalrhythms', 'noteheadstyle', 'pulse', 'meter', 'timesignature',
  'zoom', 'indent', 'harmonyvoicing', 'melodyaugmentation', 'projection',
  'visible', 'hidden', 'abstract', 'id', 'name', 'use', 'from', 'coil', 'weave',
  'excludegriddosymbol', 'strongbeatgridweight', 'gridsymbols', 'rhythmgrid',
  'chordnames', 'pulsecoil', 'pulsesignature', 'rhythmcoil',
  'melodycoilabsolute', 'melodycoilinterval'
]);

export function getLineIndent(line) {
  if (!line) return 0;
  const match = line.match(/^(\s*)/);
  return match ? match[0].length : 0;
}

let declaredIdsCache = new Set();

export function scanDeclaredCoilsAndWeaves(cm) {
  if (!cm) return { coils: [], weaves: [], knots: [], all: [] };
  const text = typeof cm === 'string' ? cm : (cm.getValue ? cm.getValue() : '');
  const coilIds = new Set();
  const weaveIds = new Set();
  const knotIds = new Set();

  const lines = text.split('\n');
  const sectionStack = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (/^\s*#/.test(line) || !line.trim()) continue;

    const indent = getLineIndent(line);

    while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].indent >= indent) {
      sectionStack.pop();
    }
    const currentContext = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1].section : null;

    const sectionMatch = line.match(/^(\s*)(weaves|coils|knots|engraving|children|stitch|stitches|concat)\s*:/i);
    if (sectionMatch) {
      const secName = sectionMatch[2].toLowerCase();
      sectionStack.push({ section: secName, indent });
      continue;
    }

    const dictKeyMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
    if (dictKeyMatch) {
      const key = dictKeyMatch[2];
      const lowerKey = key.toLowerCase();
      if (!RESERVED_SCHEMA_KEYS.has(lowerKey)) {
        if (currentContext === 'weaves') {
          weaveIds.add(key);
          sectionStack.push({ section: 'weave-body', indent });
        } else if (currentContext === 'knots') {
          knotIds.add(key);
          sectionStack.push({ section: 'knot-body', indent });
        } else if (currentContext === 'coils') {
          coilIds.add(key);
          sectionStack.push({ section: 'coil-body', indent });
        } else if (currentContext === 'weave-body') {
          coilIds.add(key);
        } else if (currentContext !== 'engraving') {
          coilIds.add(key);
        }
      }
    }

    const inlineIdMatch = line.match(/\bid\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (inlineIdMatch) {
      const idVal = inlineIdMatch[1];
      if (currentContext === 'weaves') weaveIds.add(idVal);
      else if (currentContext === 'knots') knotIds.add(idVal);
      else coilIds.add(idVal);
    }
  }

  const all = Array.from(new Set([...coilIds, ...weaveIds, ...knotIds]));
  declaredIdsCache = new Set(all);

  return {
    coils: Array.from(coilIds),
    weaves: Array.from(weaveIds),
    knots: Array.from(knotIds),
    all,
  };
}

export function scanDeclaredIds(cm) {
  const result = scanDeclaredCoilsAndWeaves(cm);
  return result.all;
}

export function getDeclaredIdsCache() {
  return declaredIdsCache;
}

export function findParentSection(cm, lineNum) {
  const targetLine = cm.getLine(lineNum) || '';
  const targetIndent = getLineIndent(targetLine);

  for (let l = lineNum - 1; l >= 0; l--) {
    const prevLine = cm.getLine(l);
    if (!prevLine || /^\s*#/.test(prevLine) || !prevLine.trim()) continue;

    const prevIndent = getLineIndent(prevLine);
    if (prevIndent < targetIndent || targetIndent === 0) {
      const match = prevLine.match(/^\s*(?:-\s*)?([_a-zA-Z0-9]+)\s*:/);
      if (match) {
        const key = match[1].toLowerCase();
        if (key === 'engraving') return 'engraving';
        if (key === 'knot' || key === 'knots') return 'knot';
        if (key === 'show') return 'show';
        if (key === 'coils') return 'coils';
        if (key === 'weaves') return 'weaves';
        if (key === 'stitch' || key === 'stitches' || key === 'children') return 'stitch';
        if (key === 'concat') return 'concat';
        if (key === 'parents' || key === 'parent') return 'parents';

        const grandParent = findParentSection(cm, l);
        if (grandParent === 'knots' || grandParent === 'knot') return 'knot';
        if (grandParent === 'coils' || grandParent === 'coil-body') return 'coil-body';
        if (grandParent === 'weaves' || grandParent === 'weave-body') return 'weave-body';
        return key;
      }
    }
  }
  return 'root';
}

export function getEnclosingPropertyBlock(cm, pos) {
  const lineCount = cm.lineCount();
  let l = pos.line;
  while (l >= 0 && !cm.getLine(l).trim()) l--;
  if (l < 0) return null;

  let line = cm.getLine(l);
  let indent = getLineIndent(line);

  const isBlockHeader = (str) => /^\s*-\s+/.test(str) || /^\s*[_a-zA-Z0-9]+(?:\s*\(.*?\))?\s*:/i.test(str);

  let blockStart = l;
  let baseIndent = indent;

  if (!isBlockHeader(line)) {
    for (let p = l - 1; p >= 0; p--) {
      const pLine = cm.getLine(p);
      if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
      const pIndent = getLineIndent(pLine);
      if (pIndent < baseIndent && isBlockHeader(pLine)) {
        blockStart = p;
        baseIndent = pIndent;
        break;
      }
    }
  }

  let blockEnd = blockStart;
  for (let n = blockStart + 1; n < lineCount; n++) {
    const nLine = cm.getLine(n);
    if (!nLine.trim() || /^\s*#/.test(nLine)) {
      let nextNonEmpty = n + 1;
      while (nextNonEmpty < lineCount && !cm.getLine(nextNonEmpty).trim()) nextNonEmpty++;
      if (nextNonEmpty < lineCount && getLineIndent(cm.getLine(nextNonEmpty)) > baseIndent) {
        blockEnd = nextNonEmpty;
        n = nextNonEmpty;
        continue;
      }
      break;
    }
    const nIndent = getLineIndent(nLine);
    if (nIndent > baseIndent) {
      blockEnd = n;
    } else {
      break;
    }
  }

  let parentStart = 0;
  let parentIndent = -1;
  for (let p = blockStart - 1; p >= 0; p--) {
    const pLine = cm.getLine(p);
    if (!pLine.trim() || /^\s*#/.test(pLine)) continue;
    const pIndent = getLineIndent(pLine);
    if (pIndent < baseIndent) {
      parentStart = p;
      parentIndent = pIndent;
      break;
    }
  }

  let parentEnd = lineCount - 1;
  for (let n = blockEnd + 1; n < lineCount; n++) {
    const nLine = cm.getLine(n);
    if (!nLine.trim() || /^\s*#/.test(nLine)) continue;
    const nIndent = getLineIndent(nLine);
    if (parentIndent >= 0 && nIndent <= parentIndent) {
      parentEnd = n - 1;
      break;
    }
  }

  return {
    startLine: blockStart,
    endLine: blockEnd,
    baseIndent,
    parentStart,
    parentEnd,
    parentIndent,
  };
}

export function getEnclosingCoilAtPos(cm, pos) {
  const lineCount = cm.lineCount();
  const curLine = pos.line;

  for (let l = curLine; l >= 0; l--) {
    const lineText = cm.getLine(l);
    if (!lineText || /^\s*#/.test(lineText)) continue;

    const childMatch = lineText.match(/^(\s*)-\s+coil\s*:\s*$/i);
    if (childMatch) {
      let coilId = null;
      let startLine = l;
      let baseIndent = childMatch[1].length;

      for (let s = l + 1; s < lineCount; s++) {
        const sLine = cm.getLine(s);
        if (!sLine || !sLine.trim() || /^\s*#/.test(sLine)) continue;
        const sIndent = (sLine.match(/^(\s*)/) || [''])[0].length;
        if (sIndent <= baseIndent) break;

        const idM = sLine.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
        if (idM) {
          coilId = idM[1];
          break;
        }
      }

      let endLine = l;
      for (let e = l + 1; e < lineCount; e++) {
        const eLine = cm.getLine(e);
        if (!eLine.trim() || /^\s*#/.test(eLine)) continue;
        const eIndent = (eLine.match(/^(\s*)/) || [''])[0].length;
        if (eIndent > baseIndent) {
          endLine = e;
        } else {
          break;
        }
      }

      if (curLine >= startLine && curLine <= endLine) {
        return {
          type: 'inline-child',
          coilId,
          startLine,
          endLine,
          indent: baseIndent,
        };
      }
    }

    const dictMatch = lineText.match(/^(\s*)([_a-zA-Z0-9]+)\s*:\s*$/);
    if (dictMatch) {
      const key = dictMatch[2];
      const baseIndent = dictMatch[1].length;
      if (!RESERVED_SCHEMA_KEYS.has(key.toLowerCase())) {
        const parentSec = findParentSection(cm, l);
        if (parentSec === 'coils' || parentSec === 'root') {
          let endLine = l;
          for (let e = l + 1; e < lineCount; e++) {
            const eLine = cm.getLine(e);
            if (!eLine.trim() || /^\s*#/.test(eLine)) continue;
            const eIndent = (eLine.match(/^(\s*)/) || [''])[0].length;
            if (eIndent > baseIndent) {
              endLine = e;
            } else {
              break;
            }
          }
          if (curLine >= l && curLine <= endLine) {
            return {
              type: 'dictionary',
              coilId: key,
              startLine: l,
              endLine,
              indent: baseIndent,
            };
          }
        }
      }
    }
  }

  return null;
}

export function findDefinitionInYaml(yamlText, targetId) {
  if (!yamlText || !targetId) return null;
  const lines = yamlText.split('\n');

  const dictRegex = new RegExp(`^(\\s*)(${targetId})\\s*:(?!\\s*\\[)`);
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const match = line.match(dictRegex);
    if (match) {
      const col = match[1].length;
      return { line: l, col, text: line };
    }
  }

  const inlineRegex = new RegExp(`^(\\s*)id\\s*:\\s*["']?${targetId}["']?\\b`);
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const match = line.match(inlineRegex);
    if (match) {
      const col = line.indexOf(targetId);
      return { line: l, col: col >= 0 ? col : match[1].length, text: line };
    }
  }

  return null;
}

export function getTargetIdAtPos(cm, pos) {
  const lineText = cm.getLine(pos.line) || '';
  const ch = pos.ch;

  const idRegex = /([_a-zA-Z0-9]+)/g;
  let match;
  while ((match = idRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (ch >= start && ch <= end) {
      const word = match[0];
      if (RESERVED_SCHEMA_KEYS.has(word.toLowerCase())) {
        return null;
      }
      const before = lineText.slice(0, start).trimEnd();
      if (
        before.endsWith('parents:') ||
        before.endsWith('parent:') ||
        before.endsWith('coil:') ||
        before.endsWith('weave:') ||
        before.endsWith('concat:') ||
        before.endsWith('use:') ||
        before.endsWith('from:') ||
        before.endsWith('-') ||
        before.endsWith('[') ||
        before.endsWith(',')
      ) {
        return {
          id: word,
          range: {
            from: { line: pos.line, ch: start },
            to: { line: pos.line, ch: end },
          },
        };
      }

      if (declaredIdsCache.has(word)) {
        return {
          id: word,
          range: {
            from: { line: pos.line, ch: start },
            to: { line: pos.line, ch: end },
          },
        };
      }
    }
  }
  return null;
}

export function extractTokensFromLine(lineText) {
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
    const startCh = offset + tm.index;
    const endCh = offset + tm.index + raw.length;
    tokens.push({
      word: raw,
      token: raw,
      startCh,
      endCh,
      start: startCh,
      end: endCh,
    });
  }
  return tokens;
}

export function findYamlTarget(yamlText, coilId, onsetIndex, targetLayer = 'melody', voiceIndex = 1, parentChain = []) {
  if (!yamlText) return null;
  const lines = yamlText.split('\n');

  const coilsToSearch = [coilId, ...(parentChain || [])].filter(Boolean);
  let coilLine = -1;

  for (const targetCoil of coilsToSearch) {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const match = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
      if (match && match[2] === targetCoil) {
        coilLine = l;
        break;
      }
      const inlineMatch = line.match(/^\s*-\s*coil:\s*$/);
      if (inlineMatch && l + 1 < lines.length) {
        const nextLine = lines[l + 1];
        if (nextLine.includes(`id: ${targetCoil}`) || nextLine.includes(`id: "${targetCoil}"`)) {
          coilLine = l;
          break;
        }
      }
    }
    if (coilLine !== -1) break;
  }

  if (coilLine === -1) {
    return { line: 0, col: 0, length: 0 };
  }

  const baseIndent = getLineIndent(lines[coilLine]);
  let targetLine = coilLine;
  let targetCol = 0;
  let targetLength = 0;

  const targetKey = targetLayer === 'harmony' ? 'harmony' : targetLayer === 'rhythm' ? 'rhythm' : 'melody';

  for (let l = coilLine + 1; l < lines.length; l++) {
    const line = lines[l];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = getLineIndent(line);
    if (indent <= baseIndent && /^\s*[_a-zA-Z0-9]+:/.test(line)) break;

    const layerMatch = line.match(new RegExp(`^\\s*${targetKey}\\s*:`, 'i'));
    if (layerMatch) {
      targetLine = l;
      const tokens = extractTokensFromLine(line);
      if (tokens.length > 0) {
        const idx = Math.max(0, (typeof onsetIndex === 'number' ? onsetIndex - 1 : 0));
        const tokenObj = tokens[Math.min(idx, tokens.length - 1)];
        if (tokenObj) {
          targetCol = tokenObj.start;
          targetLength = tokenObj.end - tokenObj.start;
        }
      }
      break;
    }
  }

  return { line: targetLine, col: targetCol, targetLine, targetCh: targetCol, length: targetLength };
}

export function resolveTagFromLyLine(lyLineNum, onsets, sidecarMap, lilypondSource) {
  if (!lilypondSource) return null;
  const lyLines = lilypondSource.split('\n');
  const targetLineIdx = lyLineNum - 1;

  for (let l = targetLineIdx; l >= Math.max(0, targetLineIdx - 15); l--) {
    const line = lyLines[l] || '';
    const tagMatch = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      const fullTag = tagMatch[1];
      if (sidecarMap && sidecarMap[fullTag]) {
        return { tag: fullTag, ...sidecarMap[fullTag] };
      }
    }
  }

  for (let l = targetLineIdx; l < Math.min(lyLines.length, targetLineIdx + 15); l++) {
    const line = lyLines[l] || '';
    const tagMatch = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      const fullTag = tagMatch[1];
      if (sidecarMap && sidecarMap[fullTag]) {
        return { tag: fullTag, ...sidecarMap[fullTag] };
      }
    }
  }

  return null;
}
