/**
 * Scientific pitch and MIDI note to ABC notation pitch converter.
 * 
 * Standard ABC pitch mapping conventions:
 * - Octave 4 (Middle C): C D E F G A B
 * - Octave 5: c d e f g a b
 * - Octave 6+: c' c'' ...
 * - Octave 3: C, D, E, ...
 * - Octave 2-: C,, C,,, ...
 * - Accidentals: ^ (sharp), ^^ (double sharp), _ (flat), __ (double flat), = (natural)
 * - Rests: z
 */

/**
 * Converts a scientific pitch string (e.g. "C4", "F#3", "Bb5", "Db4") to an ABC pitch token.
 * 
 * @param pitch - Scientific pitch string or rest indicator
 * @param isRest - Whether this event represents a rest
 * @returns ABC pitch notation string (e.g. "C", "^F,", "_b")
 */
export function pitchToAbc(pitch?: string | null, isRest = false): string {
  if (isRest || !pitch || pitch.toLowerCase() === 'rest' || pitch.toLowerCase() === 'r') {
    return 'z';
  }

  const trimmed = pitch.trim();
  const match = trimmed.match(/^([A-Ga-g])([#b]*)(-?\d+)$/);
  if (!match) {
    // Fallback if formatting doesn't strictly match
    return trimmed;
  }

  const [, stepRaw, accidentalRaw, octaveRaw] = match;
  const step = stepRaw.toUpperCase();
  const octave = parseInt(octaveRaw, 10);

  // Convert accidentals
  let abcAccidental = '';
  for (const ch of accidentalRaw) {
    if (ch === '#') abcAccidental += '^';
    else if (ch === 'b') abcAccidental += '_';
  }

  // Determine base letter and octave marks
  let baseLetter = step;
  let octaveMarks = '';

  if (octave >= 5) {
    baseLetter = step.toLowerCase();
    const extraQuotes = octave - 5;
    octaveMarks = "'".repeat(Math.max(0, extraQuotes));
  } else if (octave === 4) {
    baseLetter = step.toUpperCase();
    octaveMarks = '';
  } else {
    baseLetter = step.toUpperCase();
    const commas = 4 - octave;
    octaveMarks = ','.repeat(Math.max(0, commas));
  }

  return `${abcAccidental}${baseLetter}${octaveMarks}`;
}

const PITCH_CLASSES_SHARP = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];
const PITCH_CLASSES_FLAT = ['C', '_D', 'D', '_E', 'E', 'F', '_G', 'G', '_A', 'A', '_B', 'B'];

/**
 * Converts a MIDI note number (0-127) to an ABC pitch token.
 * Middle C (MIDI 60) -> C (Octave 4).
 * 
 * @param midiNote - MIDI note integer
 * @param preferredAccidental - Prefer sharp '^' or flat '_' for accidentals
 */
export function midiToAbc(midiNote: number, preferredAccidental: 'sharp' | 'flat' = 'sharp'): string {
  if (midiNote < 0 || midiNote > 127) return 'z';
  
  const octave = Math.floor(midiNote / 12) - 1;
  const pc = midiNote % 12;
  const table = preferredAccidental === 'flat' ? PITCH_CLASSES_FLAT : PITCH_CLASSES_SHARP;
  const pcStr = table[pc];

  let accidental = '';
  let letter = pcStr;
  if (pcStr.startsWith('^') || pcStr.startsWith('_')) {
    accidental = pcStr[0];
    letter = pcStr[1];
  }

  if (octave >= 5) {
    letter = letter.toLowerCase();
    const quotes = octave - 5;
    return `${accidental}${letter}${"'".repeat(Math.max(0, quotes))}`;
  } else if (octave === 4) {
    return `${accidental}${letter}`;
  } else {
    const commas = 4 - octave;
    return `${accidental}${letter}${','.repeat(Math.max(0, commas))}`;
  }
}
