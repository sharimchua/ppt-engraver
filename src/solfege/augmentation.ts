/**
 * Melody Harmonic Augmentation Engine for Prime Period Theory (PPT).
 * 
 * Incurs accompanying harmony notes underneath melody notes based on active
 * chord context (thirdsBelow, sixthsBelow, triadClose, drop2, guideToneDyad, octaves).
 */

import { parseHarmonyChord, solfegeToHarmonyRootOffset, getScaleDegreeFromDo } from './pitch.js';
import { getChordIntervals } from './voicings.js';
import type { MelodyAugmentation } from '../schema/tapestry.js';

export interface AugmentedNote {
  midiNote: number;
  scaleDegree: string;
  isInferred: boolean;
}

export interface AugmentationOptions {
  augmentation?: MelodyAugmentation;
  chordToken?: string;
  knotDoMidi?: number;
}

/**
 * Normalizes a MIDI pitch class (0-11) relative to Do.
 */
function getPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/**
 * Returns available chord pitch classes (0-11) for a given chord token and knot tonic.
 */
export function getChordPitchClasses(chordToken: string, knotDoMidi: number = 60): number[] {
  const parsed = parseHarmonyChord(chordToken);
  const rootOffset = solfegeToHarmonyRootOffset(parsed.rootSyllable);
  const rootPc = getPitchClass(knotDoMidi + rootOffset);
  const intervals = getChordIntervals(parsed.quality);
  return intervals.map(i => (rootPc + i) % 12);
}

/**
 * Generates harmonic augmentation notes underneath a given melody note.
 * 
 * @param melodyMidi - Concrete MIDI pitch of the melody note
 * @param chordToken - Active harmony chord token (e.g. "Do", "FaMe", "SoTe")
 * @param knotDoMidi - Tonic reference MIDI pitch (e.g. 60 for C4)
 * @param augmentation - Selected augmentation style
 * @returns Array of inferred companion notes (empty if none or disabled)
 */
export function generateMelodyAugmentation(
  melodyMidi: number,
  chordToken: string = 'Do',
  knotDoMidi: number = 60,
  augmentation: MelodyAugmentation = 'none'
): AugmentedNote[] {
  if (augmentation === 'none') {
    return [];
  }

  const chordPcs = getChordPitchClasses(chordToken, knotDoMidi);
  const melodyPc = getPitchClass(melodyMidi);

  // 1. Octaves Below: Double the melody note 1 octave below
  if (augmentation === 'octaves') {
    const octMidi = melodyMidi - 12;
    return [{
      midiNote: octMidi,
      scaleDegree: getScaleDegreeFromDo(octMidi, knotDoMidi),
      isInferred: true,
    }];
  }

  // 2. Thirds Below: Find chord/diatonic note 3 or 4 semitones below
  if (augmentation === 'thirdsBelow') {
    let chosenMidi = melodyMidi - 4; // Major third below default
    // Check if 3 semitones below (minor third) or 4 semitones below is a chord tone
    if (chordPcs.includes(getPitchClass(melodyMidi - 3))) {
      chosenMidi = melodyMidi - 3;
    } else if (chordPcs.includes(getPitchClass(melodyMidi - 4))) {
      chosenMidi = melodyMidi - 4;
    }
    return [{
      midiNote: chosenMidi,
      scaleDegree: getScaleDegreeFromDo(chosenMidi, knotDoMidi),
      isInferred: true,
    }];
  }

  // 3. Sixths Below: Find chord/diatonic note 8 or 9 semitones below
  if (augmentation === 'sixthsBelow') {
    let chosenMidi = melodyMidi - 9; // Major sixth below default
    if (chordPcs.includes(getPitchClass(melodyMidi - 8))) {
      chosenMidi = melodyMidi - 8;
    } else if (chordPcs.includes(getPitchClass(melodyMidi - 9))) {
      chosenMidi = melodyMidi - 9;
    }
    return [{
      midiNote: chosenMidi,
      scaleDegree: getScaleDegreeFromDo(chosenMidi, knotDoMidi),
      isInferred: true,
    }];
  }

  // 4. Guide Tone Dyad: Add closest active guide tone (3rd or 7th) below melody
  if (augmentation === 'guideToneDyad') {
    const parsed = parseHarmonyChord(chordToken);
    const rootOffset = solfegeToHarmonyRootOffset(parsed.rootSyllable);
    const rootPc = getPitchClass(knotDoMidi + rootOffset);
    const isMinor = parsed.quality.includes('minor') || parsed.quality === 'diminished';
    const thirdPc = (rootPc + (isMinor ? 3 : 4)) % 12;
    const is7th = parsed.quality.includes('7');
    const seventhPc = is7th ? (rootPc + 10) % 12 : undefined;

    const candidatePcs = seventhPc !== undefined ? [thirdPc, seventhPc] : [thirdPc];

    // Pick candidate pitch below melody with maximum consonance (avoiding unisons)
    let bestMidi: number | null = null;
    let bestDistance = Infinity;

    for (const pc of candidatePcs) {
      let pitch = melodyMidi - 1;
      while (getPitchClass(pitch) !== pc) {
        pitch--;
      }
      const dist = melodyMidi - pitch;
      if (dist >= 3 && dist <= 12 && dist < bestDistance) {
        bestDistance = dist;
        bestMidi = pitch;
      }
    }

    if (bestMidi !== null) {
      return [{
        midiNote: bestMidi,
        scaleDegree: getScaleDegreeFromDo(bestMidi, knotDoMidi),
        isInferred: true,
      }];
    }
    return [];
  }

  // 5. Triad Close: 2 chord tones directly beneath the melody note (making 3-note block chord)
  if (augmentation === 'triadClose') {
    const tonesBelow: number[] = [];
    let testPitch = melodyMidi - 1;
    while (tonesBelow.length < 2 && testPitch >= melodyMidi - 16) {
      if (chordPcs.includes(getPitchClass(testPitch))) {
        tonesBelow.push(testPitch);
      }
      testPitch--;
    }
    return tonesBelow.map(midi => ({
      midiNote: midi,
      scaleDegree: getScaleDegreeFromDo(midi, knotDoMidi),
      isInferred: true,
    }));
  }

  // 6. Drop 2: 4-way close chord under melody with 2nd voice from top dropped 12 semitones
  if (augmentation === 'drop2') {
    const closeTones: number[] = [melodyMidi];
    let testPitch = melodyMidi - 1;
    while (closeTones.length < 4 && testPitch >= melodyMidi - 16) {
      if (chordPcs.includes(getPitchClass(testPitch))) {
        closeTones.push(testPitch);
      }
      testPitch--;
    }

    if (closeTones.length >= 4) {
      // Drop voice index 1 (2nd from top) down an octave
      const droppedVoice = closeTones[1] - 12;
      const lowerVoices = [droppedVoice, closeTones[2], closeTones[3]];
      return lowerVoices.map(midi => ({
        midiNote: midi,
        scaleDegree: getScaleDegreeFromDo(midi, knotDoMidi),
        isInferred: true,
      }));
    } else if (closeTones.length >= 2) {
      return closeTones.slice(1).map(midi => ({
        midiNote: midi,
        scaleDegree: getScaleDegreeFromDo(midi, knotDoMidi),
        isInferred: true,
      }));
    }
  }

  return [];
}
