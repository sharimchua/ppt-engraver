/**
 * Coil resolver: resolves a single Coil's layers into an onset stream.
 * 
 * Handles:
 * - Melody resolution (absolute and interval modes)
 * - Harmony resolution (chord root → major triad, held across onsets)
 * - Rhythm validation (block-length label vs melody.length)
 */
import { RHYTHM_BLOCK_LENGTHS } from '../constants.js';
import type { Coil } from '../schema/tapestry.js';
import type { ResolvedKnot } from '../solfege/pitch.js';
import {
  parsePitch,
  solfegeToSemitone,
  resolveAbsolutePitch,
  resolveInterval,
  buildMajorTriad,
  midiToPitchName,
} from '../solfege/pitch.js';

/** A single resolved onset from a coil (before tagging) */
export interface ResolvedOnset {
  /** Absolute melody MIDI note */
  melodyMidi: number;
  /** The solfège scale degree of the melody note (base syllable, no axis/octave) */
  scaleDegree: string;
  /** Chord tones as MIDI notes [root, third, fifth] */
  chordMidi: [number, number, number];
  /** Solfège syllable of the chord root */
  chordRoot: string;
}

export interface CoilResolutionResult {
  onsets: ResolvedOnset[];
  warnings: string[];
}

/**
 * Resolves a Coil's layers into an ordered array of onsets.
 * 
 * @param coil - The Coil definition from the Tapestry IR
 * @param knot - The resolved Knot providing the Do anchor
 * @returns Array of resolved onsets + warnings
 */
export function resolveCoil(coil: Coil, knot: ResolvedKnot): CoilResolutionResult {
  const warnings: string[] = [];
  
  // --- Rhythm validation ---
  if (coil.rhythm) {
    const expectedCount = RHYTHM_BLOCK_LENGTHS[coil.rhythm];
    if (expectedCount === undefined) {
      throw new Error(
        `Coil "${coil.id}": unknown rhythm label "${coil.rhythm}"`
      );
    }
    if (coil.melody.length !== expectedCount) {
      throw new Error(
        `Coil "${coil.id}": rhythm label "${coil.rhythm}" declares ${expectedCount} onsets, ` +
        `but melody has ${coil.melody.length} entries`
      );
    }
  }
  
  // --- Melody resolution ---
  const melodyPitches = resolveMelody(coil.melody, knot);
  
  // --- Harmony resolution ---
  const harmonyChords = resolveHarmony(
    coil.harmony ?? ['Do'], // Default: Do chord held across entire coil
    coil.melody.length,
    knot,
  );
  
  // --- Pair melody + harmony into onsets ---
  const onsets: ResolvedOnset[] = melodyPitches.map((mp, i) => ({
    melodyMidi: mp.midi,
    scaleDegree: mp.scaleDegree,
    chordMidi: harmonyChords[i].triad,
    chordRoot: harmonyChords[i].root,
  }));
  
  return { onsets, warnings };
}

/** Internal: resolved melody pitch info */
interface MelodyPitch {
  midi: number;
  scaleDegree: string;
}

/**
 * Resolves the melody array into absolute MIDI pitches.
 * 
 * Mode is determined by the first token:
 * - No axis marker → Absolute mode (each syllable is a scale degree from Do)
 * - Axis marker (x) → Interval mode (first syllable sets starting pitch,
 *   subsequent syllables are intervals from previous pitch)
 */
function resolveMelody(melody: string[], knot: ResolvedKnot): MelodyPitch[] {
  if (melody.length === 0) {
    throw new Error('Melody array must not be empty');
  }
  
  const firstParsed = parsePitch(melody[0]);
  
  if (!firstParsed.hasAxis) {
    // === Absolute mode ===
    return melody.map(token => {
      const parsed = parsePitch(token);
      if (parsed.hasAxis) {
        // Mid-melody axis markers are not valid in absolute mode
        throw new Error(
          `Axis marker found mid-melody in absolute mode: "${token}". ` +
          `Axis marker is only valid on the first token to select interval mode.`
        );
      }
      const midi = resolveAbsolutePitch(parsed.syllable, parsed.octaveShift, knot.doMidi);
      return { midi, scaleDegree: parsed.syllable };
    });
  } else {
    // === Interval mode ===
    const result: MelodyPitch[] = [];
    
    // First note: resolve absolutely (the axis anchor)
    let currentMidi = resolveAbsolutePitch(
      firstParsed.syllable,
      firstParsed.octaveShift,
      knot.doMidi,
    );
    result.push({ midi: currentMidi, scaleDegree: firstParsed.syllable });
    
    // Subsequent notes: intervals from previous pitch
    for (let i = 1; i < melody.length; i++) {
      const parsed = parsePitch(melody[i]);
      const interval = resolveInterval(parsed.syllable, parsed.octaveShift);
      currentMidi = currentMidi + interval;
      result.push({ midi: currentMidi, scaleDegree: parsed.syllable });
    }
    
    return result;
  }
}

/** Internal: resolved harmony chord info */
interface HarmonyChord {
  triad: [number, number, number];
  root: string;
}

/**
 * Resolves harmony chord roots into triads, distributed across melody onsets.
 * 
 * Cross-layer alignment (stretch mode):
 * - Each chord is held for ceil(melodyLength / harmonyLength) onsets
 * - Last chord fills any remainder
 */
function resolveHarmony(
  harmony: string[],
  melodyLength: number,
  knot: ResolvedKnot,
): HarmonyChord[] {
  // Resolve each chord root to a triad
  const chords: HarmonyChord[] = harmony.map(root => {
    const semitone = solfegeToSemitone(root);
    const rootMidi = knot.doMidi + semitone;
    return {
      triad: buildMajorTriad(rootMidi),
      root,
    };
  });
  
  // Distribute chords across melody onsets (stretch mode)
  const result: HarmonyChord[] = [];
  if (chords.length === 1) {
    // Single chord held across all onsets
    for (let i = 0; i < melodyLength; i++) {
      result.push(chords[0]);
    }
  } else {
    // Multiple chords: distribute evenly
    const onsetsPerChord = Math.ceil(melodyLength / chords.length);
    for (let i = 0; i < melodyLength; i++) {
      const chordIndex = Math.min(
        Math.floor(i / onsetsPerChord),
        chords.length - 1,
      );
      result.push(chords[chordIndex]);
    }
  }
  
  return result;
}
