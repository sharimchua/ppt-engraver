/**
 * Guitar Fretboard & Grip Solver for Prime Period Theory (PPT).
 * 
 * Computes ergonomic, playable string/fret assignments for melody and harmony on guitar.
 * Enforces maximum fret span constraints (ignoring open strings f=0)
 * and generates explicit string indicators (\1 through \6) for LilyPond TabStaff.
 */

import {
  parseHarmonyChord,
  solfegeToHarmonyRootOffset,
  getChordIntervals,
  SOLFEGE_POSITIONS,
} from './pitch.js';
import type { GuitarVoicing } from '../schema/tapestry.js';
export type { GuitarVoicing };

export interface GuitarStringTuning {
  /** 1-based string number: 1 is highest pitch (high E), 6 is lowest pitch (low E) */
  stringNumber: number;
  /** MIDI pitch of the open string */
  openMidi: number;
  /** Name of string pitch */
  name: string;
}

/** Standard 6-string guitar tuning: E4 (64), B3 (59), G3 (55), D3 (50), A2 (45), E2 (40) */
export const STANDARD_GUITAR_TUNING: GuitarStringTuning[] = [
  { stringNumber: 1, openMidi: 64, name: 'E4' },
  { stringNumber: 2, openMidi: 59, name: 'B3' },
  { stringNumber: 3, openMidi: 55, name: 'G3' },
  { stringNumber: 4, openMidi: 50, name: 'D3' },
  { stringNumber: 5, openMidi: 45, name: 'A2' },
  { stringNumber: 6, openMidi: 40, name: 'E2' },
];

export interface GuitarNotePosition {
  midiNote: number;
  scaleDegree: string;
  stringNumber: number; // 1 to 6
  fretNumber: number;   // 0 to 22
}

export interface GuitarGripSolveOptions {
  /** Guitar voicing style */
  voicing?: GuitarVoicing;
  /** Maximum allowable fret distance between simultaneous fretted notes (default: 4, e.g. 3 for smaller hands) */
  maxFretSpan?: number;
  /** Custom string tunings (defaults to standard 6-string tuning) */
  tunings?: GuitarStringTuning[];
  /** Reference Do MIDI pitch */
  knotDoMidi?: number;
  /** Maximum fret on the instrument (default: 20) */
  maxFret?: number;
  /** Whether this onset represents a chord change / new harmony onset */
  isChordChange?: boolean;
  /** Whether this onset is on a strong beat (e.g. beat 1 or 3) */
  isStrongBeat?: boolean;
  /** Whether to only voice chord grips on chord changes (default: true) */
  changesOnly?: boolean;
}

/**
 * Finds all playable (string, fret) positions for a single target MIDI note.
 */
export function getPlayablePositionsForMidi(
  midiNote: number,
  tunings: GuitarStringTuning[] = STANDARD_GUITAR_TUNING,
  maxFret: number = 20,
): Array<{ stringNumber: number; fretNumber: number }> {
  const positions: Array<{ stringNumber: number; fretNumber: number }> = [];
  for (const tuning of tunings) {
    const fret = midiNote - tuning.openMidi;
    if (fret >= 0 && fret <= maxFret) {
      positions.push({ stringNumber: tuning.stringNumber, fretNumber: fret });
    }
  }
  return positions;
}

/**
 * Computes the physical fret span across an array of frets.
 * Open strings (fret 0) do not require finger stretching, so they are excluded from span calculation.
 */
export function calculateFretSpan(frets: number[]): number {
  const fretted = frets.filter(f => f > 0);
  if (fretted.length <= 1) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

/**
 * Checks whether a set of fret positions is physically playable within the maximum fret span.
 */
export function isGripPlayable(
  positions: Array<{ stringNumber: number; fretNumber: number }>,
  maxFretSpan: number = 4,
): boolean {
  // Check no duplicate strings
  const stringSet = new Set(positions.map(p => p.stringNumber));
  if (stringSet.size !== positions.length) return false;

  const frets = positions.map(p => p.fretNumber);
  const span = calculateFretSpan(frets);
  return span <= maxFretSpan;
}

/**
 * Scores a candidate guitar grip: lower score = more natural and ergonomic.
 * Favors lower positions, open strings, smaller fret spans, and natural string order.
 */
export function scoreGrip(
  positions: Array<{ stringNumber: number; fretNumber: number }>,
  maxFretSpan: number = 4,
): number {
  if (!isGripPlayable(positions, maxFretSpan)) return Infinity;

  const frets = positions.map(p => p.fretNumber);
  const fretted = frets.filter(f => f > 0);
  const span = calculateFretSpan(frets);

  let score = span * 10;

  // Add penalty for high fret positions (favor open / low position)
  if (fretted.length > 0) {
    const minFret = Math.min(...fretted);
    score += minFret * 2;
  }

  // Bonus for using open strings
  const openCount = frets.filter(f => f === 0).length;
  score -= openCount * 8;

  return score;
}

/**
 * Selects the optimal (string, fret) position for a single melody note.
 */
export function findBestSingleNotePosition(
  midiNote: number,
  tunings: GuitarStringTuning[] = STANDARD_GUITAR_TUNING,
  preferredMaxFret: number = 12,
): { stringNumber: number; fretNumber: number } | null {
  const candidates = getPlayablePositionsForMidi(midiNote, tunings, 20);
  if (candidates.length === 0) return null;

  // Sort by fret closeness to preferred range (frets 0-5 first, then 5-12)
  candidates.sort((a, b) => {
    // Favor open strings
    if (a.fretNumber === 0 && b.fretNumber !== 0) return -1;
    if (b.fretNumber === 0 && a.fretNumber !== 0) return 1;

    // Favor low frets (0 to 12)
    const penaltyA = a.fretNumber > preferredMaxFret ? (a.fretNumber - preferredMaxFret) * 5 : a.fretNumber;
    const penaltyB = b.fretNumber > preferredMaxFret ? (b.fretNumber - preferredMaxFret) * 5 : b.fretNumber;
    return penaltyA - penaltyB;
  });

  return candidates[0];
}

/**
 * Solves the optimal guitar grip combining a primary melody note with
 * harmonic accompaniment notes (root, chord tones, guide tones) adhering to maxFretSpan.
 */
export function solveGuitarGrip(
  melodyMidi: number,
  melodyScaleDegree: string,
  chordRootToken?: string,
  options: GuitarGripSolveOptions = {},
): GuitarNotePosition[] {
  const voicing = options.voicing ?? 'melodyOnly';
  const maxFretSpan = options.maxFretSpan ?? 4;
  const tunings = options.tunings ?? STANDARD_GUITAR_TUNING;
  const knotDoMidi = options.knotDoMidi ?? 60;

  const changesOnly = options.changesOnly ?? true;
  const isChordChange = options.isChordChange ?? true;
  const isStrongBeat = options.isStrongBeat ?? false;

  // If voicing is changesOnly and this onset is not a chord change (and not a strong beat in chordMelody mode),
  // return single melody note
  if (voicing !== 'melodyOnly' && chordRootToken && changesOnly) {
    if (!isChordChange) {
      if (voicing === 'chordMelody') {
        if (!isStrongBeat) {
          const pos = findBestSingleNotePosition(melodyMidi, tunings);
          return [{
            midiNote: melodyMidi,
            scaleDegree: melodyScaleDegree,
            stringNumber: pos?.stringNumber ?? 1,
            fretNumber: pos?.fretNumber ?? Math.max(0, melodyMidi - 64),
          }];
        }
      } else {
        const pos = findBestSingleNotePosition(melodyMidi, tunings);
        return [{
          midiNote: melodyMidi,
          scaleDegree: melodyScaleDegree,
          stringNumber: pos?.stringNumber ?? 1,
          fretNumber: pos?.fretNumber ?? Math.max(0, melodyMidi - 64),
        }];
      }
    }
  }

  // 1. Melody Only: single note
  if (voicing === 'melodyOnly' || !chordRootToken) {
    const pos = findBestSingleNotePosition(melodyMidi, tunings);
    if (!pos) {
      // Fallback: assign to string 1 or nearest
      return [{
        midiNote: melodyMidi,
        scaleDegree: melodyScaleDegree,
        stringNumber: 1,
        fretNumber: Math.max(0, melodyMidi - 64),
      }];
    }
    return [{
      midiNote: melodyMidi,
      scaleDegree: melodyScaleDegree,
      stringNumber: pos.stringNumber,
      fretNumber: pos.fretNumber,
    }];
  }

  // Parse active harmony
  const parsedChord = parseHarmonyChord(chordRootToken);
  const rootOffset = solfegeToHarmonyRootOffset(parsedChord.rootSyllable);
  const intervals = getChordIntervals(parsedChord.quality);

  // Determine candidate accompaniment pitches in guitar bass / tenor registers (MIDI 40-60)
  let rawRootMidi = knotDoMidi + rootOffset + (parsedChord.octaveShift * 12);
  while (rawRootMidi >= 55) rawRootMidi -= 12;
  while (rawRootMidi < 40) rawRootMidi += 12;

  // Derive accompaniment candidates based on voicing style
  interface AccCandidate {
    midiNote: number;
    scaleDegree: string;
    priority: number; // 1 = highest
    isRoot?: boolean;
  }
  const accCandidates: AccCandidate[] = [];

  const thirdInterval = intervals.find(i => i === 3 || i === 4) ?? 4;
  const seventhInterval = intervals.find(i => i === 10 || i === 11);
  const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;

  function midiToChromaticDegree(midi: number): string {
    const semitone = ((midi - knotDoMidi) % 12 + 12) % 12;
    return SOLFEGE_POSITIONS[semitone];
  }

  const rootPitchClass = ((rawRootMidi % 12) + 12) % 12;
  const melodyPitchClass = ((melodyMidi % 12) + 12) % 12;

  if (voicing === 'root' || voicing === 'bassAndMelody') {
    // Melody + Bass Root only (pure 2-part bass & melody)
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
  } else if (voicing === 'shell' || voicing === 'guideTones') {
    // 1. Bass Root
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < melodyMidi) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }
    // 2. 7th guide tone
    if (seventhInterval !== undefined) {
      let sevMidi = rawRootMidi + seventhInterval;
      while (sevMidi >= melodyMidi) sevMidi -= 12;
      if (sevMidi > 40) {
        accCandidates.push({ midiNote: sevMidi, scaleDegree: midiToChromaticDegree(sevMidi), priority: 2 });
      }
    }
    // 3. 3rd guide tone
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= melodyMidi) thirdMidi -= 12;
    if (thirdMidi > 40) {
      accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
    }
  } else if (voicing === 'chordMelody') {
    // Jazz Chord Melody:
    // 1. Bass Root (Priority 1 - foundation on string 6, 5, or 4)
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < melodyMidi) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }

    // 2. 7th guide tone
    if (seventhInterval !== undefined) {
      let sevMidi = rawRootMidi + seventhInterval;
      while (sevMidi >= melodyMidi) sevMidi -= 12;
      if (sevMidi > 40) {
        accCandidates.push({ midiNote: sevMidi, scaleDegree: midiToChromaticDegree(sevMidi), priority: 2 });
      }
      if (sevMidi + 12 < melodyMidi) {
        accCandidates.push({ midiNote: sevMidi + 12, scaleDegree: midiToChromaticDegree(sevMidi + 12), priority: 2 });
      }
    }

    // 3. 3rd guide tone (if not already the melody note)
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= melodyMidi) thirdMidi -= 12;
    if (thirdMidi > 40 && ((thirdMidi % 12 + 12) % 12 !== melodyPitchClass)) {
      accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
    }
    if (thirdMidi + 12 < melodyMidi && (((thirdMidi + 12) % 12 + 12) % 12 !== melodyPitchClass)) {
      accCandidates.push({ midiNote: thirdMidi + 12, scaleDegree: midiToChromaticDegree(thirdMidi + 12), priority: 2 });
    }

    // 4. 5th degree
    let fifthMidi = rawRootMidi + fifthInterval;
    while (fifthMidi >= melodyMidi) fifthMidi -= 12;
    if (fifthMidi > 40) {
      accCandidates.push({ midiNote: fifthMidi, scaleDegree: midiToChromaticDegree(fifthMidi), priority: 3 });
    }
    if (fifthMidi + 12 < melodyMidi) {
      accCandidates.push({ midiNote: fifthMidi + 12, scaleDegree: midiToChromaticDegree(fifthMidi + 12), priority: 3 });
    }
  } else if (voicing === 'triad' || voicing === 'rootChordTones' || voicing === 'auto') {
    // 1. Bass Root
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < melodyMidi) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }
    // 2. 3rd
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= melodyMidi) thirdMidi -= 12;
    if (thirdMidi > 40) {
      accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
    }
    // 3. 5th
    let fifthMidi = rawRootMidi + fifthInterval;
    while (fifthMidi >= melodyMidi) fifthMidi -= 12;
    if (fifthMidi > 40) {
      accCandidates.push({ midiNote: fifthMidi, scaleDegree: midiToChromaticDegree(fifthMidi), priority: 3 });
    }
  }

  // Find candidate positions for melody note (prefer strings 1, 2, 3)
  const melodyPositions = getPlayablePositionsForMidi(melodyMidi, tunings, 20);
  if (melodyPositions.length === 0) {
    return [{
      midiNote: melodyMidi,
      scaleDegree: midiToChromaticDegree(melodyMidi),
      stringNumber: 1,
      fretNumber: Math.max(0, melodyMidi - 64),
    }];
  }

  let bestGrip: GuitarNotePosition[] = [];
  let bestScore = Infinity;

  // Try each melody position and attempt to build a playable accompaniment grip
  for (const melPos of melodyPositions) {
    const currentMelodyItem: GuitarNotePosition = {
      midiNote: melodyMidi,
      scaleDegree: midiToChromaticDegree(melodyMidi),
      stringNumber: melPos.stringNumber,
      fretNumber: melPos.fretNumber,
    };

    // Filter accompaniment candidates that don't clash with melody string
    const availableStrings = tunings
      .map(t => t.stringNumber)
      .filter(s => s > melPos.stringNumber); // Lower pitched strings only

    const gripItems: GuitarNotePosition[] = [currentMelodyItem];

    // Sort accCandidates so priority 1 (Root) is placed first
    const sortedCandidates = [...accCandidates].sort((a, b) => a.priority - b.priority);

    for (const acc of sortedCandidates) {
      // Don't duplicate pitches already in grip
      if (gripItems.some(item => item.midiNote === acc.midiNote)) continue;

      // Find best playable string for this accompaniment note
      const accPositions = getPlayablePositionsForMidi(acc.midiNote, tunings, 20)
        .filter(pos => availableStrings.includes(pos.stringNumber) && !gripItems.some(i => i.stringNumber === pos.stringNumber));

      if (accPositions.length === 0) continue;

      // Check which candidate position works within maxFretSpan
      let bestAccPos: { stringNumber: number; fretNumber: number } | null = null;
      let minAccScore = Infinity;

      for (const pos of accPositions) {
        const testGrip = [...gripItems, {
          midiNote: acc.midiNote,
          scaleDegree: acc.scaleDegree,
          stringNumber: pos.stringNumber,
          fretNumber: pos.fretNumber,
        }];

        const s = scoreGrip(testGrip, maxFretSpan);
        if (s < minAccScore) {
          minAccScore = s;
          bestAccPos = pos;
        }
      }

      if (bestAccPos && minAccScore < Infinity) {
        gripItems.push({
          midiNote: acc.midiNote,
          scaleDegree: acc.scaleDegree,
          stringNumber: bestAccPos.stringNumber,
          fretNumber: bestAccPos.fretNumber,
        });
      }
    }

    const totalScore = scoreGrip(gripItems, maxFretSpan);
    // Find lowest pitch (bass note) in grip
    const lowestNote = [...gripItems].sort((a, b) => a.midiNote - b.midiNote)[0];
    const hasRootInBass = lowestNote && ((lowestNote.midiNote % 12 + 12) % 12 === rootPitchClass);

    // Prefer grips with root in the bass, and more notes if scores are comparable
    let adjustedScore = totalScore - (gripItems.length * 6);
    if (hasRootInBass) {
      adjustedScore -= 20; // Major bonus for root in the bass
    } else if (gripItems.length > 1) {
      adjustedScore += 15; // Penalty for inverted bass
    }

    if (adjustedScore < bestScore) {
      bestScore = adjustedScore;
      bestGrip = gripItems;
    }
  }

  // Return sorted from lowest string (string 6) to highest string (string 1)
  return bestGrip.length > 0
    ? bestGrip.sort((a, b) => b.stringNumber - a.stringNumber)
    : [{
        midiNote: melodyMidi,
        scaleDegree: melodyScaleDegree,
        stringNumber: melodyPositions[0]?.stringNumber ?? 1,
        fretNumber: melodyPositions[0]?.fretNumber ?? 0,
      }];
}

/**
 * Solves a standalone guitar chord grip (e.g. for chord changes occurring on
 * rhythmic anticipations or rests where there is no concurrent melody note).
 */
export function solveStandaloneHarmonyGrip(
  chordRootToken: string,
  options: GuitarGripSolveOptions = {},
): GuitarNotePosition[] {
  const voicing = options.voicing ?? 'auto';
  const maxFretSpan = options.maxFretSpan ?? 4;
  const tunings = options.tunings ?? STANDARD_GUITAR_TUNING;
  const knotDoMidi = options.knotDoMidi ?? 60;

  const parsedChord = parseHarmonyChord(chordRootToken);
  const rootOffset = solfegeToHarmonyRootOffset(parsedChord.rootSyllable);
  const intervals = getChordIntervals(parsedChord.quality);

  function midiToChromaticDegree(midi: number): string {
    const semitone = ((midi - knotDoMidi) % 12 + 12) % 12;
    return SOLFEGE_POSITIONS[semitone];
  }

  let rawRootMidi = knotDoMidi + rootOffset + (parsedChord.octaveShift * 12);
  while (rawRootMidi >= 55) rawRootMidi -= 12;
  while (rawRootMidi < 40) rawRootMidi += 12;

  // Root on bass string (string 6, 5, or 4)
  const rootPositions = getPlayablePositionsForMidi(rawRootMidi, tunings, 20)
    .concat(rawRootMidi + 12 < 60 ? getPlayablePositionsForMidi(rawRootMidi + 12, tunings, 20) : [])
    .filter(p => p.stringNumber >= 4); // Bass strings only

  if (rootPositions.length === 0) {
    const fallback = getPlayablePositionsForMidi(rawRootMidi, tunings, 20)[0];
    return fallback ? [{
      midiNote: rawRootMidi,
      scaleDegree: midiToChromaticDegree(rawRootMidi),
      stringNumber: fallback.stringNumber,
      fretNumber: fallback.fretNumber,
    }] : [];
  }

  if (voicing === 'root' || voicing === 'bassAndMelody') {
    // Single bass root
    const bestRoot = rootPositions.sort((a, b) => {
      if (a.fretNumber === 0 && b.fretNumber !== 0) return -1;
      if (b.fretNumber === 0 && a.fretNumber !== 0) return 1;
      return a.fretNumber - b.fretNumber;
    })[0];
    const actualRootMidi = tunings.find(t => t.stringNumber === bestRoot.stringNumber)!.openMidi + bestRoot.fretNumber;
    return [{
      midiNote: actualRootMidi,
      scaleDegree: midiToChromaticDegree(actualRootMidi),
      stringNumber: bestRoot.stringNumber,
      fretNumber: bestRoot.fretNumber,
    }];
  }

  // Chord tones
  const thirdInterval = intervals.find(i => i === 3 || i === 4) ?? 4;
  const seventhInterval = intervals.find(i => i === 10 || i === 11);
  const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;

  let bestGrip: GuitarNotePosition[] = [];
  let bestScore = Infinity;

  for (const rPos of rootPositions) {
    const actualRootMidi = tunings.find(t => t.stringNumber === rPos.stringNumber)!.openMidi + rPos.fretNumber;
    const gripItems: GuitarNotePosition[] = [{
      midiNote: actualRootMidi,
      scaleDegree: midiToChromaticDegree(actualRootMidi),
      stringNumber: rPos.stringNumber,
      fretNumber: rPos.fretNumber,
    }];

    // Build accompaniment candidate pitches for higher strings
    const candidates: Array<{ midiNote: number; priority: number }> = [];
    // 7th
    if (seventhInterval !== undefined) {
      let sev = actualRootMidi + seventhInterval;
      if (sev < 72) candidates.push({ midiNote: sev, priority: 1 });
      if (sev + 12 < 72) candidates.push({ midiNote: sev + 12, priority: 1 });
    }
    // 3rd
    let third = actualRootMidi + thirdInterval;
    if (third < 72) candidates.push({ midiNote: third, priority: 2 });
    if (third + 12 < 72) candidates.push({ midiNote: third + 12, priority: 2 });
    // 5th
    let fifth = actualRootMidi + fifthInterval;
    if (fifth < 72) candidates.push({ midiNote: fifth, priority: 3 });
    if (fifth + 12 < 72) candidates.push({ midiNote: fifth + 12, priority: 3 });

    candidates.sort((a, b) => a.priority - b.priority);

    const availableStrings = tunings
      .map(t => t.stringNumber)
      .filter(s => s < rPos.stringNumber); // Higher pitched strings only

    for (const cand of candidates) {
      if (gripItems.some(i => i.midiNote === cand.midiNote)) continue;
      const cPositions = getPlayablePositionsForMidi(cand.midiNote, tunings, 20)
        .filter(p => availableStrings.includes(p.stringNumber) && !gripItems.some(i => i.stringNumber === p.stringNumber));

      if (cPositions.length === 0) continue;

      let bestCandPos: { stringNumber: number; fretNumber: number } | null = null;
      let minScore = Infinity;

      for (const pos of cPositions) {
        const testGrip = [...gripItems, {
          midiNote: cand.midiNote,
          scaleDegree: midiToChromaticDegree(cand.midiNote),
          stringNumber: pos.stringNumber,
          fretNumber: pos.fretNumber,
        }];
        const s = scoreGrip(testGrip, maxFretSpan);
        if (s < minScore) {
          minScore = s;
          bestCandPos = pos;
        }
      }

      if (bestCandPos && minScore < Infinity) {
        gripItems.push({
          midiNote: cand.midiNote,
          scaleDegree: midiToChromaticDegree(cand.midiNote),
          stringNumber: bestCandPos.stringNumber,
          fretNumber: bestCandPos.fretNumber,
        });
      }
    }

    const totalScore = scoreGrip(gripItems, maxFretSpan) - (gripItems.length * 6);
    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestGrip = gripItems;
    }
  }

  return bestGrip.length > 0
    ? bestGrip.sort((a, b) => b.stringNumber - a.stringNumber)
    : [];
}
