/**
 * Uniform Solfège ↔ pitch mapping module.
 * 
 * Handles:
 * - Solfège syllable → semitone offset (0–11)
 * - Solfège syllable → nearest-address coordinate (-5 to +6) for interval mode
 * - Pitch string parsing (syllable, octave shift, axis marker)
 * - Absolute pitch resolution (solfège + knot → concrete pitch)
 * - Interval resolution (solfège → signed semitone offset)
 */

/**
 * The 12 chromatic positions mapped to their primary solfège syllables.
 * Position 0 = Do (tonic), position 11 = Ti (leading tone).
 */
export const SOLFEGE_POSITIONS = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti',
] as const;

export type SolfegeSyllable = typeof SOLFEGE_POSITIONS[number];

/**
 * Maps ALL accepted solfège names (including context-specific variations)
 * to their semitone offset from Do (0–11).
 */
export const SOLFEGE_TO_SEMITONE: Record<string, number> = {
  Do: 0,
  Ra: 1, Di: 1,
  Re: 2,
  Me: 3, Ri: 3,
  Mi: 4,
  Fa: 5,
  Fi: 6, Se: 6,
  So: 7,
  Le: 8, Si: 8,
  La: 9,
  Te: 10, Li: 10,
  Ti: 11,
};

/**
 * Nearest-address coordinates: maps semitone offsets to signed values
 * within (-6, +6], reflecting the structural symmetry around Do
 * bounded by Fi at the tritone axis.
 * 
 * Positions 0–6 map to 0 to +6.
 * Positions 7–11 map to -5 to -1.
 */
const NEAREST_ADDRESS: Record<number, number> = {
  0: 0,    // Do
  1: 1,    // Ra
  2: 2,    // Re
  3: 3,    // Me
  4: 4,    // Mi
  5: 5,    // Fa
  6: 6,    // Fi (tritone axis, always +6)
  7: -5,   // So (mirrors Fa)
  8: -4,   // Le (mirrors Mi)
  9: -3,   // La (mirrors Me)
  10: -2,  // Te (mirrors Re)
  11: -1,  // Ti (mirrors Ra)
};

/** Chromatic pitch names in order (using sharps) */
const PITCH_NAMES_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Chromatic pitch names in order (using flats) */
const PITCH_NAMES_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type AccidentalMode = 'sharps' | 'flats';

/**
 * Determines whether a given pitch name (or knot anchor) prefers flats or sharps.
 * E.g. "Eb4", "Bb3", "Ab4", "Db5", "Gb4", "F4" -> 'flats'
 * E.g. "D#4", "C4", "G4", "D4", "A4", "E4", "B4", "F#3" -> 'sharps'
 */
export function getAccidentalModeFromPitchName(pitchName: string): AccidentalMode {
  if (
    pitchName.includes('b') ||
    pitchName.includes('♭') ||
    (pitchName.startsWith('F') && !pitchName.startsWith('F#'))
  ) {
    return 'flats';
  }
  return 'sharps';
}

/**
 * Parsed representation of a solfège pitch token.
 */
export interface ParsedPitch {
  /** The base solfège syllable (e.g. "Do", "Mi", "So") */
  syllable: string;
  /** Number of octave shifts: positive = up (^), negative = down (_) */
  octaveShift: number;
  /** Whether this token has an axis marker (x suffix), triggering interval mode */
  hasAxis: boolean;
}

export interface RepeatSpec {
  /** How many times to repeat the window */
  repeatCount: number;
  /** How many previous items to look back */
  windowSize: number;
}

/**
 * Checks if a value is a repeat token (e.g. 2, "2", 2.3, "2.3")
 * and parses the repeatCount (X) and lookback windowSize (Y).
 */
export function parseRepeatSpec(item: string | number): RepeatSpec | null {
  if (typeof item === 'number') {
    if (Number.isInteger(item)) {
      return item >= 0 ? { repeatCount: item, windowSize: 1 } : null;
    }
    const str = String(item);
    const parts = str.split('.');
    const repeatCount = parseInt(parts[0], 10);
    const windowSize = parseInt(parts[1], 10);
    if (!isNaN(repeatCount) && !isNaN(windowSize) && repeatCount >= 0 && windowSize > 0) {
      return { repeatCount, windowSize };
    }
    return null;
  }

  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (/^\d+$/.test(trimmed)) {
      const repeatCount = parseInt(trimmed, 10);
      return repeatCount >= 0 ? { repeatCount, windowSize: 1 } : null;
    }
    const match = trimmed.match(/^(\d+)\.(\d+)$/);
    if (match) {
      const repeatCount = parseInt(match[1], 10);
      const windowSize = parseInt(match[2], 10);
      if (repeatCount >= 0 && windowSize > 0) {
        return { repeatCount, windowSize };
      }
    }
  }

  return null;
}

export type NoteheadStyle = 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default';


/**
 * Resolved knot providing absolute pitch context.
 */
export interface ResolvedKnot {
  /** MIDI note number for Do (e.g. 60 for C4) */
  doMidi: number;
  /** Tempo in BPM (unused in v1 but carried through) */
  tempo: number;
  /** Declared pitch name string for Do (e.g. "C4", "Eb4", "D#4") */
  doName?: string;
  /** Piece title */
  title?: string;
  /** Subtitle or secondary description */
  subtitle?: string;
  /** Composer / Artist / Author */
  composer?: string;
  /** Arranger */
  arranger?: string;
  /** Poet or lyricist */
  poet?: string;
  /** Copyright statement */
  copyright?: string;
  /** Custom tagline or boolean (false suppresses LilyPond default footer) */
  tagline?: string | boolean;
  /** Clef for the melody staff (e.g. "treble", "treble_8", "bass") */
  melodyClef?: string;
  /** Clef for the harmony staff (e.g. "treble", "bass", "bass_8", "bass_15") */
  harmonyClef?: string;
  /** Accidental spelling preference ('sharps' or 'flats') */
  accidentalMode?: AccidentalMode;
  /** Notehead style for melody engraving */
  noteheadStyle?: NoteheadStyle;
  /** Whether to show harmony chords only when changed and at bar starts (default: true) */
  harmonyChangesOnly?: boolean;
  /** Whether to omit stems in notation */
  omitStem?: boolean;
  /** Whether to use traditional note duration formatting (dotted notes, open noteheads for half/whole, visible rests) */
  traditionalRhythms?: boolean;

  /** Whether to colorize melody noteheads according to PPT Solfège palette */
  colorNotes?: boolean;
  /** Whether to draw a dark outline around colored noteheads for contrast */
  noteheadOutline?: boolean;
  /** Harmony staff rendering style: 'standard' (traditional 5-line staff), 'coil' (includes single-line staff with circle clef and solfège glyphs), or 'both' */
  harmonyStaffStyle?: 'standard' | 'coil' | 'both';
  /** Whether to show the Harmony Coil staff */
  showHarmonyCoil?: boolean;
  /** Whether to show the traditional 5-line harmony staff */
  showTraditionalHarmony?: boolean;
  /** Whether to show the melody staff */
  showMelody?: boolean;
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute?: boolean;
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval?: boolean;
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil?: boolean;
  /** Global zoom / staff size scaling factor (e.g. 1.2 for +20%, 0.8 for -20%) or absolute pt size (e.g. 24) */
  zoom?: number;
  /** First-line indentation in mm (default: 0 for flush alignment) */
  indent?: number;
  /** Whether to draw light vertical grid lines indicating onset alignment */
  showRhythmGrid?: boolean;
  /** Whether to only display chord names when the chord changes (default: false, showing chord names for every harmony event) */
  chordChanges?: boolean;
  /** Whether to display chord names row */
  showChordNames?: boolean;
  /** Root weave identifier specified in Knot */
  rootWeaveId?: string;
  /** Tonic MIDI number (alias for doMidi) */
  tonicMidi?: number;
  /** Declared tonic name (e.g. "Eb4") */
  tonicName?: string;
  /** Global octave shift for harmony layer */
  harmonyOctave?: number;
  /** Harmony chord voicing projection style */
  harmonyVoicing?: 'close' | 'rootless' | 'rootFifth' | 'shell' | 'open' | 'smoothLead' | 'bassOnly' | 'walkingBass' | 'octaves';
  /** Melody harmonic augmentation style */
  melodyAugmentation?: 'none' | 'thirdsBelow' | 'sixthsBelow' | 'triadClose' | 'drop2' | 'guideToneDyad' | 'octaves';
  /** Visual presentation style for inferred melody augmentation notes */
  melodyAugmentationDisplay?: 'ghosted' | 'dimmed' | 'smallColored' | 'smallMuted' | 'parenthesized' | 'diamond' | 'normal';
  /** High-level arrangement / projection preset */
  projection?: 'default' | 'chordMelody' | 'leadSheet' | 'jazzComping' | 'acousticFolk' | 'bassAndLead';
}







/**
 * Maps a solfège syllable (including all variations) to its semitone offset from Do (0–11).
 * Throws if the syllable is not recognized.
 */
export function solfegeToSemitone(syllable: string): number {
  const semitone = SOLFEGE_TO_SEMITONE[syllable];
  if (semitone === undefined) {
    throw new Error(`Unknown solfège syllable: "${syllable}"`);
  }
  return semitone;
}

/**
 * Maps a solfège syllable to its nearest-address coordinate (-5 to +6).
 * Used for interval-mode melody resolution.
 * 
 * The nearest-address system reflects structural symmetry around Do:
 * - Ra(+1) through Fi(+6) are ascending (sharp-side)
 * - Ti(-1) through So(-5) are descending (flat-side)
 * - Fi(+6) is the tritone axis (boundary)
 */
export function solfegeToNearestAddress(syllable: string): number {
  const semitone = solfegeToSemitone(syllable);
  const addr = NEAREST_ADDRESS[semitone];
  if (addr === undefined) {
    throw new Error(`No nearest-address mapping for semitone ${semitone}`);
  }
  return addr;
}

/**
 * Maps a harmony chord root syllable to its semitone offset from Do (-7 to +4).
 * Clusters chord roots into a single continuous octave below/around Do:
 * Fa (-7), Fi (-6), So (-5), Le (-4), La (-3), Te (-2), Ti (-1),
 * Do (0), Ra (+1), Re (+2), Me (+3), Mi (+4).
 * 
 * This ensures IV (Fa) sits directly below V (So), VI (Le), VII (Te), and I (Do)
 * keeping all block chords in a clean, tight, root-position progression.
 */
export function solfegeToHarmonyRootOffset(syllable: string): number {
  const semitone = solfegeToSemitone(syllable);
  if (semitone >= 5) {
    return semitone - 12;
  }
  return semitone;
}


/**
 * Automatically fits a root MIDI pitch into the optimal staff register for readability.
 * - For treble clef, places the root so the triad sits comfortably within the 5 staff lines (A3..G5).
 * - For bass clef, places the root so the triad sits within the bass staff lines (C2..C4).
 * - For octave-transposed clefs (bass_8, bass_15, treble_8), offsets the register floor/ceiling
 *   so the visual notation stays centered on the 5 staff lines.
 * 
 * This dynamically adapts to whatever pitch Do is (C4, Eb4, A4, etc.) so chord voicings
 * automatically maintain their block placement across the staff without ledger lines.
 */
export function fitRootToClefRegister(
  rootMidi: number,
  clef: string = 'treble',
): number {
  const clean = clef.replace(/"/g, '').trim();
  let minRoot = 57; // A3 default for treble
  let maxTopNote = 79; // G5 default for treble

  if (clean === 'bass_15' || clean === 'F_15') {
    minRoot = 12; // C0
    maxTopNote = 36; // C2
  } else if (clean === 'bass_8' || clean === 'F_8') {
    minRoot = 24; // C1
    maxTopNote = 48; // C3
  } else if (clean.startsWith('bass') || clean.startsWith('F')) {
    minRoot = 36; // C2 for bass
    maxTopNote = 60; // C4 for bass
  } else if (clean === 'treble_8' || clean === 'G_8') {
    minRoot = 45; // A2
    maxTopNote = 67; // G4
  } else if (clean === 'treble^8' || clean === 'G^8') {
    minRoot = 69; // A4
    maxTopNote = 91; // G6
  }

  let fitted = rootMidi;
  // If top note of root-position triad (root + 7) exceeds staff ceiling, shift down
  while (fitted + 7 > maxTopNote) {
    fitted -= 12;
  }
  // If root is below staff floor, shift up
  while (fitted < minRoot) {
    fitted += 12;
  }
  return fitted;
}





/**
 * Parses a solfège pitch token string into its components.
 * 
 * Supported formats:
 * - `"Do"` — plain syllable (absolute mode)
 * - `"Do^"` — syllable + one octave up
 * - `"Do^^"` — syllable + two octaves up  
 * - `"Do_"` — syllable + one octave down
 * - `"Dox"` — syllable + axis marker (triggers interval mode)
 * - `"Dox^"` — axis marker + octave shift
 * 
 * Parsing order: syllable, then 'x' (axis), then ^/_ (octave shifts).
 */
export function parsePitch(notation: string): ParsedPitch {
  let remaining = notation;
  
  // Count and remove trailing octave shifts
  let octaveShift = 0;
  while (remaining.endsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(0, -1);
  }
  while (remaining.endsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(0, -1);
  }
  
  // Check for axis marker
  let hasAxis = false;
  if (remaining.endsWith('x')) {
    hasAxis = true;
    remaining = remaining.slice(0, -1);
  }
  
  // Remaining string should be a valid solfège syllable
  const syllable = remaining;
  if (SOLFEGE_TO_SEMITONE[syllable] === undefined) {
    throw new Error(`Invalid solfège syllable in pitch token: "${notation}" (parsed syllable: "${syllable}")`);
  }
  
  return { syllable, octaveShift, hasAxis };
}

const NOTE_ACCIDENTAL_OFFSETS: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1, 'D♭': 1,
  'D': 2,
  'D#': 3, 'Eb': 3, 'E♭': 3,
  'E': 4, 'Fb': 4, 'F♭': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6, 'G♭': 6,
  'G': 7,
  'G#': 8, 'Ab': 8, 'A♭': 8,
  'A': 9,
  'A#': 10, 'Bb': 10, 'B♭': 10,
  'B': 11, 'Cb': 11, 'C♭': 11,
};

/**
 * Parses a pitch name string like "C4", "Eb4", or "F#3" into a MIDI note number.
 * Middle C (C4) = MIDI 60.
 */
export function pitchNameToMidi(pitchName: string): number {
  const match = pitchName.match(/^([A-G](?:#|b|♭)?)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid pitch name: "${pitchName}" (expected format like "C4", "Eb4", "F#3")`);
  }
  const [, noteWithAccidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitone = NOTE_ACCIDENTAL_OFFSETS[noteWithAccidental];
  if (semitone === undefined) {
    throw new Error(`Unknown note name: "${noteWithAccidental}"`);
  }
  // MIDI: C4 = 60, C0 = 12, C-1 = 0
  return (octave + 1) * 12 + semitone;
}


/**
 * Converts a MIDI note number to a pitch name string (e.g. 60 → "C4", 63 → "Eb4" or "D#4").
 * Uses sharps or flats depending on accidentalMode.
 */
export function midiToPitchName(
  midi: number,
  accidentalMode: AccidentalMode = 'sharps',
): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = accidentalMode === 'flats' ? PITCH_NAMES_FLATS : PITCH_NAMES_SHARPS;
  return `${names[noteIndex]}${octave}`;
}


/**
 * Resolves a solfège syllable + octave shift to an absolute pitch,
 * given a Knot's Do anchor.
 * 
 * In PPT, the octave is centered on Do spanning down to So (-5)
 * and up to Fi (+6):
 * - Ra through Fi (+1 to +6) are ascending from Do (sharp-side)
 * - Ti through So (-1 to -5) are descending from Do (flat-side)
 * - Octave shifts (^ / _) shift by ±12 semitones
 */
export function resolveAbsolutePitch(
  syllable: string,
  octaveShift: number,
  doMidi: number,
): number {
  const semitones = solfegeToNearestAddress(syllable);
  let midi = doMidi + semitones;
  midi += octaveShift * 12;
  return midi;
}


/**
 * Resolves an interval-mode solfège syllable to a signed semitone offset.
 * 
 * Uses nearest-address coordinates (-5 to +6) plus octave displacement.
 * In interval mode:
 * - Ra=+1, Re=+2, Me=+3, Mi=+4, Fa=+5, Fi=+6 (ascending/sharp-side)
 * - Ti=-1, Te=-2, La=-3, Le=-4, So=-5 (descending/flat-side)
 * - Octave marks extend beyond ±6: e.g. So^=+7 (ascending P5)
 */
export function resolveInterval(syllable: string, octaveShift: number): number {
  const nearestAddr = solfegeToNearestAddress(syllable);
  return nearestAddr + (octaveShift * 12);
}

/**
 * Maps a signed semitone interval (e.g. 0, +1, +2, -1, -5, +7, etc.)
 * back to its canonical Solfège interval token (e.g. 'Do', 'Ra', 'Re', 'Ti', 'So', 'So^', 'Fa_').
 */
export function semitoneIntervalToSolfege(semitones: number): string {
  const INTERVAL_MAP: Record<number, string> = {
    0: 'Do',
    1: 'Ra',
    2: 'Re',
    3: 'Me',
    4: 'Mi',
    5: 'Fa',
    6: 'Fi',
    [-1]: 'Ti',
    [-2]: 'Te',
    [-3]: 'La',
    [-4]: 'Le',
    [-5]: 'So',
  };

  if (INTERVAL_MAP[semitones] !== undefined) {
    return INTERVAL_MAP[semitones];
  }

  // Handle intervals outside -5..+6 by calculating nearest-address + octave displacement
  const mod = ((semitones % 12) + 12) % 12;
  const nearest = NEAREST_ADDRESS[mod];
  const oct = Math.round((semitones - nearest) / 12);
  const baseSyllable = INTERVAL_MAP[nearest] ?? 'Do';
  if (oct > 0) {
    return baseSyllable + '^'.repeat(oct);
  } else if (oct < 0) {
    return baseSyllable + '_'.repeat(-oct);
  }
  return baseSyllable;
}

/**
 * Builds a root-position major triad from a given root MIDI note.
 * Returns [root, major third, perfect fifth] as MIDI note numbers.
 */
export function buildMajorTriad(rootMidi: number): [number, number, number] {
  return [rootMidi, rootMidi + 4, rootMidi + 7];
}

export interface ParsedHarmonyModifier {
  syllable: string;
  hasAxis: boolean;
}

/**
 * Parsed representation of a harmony chord token.
 * E.g. "Do" (major triad), "DoMe" (minor triad), "SoxDo" (C/G slash chord / inversion), "MiexDo" (C/E), "MexDoMe" (Cm/Eb), "DoTe" (dominant 7th), "Dox", "DoxMe", "So^", "Do_"
 */
export interface ParsedHarmonyChord {
  /** Explicit bass syllable if an axis prefix is present (e.g. "So" in "SoxDo") */
  bassSyllable?: string;
  /** Octave shift on the bass note if specified (e.g. -1 for "So_xDo") */
  bassOctaveShift?: number;
  /** Whether an explicit axis bass prefix was specified (e.g. "Sox" in "SoxDo") */
  hasAxisBass?: boolean;
  /** The chord root syllable (e.g. "Do" in "DoMe" or "Do" in "SoxDo") */
  rootSyllable: string;
  /** Whether the chord root has an axis marker */
  hasAxis: boolean;
  modifiers: ParsedHarmonyModifier[];
  octaveShift: number;
  quality: 'major' | 'minor' | 'dominant7' | 'minor7' | 'diminished' | 'augmented' | 'custom';
}

export interface SolfegeGlyphSpec {
  canonicalSyllable: string;
  glyphType: 'base' | 'sharp' | 'flat';
  rotation: 0 | 90 | 180 | 270;
  colorHex: string;
  colorSchemeVar: string;
  hasAxis: boolean;
}

export const SOLFEGE_GLYPH_MAP: Record<string, Omit<SolfegeGlyphSpec, 'hasAxis' | 'canonicalSyllable'>> = {
  Do: { glyphType: 'base', rotation: 0, colorHex: '#E13610', colorSchemeVar: 'colorDo' },
  Ra: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016', colorSchemeVar: 'colorRe' },
  Di: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016', colorSchemeVar: 'colorRe' },
  Re: { glyphType: 'flat', rotation: 270, colorHex: '#F98016', colorSchemeVar: 'colorRe' },
  Me: { glyphType: 'base', rotation: 270, colorHex: '#F5D432', colorSchemeVar: 'colorMi' },
  Ri: { glyphType: 'base', rotation: 270, colorHex: '#F5D432', colorSchemeVar: 'colorMi' },
  Mi: { glyphType: 'sharp', rotation: 270, colorHex: '#F5D432', colorSchemeVar: 'colorMi' },
  Fa: { glyphType: 'flat', rotation: 180, colorHex: '#43A440', colorSchemeVar: 'colorFa' },
  Fi: { glyphType: 'base', rotation: 180, colorHex: '#141414', colorSchemeVar: 'colorFi' },
  Se: { glyphType: 'base', rotation: 180, colorHex: '#141414', colorSchemeVar: 'colorFi' },
  So: { glyphType: 'sharp', rotation: 180, colorHex: '#0032A4', colorSchemeVar: 'colorSo' },
  Le: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4', colorSchemeVar: 'colorLa' },
  Si: { glyphType: 'flat', rotation: 90, colorHex: '#5300A4', colorSchemeVar: 'colorLa' },
  La: { glyphType: 'base', rotation: 90, colorHex: '#5300A4', colorSchemeVar: 'colorLa' },
  Te: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4', colorSchemeVar: 'colorTi' },
  Li: { glyphType: 'sharp', rotation: 90, colorHex: '#F158A4', colorSchemeVar: 'colorTi' },
  Ti: { glyphType: 'flat', rotation: 0, colorHex: '#F158A4', colorSchemeVar: 'colorTi' },
};

export function getSolfegeGlyphSpec(syllable: string, hasAxis: boolean = false): SolfegeGlyphSpec {
  const spec = SOLFEGE_GLYPH_MAP[syllable];
  if (!spec) {
    throw new Error(`Unknown solfège syllable for glyph spec: "${syllable}"`);
  }
  return {
    canonicalSyllable: syllable,
    glyphType: spec.glyphType,
    rotation: spec.rotation,
    colorHex: spec.colorHex,
    colorSchemeVar: spec.colorSchemeVar,
    hasAxis,
  };
}

/**
 * Parses a harmony chord token like "Do", "DoMe", "So", "DoTe", "Dox", "DoxMe", "So^", "Do_",
 * or with Axis Bass prefix like "SoxDo" (C/G), "MiexDo" (C/E), "MexDoMe" (Cm/Eb), "RexSo" (G/D).
 */
export function parseHarmonyChord(token: string): ParsedHarmonyChord {
  let remaining = token;
  let octaveShift = 0;
  while (remaining.endsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(0, -1);
  }
  while (remaining.endsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(0, -1);
  }

  // 1. Check for Axis Bass prefix: (BassSyllable)(octave?)x(RootSyllable)(x?)(modifiers...)
  // E.g. "SoxDo", "MixDo", "MiexDo", "MexDoMe", "So_xDo", "DoxDo", "RexSo"
  const bassPrefixMatch = remaining.match(
    /^(Do|Ra|Di|Re|Me|Ri|Mi|Mie|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)([\^_]*)x(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)(.*)$/
  );

  let bassSyllable: string | undefined;
  let bassOctaveShift = 0;
  let hasAxisBass = false;
  let rootSyllable: string;
  let hasAxis = false;
  let rest = '';

  const isModifierOnly = (firstSyl: string, secondSyl: string) => {
    return firstSyl === 'Do' && ['Me', 'Ri', 'Te', 'Li', 'Fi', 'Se'].includes(secondSyl);
  };

  if (bassPrefixMatch && (bassPrefixMatch[5] !== '' || !isModifierOnly(bassPrefixMatch[1], bassPrefixMatch[3]))) {
    let rawBass = bassPrefixMatch[1];
    if (rawBass === 'Mie') rawBass = 'Mi';
    bassSyllable = rawBass;
    const bassOctStr = bassPrefixMatch[2];
    for (const ch of bassOctStr) {
      if (ch === '^') bassOctaveShift++;
      else if (ch === '_') bassOctaveShift--;
    }
    hasAxisBass = true;
    rootSyllable = bassPrefixMatch[3];
    hasAxis = bassPrefixMatch[4] === 'x';
    rest = bassPrefixMatch[5];
  } else {
    // 2. Standard chord without axis bass prefix
    const match = remaining.match(/^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)(.*)$/);
    if (!match) {
      throw new Error(`Invalid harmony chord token: "${token}"`);
    }
    rootSyllable = match[1];
    hasAxis = match[2] === 'x';
    rest = match[3];
  }

  // Extract modifier syllables (e.g. "Me", "Te", "Mex", "Te", "MeTe")
  const modifiers: ParsedHarmonyModifier[] = [];
  const modifierRegex = /(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)/g;
  let modMatch: RegExpExecArray | null;
  while ((modMatch = modifierRegex.exec(rest)) !== null) {
    modifiers.push({
      syllable: modMatch[1],
      hasAxis: modMatch[2] === 'x',
    });
  }

  let quality: ParsedHarmonyChord['quality'] = 'major';
  const hasMe = modifiers.some(m => m.syllable === 'Me' || m.syllable === 'Ri');
  const hasTe = modifiers.some(m => m.syllable === 'Te' || m.syllable === 'Li');
  const hasFi = modifiers.some(m => m.syllable === 'Fi' || m.syllable === 'Se');

  if (hasMe && hasTe) {
    quality = 'minor7';
  } else if (hasMe) {
    quality = 'minor';
  } else if (hasTe) {
    quality = 'dominant7';
  } else if (hasFi) {
    quality = 'diminished';
  }

  const result: ParsedHarmonyChord = {
    rootSyllable,
    hasAxis,
    modifiers,
    octaveShift,
    quality,
  };

  if (hasAxisBass) {
    result.hasAxisBass = true;
    result.bassSyllable = bassSyllable;
    if (bassOctaveShift !== 0) {
      result.bassOctaveShift = bassOctaveShift;
    }
  }

  return result;
}

/**
 * Builds chord tones (MIDI notes) for a harmony token relative to root MIDI.
 * Default is a major triad [root, root+4, root+7].
 * If minor (e.g. "DoMe"), builds [root, root+3, root+7].
 * If an Axis Bass prefix is specified (e.g. "SoxDo"), includes the bass pitch voiced at the bottom.
 * Applies any octave shifts (^ or _) from the token.
 */
export function buildChordFromToken(rootMidi: number, chordToken: string, knotDoMidi?: number): number[] {
  const parsed = parseHarmonyChord(chordToken);
  const shiftedRoot = rootMidi + (parsed.octaveShift * 12);
  
  let upperTones: number[] = [];
  if (parsed.quality === 'minor') {
    upperTones = [shiftedRoot, shiftedRoot + 3, shiftedRoot + 7];
  } else if (parsed.quality === 'minor7') {
    upperTones = [shiftedRoot, shiftedRoot + 3, shiftedRoot + 7, shiftedRoot + 10];
  } else if (parsed.quality === 'dominant7') {
    upperTones = [shiftedRoot, shiftedRoot + 4, shiftedRoot + 7, shiftedRoot + 10];
  } else if (parsed.quality === 'diminished') {
    upperTones = [shiftedRoot, shiftedRoot + 3, shiftedRoot + 6];
  } else {
    upperTones = [shiftedRoot, shiftedRoot + 4, shiftedRoot + 7];
  }

  if (parsed.hasAxisBass && parsed.bassSyllable) {
    const doRef = knotDoMidi !== undefined ? knotDoMidi : (rootMidi - solfegeToHarmonyRootOffset(parsed.rootSyllable));
    const bassOffset = solfegeToHarmonyRootOffset(parsed.bassSyllable);
    const bassPc = ((bassOffset % 12) + 12) % 12;
    const chordPcs = upperTones.map(t => ((t % 12) + 12) % 12);

    const invIndex = chordPcs.indexOf(bassPc);

    if (invIndex !== -1) {
      // Inversion: revoice the existing chord tones starting from the bass note
      const rotatedPcs = [...chordPcs.slice(invIndex), ...chordPcs.slice(0, invIndex)];
      
      let baseBassMidi = shiftedRoot + ((bassPc - chordPcs[0] + 12) % 12);
      if (invIndex > 1) {
        // 2nd inversion or higher: drop bass octave so it stays within normal triad span
        baseBassMidi -= 12;
      }
      if (parsed.bassOctaveShift) {
        baseBassMidi += parsed.bassOctaveShift * 12;
      }

      const invertedChord: number[] = [baseBassMidi];
      for (let i = 1; i < rotatedPcs.length; i++) {
        const diff = ((rotatedPcs[i] - bassPc) % 12 + 12) % 12;
        invertedChord.push(baseBassMidi + diff);
      }
      return invertedChord;
    } else {
      // Non-chord tone slash bass: add bass note below upper chord tones
      let bassMidi = doRef + bassOffset + ((parsed.bassOctaveShift ?? 0) * 12);
      while (bassMidi >= upperTones[0]) {
        bassMidi -= 12;
      }
      return [bassMidi, ...upperTones];
    }
  }

  return upperTones;
}

/**
 * Calculates the primary solfège scale degree of a MIDI pitch relative to Do (tonic).
 * 
 * @param midi - The concrete MIDI pitch
 * @param doMidi - The concrete MIDI pitch of Do
 * @returns The canonical solfège scale degree syllable (e.g. "Do", "Ra", "Re", "Me", "Mi", "Fa", "Fi", "So", "Le", "La", "Te", "Ti")
 */
export function getScaleDegreeFromDo(midi: number, doMidi: number): string {
  const semitoneOffset = ((midi - doMidi) % 12 + 12) % 12;
  return SOLFEGE_POSITIONS[semitoneOffset];
}




