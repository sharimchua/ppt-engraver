/**
 * Zod schema for the Tapestry IR (v1 subset).
 * 
 * Validates .ppt.yaml input against the PPT structural vocabulary.
 * V1 scope: pitch/harmony only, rhythm reduced to onset count,
 * concatenate layout only, no cyclic weaves.
 */
import { z } from 'zod';

/**
 * Solfège pitch token: a solfège syllable optionally followed by
 * axis marker 'x' and/or octave shifts (^ for up, _ for down).
 * 
 * Examples: "Do", "Mi", "Do^", "So_", "Dox", "Fax^"
 */
const SolfegePitchToken = z.string().regex(
  /^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x)?(\^+|_+)?$/,
  'Must be a valid solfège pitch token (e.g. "Do", "Mi", "Do^", "Dox")'
);

/**
 * Solfège syllable for harmony roots (no axis marker or octave shifts).
 */
const SolfegeHarmonyRoot = z.string().regex(
  /^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)$/,
  'Must be a valid solfège syllable for a chord root (e.g. "Do", "So")'
);

/**
 * Rhythm block-length label: a named pair of solfège syllables.
 * V1 supported values: DoSo, DoRe, DoLa, DoMi, DoSi, DoFi
 */
const RhythmLabel = z.enum(['DoSo', 'DoRe', 'DoLa', 'DoMi', 'DoSi', 'DoFi']);

/**
 * Knot: absolute pitch/tempo anchor.
 * Provides the concrete value for Do and an optional tempo.
 */
export const KnotSchema = z.object({
  /** Absolute pitch anchor for Do, e.g. "C4", "F#3" */
  do: z.string().regex(
    /^[A-G]#?\d+$/,
    'Must be a pitch name like "C4" or "F#3"'
  ),
  /** Tempo in BPM — accepted but unused in v1 */
  tempo: z.number().positive().optional(),
});

/**
 * Coil: the atomic composable unit with up to three layers.
 * V1: melody required, harmony and rhythm optional.
 */
export const CoilSchema = z.object({
  /** Unique identifier for this coil (camelCase) */
  id: z.string().min(1),
  /** Rhythm block-length label — determines expected onset count */
  rhythm: RhythmLabel.optional(),
  /** Melody layer: array of solfège pitch tokens */
  melody: z.array(SolfegePitchToken).min(1),
  /** Harmony layer: array of chord root solfège syllables */
  harmony: z.array(SolfegeHarmonyRoot).optional(),
});

/**
 * A child entry within a Weave — wraps a Coil.
 * Future: may also wrap nested Weaves.
 */
export const WeaveChildSchema = z.object({
  coil: CoilSchema,
});

/**
 * Weave: ordered sequence container for Coils.
 * V1: concatenate layout only.
 */
export const WeaveSchema = z.object({
  /** Unique identifier for this weave (camelCase) */
  id: z.string().min(1),
  /** Layout mode — v1 supports only 'concatenate' */
  layout: z.enum(['concatenate']).default('concatenate'),
  /** Ordered list of child coils */
  children: z.array(WeaveChildSchema).min(1),
});

/**
 * Top-level Tapestry IR schema.
 */
export const TapestrySchema = z.object({
  tapestry: z.object({
    /** Optional absolute anchor (defaults to C4/120 if absent) */
    knot: KnotSchema.optional(),
    /** The top-level weave containing all coils */
    weave: WeaveSchema,
  }),
});

/** TypeScript types inferred from schemas */
export type Knot = z.infer<typeof KnotSchema>;
export type Coil = z.infer<typeof CoilSchema>;
export type WeaveChild = z.infer<typeof WeaveChildSchema>;
export type Weave = z.infer<typeof WeaveSchema>;
export type Tapestry = z.infer<typeof TapestrySchema>;
