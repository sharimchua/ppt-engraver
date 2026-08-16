/**
 * Weave resolver: traverses a Weave's children (coils and nested weaves)
 * and concatenates resolved onset streams.
 * 
 * Supports:
 * - Nested inline weaves (e.g. { weave: { id: "verse", children: [...] } })
 * - Referenced weaves by ID (e.g. { weave: "verse" })
 * - Dynamic weave registration on discovery
 * - Cycle detection and graph validation
 * - Inherited defaultCoil down weave hierarchy
 */
import type { Weave, Coil, WeaveChild } from '../schema/tapestry.js';
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
 * Recursively walks children in order, resolves each coil and child weave,
 * assigns provenance tags, detects cycles, and concatenates the results.
 * 
 * @param weave - The Weave definition from the Tapestry IR
 * @param knot - The resolved Knot providing the Do anchor
 * @param coilLibrary - Map of named Coil definitions available for inheritance / references
 * @param weaveLibrary - Map of named Weave definitions discovered or registered
 * @param activeWeaveStack - Stack of weave IDs currently being visited (for cycle detection)
 * @param inheritedDefaultCoil - Optional default Coil inherited from an enclosing parent Weave
 * @returns Flat onset stream with full provenance tags + warnings
 */
export function resolveWeave(
  weave: Weave,
  knot: ResolvedKnot,
  coilLibrary: Map<string, Coil> = new Map(),
  weaveLibrary: Map<string, Weave> = new Map(),
  activeWeaveStack: string[] = [],
  inheritedDefaultCoil?: Coil,
): WeaveResolutionResult {
  // 1. Cycle detection in weave hierarchy
  if (activeWeaveStack.includes(weave.id)) {
    throw new Error(
      `Circular weave reference detected: ${[...activeWeaveStack, weave.id].join(' -> ')}`
    );
  }

  // 2. Register this weave in library for future reference by ID
  weaveLibrary.set(weave.id, weave);

  const currentStack = [...activeWeaveStack, weave.id];
  const allOnsets: Onset[] = [];
  const allWarnings: string[] = [];

  // 3. Resolve default coil for this weave (local or inherited)
  let effectiveDefaultCoil: Coil | undefined = inheritedDefaultCoil;
  if (weave.defaultCoil) {
    if (typeof weave.defaultCoil === 'string') {
      const found = coilLibrary.get(weave.defaultCoil);
      if (!found) {
        throw new Error(
          `Weave "${weave.id}" defaultCoil references unknown coil "${weave.defaultCoil}"`
        );
      }
      effectiveDefaultCoil = found;
    } else {
      effectiveDefaultCoil = weave.defaultCoil;
    }
  }

  // 4. Process children in order
  for (const child of weave.children) {
    if ('weave' in child && child.weave !== undefined) {
      // --- Child is a nested Weave ---
      let childWeave: Weave;
      if (typeof child.weave === 'string') {
        const found = weaveLibrary.get(child.weave);
        if (!found) {
          throw new Error(
            `Weave "${weave.id}" child references unknown weave "${child.weave}"`
          );
        }
        childWeave = found;
      } else {
        childWeave = child.weave;
        // Register inline child weave in library
        weaveLibrary.set(childWeave.id, childWeave);
      }

      const childResult = resolveWeave(
        childWeave,
        knot,
        coilLibrary,
        weaveLibrary,
        currentStack,
        effectiveDefaultCoil,
      );

      allOnsets.push(...childResult.onsets);
      allWarnings.push(...childResult.warnings);
    } else if ('coil' in child && child.coil !== undefined) {
      // --- Child is a Coil ---
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
        // Register inline coil if not already in library
        if (!coilLibrary.has(coil.id)) {
          coilLibrary.set(coil.id, coil);
        }
      }

      const { onsets, warnings } = resolveCoil(
        coil,
        knot,
        coilLibrary,
        effectiveDefaultCoil,
      );
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
    } else {
      throw new Error(
        `Invalid child in Weave "${weave.id}": child must specify either "coil" or "weave"`
      );
    }
  }

  return { onsets: allOnsets, warnings: allWarnings };
}


