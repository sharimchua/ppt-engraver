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

import {
  pitchNameToMidi,
  SOLFEGE_POSITIONS,
  parseHarmonyChord,
  solfegeToHarmonyRootOffset,
  getChordIntervals,
} from '../solfege/pitch.js';

export const SOLFEGE_TO_SCHEME_COLOR: Record<string, string> = {
  Do: 'colorDo',
  Ra: 'colorRa',
  Di: 'colorRa',
  Re: 'colorRe',
  Me: 'colorMe',
  Ri: 'colorMe',
  Mi: 'colorMi',
  Fa: 'colorFa',
  Se: 'colorFa',
  Fi: 'colorFi',
  So: 'colorSo',
  Le: 'colorLe',
  Si: 'colorLe',
  La: 'colorLa',
  Te: 'colorTe',
  Li: 'colorTe',
  Ti: 'colorTi',
};

export const SOLFEGE_TO_PPT_STENCIL: Record<string, string> = {
  Do: 'stencilDo',
  Ra: 'stencilRe',
  Di: 'stencilRe',
  Re: 'stencilRe',
  Me: 'stencilMe',
  Ri: 'stencilMe',
  Mi: 'stencilMi',
  Fa: 'stencilFa',
  Se: 'stencilFa',
  Fi: 'stencilFi',
  So: 'stencilSo',
  Le: 'stencilLe',
  Si: 'stencilLe',
  La: 'stencilLa',
  Te: 'stencilTe',
  Li: 'stencilTe',
  Ti: 'stencilTi',
};

export const SOLFEGE_TO_PPT_TAB_STENCIL: Record<string, string> = {
  Do: 'tabStencilDo',
  Ra: 'tabStencilRa',
  Di: 'tabStencilRa',
  Re: 'tabStencilRe',
  Me: 'tabStencilMe',
  Ri: 'tabStencilMe',
  Mi: 'tabStencilMi',
  Fa: 'tabStencilFa',
  Se: 'tabStencilFa',
  Fi: 'tabStencilFi',
  So: 'tabStencilSo',
  Le: 'tabStencilLe',
  Si: 'tabStencilLe',
  La: 'tabStencilLa',
  Te: 'tabStencilTe',
  Li: 'tabStencilTe',
  Ti: 'tabStencilTi',
};

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
 * - 63 (D#4) -> "dis'" (or "dis'!" if forced)
 * - 67 (G4)  -> "g'"
 * 
 * Examples (flats):
 * - 63 (Eb4) -> "ees'" (or "ees'!" if forced)
 * - 70 (Bb4) -> "bes'" (or "bes'!" if forced)
 * - 68 (Ab4) -> "aes'" (or "aes'!" if forced)
 * 
 * @param midi - MIDI note number (0-127)
 * @param accidentalMode - 'sharps' or 'flats' (default: 'sharps')
 * @param forceAccidentals - Whether to append '!' to explicitly force accidental printing
 * @returns LilyPond pitch token
 */
export function midiToLilyPondPitch(
  midi: number,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
  forceAccidentals: boolean = false,
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
  
  let ticks = '';
  if (octaveDiff > 0) {
    ticks = `'`.repeat(octaveDiff);
  } else if (octaveDiff < 0) {
    ticks = `,`.repeat(Math.abs(octaveDiff));
  }
  
  const isAltered = baseNote.endsWith('es') || baseNote.endsWith('is');
  const forceMark = (forceAccidentals && isAltered) ? '!' : '';

  
  return `${baseNote}${ticks}${forceMark}`;
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
    if (normOffset === 3) return { baseName: 'd', nominalNoteClass: 2 };   // D in B minor
    if (normOffset === 4) return { baseName: 'dis', nominalNoteClass: 2 }; // D# in B major
    if (normOffset === 6) return { baseName: 'f', nominalNoteClass: 5 };   // F in B dim
    if (normOffset === 7) return { baseName: 'fis', nominalNoteClass: 5 }; // F# in B major/minor
    if (normOffset === 10) return { baseName: 'a', nominalNoteClass: 9 };  // A in B7
    if (normOffset === 11) return { baseName: 'ais', nominalNoteClass: 9 }; // A# in B maj7
  }

  // Db minor / Db major chords (rootPc === 1, in flats mode)
  if (rootPc === 1 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'fes', nominalNoteClass: 5 }; // Fb in Db minor
    if (normOffset === 4) return { baseName: 'f', nominalNoteClass: 5 };   // F in Db major
    if (normOffset === 7) return { baseName: 'aes', nominalNoteClass: 9 }; // Ab in Db major/minor
    if (normOffset === 10) return { baseName: 'ces', nominalNoteClass: 0 }; // Cb in Db7
    if (normOffset === 11) return { baseName: 'c', nominalNoteClass: 0 };   // C in Db maj7
  }

  // C# minor / C# major chords (rootPc === 1, in sharps mode)
  if (rootPc === 1 && accidentalMode === 'sharps') {
    if (normOffset === 3) return { baseName: 'e', nominalNoteClass: 4 };   // E in C# minor
    if (normOffset === 4) return { baseName: 'eis', nominalNoteClass: 4 }; // E# in C# major
    if (normOffset === 7) return { baseName: 'gis', nominalNoteClass: 7 }; // G# in C# major/minor
    if (normOffset === 10) return { baseName: 'b', nominalNoteClass: 11 }; // B in C#7
    if (normOffset === 11) return { baseName: 'bis', nominalNoteClass: 11 }; // B# in C# maj7
  }

  // Ab minor / Ab major chords (rootPc === 8, in flats mode)
  if (rootPc === 8 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'ces', nominalNoteClass: 0 }; // Cb in Ab minor
    if (normOffset === 4) return { baseName: 'c', nominalNoteClass: 0 };   // C in Ab major
    if (normOffset === 7) return { baseName: 'ees', nominalNoteClass: 4 }; // Eb in Ab major/minor
    if (normOffset === 10) return { baseName: 'ges', nominalNoteClass: 7 }; // Gb in Ab7
    if (normOffset === 11) return { baseName: 'g', nominalNoteClass: 7 };   // G in Ab maj7
  }

  // G# minor / G# major chords (rootPc === 8, in sharps mode)
  if (rootPc === 8 && accidentalMode === 'sharps') {
    if (normOffset === 3) return { baseName: 'b', nominalNoteClass: 11 };  // B in G# minor
    if (normOffset === 4) return { baseName: 'bis', nominalNoteClass: 11 }; // B# in G# major
    if (normOffset === 7) return { baseName: 'dis', nominalNoteClass: 2 }; // D# in G# major/minor
    if (normOffset === 10) return { baseName: 'fis', nominalNoteClass: 5 }; // F# in G#7
  }

  // Gb major / Gb minor chords (rootPc === 6, in flats mode)
  if (rootPc === 6 && accidentalMode === 'flats') {
    if (normOffset === 4) return { baseName: 'bes', nominalNoteClass: 11 }; // Bb in Gb major
    if (normOffset === 7) return { baseName: 'des', nominalNoteClass: 2 }; // Db in Gb major/minor
    if (normOffset === 10) return { baseName: 'fes', nominalNoteClass: 5 }; // Fb in Gb7
    if (normOffset === 11) return { baseName: 'f', nominalNoteClass: 5 };   // F in Gb maj7
  }

  // F# minor / F# major chords (rootPc === 6, in sharps mode)
  if (rootPc === 6 && accidentalMode === 'sharps') {
    if (normOffset === 3) return { baseName: 'a', nominalNoteClass: 9 };   // A in F# minor
    if (normOffset === 4) return { baseName: 'ais', nominalNoteClass: 9 }; // A# in F# major
    if (normOffset === 7) return { baseName: 'cis', nominalNoteClass: 0 }; // C# in F# major/minor
    if (normOffset === 10) return { baseName: 'e', nominalNoteClass: 4 };  // E in F#7
    if (normOffset === 11) return { baseName: 'eis', nominalNoteClass: 4 }; // E# in F# maj7
  }

  // Eb minor / Eb major chords (rootPc === 3, in flats mode)
  if (rootPc === 3 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'ges', nominalNoteClass: 7 }; // Gb in Eb minor
    if (normOffset === 4) return { baseName: 'g', nominalNoteClass: 7 };   // G in Eb major
    if (normOffset === 7) return { baseName: 'bes', nominalNoteClass: 11 }; // Bb in Eb major/minor
    if (normOffset === 10) return { baseName: 'des', nominalNoteClass: 2 }; // Db in Eb7
    if (normOffset === 11) return { baseName: 'd', nominalNoteClass: 2 };   // D in Eb maj7
  }

  // Bb major / Bb minor chords (rootPc === 10, in flats mode)
  if (rootPc === 10 && accidentalMode === 'flats') {
    if (normOffset === 3) return { baseName: 'des', nominalNoteClass: 2 }; // Db in Bb minor
    if (normOffset === 4) return { baseName: 'd', nominalNoteClass: 2 };   // D in Bb major
    if (normOffset === 7) return { baseName: 'f', nominalNoteClass: 5 };   // F in Bb major/minor
    if (normOffset === 10) return { baseName: 'aes', nominalNoteClass: 9 }; // Ab in Bb7
    if (normOffset === 11) return { baseName: 'a', nominalNoteClass: 9 };   // A in Bb maj7
  }

  // F minor / F major chords (rootPc === 5)
  if (rootPc === 5) {
    if (normOffset === 3) return { baseName: 'aes', nominalNoteClass: 9 }; // Ab in F minor
    if (normOffset === 4) return { baseName: 'a', nominalNoteClass: 9 };   // A in F major
    if (normOffset === 7) return { baseName: 'c', nominalNoteClass: 0 };   // C in F major/minor
    if (normOffset === 10) return { baseName: 'ees', nominalNoteClass: 4 }; // Eb in F7
    if (normOffset === 11) return { baseName: 'e', nominalNoteClass: 4 };   // E in F maj7
  }

  // C minor / C major chords (rootPc === 0)
  if (rootPc === 0) {
    if (normOffset === 3) return { baseName: 'ees', nominalNoteClass: 4 }; // Eb in C minor
    if (normOffset === 4) return { baseName: 'e', nominalNoteClass: 4 };   // E in C major
    if (normOffset === 7) return { baseName: 'g', nominalNoteClass: 7 };   // G in C major/minor
    if (normOffset === 10) return { baseName: 'bes', nominalNoteClass: 11 }; // Bb in C7
    if (normOffset === 11) return { baseName: 'b', nominalNoteClass: 11 };   // B in C maj7
  }

  // G minor / G major chords (rootPc === 7)
  if (rootPc === 7) {
    if (normOffset === 3) return { baseName: 'bes', nominalNoteClass: 11 }; // Bb in G minor
    if (normOffset === 4) return { baseName: 'b', nominalNoteClass: 11 };   // B in G major
    if (normOffset === 7) return { baseName: 'd', nominalNoteClass: 2 };   // D in G major/minor
    if (normOffset === 10) return { baseName: 'f', nominalNoteClass: 5 };   // F in G7
    if (normOffset === 11) return { baseName: 'fis', nominalNoteClass: 5 }; // F# in G maj7
  }

  // D minor / D major chords (rootPc === 2)
  if (rootPc === 2) {
    if (normOffset === 3) return { baseName: 'f', nominalNoteClass: 5 };   // F in D minor
    if (normOffset === 4) return { baseName: 'fis', nominalNoteClass: 5 }; // F# in D major
    if (normOffset === 7) return { baseName: 'a', nominalNoteClass: 9 };   // A in D major/minor
    if (normOffset === 10) return { baseName: 'c', nominalNoteClass: 0 };   // C in D7
    if (normOffset === 11) return { baseName: 'cis', nominalNoteClass: 0 }; // C# in D maj7
  }

  // A minor / A major chords (rootPc === 9)
  if (rootPc === 9) {
    if (normOffset === 3) return { baseName: 'c', nominalNoteClass: 0 };   // C in A minor
    if (normOffset === 4) return { baseName: 'cis', nominalNoteClass: 0 }; // C# in A major
    if (normOffset === 7) return { baseName: 'e', nominalNoteClass: 4 };   // E in A major/minor
    if (normOffset === 10) return { baseName: 'g', nominalNoteClass: 7 };   // G in A7
    if (normOffset === 11) return { baseName: 'gis', nominalNoteClass: 7 }; // G# in A maj7
  }

  // E minor / E major chords (rootPc === 4)
  if (rootPc === 4) {
    if (normOffset === 3) return { baseName: 'g', nominalNoteClass: 7 };   // G in E minor
    if (normOffset === 4) return { baseName: 'gis', nominalNoteClass: 7 }; // G# in E major
    if (normOffset === 7) return { baseName: 'b', nominalNoteClass: 11 };  // B in E major/minor
    if (normOffset === 10) return { baseName: 'd', nominalNoteClass: 2 };   // D in E7
    if (normOffset === 11) return { baseName: 'dis', nominalNoteClass: 2 }; // D# in E maj7
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
function formatChordNote(
  baseName: string,
  midi: number,
  nominalClass: number,
  forceAccidentals: boolean = false,
): string {
  // Octave calculation based on nominal note class (e.g. Cb4 = MIDI 59 -> octave 4 -> 1 tick)
  const octave = Math.floor((midi - nominalClass + 6) / 12) - 1;
  const octaveDiff = octave - 3;
  let ticks = '';
  if (octaveDiff > 0) {
    ticks = `'`.repeat(octaveDiff);
  } else if (octaveDiff < 0) {
    ticks = `,`.repeat(Math.abs(octaveDiff));
  }
  const isAltered = baseName.endsWith('es') || baseName.endsWith('is') || baseName === 'ces';
  const forceMark = (forceAccidentals && isAltered) ? '!' : '';
  return `${baseName}${ticks}${forceMark}`;
}

/**
 * Formats a chord into a LilyPond chord token `<pitch1 pitch2 ...>` using
 * proper tertian harmonic spelling (e.g. <b dis' fis'> for B, <aes ces' ees'> for Abm).
 * 
 * @param chordMidi - Array of MIDI note numbers
 * @param octaveShift - Optional octave transposition
 * @param accidentalMode - 'sharps' or 'flats' (default: 'sharps')
 * @param forceAccidentals - Whether to append '!' to altered chord notes
 * @returns Formatted LilyPond chord token, e.g. "<c e g>" or "<ees'! g' bes'!>"
 */
export function chordMidiToLilyPond(
  chordMidi: number[],
  octaveShift: number = 0,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
  forceAccidentals: boolean = false,
): string {
  if (chordMidi.length === 0) return '<>';
  const rootMidi = chordMidi[0] + (octaveShift * 12);
  const rootPc = ((rootMidi % 12) + 12) % 12;

  const notes = chordMidi.map(m => {
    const shiftedMidi = m + (octaveShift * 12);
    const semitoneOffset = shiftedMidi - rootMidi;
    const spelling = getTertianChordSpelling(rootPc, semitoneOffset, accidentalMode);
    return formatChordNote(spelling.baseName, shiftedMidi, spelling.nominalNoteClass, forceAccidentals);
  }).join(' ');

  return `<${notes}>`;
}



/**
 * Converts a Solfège harmony chord token into a canonical block chord LilyPond token `<pitch1 pitch2 ...>` (with optional `/bass`),
 * completely independent of staff voicing styles.
 * 
 * E.g. "Do" (when Do is C) -> "<c' e' g'>"
 * E.g. "DoMe" (when Do is C) -> "<c' ees' g'>"
 * E.g. "SoxDo" (when Do is C) -> "<c' e' g'>/g"
 * E.g. "MiexDo" (when Do is C) -> "<c' e' g'>/e"
 * E.g. "MexDoMe" (when Do is C, flats) -> "<c' ees' g'>/ees"
 * E.g. "TiMeFiLa" (when Do is F, flats) -> "<e' g' bes' des''>"
 * E.g. "DoMeFiTe" (when Do is C, flats) -> "<c' ees' ges' bes'>"
 */
export function canonicalChordToLilyPond(
  chordToken: string,
  knotDoMidi: number = 60,
  accidentalMode: 'sharps' | 'flats' = 'sharps',
  forceAccidentals: boolean = false,
): string {
  if (!chordToken) return '<>';
  const parsed = parseHarmonyChord(chordToken);
  const rootOffset = solfegeToHarmonyRootOffset(parsed.rootSyllable);

  // Center root around octave 4 (MIDI 60-71, Middle C = c')
  let rootMidi = knotDoMidi + rootOffset + (parsed.octaveShift * 12);
  while (rootMidi < 60) rootMidi += 12;
  while (rootMidi > 71) rootMidi -= 12;

  const rootPc = ((rootMidi % 12) + 12) % 12;
  const intervals = getChordIntervals(parsed.quality);

  const notes = intervals.map((interval) => {
    const noteMidi = rootMidi + interval;
    const spelling = getTertianChordSpelling(rootPc, interval, accidentalMode);
    return formatChordNote(spelling.baseName, noteMidi, spelling.nominalNoteClass, forceAccidentals);
  });

  let slashSuffix = '';
  if (parsed.hasAxisBass && parsed.bassSyllable) {
    const bassOffset = solfegeToHarmonyRootOffset(parsed.bassSyllable);
    const bassPc = (((knotDoMidi + bassOffset) % 12) + 12) % 12;
    if (bassPc !== rootPc) {
      const names = accidentalMode === 'flats' ? LILYPOND_FLAT_NOTES : LILYPOND_SHARP_NOTES;
      const bassBaseName = names[bassPc];
      slashSuffix = `/${bassBaseName}`;
    }
  }

  return `<${notes.join(' ')}>${slashSuffix}`;
}

/**
 * Converts a chord root MIDI note + quality into a LilyPond chordmode token.
 * E.g. (69, 'minor', '4', 'sharps') -> "a4:m"
 * E.g. (63, 'major', '4', 'flats')  -> "ees4"
 * E.g. (60, 'major', '4', 'sharps', 55) -> "c4/g" (C/G slash chord)
 * E.g. (67, 'dominant7', '4', 'sharps') -> "g4:7"
 * E.g. (71, 'diminished', '4', 'sharps') -> "b4:dim"
 */
export function chordToLilyPondChordMode(
  rootMidi: number,
  quality: string = 'major',
  durationToken: string = '4',
  accidentalMode: 'sharps' | 'flats' = 'sharps',
  bassMidi?: number,
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
  } else if (quality === 'major7') {
    qualitySuffix = ':maj7';
  } else if (quality === 'minorMajor7') {
    qualitySuffix = ':m7+';
  } else if (quality === 'diminished') {
    qualitySuffix = ':dim';
  } else if (quality === 'diminished7') {
    qualitySuffix = ':dim7';
  } else if (quality === 'halfDiminished7') {
    qualitySuffix = ':m7.5-';
  } else if (quality === 'augmented') {
    qualitySuffix = ':aug';
  } else if (quality === 'sus4') {
    qualitySuffix = ':sus4';
  } else if (quality === 'sus2') {
    qualitySuffix = ':sus2';
  } else if (quality === '7sus4') {
    qualitySuffix = ':7.4';
  } else if (quality === 'major6') {
    qualitySuffix = ':6';
  } else if (quality === 'minor6') {
    qualitySuffix = ':m6';
  }

  let slashBass = '';
  if (bassMidi !== undefined) {
    const bassIndex = ((bassMidi % 12) + 12) % 12;
    if (bassIndex !== noteIndex) {
      const bassNote = accidentalMode === 'flats'
        ? LILYPOND_FLAT_NOTES[bassIndex]
        : LILYPOND_SHARP_NOTES[bassIndex];
      slashBass = `/${bassNote}`;
    }
  }

  return `${baseNote}${durationToken}${qualitySuffix}${slashBass}`;
}



