/**
 * Weave resolver: traverses a Weave's children and concatenates resolved onset streams.
 * 
 * V1: only 'concatenate' layout mode. Generates provenance tags for each onset.
 */
import type { Weave } from '../schema/tapestry.js';
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
 * @returns Flat onset stream with full provenance tags + warnings
 */
export function resolveWeave(weave: Weave, knot: ResolvedKnot): WeaveResolutionResult {
  const allOnsets: Onset[] = [];
  const allWarnings: string[] = [];
  
  for (const child of weave.children) {
    const coil = child.coil;
    const { onsets, warnings } = resolveCoil(coil, knot);
    allWarnings.push(...warnings);
    
    // Map resolved onsets to tagged Onset objects
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const onsetIndex = i + 1; // 1-based
      const tag = `ppt_${weave.id}_${coil.id}_${onsetIndex}`;
      
      allOnsets.push({
        tag,
        pitch: midiToPitchName(onset.melodyMidi),
        midiNote: onset.melodyMidi,
        scaleDegree: onset.scaleDegree,
        chordTones: onset.chordMidi.map(m => midiToPitchName(m)),
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
