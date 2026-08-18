/**
 * Coil resolver: resolves a single Coil's layers into an onset stream.
 * 
 * Handles:
 * - Melody resolution (absolute and interval modes)
 * - Harmony resolution (chord root → major triad, held across onsets)
 * - Rhythm validation (block-length label vs melody.length)
 */
import { RHYTHM_BLOCK_LENGTHS } from '../constants.js';
import type {
  Coil,
  MelodyLayer,
  MelodyVoiceObject,
  HarmonyLayer,
  HarmonyObject,
  RhythmLayer,
  RhythmLabelType,
} from '../schema/tapestry.js';
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
  parseRepeatSpec,
} from '../solfege/pitch.js';
import {
  expandRhythmEntries,
  resolveRhythmTimeline,
  beatsToLilyPondDuration,
  type ResolvedRhythmOnset,
} from '../solfege/rhythm.js';
import { generateChordVoicing } from '../solfege/voicings.js';
import { generateMelodyAugmentation, type AugmentedNote } from '../solfege/augmentation.js';

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
  /** 1-based voice index for polyphonic coils */
  voiceIndex?: number;
  /** Optional rhythm token string if rhythmic grammar is used */
  rhythmToken?: string;
  /** Start timestamp in beats (quarter note = 1.0) within the coil */
  startBeat?: number;
  /** Duration in beats (quarter note = 1.0) */
  durationBeats?: number;
  /** LilyPond duration string, e.g. "4", "8", "16", "4*1/3" */
  duration?: string;
  /** Provenance: underlying coil ID for concats / sub-coils */
  sourceCoilId?: string;
  /** Provenance: 1-based onset index within the underlying sub-coil */
  sourceOnsetIndex?: number;
  /** Provenance: coil where melody was defined (local or inherited parent) */
  melodySourceCoil?: string;
  /** Provenance: coil where rhythm was defined (local or inherited parent) */
  rhythmSourceCoil?: string;
  /** Provenance: coil where harmony was defined (local or inherited parent) */
  harmonySourceCoil?: string;
  /** Optional augmented harmonic accompaniment notes generated for this melody onset */
  melodyAugmentationNotes?: AugmentedNote[];
}

export interface CoilResolutionResult {
  onsets: ResolvedOnset[];
  warnings: string[];
}

/** Normalized voice structure */
export interface NormalizedMelodyVoice {
  pitches: (string | number)[];
  rhythm?: RhythmLayer;
  meter?: RhythmLabelType;
  clef?: string;
  name?: string;
}

/** Normalized harmony structure */
export interface NormalizedHarmony {
  chords: (string | number)[];
  rhythm?: RhythmLayer;
  meter?: RhythmLabelType;
  harmonyOctave?: number;
}

/** Checks if a melody layer is defined and non-empty */
export function isMelodyDefined(m: MelodyLayer | undefined): boolean {
  if (!m) return false;
  if (typeof m === 'string') return m.trim().length > 0;
  if (Array.isArray(m)) return m.length > 0;
  if (typeof m === 'object' && m !== null) {
    if ('from' in m && typeof (m as any).from === 'string' && (m as any).from.trim().length > 0) return true;
    if ('use' in m && typeof (m as any).use === 'string' && (m as any).use.trim().length > 0) return true;
    const pitches = (m as any).pitches ?? (m as any).melody;
    return Array.isArray(pitches) && pitches.length > 0;
  }
  return false;
}

/** Checks if a harmony layer is defined and non-empty */
export function isHarmonyDefined(h: HarmonyLayer | undefined): boolean {
  if (!h) return false;
  if (typeof h === 'string') return h.trim().length > 0;
  if (Array.isArray(h)) return h.length > 0;
  if (typeof h === 'object' && h !== null) {
    if ('from' in h && typeof (h as any).from === 'string' && (h as any).from.trim().length > 0) return true;
    if ('use' in h && typeof (h as any).use === 'string' && (h as any).use.trim().length > 0) return true;
    const chords = (h as any).chords ?? (h as any).harmony;
    return Array.isArray(chords) && chords.length > 0;
  }
  return false;
}

/**
 * Normalizes any valid MelodyLayer representation into an array of NormalizedMelodyVoice objects.
 */
export function normalizeMelodyLayer(
  rawMelody: MelodyLayer | undefined,
  defaultRhythm?: RhythmLayer,
  defaultMeter?: RhythmLabelType,
): NormalizedMelodyVoice[] {
  if (!rawMelody) return [];

  // Structured single voice object { pitches: [...], rhythm: [...] }
  if (!Array.isArray(rawMelody) && typeof rawMelody === 'object' && rawMelody !== null) {
    const obj = rawMelody as MelodyVoiceObject;
    const rawPitches = obj.pitches ?? obj.melody ?? [];
    const pitches = typeof rawPitches === 'string' ? [rawPitches] : rawPitches;
    return [{
      pitches,
      rhythm: (typeof obj.rhythm === 'string' && RHYTHM_BLOCK_LENGTHS[obj.rhythm as RhythmLabelType] !== undefined)
        ? (obj.rhythm as RhythmLabelType)
        : (Array.isArray(obj.rhythm) ? obj.rhythm : defaultRhythm),
      meter: obj.meter ?? defaultMeter,
      clef: obj.clef,
      name: obj.name,
    }];
  }

  if (Array.isArray(rawMelody)) {
    if (rawMelody.length === 0) return [];

    // Check if the array contains sub-voices (array of arrays or array of voice objects)
    const isMultiVoice = rawMelody.some(item => Array.isArray(item) || (typeof item === 'object' && item !== null));

    if (isMultiVoice) {
      return rawMelody.map(voice => {
        if (Array.isArray(voice)) {
          return {
            pitches: voice,
            rhythm: defaultRhythm,
            meter: defaultMeter,
          };
        } else if (typeof voice === 'object' && voice !== null) {
          const obj = voice as MelodyVoiceObject;
          const rawPitches = obj.pitches ?? obj.melody ?? [];
          const pitches = typeof rawPitches === 'string' ? [rawPitches] : rawPitches;
          return {
            pitches,
            rhythm: (typeof obj.rhythm === 'string' && RHYTHM_BLOCK_LENGTHS[obj.rhythm as RhythmLabelType] !== undefined)
              ? (obj.rhythm as RhythmLabelType)
              : (Array.isArray(obj.rhythm) ? obj.rhythm : defaultRhythm),
            meter: obj.meter ?? defaultMeter,
            clef: obj.clef,
            name: obj.name,
          };
        }
        return {
          pitches: [voice],
          rhythm: defaultRhythm,
          meter: defaultMeter,
        };
      });
    }

    // Flat single voice pitch array
    return [{
      pitches: rawMelody as (string | number)[],
      rhythm: defaultRhythm,
      meter: defaultMeter,
    }];
  }

  return [];
}

/**
 * Normalizes any valid HarmonyLayer representation into a NormalizedHarmony object.
 */
export function normalizeHarmonyLayer(
  rawHarmony: HarmonyLayer | undefined,
  defaultRhythm?: RhythmLayer,
  defaultMeter?: RhythmLabelType,
  defaultOctave: number = 0,
): NormalizedHarmony {
  if (!rawHarmony) {
    return {
      chords: ['Do'],
      harmonyOctave: defaultOctave,
      meter: defaultMeter,
    };
  }

  if (Array.isArray(rawHarmony)) {
    return {
      chords: rawHarmony,
      harmonyOctave: defaultOctave,
      meter: defaultMeter,
    };
  }

  if (typeof rawHarmony === 'object' && rawHarmony !== null) {
    const obj = rawHarmony as HarmonyObject;
    const rawChords = obj.chords ?? obj.harmony ?? ['Do'];
    const chords = typeof rawChords === 'string' ? [rawChords] : rawChords;
    return {
      chords,
      rhythm: (typeof obj.rhythm === 'string' && RHYTHM_BLOCK_LENGTHS[obj.rhythm as RhythmLabelType] !== undefined)
        ? (obj.rhythm as RhythmLabelType)
        : (Array.isArray(obj.rhythm) ? obj.rhythm : defaultRhythm),
      meter: obj.meter ?? defaultMeter,
      harmonyOctave: obj.harmonyOctave ?? defaultOctave,
    };
  }

  return {
    chords: ['Do'],
    harmonyOctave: defaultOctave,
    meter: defaultMeter,
  };
}

/**
 * Resolves a composite coil defined with `concat: [...]`.
 * Stitches sub-coils into a continuous phrase and collapses overlapping downbeat boundary rests.
 */
export function resolveConcatCoil(
  coil: Coil,
  knot: ResolvedKnot,
  coilLibrary: Map<string, Coil> = new Map(),
  defaultCoil?: Coil,
): CoilResolutionResult {
  const warnings: string[] = [];
  const concatEntries = coil.concat!;
  const rawSubCoilOnsets: ResolvedOnset[][] = [];

  for (let i = 0; i < concatEntries.length; i++) {
    const entry = concatEntries[i];
    let subCoil: Coil;
    const subCoilId = typeof entry === 'string' ? entry : (entry.id ?? `subCoil_${i}`);
    if (typeof entry === 'string') {
      const found = coilLibrary.get(entry);
      if (!found) {
        throw new Error(
          `Coil "${coil.id ?? 'anonymous'}" concat references unknown coil "${entry}"`
        );
      }
      subCoil = { ...found, id: subCoilId };
    } else {
      subCoil = { ...entry, id: subCoilId };
    }

    const { onsets: subOnsets, warnings: subWarnings } = resolveCoil(
      subCoil,
      knot,
      coilLibrary,
      defaultCoil
    );
    warnings.push(...subWarnings);

    if (subOnsets.length === 0) continue;

    // Ensure sub-coil provenance is set on each onset
    for (let s = 0; s < subOnsets.length; s++) {
      subOnsets[s].sourceCoilId = subOnsets[s].sourceCoilId || subCoilId;
      subOnsets[s].sourceOnsetIndex = subOnsets[s].sourceOnsetIndex || (s + 1);
      subOnsets[s].melodySourceCoil = subOnsets[s].melodySourceCoil || subCoilId;
      subOnsets[s].rhythmSourceCoil = subOnsets[s].rhythmSourceCoil || subCoilId;
      subOnsets[s].harmonySourceCoil = subOnsets[s].harmonySourceCoil || subCoilId;
    }

    rawSubCoilOnsets.push(subOnsets);
  }

  const maxVoices = Math.max(1, ...rawSubCoilOnsets.map(stream => Math.max(1, ...stream.map(o => o.voiceIndex ?? 1))));
  const mergedOnsets: ResolvedOnset[] = [];

  if (maxVoices <= 1) {
    for (const subOnsets of rawSubCoilOnsets) {
      if (mergedOnsets.length === 0) {
        mergedOnsets.push(...subOnsets);
      } else {
        const lastMerged = mergedOnsets[mergedOnsets.length - 1];
        const firstSub = subOnsets[0];

        // Boundary Collapsing:
        if (lastMerged.isRest && firstSub.isRest) {
          mergedOnsets[mergedOnsets.length - 1] = {
            ...firstSub,
            chordMidi: lastMerged.chordMidi,
            chordRoot: lastMerged.chordRoot,
          };
          mergedOnsets.push(...subOnsets.slice(1));
        } else if (lastMerged.isRest && !firstSub.isRest && (firstSub.rhythmToken === 'Do' || firstSub.rhythmToken === undefined)) {
          mergedOnsets.pop();
          mergedOnsets.push(...subOnsets);
        } else {
          mergedOnsets.push(...subOnsets);
        }
      }
    }
  } else {
    for (let v = 1; v <= maxVoices; v++) {
      const voiceMerged: ResolvedOnset[] = [];
      for (const subOnsets of rawSubCoilOnsets) {
        const vSub = subOnsets.filter(o => (o.voiceIndex ?? 1) === v);
        if (vSub.length === 0) continue;
        if (voiceMerged.length === 0) {
          voiceMerged.push(...vSub);
        } else {
          const lastMerged = voiceMerged[voiceMerged.length - 1];
          const firstSub = vSub[0];
          if (lastMerged.isRest && firstSub.isRest) {
            voiceMerged[voiceMerged.length - 1] = {
              ...firstSub,
              chordMidi: lastMerged.chordMidi,
              chordRoot: lastMerged.chordRoot,
            };
            voiceMerged.push(...vSub.slice(1));
          } else if (lastMerged.isRest && !firstSub.isRest && (firstSub.rhythmToken === 'Do' || firstSub.rhythmToken === undefined)) {
            voiceMerged.pop();
            voiceMerged.push(...vSub);
          } else {
            voiceMerged.push(...vSub);
          }
        }
      }
      mergedOnsets.push(...voiceMerged);
    }
  }

  // Recalculate startBeat sequentially for merged onsets to preserve timing across concatenated sub-coils
  if (maxVoices <= 1) {
    let currentBeat = 0;
    for (let i = 0; i < mergedOnsets.length; i++) {
      mergedOnsets[i].startBeat = currentBeat;
      const dur = mergedOnsets[i].durationBeats ?? 1.0;
      currentBeat += dur;
    }
  } else {
    for (let v = 1; v <= maxVoices; v++) {
      let currentBeat = 0;
      for (let i = 0; i < mergedOnsets.length; i++) {
        if ((mergedOnsets[i].voiceIndex ?? 1) === v) {
          mergedOnsets[i].startBeat = currentBeat;
          const dur = mergedOnsets[i].durationBeats ?? 1.0;
          currentBeat += dur;
        }
      }
    }
  }

  // Resolve layers using inheritance and injection rules for composite concat coil
  const resolvedLayers = inheritCoilLayers(coil, coilLibrary, defaultCoil);

  // If the composite coil specifies or inherits its own harmony layer, override harmony across all onsets
  if (resolvedLayers.harmony && isHarmonyDefined(resolvedLayers.harmony)) {
    const normalizedHarmony = normalizeHarmonyLayer(
      resolvedLayers.harmony,
      resolvedLayers.rhythm,
      resolvedLayers.meter,
      resolvedLayers.harmonyOctave ?? 0
    );
    const totalOnsets = mergedOnsets.length;
    const activeVoicing = resolvedLayers.harmonyVoicing ?? knot.harmonyVoicing ?? 'close';
    const harmonyChords = resolveHarmony(
      normalizedHarmony.chords,
      totalOnsets,
      knot,
      normalizedHarmony.harmonyOctave ?? 0,
      normalizedHarmony.rhythm,
      mergedOnsets,
      activeVoicing,
    );
    for (let k = 0; k < totalOnsets; k++) {
      mergedOnsets[k].chordMidi = harmonyChords[k].triad;
      mergedOnsets[k].chordRoot = harmonyChords[k].root;
      mergedOnsets[k].harmonySourceCoil = resolvedLayers.harmonySourceCoil || coil.id;
    }
  } else if (resolvedLayers.harmonyOctave !== undefined && resolvedLayers.harmonyOctave !== 0) {
    const shiftSemitones = resolvedLayers.harmonyOctave * 12;
    for (const onset of mergedOnsets) {
      onset.chordMidi = onset.chordMidi.map(m => m + shiftSemitones);
    }
  }

  // If the composite coil specifies or inherits harmonic melody augmentation, apply it across all onsets
  const activeAugmentation = resolvedLayers.melodyAugmentation ?? knot.melodyAugmentation ?? 'none';
  if (activeAugmentation !== 'none') {
    for (const onset of mergedOnsets) {
      if (!onset.isRest && onset.melodyMidi !== undefined) {
        onset.melodyAugmentationNotes = generateMelodyAugmentation(
          onset.melodyMidi,
          onset.chordRoot ?? 'Do',
          knot.doMidi,
          activeAugmentation
        );
      }
    }
  }

  return { onsets: mergedOnsets, warnings };
}

/**
 * Resolves a single voice stream into ResolvedOnset array.
 */
function resolveVoiceOnsets(
  voice: NormalizedMelodyVoice,
  voiceIndex: number,
  fallbackRhythm: RhythmLayer | undefined,
  fallbackMeter: RhythmLabelType | undefined,
  normalizedHarmony: NormalizedHarmony,
  resolvedLayers: ResolvedLayers,
  knot: ResolvedKnot,
  coilId: string,
  warnings: string[],
): ResolvedOnset[] {
  const melody = expandMelodyArray(voice.pitches);
  const rhythm = voice.rhythm ?? fallbackRhythm;

  let resolvedRhythmOnsets: ResolvedRhythmOnset[] | null = null;
  let totalOnsets = melody.length;

  if (Array.isArray(rhythm)) {
    const expanded = expandRhythmEntries(rhythm, melody.length);
    resolvedRhythmOnsets = resolveRhythmTimeline(expanded);
    totalOnsets = resolvedRhythmOnsets.length;
  } else if (typeof rhythm === 'string') {
    const expectedCount = RHYTHM_BLOCK_LENGTHS[rhythm as RhythmLabelType];
    if (expectedCount === undefined) {
      warnings.push(`Coil "${coilId}": unknown rhythm label "${rhythm}"`);
    } else if (melody.length !== expectedCount) {
      warnings.push(
        `Coil "${coilId}": rhythm label "${rhythm}" specifies ${expectedCount} beats, but melody has ${melody.length} onsets (subdivision timing deferred to Phase 5)`
      );
    }
  }

  const melodyPitches = resolveMelody(melody, knot);
  const activeVoicing = resolvedLayers.harmonyVoicing ?? knot.harmonyVoicing ?? 'close';
  const activeAugmentation = resolvedLayers.melodyAugmentation ?? knot.melodyAugmentation ?? 'none';

  const harmonyChords = resolveHarmony(
    normalizedHarmony.chords,
    totalOnsets,
    knot,
    normalizedHarmony.harmonyOctave ?? 0,
    normalizedHarmony.rhythm,
    resolvedRhythmOnsets,
    activeVoicing,
  );

  const voiceOnsets: ResolvedOnset[] = [];

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
      const augmentationNotes = (!isRest && mp && activeAugmentation !== 'none')
        ? generateMelodyAugmentation(mp.midi, chord.root, knot.doMidi, activeAugmentation)
        : undefined;

      voiceOnsets.push({
        melodyMidi: mp ? mp.midi : 0,
        scaleDegree: mp ? mp.scaleDegree : '',
        isRest,
        chordMidi: chord.triad,
        chordRoot: chord.root,
        voiceIndex,
        rhythmToken: ro.token,
        startBeat: ro.startBeat,
        durationBeats: ro.durationBeats,
        duration: ro.lilypondDuration,
        sourceCoilId: coilId,
        sourceOnsetIndex: k + 1,
        melodySourceCoil: resolvedLayers.melodySourceCoil || coilId,
        rhythmSourceCoil: resolvedLayers.rhythmSourceCoil || coilId,
        harmonySourceCoil: resolvedLayers.harmonySourceCoil || coilId,
        melodyAugmentationNotes: augmentationNotes,
      });
    }
  } else {
    for (let i = 0; i < totalOnsets; i++) {
      const mp = melodyPitches[i];
      const isRest = i >= melodyPitches.length;
      const chord = harmonyChords[i];
      const augmentationNotes = (!isRest && mp && activeAugmentation !== 'none')
        ? generateMelodyAugmentation(mp.midi, chord.root, knot.doMidi, activeAugmentation)
        : undefined;

      voiceOnsets.push({
        melodyMidi: mp ? mp.midi : 0,
        scaleDegree: mp ? mp.scaleDegree : '',
        isRest,
        chordMidi: chord.triad,
        chordRoot: chord.root,
        voiceIndex,
        rhythmToken: undefined,
        startBeat: i,
        durationBeats: 1.0,
        duration: '4',
        sourceCoilId: coilId,
        sourceOnsetIndex: i + 1,
        melodySourceCoil: resolvedLayers.melodySourceCoil || coilId,
        rhythmSourceCoil: resolvedLayers.rhythmSourceCoil || coilId,
        harmonySourceCoil: resolvedLayers.harmonySourceCoil || coilId,
        melodyAugmentationNotes: augmentationNotes,
      });
    }
  }

  return voiceOnsets;
}

/**
 * Resolves a single Coil into an array of ResolvedOnsets.
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
  
  // Resolve layers using inheritance rules
  const resolvedLayers = inheritCoilLayers(coil, coilLibrary, defaultCoil);
  
  const normalizedVoices = normalizeMelodyLayer(
    resolvedLayers.melody,
    resolvedLayers.rhythm,
    resolvedLayers.meter,
  );

  if (normalizedVoices.length === 0 || normalizedVoices.every(v => v.pitches.length === 0)) {
    throw new Error(
      `Coil "${coil.id}": melody layer is required (not defined locally, in parents, or in default coil)`
    );
  }

  const normalizedHarmony = normalizeHarmonyLayer(
    resolvedLayers.harmony,
    resolvedLayers.rhythm,
    resolvedLayers.meter,
    resolvedLayers.harmonyOctave ?? 0,
  );

  const coilId = coil.id ?? 'anonymousCoil';
  const allOnsets: ResolvedOnset[] = [];

  for (let v = 0; v < normalizedVoices.length; v++) {
    const voiceOnsets = resolveVoiceOnsets(
      normalizedVoices[v],
      v + 1,
      resolvedLayers.rhythm,
      resolvedLayers.meter,
      normalizedHarmony,
      resolvedLayers,
      knot,
      coilId,
      warnings,
    );
    allOnsets.push(...voiceOnsets);
  }
  
  return { onsets: allOnsets, warnings };
}

interface ResolvedLayers {
  melody?: MelodyLayer;
  harmony?: HarmonyLayer;
  rhythm?: RhythmLayer;
  meter?: RhythmLabelType;
  harmonyOctave?: number;
  harmonyVoicing?: 'close' | 'rootless' | 'rootFifth' | 'shell' | 'open' | 'smoothLead' | 'bassOnly' | 'walkingBass' | 'octaves';
  melodyAugmentation?: 'none' | 'thirdsBelow' | 'sixthsBelow' | 'triadClose' | 'drop2' | 'guideToneDyad' | 'octaves';
  melodyAugmentationDisplay?: 'ghosted' | 'dimmed' | 'smallColored' | 'smallMuted' | 'parenthesized' | 'diamond' | 'normal';
  projection?: 'default' | 'chordMelody' | 'leadSheet' | 'jazzComping' | 'acousticFolk' | 'bassAndLead';
  melodySourceCoil?: string;
  harmonySourceCoil?: string;
  rhythmSourceCoil?: string;
}

/**
 * Helper to parse layer reference string, e.g. "changes", "changes.harmony", "bass_riff.melody"
 */
function parseLayerRef(
  ref: string,
  defaultLayer: 'melody' | 'harmony' | 'rhythm'
): { coilId: string; layer: 'melody' | 'harmony' | 'rhythm' } {
  const parts = ref.trim().split('.');
  if (parts.length === 1) {
    return { coilId: parts[0], layer: defaultLayer };
  }
  const layerName = parts[1].toLowerCase();
  let layer: 'melody' | 'harmony' | 'rhythm' = defaultLayer;
  if (layerName === 'melody' || layerName === 'harmony' || layerName === 'rhythm') {
    layer = layerName;
  }
  return { coilId: parts[0], layer };
}

/**
 * Extracts a specific layer (melody, harmony, or rhythm) from a referenced coil in the library.
 */
function extractLayerFromCoil(
  refStr: string,
  targetLayer: 'melody' | 'harmony' | 'rhythm',
  library: Map<string, Coil>,
  callerId: string,
  visited: Set<string> = new Set(),
): { data: any; sourceCoilId: string; overrides?: Partial<ResolvedLayers> } {
  const { coilId: refCoilId, layer: sourceLayerType } = parseLayerRef(refStr, targetLayer);

  if (visited.has(refCoilId)) {
    throw new Error(
      `Circular coil layer reference detected: ${[...visited, refCoilId].join(' -> ')}`
    );
  }

  const targetCoil = library.get(refCoilId);
  if (!targetCoil) {
    throw new Error(
      `Coil "${callerId}": ${targetLayer} references unknown coil "${refCoilId}"`
    );
  }

  const nextVisited = new Set(visited).add(refCoilId);
  const resolvedTarget = inheritCoilLayers(targetCoil, library, undefined, nextVisited);

  let extractedData: any;
  if (sourceLayerType === 'harmony') {
    if (resolvedTarget.harmony) {
      if (targetLayer === 'melody') {
        // Cross-layer: extract harmony chords as melody pitch tokens
        const norm = normalizeHarmonyLayer(resolvedTarget.harmony);
        extractedData = norm.chords.map(c => typeof c === 'string' ? parseHarmonyChord(c).rootSyllable : c);
      } else {
        extractedData = resolvedTarget.harmony;
      }
    }
  } else if (sourceLayerType === 'melody') {
    if (resolvedTarget.melody) {
      if (targetLayer === 'harmony') {
        // Cross-layer: extract melody pitches as harmony chords
        const normVoices = normalizeMelodyLayer(resolvedTarget.melody);
        extractedData = normVoices[0]?.pitches ?? ['Do'];
      } else {
        extractedData = resolvedTarget.melody;
      }
    }
  } else if (sourceLayerType === 'rhythm') {
    extractedData = resolvedTarget.rhythm;
  }

  if (!extractedData) {
    throw new Error(
      `Coil "${callerId}": layer injection from "${refStr}" found no ${sourceLayerType} in coil "${refCoilId}"`
    );
  }

  const sourceCoilId = (sourceLayerType === 'harmony'
    ? resolvedTarget.harmonySourceCoil
    : sourceLayerType === 'rhythm'
    ? resolvedTarget.rhythmSourceCoil
    : resolvedTarget.melodySourceCoil) || refCoilId;

  return {
    data: extractedData,
    sourceCoilId,
    overrides: {
      harmonyOctave: resolvedTarget.harmonyOctave,
      harmonyVoicing: resolvedTarget.harmonyVoicing,
      melodyAugmentation: resolvedTarget.melodyAugmentation,
      melodyAugmentationDisplay: resolvedTarget.melodyAugmentationDisplay,
      projection: resolvedTarget.projection,
    },
  };
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
  return inheritCoilLayers(parent, library, undefined, nextVisited);
}

/**
 * Resolves M, H, R layers using the priority-fill rule across explicit injection, parents, and default coil.
 */
function inheritCoilLayers(
  coil: Coil,
  library: Map<string, Coil>,
  defaultCoil?: Coil,
  visited: Set<string> = new Set(),
): ResolvedLayers {
  const result: ResolvedLayers = {};
  const coilId = coil.id ?? 'anonymousCoil';
  const nextVisited = new Set(visited);
  if (coil.id) nextVisited.add(coil.id);

  // 1. Explicit local definition & layer injection
  // 1a. Melody
  if (coil.melody) {
    if (typeof coil.melody === 'string') {
      const extracted = extractLayerFromCoil(coil.melody, 'melody', library, coilId, nextVisited);
      result.melody = extracted.data;
      result.melodySourceCoil = extracted.sourceCoilId;
    } else if (typeof coil.melody === 'object' && !Array.isArray(coil.melody)) {
      const voiceObj = coil.melody as any;
      const refStr = (typeof voiceObj.from === 'string' ? voiceObj.from
        : typeof voiceObj.use === 'string' ? voiceObj.use
        : typeof voiceObj.pitches === 'string' ? voiceObj.pitches
        : typeof voiceObj.melody === 'string' ? voiceObj.melody
        : undefined);

      if (refStr) {
        const extracted = extractLayerFromCoil(refStr, 'melody', library, coilId, nextVisited);
        const pitches = Array.isArray(extracted.data)
          ? extracted.data
          : (extracted.data.pitches ?? extracted.data.melody ?? []);
        result.melody = {
          pitches,
          rhythm: voiceObj.rhythm ?? extracted.data.rhythm,
          meter: voiceObj.meter ?? extracted.data.meter,
          clef: voiceObj.clef ?? extracted.data.clef,
          name: voiceObj.name ?? extracted.data.name,
        };
        result.melodySourceCoil = extracted.sourceCoilId;
      } else if (isMelodyDefined(coil.melody)) {
        result.melody = coil.melody;
        result.melodySourceCoil = coil.id;
      }
    } else if (Array.isArray(coil.melody)) {
      const isVoiceRefs = coil.melody.some(v => typeof v === 'string' && library.has(v) || (typeof v === 'object' && v !== null && ('from' in v || 'use' in v)));
      if (isVoiceRefs) {
        result.melody = coil.melody.map(v => {
          if (typeof v === 'string' && library.has(v)) {
            const ext = extractLayerFromCoil(v, 'melody', library, coilId, nextVisited);
            return ext.data;
          }
          if (typeof v === 'object' && v !== null && ('from' in v || 'use' in v)) {
            const refStr = ((v as any).from ?? (v as any).use) as string;
            const ext = extractLayerFromCoil(refStr, 'melody', library, coilId, nextVisited);
            return { ...ext.data, ...v, pitches: ext.data };
          }
          return v;
        });
        result.melodySourceCoil = coil.id;
      } else if (isMelodyDefined(coil.melody)) {
        result.melody = coil.melody;
        result.melodySourceCoil = coil.id;
      }
    } else if (isMelodyDefined(coil.melody)) {
      result.melody = coil.melody;
      result.melodySourceCoil = coil.id;
    }
  }

  // 1b. Harmony
  if (coil.harmony) {
    if (typeof coil.harmony === 'string') {
      const extracted = extractLayerFromCoil(coil.harmony, 'harmony', library, coilId, nextVisited);
      result.harmony = extracted.data;
      result.harmonySourceCoil = extracted.sourceCoilId;
      if (result.harmonyOctave === undefined && extracted.overrides?.harmonyOctave !== undefined) {
        result.harmonyOctave = extracted.overrides.harmonyOctave;
      }
      if (result.harmonyVoicing === undefined && extracted.overrides?.harmonyVoicing !== undefined) {
        result.harmonyVoicing = extracted.overrides.harmonyVoicing;
      }
    } else if (typeof coil.harmony === 'object' && !Array.isArray(coil.harmony)) {
      const harmObj = coil.harmony as any;
      const refStr = (typeof harmObj.from === 'string' ? harmObj.from
        : typeof harmObj.use === 'string' ? harmObj.use
        : typeof harmObj.chords === 'string' ? harmObj.chords
        : typeof harmObj.harmony === 'string' ? harmObj.harmony
        : undefined);

      if (refStr) {
        const extracted = extractLayerFromCoil(refStr, 'harmony', library, coilId, nextVisited);
        const chords = Array.isArray(extracted.data)
          ? extracted.data
          : (extracted.data.chords ?? extracted.data.harmony ?? ['Do']);
        result.harmony = {
          chords,
          rhythm: harmObj.rhythm ?? extracted.data.rhythm,
          meter: harmObj.meter ?? extracted.data.meter,
          harmonyOctave: harmObj.harmonyOctave ?? extracted.overrides?.harmonyOctave,
          harmonyVoicing: harmObj.harmonyVoicing ?? extracted.overrides?.harmonyVoicing,
        };
        result.harmonySourceCoil = extracted.sourceCoilId;
        if (harmObj.harmonyOctave !== undefined) result.harmonyOctave = harmObj.harmonyOctave;
        else if (extracted.overrides?.harmonyOctave !== undefined) result.harmonyOctave = extracted.overrides.harmonyOctave;
        if (harmObj.harmonyVoicing !== undefined) result.harmonyVoicing = harmObj.harmonyVoicing;
        else if (extracted.overrides?.harmonyVoicing !== undefined) result.harmonyVoicing = extracted.overrides.harmonyVoicing;
      } else if (isHarmonyDefined(coil.harmony)) {
        result.harmony = coil.harmony;
        result.harmonySourceCoil = coil.id;
      }
    } else if (Array.isArray(coil.harmony)) {
      result.harmony = coil.harmony;
      result.harmonySourceCoil = coil.id;
    }
  }

  // 1c. Rhythm
  if (coil.rhythm) {
    if (typeof coil.rhythm === 'string') {
      if (RHYTHM_BLOCK_LENGTHS[coil.rhythm as RhythmLabelType] !== undefined) {
        result.rhythm = coil.rhythm as RhythmLabelType;
        result.rhythmSourceCoil = coil.id;
      } else {
        const extracted = extractLayerFromCoil(coil.rhythm, 'rhythm', library, coilId, nextVisited);
        result.rhythm = extracted.data;
        result.rhythmSourceCoil = extracted.sourceCoilId;
      }
    } else if (typeof coil.rhythm === 'object' && !Array.isArray(coil.rhythm) && ('from' in coil.rhythm || 'use' in coil.rhythm)) {
      const refStr = ((coil.rhythm as any).from ?? (coil.rhythm as any).use) as string;
      const extracted = extractLayerFromCoil(refStr, 'rhythm', library, coilId, nextVisited);
      result.rhythm = extracted.data;
      result.rhythmSourceCoil = extracted.sourceCoilId;
    } else {
      result.rhythm = coil.rhythm;
      result.rhythmSourceCoil = coil.id;
    }
  }

  if (coil.harmonyOctave !== undefined) result.harmonyOctave = coil.harmonyOctave;
  if (coil.harmonyVoicing !== undefined) result.harmonyVoicing = coil.harmonyVoicing;
  if (coil.melodyAugmentation !== undefined) result.melodyAugmentation = coil.melodyAugmentation;
  if (coil.melodyAugmentationDisplay !== undefined) result.melodyAugmentationDisplay = coil.melodyAugmentationDisplay;
  if (coil.projection !== undefined) result.projection = coil.projection;

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
        nextVisited,
        coilId,
      );
      if (!result.melody && parentLayers.melody) {
        result.melody = parentLayers.melody;
        result.melodySourceCoil = parentLayers.melodySourceCoil || parentId;
      }
      if (!result.harmony && parentLayers.harmony) {
        result.harmony = parentLayers.harmony;
        result.harmonySourceCoil = parentLayers.harmonySourceCoil || parentId;
      }
      if (!result.rhythm && parentLayers.rhythm) {
        result.rhythm = parentLayers.rhythm;
        result.rhythmSourceCoil = parentLayers.rhythmSourceCoil || parentId;
      }
      if (result.harmonyOctave === undefined && parentLayers.harmonyOctave !== undefined) {
        result.harmonyOctave = parentLayers.harmonyOctave;
      }
      if (result.harmonyVoicing === undefined && parentLayers.harmonyVoicing !== undefined) {
        result.harmonyVoicing = parentLayers.harmonyVoicing;
      }
      if (result.melodyAugmentation === undefined && parentLayers.melodyAugmentation !== undefined) {
        result.melodyAugmentation = parentLayers.melodyAugmentation;
      }
      if (result.melodyAugmentationDisplay === undefined && parentLayers.melodyAugmentationDisplay !== undefined) {
        result.melodyAugmentationDisplay = parentLayers.melodyAugmentationDisplay;
      }
      if (result.projection === undefined && parentLayers.projection !== undefined) {
        result.projection = parentLayers.projection;
      }
    }
  }

  // 3. Default coil from Weave scope
  if (defaultCoil) {
    if (!result.melody && defaultCoil.melody && isMelodyDefined(defaultCoil.melody)) {
      result.melody = defaultCoil.melody;
      result.melodySourceCoil = defaultCoil.id;
    }
    if (!result.harmony && defaultCoil.harmony && isHarmonyDefined(defaultCoil.harmony)) {
      result.harmony = defaultCoil.harmony;
      result.harmonySourceCoil = defaultCoil.id;
    }
    if (!result.rhythm && defaultCoil.rhythm) {
      result.rhythm = defaultCoil.rhythm;
      result.rhythmSourceCoil = defaultCoil.id;
    }
    if (result.harmonyOctave === undefined && defaultCoil.harmonyOctave !== undefined) {
      result.harmonyOctave = defaultCoil.harmonyOctave;
    }
    if (result.harmonyVoicing === undefined && defaultCoil.harmonyVoicing !== undefined) {
      result.harmonyVoicing = defaultCoil.harmonyVoicing;
    }
    if (result.melodyAugmentation === undefined && defaultCoil.melodyAugmentation !== undefined) {
      result.melodyAugmentation = defaultCoil.melodyAugmentation;
    }
    if (result.melodyAugmentationDisplay === undefined && defaultCoil.melodyAugmentationDisplay !== undefined) {
      result.melodyAugmentationDisplay = defaultCoil.melodyAugmentationDisplay;
    }
    if (result.projection === undefined && defaultCoil.projection !== undefined) {
      result.projection = defaultCoil.projection;
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
 * Expands a melody array supporting repeat padding numbers (e.g. 3 or "3"),
 * repeat lookback windows (e.g. 2.3 or "2.3" to repeat last 3 items 2 times),
 * and space-separated tokens.
 * E.g. [Do, 3] -> [Do, Do, Do, Do]
 * E.g. [Do, Re, 2, Mi] -> [Do, Re, Re, Re, Mi]
 * E.g. [Do, Re, Mi, 1.2] -> [Do, Re, Mi, Re, Mi]
 * E.g. [Do, Re, Mi, Fa, 2.3] -> [Do, Re, Mi, Fa, Re, Mi, Fa, Re, Mi, Fa]
 */
export function expandMelodyArray(
  melody: (string | number)[],
): string[] {
  const expanded: string[] = [];

  for (const item of melody) {
    const repeatSpec = parseRepeatSpec(item);

    if (repeatSpec !== null) {
      const { repeatCount, windowSize } = repeatSpec;
      if (expanded.length === 0) {
        throw new Error(`Melody array cannot start with a repeat padding number: ${item}`);
      }
      if (windowSize > expanded.length) {
        throw new Error(
          `Repeat lookback window (${windowSize}) exceeds available items in melody array (${expanded.length}): ${item}`
        );
      }
      const window = expanded.slice(-windowSize);
      for (let k = 0; k < repeatCount; k++) {
        expanded.push(...window);
      }
    } else {
      const tokens = String(item).trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        expanded.push(token);
      }
    }
  }

  return expanded;
}

/**
 * Expands a harmony array supporting repeat padding numbers (e.g. 3 or "3")
 * and repeat lookback windows (e.g. 1.2 or "1.2").
 * E.g. [DoMe, 1, Te, 1, Le, 1, So] -> [DoMe, DoMe, Te, Te, Le, Le, So]
 * E.g. [Do, 3] -> [Do, Do, Do, Do]
 * E.g. [Do, So, 1.2] -> [Do, So, Do, So]
 */
export function expandHarmonyArray(
  harmony: (string | number)[],
): { expanded: string[]; hasExplicitCounts: boolean } {
  const expanded: string[] = [];
  let hasExplicitCounts = false;

  for (const item of harmony) {
    const repeatSpec = parseRepeatSpec(item);

    if (repeatSpec !== null) {
      hasExplicitCounts = true;
      const { repeatCount, windowSize } = repeatSpec;
      if (expanded.length === 0) {
        throw new Error(`Harmony array cannot start with a repeat padding number: ${item}`);
      }
      if (windowSize > expanded.length) {
        throw new Error(
          `Repeat lookback window (${windowSize}) exceeds available items in harmony array (${expanded.length}): ${item}`
        );
      }
      const window = expanded.slice(-windowSize);
      for (let k = 0; k < repeatCount; k++) {
        expanded.push(...window);
      }
    } else {
      const chordStr = String(item).trim();
      expanded.push(chordStr);
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
 * - Timeline-aware alignment when dedicated harmony rhythm is provided
 * - Direct padded indexing when repeat numbers are provided (e.g. [Do, 1, So, 2])
 * - Cross-layer alignment (stretch mode) when unpadded (e.g. [Do, So])
 */
function resolveHarmony(
  harmony: (string | number)[],
  melodyLength: number,
  knot: ResolvedKnot,
  harmonyOctave: number = 0,
  harmonyRhythm?: RhythmLayer,
  melodyRhythmOnsets?: Array<{ startBeat?: number }> | null,
  harmonyVoicing?: 'close' | 'rootless' | 'rootFifth' | 'shell' | 'open' | 'smoothLead' | 'bassOnly' | 'walkingBass' | 'octaves',
): HarmonyChord[] {
  const { expanded, hasExplicitCounts } = expandHarmonyArray(harmony);
  const activeVoicing = harmonyVoicing ?? knot.harmonyVoicing ?? 'close';

  const getChordForToken = (token: string): HarmonyChord => {
    const parsed = parseHarmonyChord(token);
    const semitone = solfegeToHarmonyRootOffset(parsed.rootSyllable);
    const rootMidi = knot.doMidi + semitone + (harmonyOctave * 12);
    return {
      triad: generateChordVoicing(rootMidi, token, {
        voicing: activeVoicing,
        knotDoMidi: knot.doMidi + (harmonyOctave * 12),
      }),
      root: token,
    };
  };

  const result: HarmonyChord[] = [];

  // Case 1: Timeline-aware rhythm provided for harmony
  if (
    harmonyRhythm &&
    Array.isArray(harmonyRhythm) &&
    melodyRhythmOnsets &&
    melodyRhythmOnsets.length > 0
  ) {
    const expandedRhythm = expandRhythmEntries(harmonyRhythm, expanded.length, false);
    const harmonyTimeline = resolveRhythmTimeline(expandedRhythm);
    let chordIdx = 0;

    for (let i = 0; i < melodyLength; i++) {
      const melodyOnsetBeat = (melodyRhythmOnsets[i] && melodyRhythmOnsets[i].startBeat !== undefined)
        ? melodyRhythmOnsets[i].startBeat!
        : i;

      // Find latest chord triggered on or before this melody onset
      while (
        chordIdx + 1 < harmonyTimeline.length &&
        chordIdx + 1 < expanded.length &&
        harmonyTimeline[chordIdx + 1].startBeat <= melodyOnsetBeat + 1e-4
      ) {
        chordIdx++;
      }

      const activeChordToken = expanded[Math.min(chordIdx, expanded.length - 1)] ?? 'Do';
      result.push(getChordForToken(activeChordToken));
    }
    return result;
  }

  // Case 2: Explicit padding/indexing provided (e.g. [Do, 2, Fa, 2, Do])
  if (hasExplicitCounts) {
    for (let i = 0; i < melodyLength; i++) {
      if (i < expanded.length) {
        result.push(getChordForToken(expanded[i]));
      } else {
        const lastToken = expanded[expanded.length - 1] ?? 'Do';
        result.push(getChordForToken(lastToken));
      }
    }
    return result;
  }

  // Case 3: Default stretch mode across melody onsets
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

  return result;
}
