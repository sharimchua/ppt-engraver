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
import {
  expandRhythmEntries,
  resolveRhythmTimeline,
  beatsToLilyPondDuration,
  type ResolvedRhythmOnset,
} from '../solfege/rhythm.js';

/** A single resolved onset from a coil (before tagging) */
export interface ResolvedOnset {
  /** Absolute melody MIDI note */
  melodyMidi: number;
  /** The solfège scale degree of the melody note (base syllable, no axis/octave) */
  scaleDegree: string;
  /** Whether this onset is a rest in the melody layer */
  isRest?: boolean;
  /** Chord tones as MIDI notes */
  chordMidi: number[];
  /** Solfège syllable of the chord root / token */
  chordRoot: string;
  /** Optional rhythm token string if rhythmic grammar is used */
  rhythmToken?: string;
  /** Duration in beats (quarter note = 1.0) */
  durationBeats?: number;
  /** LilyPond duration string, e.g. "4", "8", "16", "4*1/3" */
  duration?: string;
}


export interface CoilResolutionResult {
  onsets: ResolvedOnset[];
  warnings: string[];
}

/**
 * Resolves a single Coil into an array of ResolvedOnsets.
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
/**
 * Resolves a composite coil defined with `concat: [...]`.
 * Stitches sub-coils into a single continuous phrase and collapses overlapping downbeat boundary rests.
 */
export function resolveConcatCoil(
  coil: Coil,
  knot: ResolvedKnot,
  coilLibrary: Map<string, Coil> = new Map(),
  defaultCoil?: Coil,
): CoilResolutionResult {
  const warnings: string[] = [];
  const concatEntries = coil.concat!;
  const mergedOnsets: ResolvedOnset[] = [];

  for (let i = 0; i < concatEntries.length; i++) {
    const entry = concatEntries[i];
    let subCoil: Coil;
    if (typeof entry === 'string') {
      const found = coilLibrary.get(entry);
      if (!found) {
        throw new Error(
          `Coil "${coil.id ?? 'anonymous'}" concat references unknown coil "${entry}"`
        );
      }
      subCoil = found;
    } else {
      subCoil = entry;
    }

    const { onsets: subOnsets, warnings: subWarnings } = resolveCoil(
      subCoil,
      knot,
      coilLibrary,
      defaultCoil
    );
    warnings.push(...subWarnings);

    if (subOnsets.length === 0) continue;

    if (mergedOnsets.length === 0) {
      mergedOnsets.push(...subOnsets);
    } else {
      const lastMerged = mergedOnsets[mergedOnsets.length - 1];
      const firstSub = subOnsets[0];

      // Boundary Collapsing:
      // Case 1: Trailing rest at end of previous coil AND leading rest at start of next coil
      // (e.g. previous ends on trailing 'Do' rest, next begins with 'Dox' push rest)
      if (lastMerged.isRest && firstSub.isRest) {
        mergedOnsets[mergedOnsets.length - 1] = {
          ...firstSub,
          chordMidi: lastMerged.chordMidi,
          chordRoot: lastMerged.chordRoot,
        };
        mergedOnsets.push(...subOnsets.slice(1));
      }
      // Case 2: Trailing rest at end of previous coil AND next coil lands directly on-beat with melody
      else if (lastMerged.isRest && !firstSub.isRest && (firstSub.rhythmToken === 'Do' || firstSub.rhythmToken === undefined)) {
        mergedOnsets.pop(); // Remove trailing empty rest
        mergedOnsets.push(...subOnsets);
      }
      // Case 3: Standard concatenation
      else {
        mergedOnsets.push(...subOnsets);
      }
    }
  }

  // If the composite coil specifies its own harmony layer, override harmony across the entire concatenated stream
  if (coil.harmony && coil.harmony.length > 0) {
    const totalOnsets = mergedOnsets.length;
    const harmonyChords = resolveHarmony(
      coil.harmony,
      totalOnsets,
      knot,
      coil.harmonyOctave ?? 0,
    );
    for (let k = 0; k < totalOnsets; k++) {
      mergedOnsets[k].chordMidi = harmonyChords[k].triad;
      mergedOnsets[k].chordRoot = harmonyChords[k].root;
    }
  } else if (coil.harmonyOctave !== undefined && coil.harmonyOctave !== 0) {
    const shiftSemitones = coil.harmonyOctave * 12;
    for (const onset of mergedOnsets) {
      onset.chordMidi = onset.chordMidi.map(m => m + shiftSemitones);
    }
  }

  return { onsets: mergedOnsets, warnings };
}

/**
 * Resolves a single Coil into an array of ResolvedOnsets.
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

  // If this coil is a composite concatenation of sub-coils, resolve via resolveConcatCoil
  if (coil.concat && coil.concat.length > 0) {
    return resolveConcatCoil(coil, knot, coilLibrary, defaultCoil);
  }
  
  // Resolve layers using inheritance rules:
  // Explicit > Parents (in order) > Default Coil
  const resolvedLayers = inheritCoilLayers(coil, coilLibrary, defaultCoil);
  
  const rawMelody = resolvedLayers.melody;
  if (!rawMelody || rawMelody.length === 0) {
    throw new Error(
      `Coil "${coil.id}": melody layer is required (not defined locally, in parents, or in default coil)`
    );
  }
  
  // Expand repeat padding numbers and flatten space-separated tokens
  const melody = expandMelodyArray(rawMelody);
  
  const harmony = resolvedLayers.harmony ?? ['Do'];
  const rhythm = resolvedLayers.rhythm;
  
  // --- Rhythm resolution ---
  let resolvedRhythmOnsets: ResolvedRhythmOnset[] | null = null;
  let hasInitialRest = false;
  let initialOffsetBeats = 0;
  let totalOnsets = melody.length;

  if (Array.isArray(rhythm)) {
    const expanded = expandRhythmEntries(rhythm, melody.length);
    resolvedRhythmOnsets = resolveRhythmTimeline(expanded);
    totalOnsets = resolvedRhythmOnsets.length;
  } else if (typeof rhythm === 'string') {
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
    totalOnsets,
    knot,
    resolvedLayers.harmonyOctave ?? 0,
  );
  
  // --- Pair melody + harmony into onsets ---
  const onsets: ResolvedOnset[] = [];
  
  if (resolvedRhythmOnsets) {
    let melodyIndex = 0;
    for (let k = 0; k < resolvedRhythmOnsets.length; k++) {
      const ro = resolvedRhythmOnsets[k];
      const isRestToken = ro.token === 'Dox';
      let mp = undefined;
      let isRest = true;
      if (!isRestToken && melodyIndex < melodyPitches.length) {
        mp = melodyPitches[melodyIndex];
        isRest = false;
        melodyIndex++;
      }
      const chord = harmonyChords[k] ?? harmonyChords[harmonyChords.length - 1];
      onsets.push({
        melodyMidi: mp ? mp.midi : 0,
        scaleDegree: mp ? mp.scaleDegree : '',
        isRest,
        chordMidi: chord.triad,
        chordRoot: chord.root,
        rhythmToken: ro.token,
        durationBeats: ro.durationBeats,
        duration: ro.lilypondDuration,
      });
    }
  } else {
    for (let i = 0; i < totalOnsets; i++) {
      const mp = melodyPitches[i];
      const isRest = i >= melodyPitches.length;
      onsets.push({
        melodyMidi: mp ? mp.midi : 0,
        scaleDegree: mp ? mp.scaleDegree : '',
        isRest,
        chordMidi: harmonyChords[i].triad,
        chordRoot: harmonyChords[i].root,
        rhythmToken: undefined,
        durationBeats: undefined,
        duration: undefined,
      });
    }
  }
  
  return { onsets, warnings };
}

interface ResolvedLayers {
  melody?: (string | number)[];
  harmony?: (string | number)[];
  rhythm?: string | (string | number)[];
  meter?: string;
  harmonyOctave?: number;
}


function resolveParentChain(
  parentId: string,
  library: Map<string, Coil>,
  visited: Set<string> = new Set(),
  callerId: string = 'anonymous',
): ResolvedLayers {
  if (visited.has(parentId)) {
    throw new Error(
      `Circular coil inheritance detected: ${[...visited, parentId].join(' -> ')}`
    );
  }
  const parent = library.get(parentId);
  if (!parent) {
    throw new Error(
      `Coil "${callerId}" references unknown parent coil "${parentId}"`
    );
  }
  const nextVisited = new Set(visited).add(parentId);
  const direct: ResolvedLayers = {};
  if (parent.melody && parent.melody.length > 0) direct.melody = parent.melody;
  if (parent.harmony && parent.harmony.length > 0) direct.harmony = parent.harmony;
  if (parent.rhythm) direct.rhythm = parent.rhythm;
  if (parent.harmonyOctave !== undefined) direct.harmonyOctave = parent.harmonyOctave;

  // Check parent's parents
  const ancestorIds: string[] = [];
  if (parent.parent) ancestorIds.push(parent.parent);
  if (parent.parents) {
    if (Array.isArray(parent.parents)) ancestorIds.push(...parent.parents);
    else ancestorIds.push(parent.parents);
  }

  for (const ancId of ancestorIds) {
    const ancLayers = resolveParentChain(ancId, library, nextVisited, parentId);
    if (!direct.melody && ancLayers.melody) direct.melody = ancLayers.melody;
    if (!direct.harmony && ancLayers.harmony) direct.harmony = ancLayers.harmony;
    if (!direct.rhythm && ancLayers.rhythm) direct.rhythm = ancLayers.rhythm;
    if (direct.harmonyOctave === undefined && ancLayers.harmonyOctave !== undefined) {
      direct.harmonyOctave = ancLayers.harmonyOctave;
    }
  }

  return direct;
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
  const coilId = coil.id ?? 'anonymousCoil';
  
  // 1. Explicit local definition
  if (coil.melody && coil.melody.length > 0) result.melody = coil.melody;
  if (coil.harmony && coil.harmony.length > 0) result.harmony = coil.harmony;
  if (coil.rhythm) result.rhythm = coil.rhythm;
  if (coil.harmonyOctave !== undefined) result.harmonyOctave = coil.harmonyOctave;
  
  // 2. Parents in priority order
  const parentIds: string[] = [];
  if (coil.parent) parentIds.push(coil.parent);
  if (coil.parents) {
    if (Array.isArray(coil.parents)) parentIds.push(...coil.parents);
    else parentIds.push(coil.parents);
  }

  if (parentIds.length > 0) {
    for (const parentId of parentIds) {
      const parentLayers = resolveParentChain(
        parentId,
        library,
        new Set(coil.id ? [coil.id] : []),
        coilId,
      );
      if (!result.melody && parentLayers.melody && parentLayers.melody.length > 0) {
        result.melody = parentLayers.melody;
      }
      if (!result.harmony && parentLayers.harmony && parentLayers.harmony.length > 0) {
        result.harmony = parentLayers.harmony;
      }
      if (!result.rhythm && parentLayers.rhythm) {
        result.rhythm = parentLayers.rhythm;
      }
      if (result.harmonyOctave === undefined && parentLayers.harmonyOctave !== undefined) {
        result.harmonyOctave = parentLayers.harmonyOctave;
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
 * Expands a melody array supporting repeat padding numbers and space-separated tokens.
 * E.g. [Do, 3] -> [Do, Do, Do, Do]
 * E.g. [Do, Re, 2, Mi] -> [Do, Re, Re, Re, Mi]
 */
export function expandMelodyArray(
  melody: (string | number)[],
): string[] {
  const expanded: string[] = [];
  let lastPitch: string | null = null;

  for (const item of melody) {
    const isNum =
      typeof item === 'number' ||
      (typeof item === 'string' && /^\d+$/.test(item.trim()));

    if (isNum) {
      const count = typeof item === 'number' ? item : parseInt(item.trim(), 10);
      if (lastPitch === null) {
        throw new Error(`Melody array cannot start with a repeat padding number: ${item}`);
      }
      for (let k = 0; k < count; k++) {
        expanded.push(lastPitch);
      }
    } else {
      const tokens = String(item).trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        expanded.push(token);
        lastPitch = token;
      }
    }
  }

  return expanded;
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
