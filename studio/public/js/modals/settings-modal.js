/**
 * Settings & Studio Preferences Modal
 */

import { state, setPreference, events } from '../state.js';
import {
  apiGetConfig,
  apiSaveConfig,
  apiGetAudioStatus,
  apiGetAudioModels,
  apiDownloadAudioModel,
  apiDeleteAudioModel,
} from '../api.js';

export function setupSettingsModal(options = {}) {
  const { onOpenShortcuts } = options;
  const settingsModal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnOpenShortcuts = document.getElementById('btn-open-shortcuts-from-settings');

  // Tab buttons and panes
  const navTabs = document.querySelectorAll('.settings-nav-tab');
  const tabPanes = document.querySelectorAll('.settings-tab-pane');

  // Tab 1: General
  const settingLilypondPath = document.getElementById('setting-lilypond-path');
  const settingStatusHint = document.getElementById('setting-status-hint');
  const settingLoupeSize = document.getElementById('setting-loupe-size');
  const labelLoupeSize = document.getElementById('label-loupe-size');
  const settingLoupePower = document.getElementById('setting-loupe-power');
  const labelLoupePower = document.getElementById('label-loupe-power');

  // Tab 2: Editor & MIDI
  const settingEnableAutocompile = document.getElementById('setting-enable-autocompile');
  const settingEnableAutocomplete = document.getElementById('setting-enable-autocomplete');
  const settingEnableSolfegeColors = document.getElementById('setting-enable-solfege-colors');
  const settingEnableCoilSuggestions = document.getElementById('setting-enable-coil-suggestions');
  const settingEnableSolfegeContext = document.getElementById('setting-enable-solfege-context');
  const settingEnableMidi = document.getElementById('setting-enable-midi');
  const settingMidiRhythmDo = document.getElementById('setting-midi-rhythm-do');
  const settingMidiDevice = document.getElementById('setting-midi-device');
  const settingMidiDeviceHint = document.getElementById('setting-midi-device-hint');

  // Tab 3: Audio Generation (YuE)
  const audioStatusBadge = document.getElementById('audio-backend-status-badge');
  const settingAudioBackendUrl = document.getElementById('setting-audio-backend-url');
  const btnTestAudioBackend = document.getElementById('btn-test-audio-backend');
  const settingAudioEngine = document.getElementById('setting-audio-engine');
  const settingHardwareDetected = document.getElementById('setting-hardware-detected');
  const audioModelsList = document.getElementById('audio-models-list');

  // Tab Navigation Handling
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');
      navTabs.forEach(t => t.classList.toggle('active', t === tab));
      tabPanes.forEach(p => p.classList.toggle('active', p.id === targetTabId));

      if (targetTabId === 'settings-tab-audio') {
        refreshAudioSettings();
      }
    });
  });

  function populateMidiDevices(devices, selectedId) {
    if (!settingMidiDevice) return;
    settingMidiDevice.innerHTML = '<option value="all">All Connected MIDI Devices</option>';
    if (devices && devices.length > 0) {
      devices.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.id;
        opt.textContent = `${dev.name}${dev.manufacturer ? ` (${dev.manufacturer})` : ''}`;
        if (dev.id === selectedId || (selectedId && dev.name === selectedId)) opt.selected = true;
        settingMidiDevice.appendChild(opt);
      });
      if (settingMidiDeviceHint) {
        settingMidiDeviceHint.textContent = `Found ${devices.length} MIDI device(s).`;
      }
    } else {
      if (settingMidiDeviceHint) {
        settingMidiDeviceHint.textContent = 'No hardware MIDI devices detected. Connect a controller and refresh.';
      }
    }
  }

  events.on('midi:devices', (devices) => {
    populateMidiDevices(devices, state.preferences?.midiDeviceId || 'all');
  });

  if (settingLoupeSize && labelLoupeSize) {
    settingLoupeSize.addEventListener('input', (e) => {
      labelLoupeSize.textContent = `${e.target.value} px`;
    });
  }

  if (settingLoupePower && labelLoupePower) {
    settingLoupePower.addEventListener('input', (e) => {
      labelLoupePower.textContent = `${e.target.value}x`;
    });
  }

  async function checkAudioStatus() {
    if (!audioStatusBadge) return;
    audioStatusBadge.textContent = 'Checking...';
    audioStatusBadge.style.background = 'var(--bg-surface-elevated)';
    audioStatusBadge.style.color = 'var(--text-muted)';

    try {
      const status = await apiGetAudioStatus();
      if (status && status.online) {
        audioStatusBadge.textContent = `● Online (v${status.version || '0.1'})`;
        audioStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        audioStatusBadge.style.color = 'var(--success)';

        if (status.hardware && settingHardwareDetected) {
          const hw = status.hardware;
          if (hw.cuda_available && hw.devices && hw.devices.length > 0) {
            const dev = hw.devices[0];
            settingHardwareDetected.textContent = `✓ Detected GPU: ${dev.name} (${dev.vram_gb} GB VRAM). Recommended: ${hw.recommended_engine.toUpperCase()}`;
          } else {
            settingHardwareDetected.textContent = 'ℹ No CUDA GPU detected. Running in GGUF/CPU or Mock mode.';
          }
        }
      } else {
        audioStatusBadge.textContent = '○ Offline (Daemon not running)';
        audioStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        audioStatusBadge.style.color = 'var(--danger)';
      }
    } catch {
      audioStatusBadge.textContent = '○ Offline';
      audioStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      audioStatusBadge.style.color = 'var(--danger)';
    }
  }

  let downloadPollTimer = null;

  function scheduleDownloadPoll(shouldPoll) {
    if (shouldPoll) {
      if (!downloadPollTimer) {
        downloadPollTimer = setInterval(async () => {
          await renderModelsList(true);
        }, 1500);
      }
    } else {
      if (downloadPollTimer) {
        clearInterval(downloadPollTimer);
        downloadPollTimer = null;
      }
    }
  }

  async function renderModelsList(isPolling = false) {
    if (!audioModelsList) return;
    try {
      const data = await apiGetAudioModels();
      const models = data.models || [];
      const cacheDir = data.cache_dir || '~/.cache/ppt-engraver/models';

      if (models.length === 0) {
        audioModelsList.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 11px;">No models found. Start audio-backend to manage downloads.</div>';
        scheduleDownloadPoll(false);
        return;
      }

      // Check if any download is in progress to maintain polling
      const hasActiveDownload = models.some(m => m.status === 'downloading');
      scheduleDownloadPoll(hasActiveDownload);

      // Save scroll position during polling
      const prevScrollTop = audioModelsList.scrollTop;
      audioModelsList.innerHTML = '';

      // Storage location header
      const storageHeader = document.createElement('div');
      storageHeader.style.cssText = 'margin-bottom: 12px; padding: 8px 10px; background: var(--surface-hover); border: 1px solid var(--border); border-radius: 4px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;';
      storageHeader.innerHTML = `
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="color: var(--text-dim); margin-right: 4px;">📁 Storage Location:</span>
          <code style="color: var(--primary); font-family: monospace; font-size: 11px;">${cacheDir}</code>
        </div>
        <button type="button" class="btn btn-secondary btn-xs btn-copy-cache" style="margin-left: 8px; flex-shrink: 0;">Copy Path</button>
      `;
      storageHeader.querySelector('.btn-copy-cache').addEventListener('click', (e) => {
        navigator.clipboard.writeText(cacheDir);
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = 'Copy Path'; }, 1500);
      });
      audioModelsList.appendChild(storageHeader);

      const renderCategory = (title, items) => {
        if (items.length === 0) return;
        const catHeader = document.createElement('div');
        catHeader.style.cssText = 'font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 10px 0 6px 2px; text-transform: uppercase; letter-spacing: 0.5px;';
        catHeader.textContent = title;
        audioModelsList.appendChild(catHeader);

        items.forEach(model => {
          const card = document.createElement('div');
          card.className = 'audio-model-card';

          const isDownloaded = Boolean(model.is_downloaded);
          const isDownloading = model.status === 'downloading';
          const isError = model.status === 'error';

          let statusBadge = '';
          if (isDownloaded) {
            statusBadge = `<span style="color: var(--success); font-weight: 600;">✓ Downloaded (${model.actual_size || model.estimated_size})</span>`;
          } else if (isDownloading) {
            const speedText = model.speed_mb_s ? ` • ${model.speed_mb_s} MB/s` : '';
            statusBadge = `<span style="color: var(--primary); font-weight: 600;">⬇ Downloading ${Math.round(model.progress || 0)}%${speedText}</span>`;
          } else if (isError) {
            statusBadge = `<span style="color: var(--danger); font-weight: 600;">⚠️ Download Error</span>`;
          } else {
            statusBadge = `<span style="color: var(--text-muted);">Not Downloaded (${model.estimated_size})</span>`;
          }

          const progressBar = isDownloading ? `
            <div style="width: 100%; height: 4px; background: var(--border); border-radius: 2px; margin-top: 6px; overflow: hidden;">
              <div style="width: ${Math.max(2, Math.round(model.progress || 0))}%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
            </div>
          ` : '';

          const errorNote = isError && model.error ? `
            <div style="font-size: 10px; color: var(--danger); margin-top: 4px; word-break: break-all;">⚠️ ${model.error}</div>
          ` : '';

          const vaeRequirement = model.requires_vae ? `
            <span style="font-size: 10px; color: var(--warning); margin-left: 6px;">(Requires VAE decoder)</span>
          ` : '';

          card.innerHTML = `
            <div class="audio-model-info" style="flex: 1;">
              <div class="audio-model-title">${model.name} ${vaeRequirement}</div>
              <div class="audio-model-meta">${model.tier} &bull; ${statusBadge}</div>
              <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${model.description || ''}</div>
              ${progressBar}
              ${errorNote}
            </div>
            <div class="audio-model-actions" style="margin-left: 12px; display: flex; align-items: center;">
              ${
                isDownloaded
                  ? `<button type="button" class="btn btn-secondary btn-xs btn-delete-model" data-model="${model.id}">Delete</button>`
                  : isDownloading
                  ? `<button type="button" class="btn btn-secondary btn-xs" disabled style="opacity: 0.7;">Downloading...</button>`
                  : `<button type="button" class="btn btn-primary btn-xs btn-download-model" data-model="${model.id}">Download</button>`
              }
            </div>
          `;

          const btnDownload = card.querySelector('.btn-download-model');
          if (btnDownload) {
            btnDownload.addEventListener('click', async () => {
              btnDownload.disabled = true;
              btnDownload.textContent = 'Starting...';
              try {
                await apiDownloadAudioModel(model.id);
                scheduleDownloadPoll(true);
                await renderModelsList();
              } catch (err) {
                alert(`Download failed: ${err.message}`);
                await renderModelsList();
              }
            });
          }

          const btnDelete = card.querySelector('.btn-delete-model');
          if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
              if (!confirm(`Delete model files for ${model.name}?`)) return;
              try {
                await apiDeleteAudioModel(model.id);
                await renderModelsList();
              } catch (err) {
                alert(`Delete failed: ${err.message}`);
              }
            });
          }

          audioModelsList.appendChild(card);
        });
      };

      const genModels = models.filter(m => m.category !== 'vae');
      const vaeModels = models.filter(m => m.category === 'vae');

      renderCategory('🎵 Music Planning & Generation Models', genModels);
      renderCategory('🔊 Neural Audio Decoders & VAE (Required for Audio Synthesis)', vaeModels);

      if (isPolling) {
        audioModelsList.scrollTop = prevScrollTop;
      }
    } catch (err) {
      audioModelsList.innerHTML = `<div style="color: var(--danger); font-size: 11px;">Error loading model list: ${err.message}</div>`;
      scheduleDownloadPoll(false);
    }
  }

  async function refreshAudioSettings() {
    await checkAudioStatus();
    await renderModelsList();
  }

  if (btnTestAudioBackend) {
    btnTestAudioBackend.addEventListener('click', () => {
      refreshAudioSettings();
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', async () => {
      try {
        const data = await apiGetConfig();
        if (settingLilypondPath) settingLilypondPath.value = data.lilypondPath || '';
        if (settingStatusHint) {
          settingStatusHint.textContent = data.exists ? '✓ LilyPond binary verified' : '⚠️ Binary not found at path';
          settingStatusHint.style.color = data.exists ? 'var(--success)' : 'var(--danger)';
        }

        if (settingAudioBackendUrl) {
          settingAudioBackendUrl.value = data.audioBackendUrl || state.preferences.audioBackendUrl || 'http://127.0.0.1:8000';
        }
        if (settingAudioEngine) {
          settingAudioEngine.value =
            state.preferences.audioModelId ||
            (state.preferences.audioEngine === 'pytorch'
              ? 'yue2-3b-pytorch'
              : state.preferences.audioEngine === 'mock'
              ? 'mock'
              : 'yue2-3b-gguf-q8');
        }

        if (settingLoupeSize && labelLoupeSize) {
          settingLoupeSize.value = state.preferences.loupeSize;
          labelLoupeSize.textContent = `${state.preferences.loupeSize} px`;
        }
        if (settingLoupePower && labelLoupePower) {
          settingLoupePower.value = state.preferences.loupePower;
          labelLoupePower.textContent = `${state.preferences.loupePower}x`;
        }

        if (settingEnableAutocompile) settingEnableAutocompile.checked = state.preferences.autocompile;
        if (settingEnableAutocomplete) settingEnableAutocomplete.checked = state.preferences.autocomplete;
        if (settingEnableSolfegeColors) settingEnableSolfegeColors.checked = state.preferences.solfegeColors;
        if (settingEnableCoilSuggestions) settingEnableCoilSuggestions.checked = state.preferences.coilSuggestions;
        if (settingEnableSolfegeContext) settingEnableSolfegeContext.checked = state.preferences.solfegeContext;

        if (settingEnableMidi) settingEnableMidi.checked = Boolean(state.preferences.midiEnabled);
        if (settingMidiRhythmDo) settingMidiRhythmDo.value = state.preferences.midiRhythmDo || 'C4';
        populateMidiDevices(state.midiDevices || [], state.preferences.midiDeviceId || 'all');

        // Check audio status on modal open
        checkAudioStatus();

        if (settingsModal) settingsModal.classList.remove('hidden');
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      if (settingsModal) settingsModal.classList.add('hidden');
    });
  }

  if (btnOpenShortcuts) {
    btnOpenShortcuts.addEventListener('click', () => {
      if (settingsModal) settingsModal.classList.add('hidden');
      onOpenShortcuts?.();
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const newPath = settingLilypondPath ? settingLilypondPath.value.trim() : '';
      const newAudioUrl = settingAudioBackendUrl ? settingAudioBackendUrl.value.trim() : 'http://127.0.0.1:8000';

      if (settingLoupeSize) {
        setPreference('loupeSize', parseInt(settingLoupeSize.value, 10));
      }
      if (settingLoupePower) {
        setPreference('loupePower', parseFloat(settingLoupePower.value));
      }

      if (settingEnableAutocompile) {
        setPreference('autocompile', settingEnableAutocompile.checked);
      }
      if (settingEnableAutocomplete) {
        setPreference('autocomplete', settingEnableAutocomplete.checked);
      }
      if (settingEnableSolfegeColors) {
        setPreference('solfegeColors', settingEnableSolfegeColors.checked);
      }
      if (settingEnableCoilSuggestions) {
        setPreference('coilSuggestions', settingEnableCoilSuggestions.checked);
      }
      if (settingEnableSolfegeContext) {
        setPreference('solfegeContext', settingEnableSolfegeContext.checked);
      }

      if (settingEnableMidi) {
        setPreference('midiEnabled', settingEnableMidi.checked);
      }
      if (settingMidiRhythmDo) {
        setPreference('midiRhythmDo', settingMidiRhythmDo.value.trim() || 'C4');
      }
      if (settingMidiDevice) {
        setPreference('midiDeviceId', settingMidiDevice.value || 'all');
      }

      // Save Audio preferences
      if (settingAudioEngine) {
        const val = settingAudioEngine.value;
        setPreference('audioModelId', val);
        const inferred = val.startsWith('yue2-3b-gguf')
          ? 'gguf'
          : val.startsWith('yue2-3b-pytorch')
          ? 'pytorch'
          : 'mock';
        setPreference('audioEngine', inferred);
      }
      setPreference('audioBackendUrl', newAudioUrl);

      try {
        const data = await apiSaveConfig({ lilypondPath: newPath, audioBackendUrl: newAudioUrl });
        alert(data.exists ? 'Settings saved! LilyPond verified.' : 'Settings saved, but LilyPond binary was not found at specified path.');
        if (settingsModal) settingsModal.classList.add('hidden');
      } catch (err) {
        alert('Failed to save backend settings');
        if (settingsModal) settingsModal.classList.add('hidden');
      }
    });
  }
}
