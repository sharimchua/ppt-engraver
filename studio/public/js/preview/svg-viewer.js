/**
 * SVG Score Rendering and Point-and-Click Handler
 */

import { resolveTagFromLyLine } from '../core/ast-scanner.js';
import { updateScoreHighlights } from './score-highlighter.js';

export function renderSvgScore(svgString, options = {}) {
  const { editor, onPointAndClick, onsets, sidecarMap, lilypondSource } = options;
  const scorePlaceholder = document.getElementById('score-placeholder');
  const scoreSvgContainer = document.getElementById('score-svg-container');

  if (scorePlaceholder) scorePlaceholder.style.display = 'none';
  if (scoreSvgContainer) {
    scoreSvgContainer.innerHTML = svgString;

    const svgLinks = scoreSvgContainer.querySelectorAll('a');
    svgLinks.forEach(link => {
      const href = link.getAttribute('xlink:href') || link.getAttribute('href');
      if (href && (href.startsWith('textedit:') || href.includes('textedit'))) {
        const match = href.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
        if (match) {
          const lyLineNum = parseInt(match[1], 10);
          const tagInfo = resolveTagFromLyLine(lyLineNum, onsets, sidecarMap, lilypondSource);
          if (tagInfo) {
            link.dataset.tag = tagInfo.rawTag || '';
            link.dataset.coilId = tagInfo.coilId || '';
            link.dataset.sourceCoilId = tagInfo.sourceCoilId || '';
            link.dataset.melodySourceCoil = tagInfo.melodySourceCoil || '';
            link.dataset.rhythmSourceCoil = tagInfo.rhythmSourceCoil || '';
            link.dataset.harmonySourceCoil = tagInfo.harmonySourceCoil || '';
            link.dataset.weaveId = tagInfo.weaveId || '';
            link.dataset.layer = tagInfo.targetLayer || '';
            link.dataset.voiceIndex = String(tagInfo.voiceIndex || '1');
            link.dataset.onsetIndex = String(tagInfo.onsetIndex || '');
            link.dataset.sourceOnsetIndex = String(tagInfo.sourceOnsetIndex || '');
            link.dataset.melodyOnsetIndex = String(tagInfo.melodyOnsetIndex || '');
          }
        }
      }
    });

    if (editor) {
      updateScoreHighlights(editor);
    }
  }
}

export function setupSvgClickListener(container, onPointAndClick) {
  container.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
      const href = link.getAttribute('xlink:href') || link.getAttribute('href');
      if (href && (href.startsWith('textedit://') || href.includes('textedit'))) {
        e.preventDefault();
        onPointAndClick?.(href);
      }
    }
  });
}
