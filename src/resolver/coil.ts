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
  solfegeToHarmonyRootOffset,
  solfegeToNearestAddress,
  fitRootToClefRegister,
  resolveAbsolutePitch,
  resolveInterval,
  buildChordFromToken,
  parseHarmonyChord,
  midiToPitchName,
  getScaleDegreeFromDo,
} from '../solfege/pitch.js';







/** A single resolved onset from a coil (before tagging) */
export interface ResolvedOnset {
  /** Absolute melody MIDI note */
  melodyMidi: number;
  /** The solfège scale degree of the melody note (base syllable, no axis/octave) */
  scaleDegree: string;
  /** Chord tones as MIDI notes */
  chordMidi: number[];
  /** Solfège syllable of the chord root / token */
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
  
  const rawMelody = resolvedLayers.melody;
  if (!rawMelody || rawMelody.length === 0) {
    throw new Error(
      `Coil "${coil.id}": melody layer is required (not defined locally, in parents, or in default coil)`
    );
  }
  
  // Flatten any space-separated tokens in melody (e.g. ["Re Te"] -> ["Re", "Te"])
  const melody = rawMelody.flatMap(entry => entry.trim().split(/\s+/).filter(Boolean));
  
  const harmony = resolvedLayers.harmony ?? ['Do'];
  const rhythm = resolvedLayers.rhythm;
  
  // --- Rhythm validation (warning if count differs from declared beat block) ---
  if (rhythm) {
    const expectedCount = RHYTHM_BLOCK_LENGTHS[rhythm];
    if (expectedCount === undefined) {
      warnings.push(`Coil "${coil.id}": unknown rhythm label "${rhythm}"`);
    } else if (melody.length !== expectedCount) {
      warnings.push(
        `Coil "${coil.id}": rhythm label "${rhythm}" specifies ${expectedCount} beats, but melody has ${melody.length} onsets (subdivision timing deferred to Phase 5)`
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
    resolvedLayers.harmonyOctave ?? 0,
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
  harmony?: (string | number)[];
  rhythm?: string;
  harmonyOctave?: number;
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
  if (coil.harmonyOctave !== undefined) result.harmonyOctave = coil.harmonyOctave;
  
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
      if (result.harmonyOctave === undefined && parent.harmonyOctave !== undefined) {
        result.harmonyOctave = parent.harmonyOctave;
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
    if (result.harmonyOctave === undefined && defaultCoil.harmonyOctave !== undefined) {
      result.harmonyOctave = defaultCoil.harmonyOctave;
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
      const scaleDegree = getScaleDegreeFromDo(midi, knot.doMidi);
      return { midi, scaleDegree };
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
    result.push({
      midi: currentMidi,
      scaleDegree: getScaleDegreeFromDo(currentMidi, knot.doMidi),
    });
    
    // Subsequent notes: intervals from previous pitch
    for (let i = 1; i < melody.length; i++) {
      const parsed = parsePitch(melody[i]);
      const interval = resolveInterval(parsed.syllable, parsed.octaveShift);
      currentMidi = currentMidi + interval;
      result.push({
        midi: currentMidi,
        scaleDegree: getScaleDegreeFromDo(currentMidi, knot.doMidi),
      });
    }
    
    return result;
  }
}


/**
 * Expands a harmony array supporting repeat padding numbers.
 * E.g. [DoMe, 1, Te, 1, Le, 1, So] -> [DoMe, DoMe, Te, Te, Le, Le, So]
 * E.g. [Do, 3] -> [Do, Do, Do, Do]
 */
export function expandHarmonyArray(
  harmony: (string | number)[],
): { expanded: string[]; hasExplicitCounts: boolean } {
  const expanded: string[] = [];
  let lastChord: string | null = null;
  let hasExplicitCounts = false;

  for (const item of harmony) {
    const isNum =
      typeof item === 'number' ||
      (typeof item === 'string' && /^\d+$/.test(item.trim()));

    if (isNum) {
      hasExplicitCounts = true;
      const count = typeof item === 'number' ? item : parseInt(item.trim(), 10);
      if (lastChord === null) {
        throw new Error(`Harmony array cannot start with a repeat padding number: ${item}`);
      }
      for (let k = 0; k < count; k++) {
        expanded.push(lastChord);
      }
    } else {
      const chordStr = String(item).trim();
      expanded.push(chordStr);
      lastChord = chordStr;
    }
  }

  return { expanded, hasExplicitCounts };
}

/** Internal: resolved harmony chord info */
interface HarmonyChord {
  triad: number[];
  root: string;
}

/**
 * Resolves harmony chord roots into triads, distributed across melody onsets.
 * 
 * Supports:
 * - Direct padded indexing when numbers are provided (e.g. [Do, 1, So, 2])
 * - Cross-layer alignment (stretch mode) when unpadded (e.g. [Do, So])
 */
function resolveHarmony(
  harmony: (string | number)[],
  melodyLength: number,
  knot: ResolvedKnot,
  harmonyOctave: number = 0,
): HarmonyChord[] {
  const { expanded, hasExplicitCounts } = expandHarmonyArray(harmony);

  const getChordForToken = (token: string): HarmonyChord => {
    const parsed = parseHarmonyChord(token);
    const semitone = solfegeToHarmonyRootOffset(parsed.rootSyllable);
    const rootMidi = knot.doMidi + semitone + (harmonyOctave * 12);
    return {
      triad: buildChordFromToken(rootMidi, token),
      root: token,
    };
  };

  const result: HarmonyChord[] = [];

  if (hasExplicitCounts) {
    // Explicit padding/indexing provided: align 1:1, pad remainder with last chord
    for (let i = 0; i < melodyLength; i++) {
      if (i < expanded.length) {
        result.push(getChordForToken(expanded[i]));
      } else {
        const lastToken = expanded[expanded.length - 1] ?? 'Do';
        result.push(getChordForToken(lastToken));
      }
    }
  } else {
    // Default stretch mode across melody onsets
    if (expanded.length === 1) {
      const chord = getChordForToken(expanded[0]);
      for (let i = 0; i < melodyLength; i++) {
        result.push(chord);
      }
    } else {
      const onsetsPerChord = Math.ceil(melodyLength / expanded.length);
      for (let i = 0; i < melodyLength; i++) {
        const chordIndex = Math.min(
          Math.floor(i / onsetsPerChord),
          expanded.length - 1,
        );
        result.push(getChordForToken(expanded[chordIndex]));
      }
    }
  }

  return result;
}
