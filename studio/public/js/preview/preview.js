/**
 * Preview Panel Coordinator & Viewport State Manager
 */

import { state, events } from '../state.js';
import { loadPdfDocFromBase64, renderPdfPages, setResetScrollFlag } from './pdf-viewer.js';
import { renderSvgScore, setupSvgClickListener } from './svg-viewer.js';
import { renderDiagnosticsOnsets, renderLilyPondSource } from './diagnostics.js';
import { setupLoupe } from './loupe.js';

export function getPlaceholderDefaultHtml() {
  return `
    <div class="placeholder-card">
      <div class="placeholder-hero-header">
        <img src="logo.svg" alt="PPT Logo" class="placeholder-hero-logo" />
        <h2 class="placeholder-title">Prime Period Theory Studio</h2>
        <p class="placeholder-subtitle">Live geometric music notation compiler & interactive studio</p>
      </div>
      
      <div class="placeholder-shortcuts-grid">
        <div class="shortcut-item">
          <span class="shortcut-action">Compile Score</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Open Tapestry</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>O</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Command Palette</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Transpose Solfège</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>↑/↓</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Shift Octave</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>↑/↓</kbd></span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-action">Autocomplete & Snips</span>
          <span class="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Space</kbd></span>
        </div>
      </div>

      <div class="placeholder-actions">
        <button type="button" id="btn-placeholder-compile" class="btn btn-primary">
          <span>▶</span> Compile Tapestry
        </button>
        <button type="button" id="btn-placeholder-open" class="btn btn-secondary">
          <span>📂</span> Open Score...
        </button>
      </div>
    </div>
  `;
}

export function getPlaceholderLoadingHtml(title = 'Compiling Tapestry Score', subtitle = 'Generating LilyPond notation...') {
  return `
    <div class="placeholder-card placeholder-loading-card">
      <div class="placeholder-spinner-wrap">
        <div class="placeholder-spinner-ring"></div>
        <img src="logo.svg" alt="PPT Logo" class="placeholder-spinner-logo" />
      </div>
      <h3 class="placeholder-loading-title">${title}</h3>
      <p class="placeholder-loading-sub">${subtitle}</p>
    </div>
  `;
}

export function initPreview(options = {}) {
  const { onTriggerCompile, onOpenTapestryPicker, onPointAndClick, getEditor } = options;

  const scoreSvgContainer = document.getElementById('score-svg-container');
  const scorePlaceholder = document.getElementById('score-placeholder');
  const scoreCanvas = document.getElementById('score-canvas');
  const tabBtns = document.querySelectorAll('.tab-btn');

  function bindPlaceholderButtons() {
    const btnCompile = document.getElementById('btn-placeholder-compile');
    const btnOpen = document.getElementById('btn-placeholder-open');
    if (btnCompile) {
      btnCompile.addEventListener('click', () => onTriggerCompile?.());
    }
    if (btnOpen) {
      btnOpen.addEventListener('click', () => onOpenTapestryPicker?.());
    }
  }

  bindPlaceholderButtons();
  setupSvgClickListener(scoreSvgContainer, onPointAndClick);
  setupLoupe();

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      state.activeTab = tabId;
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');

      const zoomControls = document.getElementById('zoom-controls');
      if (zoomControls) {
        zoomControls.style.display = tabId === 'score-view' ? 'flex' : 'none';
      }
    });
  });

  const copyLyBtn = document.getElementById('btn-copy-ly');
  if (copyLyBtn) {
    copyLyBtn.addEventListener('click', () => {
      const code = document.getElementById('lilypond-code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        copyLyBtn.textContent = 'Copied!';
        setTimeout(() => { copyLyBtn.textContent = 'Copy Code'; }, 1500);
      });
    });
  }

  return {
    clearPreviewWindow: (loadingMessage = null) => {
      if (scoreSvgContainer) scoreSvgContainer.innerHTML = '';
      if (scorePlaceholder) {
        if (loadingMessage) {
          scorePlaceholder.innerHTML = getPlaceholderLoadingHtml('Loading Tapestry Score', loadingMessage);
        } else {
          scorePlaceholder.innerHTML = getPlaceholderDefaultHtml();
          bindPlaceholderButtons();
        }
        scorePlaceholder.style.display = 'flex';
      }
      if (scoreCanvas) {
        scoreCanvas.scrollTop = 0;
        scoreCanvas.scrollLeft = 0;
      }
    },

    renderResult: async (data) => {
      if (data.lilypondSource) {
        renderLilyPondSource(data.lilypondSource);
      }
      if (data.onsets) {
        renderDiagnosticsOnsets(data.onsets);
      }

      if (data.format === 'pdf' && data.pdfBase64) {
        await loadPdfDocFromBase64(data.pdfBase64);
        await renderPdfPages({
          editor: getEditor?.(),
          onPointAndClick,
          sidecarMap: data.sidecarMap,
          lilypondSource: data.lilypondSource,
          onsets: data.onsets,
        });
        return;
      }

      if (data.svg) {
        renderSvgScore(data.svg, {
          editor: getEditor?.(),
          onPointAndClick,
          sidecarMap: data.sidecarMap,
          lilypondSource: data.lilypondSource,
          onsets: data.onsets,
        });
      }
    },
  };
}
