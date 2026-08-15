/**
 * Graph traversal for the Tapestry.
 * 
 * V1: linear traversal only (no cyclic weaves, no DAG).
 * Walks the Tapestry from the top-level weave, resolves Knot first,
 * then each child coil in sequence via the Weave resolver.
 * 
 * The structure is set up to support DAG traversal in later phases.
 */
import type { Tapestry } from '../schema/tapestry.js';
import type { OnsetStream } from '../schema/onset.js';
import { resolveKnot } from './knot.js';
import { resolveWeave } from './weave.js';

export interface ResolutionResult {
  /** The resolved onset stream */
  onsets: OnsetStream;
  /** All warnings accumulated during resolution */
  warnings: string[];
}

/**
 * Resolves a complete Tapestry IR into an onset stream.
 * 
 * Pipeline:
 * 1. Resolve Knot (absolute anchor)
 * 2. Resolve Weave (walks children, resolves each coil)
 * 3. Return flat onset stream with provenance tags
 * 
 * @param tapestry - The validated Tapestry IR
 * @returns Complete onset stream + accumulated warnings
 */
export function resolveTapestry(tapestry: Tapestry): ResolutionResult {
  const allWarnings: string[] = [];
  
  // 1. Resolve Knot
  const { knot, warnings: knotWarnings } = resolveKnot(tapestry);
  allWarnings.push(...knotWarnings);
  
  // 2. Resolve Weave
  const { onsets, warnings: weaveWarnings } = resolveWeave(
    tapestry.tapestry.weave,
    knot,
  );
  allWarnings.push(...weaveWarnings);
  
  return { onsets, warnings: allWarnings };
}
