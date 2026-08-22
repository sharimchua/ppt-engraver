import type { Tapestry, Coil, Weave, KnotSummary } from '../schema/tapestry.js';
import type { OnsetStream } from '../schema/onset.js';
import type { ResolvedKnot } from '../solfege/pitch.js';
import { resolveKnot } from './knot.js';
import { resolveWeave } from './weave.js';

export interface ResolutionResult {
  /** The resolved onset stream */
  onsets: OnsetStream;
  /** All warnings accumulated during resolution */
  warnings: string[];
  /** The resolved Knot context */
  knot: ResolvedKnot;
  /** List of all available knots defined in the Tapestry */
  availableKnots?: KnotSummary[];
  /** The active selected knot ID */
  selectedKnotId?: string;
}

/**
 * Resolves a complete Tapestry IR into an onset stream.
 * 
 * Pipeline:
 * 1. Build reusable Coil library (if tapestry.coils is defined)
 * 2. Build reusable Weave library (if tapestry.weaves is defined)
 * 3. Resolve Knot (absolute anchor, root weave selection & engraving config)
 * 4. Determine root Weave (knot.weave -> tapestry.weave -> weaves.main/song -> first weave)
 * 5. Resolve Weave hierarchy
 * 6. Return flat onset stream with provenance tags
 * 
 * @param tapestry - The validated Tapestry IR
 * @param selectedKnotId - Optional ID of the knot to resolve
 * @returns Complete onset stream + accumulated warnings
 */
function registerCoils(
  rawCoils: Record<string, Coil | { coil: Coil }> | Array<Coil | { coil: Coil }> | undefined,
  coilLibrary: Map<string, Coil>,
) {
  if (!rawCoils) return;
  if (Array.isArray(rawCoils)) {
    for (const c of rawCoils) {
      const unwrapped = (typeof c === 'object' && c !== null && 'coil' in c && (c as { coil?: Coil }).coil) ? (c as { coil: Coil }).coil : (c as Coil);
      if (unwrapped && unwrapped.id) {
        coilLibrary.set(unwrapped.id, unwrapped);
      }
    }
  } else {
    for (const [id, c] of Object.entries(rawCoils)) {
      const unwrapped = (typeof c === 'object' && c !== null && 'coil' in c && (c as { coil?: Coil }).coil) ? (c as { coil: Coil }).coil : (c as Coil);
      coilLibrary.set(id, { ...unwrapped, id: unwrapped?.id ?? id });
    }
  }
}

export function resolveTapestry(tapestry: Tapestry, selectedKnotId?: string): ResolutionResult {
  const allWarnings: string[] = [];
  
  // 1. Build Coil library from top-level coils
  const coilLibrary = new Map<string, Coil>();
  registerCoils(tapestry.tapestry.coils, coilLibrary);

  // 2. Build Weave library and register in-place coils from weaves
  const weaveLibrary = new Map<string, Weave>();
  const rawWeaves = tapestry.tapestry.weaves;
  if (rawWeaves) {
    if (Array.isArray(rawWeaves)) {
      for (const w of rawWeaves) {
        if (w.id) {
          weaveLibrary.set(w.id, w);
        }
        registerCoils(w.coils, coilLibrary);
      }
    } else {
      for (const [id, w] of Object.entries(rawWeaves)) {
        const effectiveId = w.id ?? id;
        weaveLibrary.set(id, { ...w, id: effectiveId });
        registerCoils(w.coils, coilLibrary);
      }
    }
  }

  if (typeof tapestry.tapestry.weave === 'object') {
    registerCoils(tapestry.tapestry.weave.coils, coilLibrary);
  }

  // 3. Resolve Knot
  const { knot, availableKnots, selectedKnotId: resolvedKnotId, warnings: knotWarnings } = resolveKnot(tapestry, selectedKnotId);
  allWarnings.push(...knotWarnings);

  // 4. Identify Root Weave
  let rootWeave: Weave | undefined = undefined;

  // Priority 4a: Knot rootWeaveId
  if (knot.rootWeaveId) {
    rootWeave = weaveLibrary.get(knot.rootWeaveId);
    if (!rootWeave && typeof tapestry.tapestry.weave === 'object' && tapestry.tapestry.weave.id === knot.rootWeaveId) {
      rootWeave = tapestry.tapestry.weave;
    }
    if (!rootWeave) {
      throw new Error(`Knot references unknown root weave "${knot.rootWeaveId}"`);
    }
  }

  // Priority 4b: Top-level tapestry.weave
  if (!rootWeave && tapestry.tapestry.weave) {
    if (typeof tapestry.tapestry.weave === 'string') {
      rootWeave = weaveLibrary.get(tapestry.tapestry.weave);
      if (!rootWeave) {
        throw new Error(`Tapestry weave references unknown weave "${tapestry.tapestry.weave}"`);
      }
    } else {
      rootWeave = tapestry.tapestry.weave;
      const topWeaveId = rootWeave.id ?? 'main';
      weaveLibrary.set(topWeaveId, { ...rootWeave, id: topWeaveId });
    }
  }

  // Priority 4c: Standard named weaves ('main', 'song') in weaveLibrary
  if (!rootWeave) {
    rootWeave = weaveLibrary.get('main') ?? weaveLibrary.get('song');
  }

  // Priority 4d: First weave in weaveLibrary
  if (!rootWeave && weaveLibrary.size > 0) {
    rootWeave = weaveLibrary.values().next().value;
  }

  if (!rootWeave) {
    throw new Error(
      'No root weave found. Define a weave under tapestry.weave, tapestry.weaves, or specify weave in knot.'
    );
  }
  
  if (!knot.pulse && !knot.meter && (rootWeave.pulse || rootWeave.meter)) {
    knot.pulse = rootWeave.pulse ?? rootWeave.meter;
    knot.meter = knot.pulse;
  }

  // 5. Resolve Weave hierarchy
  const { onsets, warnings: weaveWarnings } = resolveWeave(
    rootWeave,
    knot,
    coilLibrary,
    weaveLibrary,
  );
  allWarnings.push(...weaveWarnings);

  // 6. If smooth voice leading is enabled, run seamless cross-boundary smoothing
  if (knot.harmonyVoicing === 'smoothLead') {
    applySmoothVoiceLeadingPass(onsets, knot);
  }
  
  return {
    onsets,
    warnings: allWarnings,
    knot,
    availableKnots,
    selectedKnotId: resolvedKnotId,
  };
}

import { generateSmoothVoiceLeading, getChordIntervals } from '../solfege/voicings.js';
import { parseHarmonyChord, solfegeToHarmonyRootOffset, midiToPitchName } from '../solfege/pitch.js';

/**
 * Optimizes chord inversions sequentially across all onsets and boundaries to minimize voice movement.
 */
function applySmoothVoiceLeadingPass(onsets: OnsetStream, knot: ResolvedKnot) {
  if (onsets.length === 0) return;
  let prevVoicing: number[] = [];
  let lastChordToken: string | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    const chordToken = onset.chordRoot;

    if (chordToken !== lastChordToken) {
      const parsed = parseHarmonyChord(chordToken);
      const semitone = solfegeToHarmonyRootOffset(parsed.rootSyllable);
      const rootMidi = knot.doMidi + semitone + ((knot.harmonyOctave ?? 0) * 12);
      const intervals = getChordIntervals(parsed.quality);
      const candidatePcs = intervals.map(inter => rootMidi + inter);

      const voiced = generateSmoothVoiceLeading(candidatePcs, prevVoicing, 60);
      prevVoicing = voiced;
      lastChordToken = chordToken;
    }

    onset.chordMidi = [...prevVoicing];
    onset.projectedChordMidi = [...prevVoicing];
    onset.chordTones = prevVoicing.map(m => midiToPitchName(m, knot.accidentalMode));
  }
}


