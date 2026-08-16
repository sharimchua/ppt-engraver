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

export const LILYPOND_SHARP_NOTES = [
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

export const LILYPOND_FLAT_NOTES = [
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
 * Maps chord root pitch-class + interval offset to the correct Dutch note name and nominal note class.
 */
interface ChordNoteSpelling {
  baseName: string;
  nominalNoteClass: number; // 0 for C, 2 for D, 4 for E, 5 for F, 7 for G, 9 for A, 11 for B
}

function getNominalNoteClass(baseName: string): number {
  const firstChar = baseName.charAt(0);
  switch (firstChar) {
    case 'c': return 0;
    case 'd': return 2;
    case 'e': return 4;
    case 'f': return 5;
    case 'g': return 7;
    case 'a': return 9;
    case 'b': return 11;
    default: return 0;
  }
}

function getTertianChordSpelling(
  rootPc: number,
  semitoneOffset: number,
  accidentalMode: 'sharps' | 'flats',
): ChordNoteSpelling {
  const normOffset = ((semitoneOffset % 12) + 12) % 12;

  // Root note spelling
  if (normOffset === 0) {
    const isFlat = accidentalMode === 'flats';
    const names = isFlat ? LILYPOND_FLAT_NOTES : LILYPOND_SHARP_NOTES;
    return {
      baseName: names[rootPc],
      nominalNoteClass: getNominalNoteClass(names[rootPc]),
    };
  }

  // B major / B minor chords (rootPc === 11)
  if (rootPc === 11) {
    if (normOffset === 4) return { baseName: 'dis', nominalNoteClass: 2 }; // D# in B major
    if (normOffset === 3) return { baseName: 'd', nominalNoteClass: 2 };   // D in B minor
    if (normOffset === 7) return { baseName: 'fis', nominalNoteClass: 5 }; // F# in B major/minor
    if (normOffset === 6) return { baseName: 'f', nominalNoteClass: 5 };   // F in B dim
    if (normOffset === 10) return { baseName: 'a', nominalNoteClass: 9 };  // A in B7
  }

  // Ab minor / Ab major chords (rootPc === 8, in flats mode)
  if (rootPc === 8 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'ces', nominalNoteClass: 0 }; // Cb in Ab minor
    if (normOffset === 4) return { baseName: 'c', nominalNoteClass: 0 };   // C in Ab major
    if (normOffset === 7) return { baseName: 'ees', nominalNoteClass: 4 }; // Eb in Ab major/minor
    if (normOffset === 10) return { baseName: 'ges', nominalNoteClass: 7 }; // Gb in Ab7
  }

  // Db major chords (rootPc === 1, in flats mode)
  if (rootPc === 1 && accidentalMode === 'flats') {
    if (normOffset === 4) return { baseName: 'f', nominalNoteClass: 5 };   // F in Db major
    if (normOffset === 7) return { baseName: 'aes', nominalNoteClass: 8 }; // Ab in Db major
    if (normOffset === 10) return { baseName: 'ces', nominalNoteClass: 0 }; // Cb in Db7
  }

  // Eb minor / Eb major chords (rootPc === 3, in flats mode)
  if (rootPc === 3 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'ges', nominalNoteClass: 7 }; // Gb in Eb minor
    if (normOffset === 4) return { baseName: 'g', nominalNoteClass: 7 };   // G in Eb major
    if (normOffset === 7) return { baseName: 'bes', nominalNoteClass: 11 }; // Bb in Eb major/minor
    if (normOffset === 10) return { baseName: 'des', nominalNoteClass: 2 }; // Db in Eb7
  }

  // Bb major / Bb minor chords (rootPc === 10, in flats mode)
  if (rootPc === 10 && accidentalMode === 'flats') {
    if (normOffset === 4) return { baseName: 'd', nominalNoteClass: 2 };   // D in Bb major
    if (normOffset === 3) return { baseName: 'des', nominalNoteClass: 2 }; // Db in Bb minor
    if (normOffset === 7) return { baseName: 'f', nominalNoteClass: 5 };   // F in Bb major/minor
    if (normOffset === 10) return { baseName: 'aes', nominalNoteClass: 8 }; // Ab in Bb7
  }

  // Default chromatic mapping
  const actualNotePc = (rootPc + normOffset) % 12;
  const isFlat = accidentalMode === 'flats';
  const names = isFlat ? LILYPOND_FLAT_NOTES : LILYPOND_SHARP_NOTES;
  const baseName = names[actualNotePc];
  return {
    baseName,
    nominalNoteClass: getNominalNoteClass(baseName),
  };
}

/**
 * Formats a chord note into LilyPond syntax with correct octave ticks.
 */
function formatChordNote(baseName: string, midi: number, nominalClass: number): string {
  // Octave calculation based on nominal note class (e.g. Cb4 = MIDI 59 -> octave 4 -> 1 tick)
  const octave = Math.floor((midi - nominalClass + 6) / 12) - 1;
  const octaveDiff = octave - 3;
  if (octaveDiff > 0) {
    return `${baseName}${`'`.repeat(octaveDiff)}`;
  } else if (octaveDiff < 0) {
    return `${baseName}${`,`.repeat(Math.abs(octaveDiff))}`;
  }
  return baseName;
}

/**
 * Formats a chord into a LilyPond chord token `<pitch1 pitch2 ...>` using
 * proper tertian harmonic spelling (e.g. <b dis' fis'> for B, <aes ces' ees'> for Abm).
 * 
 * @param chordMidi - Array of MIDI note numbers
 * @param octaveShift - Optional octave transposition
 * @param accidentalMode - 'sharps' or 'flats' (default: 'sharps')
 * @returns Formatted LilyPond chord token, e.g. "<c e g>" or "<ees' g' bes'>"
 */
export function chordMidiToLilyPond(
  chordMidi: number[],
  octaveShift: number = 0,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
): string {
  if (chordMidi.length === 0) return '<>';
  const rootMidi = chordMidi[0] + (octaveShift * 12);
  const rootPc = ((rootMidi % 12) + 12) % 12;

  const notes = chordMidi.map(m => {
    const shiftedMidi = m + (octaveShift * 12);
    const semitoneOffset = shiftedMidi - rootMidi;
    const spelling = getTertianChordSpelling(rootPc, semitoneOffset, accidentalMode);
    return formatChordNote(spelling.baseName, shiftedMidi, spelling.nominalNoteClass);
  }).join(' ');

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



