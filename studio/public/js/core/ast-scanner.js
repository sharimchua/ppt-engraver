/**
 * YAML Document Scanner, Token & AST Traversal Utilities
 */

import { isValidSolfegeToken } from './solfege.js';
import { pitchNameToMidi, applyModulation } from './pitch.js';

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
  'scalesignature', 'scalesignaturepianotriangle', 'keysignature', 'scale',
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

export function extractLayerFromTag(tag) {
  if (!tag) return 'melody';
  if (tag.includes('_rhythm_')) return 'rhythm';
  if (tag.includes('_pulse_')) return 'pulse';
  if (
    tag.includes('_harmony_') ||
    tag.includes('_harmCoil_') ||
    tag.includes('_harmonyStaff_') ||
    tag.includes('_chordName_') ||
    tag.includes('_chordTriangle_')
  ) {
    return 'harmony';
  }
  if (tag.includes('_tab_')) return 'melody';
  if (
    tag.includes('_melody_') ||
    tag.includes('_melodyAbs_') ||
    tag.includes('_melodyInt_')
  ) {
    return 'melody';
  }
  return 'melody';
}

export function findYamlTarget(yamlText, coilId, onsetIndex, targetLayer = 'melody', voiceIndex = 1, parentChain = []) {
  if (!yamlText) return null;
  const lines = yamlText.split('\n');

  const coilsToSearch = Array.from(
    new Set([coilId, ...(Array.isArray(parentChain) ? parentChain : [parentChain])].filter(Boolean))
  );

  const layerKeys =
    targetLayer === 'harmony'
      ? ['harmony', 'chords']
      : targetLayer === 'rhythm'
      ? ['rhythm']
      : targetLayer === 'pulse'
      ? ['pulse']
      : ['melody', 'pitches'];

  for (const targetCoil of coilsToSearch) {
    let coilStartLine = -1;
    let coilEndLine = lines.length - 1;
    let baseIndent = 0;

    // Check if targetCoil is an anonymous child like <weave>_coil_<N> or <weave>_child_<N> or <weave>_sub_<N>
    const anonymousMatch = targetCoil.match(/^(.+)_(?:coil|child|sub)_(\d+)$/);
    if (anonymousMatch) {
      const parentContainerId = anonymousMatch[1];
      const childNum = parseInt(anonymousMatch[2], 10);

      // Find parentContainerId in YAML
      let parentLine = -1;
      for (let l = 0; l < lines.length; l++) {
        const match = lines[l].match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
        if (match && match[2] === parentContainerId) {
          parentLine = l;
          break;
        }
      }

      if (parentLine !== -1) {
        const pIndent = getLineIndent(lines[parentLine]);
        let currentChild = 0;
        let directChildIndent = -1;
        for (let l = parentLine + 1; l < lines.length; l++) {
          const line = lines[l];
          if (!line.trim() || /^\s*#/.test(line)) continue;
          const indent = getLineIndent(line);
          if (indent <= pIndent && /^\s*[_a-zA-Z0-9]+:/.test(line)) break;

          if (/^\s*-\s*(?:coil\s*:\s*$|coil\s*:\s*\{|\s*$)/i.test(line) || /^\s*-\s+coil\s*:/i.test(line)) {
            if (directChildIndent === -1) directChildIndent = indent;
            if (indent === directChildIndent) {
              currentChild++;
              if (currentChild === childNum) {
                coilStartLine = l;
                baseIndent = indent;
                for (let e = l + 1; e < lines.length; e++) {
                  const eLine = lines[e];
                  if (!eLine.trim() || /^\s*#/.test(eLine)) continue;
                  const eIndent = getLineIndent(eLine);
                  if (eIndent <= baseIndent) {
                    coilEndLine = e - 1;
                    break;
                  }
                }
                break;
              }
            }
          }
        }
      }
    }

    if (coilStartLine === -1) {
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        const match = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
        if (match && match[2] === targetCoil) {
          coilStartLine = l;
          baseIndent = getLineIndent(line);
          for (let e = l + 1; e < lines.length; e++) {
            const eLine = lines[e];
            if (!eLine.trim() || /^\s*#/.test(eLine)) continue;
            const eIndent = getLineIndent(eLine);
            if (eIndent <= baseIndent) {
              coilEndLine = e - 1;
              break;
            }
          }
          break;
        }
        const inlineMatch = line.match(/^\s*-\s*coil:\s*$/);
        if (inlineMatch && l + 1 < lines.length) {
          const nextLine = lines[l + 1];
          if (nextLine.includes(`id: ${targetCoil}`) || nextLine.includes(`id: "${targetCoil}"`)) {
            coilStartLine = l;
            baseIndent = getLineIndent(line);
            for (let e = l + 1; e < lines.length; e++) {
              const eLine = lines[e];
              if (!eLine.trim() || /^\s*#/.test(eLine)) continue;
              const eIndent = getLineIndent(eLine);
              if (eIndent <= baseIndent) {
                coilEndLine = e - 1;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (coilStartLine === -1) continue;

    let targetLine = coilStartLine;
    let targetCol = 0;
    let targetLength = 0;
    let foundLayer = false;

    for (let l = coilStartLine; l <= coilEndLine; l++) {
      const line = lines[l];
      if (!line.trim() || /^\s*#/.test(line)) continue;

      const matchedKey = layerKeys.find(k => new RegExp(`(?:^|\\s)(?:-\\s*)?${k}\\s*:`, 'i').test(line));
      if (matchedKey) {
        targetLine = l;
        foundLayer = true;

        if (targetLayer === 'melody' && voiceIndex > 1) {
          let vCount = 0;
          for (let vL = l + 1; vL <= coilEndLine; vL++) {
            const vLine = lines[vL];
            const vIndent = getLineIndent(vLine);
            if (vIndent <= getLineIndent(line)) break;
            if (/^\s*-\s+/.test(vLine)) {
              vCount++;
              if (vCount === voiceIndex) {
                targetLine = vL;
                break;
              }
            }
          }
        } else if (targetLayer === 'harmony') {
          const afterColon = line.slice(line.indexOf(':') + 1).trim();
          if (!afterColon) {
            for (let hL = l + 1; hL <= coilEndLine; hL++) {
              const hLine = lines[hL];
              const hIndent = getLineIndent(hLine);
              if (hIndent <= getLineIndent(line)) break;
              if (/^\s*chords\s*:/i.test(hLine)) {
                targetLine = hL;
                break;
              }
            }
          }
        }

        const targetLineText = lines[targetLine];
        const tokens = extractTokensFromLine(targetLineText);
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

    if (foundLayer) {
      return { line: targetLine, col: targetCol, targetLine, targetCh: targetCol, length: targetLength };
    }
  }

  // Fallback to first matched coil header
  if (coilsToSearch.length > 0) {
    for (const targetCoil of coilsToSearch) {
      for (let l = 0; l < lines.length; l++) {
        const match = lines[l].match(/^(\s*)([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
        if (match && match[2] === targetCoil) {
          return { line: l, col: 0, targetLine: l, targetCh: 0, length: 0 };
        }
      }
    }
  }

  return { line: 0, col: 0, targetLine: 0, targetCh: 0, length: 0 };
}

export function resolveTagFromLyLine(lyLineNum, onsets, sidecarMap, lilypondSource) {
  if (!lilypondSource) return null;
  const lyLines = lilypondSource.split('\n');
  const targetLineIdx = lyLineNum - 1;

  let fullTag = null;
  for (let l = targetLineIdx; l >= Math.max(0, targetLineIdx - 15); l--) {
    const line = lyLines[l] || '';
    const tagMatch = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_-]+)/);
    if (tagMatch) {
      fullTag = tagMatch[1];
      break;
    }
  }

  if (!fullTag) {
    for (let l = targetLineIdx; l < Math.min(lyLines.length, targetLineIdx + 15); l++) {
      const line = lyLines[l] || '';
      const tagMatch = line.match(/\\tag\s*#'(ppt_[a-zA-Z0-9_-]+)/);
      if (tagMatch) {
        fullTag = tagMatch[1];
        break;
      }
    }
  }

  if (!fullTag) return null;

  const targetLayer = extractLayerFromTag(fullTag);
  const voiceMatch = fullTag.match(/_v(\d+)_/);
  const tagVoiceIndex = voiceMatch ? parseInt(voiceMatch[1], 10) : 1;
  const onsetMatch = fullTag.match(/_(\d+)$/);
  const tagOnsetIndex = onsetMatch ? parseInt(onsetMatch[1], 10) : 1;

  const sidecarEntry = sidecarMap ? sidecarMap[fullTag] : null;

  if (sidecarEntry) {
    return {
      ...sidecarEntry,
      tag: fullTag,
      rawTag: fullTag,
      targetLayer,
      voiceIndex: sidecarEntry.voiceIndex || tagVoiceIndex,
    };
  }

  return {
    tag: fullTag,
    rawTag: fullTag,
    targetLayer,
    voiceIndex: tagVoiceIndex,
    onsetIndex: tagOnsetIndex,
  };
}

/**
 * Detects the immediate scope (enclosing weave, enclosing coil, and inferred tonic)
 * at the current cursor position in CodeMirror.
 *
 * @param {object|string} cm - CodeMirror instance or YAML text string
 * @param {object|number} pos - Cursor { line, ch } or line number
 * @param {object|null} [compiledData=null] - Optional compile result containing onsets/knot
 * @param {string} [fallbackKnotTonic='C4'] - Default fallback tonic if not found
 * @returns {{ weaveId: string|null, coilId: string|null, inferredTonic: string, inferredTonicMidi: number, lineNum: number }}
 */
export function getScopeAtCursor(cm, pos, compiledData = null, fallbackKnotTonic = 'C4') {
  if (!cm) {
    return {
      weaveId: null,
      coilId: null,
      inferredTonic: fallbackKnotTonic,
      inferredTonicMidi: 60,
      lineNum: 0,
    };
  }

  const curLine = typeof pos === 'number' ? pos : (pos && typeof pos.line === 'number' ? pos.line : 0);
  const lineCount = cm.lineCount ? cm.lineCount() : (typeof cm === 'string' ? cm.split('\n').length : 0);
  const getLine = (l) => cm.getLine ? cm.getLine(l) : (typeof cm === 'string' ? cm.split('\n')[l] : '');

  let weaveId = null;
  let coilId = null;

  // 1. Detect if cursor is inside an inline stitch coil or dictionary coil
  let inlineCoilStart = -1;
  let inlineCoilIndent = -1;
  let inlineCoilId = null;

  for (let l = curLine; l >= 0; l--) {
    const line = getLine(l);
    if (!line || /^\s*#/.test(line)) continue;

    // Check for inline coil: "- coil:"
    const inlineMatch = line.match(/^(\s*)-\s+coil\s*:\s*(.*)$/i);
    if (inlineMatch) {
      inlineCoilStart = l;
      inlineCoilIndent = inlineMatch[1].length;
      const rest = inlineMatch[2].trim();
      const inlineNamed = rest.match(/^([_a-zA-Z0-9]+)$/);
      if (inlineNamed && !RESERVED_SCHEMA_KEYS.has(inlineNamed[1].toLowerCase())) {
        inlineCoilId = inlineNamed[1];
      } else {
        const idMatch = rest.match(/id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
        if (idMatch) inlineCoilId = idMatch[1];
      }

      // If ID not on same line, look forward within coil block
      if (!inlineCoilId) {
        for (let s = l + 1; s < lineCount; s++) {
          const sLine = getLine(s);
          if (!sLine || !sLine.trim() || /^\s*#/.test(sLine)) continue;
          const sIndent = getLineIndent(sLine);
          if (sIndent <= inlineCoilIndent) break;
          const idM = sLine.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/i);
          if (idM) {
            inlineCoilId = idM[1];
            break;
          }
        }
      }
      break;
    }

    // Check for dictionary coil or weave definition
    const dictMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:\s*$/);
    if (dictMatch) {
      const key = dictMatch[2];
      if (!RESERVED_SCHEMA_KEYS.has(key.toLowerCase())) {
        const parentSec = findParentSection(cm, l);
        if (parentSec === 'coils') {
          coilId = key;
          break;
        } else if (parentSec === 'weaves') {
          weaveId = key;
          break;
        }
      }
    }
  }

  // 2. If inside an inline coil, find enclosing weave
  if (inlineCoilStart !== -1) {
    let stitchIndent = -1;
    let weaveIndent = -1;

    for (let l = inlineCoilStart - 1; l >= 0; l--) {
      const line = getLine(l);
      if (!line || /^\s*#/.test(line)) continue;
      const indent = getLineIndent(line);

      if (indent < inlineCoilIndent) {
        if (/^\s*(?:stitch|stitches|children)\s*:/i.test(line)) {
          stitchIndent = indent;
        } else if (stitchIndent !== -1 && indent < stitchIndent) {
          const wMatch = line.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
          if (wMatch && !RESERVED_SCHEMA_KEYS.has(wMatch[1].toLowerCase())) {
            weaveId = wMatch[1];
            weaveIndent = indent;
            break;
          }
        } else if (stitchIndent === -1) {
          const wMatch = line.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
          if (wMatch && !RESERVED_SCHEMA_KEYS.has(wMatch[1].toLowerCase())) {
            const sec = findParentSection(cm, l);
            if (sec === 'weaves') {
              weaveId = wMatch[1];
              break;
            }
          }
        }
      }
    }

    if (inlineCoilId) {
      coilId = inlineCoilId;
    } else if (weaveId) {
      // Calculate 1-based index of this inline coil in this weave
      let coilIndex = 1;
      for (let l = inlineCoilStart - 1; l >= 0; l--) {
        const line = getLine(l);
        if (!line) continue;
        const indent = getLineIndent(line);
        if (weaveIndent !== -1 && indent <= weaveIndent) break;
        if (/^\s*-\s+coil\s*:/i.test(line) && indent === inlineCoilIndent) {
          coilIndex++;
        }
      }
      coilId = `${weaveId}_coil_${coilIndex}`;
    }
  }

  // 3. If coilId is known from coils: dictionary, find which weave references it
  if (coilId && !weaveId) {
    if (compiledData?.onsets && Array.isArray(compiledData.onsets)) {
      const matchingOnset = compiledData.onsets.find(o =>
        o.sourceCoilId === coilId || o.melodySourceCoil === coilId || o.harmonySourceCoil === coilId || o.coilId === coilId
      );
      if (matchingOnset && matchingOnset.weaveId) {
        weaveId = matchingOnset.weaveId;
      }
    }

    if (!weaveId) {
      const fullText = cm.getValue ? cm.getValue() : (typeof cm === 'string' ? cm : '');
      const lines = fullText.split('\n');
      let currentScanWeave = null;
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        const wMatch = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:/);
        if (wMatch && !RESERVED_SCHEMA_KEYS.has(wMatch[2].toLowerCase())) {
          const sec = findParentSection(cm, l);
          if (sec === 'weaves') {
            currentScanWeave = wMatch[2];
          }
        }
        if (currentScanWeave && line.includes(coilId)) {
          weaveId = currentScanWeave;
          break;
        }
      }
    }
  }

  // 4. Resolve Inferred Tonic
  let inferredTonic = null;
  let inferredTonicMidi = null;

  // Attempt 1: From compiled onsets
  if (compiledData?.onsets && Array.isArray(compiledData.onsets)) {
    if (coilId) {
      const match = compiledData.onsets.find(o =>
        o.sourceCoilId === coilId || o.melodySourceCoil === coilId || o.harmonySourceCoil === coilId || o.coilId === coilId
      );
      if (match && match.tonic) {
        inferredTonic = match.tonic;
        inferredTonicMidi = match.tonicMidi ?? (pitchNameToMidi ? pitchNameToMidi(match.tonic) : 60);
      }
    }
    if (!inferredTonic && weaveId) {
      const match = compiledData.onsets.find(o => o.weaveId === weaveId && o.tonic);
      if (match && match.tonic) {
        inferredTonic = match.tonic;
        inferredTonicMidi = match.tonicMidi ?? (pitchNameToMidi ? pitchNameToMidi(match.tonic) : 60);
      }
    }
  }

  // Attempt 2: Read from compiled knot
  if (!inferredTonic && compiledData?.knot) {
    const knotTonic = compiledData.knot.tonicName || compiledData.knot.doName;
    if (knotTonic) {
      inferredTonic = knotTonic;
      inferredTonicMidi = compiledData.knot.tonicMidi || compiledData.knot.doMidi;
    }
  }

  // Attempt 3: AST calculation from YAML text
  if (!inferredTonic) {
    const fullText = cm.getValue ? cm.getValue() : (typeof cm === 'string' ? cm : '');
    let baseTonic = fallbackKnotTonic || 'C4';
    const knotMatch = fullText.match(/^\s*tonic\s*:\s*["']?([A-G](?:#|b|♭)?\d+)["']?/m);
    if (knotMatch) {
      baseTonic = knotMatch[1];
    }

    let baseMidi = 60;
    try {
      baseMidi = pitchNameToMidi(baseTonic);
    } catch {
      baseMidi = 60;
    }

    if (weaveId) {
      const allLines = fullText.split('\n');
      let weaveLineIdx = -1;
      let weaveIndent = -1;

      for (let l = 0; l < allLines.length; l++) {
        const line = allLines[l];
        const m = line.match(/^(\s*)([_a-zA-Z0-9]+)\s*:/);
        if (m && m[2] === weaveId) {
          weaveLineIdx = l;
          weaveIndent = m[1].length;
          break;
        }
      }

      if (weaveLineIdx !== -1) {
        let modSpec = null;
        let tonicSpec = null;

        for (let l = weaveLineIdx + 1; l < allLines.length; l++) {
          const line = allLines[l];
          if (!line.trim() || /^\s*#/.test(line)) continue;
          const indent = getLineIndent(line);
          if (indent <= weaveIndent) break;

          const modM = line.match(/^\s*modulate\s*:\s*["']?([^\s\r\n,"'\}]+)["']?/i);
          if (modM && !modSpec) modSpec = modM[1];

          const tonicM = line.match(/^\s*tonic\s*:\s*["']?([A-G](?:#|b|♭)?\d+)["']?/i);
          if (tonicM && !tonicSpec) tonicSpec = tonicM[1];
        }

        if (tonicSpec) {
          inferredTonic = tonicSpec;
          try { inferredTonicMidi = pitchNameToMidi(inferredTonic); } catch { inferredTonicMidi = 60; }
        } else if (modSpec) {
          try {
            const modRes = applyModulation(baseMidi, 'sharps', modSpec);
            inferredTonic = modRes.tonicName;
            inferredTonicMidi = modRes.tonicMidi;
          } catch {
            inferredTonic = baseTonic;
            inferredTonicMidi = baseMidi;
          }
        }
      }
    }

    if (!inferredTonic) {
      inferredTonic = baseTonic;
      inferredTonicMidi = baseMidi;
    }
  }

  return {
    weaveId,
    coilId,
    inferredTonic,
    inferredTonicMidi: inferredTonicMidi ?? 60,
    lineNum: curLine,
  };
}
