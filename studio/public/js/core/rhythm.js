/**
 * Core Rhythm Grammar Parser, Timeline & Period Optimization Utilities
 */

import { SOLFEGE_TO_SEMITONE } from './solfege.js';

const ALL_SYLLABLES_REGEX = '(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)';

export function parseRepeatSpec(item) {
  if (typeof item === 'number') {
    if (Number.isInteger(item)) {
      return item >= 0 ? { repeatCount: item, windowSize: 1 } : null;
    }
    const str = String(item);
    const parts = str.split('.');
    const repeatCount = parseInt(parts[0], 10);
    const windowSize = parseInt(parts[1], 10);
    if (!isNaN(repeatCount) && !isNaN(windowSize) && repeatCount >= 0 && windowSize > 0) {
      return { repeatCount, windowSize };
    }
    return null;
  }

  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (/^\d+$/.test(trimmed)) {
      const repeatCount = parseInt(trimmed, 10);
      return repeatCount >= 0 ? { repeatCount, windowSize: 1 } : null;
    }
    const match = trimmed.match(/^(\d+)\.(\d+)$/);
    if (match) {
      const repeatCount = parseInt(match[1], 10);
      const windowSize = parseInt(match[2], 10);
      if (repeatCount >= 0 && windowSize > 0) {
        return { repeatCount, windowSize };
      }
    }
  }

  return null;
}

export function parseRhythmToken(token) {
  let remaining = token.trim();
  let beatSkips = 0;

  while (remaining.startsWith('Dox')) {
    beatSkips++;
    remaining = remaining.slice(3);
  }

  if (remaining.length === 0) {
    return {
      beatSkips: 0,
      baseSyllable: 'Do',
      suffixes: [],
      offsetInBeat: 0,
      cleanToken: 'Dox',
    };
  }

  const tokenRegex = new RegExp(`^${ALL_SYLLABLES_REGEX}(.*)$`);
  const match = remaining.match(tokenRegex);
  if (!match) {
    throw new Error(`Invalid rhythm token: "${token}"`);
  }

  const baseSyllable = match[1];
  const rest = match[2];

  const baseSemitone = SOLFEGE_TO_SEMITONE[baseSyllable];
  if (baseSemitone === undefined) {
    throw new Error(`Unknown solfège syllable in rhythm token: "${baseSyllable}"`);
  }

  let offsetInBeat = baseSemitone / 12;

  const suffixes = [];
  const suffixRegex = new RegExp(ALL_SYLLABLES_REGEX, 'g');
  let suffixMatch;

  while ((suffixMatch = suffixRegex.exec(rest)) !== null) {
    const suffixSyllable = suffixMatch[1];
    suffixes.push(suffixSyllable);
    const suffixSemitone = SOLFEGE_TO_SEMITONE[suffixSyllable];
    if (suffixSemitone !== undefined) {
      const suffixFraction = suffixSemitone / 12;
      const remainingInterval = 1.0 - offsetInBeat;
      offsetInBeat += suffixFraction * remainingInterval;
    }
  }

  return {
    beatSkips,
    baseSyllable,
    suffixes,
    offsetInBeat,
    cleanToken: remaining,
  };
}

export function resolveRhythmTimeline(rhythmTokens) {
  if (!rhythmTokens || rhythmTokens.length === 0) return [];

  const parsedTokens = rhythmTokens.map(t => parseRhythmToken(t));
  const timestamps = [];

  let currentBeat = 0;
  let prevOffsetInBeat = -1;

  for (let i = 0; i < parsedTokens.length; i++) {
    const p = parsedTokens[i];

    if (i > 0) {
      if (p.beatSkips > 0) {
        if (p.baseSyllable === 'Do') {
          currentBeat += 1 + p.beatSkips;
        } else if (p.offsetInBeat <= prevOffsetInBeat) {
          currentBeat += 1 + p.beatSkips;
        } else {
          currentBeat += p.beatSkips;
        }
        prevOffsetInBeat = -1;
      } else if (p.baseSyllable === 'Do') {
        currentBeat += 1;
        prevOffsetInBeat = -1;
      } else if (p.offsetInBeat <= prevOffsetInBeat) {
        currentBeat += 1;
        prevOffsetInBeat = -1;
      }
    } else {
      if (p.beatSkips > 0) {
        currentBeat += p.beatSkips;
        prevOffsetInBeat = -1;
      }
    }

    const startBeat = currentBeat + p.offsetInBeat;
    timestamps.push(startBeat);
    prevOffsetInBeat = p.offsetInBeat;
  }

  const result = [];
  for (let i = 0; i < timestamps.length; i++) {
    const startBeat = timestamps[i];
    let durationBeats;

    if (i < timestamps.length - 1) {
      durationBeats = timestamps[i + 1] - startBeat;
    } else {
      const nextBeatBoundary = Math.floor(startBeat + 1e-5) + 1;
      durationBeats = nextBeatBoundary > startBeat ? nextBeatBoundary - startBeat : 1.0;
    }

    if (durationBeats <= 0) {
      durationBeats = 0.25;
    }

    result.push({
      index: i,
      token: rhythmTokens[i],
      startBeat,
      durationBeats,
    });
  }

  return result;
}

export function expandRhythmEntries(entries, targetCount) {
  const result = [];

  for (const entry of entries) {
    const repeatSpec = parseRepeatSpec(entry);
    if (repeatSpec !== null) {
      const { repeatCount, windowSize } = repeatSpec;
      if (result.length === 0) {
        throw new Error(`Rhythm array cannot start with a repeat token: ${entry}`);
      }
      if (windowSize > result.length) {
        throw new Error(`Repeat lookback window (${windowSize}) exceeds available items (${result.length}): ${entry}`);
      }
      const window = result.slice(-windowSize);
      for (let r = 0; r < repeatCount; r++) {
        result.push(...window);
      }
    } else {
      const tokens = String(entry).trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        result.push(token);
      }
    }
  }

  const audibleCount = result.filter(t => t !== 'Dox').length;
  if (targetCount !== undefined && audibleCount < targetCount) {
    const lastToken = result[result.length - 1] ?? 'Do';
    const needed = targetCount - audibleCount;
    for (let i = 0; i < needed; i++) {
      result.push(lastToken === 'Dox' ? 'Do' : lastToken);
    }
  }

  return result;
}

export function offsetInBeatToSolfege(offset) {
  const EPS = 1e-4;
  const modOffset = ((offset % 1.0) + 1.0) % 1.0;
  if (modOffset < EPS || modOffset > 1.0 - EPS) return 'Do';

  const twelfths = modOffset * 12;
  const nearestTwelfth = Math.round(twelfths);
  if (Math.abs(twelfths - nearestTwelfth) < EPS) {
    const SYLLABLES_12 = {
      0: 'Do', 1: 'Ra', 2: 'Re', 3: 'Me', 4: 'Mi', 5: 'Fa',
      6: 'Fi', 7: 'So', 8: 'Le', 9: 'La', 10: 'Te', 11: 'Ti',
    };
    return SYLLABLES_12[nearestTwelfth] ?? 'Do';
  }

  const CANDIDATES = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'];
  let bestToken = 'Do';
  let bestErr = Infinity;

  for (const base of CANDIDATES) {
    const baseFrac = (SOLFEGE_TO_SEMITONE[base] ?? 0) / 12;
    if (baseFrac <= modOffset + EPS) {
      const remaining = 1.0 - baseFrac;
      if (remaining > EPS) {
        for (const suffix of CANDIDATES) {
          const suffixFrac = (SOLFEGE_TO_SEMITONE[suffix] ?? 0) / 12;
          const candidateOffset = baseFrac + suffixFrac * remaining;
          const err = Math.abs(modOffset - candidateOffset);
          if (err < bestErr) {
            bestErr = err;
            bestToken = base === 'Do' ? suffix : `${base}${suffix}`;
          }
        }
      }
    }
  }

  return bestToken;
}

export function timestampsToRhythmTokens(timestamps) {
  if (!timestamps || timestamps.length === 0) return [];
  const tokens = [];
  let prevBeat = 0;
  let prevOffset = -1;

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const currentBeat = Math.floor(t + 1e-5);
    const offsetInBeat = t - currentBeat;
    const syl = offsetInBeatToSolfege(offsetInBeat);

    if (i === 0) {
      if (currentBeat > 0) {
        tokens.push('Dox'.repeat(currentBeat) + syl);
      } else {
        tokens.push(syl);
      }
    } else {
      const beatDelta = currentBeat - prevBeat;
      if (beatDelta > 0) {
        if (syl === 'Do') {
          if (beatDelta === 1) {
            tokens.push('Do');
          } else {
            tokens.push('Dox'.repeat(beatDelta - 1) + 'Do');
          }
        } else {
          if (offsetInBeat <= prevOffset) {
            const extraSkips = beatDelta - 1;
            if (extraSkips > 0) {
              tokens.push('Dox'.repeat(extraSkips) + syl);
            } else {
              tokens.push(syl);
            }
          } else {
            tokens.push('Dox'.repeat(beatDelta) + syl);
          }
        }
      } else {
        tokens.push(syl);
      }
    }

    prevBeat = currentBeat;
    prevOffset = offsetInBeat;
  }

  return tokens;
}

export function calculateHarmonyPhaseOffset(harmonyRhythmTokens, factor) {
  if (!harmonyRhythmTokens || harmonyRhythmTokens.length === 0 || factor <= 0) return 0;
  const timeline = resolveRhythmTimeline(harmonyRhythmTokens);
  if (timeline.length === 0) return 0;
  const firstChordBeat = timeline[0].startBeat;
  const period = 1.0 / factor;
  const rem = ((firstChordBeat % period) + period) % period;
  if (Math.abs(rem) < 1e-4 || Math.abs(rem - period) < 1e-4) {
    return 0;
  }
  return period - rem;
}

export function transposeRhythmTokens(rhythmTokens, factor, phaseOffset = 0) {
  if (!rhythmTokens || rhythmTokens.length === 0 || factor <= 0) return rhythmTokens;
  const timeline = resolveRhythmTimeline(rhythmTokens);
  const scaledTimestamps = timeline.map(onset => (onset.startBeat + phaseOffset) * factor);
  return timestampsToRhythmTokens(scaledTimestamps);
}

export function analyzeRhythmComplexity(tokens) {
  let doxCount = 0;
  let compoundSuffixCount = 0;
  let subdivisionCount = 0;
  let downbeatCount = 0;

  for (const tok of tokens) {
    const doxMatches = tok.match(/Dox/g);
    if (doxMatches) doxCount += doxMatches.length;

    try {
      const parsed = parseRhythmToken(tok);
      if (parsed.suffixes.length > 0) {
        compoundSuffixCount += parsed.suffixes.length;
      }
      if (parsed.cleanToken === 'Do') {
        downbeatCount++;
      } else if (parsed.cleanToken !== 'Dox') {
        subdivisionCount++;
      }
    } catch {
      // Ignored
    }
  }

  const complexityScore = doxCount * 3 + compoundSuffixCount * 6 + subdivisionCount * 1;

  return {
    doxCount,
    compoundSuffixCount,
    subdivisionCount,
    downbeatCount,
    complexityScore,
    totalTokens: tokens.length,
  };
}

export function suggestOptimalRhythmicPeriod(tokens) {
  const currentComplexity = analyzeRhythmComplexity(tokens);
  const candidates = [
    { factor: 2.0, label: 'Double Time (2× Beat Density)' },
    { factor: 0.5, label: 'Half Time (0.5× Beat Density)' },
    { factor: 4.0, label: 'Quadruple Time (4× Beat Density)' },
    { factor: 0.25, label: 'Quarter Time (0.25× Beat Density)' },
    { factor: 1.5, label: 'Dotted / Compound (1.5× Beat Density)' },
    { factor: 3.0, label: 'Triplet (3× Beat Density)' },
    { factor: 1.0 / 3.0, label: 'Triplet Reduction (0.33× Beat Density)' },
  ];

  let bestFactor = 1.0;
  let bestLabel = 'Current Period Length (1×)';
  let bestComplexity = currentComplexity;
  let bestTokens = tokens;
  let bestScore = currentComplexity.complexityScore;

  for (const c of candidates) {
    try {
      const transposed = transposeRhythmTokens(tokens, c.factor);
      const complexity = analyzeRhythmComplexity(transposed);
      if (complexity.complexityScore < bestScore) {
        bestScore = complexity.complexityScore;
        bestFactor = c.factor;
        bestLabel = c.label;
        bestComplexity = complexity;
        bestTokens = transposed;
      }
    } catch {
      // Ignored
    }
  }

  const doxReductionPercent = currentComplexity.doxCount > 0
    ? Math.max(0, Math.round(((currentComplexity.doxCount - bestComplexity.doxCount) / currentComplexity.doxCount) * 100))
    : 0;

  const suffixReductionPercent = currentComplexity.compoundSuffixCount > 0
    ? Math.max(0, Math.round(((currentComplexity.compoundSuffixCount - bestComplexity.compoundSuffixCount) / currentComplexity.compoundSuffixCount) * 100))
    : 0;

  return {
    recommendedFactor: bestFactor,
    label: bestLabel,
    originalComplexity: currentComplexity,
    recommendedComplexity: bestComplexity,
    doxReductionPercent,
    suffixReductionPercent,
    transposedTokens: bestTokens,
  };
}
