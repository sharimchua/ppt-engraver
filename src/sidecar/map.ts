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
    map[onset.tag] = {
      tag: onset.tag,
      weaveId: onset.weaveId,
      coilId: onset.coilId,
      onsetIndex: onset.onsetIndex,
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
