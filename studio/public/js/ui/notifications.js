/**
 * Notifications, Status Badges, Error Banners, and Performance Metrics
 */

import { state } from '../state.js';

export function setupNotifications() {
  const statusBadge = document.getElementById('status-badge');
  const saveStatus = document.getElementById('save-status');
  const metricsText = document.getElementById('metrics-text');
  const errorBanner = document.getElementById('error-banner');
  const errorContent = document.getElementById('error-content');

  function setStatus(type, text) {
    if (statusBadge) {
      statusBadge.className = `badge ${type}`;
      statusBadge.textContent = text;
    }
  }

  function setSaveStatus(dirty) {
    if (saveStatus) {
      saveStatus.className = `save-status ${dirty ? 'unsaved' : ''}`;
      saveStatus.textContent = dirty ? 'Unsaved' : 'Saved';
    }
  }

  function showError(msg) {
    if (errorContent && errorBanner) {
      errorContent.textContent = msg;
      errorBanner.classList.remove('hidden');
    }
  }

  function hideError() {
    if (errorContent && errorBanner) {
      errorBanner.classList.add('hidden');
      errorContent.textContent = '';
    }
  }

  function setMetrics(text) {
    if (metricsText) {
      metricsText.textContent = text || '';
    }
  }

  return {
    setStatus,
    setSaveStatus,
    showError,
    hideError,
    setMetrics,
  };
}
