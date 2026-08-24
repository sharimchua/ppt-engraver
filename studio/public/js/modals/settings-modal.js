/**
 * Settings & Studio Preferences Modal
 */

import { state, setPreference } from '../state.js';
import { apiGetConfig, apiSaveConfig } from '../api.js';

export function setupSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  const settingLilypondPath = document.getElementById('setting-lilypond-path');
  const settingStatusHint = document.getElementById('setting-status-hint');
  const settingLoupeSize = document.getElementById('setting-loupe-size');
  const labelLoupeSize = document.getElementById('label-loupe-size');
  const settingLoupePower = document.getElementById('setting-loupe-power');
  const labelLoupePower = document.getElementById('label-loupe-power');
  const settingEnableAutocompile = document.getElementById('setting-enable-autocompile');
  const settingEnableAutocomplete = document.getElementById('setting-enable-autocomplete');
  const settingEnableSolfegeColors = document.getElementById('setting-enable-solfege-colors');
  const settingEnableCoilSuggestions = document.getElementById('setting-enable-coil-suggestions');
  const settingEnableSolfegeContext = document.getElementById('setting-enable-solfege-context');
  const settingEnableMidi = document.getElementById('setting-enable-midi');
  const settingMidiRhythmDo = document.getElementById('setting-midi-rhythm-do');
  const settingMidiDevice = document.getElementById('setting-midi-device');
  const settingMidiDeviceHint = document.getElementById('setting-midi-device-hint');

  function populateMidiDevices(devices, selectedId) {
    if (!settingMidiDevice) return;
    settingMidiDevice.innerHTML = '<option value="all">All Connected MIDI Devices</option>';
    if (devices && devices.length > 0) {
      devices.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.id;
        opt.textContent = `${dev.name}${dev.manufacturer ? ` (${dev.manufacturer})` : ''}`;
        if (dev.id === selectedId) opt.selected = true;
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

  if (btnSettings) {
    btnSettings.addEventListener('click', async () => {
      try {
        const data = await apiGetConfig();
        if (settingLilypondPath) settingLilypondPath.value = data.lilypondPath || '';
        if (settingStatusHint) {
          settingStatusHint.textContent = data.exists ? '✓ LilyPond binary verified' : '⚠️ Binary not found at path';
          settingStatusHint.style.color = data.exists ? 'var(--success)' : 'var(--danger)';
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

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const newPath = settingLilypondPath ? settingLilypondPath.value.trim() : '';
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

      try {
        const data = await apiSaveConfig(newPath);
        alert(data.exists ? 'Settings saved! LilyPond verified.' : 'Settings saved, but LilyPond binary was not found at specified path.');
        if (settingsModal) settingsModal.classList.add('hidden');
      } catch (err) {
        alert('Failed to save backend settings');
        if (settingsModal) settingsModal.classList.add('hidden');
      }
    });
  }
}
