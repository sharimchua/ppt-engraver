/**
 * Graph traversal for the Tapestry.
 * 
 * V1: linear traversal only (no cyclic weaves, no DAG).
 * Walks the Tapestry from the top-level weave, resolves Knot first,
 * then each child coil in sequence via the Weave resolver.
 * 
 * The structure is set up to support DAG traversal in later phases.
 */
import type { Tapestry, Coil } from '../schema/tapestry.js';
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
 * 1. Build reusable Coil library (if tapestry.coils is defined)
 * 2. Resolve Knot (absolute anchor)
 * 3. Resolve Weave (walks children, applies priority-fill inheritance & default coil, resolves each coil)
 * 4. Return flat onset stream with provenance tags
 * 
 * @param tapestry - The validated Tapestry IR
 * @returns Complete onset stream + accumulated warnings
 */
export function resolveTapestry(tapestry: Tapestry): ResolutionResult {
  const allWarnings: string[] = [];
  
  // 1. Build Coil library
  const coilLibrary = new Map<string, Coil>();
  const rawCoils = tapestry.tapestry.coils;
  if (rawCoils) {
    if (Array.isArray(rawCoils)) {
      for (const c of rawCoils) {
        coilLibrary.set(c.id, c);
      }
    } else {
      for (const [id, c] of Object.entries(rawCoils)) {
        coilLibrary.set(id, { ...c, id });
      }
    }
  }

  // 2. Resolve Knot
  const { knot, warnings: knotWarnings } = resolveKnot(tapestry);
  allWarnings.push(...knotWarnings);
  
  // 3. Resolve Weave
  const { onsets, warnings: weaveWarnings } = resolveWeave(
    tapestry.tapestry.weave,
    knot,
    coilLibrary,
  );
  allWarnings.push(...weaveWarnings);
  
  return { onsets, warnings: allWarnings };
}

