/**
 * Pitch conversion module for LilyPond absolute pitch notation.
 * 
 * In LilyPond default (Dutch notation):
 * - Note names: c, d, e, f, g, a, b
 * - Sharps: cis, dis, eis, fis, gis, ais, bis
 * - Octave 3 (MIDI 48-59, small octave): c, d, e, f, g, a, b (no ticks)
 * - Octave 4 (MIDI 60-71, one-line octave): c', d', e', f', g', a', b' (Middle C = c')
 * - Octave 5 (MIDI 72-83, two-line octave): c'', d'', ...
 * - Octave 2 (MIDI 36-47, great octave): c,, d,, ...
 */

const LILYPOND_SHARP_NOTES = [
  'c',   // 0: C
  'cis', // 1: C#
  'd',   // 2: D
  'dis', // 3: D#
  'e',   // 4: E
  'f',   // 5: F
  'fis', // 6: F#
  'g',   // 7: G
  'gis', // 8: G#
  'a',   // 9: A
  'ais', // 10: A#
  'b',   // 11: B
] as const;

const LILYPOND_FLAT_NOTES = [
  'c',   // 0: C
  'des', // 1: Db
  'd',   // 2: D
  'ees', // 3: Eb
  'e',   // 4: E
  'f',   // 5: F
  'ges', // 6: Gb
  'g',   // 7: G
  'aes', // 8: Ab
  'a',   // 9: A
  'bes', // 10: Bb
  'b',   // 11: B
] as const;

/**
 * Converts a MIDI note number to LilyPond absolute pitch syntax.
 * 
 * Examples (sharps):
 * - 60 (C4)  -> "c'"
 * - 63 (D#4) -> "dis'"
 * - 67 (G4)  -> "g'"
 * 
 * Examples (flats):
 * - 63 (Eb4) -> "ees'"
 * - 70 (Bb4) -> "bes'"
 * - 68 (Ab4) -> "aes'"
 * 
 * @param midi - MIDI note number (0-127)
 * @param accidentalMode - 'sharps' or 'flats' (default: 'sharps')
 * @returns LilyPond pitch token
 */
export function midiToLilyPondPitch(
  midi: number,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const baseNote = accidentalMode === 'flats'
    ? LILYPOND_FLAT_NOTES[noteIndex]
    : LILYPOND_SHARP_NOTES[noteIndex];
  
  // LilyPond reference octave is Octave 3 (MIDI 48-59 -> 0 ticks)
  // Octave 4 (MIDI 60-71) has 1 tick (')
  // Octave 2 (MIDI 36-47) has 1 comma (,)
  const octave = Math.floor(midi / 12) - 1; // e.g. 60 -> 4, 48 -> 3
  const octaveDiff = octave - 3;
  
  if (octaveDiff > 0) {
    return `${baseNote}${`'`.repeat(octaveDiff)}`;
  } else if (octaveDiff < 0) {
    return `${baseNote}${`,`.repeat(Math.abs(octaveDiff))}`;
  }
  
  return baseNote;
}

/**
 * Formats a chord into a LilyPond chord token `<pitch1 pitch2 ...>`.
 * 
 * @param chordMidi - Array of MIDI note numbers
 * @param octaveShift - Optional octave transposition (e.g. -1 to place in bass register for PianoStaff)
 * @param accidentalMode - 'sharps' or 'flats' (default: 'sharps')
 * @returns Formatted LilyPond chord token, e.g. "<c e g>" or "<ees' g' bes'>"
 */
export function chordMidiToLilyPond(
  chordMidi: number[],
  octaveShift: number = 0,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
): string {
  const shifted = chordMidi.map(m => m + octaveShift * 12);
  const notes = shifted.map(m => midiToLilyPondPitch(m, accidentalMode)).join(' ');
  return `<${notes}>`;
}

/**
 * Converts a chord root MIDI note + quality into a LilyPond chordmode token.
 * E.g. (69, 'minor', '4', 'sharps') -> "a4:m"
 * E.g. (63, 'major', '4', 'flats')  -> "ees4"
 * E.g. (67, 'dominant7', '4', 'sharps') -> "g4:7"
 * E.g. (71, 'diminished', '4', 'sharps') -> "b4:dim"
 */
export function chordToLilyPondChordMode(
  rootMidi: number,
  quality: string = 'major',
  durationToken: string = '4',
  accidentalMode: 'sharps' | 'flats' = 'sharps',
): string {
  const noteIndex = ((rootMidi % 12) + 12) % 12;
  const baseNote = accidentalMode === 'flats'
    ? LILYPOND_FLAT_NOTES[noteIndex]
    : LILYPOND_SHARP_NOTES[noteIndex];

  let qualitySuffix = '';
  if (quality === 'minor') {
    qualitySuffix = ':m';
  } else if (quality === 'minor7') {
    qualitySuffix = ':m7';
  } else if (quality === 'dominant7') {
    qualitySuffix = ':7';
  } else if (quality === 'diminished') {
    qualitySuffix = ':dim';
  } else if (quality === 'augmented') {
    qualitySuffix = ':aug';
  }

  return `${baseNote}${durationToken}${qualitySuffix}`;
}



