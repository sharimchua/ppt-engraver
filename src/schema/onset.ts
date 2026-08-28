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
  /** Solfège syllable of the melody note */
  scaleDegree: z.string(),
  /** Whether this onset is a rest in the melody layer */
  isRest: z.boolean().optional(),
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
  /** Optional 1-based voice index for polyphonic coils (1 for top voice / single melody, 2 for second voice, etc.) */
  voiceIndex: z.number().int().positive().optional(),
  /** Optional rhythm token string if rhythmic grammar is used */
  rhythmToken: z.string().optional(),
  /** Start timestamp in beats (quarter note = 1.0) within the coil */
  startBeat: z.number().nonnegative().optional(),
  /** Duration in beats (quarter note = 1.0) */
  durationBeats: z.number().positive().optional(),
  /** LilyPond duration string, e.g. "4", "8", "16", "4*1/3" */
  duration: z.string().optional(),
  /** Provenance: underlying coil ID for concats / sub-coils */
  sourceCoilId: z.string().optional(),
  /** Provenance: 1-based onset index within the underlying sub-coil */
  sourceOnsetIndex: z.number().int().positive().optional(),
  /** Provenance: 1-based melody array position (excludes Dox beat-skip tokens) — used for click navigation to melody source */
  melodyOnsetIndex: z.number().int().positive().optional(),
  /** Provenance: coil where melody was defined (local or inherited parent) */
  melodySourceCoil: z.string().optional(),
  /** Provenance: coil where rhythm was defined (local or inherited parent) */
  rhythmSourceCoil: z.string().optional(),
  /** Provenance: coil where harmony was defined (local or inherited parent) */
  harmonySourceCoil: z.string().optional(),
  /** Optional augmented harmonic accompaniment notes generated for this melody onset */
  melodyAugmentationNotes: z.array(
    z.object({
      midiNote: z.number().int(),
      scaleDegree: z.string(),
      isInferred: z.boolean().optional(),
    })
  ).optional(),
  /** Optional projected chord MIDI notes according to the active harmonyVoicing */
  projectedChordMidi: z.array(z.number().int()).optional(),
  /** Metric pulse grammar specification active for this onset */
  pulse: z.union([z.string(), z.array(z.string())]).optional(),
  /** Alias for pulse */
  meter: z.union([z.string(), z.array(z.string())]).optional(),
  /** Scale definition active for this onset (e.g. "Do", "La", "DoMe", "LaTi") */
  scale: z.union([z.string(), z.array(z.string())]).optional(),
});

/**
 * The complete onset stream — ordered array of onsets.
 */
export const OnsetStreamSchema = z.array(OnsetSchema);

/** TypeScript types inferred from schemas */
export type Onset = z.infer<typeof OnsetSchema>;
export type OnsetStream = z.infer<typeof OnsetStreamSchema>;
