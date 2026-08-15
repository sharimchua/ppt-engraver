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

const LILYPOND_BASE_NOTES = [
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

/**
 * Converts a MIDI note number to LilyPond absolute pitch syntax.
 * 
 * Examples:
 * - 60 (C4)  -> "c'"
 * - 64 (E4)  -> "e'"
 * - 67 (G4)  -> "g'"
 * - 72 (C5)  -> "c''"
 * - 71 (B4)  -> "b'"
 * - 48 (C3)  -> "c"
 * - 55 (G3)  -> "g"
 * - 62 (D4)  -> "d'"
 * - 54 (F#3) -> "fis"
 * 
 * @param midi - MIDI note number (0-127)
 * @returns LilyPond pitch token
 */
export function midiToLilyPondPitch(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const baseNote = LILYPOND_BASE_NOTES[noteIndex];
  
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
 * Formats a triad chord into a LilyPond chord token `<pitch1 pitch2 pitch3>`.
 * 
 * @param triadMidi - Array of 3 MIDI note numbers [root, third, fifth]
 * @param octaveShift - Optional octave transposition (e.g. -1 to place in bass register for PianoStaff)
 * @returns Formatted LilyPond chord token, e.g. "<c e g>" or "<g b d'>"
 */
export function chordMidiToLilyPond(
  triadMidi: [number, number, number],
  octaveShift: number = 0,
): string {
  const shifted = triadMidi.map(m => m + octaveShift * 12);
  const notes = shifted.map(m => midiToLilyPondPitch(m)).join(' ');
  return `<${notes}>`;
}
