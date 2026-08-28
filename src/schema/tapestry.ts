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
  const tokenRegex = /^(?:(?:Dox)*(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)+(?:\^+|_*)?|Dox+)$/;
  if (tokens.length === 0 || !tokens.every(t => tokenRegex.test(t))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be valid solfège rhythm token(s) (e.g. "Do", "Fi", "DoxDo", "LeFi", "Do Fi", "Dox")',
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
 * Rhythm block-length label & Metric Grammar:
 * Supports single cadential blocks (DoSo, DoRe, DoLa, DoMi, DoSi, DoFi, DoRa),
 * compound metric chains (DoLaDiLa, DoReDiRe, DoReDiSo, DoSoDiRe),
 * traditional time signatures (4/4, 3/4, 6/8, 5/4, 7/8, 12/8, 2/2, etc.),
 * or pulse token sequences.
 */
export const RhythmLabel = z.string().min(1);
export type RhythmLabelType = string;

export const PulseSchema = z.union([
  RhythmLabel,
  z.array(z.string().min(1)),
]);
export type Pulse = z.infer<typeof PulseSchema>;
export const MeterSchema = PulseSchema;
export type Meter = Pulse;

/**
 * Visual elements that can be selectively shown in the engraved score.
 */
export const EngravingElementSchema = z.enum([
  'melody',
  'melodyCoilInterval',
  'melodyCoilAbsolute',
  'pulseCoil',
  'rhythmCoil',
  'harmonyCoil',
  'harmony',
  'traditionalHarmony',
  'harmonyStaff',
  'rhythmGrid',
  'chordNames',
  'gridSymbols',
  'timeSignature',
  'pulseSignature',
  'guitarTab',
]);

export type EngravingElement = z.infer<typeof EngravingElementSchema>;

/**
 * Voicing styles for guitar tablature grips.
 */
export const GuitarVoicingEnum = z.enum([
  'melodyOnly',      // Pure melody noteheads on optimal string/fret positions
  'root',            // Melody note + bass root note on chord changes
  'triad',           // Melody note + root + 3rd/5th chord tones on chord changes
  'shell',           // Melody note + 3rd and 7th guide tones on chord changes
  'chordMelody',     // Jazz chord-melody drop-2 / 3-4 note grips on changes and downbeats
  'rootChordTones',  // Alias for triad
  'guideTones',      // Alias for shell
  'bassAndMelody',   // Alias for root
  'auto',            // Dynamically selects richest playable grip within maxFretSpan
]);

export type GuitarVoicing = z.infer<typeof GuitarVoicingEnum>;

/**
 * Movement priority modes for guitar tablature phrasing.
 */
export const GuitarTabMovementEnum = z.enum([
  'vertical',    // Position-based box playing: minimizes horizontal hand shifts along neck (default)
  'horizontal',  // String-linear playing: minimizes string changes for scalar/interval visualization
]);

export type GuitarTabMovement = z.infer<typeof GuitarTabMovementEnum>;

/**
 * Phrasing scope for guitar tablature solving.
 */
export const GuitarTabScopeEnum = z.enum([
  'coil',        // Solve within each coil/motif independently (default: stable, local position per motif)
  'continuous',  // Solve continuously across coil boundaries across the entire passage/song
]);

export type GuitarTabScope = z.infer<typeof GuitarTabScopeEnum>;

/**
 * Consolidated configuration for guitar tablature engraving.
 */
export const GuitarTabConfigSchema = z.object({
  /** Whether to show the guitar tablature staff */
  show: z.boolean().optional(),
  /** Movement priority: 'vertical' (limits horizontal fret shifts) | 'horizontal' (limits string changes) */
  movement: GuitarTabMovementEnum.optional(),
  /** Phrasing solver scope: 'coil' (default: per-coil independent motifs) | 'continuous' (across coil boundaries) */
  scope: GuitarTabScopeEnum.optional(),
  /** Alias for scope */
  phraseScope: GuitarTabScopeEnum.optional(),
  /** Convenience boolean for scope: true -> 'continuous', false -> 'coil' */
  crossCoil: z.boolean().optional(),
  /** Guitar tablature voicing style */
  voicing: GuitarVoicingEnum.optional(),
  /** Maximum fret span / reach distance across simultaneous fretted notes (default: 4) */
  fretSpan: z.number().int().min(1).max(10).optional(),
  /** Alias for fretSpan */
  maxFretSpan: z.number().int().min(1).max(10).optional(),
  /** Custom guitar tuning (default: standard 6-string EADGBE) */
  tuning: z.string().optional(),
  /** Tablature notehead styling: 'ppt' (geometric shapes) | 'numbersOnly' | 'default' */
  style: z.enum(['ppt', 'numbersOnly', 'default']).optional(),
});

export type GuitarTabConfig = z.infer<typeof GuitarTabConfigSchema>;

/**
 * Voicing styles for projecting abstract harmony chords onto concrete staves and MIDI.
 */
export const HarmonyVoicingEnum = z.enum([
  'close',          // Default standard compact tertian chords
  'rootless',       // 3rd + 7th (+ 5th/9th) without root
  'rootFifth',      // Root + 5th (power dyads)
  'shell',          // Root + 3rd + 7th / Root + 7th
  'open',           // Spread voicing (1-5-10 or drop-2)
  'smoothLead',     // Parsimonious voice leading minimizing step distance
  'bassOnly',       // Emits single bass note in lowest octave
  'walkingBass',    // Emits walking bass line with scalar connective tissue
  'octaves',        // Doubled octaves in bass
]);

export type HarmonyVoicing = z.infer<typeof HarmonyVoicingEnum>;

/**
 * Melody harmonic augmentation styles.
 */
export const MelodyAugmentationEnum = z.enum([
  'none',           // Single melody note only
  'thirdsBelow',    // Diatonic 3rd below matching active harmony
  'sixthsBelow',    // Diatonic 6th below matching active harmony
  'triadClose',     // Close 3-part chord below melody
  'drop2',          // 4-part block chord with 2nd voice from top dropped an octave
  'guideToneDyad',  // 3rd + 7th guide-tone dyad under melody note
  'octaves',        // Doubled melody an octave below
]);

export type MelodyAugmentation = z.infer<typeof MelodyAugmentationEnum>;

/**
 * Visual presentation styles for inferred harmonic augmentation notes.
 */
export const MelodyAugmentationDisplayEnum = z.enum([
  'ghosted',        // Small font size with dark outline
  'dimmed',         // Muted opacity / gray color
  'smallColored',   // Small notehead with PPT chromatic Solfège color
  'smallMuted',     // Small notehead in muted gray
  'parenthesized',  // Normal size with parentheses around notehead
  'diamond',        // Diamond shape notehead
  'normal',         // Standard notehead styling matching primary melody note
]);

export type MelodyAugmentationDisplay = z.infer<typeof MelodyAugmentationDisplayEnum>;

/**
 * High-level arrangement / projection presets.
 */
export const ProjectionPresetEnum = z.enum([
  'default',        // Standard lead sheet + full harmony staff
  'chordMelody',    // Solo chord melody
  'leadSheet',      // Melody + chord symbols only (hides harmony staff)
  'jazzComping',    // Rootless voicings + muted augmentation
  'acousticFolk',   // Open voicings + thirds below
  'bassAndLead',    // Walking bass + solo lead line
]);

export type ProjectionPreset = z.infer<typeof ProjectionPresetEnum>;

/**
 * Engraving visibility and presentation options for score generation.
 */
export const EngravingSchema = z.object({
  /** Custom piece title override */
  title: z.string().optional(),
  /** Subtitle */
  subtitle: z.string().optional(),
  /** Composer or Artist name */
  composer: z.string().optional(),
  /** Arranger */
  arranger: z.string().optional(),
  /** Poet or lyricist */
  poet: z.string().optional(),
  /** Copyright statement */
  copyright: z.string().optional(),
  /** Custom tagline or boolean */
  tagline: z.union([z.string(), z.boolean()]).optional(),
  /** Clef for melody staff (default: 'treble') */
  melodyClef: z.string().optional(),
  /** Clef for harmony staff (default: 'treble') */
  harmonyClef: z.string().optional(),
  /** Notehead shape style: 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default' */
  noteheadStyle: z.enum(['ppt', 'sacredHarp', 'aiken', 'funk', 'walker', 'diamond', 'default']).optional(),
  /** Whether to colorize noteheads according to the PPT Solfège chromatic palette */
  colorNotes: z.boolean().optional(),
  /** Whether to draw a dark outline around colored noteheads for contrast */
  noteheadOutline: z.boolean().optional(),
  /** Harmony staff rendering style */
  harmonyStaffStyle: z.enum(['standard', 'coil', 'both']).optional(),
  /** Whether to show harmony chords only when changed */
  harmonyChangesOnly: z.boolean().optional(),
  /** Global octave shift for harmony layer */
  harmonyOctave: z.number().int().optional(),
  /** Global harmony voicing style */
  harmonyVoicing: HarmonyVoicingEnum.optional(),
  /** Global melody harmonic augmentation style */
  melodyAugmentation: MelodyAugmentationEnum.optional(),
  /** Visual presentation style for melody augmentation notes */
  melodyAugmentationDisplay: MelodyAugmentationDisplayEnum.optional(),
  /** High-level arrangement / projection preset */
  projection: ProjectionPresetEnum.optional(),
  /** Whether to omit stems on noteheads for unmetered notation */
  omitStem: z.boolean().optional(),
  /** Whether to format note durations with traditional dotted values and visible rests */
  traditionalRhythms: z.boolean().optional(),
  /** Alias for traditionalRhythms */
  traditionalDurations: z.boolean().optional(),
  /** Global staff size / zoom scaling factor (e.g. 1.2 for +20%) or absolute pt size (e.g. 24) */
  zoom: z.number().positive().optional(),
  /** First-line indentation in mm (default: 0 for flush alignment) */
  indent: z.number().min(0).optional(),
  /** Whether to draw vertical grid lines indicating onset alignment */
  showRhythmGrid: z.boolean().optional(),
  /** List of score elements to display */
  show: z.array(EngravingElementSchema).optional(),
  /** Whether to show chord names above the staff */
  showChordNames: z.boolean().optional(),
  /** Whether to only display chord names when chord changes */
  chordChanges: z.boolean().optional(),
  /** Accidental spelling mode ('sharps' or 'flats', auto-detected if omitted) */
  accidentalMode: z.enum(['sharps', 'flats']).optional(),
  /** Whether to show the Harmony Coil staff */
  showHarmonyCoil: z.boolean().optional(),
  /** Whether to show the traditional 5-line harmony staff */
  showTraditionalHarmony: z.boolean().optional(),
  /** Consolidated guitar tablature configuration or boolean toggle */
  guitarTab: z.union([z.boolean(), GuitarTabConfigSchema]).optional(),
  /** Movement priority for guitar tablature phrasing: 'vertical' (default) | 'horizontal' */
  guitarTabMovement: GuitarTabMovementEnum.optional(),
  /** Phrasing solver scope: 'coil' (default: per-coil independent motifs) | 'continuous' (across coil boundaries) */
  guitarTabScope: GuitarTabScopeEnum.optional(),
  /** Alias for guitarTabScope */
  guitarTabPhraseScope: GuitarTabScopeEnum.optional(),
  /** Convenience boolean for guitarTabScope: true -> 'continuous', false -> 'coil' */
  crossCoilGuitarTab: z.boolean().optional(),
  /** Whether to show the guitar tablature staff */
  showGuitarTab: z.boolean().optional(),
  /** Guitar tablature voicing style */
  guitarVoicing: GuitarVoicingEnum.optional(),
  /** Maximum fret span / stretch distance for guitar grips (default: 4, e.g. 3 for smaller hands) */
  maximumFretSpan: z.number().int().min(1).max(10).optional(),
  /** Alias for maximumFretSpan */
  maxFretSpan: z.number().int().min(1).max(10).optional(),
  /** Custom guitar tuning specification (default: 'guitar' / standard EADGBE) */
  guitarTuning: z.string().optional(),
  /** Tablature notehead styling: 'ppt' (geometric shapes) | 'numbersOnly' | 'default' */
  tabStaffStyle: z.enum(['ppt', 'numbersOnly', 'default']).optional(),
  /** Whether to show the melody staff (default: true) */
  showMelody: z.boolean().optional(),
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute: z.boolean().optional(),
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval: z.boolean().optional(),
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil: z.boolean().optional(),
  /** Whether to show the Pulse / Metric Coil row layer (displays Solfège metric pulse glyphs with 'P' clef) */
  showPulseCoil: z.boolean().optional(),
  /** Alias for showPulseCoil */
  showMetricCoil: z.boolean().optional(),
  /** Whether to show the time signature on the traditional notation staff */
  showTimeSignature: z.boolean().optional(),
  /** Custom time signature or metric grammar label override (e.g. "4/4", "3/4", "6/8") */
  timeSignature: z.string().optional(),
  /** Whether to show the PPT pulse signature in the score header next to key anchor */
  showPulseSignature: z.boolean().optional(),
  /** Custom pulse signature label override for the score header (e.g. "DoLa", "DoRe", "[Dox, Re, So]") */
  pulseSignature: z.string().optional(),
  /** Metric pulse grammar specification for knot */
  pulse: PulseSchema.optional(),
  /** Alias for pulse */
  meter: PulseSchema.optional(),
  /** Whether to annotate rhythm grid lines with geometric Solfège notehead symbols (true, 'all', 'no-do', 'off') */
  gridSymbols: z.union([z.boolean(), z.enum(['all', 'no-do', 'off'])]).optional(),
  /** Whether to exclude circle symbol on Do/downbeats when annotating rhythm grid (since heavy line marks downbeat) */
  excludeGridDoSymbol: z.boolean().optional(),
  /** Alias for excludeGridDoSymbol */
  gridSymbolExcludeDo: z.boolean().optional(),
  /** Whether to draw heavier / darker grid lines on strong beats (Do/Dix) */
  strongBeatGridWeight: z.boolean().optional(),
  /** Alias for strongBeatGridWeight */
  gridBeatWeights: z.boolean().optional(),
});

export type Engraving = z.infer<typeof EngravingSchema>;

/**
 * Knot: absolute pitch/tempo anchor and root entry point.
 * Provides the concrete value for tonic and optional tempo, root weave ID,
 * and visual engraving configuration.
 */
export const KnotSchema = z.object({
  /** Unique identifier for this knot (optional for single root knot or dictionary keys) */
  id: z.string().optional(),
  /** Human-readable display label/name for selector dropdown */
  name: z.string().optional(),
  /** Alias for name */
  label: z.string().optional(),
  /** Whether this knot is an abstract template excluded from dropdown selection (does NOT get inherited) */
  abstract: z.boolean().optional(),
  /** Alias for abstract / hidden from dropdown selection (does NOT get inherited) */
  hidden: z.boolean().optional(),
  /** Explicit visibility toggle in dropdown (defaults to true; does NOT get inherited) */
  visible: z.boolean().optional(),
  /** Single parent Knot ID to inherit properties from */
  parent: z.string().optional(),
  /** Ordered list or single parent Knot ID to inherit properties from */
  parents: z.union([z.string(), z.array(z.string())]).optional(),
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
  /** Metric pulse grammar specification for knot */
  pulse: PulseSchema.optional(),
  /** Metric grammar / time signature specification for knot (alias for pulse) */
  meter: MeterSchema.optional(),
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
  harmonyVoicing: HarmonyVoicingEnum.optional(),
  guitarTab: z.union([z.boolean(), GuitarTabConfigSchema]).optional(),
  guitarTabMovement: GuitarTabMovementEnum.optional(),
  guitarTabScope: GuitarTabScopeEnum.optional(),
  guitarTabPhraseScope: GuitarTabScopeEnum.optional(),
  crossCoilGuitarTab: z.boolean().optional(),
  guitarVoicing: GuitarVoicingEnum.optional(),
  maximumFretSpan: z.number().int().min(1).max(10).optional(),
  maxFretSpan: z.number().int().min(1).max(10).optional(),
  guitarTuning: z.string().optional(),
  tabStaffStyle: z.enum(['ppt', 'numbersOnly', 'default']).optional(),
  melodyAugmentation: MelodyAugmentationEnum.optional(),
  melodyAugmentationDisplay: MelodyAugmentationDisplayEnum.optional(),
  projection: ProjectionPresetEnum.optional(),
  omitStem: z.boolean().optional(),
  traditionalRhythms: z.boolean().optional(),
  traditionalDurations: z.boolean().optional(),
  colorNotes: z.boolean().optional(),
  noteheadOutline: z.boolean().optional(),
  harmonyStaffStyle: z.enum(['standard', 'coil', 'both']).optional(),
  showHarmonyCoil: z.boolean().optional(),
  showPulseCoil: z.boolean().optional(),
  showTraditionalHarmony: z.boolean().optional(),
  showGuitarTab: z.boolean().optional(),
  showMelody: z.boolean().optional(),
  showMelodyCoilAbsolute: z.boolean().optional(),
  showMelodyCoilInterval: z.boolean().optional(),
  showRhythmCoil: z.boolean().optional(),
  showMetricCoil: z.boolean().optional(),
  showTimeSignature: z.boolean().optional(),
  timeSignature: z.string().optional(),
  showPulseSignature: z.boolean().optional(),
  pulseSignature: z.string().optional(),
  gridSymbols: z.union([z.boolean(), z.enum(['all', 'no-do', 'off'])]).optional(),
  excludeGridDoSymbol: z.boolean().optional(),
  gridSymbolExcludeDo: z.boolean().optional(),
  strongBeatGridWeight: z.boolean().optional(),
  gridBeatWeights: z.boolean().optional(),
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
  /** Source coil ID or layer path to inherit/inject melody from (e.g. 'intro_melody' or 'changes.harmony') */
  from: z.string().min(1).optional(),
  /** Alias for from */
  use: z.string().min(1).optional(),
  /** Pitch tokens for this voice (e.g. ["Dox", "Do", "Me"]), or a coil ID reference */
  pitches: z.union([z.string().min(1), z.array(MelodyEntrySchema)]).optional(),
  /** Alias for pitches */
  melody: z.union([z.string().min(1), z.array(MelodyEntrySchema)]).optional(),
  /** Rhythm layer for this voice */
  rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema), z.string()]).optional(),
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
 * 1. String shorthand referencing a named coil ID (e.g. "verse_1")
 * 2. Flat array of pitch tokens: [Dox, Do, Me]
 * 3. Structured voice object: { pitches: [Dox, Do], rhythm: [Do, Do] } or { from: 'other_coil' }
 * 4. Polyphonic voices: array of pitch arrays or structured voice objects
 */
export const MelodyLayerSchema = z.union([
  // String shorthand referencing a named coil ID
  z.string().min(1),
  // Flat pitch array (single voice)
  z.array(MelodyEntrySchema),
  // Structured single voice object
  MelodyVoiceObjectSchema,
  // Polyphonic array of voices (either pitch arrays or structured voice objects)
  z.array(z.union([z.array(MelodyEntrySchema), MelodyVoiceObjectSchema])),
]);

export type MelodyLayer =
  | string
  | MelodyEntry[]
  | MelodyVoiceObject
  | Array<MelodyEntry[] | MelodyVoiceObject>;

/**
 * Structured rhythm layer object.
 * Allows referencing a source coil or embedding rhythm definitions.
 */
export const RhythmObjectSchema = z.object({
  /** Source coil ID or layer path to inherit/inject rhythm from (e.g. 'groove_1' or 'groove_1.rhythm') */
  from: z.string().min(1).optional(),
  /** Alias for from */
  use: z.string().min(1).optional(),
  /** Rhythm layer: either micro Solfège rhythm tokens array or a macro metric block-length label */
  rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema)]).optional(),
  /** Metric block-length label for rhythm */
  meter: RhythmLabel.optional(),
});

export type RhythmObject = z.infer<typeof RhythmObjectSchema>;

export const RhythmLayerSchema = z.union([
  RhythmLabel,
  z.array(RhythmEntrySchema),
  RhythmObjectSchema,
  z.string().min(1),
]);

export type RhythmLayer = RhythmLabelType | Array<string | number> | RhythmObject | string;

/**
 * Structured harmony layer object.
 * Allows bundling chords and dedicated rhythm/octave, or referencing another coil.
 */
export const HarmonyObjectSchema = z.object({
  /** Source coil ID or layer path to inherit/inject harmony from (e.g. 'changes' or 'changes.harmony') */
  from: z.string().min(1).optional(),
  /** Alias for from */
  use: z.string().min(1).optional(),
  /** Chord root solfège syllables and/or repeat padding counts, or a string coil ID reference */
  chords: z.union([z.string().min(1), z.array(HarmonyEntrySchema)]).optional(),
  /** Alias for chords */
  harmony: z.union([z.string().min(1), z.array(HarmonyEntrySchema)]).optional(),
  /** Rhythm layer for harmony */
  rhythm: z.union([RhythmLabel, z.array(RhythmEntrySchema), z.string()]).optional(),
  /** Metric block-length label for harmony */
  meter: RhythmLabel.optional(),
  /** Optional octave shift for this harmony layer */
  harmonyOctave: z.number().int().optional(),
  /** Optional harmony voicing style for this layer */
  harmonyVoicing: HarmonyVoicingEnum.optional(),
});

export type HarmonyObject = z.infer<typeof HarmonyObjectSchema>;

/**
 * Polymorphic harmony layer:
 * 1. String shorthand referencing a named coil ID (e.g. "changes")
 * 2. Flat array of chord tokens: [DoMe, Fa, So]
 * 3. Structured harmony object: { chords: [DoMe], rhythm: [Do, Do] } or { from: 'changes' }
 */
export const HarmonyLayerSchema = z.union([
  // String shorthand referencing a named coil ID
  z.string().min(1),
  // Flat array of chord tokens
  z.array(HarmonyEntrySchema),
  // Structured harmony object
  HarmonyObjectSchema,
]);

export type HarmonyLayer = string | HarmonyEntry[] | HarmonyObject;

/**
 * Concat item: either a string coil ID, an inline Coil, or an object wrapping a coil ID or inline Coil ({ coil: string | Coil }).
 */
export type ConcatEntry = string | Coil | { coil: string | Coil };

/**
 * Zod schema for a Concat entry.
 */
export const ConcatEntrySchema: z.ZodType<ConcatEntry> = z.lazy(() =>
  z.union([
    z.string().min(1),
    z.object({
      coil: z.union([z.string().min(1), CoilSchema]),
    }),
    CoilSchema,
  ])
);

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
  /** Sub-coils to concatenate / stitch into a single continuous phrase */
  concat?: ConcatEntry[];
  /** Alias for concat: sub-coils to stitch into a single continuous phrase */
  stitch?: ConcatEntry[];
  /** Alias for stitch */
  stitches?: ConcatEntry[];
  /** Rhythm layer: micro Solfège rhythm tokens array, macro metric block-length label, or coil reference */
  rhythm?: RhythmLayer;
  /** Metric pulse grammar specification for this coil */
  pulse?: Pulse;
  /** Alias for pulse */
  meter?: Pulse;
  /** Melody layer: flat array, structured voice object, coil reference, or polyphonic array of voices */
  melody?: MelodyLayer;
  /** Harmony layer: flat array, structured harmony object, or coil reference */
  harmony?: HarmonyLayer;
  /** Optional octave shift for this coil's harmony layer (e.g. 0, -1, 1) */
  harmonyOctave?: number;
  /** Optional harmony voicing style override for this coil */
  harmonyVoicing?: HarmonyVoicing;
  /** Optional melody harmonic augmentation style override for this coil */
  melodyAugmentation?: MelodyAugmentation;
  /** Optional melody augmentation display override for this coil */
  melodyAugmentationDisplay?: MelodyAugmentationDisplay;
  /** Optional projection preset override for this coil */
  projection?: ProjectionPreset;
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
    concat: z.array(ConcatEntrySchema).min(1).optional(),
    /** Alias for concat: sub-coils to stitch into a single continuous phrase */
    stitch: z.array(ConcatEntrySchema).min(1).optional(),
    /** Alias for stitch */
    stitches: z.array(ConcatEntrySchema).min(1).optional(),
    /** Rhythm layer: either micro Solfège rhythm tokens array, macro metric block-length label, or coil ref */
    rhythm: RhythmLayerSchema.optional(),
    /** Metric pulse grammar specification for this coil */
    pulse: PulseSchema.optional(),
    /** Alias for pulse */
    meter: PulseSchema.optional(),
    /** Melody layer: flat array, structured voice object, coil ref, or polyphonic array of voices */
    melody: MelodyLayerSchema.optional(),
    /** Harmony layer: flat array, structured harmony object, or coil ref */
    harmony: HarmonyLayerSchema.optional(),
    /** Optional octave shift for this harmony layer (e.g. 0, -1, 1) */
    harmonyOctave: z.number().int().optional(),
    /** Optional harmony voicing style override for this coil */
    harmonyVoicing: HarmonyVoicingEnum.optional(),
    /** Optional melody harmonic augmentation style override for this coil */
    melodyAugmentation: MelodyAugmentationEnum.optional(),
    /** Optional melody augmentation display override for this coil */
    melodyAugmentationDisplay: MelodyAugmentationDisplayEnum.optional(),
    /** Optional projection preset override for this coil */
    projection: ProjectionPresetEnum.optional(),
  })
);

/**
 * Weave interface for TypeScript typing with recursive stitches.
 */
export interface Weave {
  /** Unique identifier for this weave (camelCase, optional when in dictionary or anonymous) */
  id?: string;
  /** Layout mode: 'concatenate' for sequential playback, 'parallel' for concurrent layering, 'parallelPeriod' for period-matched polyrhythms */
  layout?: 'concatenate' | 'parallel' | 'parallelPeriod';
  /** Local/in-place library of reusable named Coils */
  coils?: Record<string, Coil | { coil: Coil }> | Array<Coil | { coil: Coil }>;
  /** Default coil ID or inline Coil providing fallback layers for child coils */
  defaultCoil?: string | Coil;
  /** Metric pulse grammar specification for this weave */
  pulse?: Pulse;
  /** Alias for pulse */
  meter?: Pulse;
  /** Ordered list of stitches (coils and/or child weaves) */
  stitch?: WeaveStitch[];
  /** Plural alias for stitch */
  stitches?: WeaveStitch[];
  /** Legacy alias for stitch */
  children?: WeaveStitch[];
  /** Optional harmony voicing style override for this weave */
  harmonyVoicing?: HarmonyVoicing;
  /** Optional melody harmonic augmentation style override for this weave */
  melodyAugmentation?: MelodyAugmentation;
  /** Optional melody augmentation display override for this weave */
  melodyAugmentationDisplay?: MelodyAugmentationDisplay;
  /** Optional projection preset override for this weave */
  projection?: ProjectionPreset;
}

/**
 * A stitch entry within a Weave — wraps an inline Coil/Weave or references one by ID.
 */
export type WeaveStitch =
  | { coil: Coil | string; weave?: never }
  | { weave: Weave | string; coil?: never };

/** Backward-compatible alias for WeaveStitch */
export type WeaveChild = WeaveStitch;

/**
 * Zod schema for WeaveStitch (supports both coil and nested weave).
 */
export const WeaveStitchSchema: z.ZodType<WeaveStitch> = z.lazy(() =>
  z.union([
    z.object({
      coil: CoilSchema.or(z.string()),
    }),
    z.object({
      weave: WeaveSchema.or(z.string()),
    }),
  ])
);

/** Backward-compatible alias for WeaveStitchSchema */
export const WeaveChildSchema = WeaveStitchSchema;

/**
 * Weave: sequence/parallel container for Coils and nested Weaves.
 * Supports 'concatenate' (sequential), 'parallel' (simultaneous), and 'parallelPeriod' (period-matched polyrhythms).
 */
export const WeaveSchema: z.ZodType<Weave> = z.lazy(() =>
  z.object({
    /** Unique identifier for this weave (camelCase, optional when in dictionary or anonymous) */
    id: z.string().min(1).optional(),
    /** Layout mode: 'concatenate' for sequential playback, 'parallel' for concurrent layering, 'parallelPeriod' for period-matched polyrhythms */
    layout: z.enum(['concatenate', 'parallel', 'parallelPeriod']).default('concatenate'),
    /** Local/in-place library of reusable named Coils */
    coils: z.record(z.string(), CoilSchema.or(z.object({ coil: CoilSchema }))).or(z.array(CoilSchema.or(z.object({ coil: CoilSchema })))).optional(),
    /** Default coil ID or inline Coil providing fallback layers for child coils */
    defaultCoil: z.string().or(CoilSchema).optional(),
    /** Metric pulse grammar specification for this weave */
    pulse: PulseSchema.optional(),
    /** Alias for pulse */
    meter: PulseSchema.optional(),
    /** Ordered list of stitches (coils and/or child weaves) */
    stitch: z.array(WeaveStitchSchema).min(1).optional(),
    /** Plural alias for stitch */
    stitches: z.array(WeaveStitchSchema).min(1).optional(),
    /** Legacy alias for stitch */
    children: z.array(WeaveStitchSchema).min(1).optional(),
    /** Optional harmony voicing style override for this weave */
    harmonyVoicing: HarmonyVoicingEnum.optional(),
    /** Optional melody harmonic augmentation style override for this weave */
    melodyAugmentation: MelodyAugmentationEnum.optional(),
    /** Optional melody augmentation display override for this weave */
    melodyAugmentationDisplay: MelodyAugmentationDisplayEnum.optional(),
    /** Optional projection preset override for this weave */
    projection: ProjectionPresetEnum.optional(),
  }).refine(
    data => (data.stitch && data.stitch.length > 0) || (data.stitches && data.stitches.length > 0) || (data.children && data.children.length > 0),
    { message: 'Weave must contain at least one stitch entry (stitch: [...])', path: ['stitch'] }
  )
);

/**
 * Top-level Tapestry IR schema.
 */
export const TapestrySchema = z.object({
  tapestry: z.object({
    /** Optional absolute anchor & engraving config (defaults to C4/120 if absent) */
    knot: KnotSchema.optional(),
    /** Optional library or ordered list of named Knots (providing different projections/versions) */
    knots: z.record(z.string(), KnotSchema).or(z.array(KnotSchema)).optional(),
    /** Optional library of reusable named Coils */
    coils: z.record(z.string(), CoilSchema.or(z.object({ coil: CoilSchema }))).or(z.array(CoilSchema.or(z.object({ coil: CoilSchema })))).optional(),
    /** Optional library of reusable named Weaves */
    weaves: z.record(z.string(), WeaveSchema).or(z.array(WeaveSchema)).optional(),
    /** The top-level weave containing all coils and nested weaves (or reference ID) */
    weave: WeaveSchema.or(z.string()).optional(),
  }),
});

/** Summary descriptor for an available knot in a score */
export interface KnotSummary {
  id: string;
  name: string;
  title?: string;
  abstract?: boolean;
}

/** TypeScript types inferred from schemas */
export type Knot = z.infer<typeof KnotSchema>;
export type Tapestry = z.infer<typeof TapestrySchema>;
