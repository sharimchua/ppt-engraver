/**
 * Bidirectional Real-Time Score Highlighting (Editor -> Sheet Music Noteheads)
 */

import { extractTokensFromLine } from '../core/ast-scanner.js';

let highlightAnimFrame = null;

const EXCLUDED_KEYS = new Set([
  'tapestry', 'knot', 'engraving', 'weaves', 'coils', 'children', 'stitch', 'stitches',
  'melody', 'rhythm', 'harmony', 'chords', 'pitches', 'concat',
  'parents', 'show', 'song', 'title', 'composer', 'arranger',
  'tempo', 'tonic', 'colorNotes', 'omitStem', 'octave', 'meter',
  'duration', 'harmonyOctave', 'harmonyClef', 'melodyClef',
  'voice', 'voices', 'harmonyStaffStyle', 'showHarmonyCoil',
  'showTraditionalHarmony', 'harmonyChangesOnly', 'color',
  'harmonyVoicing', 'melodyAugmentation', 'melodyAugmentationDisplay',
  'projection'
]);

export function updateScoreHighlights(cm) {
  if (!cm) return;
  if (highlightAnimFrame) {
    cancelAnimationFrame(highlightAnimFrame);
  }

  highlightAnimFrame = requestAnimationFrame(() => {
    const cur = cm.getCursor();
    const doc = cm.getDoc();
    const currentLineNum = cur.line;
    const currentLine = cm.getLine(currentLineNum) || '';
    const yamlText = doc.getValue();
    const lines = yamlText.split('\n');

    const scoreSvgContainer = document.getElementById('score-svg-container');
    if (!scoreSvgContainer) return;

    const previewElements = scoreSvgContainer.querySelectorAll('.pdf-point-click-link, a[data-tag]');
    if (!previewElements || previewElements.length === 0) return;

    const trimmed = currentLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      previewElements.forEach(el => {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      });
      return;
    }

    let declarativeLayer = null;
    let targetVoiceIndex = null;

    if (/^\s*(?:-\s*)?(?:melody|pitches)\s*:/i.test(currentLine)) {
      declarativeLayer = 'melody';
      const afterColon = currentLine.slice(currentLine.indexOf(':') + 1).trim();
      if (afterColon.startsWith('[')) {
        targetVoiceIndex = 1;
      }
    } else if (/^\s*(?:-\s*)?(?:harmony|chords)\s*:/i.test(currentLine)) {
      declarativeLayer = 'harmony';
    } else if (/^\s*(?:-\s*)?rhythm\s*:/i.test(currentLine)) {
      let isUnderHarmony = false;
      const curIndent = (currentLine.match(/^\s*/) || [''])[0].length;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 20); l--) {
        const prevL = lines[l];
        const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
        if (/^\s*harmony\s*:/i.test(prevL) && prevIndent < curIndent) {
          isUnderHarmony = true;
          break;
        }
        if (prevIndent < curIndent && /^\s*[_a-zA-Z0-9]+\s*:/.test(prevL)) break;
      }
      declarativeLayer = isUnderHarmony ? 'harmony' : 'rhythm';
    }

    if (!declarativeLayer && /^\s*-\s+/.test(currentLine)) {
      let bulletIndex = 1;
      const curLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 40); l--) {
        const prevL = lines[l];
        const prevIndent = (prevL.match(/^\s*/) || [''])[0].length;
        if (/^\s*-\s+/.test(prevL) && prevIndent === curLineIndent) {
          bulletIndex++;
        } else if (/^\s*(?:melody|pitches)\s*:/i.test(prevL)) {
          declarativeLayer = 'melody';
          targetVoiceIndex = bulletIndex;
          break;
        } else if (/^\s*rhythm\s*:/i.test(prevL)) {
          declarativeLayer = 'rhythm';
          break;
        } else if (/^\s*(?:harmony|chords)\s*:/i.test(prevL)) {
          declarativeLayer = 'harmony';
          break;
        } else if (/^\s*[a-zA-Z0-9_]+\s*:/i.test(prevL) && !/^\s*-\s+/.test(prevL) && prevIndent < curLineIndent) {
          break;
        }
      }
    } else if (!declarativeLayer && /^\s*chords\s*:/i.test(currentLine)) {
      declarativeLayer = 'harmony';
    } else if (!declarativeLayer && /^\s*pitches\s*:/i.test(currentLine)) {
      declarativeLayer = 'melody';
      let bulletIndex = 1;
      for (let l = currentLineNum - 1; l >= Math.max(0, currentLineNum - 40); l--) {
        const prevL = lines[l];
        if (/^\s*melody\s*:/i.test(prevL)) {
          targetVoiceIndex = bulletIndex;
          break;
        }
      }
    }

    if (declarativeLayer) {
      let enclosingCoil = null;
      let inlineSubIndex = null;
      let inlineChildIndex = null;
      let isInsideConcat = false;
      let isInsideChildren = false;

      const currentLineIndent = (currentLine.match(/^\s*/) || [''])[0].length;

      for (let l = currentLineNum - 1; l >= 0; l--) {
        const lText = lines[l];
        const lIndent = (lText.match(/^\s*/) || [''])[0].length;

        if (/^\s*concat\s*:/i.test(lText) && lIndent < currentLineIndent) {
          isInsideConcat = true;
          let subCount = 0;
          for (let sL = l + 1; sL <= currentLineNum; sL++) {
            if (/^\s*-\s*/.test(lines[sL])) {
              subCount++;
            }
          }
          inlineSubIndex = subCount || 1;
        } else if (/^\s*(children|stitch|stitches)\s*:/i.test(lText) && lIndent < currentLineIndent) {
          isInsideChildren = true;
          let childCount = 0;
          for (let cL = l + 1; cL <= currentLineNum; cL++) {
            if (/^\s*-\s*/.test(lines[cL])) {
              childCount++;
            }
          }
          inlineChildIndex = childCount || 1;
        }

        const idMatch = lText.match(/^\s*id\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (idMatch) { enclosingCoil = idMatch[1]; break; }
        const coilRefMatch = lText.match(/^\s*-\s*coil\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
        if (coilRefMatch) { enclosingCoil = coilRefMatch[1]; break; }
        const dictMatch = lText.match(/^\s*([_a-zA-Z0-9]+)\s*:/);
        if (dictMatch && !EXCLUDED_KEYS.has(dictMatch[1].toLowerCase())) {
          enclosingCoil = dictMatch[1];
          break;
        }
      }

      if (!enclosingCoil) {
        previewElements.forEach(el => {
          el.classList.remove('score-highlight-active', 'score-highlight-primary');
        });
        return;
      }

      const inlineSubCoilId = (isInsideConcat && inlineSubIndex !== null)
        ? `${enclosingCoil}_sub_${inlineSubIndex}`
        : null;
      const inlineChildCoilId = (isInsideChildren && inlineChildIndex !== null)
        ? `${enclosingCoil}_child_${inlineChildIndex}`
        : null;

      let targetOnsetIndex = null;
      const tokensOnLine = extractTokensFromLine(currentLine);
      for (let tIdx = 0; tIdx < tokensOnLine.length; tIdx++) {
        const tok = tokensOnLine[tIdx];
        if (cur.ch >= tok.start && cur.ch <= tok.end) {
          targetOnsetIndex = tIdx + 1;
          break;
        }
      }

      let harmonySortedUniqueOnsets = null;
      if (declarativeLayer === 'harmony') {
        const matchingElements = Array.from(previewElements).filter(el => {
          const cId = el.dataset.coilId;
          const sId = el.dataset.sourceCoilId;
          const hId = el.dataset.harmonySourceCoil;
          const isCoilMatch = (cId === enclosingCoil || sId === enclosingCoil || hId === enclosingCoil ||
                              (inlineSubCoilId && (cId === inlineSubCoilId || sId === inlineSubCoilId || hId === inlineSubCoilId)) ||
                              (inlineChildCoilId && (cId === inlineChildCoilId || sId === inlineChildCoilId || hId === inlineChildCoilId)));
          return isCoilMatch && (el.dataset.layer === 'harmony' || !el.dataset.layer);
        });

        const onsetNums = matchingElements
          .map(el => parseInt(el.dataset.sourceOnsetIndex || el.dataset.onsetIndex, 10))
          .filter(n => !isNaN(n));
        harmonySortedUniqueOnsets = Array.from(new Set(onsetNums)).sort((a, b) => a - b);
      }

      previewElements.forEach(el => {
        const cId = el.dataset.coilId;
        const sId = el.dataset.sourceCoilId;
        const mId = el.dataset.melodySourceCoil;
        const rId = el.dataset.rhythmSourceCoil;
        const hId = el.dataset.harmonySourceCoil;

        const isCoilMatch = (cId === enclosingCoil || sId === enclosingCoil ||
                            mId === enclosingCoil || rId === enclosingCoil || hId === enclosingCoil ||
                            (inlineSubCoilId && (cId === inlineSubCoilId || sId === inlineSubCoilId || mId === inlineSubCoilId || rId === inlineSubCoilId || hId === inlineSubCoilId)) ||
                            (inlineChildCoilId && (cId === inlineChildCoilId || sId === inlineChildCoilId || mId === inlineChildCoilId || rId === inlineChildCoilId || hId === inlineChildCoilId)));

        if (!isCoilMatch) {
          el.classList.remove('score-highlight-active', 'score-highlight-primary');
          return;
        }

        const elLayer = el.dataset.layer || 'melody';
        const isLayerMatch = (elLayer === declarativeLayer);
        const elVoice = parseInt(el.dataset.voiceIndex || '1', 10);
        const isVoiceMatch = (!targetVoiceIndex || elVoice === targetVoiceIndex);

        if (!isLayerMatch || !isVoiceMatch) {
          el.classList.remove('score-highlight-active', 'score-highlight-primary');
          return;
        }

        const elOnsetIndex = parseInt(el.dataset.sourceOnsetIndex || el.dataset.onsetIndex, 10);
        let isTokenMatch = false;

        if (targetOnsetIndex !== null) {
          if (declarativeLayer === 'harmony' && harmonySortedUniqueOnsets && harmonySortedUniqueOnsets.length > 0) {
            const mappedHarmOnset = harmonySortedUniqueOnsets[targetOnsetIndex - 1];
            isTokenMatch = (elOnsetIndex === mappedHarmOnset);
          } else {
            isTokenMatch = (elOnsetIndex === targetOnsetIndex);
          }
        }

        if (isTokenMatch) {
          el.classList.add('score-highlight-primary');
          el.classList.remove('score-highlight-active');
        } else {
          el.classList.add('score-highlight-active');
          el.classList.remove('score-highlight-primary');
        }
      });
      return;
    }

    // 2. Compositional structures (weaves, coils, knots)
    const targetStructures = new Set();
    const dictHeaderMatch = currentLine.match(/^\s*([_a-zA-Z0-9]+)\s*:(?!\s*\[)/);
    if (dictHeaderMatch && !EXCLUDED_KEYS.has(dictHeaderMatch[1].toLowerCase())) {
      targetStructures.add(dictHeaderMatch[1]);
    }
    const inlineIdMatch = currentLine.match(/\bid\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (inlineIdMatch) targetStructures.add(inlineIdMatch[1]);

    const refMatch = currentLine.match(/\b(?:coil|weave|parents|concat|parent)\s*:\s*["']?([_a-zA-Z0-9]+)["']?/);
    if (refMatch && !EXCLUDED_KEYS.has(refMatch[1].toLowerCase())) targetStructures.add(refMatch[1]);

    if (targetStructures.size === 0) {
      previewElements.forEach(el => {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      });
      return;
    }

    previewElements.forEach(el => {
      const cId = el.dataset.coilId;
      const sId = el.dataset.sourceCoilId;
      const mId = el.dataset.melodySourceCoil;
      const rId = el.dataset.rhythmSourceCoil;
      const hId = el.dataset.harmonySourceCoil;
      const wId = el.dataset.weaveId;

      const isMatch = (targetStructures.has(cId) || targetStructures.has(sId) ||
                       targetStructures.has(mId) || targetStructures.has(rId) ||
                       targetStructures.has(hId) || targetStructures.has(wId));

      if (isMatch) {
        el.classList.add('score-highlight-active');
        el.classList.remove('score-highlight-primary');
      } else {
        el.classList.remove('score-highlight-active', 'score-highlight-primary');
      }
    });
  });
}
