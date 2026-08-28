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
  /** Identifier of the knot (e.g. "default", "leadSheet") */
  id?: string;
  /** Human-readable display label/name for the knot */
  name?: string;
  /** Whether this knot is an abstract template excluded from dropdown selection (does NOT get inherited) */
  abstract?: boolean;
  /** Alias for abstract (does NOT get inherited) */
  hidden?: boolean;
  /** Explicit visibility toggle (does NOT get inherited) */
  visible?: boolean;
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
  /** Whether to show the guitar tablature staff */
  showGuitarTab?: boolean;
  /** Guitar tablature movement priority ('vertical' | 'horizontal') */
  guitarTabMovement?: 'vertical' | 'horizontal';
  /** Phrasing solver scope ('coil' | 'continuous') */
  guitarTabScope?: 'coil' | 'continuous';
  /** Guitar tablature voicing style */
  guitarVoicing?: 'melodyOnly' | 'root' | 'triad' | 'shell' | 'chordMelody' | 'rootChordTones' | 'guideTones' | 'bassAndMelody' | 'auto';
  /** Maximum allowable fret distance between simultaneous fretted notes (default: 4) */
  maximumFretSpan?: number;
  /** Alias for maximumFretSpan */
  maxFretSpan?: number;
  /** Custom guitar tuning string */
  guitarTuning?: string;
  /** Tablature notehead styling: 'ppt' (geometric shapes) | 'numbersOnly' | 'default' */
  tabStaffStyle?: 'ppt' | 'numbersOnly' | 'default';
  /** Whether to show the melody staff */
  showMelody?: boolean;
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute?: boolean;
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval?: boolean;
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil?: boolean;
  /** Whether to show the Pulse / Metric Coil row layer (displays Solfège metric pulse glyphs with 'P' clef) */
  showPulseCoil?: boolean;
  /** Whether to show the time signature on the traditional notation staff */
  showTimeSignature?: boolean;
  /** Custom time signature or metric grammar label override (e.g. "4/4", "3/4", "6/8") */
  timeSignature?: string;
  /** Whether to show the PPT pulse signature in the score header next to key anchor */
  showPulseSignature?: boolean;
  /** Custom pulse signature label override for the score header (e.g. "DoLa", "DoRe", "[Dox, Re, So]") */
  pulseSignature?: string;
  /** Metric pulse grammar specification for knot */
  pulse?: string | string[];
  /** Alias for pulse */
  meter?: string | string[];
  /** Whether to annotate rhythm grid lines with geometric Solfège notehead symbols */
  gridSymbols?: boolean | 'all' | 'no-do' | 'off';
  /** Whether to exclude circle symbol on Do/downbeats when annotating rhythm grid */
  excludeGridDoSymbol?: boolean;
  /** Whether to draw heavier / darker grid lines on strong beats (Do/Dix) */
  strongBeatGridWeight?: boolean;
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

export type HarmonyChordQuality =
  | 'major'
  | 'minor'
  | 'dominant7'
  | 'minor7'
  | 'major7'
  | 'minorMajor7'
  | 'diminished'
  | 'diminished7'
  | 'halfDiminished7'
  | 'augmented'
  | 'sus4'
  | 'sus2'
  | '7sus4'
  | 'major6'
  | 'minor6'
  | 'fifth'
  | 'dominant9'
  | 'major9'
  | 'minor9'
  | 'add9'
  | 'dominant11'
  | 'minor11'
  | 'dominant13'
  | 'major13'
  | 'minor13'
  | 'dominant7b9'
  | 'dominant7sharp9'
  | 'dominant7sharp11'
  | 'major7sharp11'
  | 'dominant7b13'
  | 'custom';

/**
 * Builds close tertian chord tones (in semitones relative to root) based on chord quality.
 */
export function getChordIntervals(quality: string): number[] {
  switch (quality) {
    case 'fifth':
    case 'power':
      return [0, 7];
    case 'minor':
      return [0, 3, 7];
    case 'minor7':
      return [0, 3, 7, 10];
    case 'dominant7':
      return [0, 4, 7, 10];
    case 'major7':
      return [0, 4, 7, 11];
    case 'minorMajor7':
      return [0, 3, 7, 11];
    case 'diminished':
      return [0, 3, 6];
    case 'diminished7':
      return [0, 3, 6, 9];
    case 'halfDiminished7':
      return [0, 3, 6, 10];
    case 'augmented':
      return [0, 4, 8];
    case 'sus4':
      return [0, 5, 7];
    case 'sus2':
      return [0, 2, 7];
    case '7sus4':
      return [0, 5, 7, 10];
    case 'major6':
      return [0, 4, 7, 9];
    case 'minor6':
      return [0, 3, 7, 9];
    case 'dominant9':
      return [0, 4, 7, 10, 14];
    case 'major9':
      return [0, 4, 7, 11, 14];
    case 'minor9':
      return [0, 3, 7, 10, 14];
    case 'add9':
      return [0, 4, 7, 14];
    case 'dominant11':
      return [0, 7, 10, 14, 17];
    case 'minor11':
      return [0, 3, 7, 10, 14, 17];
    case 'dominant13':
      return [0, 4, 7, 10, 14, 21];
    case 'major13':
      return [0, 4, 7, 11, 14, 21];
    case 'minor13':
      return [0, 3, 7, 10, 14, 21];
    case 'dominant7b9':
      return [0, 4, 7, 10, 13];
    case 'dominant7sharp9':
      return [0, 4, 7, 10, 15];
    case 'dominant7sharp11':
      return [0, 4, 7, 10, 18];
    case 'major7sharp11':
      return [0, 4, 7, 11, 18];
    case 'dominant7b13':
      return [0, 4, 8, 10];
    case 'major':
    default:
      return [0, 4, 7];
  }
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
  quality: HarmonyChordQuality;
}

export interface SolfegeGlyphSpec {
  canonicalSyllable: string;
  glyphType: 'base' | 'sharp' | 'flat';
  rotation: 0 | 90 | 180 | 270;
  colorHex: string;
  colorSchemeVar: string;
  hasAxis: boolean;
  octaveShift: number;
}

export const SOLFEGE_GLYPH_MAP: Record<string, Omit<SolfegeGlyphSpec, 'hasAxis' | 'canonicalSyllable' | 'octaveShift'>> = {
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

export function getSolfegeGlyphSpec(
  syllable: string,
  hasAxis: boolean = false,
  octaveShift: number = 0,
): SolfegeGlyphSpec {
  let cleanSyllable = syllable;
  let parsedOctave = octaveShift;
  if (parsedOctave === 0 && (cleanSyllable.includes('^') || cleanSyllable.includes('_'))) {
    for (const ch of cleanSyllable) {
      if (ch === '^') parsedOctave++;
      else if (ch === '_') parsedOctave--;
    }
  }
  cleanSyllable = cleanSyllable.replace(/[\^_xX]/g, '');

  const spec = SOLFEGE_GLYPH_MAP[cleanSyllable];
  if (!spec) {
    throw new Error(`Unknown solfège syllable for glyph spec: "${syllable}"`);
  }
  return {
    canonicalSyllable: cleanSyllable,
    glyphType: spec.glyphType,
    rotation: spec.rotation,
    colorHex: spec.colorHex,
    colorSchemeVar: spec.colorSchemeVar,
    hasAxis,
    octaveShift: parsedOctave,
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

  const hasRa = modifiers.some(m => m.syllable === 'Ra' || m.syllable === 'Di');
  const hasRe = modifiers.some(m => m.syllable === 'Re');
  const hasMe = modifiers.some(m => m.syllable === 'Me' || m.syllable === 'Ri');
  const hasRi = modifiers.some(m => m.syllable === 'Ri');
  const hasMi = modifiers.some(m => m.syllable === 'Mi');
  const hasFa = modifiers.some(m => m.syllable === 'Fa');
  const hasFi = modifiers.some(m => m.syllable === 'Fi' || m.syllable === 'Se');
  const hasSo = modifiers.some(m => m.syllable === 'So');
  const hasLe = modifiers.some(m => m.syllable === 'Le' || m.syllable === 'Si');
  const hasLa = modifiers.some(m => m.syllable === 'La');
  const hasTe = modifiers.some(m => m.syllable === 'Te' || m.syllable === 'Li');
  const hasTi = modifiers.some(m => m.syllable === 'Ti');

  let quality: HarmonyChordQuality = 'major';

  // 1. Alterations with Dominant/Major 7th
  if (hasTe && hasRa) {
    quality = 'dominant7b9';
  } else if (hasTe && (hasRi || (hasMe && hasMi))) {
    quality = 'dominant7sharp9';
  } else if (hasTe && hasFi && !hasMe) {
    quality = 'dominant7sharp11';
  } else if (hasTi && hasFi) {
    quality = 'major7sharp11';
  } else if (hasTe && hasLe) {
    quality = 'dominant7b13';
  }
  // 2. Extended 13th, 11th, 9th chords
  else if (hasMe && hasTe && hasLa) {
    quality = 'minor13';
  } else if (hasTi && hasLa) {
    quality = 'major13';
  } else if (hasTe && hasLa) {
    quality = 'dominant13';
  } else if (hasMe && hasTe && hasFa) {
    quality = 'minor11';
  } else if (hasTe && hasFa && hasRe) {
    quality = 'dominant11';
  } else if (hasMe && hasTe && hasRe) {
    quality = 'minor9';
  } else if (hasTi && hasRe) {
    quality = 'major9';
  } else if (hasTe && hasRe) {
    quality = 'dominant9';
  } else if (hasMi && hasRe) {
    quality = 'add9';
  }
  // 3. Diminished & Half-Diminished chords
  else if (hasFi && hasLa) {
    quality = 'diminished7';
  } else if (hasFi && hasTe) {
    quality = 'halfDiminished7';
  } else if (hasFi) {
    quality = 'diminished';
  }
  // 4. Standard 7ths & 6ths
  else if (hasMe && hasTi) {
    quality = 'minorMajor7';
  } else if (hasMe && hasTe) {
    quality = 'minor7';
  } else if (hasMe && hasLa) {
    quality = 'minor6';
  } else if (hasFa && hasTe) {
    quality = '7sus4';
  } else if (hasTi) {
    quality = 'major7';
  } else if (hasTe) {
    quality = 'dominant7';
  } else if (hasLa) {
    quality = 'major6';
  }
  // 5. Triads, Sus & 5th Power Chords
  else if (hasMe) {
    quality = 'minor';
  } else if (hasFa) {
    quality = 'sus4';
  } else if (hasRe) {
    quality = 'sus2';
  } else if (hasLe) {
    quality = 'augmented';
  } else if (hasSo) {
    quality = 'fifth';
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
 * Uses getChordIntervals based on parsed chord quality.
 * If an Axis Bass prefix is specified (e.g. "SoxDo"), includes the bass pitch voiced at the bottom.
 * Applies any octave shifts (^ or _) from the token.
 */
export function buildChordFromToken(rootMidi: number, chordToken: string, knotDoMidi?: number): number[] {
  const parsed = parseHarmonyChord(chordToken);
  const shiftedRoot = rootMidi + (parsed.octaveShift * 12);
  const intervals = getChordIntervals(parsed.quality);
  const upperTones = intervals.map(i => shiftedRoot + i);

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

/**
 * Standard mode degree offsets relative to Do (Ionian).
 */
export const MODE_DEGREE_OFFSETS: Record<string, { degree: string; semitones: number; label: string }> = {
  ionian: { degree: 'Do', semitones: 0, label: 'Ionian (Major / Do)' },
  dorian: { degree: 'Re', semitones: 2, label: 'Dorian (Re / +2 st)' },
  phrygian: { degree: 'Me', semitones: 3, label: 'Phrygian (Me / +3 st)' },
  lydian: { degree: 'Fa', semitones: 5, label: 'Lydian (Fa / +5 st)' },
  mixolydian: { degree: 'So', semitones: 7, label: 'Mixolydian (So / +7 st)' },
  aeolian: { degree: 'La', semitones: 9, label: 'Aeolian (Natural Minor / La / -3 st)' },
  locrian: { degree: 'Ti', semitones: 11, label: 'Locrian (Ti / -1 st)' },
};

/**
 * Calculates the signed semitone difference and MIDI values between old and new tonic strings.
 */
export function calculateTonicShift(
  oldTonicName: string,
  newTonicName: string,
): { semitones: number; oldMidi: number; newMidi: number } {
  const oldMidi = pitchNameToMidi(oldTonicName);
  const newMidi = pitchNameToMidi(newTonicName);
  // Shift needed to preserve pitch when tonic changes: oldMidi - newMidi
  return {
    semitones: oldMidi - newMidi,
    oldMidi,
    newMidi,
  };
}

export const BASE_OCTAVE_SYLLABLES: Record<number, string> = {
  [-5]: 'So',
  [-4]: 'Le',
  [-3]: 'La',
  [-2]: 'Te',
  [-1]: 'Ti',
  0: 'Do',
  1: 'Ra',
  2: 'Re',
  3: 'Me',
  4: 'Mi',
  5: 'Fa',
  6: 'Fi',
};

/**
 * Transposes a single solfège pitch token by a given semitone offset.
 * Preserves axis marker ('x') and octave displacement ('^' / '_').
 * 
 * In PPT:
 * Base octave runs from So (-5) to Fi (+6) centered on Do (0).
 */
export function transposeSolfegeToken(token: string, semitones: number): string {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return token;
  }

  // Check repeat syntax (e.g. 2 or 2.3)
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return token;
  }

  const match = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!match) {
    return token;
  }

  let syllable = match[1];
  const hasAxis = Boolean(match[2] || match[4] || syllable.toLowerCase().endsWith('x'));
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x')) {
    syllable = syllable.slice(0, -1);
  }

  const octStr = match[3] || '';
  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  const baseSemitone = solfegeToNearestAddress(syllable);
  const currentTotal = baseSemitone + (octShift * 12);
  const newTotal = currentTotal + semitones;

  // Convert back to base octave [-5, +6]
  const base = ((newTotal + 5) % 12 + 12) % 12 - 5;
  const newOct = Math.round((newTotal - base) / 12);

  const newBaseSyllable = BASE_OCTAVE_SYLLABLES[base] || 'Do';
  let result = newBaseSyllable;
  if (hasAxis) {
    result += 'x';
  }
  if (newOct > 0) {
    result += '^'.repeat(newOct);
  } else if (newOct < 0) {
    result += '_'.repeat(Math.abs(newOct));
  }

  return result;
}

/**
 * Transposes a harmony chord token (e.g. "DoMe", "SoTe", "SoxDo", "DoMe^") by a given semitone offset.
 * Transposes the root syllable and optional axis bass prefix while preserving quality modifiers.
 */
export function transposeHarmonyToken(token: string, semitones: number): string {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return token;
  }

  try {
    const parsed = parseHarmonyChord(clean);
    const transposedRoot = transposeSolfegeToken(parsed.rootSyllable, semitones);
    const cleanTransposedRoot = transposedRoot.replace(/[\^_x]/g, '');

    let result = '';

    if (parsed.hasAxisBass && parsed.bassSyllable) {
      const transposedBass = transposeSolfegeToken(parsed.bassSyllable, semitones);
      const cleanTransposedBass = transposedBass.replace(/[\^_x]/g, '');
      result += cleanTransposedBass;
      const bassOct = parsed.bassOctaveShift ?? 0;
      if (bassOct > 0) {
        result += '^'.repeat(bassOct);
      } else if (bassOct < 0) {
        result += '_'.repeat(Math.abs(bassOct));
      }
      result += 'x';
    }

    result += cleanTransposedRoot;
    if (parsed.hasAxis) {
      result += 'x';
    }

    // Attach quality modifiers (e.g. Me, Te, Ti, Fi)
    for (const mod of parsed.modifiers) {
      result += mod.syllable;
      if (mod.hasAxis) result += 'x';
    }

    if (parsed.octaveShift > 0) {
      result += '^'.repeat(parsed.octaveShift);
    } else if (parsed.octaveShift < 0) {
      result += '_'.repeat(Math.abs(parsed.octaveShift));
    }

    return result;
  } catch {
    return token;
  }
}

export interface ParsedMelodyToken {
  isRest?: boolean;
  isRepeat?: boolean;
  isUnknown?: boolean;
  repeatCount?: number;
  windowSize?: number;
  syllable?: string;
  hasAxis?: boolean;
  octaveShift?: number;
  baseSemitone?: number;
  raw: string;
}

/**
 * Parses a melody token with support for rests, repeat lookbacks, axis markers, and octave shifts.
 */
export function parseMelodyToken(token: string): ParsedMelodyToken {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return { isRest: true, raw: clean };
  }

  const repeat = parseRepeatSpec(clean);
  if (repeat !== null) {
    return {
      isRepeat: true,
      repeatCount: repeat.repeatCount,
      windowSize: repeat.windowSize,
      raw: clean,
    };
  }

  const m = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!m) {
    return { isUnknown: true, raw: clean };
  }

  let syllable = m[1];
  let hasAxis = Boolean(m[2] || m[4]);
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x') && !m[2] && !m[4]) {
    syllable = syllable.slice(0, -1);
    hasAxis = true;
  }

  const octStr = m[3] || '';
  let octaveShift = 0;
  for (const ch of octStr) {
    if (ch === '^') octaveShift++;
    else if (ch === '_') octaveShift--;
  }

  let baseSemitone: number | undefined;
  try {
    baseSemitone = solfegeToNearestAddress(syllable);
  } catch {
    return { isUnknown: true, raw: clean };
  }

  return {
    syllable,
    hasAxis,
    octaveShift,
    baseSemitone,
    raw: clean,
  };
}

/**
 * Converts a signed semitone offset from Do into a canonical PPT Solfège token.
 * Base octave runs from So (-5) to Fi (+6).
 */
export function semitonesToSolfege(semitones: number): string {
  const base = ((semitones + 5) % 12 + 12) % 12 - 5;
  const oct = Math.round((semitones - base) / 12);
  const baseName = BASE_OCTAVE_SYLLABLES[base] || 'Do';

  if (oct > 0) {
    return baseName + '^'.repeat(oct);
  } else if (oct < 0) {
    return baseName + '_'.repeat(-oct);
  }
  return baseName;
}

/**
 * Converts a melody token list authored in Interval mode (anchor notehead with axis 'x' + relative intervals)
 * into absolute chromatic scale degrees.
 */
export function convertIntervalToAbsoluteMelody(tokenList: string[]): string[] {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result: string[] = [];
  let currentOffset = 0;
  let hasAnchor = false;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown || parsed.baseSemitone === undefined) {
      result.push(rawTok);
      continue;
    }

    if (!hasAnchor) {
      currentOffset = parsed.baseSemitone + (parsed.octaveShift! * 12);
      result.push(semitonesToSolfege(currentOffset));
      hasAnchor = true;
    } else {
      const interval = parsed.baseSemitone + (parsed.octaveShift! * 12);
      currentOffset += interval;
      result.push(semitonesToSolfege(currentOffset));
    }
  }

  return result;
}

/**
 * Converts a melody token list authored in Absolute mode (chromatic scale degrees relative to Do)
 * into Interval mode (anchor notehead with axis 'x' + relative intervals).
 */
export function convertAbsoluteToIntervalMelody(tokenList: string[]): string[] {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result: string[] = [];
  let prevOffset: number | null = null;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown || parsed.baseSemitone === undefined) {
      result.push(rawTok);
      continue;
    }

    const currentOffset = parsed.baseSemitone + (parsed.octaveShift! * 12);

    if (prevOffset === null) {
      const absName = semitonesToSolfege(currentOffset);
      const withAxis = absName.replace(/^([a-zA-Z]+)([\^_]*)$/, '$1x$2');
      result.push(withAxis);
      prevOffset = currentOffset;
    } else {
      const diff = currentOffset - prevOffset;
      const intervalTok = semitonesToSolfege(diff);
      result.push(intervalTok);
      prevOffset = currentOffset;
    }
  }

  return result;
}

