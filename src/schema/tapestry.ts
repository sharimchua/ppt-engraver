/**
 * Zod schema for the Tapestry IR (v1 subset).
 * 
 * Validates .ppt.yaml input against the PPT structural vocabulary.
 * V1 scope: pitch/harmony only, rhythm reduced to onset count,
 * concatenate layout only, no cyclic weaves.
 */
import { z } from 'zod';

/**
 * Solfège pitch token: a single solfège syllable with optional axis/octave,
 * or multiple whitespace-separated syllables in a single melody entry (e.g. "Re Te", "Le La").
 * 
 * Examples: "Do", "Mi", "Do^", "So_", "Dox", "Fax^", "Re Te"
 */
const SolfegePitchToken = z.string().refine(
  val => {
    const tokens = val.trim().split(/\s+/);
    const tokenRegex = /^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x)?(\^+|_+)?$/;
    return tokens.length > 0 && tokens.every(t => tokenRegex.test(t));
  },
  {
    message: 'Must be valid solfège pitch token(s) (e.g. "Do", "Mi", "Do^", "Dox", "Re Te")',
  }
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
  /** Absolute pitch anchor for Do, e.g. "C4", "Eb4", "F#3" */
  do: z.string().regex(
    /^[A-G](#|b|♭)?\d+$/,
    'Must be a pitch name like "C4", "Eb4", or "F#3"'
  ),
  /** Tempo in BPM — accepted but unused in v1 */
  tempo: z.number().positive().optional(),
});


/**
 * Coil: the atomic composable unit with up to three layers.
 * Supports priority-based inheritance from parent coils.
 */
export const CoilSchema = z.object({
  /** Unique identifier for this coil (camelCase) */
  id: z.string().min(1),
  /** Ordered list of parent Coil IDs to inherit layers from */
  parents: z.array(z.string()).optional(),
  /** Rhythm block-length label — determines expected onset count */
  rhythm: RhythmLabel.optional(),
  /** Melody layer: array of solfège pitch tokens (optional if inherited, min 1 if specified) */
  melody: z.array(SolfegePitchToken).min(1).optional(),
  /** Harmony layer: array of chord root solfège syllables */
  harmony: z.array(SolfegeHarmonyRoot).min(1).optional(),

});

/**
 * A child entry within a Weave — wraps an inline Coil or references a Coil by ID.
 */
export const WeaveChildSchema = z.object({
  /** Inline coil definition */
  coil: CoilSchema.or(z.string()),
});

/**
 * Weave: ordered sequence container for Coils.
 * V1: concatenate layout only, supports Default-Coil injection.
 */
export const WeaveSchema = z.object({
  /** Unique identifier for this weave (camelCase) */
  id: z.string().min(1),
  /** Layout mode — v1 supports only 'concatenate' */
  layout: z.enum(['concatenate']).default('concatenate'),
  /** Default coil ID or inline Coil providing fallback layers for child coils */
  defaultCoil: z.string().or(CoilSchema).optional(),
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
    /** Optional library of reusable named Coils */
    coils: z.record(z.string(), CoilSchema).or(z.array(CoilSchema)).optional(),
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

