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
  const effectiveWeaveId = weave.id ?? 'weave';

  // 1. Cycle detection in weave hierarchy
  if (activeWeaveStack.includes(effectiveWeaveId)) {
    throw new Error(
      `Circular weave reference detected: ${[...activeWeaveStack, effectiveWeaveId].join(' -> ')}`
    );
  }

  // 2. Register this weave in library for future reference by ID
  weaveLibrary.set(effectiveWeaveId, { ...weave, id: effectiveWeaveId });

  // 2b. Register any in-place coils defined on this weave into the global coilLibrary
  if (weave.coils) {
    if (Array.isArray(weave.coils)) {
      for (const c of weave.coils) {
        const unwrapped = (typeof c === 'object' && c !== null && 'coil' in c && (c as { coil?: Coil }).coil) ? (c as { coil: Coil }).coil : (c as Coil);
        if (unwrapped && unwrapped.id) {
          coilLibrary.set(unwrapped.id, unwrapped);
        }
      }
    } else {
      for (const [id, c] of Object.entries(weave.coils)) {
        const unwrapped = (typeof c === 'object' && c !== null && 'coil' in c && (c as { coil?: Coil }).coil) ? (c as { coil: Coil }).coil : (c as Coil);
        coilLibrary.set(id, { ...unwrapped, id: unwrapped?.id ?? id });
      }
    }
  }

  const currentStack = [...activeWeaveStack, effectiveWeaveId];
  const allOnsets: Onset[] = [];
  const allWarnings: string[] = [];

  // 3. Resolve default coil for this weave (local or inherited)
  let effectiveDefaultCoil: Coil | undefined = inheritedDefaultCoil;
  if (weave.defaultCoil) {
    if (typeof weave.defaultCoil === 'string') {
      const found = coilLibrary.get(weave.defaultCoil);
      if (!found) {
        throw new Error(
          `Weave "${effectiveWeaveId}" defaultCoil references unknown coil "${weave.defaultCoil}"`
        );
      }
      effectiveDefaultCoil = found;
    } else {
      effectiveDefaultCoil = weave.defaultCoil;
    }
  }

  let anonymousCoilCounter = 0;

  // 4. Process children in order
  for (const child of weave.children) {
    if ('weave' in child && child.weave !== undefined) {
      // --- Child is a nested Weave ---
      let childWeave: Weave;
      if (typeof child.weave === 'string') {
        const found = weaveLibrary.get(child.weave);
        if (!found) {
          throw new Error(
            `Weave "${effectiveWeaveId}" child references unknown weave "${child.weave}"`
          );
        }
        childWeave = found;
      } else {
        const childWeaveId = child.weave.id ?? `${effectiveWeaveId}_nested`;
        childWeave = { ...child.weave, id: childWeaveId };
        // Register inline child weave in library
        weaveLibrary.set(childWeaveId, childWeave);
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
            `Weave "${effectiveWeaveId}" child references unknown coil "${child.coil}"`
          );
        }
        coil = found;
      } else {
        anonymousCoilCounter++;
        const coilId = child.coil.id ?? `${effectiveWeaveId}_coil_${anonymousCoilCounter}`;
        coil = { ...child.coil, id: coilId };
        // Register inline coil if not already in library
        if (!coilLibrary.has(coilId)) {
          coilLibrary.set(coilId, coil);
        }
      }

        // Cascade weave-level projection overrides to child coil if not set on coil
        if (coil.harmonyVoicing === undefined && weave.harmonyVoicing !== undefined) {
          coil.harmonyVoicing = weave.harmonyVoicing;
        }
        if (coil.melodyAugmentation === undefined && weave.melodyAugmentation !== undefined) {
          coil.melodyAugmentation = weave.melodyAugmentation;
        }
        if (coil.melodyAugmentationDisplay === undefined && weave.melodyAugmentationDisplay !== undefined) {
          coil.melodyAugmentationDisplay = weave.melodyAugmentationDisplay;
        }
        if (coil.projection === undefined && weave.projection !== undefined) {
          coil.projection = weave.projection;
        }

        const { onsets, warnings } = resolveCoil(
          coil,
          knot,
          coilLibrary,
          effectiveDefaultCoil,
        );
        allWarnings.push(...warnings);

        // Map resolved onsets to tagged Onset objects
        const coilId = coil.id ?? `coil_${anonymousCoilCounter}`;
        const isMultiVoiceCoil = onsets.some(o => (o.voiceIndex ?? 1) > 1);
        const voiceOnsetCounters = new Map<number, number>();

        for (let i = 0; i < onsets.length; i++) {
          const onset = onsets[i];
          const voiceIndex = onset.voiceIndex ?? 1;
          const currentVoiceCount = (voiceOnsetCounters.get(voiceIndex) ?? 0) + 1;
          voiceOnsetCounters.set(voiceIndex, currentVoiceCount);
          const onsetIndex = currentVoiceCount;

          const tag = isMultiVoiceCoil
            ? `ppt_${effectiveWeaveId}_${coilId}_v${voiceIndex}_${onsetIndex}`
            : `ppt_${effectiveWeaveId}_${coilId}_${onsetIndex}`;

          allOnsets.push({
            tag,
            pitch: onset.isRest ? 'r' : midiToPitchName(onset.melodyMidi, knot.accidentalMode),
            midiNote: onset.melodyMidi,
            scaleDegree: onset.scaleDegree,
            isRest: onset.isRest,
            chordTones: onset.chordMidi.map(m => midiToPitchName(m, knot.accidentalMode)),
            chordMidi: [...onset.chordMidi],
            projectedChordMidi: [...onset.chordMidi],
            chordRoot: onset.chordRoot,
            coilId: coilId,
            weaveId: effectiveWeaveId,
            onsetIndex,
            voiceIndex,
            rhythmToken: onset.rhythmToken,
            startBeat: onset.startBeat,
            durationBeats: onset.durationBeats,
            duration: onset.duration,
            sourceCoilId: onset.sourceCoilId || coilId,
            sourceOnsetIndex: onset.sourceOnsetIndex || onsetIndex,
            melodySourceCoil: onset.melodySourceCoil || coilId,
            rhythmSourceCoil: onset.rhythmSourceCoil || coilId,
            harmonySourceCoil: onset.harmonySourceCoil || coilId,
            melodyAugmentationNotes: onset.melodyAugmentationNotes ? [...onset.melodyAugmentationNotes] : undefined,
          });
        }
      } else {
        throw new Error(`Invalid Weave child in weave "${effectiveWeaveId}"`);
      }
    }

    return { onsets: allOnsets, warnings: allWarnings };
  }

