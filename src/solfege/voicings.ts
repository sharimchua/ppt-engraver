/**
 * Harmony Voicing Engine for Prime Period Theory (PPT).
 * 
 * Provides concrete pitch-class realizations for abstract chord tokens
 * based on selected voicing styles (close, rootless, rootFifth, shell,
 * open, smoothLead, bassOnly, walkingBass, octaves).
 */

import { parseHarmonyChord, solfegeToHarmonyRootOffset } from './pitch.js';
import type { HarmonyVoicing } from '../schema/tapestry.js';

/**
 * Builds close tertian chord tones (in semitones relative to root) based on chord quality.
 */
export function getChordIntervals(quality: string): number[] {
  switch (quality) {
    case 'minor':
      return [0, 3, 7];
    case 'minor7':
      return [0, 3, 7, 10];
    case 'dominant7':
      return [0, 4, 7, 10];
    case 'diminished':
      return [0, 3, 6];
    case 'augmented':
      return [0, 4, 8];
    case 'major7':
      return [0, 4, 7, 11];
    case 'major':
    default:
      return [0, 4, 7];
  }
}

/**
 * Voicing generator options.
 */
export interface VoicingOptions {
  /** Voicing style to apply */
  voicing?: HarmonyVoicing;
  /** Previous chord MIDI notes (for smoothLead voice leading continuity) */
  previousChordMidi?: number[];
  /** Reference Do/Tonic MIDI pitch */
  knotDoMidi?: number;
  /** Target center pitch for register clamping (default: MIDI 60 / C4) */
  targetCenterPitch?: number;
}

/**
 * Computes voice-leading distance between two chord voicings.
 * Minimizes sum of squared semitone movements across voice assignments.
 */
export function calculateVoiceLeadingDistance(prevVoicing: number[], nextVoicing: number[]): number {
  if (prevVoicing.length === 0) return 0;
  
  // Sort both voicings low to high
  const prevSorted = [...prevVoicing].sort((a, b) => a - b);
  const nextSorted = [...nextVoicing].sort((a, b) => a - b);

  let dist = 0;
  const minLen = Math.min(prevSorted.length, nextSorted.length);
  for (let i = 0; i < minLen; i++) {
    const diff = nextSorted[i] - prevSorted[i];
    dist += diff * diff;
  }
  // Penalize mismatched voice counts slightly
  if (prevSorted.length !== nextSorted.length) {
    dist += Math.abs(prevSorted.length - nextSorted.length) * 16;
  }
  return dist;
}

/**
 * Generates the best smooth voice leading inversion / register for a given chord
 * to minimize movement from the previous chord.
 */
export function generateSmoothVoiceLeading(
  candidatePitchClasses: number[],
  prevVoicing: number[],
  targetCenter: number = 60
): number[] {
  if (candidatePitchClasses.length === 0) return [];
  if (!prevVoicing || prevVoicing.length === 0) {
    // Center candidate pitch classes around targetCenter
    return candidatePitchClasses.map(pc => {
      let pitch = ((pc % 12) + 12) % 12 + 48; // Octave 3 base
      while (pitch < targetCenter - 6) pitch += 12;
      while (pitch > targetCenter + 12) pitch -= 12;
      return pitch;
    }).sort((a, b) => a - b);
  }

  const numVoices = candidatePitchClasses.length;

  // Generate permutations of octave placements within reasonable range
  let bestVoicing: number[] = [];
  let minDistance = Infinity;

  // Candidate base octaves
  const octaveOffsets = [-24, -12, 0, 12, 24];

  // Try standard permutations of inversions
  for (let inv = 0; inv < numVoices; inv++) {
    const rotated = [...candidatePitchClasses.slice(inv), ...candidatePitchClasses.slice(0, inv)];
    for (const baseShift of octaveOffsets) {
      const voicing: number[] = [];
      let currentMidi = rotated[0] + baseShift;
      voicing.push(currentMidi);

      for (let v = 1; v < rotated.length; v++) {
        const diff = ((rotated[v] - rotated[0]) % 12 + 12) % 12;
        voicing.push(currentMidi + diff);
      }

      const dist = calculateVoiceLeadingDistance(prevVoicing, voicing);
      if (dist < minDistance) {
        minDistance = dist;
        bestVoicing = voicing;
      }
    }
  }

  return bestVoicing.length > 0 ? bestVoicing.sort((a, b) => a - b) : candidatePitchClasses;
}

/**
 * Generates a voiced chord (array of MIDI notes) for a given chord token and voicing style.
 * 
 * @param rootMidi - Base MIDI pitch for the chord root
 * @param chordToken - PPT Solfège chord token (e.g. "Do", "DoMe", "FaTe", "SoxDo")
 * @param options - Voicing configuration options
 * @returns Array of concrete MIDI notes for the chord
 */
export function generateChordVoicing(
  rootMidi: number,
  chordToken: string,
  options: VoicingOptions = {}
): number[] {
  const voicing = options.voicing ?? 'close';
  const parsed = parseHarmonyChord(chordToken);
  const shiftedRoot = rootMidi + (parsed.octaveShift * 12);
  const intervals = getChordIntervals(parsed.quality);

  // 1. Bass Only: Single root pitch
  if (voicing === 'bassOnly') {
    if (parsed.hasAxisBass && parsed.bassSyllable) {
      const doRef = options.knotDoMidi !== undefined ? options.knotDoMidi : (rootMidi - solfegeToHarmonyRootOffset(parsed.rootSyllable));
      const bassOffset = solfegeToHarmonyRootOffset(parsed.bassSyllable);
      return [doRef + bassOffset + ((parsed.bassOctaveShift ?? 0) * 12)];
    }
    return [shiftedRoot];
  }

  // 2. Walking Bass / Octaves: Root in octaves or bass line
  if (voicing === 'octaves' || voicing === 'walkingBass') {
    return [shiftedRoot - 12, shiftedRoot];
  }

  // 3. Root + 5th (Power chord / acoustic dyad)
  if (voicing === 'rootFifth') {
    const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;
    return [shiftedRoot, shiftedRoot + fifthInterval];
  }

  // 4. Shell Voicings (Root + 3rd + 7th or Root + 7th + 3rd)
  if (voicing === 'shell') {
    const thirdInterval = intervals.find(i => i === 3 || i === 4) ?? 4;
    const seventhInterval = intervals.find(i => i === 10 || i === 11);
    if (seventhInterval !== undefined) {
      // Root + 7th + 3rd(+12)
      return [shiftedRoot, shiftedRoot + seventhInterval, shiftedRoot + thirdInterval + 12];
    }
    // Simple shell: Root + 3rd + 5th
    const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;
    return [shiftedRoot, shiftedRoot + thirdInterval, shiftedRoot + fifthInterval];
  }

  // 5. Rootless Voicing (Jazz piano comping: 3rd + 7th + 5th/9th without root)
  if (voicing === 'rootless') {
    const thirdInterval = intervals.find(i => i === 3 || i === 4) ?? 4;
    const seventhInterval = intervals.find(i => i === 10 || i === 11);
    const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;
    const ninthInterval = 14; // 9th = root + 2 semitones + octave

    if (seventhInterval !== undefined) {
      // 3rd, 5th, 7th, 9th (rootless 4-way)
      return [
        shiftedRoot + thirdInterval,
        shiftedRoot + fifthInterval,
        shiftedRoot + seventhInterval,
        shiftedRoot + ninthInterval,
      ];
    }
    // 3-note rootless triad: 3rd, 5th, 9th
    return [
      shiftedRoot + thirdInterval,
      shiftedRoot + fifthInterval,
      shiftedRoot + ninthInterval,
    ];
  }

  // 6. Open / Spread Voicings (1-5-10 open spread or drop-2)
  if (voicing === 'open') {
    const thirdInterval = intervals.find(i => i === 3 || i === 4) ?? 4;
    const fifthInterval = intervals.find(i => i === 7 || i === 6 || i === 8) ?? 7;
    const seventhInterval = intervals.find(i => i === 10 || i === 11);

    if (seventhInterval !== undefined) {
      // Open 1-5-7-10: Root, 5th, 7th, 10th (3rd + 12)
      return [
        shiftedRoot,
        shiftedRoot + fifthInterval,
        shiftedRoot + seventhInterval,
        shiftedRoot + thirdInterval + 12,
      ];
    }
    // Open 1-5-10: Root, 5th, 10th (3rd + 12)
    return [
      shiftedRoot,
      shiftedRoot + fifthInterval,
      shiftedRoot + thirdInterval + 12,
    ];
  }

  // 7. Smooth Voice Leading (Parsimonious voice leading against previous chord)
  if (voicing === 'smoothLead') {
    const candidatePitchClasses = intervals.map(i => shiftedRoot + i);
    return generateSmoothVoiceLeading(
      candidatePitchClasses,
      options.previousChordMidi ?? [],
      options.targetCenterPitch ?? 60
    );
  }

  // Default: Standard Close Tertian Voicing with slash bass / axis support
  const upperTones = intervals.map(i => shiftedRoot + i);

  if (parsed.hasAxisBass && parsed.bassSyllable) {
    const doRef = options.knotDoMidi !== undefined ? options.knotDoMidi : (rootMidi - solfegeToHarmonyRootOffset(parsed.rootSyllable));
    const bassOffset = solfegeToHarmonyRootOffset(parsed.bassSyllable);
    const bassPc = ((bassOffset % 12) + 12) % 12;
    const chordPcs = upperTones.map(t => ((t % 12) + 12) % 12);

    const invIndex = chordPcs.indexOf(bassPc);

    if (invIndex !== -1) {
      // Inversion: revoice existing chord tones starting from bass note
      const rotatedPcs = [...chordPcs.slice(invIndex), ...chordPcs.slice(0, invIndex)];
      let baseBassMidi = shiftedRoot + ((bassPc - chordPcs[0] + 12) % 12);
      if (invIndex > 1) {
        baseBassMidi -= 12;
      }
      if (parsed.bassOctaveShift) {
        baseBassMidi += parsed.bassOctaveShift * 12;
      }

      const invertedChord: number[] = [baseBassMidi];
      for (let i = 1; i < rotatedPcs.length; i++) {
        const diff = ((rotatedPcs[i] - bassPc) % 12 + 12) % 12;
        invertedChord.push(baseBassMidi + diff);
      }
      return invertedChord;
    } else {
      // Non-chord tone slash bass
      let bassMidi = doRef + bassOffset + ((parsed.bassOctaveShift ?? 0) * 12);
      while (bassMidi >= upperTones[0]) {
        bassMidi -= 12;
      }
      return [bassMidi, ...upperTones];
    }
  }

  return upperTones;
}
