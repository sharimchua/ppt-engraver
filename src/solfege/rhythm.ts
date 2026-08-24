/**
 * Solfège Rhythmic Grammar Parser & Timeline Engine
 * 
 * Subdivides beats (quarter note = 1.0) using the 12 chromatic Solfège degrees:
 * - Do (0/12 = 0): On the beat (downbeat)
 * - Fi (6/12 = 1/2): Halfway through the beat (8th note)
 * - Me (3/12 = 1/4), Fi (6/12 = 2/4), La (9/12 = 3/4): 16th notes
 * - Mi (4/12 = 1/3), Le (8/12 = 2/3): Triplets
 * - Re (2/12 = 1/6), Mi (4/12 = 2/6), Fi (6/12 = 3/6), Le (8/12 = 4/6), Te (10/12 = 5/6): Sextuplets
 * 
 * Prefix 'Dox' skips/delays downbeats (e.g. DoxDo = +1 beat, DoxFi = +1.5 beat).
 * Suffixes recursively subdivide remaining time to the next boundary (e.g. LeFi = 5/6).
 */
import { SOLFEGE_TO_SEMITONE, parseRepeatSpec } from './pitch.js';

export interface ParsedRhythmToken {
  /** Number of full beat skips from 'Dox' prefixes */
  beatSkips: number;
  /** Primary non-axis solfège syllable */
  baseSyllable: string;
  /** Modifier/subdivision suffixes */
  suffixes: string[];
  /** Sub-beat fractional offset in [0, 1) */
  offsetInBeat: number;
  /** Clean token string without Dox prefix (e.g. "Do", "Fi", "LeFi") */
  cleanToken: string;
}

export interface ResolvedRhythmOnset {
  /** Index of onset */
  index: number;
  /** Raw rhythm token string */
  token: string;
  /** Absolute start timestamp in beats (quarter note = 1.0) */
  startBeat: number;
  /** Duration in beats until next onset */
  durationBeats: number;
  /** LilyPond duration string, e.g. "4", "8", "16", "1*3/16", "4*1/3" */
  lilypondDuration: string;
}

const ALL_SYLLABLES_REGEX = '(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)';

/**
 * Parses a single rhythm token string (e.g. "Do", "Fi", "DoxDo", "DoxFi", "LeFi", "MeFi").
 */
export function parseRhythmToken(token: string): ParsedRhythmToken {
  let remaining = token.trim();
  let beatSkips = 0;

  // Count 'Dox' prefixes (each represents skipping 1 downbeat)
  while (remaining.startsWith('Dox')) {
    beatSkips++;
    remaining = remaining.slice(3);
  }

  if (remaining.length === 0) {
    // Lone "Dox" represents a single downbeat rest (1 beat)
    return {
      beatSkips: 0,
      baseSyllable: 'Do',
      suffixes: [],
      offsetInBeat: 0,
      cleanToken: 'Dox',
    };
  }

  // Match base syllable + optional suffixes
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

  // Extract suffixes (e.g. "Fi" in "LeFi")
  const suffixes: string[] = [];
  const suffixRegex = new RegExp(ALL_SYLLABLES_REGEX, 'g');
  let suffixMatch: RegExpExecArray | null;

  while ((suffixMatch = suffixRegex.exec(rest)) !== null) {
    const suffixSyllable = suffixMatch[1];
    suffixes.push(suffixSyllable);
    const suffixSemitone = SOLFEGE_TO_SEMITONE[suffixSyllable];
    if (suffixSemitone !== undefined) {
      const suffixFraction = suffixSemitone / 12;
      // Subdivide remaining interval between current offset and next beat boundary (1.0)
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

/**
 * Expands an array of rhythm entries (which may include repeat numbers or lookbacks, e.g. [Do, 3, Fi] or [Do, Fi, 2.2])
 * up to the required count of melody onsets (or beyond if rhythm specifies more onsets).
 */
export function expandRhythmEntries(
  entries: Array<string | number>,
  targetCount?: number,
): string[] {
  const result: string[] = [];

  for (const entry of entries) {
    const repeatSpec = parseRepeatSpec(entry);
    if (repeatSpec !== null) {
      const { repeatCount, windowSize } = repeatSpec;
      if (result.length === 0) {
        throw new Error(`Rhythm array cannot start with a repeat token: ${entry}`);
      }
      if (windowSize > result.length) {
        throw new Error(
          `Repeat lookback window (${windowSize}) exceeds available items in rhythm array (${result.length}): ${entry}`
        );
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

  // Count audible melody-matching rhythm entries (non-Dox tokens)
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

/**
 * Converts a duration in beats (where 1.0 = quarter note) into a clean LilyPond duration string.
 * @param durationBeats Duration in beats (1.0 = quarter note)
 * @param traditional When true, uses standard traditional dotted note tokens (e.g. "2.", "4.", "8.", "1.")
 */
export function beatsToLilyPondDuration(
  durationBeats: number,
  traditional: boolean = false,
): string {
  // Round to nearest fraction of 48 (subdivision resolution for 16ths and triplets)
  const ticks = Math.round(durationBeats * 48);
  if (ticks <= 0) return '4';

  if (traditional) {
    // Standard traditional note values and dotted durations
    if (ticks === 384) return '\\breve'; // 8 beats
    if (ticks === 288) return '1.';      // 6 beats (dotted whole)
    if (ticks === 192) return '1';       // 4 beats (whole)
    if (ticks === 144) return '2.';      // 3 beats (dotted half)
    if (ticks === 96)  return '2';       // 2 beats (half)
    if (ticks === 72)  return '4.';      // 1.5 beats (dotted quarter)
    if (ticks === 48)  return '4';       // 1 beat (quarter)
    if (ticks === 36)  return '8.';      // 0.75 beats (dotted 8th)
    if (ticks === 24)  return '8';       // 0.5 beats (8th)
    if (ticks === 18)  return '16.';     // 0.375 beats (dotted 16th)
    if (ticks === 12)  return '16';      // 0.25 beats (16th)
    if (ticks === 6)   return '32';      // 0.125 beats (32nd)
  }

  // Common exact powers of 2
  if (ticks === 192) return '1';       // Whole note (4 beats)
  if (ticks === 96)  return '2';       // Half note (2 beats)
  if (ticks === 48)  return '4';       // Quarter note (1 beat)
  if (ticks === 24)  return '8';       // 8th note (0.5 beats)
  if (ticks === 12)  return '16';      // 16th note (0.25 beats)
  if (ticks === 6)   return '32';      // 32nd note (0.125 beats)

  // General rational scaling of quarter note (e.g. 4*3/4 for 0.75 beats, 4*3/2 for 1.5 beats)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(ticks, 48);
  const num = ticks / g;
  const den = 48 / g;

  if (den === 1) {
    if (num === 4) return '1';
    if (num === 2) return '2';
    if (num === 1) return '4';
    return `4*${num}`;
  }

  return `4*${num}/${den}`;
}

/**
 * Resolves an array of rhythm tokens into exact beat timestamps and durations.
 */
export function resolveRhythmTimeline(
  rhythmTokens: string[],
): ResolvedRhythmOnset[] {
  if (rhythmTokens.length === 0) return [];

  const parsedTokens = rhythmTokens.map(t => parseRhythmToken(t));
  const timestamps: number[] = [];

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
        // Wrapped around or repeated sub-beat syllable -> next beat
        currentBeat += 1;
        prevOffsetInBeat = -1;
      }
    } else {
      if (p.beatSkips > 0) {
        currentBeat += p.beatSkips;
        prevOffsetInBeat = -1;
      }
    }

    const startBeat = Math.round((currentBeat + p.offsetInBeat) * 9600) / 9600;
    timestamps.push(startBeat);
    prevOffsetInBeat = p.offsetInBeat;
  }

  // Calculate durations: delta to next onset; for final onset, round up to next beat boundary
  const result: ResolvedRhythmOnset[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const startBeat = timestamps[i];
    let durationBeats: number;

    if (i < timestamps.length - 1) {
      durationBeats = Math.round((timestamps[i + 1] - startBeat) * 9600) / 9600;
    } else {
      // Final note: extend to the next beat boundary (at least 1.0 beat if starting on downbeat)
      const nextBeatBoundary = Math.floor(startBeat + 1e-4) + 1;
      durationBeats = nextBeatBoundary > startBeat
        ? Math.round((nextBeatBoundary - startBeat) * 9600) / 9600
        : 1.0;
    }

    if (durationBeats <= 0) {
      durationBeats = 0.25; // fallback safety
    }

    result.push({
      index: i,
      token: rhythmTokens[i],
      startBeat,
      durationBeats,
      lilypondDuration: beatsToLilyPondDuration(durationBeats),
    });
  }

  return result;
}

/**
 * Converts a fractional offset within a beat [0, 1) into a canonical Solfège rhythm syllable.
 * Handles primary 12ths and recursive compound subdivisions (e.g. MeFi, LeFi).
 */
export function offsetInBeatToSolfege(offset: number): string {
  const EPS = 1e-4;
  const modOffset = ((offset % 1.0) + 1.0) % 1.0;
  if (modOffset < EPS || modOffset > 1.0 - EPS) return 'Do';

  const twelfths = modOffset * 12;
  const nearestTwelfth = Math.round(twelfths);
  if (Math.abs(twelfths - nearestTwelfth) < EPS) {
    const SYLLABLES_12: Record<number, string> = {
      0: 'Do',
      1: 'Ra',
      2: 'Re',
      3: 'Me',
      4: 'Mi',
      5: 'Fa',
      6: 'Fi',
      7: 'So',
      8: 'Le',
      9: 'La',
      10: 'Te',
      11: 'Ti',
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

/**
 * Converts an array of absolute onset start beat timestamps (quarter note = 1.0)
 * into a sequence of PPT rhythm tokens.
 */
export function timestampsToRhythmTokens(timestamps: number[]): string[] {
  if (timestamps.length === 0) return [];
  const tokens: string[] = [];
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

/**
 * Calculates the phase offset in beats to align the primary chord downbeat with an integer downbeat.
 * E.g., if a chord starts on beat 3.0 (after a 3-beat pickup) and factor is 0.5 (half time, period = 2.0 beats),
 * the phase offset is 1.0, so (3.0 + 1.0) * 0.5 = 2.0 (integer downbeat).
 */
export function calculateHarmonyPhaseOffset(
  harmonyRhythmTokens: string[],
  factor: number,
): number {
  if (harmonyRhythmTokens.length === 0 || factor <= 0) return 0;
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

/**
 * Transposes/scales an array of rhythm tokens by a scaling factor with an optional phase offset in beats.
 * E.g. factor = 2.0 scales beat period to double time (doubles beat density / halves duration).
 * factor = 0.5 scales beat period to half time.
 * phaseOffset shifts the input timeline before scaling so pickups land on appropriate sub-beats.
 */
export function transposeRhythmTokens(
  rhythmTokens: string[],
  factor: number,
  phaseOffset: number = 0,
): string[] {
  if (rhythmTokens.length === 0 || factor <= 0) return rhythmTokens;
  const timeline = resolveRhythmTimeline(rhythmTokens);
  const scaledTimestamps = timeline.map(onset => (onset.startBeat + phaseOffset) * factor);
  return timestampsToRhythmTokens(scaledTimestamps);
}

export interface RhythmComplexityStats {
  doxCount: number;
  compoundSuffixCount: number;
  subdivisionCount: number;
  downbeatCount: number;
  complexityScore: number;
  totalTokens: number;
}

/**
 * Analyzes the rhythmic grammar complexity of a sequence of rhythm tokens.
 * Computes counts of Dox delays, compound subdivision suffixes, sub-beat offbeat syllables, and clean downbeats.
 */
export function analyzeRhythmComplexity(tokens: string[]): RhythmComplexityStats {
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

  // Lower is simpler grammar: Dox delays (+3), Compound suffixes (+6), Sub-beat offbeats (+1)
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


export interface OptimalRhythmicPeriodSuggestion {
  recommendedFactor: number;
  label: string;
  originalComplexity: RhythmComplexityStats;
  recommendedComplexity: RhythmComplexityStats;
  doxReductionPercent: number;
  suffixReductionPercent: number;
  transposedTokens: string[];
}

/**
 * Evaluates candidate scaling factors against current rhythm tokens to suggest
 * the optimal rhythmic period length that minimizes Dox delays and compound suffixes.
 */
export function suggestOptimalRhythmicPeriod(tokens: string[]): OptimalRhythmicPeriodSuggestion {
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
      // Ignore
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

export type BeatWeight = 'primary' | 'secondary' | 'weak';
export type GlyphShape =
  | 'circle'
  | 'square'
  | 'triangleDown'
  | 'triangleUp'
  | 'cross'
  | 'diamond'
  | 'halfCircleLeft'
  | 'halfCircleRight';

export interface MetricPulseOnset {
  beatIndex: number;
  startBeat: number;
  durationBeats: number;
  syllable: string;
  weight: BeatWeight;
  shape: GlyphShape;
  lilypondDuration?: string;
}

export interface ResolvedMetricGrammar {
  label: string;
  totalBeats: number;
  pulses: MetricPulseOnset[];
  timeSignature: string;
}

/**
 * Maps a Solfège syllable to its PPT geometric notehead shape.
 */
export function solfegeToGlyphShape(syllable: string): GlyphShape {
  const clean = syllable.replace(/x/g, '').replace(/[\^_]/g, '');
  switch (clean) {
    case 'Do':
      return 'circle';
    case 'Ra':
    case 'Di':
      return 'cross';
    case 'Re':
      return 'square';
    case 'Me':
    case 'Ri':
      return 'triangleDown';
    case 'Mi':
      return 'triangleUp';
    case 'Fa':
    case 'Se':
      return 'halfCircleLeft';
    case 'Fi':
      return 'cross';
    case 'So':
    case 'Si':
      return 'halfCircleRight';
    case 'Le':
      return 'triangleDown';
    case 'La':
    case 'Li':
      return 'triangleUp';
    case 'Te':
    case 'Ti':
      return 'diamond';
    default:
      return 'circle';
  }
}

/**
 * Metric Grammar Cadential Chain single block definitions.
 */
const SINGLE_BLOCK_DEFINITIONS: Record<string, { pulses: string[]; timeSig: string }> = {
  Dox: { pulses: ['Dox'], timeSig: '1/4' },
  DoSo: { pulses: ['Dox', 'So'], timeSig: '2/4' },
  DoRe: { pulses: ['Dox', 'Re', 'So'], timeSig: '3/4' },
  DoLa: { pulses: ['Dox', 'La', 'Re', 'So'], timeSig: '4/4' },
  DoMi: { pulses: ['Dox', 'Mi', 'La', 'Re', 'So'], timeSig: '5/4' },
  DoSi: { pulses: ['Dox', 'Si', 'Mi', 'La', 'Re', 'So'], timeSig: '6/8' },
  DoFi: { pulses: ['Dox', 'Fi', 'Si', 'Mi', 'La', 'Re', 'So'], timeSig: '7/4' },
  DoRa: { pulses: ['Dox', 'Ra', 'Fi', 'Si', 'Mi', 'La', 'Re', 'So'], timeSig: '8/4' },
};

/**
 * Resolves a high-level metric grammar specification into an explicit beat pulse pattern.
 * Supports Solfège cadential chains (e.g. "DoLa", "DoRe", "DoLaDiLa", "DoReDiRe") or arrays (e.g. ["Dox", "Re", "So"]).
 */
export function resolveMetricGrammar(
  pulseSpec: string | string[] | undefined,
): ResolvedMetricGrammar {
  if (!pulseSpec) {
    pulseSpec = 'DoLa';
  }

  // If passed as array of pulse token strings: e.g. ["Dox", "Re", "So"] or ["Do", "Re", "So"]
  if (Array.isArray(pulseSpec)) {
    const rawTokens = pulseSpec;
    const pulses: MetricPulseOnset[] = rawTokens.map((tok, idx) => {
      const isPrimary = tok.startsWith('Do') || tok.startsWith('Dox') || idx === 0;
      const isSecondary = tok.startsWith('Di') || tok.startsWith('Dix');
      const weight: BeatWeight = isPrimary ? 'primary' : isSecondary ? 'secondary' : 'weak';
      const formattedSyllable = idx === 0 && !tok.includes('x') ? `${tok}x` : tok;
      return {
        beatIndex: idx,
        startBeat: idx,
        durationBeats: 1.0,
        syllable: formattedSyllable,
        weight,
        shape: solfegeToGlyphShape(tok),
        lilypondDuration: '4',
      };
    });
    return {
      label: rawTokens.join(' '),
      totalBeats: pulses.length,
      pulses,
      timeSignature: `${pulses.length}/4`,
    };
  }

  const spec = pulseSpec.trim();

  // 1. Check exact single block
  if (SINGLE_BLOCK_DEFINITIONS[spec]) {
    const def = SINGLE_BLOCK_DEFINITIONS[spec];
    const pulses: MetricPulseOnset[] = def.pulses.map((tok, idx) => ({
      beatIndex: idx,
      startBeat: idx,
      durationBeats: 1.0,
      syllable: tok,
      weight: idx === 0 ? 'primary' : 'weak',
      shape: solfegeToGlyphShape(tok),
      lilypondDuration: '4',
    }));
    return {
      label: spec,
      totalBeats: pulses.length,
      pulses,
      timeSignature: def.timeSig,
    };
  }

  // 2. Compound metric chains
  if (spec === 'DoLaDiLa' || spec === 'DoSoDiSo') {
    const tokens = spec === 'DoLaDiLa'
      ? ['Dox', 'La', 'Dix', 'So']
      : ['Dox', 'So', 'Dix', 'So'];
    const pulses: MetricPulseOnset[] = tokens.map((tok, idx) => ({
      beatIndex: idx,
      startBeat: idx,
      durationBeats: 1.0,
      syllable: tok,
      weight: idx === 0 ? 'primary' : idx === 2 ? 'secondary' : 'weak',
      shape: solfegeToGlyphShape(tok),
      lilypondDuration: '4',
    }));
    return {
      label: spec,
      totalBeats: tokens.length,
      pulses,
      timeSignature: '4/4',
    };
  }

  if (spec === 'DoReDiRe') {
    const tokens = ['Dox', 'Re', 'So', 'Dix', 'Re', 'So'];
    const pulses: MetricPulseOnset[] = tokens.map((tok, idx) => ({
      beatIndex: idx,
      startBeat: idx,
      durationBeats: 1.0,
      syllable: tok,
      weight: idx === 0 ? 'primary' : idx === 3 ? 'secondary' : 'weak',
      shape: solfegeToGlyphShape(tok),
      lilypondDuration: '4',
    }));
    return {
      label: spec,
      totalBeats: tokens.length,
      pulses,
      timeSignature: '6/8',
    };
  }

  if (spec === 'DoReDiSo') {
    const tokens = ['Dox', 'Re', 'So', 'Dix', 'So'];
    const pulses: MetricPulseOnset[] = tokens.map((tok, idx) => ({
      beatIndex: idx,
      startBeat: idx,
      durationBeats: 1.0,
      syllable: tok,
      weight: idx === 0 ? 'primary' : idx === 3 ? 'secondary' : 'weak',
      shape: solfegeToGlyphShape(tok),
      lilypondDuration: '4',
    }));
    return {
      label: spec,
      totalBeats: 5,
      pulses,
      timeSignature: '5/4',
    };
  }

  if (spec === 'DoSoDiRe') {
    const tokens = ['Dox', 'So', 'Dix', 'Re', 'So'];
    const pulses: MetricPulseOnset[] = tokens.map((tok, idx) => ({
      beatIndex: idx,
      startBeat: idx,
      durationBeats: 1.0,
      syllable: tok,
      weight: idx === 0 ? 'primary' : idx === 2 ? 'secondary' : 'weak',
      shape: solfegeToGlyphShape(tok),
      lilypondDuration: '4',
    }));
    return {
      label: spec,
      totalBeats: 5,
      pulses,
      timeSignature: '5/4',
    };
  }

  // 3. Fallback: space-separated tokens e.g. "Dox La Re So"
  const tokens = spec.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const pulses: MetricPulseOnset[] = tokens.map((tok, idx) => {
      const isPrimary = tok.startsWith('Do') || tok.startsWith('Dox') || idx === 0;
      const isSecondary = tok.startsWith('Di') || tok.startsWith('Dix');
      const weight: BeatWeight = isPrimary ? 'primary' : isSecondary ? 'secondary' : 'weak';
      const formattedSyllable = idx === 0 && !tok.includes('x') ? `${tok}x` : tok;
      return {
        beatIndex: idx,
        startBeat: idx,
        durationBeats: 1.0,
        syllable: formattedSyllable,
        weight,
        shape: solfegeToGlyphShape(tok),
        lilypondDuration: '4',
      };
    });
    return {
      label: spec,
      totalBeats: pulses.length,
      pulses,
      timeSignature: `${pulses.length}/4`,
    };
  }

  return resolveMetricGrammar('DoLa');
}

export const resolvePulseGrammar = resolveMetricGrammar;

/**
 * Tiled sequence of metric pulse onsets across a phrase/coil of totalBeats duration,
 * with support for startPhaseOffset (for pickup measures / continuous pulse alignment).
 */
export function resolveMetricPulseTimeline(
  pulseSpec: string | string[] | undefined,
  totalBeats: number,
  startPhaseOffset: number = 0,
): MetricPulseOnset[] {
  const grammar = resolveMetricGrammar(pulseSpec);
  if (grammar.pulses.length === 0 || totalBeats <= 0) return [];

  const result: MetricPulseOnset[] = [];
  const barBeats = grammar.totalBeats;

  let currentBeat = 0;
  while (currentBeat < totalBeats - 1e-4) {
    const beatInMeasure = Math.floor((currentBeat + startPhaseOffset) + 1e-5) % barBeats;
    const pulse = grammar.pulses[beatInMeasure] ?? grammar.pulses[0];
    const remainingCoilBeats = totalBeats - currentBeat;
    const dur = Math.min(pulse.durationBeats, remainingCoilBeats);

    result.push({
      beatIndex: result.length,
      startBeat: currentBeat,
      durationBeats: dur,
      syllable: pulse.syllable,
      weight: pulse.weight,
      shape: pulse.shape,
      lilypondDuration: beatsToLilyPondDuration(dur),
    });
    currentBeat += dur;
  }

  return result;
}
