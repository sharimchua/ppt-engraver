/**
 * Rhythmic Period Transposition & Grammar Optimizer Modal
 */

import { events } from '../state.js';
import { showRefactorDialog } from './modal-manager.js';
import {
  suggestOptimalRhythmicPeriod,
  expandRhythmEntries,
  transposeRhythmTokens,
} from '../core/rhythm.js';
import { getEnclosingCoilAtPos } from '../core/ast-scanner.js';

export async function showRhythmicPeriodTranspositionModal(cm, options = {}) {
  const { onTriggerCompile, onSetStatus } = options;
  const yamlText = cm.getValue();
  const cur = cm.getCursor();
  const coil = getEnclosingCoilAtPos(cm, cur);

  let sampleTokens = [];
  if (coil && coil.startLine !== undefined && coil.endLine !== undefined) {
    const lines = yamlText.split('\n');
    for (let l = coil.startLine; l <= coil.endLine; l++) {
      const line = lines[l] || '';
      const rMatch = line.match(/\brhythm\s*:\s*\[([^\]]+)\]/i);
      if (rMatch) {
        sampleTokens = rMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        break;
      }
    }
  }

  if (sampleTokens.length === 0) {
    const allRhythms = yamlText.match(/\brhythm\s*:\s*\[([^\]]+)\]/gi);
    if (allRhythms && allRhythms.length > 0) {
      const raw = allRhythms[0].replace(/^rhythm\s*:\s*\[|\]$/i, '');
      sampleTokens = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (sampleTokens.length === 0) {
    sampleTokens = ['Do', 'Fi', 'Do', 'Fi'];
  }

  const suggestion = suggestOptimalRhythmicPeriod(sampleTokens);

  const factorOptions = [
    { id: String(suggestion.recommendedFactor), label: `★ Recommended: ${suggestion.label}` },
    { id: '0.5', label: 'Half Time (2× Beat Density / e.g. Do → Do, Fi)' },
    { id: '2.0', label: 'Double Time (0.5× Beat Density / e.g. Do → Do, DoxDo)' },
    { id: '0.25', label: 'Quarter Time (4× Beat Density / e.g. Do → Do, Me, Fi, La)' },
    { id: '4.0', label: 'Quadruple Time (0.25× Beat Density)' },
    { id: '1.5', label: 'Dotted / Compound (1.5× Beat Density)' },
    { id: '3.0', label: 'Triplet (3× Beat Density)' },
  ];

  const bannerHtml = `
    <div class="refactor-banner refactor-banner-rec">
      <div class="refactor-banner-icon">💡</div>
      <div class="refactor-banner-content">
        <span class="refactor-banner-title">Optimization Suggestion: ${suggestion.label}</span>
        <span class="refactor-banner-desc">Reduces Dox delays by ${suggestion.doxReductionPercent}% and simplifies compound suffixes by ${suggestion.suffixReductionPercent}%.</span>
      </div>
    </div>
    <div class="refactor-stats-grid">
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.doxCount} → ${suggestion.recommendedComplexity.doxCount}</span>
        <span class="refactor-stat-label">Dox Delays</span>
      </div>
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.compoundSuffixCount} → ${suggestion.recommendedComplexity.compoundSuffixCount}</span>
        <span class="refactor-stat-label">Suffixes</span>
      </div>
      <div class="refactor-stat-chip">
        <span class="refactor-stat-val">${suggestion.originalComplexity.complexityScore} → ${suggestion.recommendedComplexity.complexityScore}</span>
        <span class="refactor-stat-label">Grammar Score</span>
      </div>
    </div>
  `;

  const result = await showRefactorDialog({
    title: 'Transpose Rhythmic Period & Optimize Grammar',
    desc: 'Scale rhythmic period lengths to alter downbeat density and eliminate Dox prefixes or complex suffixes:',
    fields: [
      {
        type: 'html',
        html: bannerHtml,
      },
      {
        type: 'select',
        name: 'factor',
        label: 'Period Scaling Factor:',
        value: String(suggestion.recommendedFactor),
        options: factorOptions,
      },
      {
        type: 'radios',
        name: 'scope',
        label: 'Scope:',
        options: [
          { id: 'entire', label: 'Entire Tapestry (All Coils & Rhythms)', checked: true },
          { id: 'active_coil', label: 'Active Coil Only' },
        ],
      },
      {
        type: 'checkboxes',
        name: 'compensateTempo',
        label: 'Playback Duration:',
        options: [
          { id: 'tempo', label: 'Compensate tempo (e.g. adjust knot.tempo proportionally to preserve real-time speed)', checked: true },
        ],
      },
    ],
    confirmText: 'Scale Rhythm Period',
  });

  if (!result.confirmed) return;

  const factor = parseFloat(result.values.factor) || 1.0;
  const scope = result.values.scope || 'entire';
  const compensateTempo = (result.values.compensateTempo || []).includes('tempo');

  if (factor === 1.0) return;

  const lines = cm.getValue().split('\n');
  const targetCoil = scope === 'active_coil' ? getEnclosingCoilAtPos(cm, cm.getCursor()) : null;
  const startL = targetCoil ? targetCoil.startLine : 0;
  const endL = targetCoil ? targetCoil.endLine : lines.length - 1;

  for (let l = startL; l <= endL; l++) {
    let line = lines[l];
    const rhythmMatch = line.match(/^(\s*rhythm\s*:\s*\[)(.*)(\]\s*)$/i);
    if (rhythmMatch) {
      const rawTokens = rhythmMatch[2].split(',').map(s => s.trim()).filter(Boolean);

      let melodyCount = undefined;
      for (let m = Math.max(0, l - 5); m <= Math.min(lines.length - 1, l + 5); m++) {
        const melMatch = lines[m].match(/^(\s*(?:melody|pitches)\s*:\s*\[)(.*)(\]\s*)$/i);
        if (melMatch) {
          const mTokens = melMatch[2].split(',').map(s => s.trim()).filter(Boolean);
          if (mTokens.length > 0) {
            melodyCount = mTokens.length;
            break;
          }
        }
      }

      const expanded = expandRhythmEntries(rawTokens, melodyCount);
      const transposed = transposeRhythmTokens(expanded, factor);
      lines[l] = `${rhythmMatch[1]}${transposed.join(', ')}${rhythmMatch[3]}`;
    }

    if (scope === 'entire' && compensateTempo) {
      const tempoMatch = line.match(/^(\s*tempo\s*:\s*)(\d+)(.*)$/i);
      if (tempoMatch) {
        const oldTempo = parseInt(tempoMatch[2], 10);
        const newTempo = Math.round(oldTempo * factor);
        lines[l] = `${tempoMatch[1]}${newTempo}${tempoMatch[3]}`;
      }
    }
  }

  cm.setValue(lines.join('\n'));
  events.emit('editor:changed', cm);
  onTriggerCompile?.();
  onSetStatus?.('ready', `Transposed rhythmic period by ${factor}×`);
}
