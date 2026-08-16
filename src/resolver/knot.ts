/**
 * Knot resolver: resolves the absolute pitch anchor for the Tapestry.
 * 
 * If a Knot is present, uses its `do` pitch as the anchor.
 * If no Knot exists anywhere, falls back to C4 with a warning (per §5.2).
 */
import { DEFAULT_DO, DEFAULT_TEMPO } from '../constants.js';
import {
  pitchNameToMidi,
  getAccidentalModeFromPitchName,
  type ResolvedKnot,
} from '../solfege/pitch.js';
import type { Tapestry } from '../schema/tapestry.js';

export interface KnotResolutionResult {
  knot: ResolvedKnot;
  warnings: string[];
}

/**
 * Resolves the Knot (absolute anchor) from a Tapestry.
 * 
 * @param tapestry - The validated Tapestry IR
 * @returns Resolved knot with MIDI note for Do, accidentalMode, plus any warnings
 */
export function resolveKnot(tapestry: Tapestry): KnotResolutionResult {
  const warnings: string[] = [];
  const knotDef = tapestry.tapestry.knot;
  
  if (!knotDef) {
    warnings.push(
      `No Knot defined — falling back to default: Do = ${DEFAULT_DO}, tempo = ${DEFAULT_TEMPO}`
    );
    return {
      knot: {
        doMidi: pitchNameToMidi(DEFAULT_DO),
        tempo: DEFAULT_TEMPO,
        doName: DEFAULT_DO,
        accidentalMode: 'sharps',
      },
      warnings,
    };
  }
  
  const doMidi = pitchNameToMidi(knotDef.do);
  const tempo = knotDef.tempo ?? DEFAULT_TEMPO;
  const accidentalMode = getAccidentalModeFromPitchName(knotDef.do);
  
  return {
    knot: { doMidi, tempo, doName: knotDef.do, accidentalMode },
    warnings,
  };
}

