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
import type { GuitarVoicing, GuitarTabMovement, GuitarTabScope } from '../schema/tapestry.js';
export type { GuitarVoicing, GuitarTabMovement, GuitarTabScope };

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

export interface GuitarPassageOnset {
  midiNote: number;
  scaleDegree: string;
  chordRoot?: string;
  isRest?: boolean;
  isChordChange?: boolean;
  isStrongBeat?: boolean;
  durationBeats?: number;
  startBeat?: number;
  onsetIndex?: number;
  coilId?: string;
}

export interface GuitarGripSolveOptions {
  /** Guitar voicing style */
  voicing?: GuitarVoicing;
  /** Movement priority: 'vertical' (limits horizontal fret shifts) | 'horizontal' (limits string changes) */
  movement?: GuitarTabMovement;
  /** Phrasing solver scope: 'coil' (default: within coil) | 'continuous' (across coil boundaries) */
  scope?: GuitarTabScope;
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

export type GuitarPassageSolveOptions = GuitarGripSolveOptions;

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
 * Generates all valid candidate guitar grips for a passage onset.
 */
export function getCandidateGripsForOnset(
  onset: GuitarPassageOnset,
  options: GuitarPassageSolveOptions = {},
): GuitarNotePosition[][] {
  const voicing = options.voicing ?? 'melodyOnly';
  const maxFretSpan = options.maxFretSpan ?? 4;
  const tunings = options.tunings ?? STANDARD_GUITAR_TUNING;
  const knotDoMidi = options.knotDoMidi ?? 60;
  const maxFret = options.maxFret ?? 20;

  if (onset.isRest) {
    if (voicing !== 'melodyOnly' && onset.chordRoot && (onset.isChordChange || options.changesOnly === false)) {
      const standalone = solveStandaloneHarmonyGrip(onset.chordRoot, {
        voicing,
        maxFretSpan,
        knotDoMidi,
        tunings,
        maxFret,
      });
      return standalone.length > 0 ? [standalone] : [[]];
    }
    return [[]];
  }

  const changesOnly = options.changesOnly ?? true;
  const isChordChange = onset.isChordChange ?? true;
  const isStrongBeat = onset.isStrongBeat ?? false;

  const melodyPositions = getPlayablePositionsForMidi(onset.midiNote, tunings, maxFret);
  if (melodyPositions.length === 0) {
    return [[{
      midiNote: onset.midiNote,
      scaleDegree: onset.scaleDegree,
      stringNumber: 1,
      fretNumber: Math.max(0, onset.midiNote - 64),
    }]];
  }

  function midiToChromaticDegree(midi: number): string {
    const semitone = ((midi - knotDoMidi) % 12 + 12) % 12;
    return SOLFEGE_POSITIONS[semitone];
  }

  const isSingleNoteOnset =
    voicing === 'melodyOnly' ||
    !onset.chordRoot ||
    (changesOnly && !isChordChange && (voicing !== 'chordMelody' || !isStrongBeat));

  if (isSingleNoteOnset) {
    return melodyPositions.map((pos) => [{
      midiNote: onset.midiNote,
      scaleDegree: onset.scaleDegree || midiToChromaticDegree(onset.midiNote),
      stringNumber: pos.stringNumber,
      fretNumber: pos.fretNumber,
    }]);
  }

  // Harmonic accompaniment grips for each candidate melody position
  const parsedChord = parseHarmonyChord(onset.chordRoot!);
  const rootOffset = solfegeToHarmonyRootOffset(parsedChord.rootSyllable);
  const intervals = getChordIntervals(parsedChord.quality);

  let rawRootMidi = knotDoMidi + rootOffset + (parsedChord.octaveShift * 12);
  while (rawRootMidi >= 55) rawRootMidi -= 12;
  while (rawRootMidi < 40) rawRootMidi += 12;

  interface AccCandidate {
    midiNote: number;
    scaleDegree: string;
    priority: number;
    isRoot?: boolean;
  }
  const accCandidates: AccCandidate[] = [];

  const thirdInterval = intervals.find((i) => i === 3 || i === 4) ?? 4;
  const seventhInterval = intervals.find((i) => i === 10 || i === 11);
  const fifthInterval = intervals.find((i) => i === 7 || i === 6 || i === 8) ?? 7;

  const melodyPitchClass = ((onset.midiNote % 12) + 12) % 12;

  if (voicing === 'root' || voicing === 'bassAndMelody') {
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
  } else if (voicing === 'shell' || voicing === 'guideTones') {
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < onset.midiNote) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }
    if (seventhInterval !== undefined) {
      let sevMidi = rawRootMidi + seventhInterval;
      while (sevMidi >= onset.midiNote) sevMidi -= 12;
      if (sevMidi > 40) accCandidates.push({ midiNote: sevMidi, scaleDegree: midiToChromaticDegree(sevMidi), priority: 2 });
    }
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= onset.midiNote) thirdMidi -= 12;
    if (thirdMidi > 40) accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
  } else if (voicing === 'chordMelody') {
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < onset.midiNote) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }
    if (seventhInterval !== undefined) {
      let sevMidi = rawRootMidi + seventhInterval;
      while (sevMidi >= onset.midiNote) sevMidi -= 12;
      if (sevMidi > 40) accCandidates.push({ midiNote: sevMidi, scaleDegree: midiToChromaticDegree(sevMidi), priority: 2 });
      if (sevMidi + 12 < onset.midiNote) accCandidates.push({ midiNote: sevMidi + 12, scaleDegree: midiToChromaticDegree(sevMidi + 12), priority: 2 });
    }
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= onset.midiNote) thirdMidi -= 12;
    if (thirdMidi > 40 && ((thirdMidi % 12 + 12) % 12 !== melodyPitchClass)) {
      accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
    }
    if (thirdMidi + 12 < onset.midiNote && (((thirdMidi + 12) % 12 + 12) % 12 !== melodyPitchClass)) {
      accCandidates.push({ midiNote: thirdMidi + 12, scaleDegree: midiToChromaticDegree(thirdMidi + 12), priority: 2 });
    }
    let fifthMidi = rawRootMidi + fifthInterval;
    while (fifthMidi >= onset.midiNote) fifthMidi -= 12;
    if (fifthMidi > 40) accCandidates.push({ midiNote: fifthMidi, scaleDegree: midiToChromaticDegree(fifthMidi), priority: 3 });
    if (fifthMidi + 12 < onset.midiNote) accCandidates.push({ midiNote: fifthMidi + 12, scaleDegree: midiToChromaticDegree(fifthMidi + 12), priority: 3 });
  } else {
    // triad / auto
    accCandidates.push({ midiNote: rawRootMidi, scaleDegree: midiToChromaticDegree(rawRootMidi), priority: 1, isRoot: true });
    if (rawRootMidi + 12 < onset.midiNote) {
      accCandidates.push({ midiNote: rawRootMidi + 12, scaleDegree: midiToChromaticDegree(rawRootMidi + 12), priority: 1, isRoot: true });
    }
    let thirdMidi = rawRootMidi + thirdInterval;
    while (thirdMidi >= onset.midiNote) thirdMidi -= 12;
    if (thirdMidi > 40) accCandidates.push({ midiNote: thirdMidi, scaleDegree: midiToChromaticDegree(thirdMidi), priority: 2 });
    let fifthMidi = rawRootMidi + fifthInterval;
    while (fifthMidi >= onset.midiNote) fifthMidi -= 12;
    if (fifthMidi > 40) accCandidates.push({ midiNote: fifthMidi, scaleDegree: midiToChromaticDegree(fifthMidi), priority: 3 });
  }

  const candidateGrips: GuitarNotePosition[][] = [];

  for (const melPos of melodyPositions) {
    const currentMelodyItem: GuitarNotePosition = {
      midiNote: onset.midiNote,
      scaleDegree: onset.scaleDegree || midiToChromaticDegree(onset.midiNote),
      stringNumber: melPos.stringNumber,
      fretNumber: melPos.fretNumber,
    };

    const availableStrings = tunings
      .map((t) => t.stringNumber)
      .filter((s) => s > melPos.stringNumber);

    const gripItems: GuitarNotePosition[] = [currentMelodyItem];
    const sortedCandidates = [...accCandidates].sort((a, b) => a.priority - b.priority);

    for (const acc of sortedCandidates) {
      if (gripItems.some((item) => item.midiNote === acc.midiNote)) continue;
      const accPositions = getPlayablePositionsForMidi(acc.midiNote, tunings, maxFret)
        .filter((pos) => availableStrings.includes(pos.stringNumber) && !gripItems.some((i) => i.stringNumber === pos.stringNumber));

      if (accPositions.length === 0) continue;

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

    const sortedGrip = gripItems.sort((a, b) => b.stringNumber - a.stringNumber);
    candidateGrips.push(sortedGrip);
  }

  return candidateGrips.length > 0
    ? candidateGrips
    : melodyPositions.map((pos) => [{
        midiNote: onset.midiNote,
        scaleDegree: onset.scaleDegree || midiToChromaticDegree(onset.midiNote),
        stringNumber: pos.stringNumber,
        fretNumber: pos.fretNumber,
      }]);
}

/**
 * Scores an individual guitar grip candidate within a passage (lower = better).
 */
export function scorePassageNode(
  grip: GuitarNotePosition[],
  options: GuitarPassageSolveOptions = {},
): number {
  if (grip.length === 0) return 0;
  const maxFretSpan = options.maxFretSpan ?? 4;
  const movement = options.movement ?? 'vertical';

  if (!isGripPlayable(grip, maxFretSpan)) return Infinity;

  const frets = grip.map((p) => p.fretNumber);
  const span = calculateFretSpan(frets);

  let score = span * 10;

  // Open string bonus
  const openCount = frets.filter((f) => f === 0).length;
  score -= openCount * 2;

  // Melody note position
  const melNote = grip.find((n) => n.stringNumber <= 2) ?? grip[grip.length - 1] ?? grip[0];

  if (movement === 'vertical') {
    // In vertical mode, gently prefer lower/middle neck positions (frets 0 to 8)
    score += melNote.fretNumber * 0.3;
    if (melNote.fretNumber > 12) {
      score += (melNote.fretNumber - 12) * 6;
    }
  } else {
    // In horizontal mode, allow higher frets more freely (up to 15 without big penalty)
    if (melNote.fretNumber > 15) {
      score += (melNote.fretNumber - 15) * 5;
    }
  }

  // Chord richness bonus
  if (grip.length > 1) {
    score -= (grip.length * 5);
  }

  return score;
}

/**
 * Computes the ergonomic transition cost between two successive grips in a passage.
 */
export function scorePassageTransition(
  prevGrip: GuitarNotePosition[],
  currGrip: GuitarNotePosition[],
  movement: GuitarTabMovement = 'vertical',
): number {
  if (prevGrip.length === 0 || currGrip.length === 0) return 0;

  const prevMel = prevGrip.find((n) => n.stringNumber <= 2) ?? prevGrip[prevGrip.length - 1] ?? prevGrip[0];
  const currMel = currGrip.find((n) => n.stringNumber <= 2) ?? currGrip[currGrip.length - 1] ?? currGrip[0];

  const prevString = prevMel.stringNumber;
  const prevFret = prevMel.fretNumber;
  const currString = currMel.stringNumber;
  const currFret = currMel.fretNumber;

  const stringDiff = Math.abs(currString - prevString);
  const fretDiff = Math.abs(currFret - prevFret);

  if (movement === 'horizontal') {
    // Horizontal Mode: Minimize string changes, maximize linear single-string playing
    if (stringDiff === 0) {
      // Same string: ideal linear flow
      return fretDiff * 0.4;
    } else {
      // String change: penalize heavily to discourage leaving the current string
      const stringChangePenalty = 50 + (stringDiff - 1) * 25;
      return stringChangePenalty + (fretDiff * 1.5);
    }
  } else {
    // Vertical Mode (default): Minimize horizontal fret shifts, stay in hand position box
    let fretShiftCost = 0;
    if (prevFret === 0 && currFret === 0) {
      fretShiftCost = 0;
    } else if (prevFret === 0) {
      // Transitioning from open string to fretted note
      if (currFret <= 4) {
        fretShiftCost = currFret * 0.8;
      } else {
        fretShiftCost = 8 + (currFret - 4) * 1.5;
      }
    } else if (currFret === 0) {
      // Transitioning from fretted note to open string
      if (prevFret <= 4) {
        fretShiftCost = prevFret * 0.8;
      } else {
        // Active hand position is at upper frets; jumping down to open string disrupts position
        fretShiftCost = 14 + (prevFret - 4) * 2.0;
      }
    } else {
      // Both are fretted notes
      if (stringDiff === 0 && fretDiff >= 3) {
        // Shifting 3+ frets on the exact same string requires finger movement along the string
        fretShiftCost = fretDiff * 2.2;
      } else if (fretDiff <= 3) {
        // Comfortably inside standard 4-fret hand position box
        fretShiftCost = fretDiff * 1.0;
      } else if (fretDiff === 4) {
        fretShiftCost = 5;
      } else {
        // Position shift along neck: quadratic penalty
        fretShiftCost = 18 + (fretDiff - 4) * 8;
      }
    }

    // Moving vertically across strings in position
    let stringMoveCost = 0;
    if (stringDiff <= 2) {
      stringMoveCost = stringDiff * 1.2;
    } else {
      // Skipping 3+ strings
      stringMoveCost = stringDiff * 3.5;
    }

    return fretShiftCost + stringMoveCost;
  }
}

/**
 * Solves the globally optimal string/fret trajectory for an entire melodic & harmonic passage
 * using Dynamic Programming (Viterbi algorithm).
 */
export function solveGuitarPassage(
  onsets: GuitarPassageOnset[],
  options: GuitarPassageSolveOptions = {},
): GuitarNotePosition[][] {
  if (onsets.length === 0) return [];

  const movement = options.movement ?? 'vertical';
  const resolvedOptions: GuitarPassageSolveOptions = { ...options, movement };

  // Generate candidate grips for all onsets
  const allCandidates: GuitarNotePosition[][][] = onsets.map((onset) =>
    getCandidateGripsForOnset(onset, resolvedOptions)
  );

  const N = onsets.length;
  const dp: number[][] = [];
  const backpointer: number[][] = [];

  // Initialize first onset
  dp[0] = [];
  backpointer[0] = [];
  for (let k = 0; k < allCandidates[0].length; k++) {
    const candidate = allCandidates[0][k];
    dp[0][k] = scorePassageNode(candidate, resolvedOptions);
    backpointer[0][k] = -1;
  }

  // DP forward pass
  for (let i = 1; i < N; i++) {
    dp[i] = [];
    backpointer[i] = [];
    const currentCandidates = allCandidates[i];
    const prevCandidates = allCandidates[i - 1];
    const isNewCoilBoundary =
      resolvedOptions.scope !== 'continuous' &&
      Boolean(onsets[i].coilId && onsets[i - 1].coilId && onsets[i].coilId !== onsets[i - 1].coilId);

    for (let currIdx = 0; currIdx < currentCandidates.length; currIdx++) {
      const currGrip = currentCandidates[currIdx];
      const nodeCost = scorePassageNode(currGrip, resolvedOptions);

      let bestPrevCost = Infinity;
      let bestPrevIdx = 0;

      for (let prevIdx = 0; prevIdx < prevCandidates.length; prevIdx++) {
        const prevGrip = prevCandidates[prevIdx];
        const prevCumulative = dp[i - 1][prevIdx];
        if (prevCumulative === Infinity) continue;

        const transCost = isNewCoilBoundary
          ? 0
          : scorePassageTransition(prevGrip, currGrip, movement);
        const total = prevCumulative + transCost;

        if (total < bestPrevCost) {
          bestPrevCost = total;
          bestPrevIdx = prevIdx;
        }
      }

      dp[i][currIdx] = (bestPrevCost < Infinity ? bestPrevCost : 0) + nodeCost;
      backpointer[i][currIdx] = bestPrevIdx;
    }
  }

  // Find minimum in the last step
  let minFinalCost = Infinity;
  let bestFinalIdx = 0;
  for (let k = 0; k < allCandidates[N - 1].length; k++) {
    if (dp[N - 1][k] < minFinalCost) {
      minFinalCost = dp[N - 1][k];
      bestFinalIdx = k;
    }
  }

  // Backtrack optimal path
  const result: GuitarNotePosition[][] = new Array(N);
  let currentBest = bestFinalIdx;
  for (let i = N - 1; i >= 0; i--) {
    result[i] = allCandidates[i][currentBest] ?? allCandidates[i][0] ?? [];
    currentBest = backpointer[i][currentBest];
    if (currentBest === -1 && i > 0) currentBest = 0;
  }

  return result;
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
  const solved = solveGuitarPassage(
    [{
      midiNote: melodyMidi,
      scaleDegree: melodyScaleDegree,
      chordRoot: chordRootToken,
      isChordChange: options.isChordChange ?? true,
      isStrongBeat: options.isStrongBeat ?? false,
    }],
    options,
  );
  return solved[0] ?? [{
    midiNote: melodyMidi,
    scaleDegree: melodyScaleDegree,
    stringNumber: 1,
    fretNumber: Math.max(0, melodyMidi - 64),
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
