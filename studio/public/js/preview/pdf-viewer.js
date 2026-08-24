/**
 * Mozilla PDF.js Multi-Page Score Renderer & Point-and-Click Overlays
 */

import { state } from '../state.js';
import { resolveTagFromLyLine } from '../core/ast-scanner.js';
import { updateScoreHighlights } from './score-highlighter.js';

let currentPdfDoc = null;
let isRenderingPdf = false;
let shouldResetPreviewScroll = false;

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export function setResetScrollFlag(shouldReset = true) {
  shouldResetPreviewScroll = shouldReset;
}

export function getCurrentPdfDoc() {
  return currentPdfDoc;
}

export async function renderPdfPages(options = {}) {
  if (!currentPdfDoc || isRenderingPdf) return;
  isRenderingPdf = true;

  const {
    editor,
    onPointAndClick,
    sidecarMap,
    lilypondSource,
    onsets,
  } = options;

  const scoreCanvas = document.getElementById('score-canvas');
  const scoreSvgContainer = document.getElementById('score-svg-container');
  const scorePlaceholder = document.getElementById('score-placeholder');
  const zoomLevel = document.getElementById('zoom-level');

  const prevScrollTop = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollTop : 0);
  const prevScrollLeft = shouldResetPreviewScroll ? 0 : (scoreCanvas ? scoreCanvas.scrollLeft : 0);
  shouldResetPreviewScroll = false;

  try {
    if (scorePlaceholder) scorePlaceholder.style.display = 'none';
    if (scoreSvgContainer) scoreSvgContainer.innerHTML = '';

    const numPages = currentPdfDoc.numPages;
    const containerWidth = scoreCanvas ? scoreCanvas.clientWidth - 40 : 800;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await currentPdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      let scale = state.customZoomLevel || 1.0;
      if (state.zoom === 'fit') {
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

            const match = rawUrl.match(/:(\d+)(?::(\d+))?(?::(\d+))?$/);
            if (match) {
              const lyLineNum = parseInt(match[1], 10);
              const tagInfo = resolveTagFromLyLine(lyLineNum, onsets, sidecarMap, lilypondSource);
              if (tagInfo) {
                linkEl.dataset.tag = tagInfo.rawTag || '';
                linkEl.dataset.coilId = tagInfo.coilId || '';
                linkEl.dataset.sourceCoilId = tagInfo.sourceCoilId || '';
                linkEl.dataset.melodySourceCoil = tagInfo.melodySourceCoil || '';
                linkEl.dataset.rhythmSourceCoil = tagInfo.rhythmSourceCoil || '';
                linkEl.dataset.harmonySourceCoil = tagInfo.harmonySourceCoil || '';
                linkEl.dataset.weaveId = tagInfo.weaveId || '';
                linkEl.dataset.layer = tagInfo.targetLayer || '';
                linkEl.dataset.voiceIndex = String(tagInfo.voiceIndex || '1');
                linkEl.dataset.onsetIndex = String(tagInfo.onsetIndex || '');
                linkEl.dataset.sourceOnsetIndex = String(tagInfo.sourceOnsetIndex || '');
                linkEl.dataset.melodyOnsetIndex = String(tagInfo.melodyOnsetIndex || '');
              }
            }

            linkEl.addEventListener('click', (e) => {
              e.stopPropagation();
              onPointAndClick?.(rawUrl);
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

    if (zoomLevel) {
      zoomLevel.textContent = state.zoom === 'fit' ? 'Fit' : `${Math.round(state.customZoomLevel * 100)}%`;
    }

    if (editor) {
      updateScoreHighlights(editor);
    }

    if (scoreCanvas) {
      scoreCanvas.scrollTop = prevScrollTop;
      scoreCanvas.scrollLeft = prevScrollLeft;
      requestAnimationFrame(() => {
        if (scoreCanvas) {
          scoreCanvas.scrollTop = prevScrollTop;
          scoreCanvas.scrollLeft = prevScrollLeft;
        }
      });
    }
  } catch (err) {
    console.error('Error rendering PDF pages:', err);
  } finally {
    isRenderingPdf = false;
  }
}

export async function loadPdfDocFromBase64(pdfBase64) {
  if (!window.pdfjsLib) throw new Error('PDF.js not loaded');
  const binaryString = atob(pdfBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  currentPdfDoc = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  return currentPdfDoc;
}
