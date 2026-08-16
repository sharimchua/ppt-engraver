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
const SOLFEGE_TO_SEMITONE: Record<string, number> = {
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
  /** Accidental spelling preference ('sharps' or 'flats') */
  accidentalMode?: AccidentalMode;
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
 * Automatically fits a root MIDI pitch into the optimal staff register for readability.
 * - For treble clef, places the root so the triad sits comfortably within the 5 staff lines (A3..G5).
 * - For bass clef, places the root so the triad sits within the bass staff lines (A1..G4).
 * 
 * This dynamically adapts to whatever pitch Do is (C4, Eb4, A4, etc.) so chord voicings
 * automatically maintain their block placement across the staff without ledger lines.
 */
export function fitRootToClefRegister(
  rootMidi: number,
  clef: 'treble' | 'bass' = 'treble',
): number {
  const minRoot = clef === 'bass' ? 36 : 57; // C2 for bass, A3 for treble
  const maxTopNote = clef === 'bass' ? 60 : 79; // C4 for bass, G5 for treble

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
 * Builds a root-position major triad from a given root MIDI note.
 * Returns [root, major third, perfect fifth] as MIDI note numbers.
 */
export function buildMajorTriad(rootMidi: number): [number, number, number] {
  return [rootMidi, rootMidi + 4, rootMidi + 7];
}

/**
 * Parsed representation of a harmony chord token.
 * E.g. "Do" (major triad), "DoMe" (minor triad), "DoTe" (dominant 7th), "So^", "Do_"
 */
export interface ParsedHarmonyChord {
  rootSyllable: string;
  modifiers: string[];
  octaveShift: number;
  quality: 'major' | 'minor' | 'dominant7' | 'minor7' | 'diminished' | 'augmented' | 'custom';
}

/**
 * Parses a harmony chord token like "Do", "DoMe", "So", "DoTe", "So^", "Do_".
 * The first solfège syllable is the root; trailing solfège syllables are modifiers;
 * trailing ^/_ are octave shifts.
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

  const match = remaining.match(/^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(.*)$/);
  if (!match) {
    throw new Error(`Invalid harmony chord token: "${token}"`);
  }
  const rootSyllable = match[1];
  const rest = match[2];
  
  // Extract modifier syllables (e.g. "Me", "Te", "MeTe")
  const modifierMatches = rest.match(/(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)/g) ?? [];
  
  let quality: ParsedHarmonyChord['quality'] = 'major';
  const hasMe = modifierMatches.some(m => m === 'Me' || m === 'Ri');
  const hasTe = modifierMatches.some(m => m === 'Te' || m === 'Li');
  const hasFi = modifierMatches.some(m => m === 'Fi' || m === 'Se');

  if (hasMe && hasTe) {
    quality = 'minor7';
  } else if (hasMe) {
    quality = 'minor';
  } else if (hasTe) {
    quality = 'dominant7';
  } else if (hasFi) {
    quality = 'diminished';
  }

  return { rootSyllable, modifiers: modifierMatches, octaveShift, quality };
}

/**
 * Builds chord tones (MIDI notes) for a harmony token relative to root MIDI.
 * Default is a major triad [root, root+4, root+7].
 * If minor (e.g. "DoMe"), builds [root, root+3, root+7].
 * Applies any octave shifts (^ or _) from the token.
 */
export function buildChordFromToken(rootMidi: number, chordToken: string): number[] {
  const parsed = parseHarmonyChord(chordToken);
  const shiftedRoot = rootMidi + (parsed.octaveShift * 12);
  if (parsed.quality === 'minor') {
    return [shiftedRoot, shiftedRoot + 3, shiftedRoot + 7];
  } else if (parsed.quality === 'minor7') {
    return [shiftedRoot, shiftedRoot + 3, shiftedRoot + 7, shiftedRoot + 10];
  } else if (parsed.quality === 'dominant7') {
    return [shiftedRoot, shiftedRoot + 4, shiftedRoot + 7, shiftedRoot + 10];
  } else if (parsed.quality === 'diminished') {
    return [shiftedRoot, shiftedRoot + 3, shiftedRoot + 6];
  }
  return [shiftedRoot, shiftedRoot + 4, shiftedRoot + 7];
}


