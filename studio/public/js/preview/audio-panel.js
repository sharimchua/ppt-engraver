/**
 * PPT Studio Audio Generation & Playback Panel (YuE2 Integration)
 */

import { state, events, setPreference } from '../state.js';
import { apiGenerateAudio, apiGetAudioJob, apiExportAbc } from '../api.js';

const TEMPLATE_PRESETS = {
  // --- Full Band & Rhythm Section Backing ---
  funk_fusion: {
    label: 'Funk Fusion (Drums, Slap Bass, Rhodes & Synth Lead)',
    prompt: 'tight funk fusion band, punchy slap bass, synchronized drum kit groove, comping Rhodes electric piano, expressive synthesizer melodic lead, instrumental',
    cot: 'full',
  },
  full_band_rock: {
    label: 'Rock Band (Drums, Bass, Rhythm Guitars & Lead Guitar)',
    prompt: 'tight dynamic rock rhythm section, punchy drum kit, driving electric bassline, comping rhythm guitars, singing melodic lead guitar, full band, instrumental',
    cot: 'full',
  },
  neo_soul: {
    label: 'Neo-Soul Groove (Pocket Drums, Warm Bass, Keys & Guitar)',
    prompt: 'laid-back neo-soul groove, deep fingerstyle electric bass, crisp acoustic pocket drums, warm Rhodes chords, expressive melodic guitar lead, instrumental',
    cot: 'full',
  },
  jazz_quartet: {
    label: 'Jazz Quartet (Drums, Walking Bass, Piano & Tenor Sax)',
    prompt: 'contemporary jazz quartet, driving acoustic drum kit, walking acoustic upright bass, comping grand piano, warm tenor saxophone melodic lead, instrumental',
    cot: 'full',
  },
  latin_jazz: {
    label: 'Latin Jazz (Percussion, Salsa Bass, Piano & Trumpet)',
    prompt: 'upbeat latin jazz ensemble, congas and timbales percussion, dynamic drum groove, salsa bassline, montuno piano chords, bright trumpet melodic lead, instrumental',
    cot: 'full',
  },
  indie_folk: {
    label: 'Acoustic Ensemble (Percussion, Acoustic Bass, Guitars & Cello)',
    prompt: 'warm indie acoustic ensemble, cajon and shaker percussion, acoustic bass guitar, strummed acoustic guitars, expressive cello melodic lead, instrumental',
    cot: 'full',
  },

  // --- Acoustic & Chamber Timbres ---
  piano_trio: {
    label: 'Piano Trio (Grand Piano, Upright Bass & Brushed Drums)',
    prompt: 'intimate acoustic jazz piano trio, singing grand piano lead, melodic acoustic upright bass, brushed drums groove, warm studio acoustic reverb, instrumental',
    cot: 'full',
  },
  vibes_quartet: {
    label: 'Vibraphone & Rhythm (Vibes, Guitar, Upright Bass, Brushes)',
    prompt: 'cool jazz quartet, shimmering vibraphone melodic lead, comping jazz guitar, walking upright bass, crisp brushed drum swing, instrumental',
    cot: 'full',
  },
  cinematic_chamber: {
    label: 'Cinematic Chamber (Cello Lead, Double Bass & Strings)',
    prompt: 'cinematic chamber ensemble, expressive cello melodic lead, deep acoustic double bass, lush string quartet comping, subtle orchestral timpani and percussion, instrumental',
    cot: 'full',
  },
  solo_piano: {
    label: 'Solo Concert Piano (Full Harmonies & Lead)',
    prompt: 'solo acoustic concert grand piano, rich dynamic chords, clear singing melodic lead, warm studio acoustic reverb, instrumental',
    cot: 'full',
  },

  // --- Rhythm Section / Backing Tracks ---
  rhythm_backing_band: {
    label: 'Band Backing Track (Drums, Bass & Keys, No Lead)',
    prompt: 'tight studio rhythm section backing track, punchy kick and snare drum groove, solid bassline following chords, comping electric piano and rhythm guitar, no lead soloist, instrumental',
    cot: 'full',
  },
  bass_drums_duo: {
    label: 'Bass & Drums Duo (Pocket Groove)',
    prompt: 'tight bass and drums duo groove, punchy warm electric bassline, steady acoustic drum groove, rhythmic pocket, locked downbeats, instrumental',
    cot: 'melody',
  },
  solo_electric_bass: {
    label: 'Solo Electric Bass (Melodic & Harmonic)',
    prompt: 'solo warm electric bass guitar, deep fundamental tone, clear harmonics, chords and melodic motifs, clean studio recording, room ambience, instrumental',
    cot: 'melody',
  },

  // --- Custom ---
  free: {
    label: 'Free Style Prompt',
    prompt: '',
    cot: 'full',
  },

  // Legacy aliases
  full: {
    prompt: 'tight funk fusion band, punchy slap bass, synchronized drum kit groove, comping Rhodes electric piano, expressive synthesizer melodic lead, instrumental',
    cot: 'full',
  },
  jazz_trio: {
    prompt: 'contemporary jazz quartet, driving acoustic drum kit, walking acoustic upright bass, comping grand piano, warm tenor saxophone melodic lead, instrumental',
    cot: 'full',
  },
  rhythm_bass: {
    prompt: 'tight studio rhythm section backing track, punchy kick and snare drum groove, solid bassline following chords, comping electric piano, no lead soloist, instrumental',
    cot: 'full',
  },
  bass_only: {
    prompt: 'solo warm electric bass guitar, deep fundamental tone, clear harmonics, clean studio recording, room ambience, instrumental',
    cot: 'melody',
  },
};

export function setupAudioPanel(options = {}) {
  const getEditor = options.getEditor;

  function getCurrentYaml() {
    return (getEditor ? getEditor().getValue() : '') || state.currentScore?.content || '';
  }
  const knotBadge = document.getElementById('audio-active-knot-name');
  const modelSelect = document.getElementById('audio-model-select');
  const templateSelect = document.getElementById('audio-template-select');
  const cotSelect = document.getElementById('audio-cot-select');
  const promptInput = document.getElementById('audio-prompt-input');
  const lyricsInput = document.getElementById('audio-lyrics-input');
  const abcPreview = document.getElementById('audio-abc-preview');
  const btnCopyAbc = document.getElementById('btn-copy-abc');
  const btnExportAbc = document.getElementById('btn-export-abc-file');
  const btnGenerate = document.getElementById('btn-generate-audio');

  const paramSeed = document.getElementById('audio-param-seed');
  const paramTempo = document.getElementById('audio-param-tempo');
  const labelTempo = document.getElementById('label-audio-tempo');
  const paramTemp = document.getElementById('audio-param-temp');
  const labelTemp = document.getElementById('label-audio-temp');
  const paramDuration = document.getElementById('audio-param-duration');
  const labelDuration = document.getElementById('label-audio-duration');

  // Initialize model selector from saved preferences
  if (modelSelect) {
    modelSelect.value = state.preferences?.audioModelId || 'yue2-3b-gguf-q8-instrumental';
    modelSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      setPreference('audioModelId', val);
      const inferred = val.startsWith('yue2-3b-gguf')
        ? 'gguf'
        : val.startsWith('yue2-3b-pytorch')
        ? 'pytorch'
        : 'mock';
      setPreference('audioEngine', inferred);
    });
  }

  events.on('preference:change', ({ key, value }) => {
    if (key === 'audioModelId' && modelSelect) {
      modelSelect.value = value;
    }
  });

  const progressCard = document.getElementById('audio-progress-card');
  const progressFill = document.getElementById('audio-progress-fill');
  const progressMsg = document.getElementById('audio-progress-message');
  const logsConsole = document.getElementById('audio-logs-console');
  const backendBadge = document.getElementById('audio-backend-badge');
  const stageSteps = document.querySelectorAll('.stage-step');

  const playerCard = document.getElementById('audio-player-card');
  const nativePlayer = document.getElementById('audio-native-player');
  const btnDownloadAudio = document.getElementById('btn-download-audio');
  const btnRevise = document.getElementById('btn-audio-revise');

  // Interim Pipeline Artifacts & Diagnostics elements
  const artifactsCard = document.getElementById('audio-artifacts-card');
  const artifactJobBadge = document.getElementById('audio-artifact-job-badge');
  const btnCopyInterimAbc = document.getElementById('btn-copy-interim-abc');
  const btnDownloadInterimAbc = document.getElementById('btn-download-interim-abc');
  const btnDownloadInterimMeta = document.getElementById('btn-download-interim-meta');
  const artifactAbcCode = document.getElementById('artifact-abc-code');
  const artifactEffectivePrompt = document.getElementById('artifact-effective-prompt');
  const artifactTextConditioning = document.getElementById('artifact-text-conditioning');
  const artifactCotMode = document.getElementById('artifact-cot-mode');
  const artifactParamsSummary = document.getElementById('artifact-params-summary');
  const metricPlanTime = document.getElementById('metric-plan-time');
  const metricPlanTokens = document.getElementById('metric-plan-tokens');
  const metricArTime = document.getElementById('metric-ar-time');
  const metricArTokens = document.getElementById('metric-ar-tokens');
  const metricOdeTime = document.getElementById('metric-ode-time');
  const metricOdeSteps = document.getElementById('metric-ode-steps');
  const metricVaeTime = document.getElementById('metric-vae-time');
  const metricAudioDuration = document.getElementById('metric-audio-duration');
  const metricComputeDevice = document.getElementById('metric-compute-device');
  const metricWallTime = document.getElementById('metric-wall-time');
  const metricRtf = document.getElementById('metric-rtf');
  const artifactCliCommand = document.getElementById('artifact-cli-command');
  const btnCopyCliCommand = document.getElementById('btn-copy-cli-command');

  let currentAbcSource = '';
  let activePollInterval = null;
  let lastGeneratedJobId = null;

  // Artifact subtab navigation
  const artifactTabs = document.querySelectorAll('.btn-artifact-tab');
  const artifactPanes = {
    abc: document.getElementById('artifact-tab-content-abc'),
    conditioning: document.getElementById('artifact-tab-content-conditioning'),
    timings: document.getElementById('artifact-tab-content-timings'),
    cli: document.getElementById('artifact-tab-content-cli'),
  };

  artifactTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-artifact-tab');
      artifactTabs.forEach(t => t.classList.toggle('active', t === tab));
      Object.entries(artifactPanes).forEach(([k, pane]) => {
        if (pane) pane.classList.toggle('hidden', k !== target);
      });
    });
  });

  if (btnCopyInterimAbc) {
    btnCopyInterimAbc.addEventListener('click', () => {
      const text = artifactAbcCode?.textContent || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btnCopyInterimAbc.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyInterimAbc.textContent = '📋 Copy ABC'; }, 1500);
      });
    });
  }

  if (btnCopyCliCommand) {
    btnCopyCliCommand.addEventListener('click', () => {
      const text = artifactCliCommand?.textContent || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btnCopyCliCommand.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyCliCommand.textContent = '📋 Copy Command'; }, 1500);
      });
    });
  }

  function updateInterimArtifacts(jobId, pipeline) {
    if (!artifactsCard) return;
    artifactsCard.classList.remove('hidden');

    if (artifactJobBadge) {
      artifactJobBadge.textContent = `Job: ${jobId}`;
    }

    if (btnDownloadInterimAbc) {
      btnDownloadInterimAbc.href = `/api/audio/file/${jobId}.abc`;
      btnDownloadInterimAbc.download = `${jobId}.abc`;
    }
    if (btnDownloadInterimMeta) {
      btnDownloadInterimMeta.href = `/api/audio/file/${jobId}.meta.json`;
      btnDownloadInterimMeta.download = `${jobId}.meta.json`;
    }

    if (!pipeline) return;

    // 1. ABC Score
    if (artifactAbcCode && pipeline.abc_text) {
      artifactAbcCode.textContent = pipeline.abc_text;
    }

    // 2. Prompt & Conditioning
    if (artifactEffectivePrompt) {
      artifactEffectivePrompt.textContent = pipeline.effective_prompt || pipeline.prompt || '-';
    }
    if (artifactTextConditioning) {
      artifactTextConditioning.textContent = pipeline.text_conditioning || '[Instrumental]';
    }
    if (artifactCotMode) {
      artifactCotMode.textContent = `cot="${pipeline.cot || 'full'}"`;
    }
    if (artifactParamsSummary) {
      const parts = [];
      if (pipeline.temperature !== undefined) parts.push(`temp=${pipeline.temperature}`);
      if (pipeline.seed !== undefined && pipeline.seed !== null) parts.push(`seed=${pipeline.seed}`);
      if (pipeline.duration !== undefined) parts.push(`max_dur=${pipeline.duration}s`);
      if (pipeline.model_id) parts.push(`model=${pipeline.model_id}`);
      artifactParamsSummary.textContent = parts.join(' | ') || '-';
    }

    // 3. Timings & Metrics
    const metrics = pipeline.metrics || {};
    if (metricPlanTime) {
      metricPlanTime.textContent = metrics.plan_ms != null ? `${Number(metrics.plan_ms).toFixed(1)}ms` : '-';
    }
    if (metricPlanTokens) {
      metricPlanTokens.textContent = metrics.abc_tokens != null ? `${metrics.abc_tokens} tokens` : '- tokens';
    }
    if (metricArTime) {
      metricArTime.textContent = metrics.ar_decode_ms != null ? `${(metrics.ar_decode_ms / 1000).toFixed(2)}s` : '-';
    }
    if (metricArTokens) {
      metricArTokens.textContent = metrics.ar_tokens != null ? `${metrics.ar_tokens} tokens` : '- tokens';
    }
    if (metricOdeTime) {
      metricOdeTime.textContent = metrics.nar_synthesize_ms != null ? `${(metrics.nar_synthesize_ms / 1000).toFixed(2)}s` : '-';
    }
    if (metricOdeSteps) {
      metricOdeSteps.textContent = metrics.ode_steps != null ? `${metrics.ode_steps} ODE steps` : '32 steps';
    }
    if (metricVaeTime) {
      metricVaeTime.textContent = metrics.vae_decode_ms != null ? `${(metrics.vae_decode_ms / 1000).toFixed(2)}s` : '-';
    }
    if (metricAudioDuration) {
      metricAudioDuration.textContent = metrics.audio_duration_seconds != null ? `${metrics.audio_duration_seconds}s @ 48kHz` : '- sec audio';
    }
    if (metricComputeDevice) {
      metricComputeDevice.textContent = metrics.device || pipeline.backend || '-';
    }
    if (metricWallTime) {
      metricWallTime.textContent = metrics.wall_ms != null ? `${(metrics.wall_ms / 1000).toFixed(2)}s` : '-';
    }
    if (metricRtf) {
      if (metrics.realtime_factor != null) {
        const speedup = metrics.realtime_factor > 0 ? `${Math.round(1 / metrics.realtime_factor)}x faster` : '';
        metricRtf.textContent = `${metrics.realtime_factor}x RTF ${speedup ? `(${speedup})` : ''}`;
      } else {
        metricRtf.textContent = '-';
      }
    }

    // 4. CLI Invocation
    if (artifactCliCommand) {
      artifactCliCommand.textContent = pipeline.command_str || (Array.isArray(pipeline.command) ? pipeline.command.join(' ') : '-');
    }
  }

  const btnSyncTiming = document.getElementById('btn-sync-audio-timing');
  const timingBadge = document.getElementById('audio-score-timing-badge');

  let latestTiming = null;

  function isAutoGeneratedTimedPlan(text) {
    if (!text || !text.trim()) return true;
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const timedTagRegex = /^\[[a-zA-Z-]+\s+\d+:\d{2}\s*-\s*\d+:\d{2}\]$/;
    return lines.every(line => timedTagRegex.test(line));
  }

  function isSectionPlanOnly(text) {
    if (!text || !text.trim()) return true;
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return true;
    // Section-plan-only if all non-empty lines consist solely of bracketed tags (e.g. [intro 0:00-0:08], [verse])
    return lines.every(line => line.replace(/\[[^\]]+\]/g, '').trim().length === 0);
  }

  function applyScoreTiming(timing, forceReset = false) {
    if (!timing) return;
    latestTiming = timing;

    if (timingBadge) {
      timingBadge.textContent = `${timing.formattedDuration} (${timing.totalMeasures} bars @ ${timing.tempo} BPM)`;
    }

    if (paramDuration && (forceReset || !paramDuration.dataset.userEdited)) {
      const durSec = Math.ceil(timing.durationSeconds || 15);
      paramDuration.value = durSec;
      if (labelDuration) labelDuration.textContent = `${durSec}s`;
    }

    if (lyricsInput) {
      const currentVal = (lyricsInput.value || '').trim();
      if (forceReset || !currentVal || isAutoGeneratedTimedPlan(currentVal)) {
        lyricsInput.value = timing.timedSectionPlan || '';
      }
    }
  }

  if (btnSyncTiming) {
    btnSyncTiming.addEventListener('click', () => {
      if (paramDuration) delete paramDuration.dataset.userEdited;
      if (latestTiming) {
        applyScoreTiming(latestTiming, true);
      } else {
        scheduleRefreshAbc();
      }
    });
  }

  // Tempo, temperature, and duration slider labels
  if (paramTempo && labelTempo) {
    paramTempo.addEventListener('input', (e) => {
      labelTempo.textContent = e.target.value;
      paramTempo.dataset.userEdited = 'true';
      scheduleRefreshAbc();
    });
  }
  if (paramTemp && labelTemp) {
    paramTemp.addEventListener('input', (e) => {
      labelTemp.textContent = e.target.value;
    });
  }
  if (paramDuration && labelDuration) {
    paramDuration.addEventListener('input', (e) => {
      labelDuration.textContent = `${e.target.value}s`;
      paramDuration.dataset.userEdited = 'true';
    });
  }

  // Template dropdown preset change
  if (templateSelect) {
    templateSelect.addEventListener('change', (e) => {
      const preset = TEMPLATE_PRESETS[e.target.value];
      if (preset) {
        if (preset.prompt && promptInput) promptInput.value = preset.prompt;
        if (preset.cot && cotSelect) cotSelect.value = preset.cot;
      }
    });
  }

  // Quick prompt tag chips
  const tagChips = document.querySelectorAll('.prompt-tag');
  tagChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const tagText = chip.getAttribute('data-tag');
      if (!promptInput || !tagText) return;
      if (promptInput.value.trim().length > 0) {
        promptInput.value += `, ${tagText}`;
      } else {
        promptInput.value = tagText;
      }
    });
  });

  // Copy ABC button
  if (btnCopyAbc) {
    btnCopyAbc.addEventListener('click', () => {
      if (!currentAbcSource) return;
      navigator.clipboard.writeText(currentAbcSource).then(() => {
        btnCopyAbc.textContent = '✓ Copied!';
        setTimeout(() => { btnCopyAbc.textContent = '📋 Copy ABC'; }, 1500);
      });
    });
  }

  // Export .abc button
  if (btnExportAbc) {
    btnExportAbc.addEventListener('click', async () => {
      try {
        const yaml = getCurrentYaml();
        const knotId = state.selectedKnotId || 'default';
        const fileName = state.currentScore?.path || 'score.ppt.yaml';
        const lyricsText = (lyricsInput?.value || '').trim();
        const isInstrumental = !lyricsText || isSectionPlanOnly(lyricsText);
        const tempoVal = paramTempo?.value ? parseInt(paramTempo.value, 10) : undefined;
        const res = await apiExportAbc(yaml, fileName, knotId, isInstrumental, tempoVal);
        
        // Trigger browser download
        const blob = new Blob([res.abcSource], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.abcFile || 'score.abc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Export ABC failed: ${err.message}`);
      }
    });
  }

  let refreshAbcTimeout = null;
  function scheduleRefreshAbc() {
    if (refreshAbcTimeout) clearTimeout(refreshAbcTimeout);
    refreshAbcTimeout = setTimeout(async () => {
      const yaml = getCurrentYaml();
      if (!yaml) return;
      try {
        const knotId = state.selectedKnotId || 'default';
        const lyricsText = (lyricsInput?.value || '').trim();
        const isInstrumental = !lyricsText || isSectionPlanOnly(lyricsText);
        const tempoVal = paramTempo?.value ? parseInt(paramTempo.value, 10) : undefined;
        const res = await apiExportAbc(yaml, state.currentScore?.path || 'score.ppt.yaml', knotId, isInstrumental, tempoVal);
        if (res && res.abcSource) {
          updateAbcView(res.abcSource);
        }
        if (res && res.timing) {
          applyScoreTiming(res.timing, false);
        }
      } catch (e) {
        // silently ignore background refresh error
      }
    }, 250);
  }

  if (lyricsInput) {
    lyricsInput.addEventListener('input', scheduleRefreshAbc);
  }

  events.on('tab:changed', (tabId) => {
    if (tabId === 'audio-view') {
      scheduleRefreshAbc();
    }
  });

  function updateAbcView(abcSource) {
    currentAbcSource = abcSource || '';
    if (abcPreview) {
      abcPreview.textContent = currentAbcSource || 'No ABC source available for active knot.';
    }
  }

  function updateKnotIndicator(knotId) {
    if (knotBadge) {
      knotBadge.textContent = knotId || 'default';
    }
  }

  // Listen for score compilation results to update ABC source, timing, and active knot
  events.on('compile:success', (data) => {
    if (data.knot?.tempo && paramTempo && !paramTempo.dataset.userEdited) {
      paramTempo.value = data.knot.tempo;
      if (labelTempo) labelTempo.textContent = data.knot.tempo;
    }
    if (data.abcSource) {
      updateAbcView(data.abcSource);
    }
    if (data.selectedKnotId) {
      updateKnotIndicator(data.selectedKnotId);
    }
    if (data.timing) {
      applyScoreTiming(data.timing, false);
    }
  });

  events.on('knot:changed', (knotId) => {
    updateKnotIndicator(knotId);
  });

  function setStageActive(stageName) {
    stageSteps.forEach(step => {
      const stepStage = step.getAttribute('data-stage');
      step.classList.toggle('active', stepStage === stageName);
    });
  }

  async function triggerGeneration(isRevision = false) {
    if (!currentAbcSource) {
      alert('Please compile the score first to generate the ABC plan.');
      return;
    }

    if (activePollInterval) {
      clearInterval(activePollInterval);
      activePollInterval = null;
    }

    const promptText = (promptInput?.value || '').trim() || 'contemporary arrangement';
    const lyricsText = (lyricsInput?.value || '').trim() || undefined;
    const cotVal = cotSelect?.value || 'full';
    const tempVal = parseFloat(paramTemp?.value || '0.6');
    const tempoVal = paramTempo?.value ? parseInt(paramTempo.value, 10) : undefined;
    const seedVal = paramSeed?.value ? parseInt(paramSeed.value, 10) : undefined;
    const durVal = paramDuration?.value ? parseFloat(paramDuration.value) : undefined;

    // Read selected model and infer engine
    const modelVal = modelSelect?.value || state.preferences?.audioModelId || 'yue2-3b-gguf-q8-instrumental';
    const engineVal = modelVal === 'mock'
      ? 'mock'
      : modelVal.startsWith('yue2-3b-pytorch')
      ? 'pytorch'
      : 'gguf';

    if (btnGenerate) btnGenerate.disabled = true;
    if (progressCard) progressCard.classList.remove('hidden');
    if (progressFill) progressFill.style.width = '10%';
    if (progressMsg) progressMsg.textContent = 'Sending request to audio engine...';
    if (logsConsole) logsConsole.textContent = 'Queued for generation...\nWaiting for audio engine initialization...';
    setStageActive('planning');

    try {
      const isInstrumental = !lyricsText || isSectionPlanOnly(lyricsText);
      const result = await apiGenerateAudio({
        abc: currentAbcSource,
        prompt: promptText,
        lyrics: lyricsText,
        isInstrumental,
        cot: cotVal,
        temperature: tempVal,
        tempo: tempoVal,
        seed: seedVal,
        duration: durVal,
        engine: engineVal,
        model_id: modelVal,
        knotId: state.selectedKnotId,
        yaml: getCurrentYaml(),
      });

      if (result.abcSource) {
        updateAbcView(result.abcSource);
      }

      const jobId = result.job_id;
      lastGeneratedJobId = jobId;

      // Initialize Interim Artifacts Card immediately with initial ABC and parameters
      updateInterimArtifacts(jobId, {
        job_id: jobId,
        abc_text: currentAbcSource,
        prompt: promptText,
        effective_prompt: promptText,
        text_conditioning: lyricsText || '[Instrumental]',
        cot: cotVal,
        temperature: tempVal,
        seed: seedVal,
        duration: durVal,
        model_id: modelVal,
        backend: engineVal.toUpperCase(),
      });

      // Poll job status
      activePollInterval = setInterval(async () => {
        try {
          const statusData = await apiGetAudioJob(jobId);
          if (progressFill) {
            const pct = Math.round((statusData.progress || 0.1) * 100);
            progressFill.style.width = `${pct}%`;
          }
          if (progressMsg) {
            progressMsg.textContent = statusData.message || statusData.stage || 'Synthesizing audio...';
          }
          if (statusData.stage) {
            setStageActive(statusData.stage);
          }

          // Update live engine logs console
          if (logsConsole && Array.isArray(statusData.logs) && statusData.logs.length > 0) {
            logsConsole.textContent = statusData.logs.join('\n');
            logsConsole.scrollTop = logsConsole.scrollHeight;
          }

          // Update backend device badge
          if (backendBadge) {
            const recentText = (statusData.logs ? statusData.logs.slice(-5).join(' ') : '') + ' ' + (statusData.message || '');
            if (recentText.includes('CUDA')) {
              backendBadge.textContent = 'CUDA GPU';
              backendBadge.style.color = '#48bb78';
            } else if (recentText.includes('CPU')) {
              backendBadge.textContent = 'CPU (Intel Core i7)';
              backendBadge.style.color = '#e2e8f0';
            }
          }

          // Update interim pipeline artifacts and diagnostics
          if (statusData.pipeline) {
            updateInterimArtifacts(jobId, statusData.pipeline);
          }

          if (statusData.status === 'completed') {
            clearInterval(activePollInterval);
            activePollInterval = null;
            if (btnGenerate) btnGenerate.disabled = false;
            setStageActive('decoding');
            if (progressFill) progressFill.style.width = '100%';
            if (progressMsg) progressMsg.textContent = '✓ Generation complete!';

            if (statusData.pipeline) {
              updateInterimArtifacts(jobId, statusData.pipeline);
            }

            // Update audio player
            if (playerCard) playerCard.classList.remove('hidden');
            const audioSrc = `/api/audio/file/${jobId}.wav`;
            if (nativePlayer) {
              nativePlayer.src = audioSrc;
              nativePlayer.play().catch(() => {});
            }
            if (btnDownloadAudio) {
              btnDownloadAudio.href = audioSrc;
              btnDownloadAudio.download = `${state.currentScore?.path?.replace(/\.ppt\.yaml$/, '') || 'composition'}_${jobId}.wav`;
            }
          } else if (statusData.status === 'error') {
            clearInterval(activePollInterval);
            activePollInterval = null;
            if (btnGenerate) btnGenerate.disabled = false;
            if (progressMsg) progressMsg.textContent = `⚠️ Generation failed: ${statusData.message}`;
            if (logsConsole) {
              logsConsole.textContent += `\n\n[ERROR] ${statusData.message}`;
              logsConsole.scrollTop = logsConsole.scrollHeight;
            }
            if (statusData.pipeline) {
              updateInterimArtifacts(jobId, statusData.pipeline);
            }
            alert(`Audio generation error: ${statusData.message}`);
          }
        } catch (pollErr) {
          console.warn('Status poll error:', pollErr);
        }
      }, 600);

    } catch (err) {
      if (btnGenerate) btnGenerate.disabled = false;
      if (progressMsg) progressMsg.textContent = `Failed to start generation: ${err.message}`;
      alert(`Generation failed: ${err.message}`);
    }
  }

  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => triggerGeneration(false));
  }

  if (btnRevise) {
    btnRevise.addEventListener('click', () => triggerGeneration(true));
  }
}
