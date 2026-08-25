/**
 * Sidecar expectation map generator.
 * 
 * Serializes the resolver expectation table into `piece.ppt-map.json`
 * alongside `piece.notation.ly` for consumption by the Phase 3 consistency checker.
 */
import { writeFileSync } from 'node:fs';
import type { OnsetStream } from '../schema/onset.js';

export interface SidecarMelodyExpectation {
  /** Expected solfège scale degree (e.g. "Do", "Mi", "So") */
  scaleDegree: string;
  /** Expected absolute pitch name (e.g. "C4", "E4") */
  pitch: string;
  /** Expected MIDI note number */
  midiNote: number;
}

export interface SidecarHarmonyExpectation {
  /** Expected chord root solfège syllable (e.g. "Do", "So") */
  root: string;
  /** Expected chord quality (v1: "major") */
  quality: 'major' | 'minor' | 'dominant7' | string;
  /** Expected chord tones as pitch names (e.g. ["C4", "E4", "G4"]) */
  chordTones: string[];
  /** Expected chord tones as MIDI note numbers */
  chordMidi: number[];
}

export interface SidecarEntry {
  /** LilyPond tag (e.g. "ppt_verse_introMotif_1") */
  tag: string;
  /** Source Weave ID */
  weaveId: string;
  /** Source Coil ID */
  coilId: string;
  /** 1-based index within the coil */
  onsetIndex: number;
  /** Optional 1-based voice index for polyphonic coils */
  voiceIndex?: number;
  /** Underlying source coil ID (for concatenated sub-coils) */
  sourceCoilId?: string;
  /** 1-based index within the underlying sub-coil */
  sourceOnsetIndex?: number;
  /** 1-based melody array position (excludes Dox beat-skip tokens) — for click navigation to melody source */
  melodyOnsetIndex?: number;
  /** Coil where melody layer was defined (local or inherited parent) */
  melodySourceCoil?: string;
  /** Coil where rhythm layer was defined (local or inherited parent) */
  rhythmSourceCoil?: string;
  /** Coil where harmony layer was defined (local or inherited parent) */
  harmonySourceCoil?: string;
  /** Expected melodic values */
  melody: SidecarMelodyExpectation;
  /** Expected harmonic values */
  harmony: SidecarHarmonyExpectation;
}

/**
 * Sidecar map keyed by tag name.
 */
export type SidecarMap = Record<string, SidecarEntry>;

/**
 * Generates the expectation map from a resolved onset stream.
 * 
 * @param onsets - Resolved onset stream from the resolution engine
 * @returns Sidecar expectation map keyed by tag
 */
export function generateSidecarMap(onsets: OnsetStream): SidecarMap {
  const map: SidecarMap = {};

  for (const onset of onsets) {
    const entry: SidecarEntry = {
      tag: onset.tag,
      weaveId: onset.weaveId,
      coilId: onset.coilId,
      onsetIndex: onset.onsetIndex,
      voiceIndex: onset.voiceIndex,
      sourceCoilId: onset.sourceCoilId,
      sourceOnsetIndex: onset.sourceOnsetIndex,
      melodyOnsetIndex: onset.melodyOnsetIndex,
      melodySourceCoil: onset.melodySourceCoil,
      rhythmSourceCoil: onset.rhythmSourceCoil,
      harmonySourceCoil: onset.harmonySourceCoil,
      melody: {
        scaleDegree: onset.scaleDegree,
        pitch: onset.pitch,
        midiNote: onset.midiNote,
      },
      harmony: {
        root: onset.chordRoot,
        quality: 'major', // v1 scope
        chordTones: onset.chordTones,
        chordMidi: onset.chordMidi,
      },
    };

    // Primary tag
    map[onset.tag] = entry;

    // Layer-specific tags: ppt_weave_coil_layer_index
    const prefix = `ppt_${onset.weaveId}_${onset.coilId}`;
    const idx = onset.onsetIndex;
    const vIdx = onset.voiceIndex ?? 1;

    map[`${prefix}_melody_${idx}`] = entry;
    map[`${prefix}_melody_v${vIdx}_${idx}`] = entry;
    map[`${prefix}_melodyAbs_${idx}`] = entry;
    map[`${prefix}_melodyAbs_v${vIdx}_${idx}`] = entry;
    map[`${prefix}_melodyInt_${idx}`] = entry;
    map[`${prefix}_melodyInt_v${vIdx}_${idx}`] = entry;
    map[`${prefix}_rhythm_${idx}`] = entry;
    map[`${prefix}_harmony_${idx}`] = entry;
    map[`${prefix}_harmCoil_${idx}`] = entry;
    map[`${prefix}_harmonyStaff_${idx}`] = entry;
    map[`${prefix}_chordName_${idx}`] = entry;
    map[`${prefix}_tab_${idx}`] = entry;
    map[`${prefix}_tab_v${vIdx}_${idx}`] = entry;
  }

  return map;
}

/**
 * Writes the sidecar expectation map JSON to disk.
 * 
 * @param onsets - Resolved onset stream
 * @param filePath - Output path (usually `piece.ppt-map.json`)
 */
export function writeSidecarMapFile(onsets: OnsetStream, filePath: string): void {
  const map = generateSidecarMap(onsets);
  writeFileSync(filePath, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}
