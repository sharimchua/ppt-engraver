/**
 * Prime Period Theory (PPT) — Solfège Scale Grammar Module
 *
 * Implements pure Solfège-based scale parsing, mode offset resolution,
 * modifier slot overrides, and LilyPond key signature mode inference.
 */

import { SOLFEGE_TO_SEMITONE, SOLFEGE_POSITIONS } from './pitch.js';

export interface ParsedScale {
  /** The root / mode offset syllable, e.g. "Do", "Re", "La" */
  root: string;
  /** Suffix modifiers if any, e.g. ["Me", "Le"] */
  modifiers: string[];
  /** Solfège degree syllables relative to Do, e.g. ["Do", "Re", "Me", "Fa", "So", "Le", "Ti"] */
  syllables: string[];
  /** Semitone offsets relative to Do, e.g. [0, 2, 3, 5, 7, 8, 11] */
  semitoneIntervals: number[];
  /** Inferred LilyPond mode string, e.g. "major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian" */
  lilypondMode: string;
  /** Normalized scale expression string, e.g. "Do", "LaTi", "DoMe" */
  scaleString: string;
}

/**
 * 7 Diatonic Modes interval patterns rotated to the tonic Do.
 */
export const DIATONIC_MODE_PATTERNS: Record<string, number[]> = {
  Do: [0, 2, 4, 5, 7, 9, 11], // Ionian (Default)
  Re: [0, 2, 3, 5, 7, 9, 10], // Dorian
  Mi: [0, 1, 3, 5, 7, 8, 10], // Phrygian
  Fa: [0, 2, 4, 6, 7, 9, 11], // Lydian
  So: [0, 2, 4, 5, 7, 9, 10], // Mixolydian
  La: [0, 2, 3, 5, 7, 8, 10], // Aeolian
  Ti: [0, 1, 3, 5, 6, 8, 10], // Locrian
};

/**
 * Maps a modifier syllable to its scale degree slot index (0 to 6).
 */
function getModifierDegreeIndex(syllable: string, semitone: number): number {
  const norm = syllable.charAt(0).toUpperCase() + syllable.slice(1).toLowerCase();
  switch (norm) {
    case 'Ra':
    case 'Di':
    case 'Re':
      return 1; // Degree 2
    case 'Me':
    case 'Ri':
    case 'Mi':
      return 2; // Degree 3
    case 'Fa':
      return 3; // Degree 4
    case 'Fi':
    case 'Se':
      // Fi can modify 4th (#4) or 5th (b5)
      return 3; // Degree 4 (#4)
    case 'So':
      return 4; // Degree 5
    case 'Si':
    case 'Le':
    case 'La':
      return 5; // Degree 6
    case 'Li':
    case 'Te':
    case 'Ti':
      return 6; // Degree 7
    default:
      if (semitone <= 2) return 1;
      if (semitone <= 4) return 2;
      if (semitone <= 6) return 3;
      if (semitone <= 7) return 4;
      if (semitone <= 9) return 5;
      return 6;
  }
}

/**
 * Infers the LilyPond key signature mode from a 7-degree semitone interval array.
 */
export function inferLilyPondModeFromIntervals(intervals: number[]): string {
  const key = intervals.join(',');
  if (key === '0,2,4,5,7,9,11') return 'major';
  if (key === '0,2,3,5,7,9,10') return 'dorian';
  if (key === '0,1,3,5,7,8,10') return 'phrygian';
  if (key === '0,2,4,6,7,9,11') return 'lydian';
  if (key === '0,2,4,5,7,9,10') return 'mixolydian';
  if (key === '0,2,3,5,7,8,10') return 'minor';
  if (key === '0,1,3,5,6,8,10') return 'locrian';

  // For altered scales, check degree 3:
  const third = intervals[2] ?? 4;
  return third === 3 ? 'minor' : 'major';
}

/**
 * Parses a scale definition into a fully resolved ParsedScale.
 *
 * Supports:
 * - Single Solfège mode roots: "Do", "Re", "Mi", "Fa", "So", "La", "Ti"
 * - Solfège mode root + modifier suffixes: "DoMe", "DoMeLe", "LaTi", "DoFiTe", "DoMeLeTe"
 * - Explicit Solfège arrays: ["Do", "Re", "Me", "Fa", "So", "Le", "Ti"]
 * - Space/comma-separated Solfège strings: "Do Re Me Fa So Le Ti"
 * - Defaults to standard Ionian "Do" ([0, 2, 4, 5, 7, 9, 11]) when empty/undefined.
 */
export function parseScaleDefinition(scaleInput?: string | string[]): ParsedScale {
  if (!scaleInput || (Array.isArray(scaleInput) && scaleInput.length === 0)) {
    const intervals = [...DIATONIC_MODE_PATTERNS.Do];
    const syllables = intervals.map(st => SOLFEGE_POSITIONS[st]);
    return {
      root: 'Do',
      modifiers: [],
      syllables,
      semitoneIntervals: intervals,
      lilypondMode: 'major',
      scaleString: 'Do',
    };
  }

  // 1. Array or space/comma separated list of discrete Solfège syllables
  if (Array.isArray(scaleInput) || (typeof scaleInput === 'string' && /[\s,]/.test(scaleInput.trim()))) {
    const rawTokens = Array.isArray(scaleInput)
      ? scaleInput
      : scaleInput.trim().split(/[\s,]+/);

    const syllables: string[] = [];
    const semitoneIntervals: number[] = [];

    for (const raw of rawTokens) {
      const clean = raw.trim();
      if (!clean) continue;
      const norm = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase().replace(/x$/i, '');
      const st = SOLFEGE_TO_SEMITONE[norm];
      if (st !== undefined) {
        syllables.push(norm);
        semitoneIntervals.push(st);
      }
    }

    if (syllables.length === 0) {
      return parseScaleDefinition('Do');
    }

    const firstSyl = syllables[0];
    const root = firstSyl === 'Do' ? 'Do' : firstSyl;
    const lilypondMode = inferLilyPondModeFromIntervals(semitoneIntervals);

    return {
      root,
      modifiers: syllables.slice(1),
      syllables,
      semitoneIntervals,
      lilypondMode,
      scaleString: syllables.join(''),
    };
  }

  // 2. Continuous Solfège string, e.g. "Do", "Re", "LaTi", "DoMeLe", "DoFiTe"
  const clean = scaleInput.trim();
  const SYL_REGEX = /(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)/gi;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = SYL_REGEX.exec(clean)) !== null) {
    matches.push(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase());
  }

  if (matches.length === 0) {
    return parseScaleDefinition('Do');
  }

  const rootSyl = matches[0];
  const modifierSyls = matches.slice(1);

  // Initialize from base mode pattern if known, otherwise default to Ionian
  const basePattern = DIATONIC_MODE_PATTERNS[rootSyl] ?? DIATONIC_MODE_PATTERNS.Do;
  const intervals = [...basePattern];

  // Apply modifier slot overrides
  for (const mod of modifierSyls) {
    const semitone = SOLFEGE_TO_SEMITONE[mod];
    if (semitone !== undefined) {
      const degreeIdx = getModifierDegreeIndex(mod, semitone);
      intervals[degreeIdx] = semitone;
    }
  }

  // Map 7 intervals to canonical Solfège syllables
  const syllables = intervals.map(st => SOLFEGE_POSITIONS[st] ?? 'Do');
  const lilypondMode = inferLilyPondModeFromIntervals(intervals);

  return {
    root: rootSyl,
    modifiers: modifierSyls,
    syllables,
    semitoneIntervals: intervals,
    lilypondMode,
    scaleString: clean,
  };
}
