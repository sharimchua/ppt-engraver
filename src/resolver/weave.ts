/**
 * Weave resolver: traverses a Weave's children and concatenates resolved onset streams.
 * 
 * V1: only 'concatenate' layout mode. Generates provenance tags for each onset.
 */
import type { Weave, Coil } from '../schema/tapestry.js';
import type { ResolvedKnot } from '../solfege/pitch.js';
import type { Onset } from '../schema/onset.js';
import { midiToPitchName } from '../solfege/pitch.js';
import { resolveCoil } from './coil.js';

export interface WeaveResolutionResult {
  onsets: Onset[];
  warnings: string[];
}

/**
 * Resolves a Weave into a flat onset stream.
 * 
 * Walks children in order, resolves each coil, assigns provenance tags,
 * and concatenates the results.
 * 
 * @param weave - The Weave definition from the Tapestry IR
 * @param knot - The resolved Knot providing the Do anchor
 * @param coilLibrary - Map of named Coil definitions available for inheritance / references
 * @returns Flat onset stream with full provenance tags + warnings
 */
export function resolveWeave(
  weave: Weave,
  knot: ResolvedKnot,
  coilLibrary: Map<string, Coil> = new Map(),
): WeaveResolutionResult {
  const allOnsets: Onset[] = [];
  const allWarnings: string[] = [];
  
  // Resolve default coil for this weave if specified
  let defaultCoil: Coil | undefined;
  if (weave.defaultCoil) {
    if (typeof weave.defaultCoil === 'string') {
      defaultCoil = coilLibrary.get(weave.defaultCoil);
      if (!defaultCoil) {
        throw new Error(
          `Weave "${weave.id}" defaultCoil references unknown coil "${weave.defaultCoil}"`
        );
      }
    } else {
      defaultCoil = weave.defaultCoil;
    }
  }
  
  for (const child of weave.children) {
    // Resolve child coil (either direct Coil object or string reference ID)
    let coil: Coil;
    if (typeof child.coil === 'string') {
      const found = coilLibrary.get(child.coil);
      if (!found) {
        throw new Error(
          `Weave "${weave.id}" child references unknown coil "${child.coil}"`
        );
      }
      coil = found;
    } else {
      coil = child.coil;
    }

    const { onsets, warnings } = resolveCoil(coil, knot, coilLibrary, defaultCoil);
    allWarnings.push(...warnings);
    
    // Map resolved onsets to tagged Onset objects
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const onsetIndex = i + 1; // 1-based
      const tag = `ppt_${weave.id}_${coil.id}_${onsetIndex}`;
      
      allOnsets.push({
        tag,
        pitch: midiToPitchName(onset.melodyMidi, knot.accidentalMode),
        midiNote: onset.melodyMidi,
        scaleDegree: onset.scaleDegree,
        chordTones: onset.chordMidi.map(m => midiToPitchName(m, knot.accidentalMode)),
        chordMidi: [...onset.chordMidi],
        chordRoot: onset.chordRoot,
        coilId: coil.id,
        weaveId: weave.id,
        onsetIndex,
      });

    }
  }
  
  return { onsets: allOnsets, warnings: allWarnings };
}

