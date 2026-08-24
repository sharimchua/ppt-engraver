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
import type { Weave, Coil, WeaveStitch } from '../schema/tapestry.js';
import type { ResolvedKnot } from '../solfege/pitch.js';
import type { Onset } from '../schema/onset.js';
import { midiToPitchName } from '../solfege/pitch.js';
import { resolveCoil, isMelodyDefined, isHarmonyDefined, isRhythmDefined } from './coil.js';

export interface WeaveResolutionResult {
  onsets: Onset[];
  warnings: string[];
}

/**
 * Resolves a Weave into an onset stream.
 * 
 * Traverses stitches in order, resolves each coil and nested weave,
 * assigns provenance tags, detects cycles, and formats onsets according
 * to the weave layout ('concatenate' for sequential, 'parallel' for concurrent layering / polyphony).
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

  const stitches = weave.stitch ?? weave.stitches ?? weave.children ?? [];
  const layout = weave.layout ?? 'concatenate';
  let anonymousCoilCounter = 0;

  interface ResolvedStitchItem {
    type: 'coil' | 'weave';
    id: string;
    coil?: Coil;
    weave?: Weave;
    onsets: Onset[];
    hasExplicitMelody: boolean;
    hasExplicitHarmony: boolean;
    hasExplicitRhythm: boolean;
  }

  const resolvedStitches: ResolvedStitchItem[] = [];

  // 4. Resolve each stitch item
  for (const stitch of stitches) {
    if ('weave' in stitch && stitch.weave !== undefined) {
      // --- Stitch is a nested Weave ---
      let childWeave: Weave;
      if (typeof stitch.weave === 'string') {
        const found = weaveLibrary.get(stitch.weave);
        if (!found) {
          throw new Error(
            `Weave "${effectiveWeaveId}" stitch references unknown weave "${stitch.weave}"`
          );
        }
        childWeave = found;
      } else {
        const childWeaveId = stitch.weave.id ?? `${effectiveWeaveId}_nested`;
        childWeave = { ...stitch.weave, id: childWeaveId };
        weaveLibrary.set(childWeaveId, childWeave);
      }

      const effectiveWeavePulse = weave.pulse ?? weave.meter ?? knot.pulse ?? knot.meter;
      if (childWeave.pulse === undefined && childWeave.meter === undefined && effectiveWeavePulse !== undefined) {
        childWeave.pulse = effectiveWeavePulse;
        childWeave.meter = effectiveWeavePulse;
      }

      const childResult = resolveWeave(
        childWeave,
        knot,
        coilLibrary,
        weaveLibrary,
        currentStack,
        effectiveDefaultCoil,
      );
      allWarnings.push(...childResult.warnings);

      resolvedStitches.push({
        type: 'weave',
        id: childWeave.id ?? 'nested_weave',
        weave: childWeave,
        onsets: childResult.onsets,
        hasExplicitMelody: childResult.onsets.some(o => o.scaleDegree !== 'Do' || !o.isRest),
        hasExplicitHarmony: childResult.onsets.some(o => o.chordRoot !== 'Do'),
        hasExplicitRhythm: true,
      });
    } else if ('coil' in stitch && stitch.coil !== undefined) {
      // --- Stitch is a Coil ---
      let coil: Coil;
      if (typeof stitch.coil === 'string') {
        const found = coilLibrary.get(stitch.coil);
        if (!found) {
          throw new Error(
            `Weave "${effectiveWeaveId}" stitch references unknown coil "${stitch.coil}"`
          );
        }
        coil = found;
      } else {
        anonymousCoilCounter++;
        const coilId = stitch.coil.id ?? `${effectiveWeaveId}_coil_${anonymousCoilCounter}`;
        coil = { ...stitch.coil, id: coilId };
        if (!coilLibrary.has(coilId)) {
          coilLibrary.set(coilId, coil);
        }
      }

      const effectiveCoilPulse = coil.pulse ?? coil.meter ?? weave.pulse ?? weave.meter ?? knot.pulse ?? knot.meter;
      if (coil.pulse === undefined && coil.meter === undefined && effectiveCoilPulse !== undefined) {
        coil.pulse = effectiveCoilPulse;
        coil.meter = effectiveCoilPulse;
      }
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

      const coilId = coil.id ?? `coil_${anonymousCoilCounter}`;
      const isMultiVoiceCoil = onsets.some(o => (o.voiceIndex ?? 1) > 1);
      const voiceOnsetCounters = new Map<number, number>();

      const mappedOnsets: Onset[] = [];
      for (let i = 0; i < onsets.length; i++) {
        const onset = onsets[i];
        const voiceIndex = onset.voiceIndex ?? 1;
        const currentVoiceCount = (voiceOnsetCounters.get(voiceIndex) ?? 0) + 1;
        voiceOnsetCounters.set(voiceIndex, currentVoiceCount);
        const onsetIndex = currentVoiceCount;

        const tag = isMultiVoiceCoil
          ? `ppt_${effectiveWeaveId}_${coilId}_v${voiceIndex}_${onsetIndex}`
          : `ppt_${effectiveWeaveId}_${coilId}_${onsetIndex}`;

        mappedOnsets.push({
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
          melodyOnsetIndex: onset.melodyOnsetIndex,
          melodySourceCoil: onset.melodySourceCoil || coilId,
          rhythmSourceCoil: onset.rhythmSourceCoil || coilId,
          harmonySourceCoil: onset.harmonySourceCoil || coilId,
          melodyAugmentationNotes: onset.melodyAugmentationNotes ? [...onset.melodyAugmentationNotes] : undefined,
          pulse: effectiveCoilPulse,
          meter: effectiveCoilPulse,
        });
      }

      const hasExplicitMelody =
        isMelodyDefined(coil.melody) ||
        Boolean(coil.concat?.length) ||
        Boolean((coil as any).stitch?.length) ||
        Boolean((coil as any).stitches?.length);
      const hasExplicitHarmony =
        isHarmonyDefined(coil.harmony);
      const hasExplicitRhythm =
        isRhythmDefined(coil.rhythm) ||
        Boolean(coil.concat?.length) ||
        Boolean((coil as any).stitch?.length) ||
        Boolean((coil as any).stitches?.length);

      resolvedStitches.push({
        type: 'coil',
        id: coilId,
        coil,
        onsets: mappedOnsets,
        hasExplicitMelody,
        hasExplicitHarmony,
        hasExplicitRhythm,
      });
    } else {
      throw new Error(`Invalid Weave stitch in weave "${effectiveWeaveId}"`);
    }
  }

  const allOnsets: Onset[] = [];

  function roundBeat(b: number): number {
    return Math.round(b * 9600) / 9600;
  }

  if (layout === 'concatenate') {
    let currentTimelineBeat = 0;
    for (const item of resolvedStitches) {
      let itemDuration = 0;
      for (const o of item.onsets) {
        const rawStart = roundBeat(o.startBeat ?? (o.onsetIndex - 1));
        const dur = o.durationBeats !== undefined ? roundBeat(o.durationBeats) : 1.0;
        const end = roundBeat(rawStart + dur);
        if (end > itemDuration) {
          itemDuration = end;
        }
        o.startBeat = roundBeat(rawStart + currentTimelineBeat);
        allOnsets.push(o);
      }
      currentTimelineBeat = roundBeat(currentTimelineBeat + itemDuration);
    }
  } else if (layout === 'parallel') {
    // Parallel Layout:
    // Case 1: Separate Harmony Coil(s) + Melody/Rhythm Coil(s)
    // If some stitches provide harmony without explicit melody, and others provide melody,
    // merge the chord progression into the melody onsets at matching timestamps.
    const melodyStitches = resolvedStitches.filter(s => s.hasExplicitMelody);
    const harmonyStitches = resolvedStitches.filter(s => s.hasExplicitHarmony && !s.hasExplicitMelody);

    if (harmonyStitches.length > 0 && melodyStitches.length > 0) {
      // Calculate max duration across all stitches
      let maxParallelDuration = 0;
      for (const s of resolvedStitches) {
        for (const o of s.onsets) {
          const endBeat = roundBeat((o.startBeat ?? 0) + (o.durationBeats ?? 1.0));
          if (endBeat > maxParallelDuration) {
            maxParallelDuration = endBeat;
          }
        }
      }

      // Build chronological chord timeline from harmonyStitches
      const chordTimeline: Array<{ startBeat: number; endBeat: number; chordRoot: string; chordTones: string[]; chordMidi: number[]; projectedChordMidi: number[]; sourceCoil: string }> = [];
      for (const hs of harmonyStitches) {
        for (const o of hs.onsets) {
          const start = o.startBeat ?? 0;
          const dur = o.durationBeats ?? 1.0;
          chordTimeline.push({
            startBeat: start,
            endBeat: start + dur,
            chordRoot: o.chordRoot,
            chordTones: o.chordTones,
            chordMidi: o.chordMidi,
            projectedChordMidi: o.projectedChordMidi ?? [...o.chordMidi],
            sourceCoil: o.coilId,
          });
        }
      }
      chordTimeline.sort((a, b) => a.startBeat - b.startBeat);

      const getActiveChord = (beat: number) => {
        let active = chordTimeline[0];
        for (const ev of chordTimeline) {
          if (ev.startBeat <= beat + 1e-4) {
            active = ev;
          } else {
            break;
          }
        }
        return active;
      };

      // Assign voiceIndex if multiple melody stitches are parallel
      let nextVoiceIndex = 1;
      for (let sIdx = 0; sIdx < melodyStitches.length; sIdx++) {
        const ms = melodyStitches[sIdx];
        const assignedVoice = melodyStitches.length > 1 ? nextVoiceIndex++ : undefined;

        let maxMelodyBeat = 0;
        let lastOnsetIndex = 0;

        for (const o of ms.onsets) {
          const beat = o.startBeat ?? 0;
          const endBeat = beat + (o.durationBeats ?? 1.0);
          if (endBeat > maxMelodyBeat) maxMelodyBeat = endBeat;
          if (o.onsetIndex > lastOnsetIndex) lastOnsetIndex = o.onsetIndex;

          const activeChord = getActiveChord(beat);
          if (activeChord) {
            o.chordRoot = activeChord.chordRoot;
            o.chordTones = [...activeChord.chordTones];
            o.chordMidi = [...activeChord.chordMidi];
            o.projectedChordMidi = [...activeChord.projectedChordMidi];
            o.harmonySourceCoil = activeChord.sourceCoil;
          }
          if (assignedVoice !== undefined) {
            o.voiceIndex = assignedVoice;
            o.tag = `ppt_${effectiveWeaveId}_${ms.id}_v${assignedVoice}_${o.onsetIndex}`;
            // Unify coilId so LilyPond groups parallel voices in the same CoilGroup for simultaneous polyphony
            o.coilId = effectiveWeaveId;
          }
          allOnsets.push(o);
        }

        // If melody is shorter than the full parallel timeline (e.g. chord changes span more beats),
        // pad with rest onsets up to maxParallelDuration so the full harmony progression and grid are rendered.
        if (maxMelodyBeat < maxParallelDuration - 1e-4) {
          for (let beat = maxMelodyBeat; beat < maxParallelDuration - 1e-4; beat += 1.0) {
            lastOnsetIndex++;
            const activeChord = getActiveChord(beat);
            const voiceIndex = assignedVoice ?? 1;
            const tag = assignedVoice !== undefined
              ? `ppt_${effectiveWeaveId}_${ms.id}_v${assignedVoice}_${lastOnsetIndex}`
              : `ppt_${effectiveWeaveId}_${ms.id}_${lastOnsetIndex}`;

            allOnsets.push({
              tag,
              pitch: 'r',
              midiNote: knot.doMidi ?? 60,
              scaleDegree: 'Do',
              isRest: true,
              chordTones: activeChord ? [...activeChord.chordTones] : ['C4', 'E4', 'G4'],
              chordMidi: activeChord ? [...activeChord.chordMidi] : [60, 64, 67],
              projectedChordMidi: activeChord ? [...activeChord.projectedChordMidi] : [60, 64, 67],
              chordRoot: activeChord ? activeChord.chordRoot : 'Do',
              coilId: effectiveWeaveId,
              weaveId: effectiveWeaveId,
              onsetIndex: lastOnsetIndex,
              voiceIndex,
              rhythmToken: 'Do',
              startBeat: beat,
              durationBeats: 1.0,
              duration: '4',
              sourceCoilId: ms.id,
              sourceOnsetIndex: lastOnsetIndex,
              melodySourceCoil: ms.id,
              rhythmSourceCoil: ms.id,
              harmonySourceCoil: activeChord ? activeChord.sourceCoil : ms.id,
              pulse: ms.coil?.pulse ?? weave.pulse ?? knot.pulse,
              meter: ms.coil?.meter ?? weave.meter ?? knot.meter,
            });
          }
        }
      }
    } else if (melodyStitches.length > 1) {
      // Multiple parallel melody streams (polyphonic voices)
      let nextVoiceIndex = 1;
      for (const ms of melodyStitches) {
        const assignedVoice = nextVoiceIndex++;
        for (const o of ms.onsets) {
          o.voiceIndex = assignedVoice;
          o.tag = `ppt_${effectiveWeaveId}_${ms.id}_v${assignedVoice}_${o.onsetIndex}`;
          o.coilId = effectiveWeaveId;
          allOnsets.push(o);
        }
      }
    } else {
      // General parallel merge of all stitches
      for (const s of resolvedStitches) {
        allOnsets.push(...s.onsets);
      }
    }
  }

  return { onsets: allOnsets, warnings: allWarnings };
}

