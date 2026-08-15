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
 * Supports Priority-Fill Inheritance:
 * 1. Explicit local layer definition wins outright.
 * 2. Unfilled layers inherit from the ordered list of parent coils in `parents`.
 * 3. Unfilled layers inherit from the enclosing Weave's `defaultCoil`.
 * 4. Fallback defaults (e.g. Harmony defaults to ['Do']).
 * 
 * @param coil - The Coil definition from the Tapestry IR
 * @param knot - The resolved Knot providing the Do anchor
 * @param coilLibrary - Map of named Coil definitions available for inheritance
 * @param defaultCoil - Optional default Coil from enclosing Weave
 * @returns Array of resolved onsets + warnings
 */
export function resolveCoil(
  coil: Coil,
  knot: ResolvedKnot,
  coilLibrary: Map<string, Coil> = new Map(),
  defaultCoil?: Coil,
): CoilResolutionResult {
  const warnings: string[] = [];
  
  // 1. Resolve layers through priority-fill inheritance
  const resolvedLayers = inheritCoilLayers(coil, coilLibrary, defaultCoil);
  
  const melody = resolvedLayers.melody;
  if (!melody || melody.length === 0) {
    throw new Error(
      `Coil "${coil.id}": melody layer is required (not defined locally, in parents, or in default coil)`
    );
  }
  
  const harmony = resolvedLayers.harmony ?? ['Do'];
  const rhythm = resolvedLayers.rhythm;
  
  // --- Rhythm validation ---
  if (rhythm) {
    const expectedCount = RHYTHM_BLOCK_LENGTHS[rhythm];
    if (expectedCount === undefined) {
      throw new Error(
        `Coil "${coil.id}": unknown rhythm label "${rhythm}"`
      );
    }
    if (melody.length !== expectedCount) {
      throw new Error(
        `Coil "${coil.id}": rhythm label "${rhythm}" declares ${expectedCount} onsets, ` +
        `but melody has ${melody.length} entries`
      );
    }
  }
  
  // --- Melody resolution ---
  const melodyPitches = resolveMelody(melody, knot);
  
  // --- Harmony resolution ---
  const harmonyChords = resolveHarmony(
    harmony,
    melody.length,
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

interface ResolvedLayers {
  melody?: string[];
  harmony?: string[];
  rhythm?: string;
}

/**
 * Resolves M, H, R layers using the priority-fill rule across parents and default coil.
 */
function inheritCoilLayers(
  coil: Coil,
  library: Map<string, Coil>,
  defaultCoil?: Coil,
): ResolvedLayers {
  const result: ResolvedLayers = {};
  
  // 1. Explicit local definition
  if (coil.melody && coil.melody.length > 0) result.melody = coil.melody;
  if (coil.harmony && coil.harmony.length > 0) result.harmony = coil.harmony;
  if (coil.rhythm) result.rhythm = coil.rhythm;
  
  // 2. Parents in priority order
  if (coil.parents && coil.parents.length > 0) {
    for (const parentId of coil.parents) {
      const parent = library.get(parentId);
      if (!parent) {
        throw new Error(
          `Coil "${coil.id}" references unknown parent coil "${parentId}"`
        );
      }
      if (!result.melody && parent.melody && parent.melody.length > 0) {
        result.melody = parent.melody;
      }
      if (!result.harmony && parent.harmony && parent.harmony.length > 0) {
        result.harmony = parent.harmony;
      }
      if (!result.rhythm && parent.rhythm) {
        result.rhythm = parent.rhythm;
      }
    }
  }
  
  // 3. Default coil from Weave scope
  if (defaultCoil) {
    if (!result.melody && defaultCoil.melody && defaultCoil.melody.length > 0) {
      result.melody = defaultCoil.melody;
    }
    if (!result.harmony && defaultCoil.harmony && defaultCoil.harmony.length > 0) {
      result.harmony = defaultCoil.harmony;
    }
    if (!result.rhythm && defaultCoil.rhythm) {
      result.rhythm = defaultCoil.rhythm;
    }
  }
  
  return result;
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
