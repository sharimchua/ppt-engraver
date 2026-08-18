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
  splitCompoundDox: boolean = true,
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
        if (splitCompoundDox) {
          let t = token;
          while (t.startsWith('Dox') && t.length > 3) {
            result.push('Dox');
            t = t.slice(3);
          }
          result.push(t);
        } else {
          result.push(token);
        }
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
        // Dox prefix skips over the next downbeat(s)
        currentBeat += 1 + p.beatSkips;
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

    const startBeat = currentBeat + p.offsetInBeat;
    timestamps.push(startBeat);
    prevOffsetInBeat = p.offsetInBeat;
  }

  // Calculate durations: delta to next onset; for final onset, round up to next beat boundary
  const result: ResolvedRhythmOnset[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const startBeat = timestamps[i];
    let durationBeats: number;

    if (i < timestamps.length - 1) {
      durationBeats = timestamps[i + 1] - startBeat;
    } else {
      // Final note: extend to the next beat boundary (at least 1.0 beat if starting on downbeat)
      const nextBeatBoundary = Math.floor(startBeat) + 1;
      durationBeats = nextBeatBoundary > startBeat
        ? nextBeatBoundary - startBeat
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
