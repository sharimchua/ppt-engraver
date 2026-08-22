/**
 * Circular Magnifying Glass / Loupe Tool
 */

import { state } from '../state.js';

let isMagnifierToggled = false;
let isShiftHeld = false;

export function setupLoupe() {
  const magnifierLens = document.getElementById('magnifier-lens');
  const magnifierCanvas = document.getElementById('magnifier-canvas');
  const btnToggleMagnifier = document.getElementById('btn-toggle-magnifier');
  const scoreCanvas = document.getElementById('score-canvas');

  if (!magnifierCanvas) return;
  const magnifierCtx = magnifierCanvas.getContext('2d');

  function updateMagnifier(e) {
    const active = isMagnifierToggled || isShiftHeld || e.shiftKey;
    if (!active) {
      if (magnifierLens) magnifierLens.classList.add('hidden');
      return;
    }

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const targetCanvas = elements.find(el => el.classList && el.classList.contains('pdf-page-canvas'));

    if (!targetCanvas || !magnifierCanvas || !magnifierCtx) {
      if (magnifierLens) magnifierLens.classList.add('hidden');
      return;
    }

    const loupeSize = state.preferences.loupeSize || 220;
    const loupePower = state.preferences.loupePower || 2.5;

    magnifierLens.classList.remove('hidden');
    magnifierLens.style.width = `${loupeSize}px`;
    magnifierLens.style.height = `${loupeSize}px`;
    magnifierLens.style.left = `${e.clientX}px`;
    magnifierLens.style.top = `${e.clientY}px`;

    const rect = targetCanvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) * (targetCanvas.width / rect.width);
    const relY = (e.clientY - rect.top) * (targetCanvas.height / rect.height);

    const dpr = window.devicePixelRatio || 1;
    magnifierCanvas.width = loupeSize * dpr;
    magnifierCanvas.height = loupeSize * dpr;

    const srcW = (loupeSize / loupePower) * (targetCanvas.width / rect.width);
    const srcH = (loupeSize / loupePower) * (targetCanvas.height / rect.height);
    const srcX = relX - srcW / 2;
    const srcY = relY - srcH / 2;

    magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
    magnifierCtx.fillStyle = '#ffffff';
    magnifierCtx.fillRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
    magnifierCtx.drawImage(targetCanvas, srcX, srcY, srcW, srcH, 0, 0, magnifierCanvas.width, magnifierCanvas.height);
  }

  if (btnToggleMagnifier) {
    btnToggleMagnifier.addEventListener('click', () => {
      isMagnifierToggled = !isMagnifierToggled;
      btnToggleMagnifier.classList.toggle('active', isMagnifierToggled);
      if (!isMagnifierToggled && !isShiftHeld && magnifierLens) {
        magnifierLens.classList.add('hidden');
      }
    });
  }

  if (scoreCanvas) {
    scoreCanvas.addEventListener('mousemove', updateMagnifier);
    scoreCanvas.addEventListener('mouseleave', () => {
      if (magnifierLens) magnifierLens.classList.add('hidden');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      isShiftHeld = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      isShiftHeld = false;
      if (!isMagnifierToggled && magnifierLens) {
        magnifierLens.classList.add('hidden');
      }
    }
  });
}
