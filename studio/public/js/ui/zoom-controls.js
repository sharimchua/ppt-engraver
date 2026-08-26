/**
 * Zoom Controls: Zoom In, Zoom Out, Reset, and Fit-to-Width
 */

import { state } from '../state.js';
import { getCurrentPdfDoc, renderPdfPages } from '../preview/pdf-viewer.js';

export function setupZoomControls(options = {}) {
  const { getEditor, onPointAndClick, getLastCompiledData } = options;

  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const zoomLevel = document.getElementById('zoom-level');
  const scoreCanvas = document.getElementById('score-canvas');
  const scoreSvgContainer = document.getElementById('score-svg-container');

  function applySvgZoom() {
    if (scoreSvgContainer) {
      scoreSvgContainer.style.transform = `scale(${state.customZoomLevel})`;
    }
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(state.customZoomLevel * 100)}%`;
    }
  }

  function triggerRender() {
    const pdfDoc = getCurrentPdfDoc();
    const compiledData = getLastCompiledData?.() || {};
    if (pdfDoc) {
      renderPdfPages({
        editor: getEditor?.(),
        onPointAndClick,
        sidecarMap: compiledData.sidecarMap,
        lilypondSource: compiledData.lilypondSource,
        onsets: compiledData.onsets,
      });
    } else {
      applySvgZoom();
    }
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      state.zoom = 'percent';
      state.customZoomLevel = Math.min(state.customZoomLevel + 0.15, 3.0);
      triggerRender();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      state.zoom = 'percent';
      state.customZoomLevel = Math.max(state.customZoomLevel - 0.15, 0.3);
      triggerRender();
    });
  }

  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      state.zoom = 'percent';
      state.customZoomLevel = 1.0;
      triggerRender();
    });
  }

  if (btnZoomFit) {
    btnZoomFit.addEventListener('click', () => {
      state.zoom = 'fit';
      const pdfDoc = getCurrentPdfDoc();
      if (pdfDoc) {
        triggerRender();
      } else if (scoreCanvas && scoreSvgContainer) {
        const containerWidth = scoreCanvas.clientWidth - 48;
        const svgElem = scoreSvgContainer.querySelector('svg');
        if (svgElem) {
          const svgWidth = svgElem.clientWidth || svgElem.getBoundingClientRect().width || 800;
          state.customZoomLevel = Math.min(Math.max(containerWidth / svgWidth, 0.4), 2.0);
          applySvgZoom();
        }
      }
    });
  }

  window.addEventListener('resize', () => {
    if (state.zoom === 'fit' && getCurrentPdfDoc()) {
      triggerRender();
    }
  });
}
