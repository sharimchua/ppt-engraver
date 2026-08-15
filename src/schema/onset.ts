/**
 * Schema and types for the resolved onset stream — the output of the
 * resolution engine (Phase 1 deliverable).
 * 
 * Each onset represents a single musical event at one point in time,
 * with both melody (single pitch) and harmony (chord tones) resolved
 * to absolute pitches.
 */
import { z } from 'zod';

/**
 * A single resolved onset in the output stream.
 */
export const OnsetSchema = z.object({
  /** LilyPond tag: ppt_<weaveId>_<coilId>_<onsetIndex> */
  tag: z.string(),
  /** Absolute melody pitch name, e.g. "C4", "E4" */
  pitch: z.string(),
  /** MIDI note number for the melody pitch */
  midiNote: z.number().int(),
  /** Original solfège scale degree, e.g. "Do", "Mi" */
  scaleDegree: z.string(),
  /** Absolute pitch names for all chord tones, e.g. ["C4", "E4", "G4"] */
  chordTones: z.array(z.string()),
  /** MIDI note numbers for all chord tones */
  chordMidi: z.array(z.number().int()),
  /** Solfège syllable of the chord root */
  chordRoot: z.string(),
  /** Source coil ID */
  coilId: z.string(),
  /** Source weave ID */
  weaveId: z.string(),
  /** 1-based onset index within the coil */
  onsetIndex: z.number().int().positive(),
});

/**
 * The complete onset stream — ordered array of onsets.
 */
export const OnsetStreamSchema = z.array(OnsetSchema);

/** TypeScript types inferred from schemas */
export type Onset = z.infer<typeof OnsetSchema>;
export type OnsetStream = z.infer<typeof OnsetStreamSchema>;
