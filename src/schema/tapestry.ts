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
 * A melody entry: either a solfège pitch token (or space-separated pitch tokens)
 * or a repeat count / lookback window (e.g. 2, "2", 2.3, "2.3").
 */
export const MelodyEntrySchema = z.union([
  SolfegePitchToken,
  z.number().nonnegative(),
  z.string().regex(/^\d+(?:\.\d+)?$/),
]);

export type MelodyEntry = z.infer<typeof MelodyEntrySchema>;

/**
 * Solfège syllable for harmony roots and chord alterations (e.g. "Do", "Dox", "DoMe", "DoMex", "So^", "Do_").
 */
const SolfegeHarmonyRoot = z.string().regex(
  /^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(?:x)?(?:(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(?:x)?)*(?:\^+|_*)?$/,
  'Must be a valid solfège harmony token (e.g. "Do", "Dox", "DoMe", "DoMex", "So^", "Do_")'
);

/**
 * A harmony entry: either a solfège harmony token (e.g. "Do", "DoMe")
 * or a repeat count / lookback window (e.g. 2, "2", 2.3, "2.3").
 */
export const HarmonyEntrySchema = z.union([
  SolfegeHarmonyRoot,
  z.number().nonnegative(),
  z.string().regex(/^\d+(?:\.\d+)?$/),
]);

export type HarmonyEntry = z.infer<typeof HarmonyEntrySchema>;

/**
 * Solfège rhythm token: optional 'Dox' prefixes (beat skips) + base syllable + optional suffix syllables.
 * Examples: "Do", "Fi", "Me", "La", "DoxDo", "DoxFi", "LeFi", "MeFi"
 */
export const SolfegeRhythmTokenSchema = z.string().superRefine((val, ctx) => {
  const tokens = val.trim().split(/\s+/);
  const tokenRegex = /^(?:Dox)*(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)+(?:\^+|_*)?$/;
  if (tokens.length === 0 || !tokens.every(t => tokenRegex.test(t))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be valid solfège rhythm token(s) (e.g. "Do", "Fi", "DoxDo", "LeFi", "Do Fi")',
    });
  }
});

/**
 * A rhythm entry: either a solfège rhythm token or a repeat count / lookback window.
 */
export const RhythmEntrySchema = z.union([
  SolfegeRhythmTokenSchema,
  z.number().positive(),
  z.string().regex(/^\d+(?:\.\d+)?$/),
]);

export type RhythmEntry = z.infer<typeof RhythmEntrySchema>;

/**
 * Rhythm block-length label: a named pair of solfège syllables.
 * V1 supported values: DoSo, DoRe, DoLa, DoMi, DoSi, DoFi
 */
export const RhythmLabel = z.enum(['DoSo', 'DoRe', 'DoLa', 'DoMi', 'DoSi', 'DoFi']);
export type RhythmLabelType = z.infer<typeof RhythmLabel>;

/**
 * Visual elements that can be selectively shown in the engraved score.
 */
export const EngravingElementSchema = z.enum([
  'melody',
  'melodyCoilInterval',
  'melodyCoilAbsolute',
  'rhythmCoil',
  'harmonyCoil',
  'harmony',
  'traditionalHarmony',
  'rhythmGrid',
  'chordNames',
]);

export type EngravingElement = z.infer<typeof EngravingElementSchema>;

/**
 * Engraving configuration schema: document metadata, visual styling, staves, and layout.
 */
export const EngravingSchema = z.object({
  /** Piece title */
  title: z.string().optional(),
  /** Subtitle or secondary description */
  subtitle: z.string().optional(),
  /** Composer name */
  composer: z.string().optional(),
  /** Artist name (alias for composer) */
  artist: z.string().optional(),
  /** Author or creator */
  author: z.string().optional(),
  /** Arranger */
  arranger: z.string().optional(),
  /** Poet or lyricist */
  poet: z.string().optional(),
  /** Lyricist (alias for poet) */
  lyricist: z.string().optional(),
  /** Copyright statement */
  copyright: z.string().optional(),
  /** Custom tagline or boolean (false suppresses LilyPond default footer) */
  tagline: z.union([z.string(), z.boolean()]).optional(),
  /** Array of score elements / layers to display */
  show: z.array(EngravingElementSchema).optional(),
  /** Notehead style: 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default' */
  noteheadStyle: z.enum(['ppt', 'sacredHarp', 'aiken', 'funk', 'walker', 'diamond', 'default']).optional(),
  /** Whether to colorize melody noteheads according to the PPT Solfège palette */
  colorNotes: z.boolean().optional(),
  /** Whether to draw a dark outline around colored noteheads for contrast */
  noteheadOutline: z.boolean().optional(),
  /** Whether to omit stems on noteheads for unmetered notation */
  omitStem: z.boolean().optional(),
  /** Clef for the melody staff (e.g. "treble", "treble_8", "bass") */
  melodyClef: z.string().optional(),
  /** Clef for the harmony staff (e.g. "treble", "bass", "bass_8", "bass_15") */
  harmonyClef: z.string().optional(),
  /** Global octave shift for harmony layer (e.g. 0 for treble register, -1 for bass register) */
  harmonyOctave: z.number().int().optional(),
  /** Harmony staff rendering style: 'standard' (traditional 5-line staff), 'coil' (includes single-line staff with circle clef and solfège glyphs), or 'both' */
  harmonyStaffStyle: z.enum(['standard', 'coil', 'both']).optional(),
  /** Whether to show harmony chords only when changed and at bar starts with whole noteheads (default: true) */
  harmonyChangesOnly: z.boolean().optional(),
  /** Whether to only display chord names when the chord changes */
  chordChanges: z.boolean().optional(),
  /** Global zoom / staff size scaling factor (e.g. 1.2 for +20%, 0.8 for -20%) or absolute pt size (e.g. 24) */
  zoom: z.number().positive().optional(),
  /** First-line indentation in mm (default: 0 for flush alignment) */
  indent: z.number().nonnegative().optional(),
  /** Whether to draw light vertical grid lines indicating onset alignment */
  showRhythmGrid: z.boolean().optional(),
  /** Whether to show the Harmony Coil staff (single-line staff with circle clef and solfège glyphs) */
  showHarmonyCoil: z.boolean().optional(),
  /** Whether to show the traditional 5-line harmony staff */
  showTraditionalHarmony: z.boolean().optional(),
  /** Whether to show the melody staff (default: true) */
  showMelody: z.boolean().optional(),
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute: z.boolean().optional(),
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval: z.boolean().optional(),
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil: z.boolean().optional(),
});

export type Engraving = z.infer<typeof EngravingSchema>;

/**
 * Knot: absolute pitch/tempo anchor and root entry point.
 * Provides the concrete value for tonic and optional tempo, root weave ID,
 * and visual engraving configuration.
 */
export const KnotSchema = z.object({
  /** Absolute pitch anchor for Tonic / Do, e.g. "C4", "Eb4", "F#3" */
  tonic: z.string().regex(
    /^[A-G](#|b|♭)?\d+$/,
    'Must be a pitch name like "C4", "Eb4", or "F#3"'
  ).optional(),
  /** Backwards-compatible alias for tonic */
  do: z.string().regex(
    /^[A-G](#|b|♭)?\d+$/,
    'Must be a pitch name like "C4", "Eb4", or "F#3"'
  ).optional(),
  /** Identifier of the root Weave to render */
  weave: z.string().optional(),
  /** Tempo in BPM — accepted but unused in v1 */
  tempo: z.number().positive().optional(),
  /** Engraving configuration and visual presentation settings */
  engraving: EngravingSchema.optional(),

  // Top-level fallback properties for backwards compatibility:
  title: z.string().optional(),
  subtitle: z.string().optional(),
  composer: z.string().optional(),
  artist: z.string().optional(),
  author: z.string().optional(),
  arranger: z.string().optional(),
  poet: z.string().optional(),
  lyricist: z.string().optional(),
  copyright: z.string().optional(),
  tagline: z.union([z.string(), z.boolean()]).optional(),
  harmonyOctave: z.number().int().optional(),
  melodyClef: z.string().optional(),
  harmonyClef: z.string().optional(),
  noteheadStyle: z.enum(['ppt', 'sacredHarp', 'aiken', 'funk', 'walker', 'diamond', 'default']).optional(),
  harmonyChangesOnly: z.boolean().optional(),
  omitStem: z.boolean().optional(),
  colorNotes: z.boolean().optional(),
  noteheadOutline: z.boolean().optional(),
  harmonyStaffStyle: z.enum(['standard', 'coil', 'both']).optional(),
  showHarmonyCoil: z.boolean().optional(),
  showTraditionalHarmony: z.boolean().optional(),
  showMelody: z.boolean().optional(),
  showMelodyCoilAbsolute: z.boolean().optional(),
  showMelodyCoilInterval: z.boolean().optional(),
  showRhythmCoil: z.boolean().optional(),
  zoom: z.number().positive().optional(),
  indent: z.number().nonnegative().optional(),
  showRhythmGrid: z.boolean().optional(),
  chordChanges: z.boolean().optional(),
});

/**
 * Structured voice object within a melody layer.
 * Allows bundling pitches and dedicated rhythm per voice.
 */
export const MelodyVoiceObjectSchema = z.object({
  /** Pitch tokens for this voice (e.g. ["Dox", "Do", "Me"]) */
  pitches: z.array(MelodyEntrySchema).min(1).optional(),
  /** Alias for pitches */
  melody: z.array(MelodyEntrySchema).min(1).optional(),
  /** Rhythm layer for this voice */
  rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema)]).optional(),
  /** Metric block-length label for this voice */
  meter: RhythmLabel.optional(),
  /** Optional clef override for this voice */
  clef: z.string().optional(),
  /** Optional name/label for this voice (e.g. "Soprano", "Alto") */
  name: z.string().optional(),
});

export type MelodyVoiceObject = z.infer<typeof MelodyVoiceObjectSchema>;

/**
 * Polymorphic melody layer:
 * 1. Flat array of pitch tokens: [Dox, Do, Me]
 * 2. Structured voice object: { pitches: [Dox, Do], rhythm: [Do, Do] }
 * 3. Polyphonic voices: array of arrays or array of voice objects
 */
export const MelodyLayerSchema = z.union([
  // Flat pitch array (single voice)
  z.array(MelodyEntrySchema).min(1),
  // Structured single voice object
  MelodyVoiceObjectSchema,
  // Polyphonic array of voices (either pitch arrays or structured voice objects)
  z.array(z.union([z.array(MelodyEntrySchema).min(1), MelodyVoiceObjectSchema])).min(1),
]);

export type MelodyLayer =
  | MelodyEntry[]
  | MelodyVoiceObject
  | Array<MelodyEntry[] | MelodyVoiceObject>;

/**
 * Structured harmony layer object.
 * Allows bundling chords and dedicated rhythm/octave.
 */
export const HarmonyObjectSchema = z.object({
  /** Chord root solfège syllables and/or repeat padding counts */
  chords: z.array(HarmonyEntrySchema).min(1).optional(),
  /** Alias for chords */
  harmony: z.array(HarmonyEntrySchema).min(1).optional(),
  /** Rhythm layer for harmony */
  rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema)]).optional(),
  /** Metric block-length label for harmony */
  meter: RhythmLabel.optional(),
  /** Optional octave shift for this harmony layer */
  harmonyOctave: z.number().int().optional(),
});

export type HarmonyObject = z.infer<typeof HarmonyObjectSchema>;

/**
 * Polymorphic harmony layer:
 * 1. Flat array of chord tokens: [DoMe, Fa, So]
 * 2. Structured harmony object: { chords: [DoMe], rhythm: [Do, Do] }
 */
export const HarmonyLayerSchema = z.union([
  z.array(HarmonyEntrySchema).min(1),
  HarmonyObjectSchema,
]);

export type HarmonyLayer = HarmonyEntry[] | HarmonyObject;

/**
 * Coil interface for TypeScript typing with recursive concat support.
 */
export interface Coil {
  /** Unique identifier for this coil (optional for anonymous inline coils) */
  id?: string;
  /** Single parent Coil ID to inherit layers from */
  parent?: string;
  /** Ordered list or single parent Coil ID to inherit layers from */
  parents?: string | string[];
  /** Sub-coils to concatenate into a single continuous phrase */
  concat?: Array<string | Coil>;
  /** Rhythm layer: either micro Solfège rhythm tokens array or a macro metric block-length label */
  rhythm?: RhythmLabelType | Array<string | number>;
  /** Metric block-length label: macro time grouping (e.g. "DoLa", "DoSo") */
  meter?: RhythmLabelType;
  /** Melody layer: flat array, structured voice object, or polyphonic array of voices */
  melody?: MelodyLayer;
  /** Harmony layer: flat array or structured harmony object */
  harmony?: HarmonyLayer;
  /** Optional octave shift for this coil's harmony layer (e.g. 0, -1, 1) */
  harmonyOctave?: number;
}

/**
 * Coil: the atomic composable unit with up to three layers.
 * Supports priority-based inheritance from parent coils and concatenation of sub-coils.
 */
export const CoilSchema: z.ZodType<Coil> = z.lazy(() =>
  z.object({
    /** Unique identifier for this coil (optional for anonymous inline coils) */
    id: z.string().min(1).optional(),
    /** Single parent Coil ID to inherit layers from */
    parent: z.string().optional(),
    /** Ordered list or single parent Coil ID to inherit layers from */
    parents: z.union([z.string(), z.array(z.string())]).optional(),
    /** Sub-coils to concatenate into a single continuous phrase */
    concat: z.array(z.union([z.string(), CoilSchema])).min(1).optional(),
    /** Rhythm layer: either micro Solfège rhythm tokens array or a macro metric block-length label */
    rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema)]).optional(),
    /** Metric block-length label: macro time grouping (e.g. "DoLa", "DoSo") */
    meter: RhythmLabel.optional(),
    /** Melody layer: flat array, structured voice object, or polyphonic array of voices */
    melody: MelodyLayerSchema.optional(),
    /** Harmony layer: flat array or structured harmony object */
    harmony: HarmonyLayerSchema.optional(),
    /** Optional octave shift for this coil's harmony layer (e.g. 0, -1, 1) */
    harmonyOctave: z.number().int().optional(),
  })
);

/**
 * Weave interface for TypeScript typing with recursive children.
 */
export interface Weave {
  /** Unique identifier for this weave (camelCase, optional when in dictionary or anonymous) */
  id?: string;
  /** Layout mode — v1 supports only 'concatenate' */
  layout?: 'concatenate';
  /** Local/in-place library of reusable named Coils */
  coils?: Record<string, Coil> | Coil[];
  /** Default coil ID or inline Coil providing fallback layers for child coils */
  defaultCoil?: string | Coil;
  /** Ordered list of child coils and/or child weaves */
  children: WeaveChild[];
}

/**
 * A child entry within a Weave — wraps an inline Coil/Weave or references one by ID.
 */
export type WeaveChild =
  | { coil: Coil | string; weave?: never }
  | { weave: Weave | string; coil?: never };

/**
 * Zod schema for WeaveChild (supports both coil and nested weave).
 */
export const WeaveChildSchema: z.ZodType<WeaveChild> = z.lazy(() =>
  z.union([
    z.object({
      coil: CoilSchema.or(z.string()),
    }),
    z.object({
      weave: WeaveSchema.or(z.string()),
    }),
  ])
);

/**
 * Weave: ordered sequence container for Coils and nested Weaves.
 * V1: concatenate layout only, supports Default-Coil injection and recursive composition.
 */
export const WeaveSchema: z.ZodType<Weave> = z.lazy(() =>
  z.object({
    /** Unique identifier for this weave (camelCase, optional when in dictionary or anonymous) */
    id: z.string().min(1).optional(),
    /** Layout mode — v1 supports only 'concatenate' */
    layout: z.enum(['concatenate']).default('concatenate'),
    /** Local/in-place library of reusable named Coils */
    coils: z.record(z.string(), CoilSchema).or(z.array(CoilSchema)).optional(),
    /** Default coil ID or inline Coil providing fallback layers for child coils */
    defaultCoil: z.string().or(CoilSchema).optional(),
    /** Ordered list of child coils and/or child weaves */
    children: z.array(WeaveChildSchema).min(1),
  })
);

/**
 * Top-level Tapestry IR schema.
 */
export const TapestrySchema = z.object({
  tapestry: z.object({
    /** Optional absolute anchor & engraving config (defaults to C4/120 if absent) */
    knot: KnotSchema.optional(),
    /** Optional library of reusable named Coils */
    coils: z.record(z.string(), CoilSchema).or(z.array(CoilSchema)).optional(),
    /** Optional library of reusable named Weaves */
    weaves: z.record(z.string(), WeaveSchema).or(z.array(WeaveSchema)).optional(),
    /** The top-level weave containing all coils and nested weaves (or reference ID) */
    weave: WeaveSchema.or(z.string()).optional(),
  }),
});

/** TypeScript types inferred from schemas */
export type Knot = z.infer<typeof KnotSchema>;
export type Tapestry = z.infer<typeof TapestrySchema>;
