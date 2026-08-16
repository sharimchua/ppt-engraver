/**
 * LilyPond Compiler Module.
 * 
 * Compiles a resolved onset stream into valid, cleanly formatted LilyPond score (.ly)
 * using the self-imposed constrained dialect from §6 of the design document:
 * - \version "2.24.4"
 * - PianoStaff with melodyVoice (top staff) and harmonyVoice (bottom staff)
 * - \cadenzaOn / \cadenzaOff wrapping entire piece
 * - \remove "Time_signature_engraver" in layout
 * - Provenance tagging per onset: \tag #'ppt_<weave>_<coil>_<idx>
 * - Manual barlines \bar "|" between coils
 */
import { writeFileSync } from 'node:fs';
import type { OnsetStream } from '../schema/onset.js';
import {
  midiToLilyPondPitch,
  chordMidiToLilyPond,
  LILYPOND_FLAT_NOTES,
  LILYPOND_SHARP_NOTES,
} from './pitch.js';
import { pitchNameToMidi, getAccidentalModeFromPitchName } from '../solfege/pitch.js';

export interface CompileOptions {
  /** LilyPond version string to emit (default: "2.24.4") */
  lilypondVersion?: string;
  /** Clef for the melody staff (default: "treble") */
  melodyClef?: string;
  /** Clef for the harmony staff (default: "treble") */
  harmonyClef?: string;
  /** Whether to show chord names above the staff (default: true, reads directly from harmonyVoice) */
  showChordNames?: boolean;
  /** Accidental spelling mode ('sharps' or 'flats', auto-detected if omitted) */
  accidentalMode?: 'sharps' | 'flats';
  /** Accidental style for unmetered notation (default: "forget" so all accidentals are explicitly engraved) */
  accidentalStyle?: string;
  /** Octave transposition for harmony triads (default: 0 for treble, -1 for bass) */
  harmonyOctaveShift?: number;
  /** Note duration placeholder string (default: "4" for quarter notes) */
  durationToken?: string;
  /** Notehead style: 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default' */
  noteheadStyle?: 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default';
  /** Pitch name of Do anchor (e.g. "Eb4", "C4") to align shape note heads to Do */
  doPitch?: string;
  /** Whether to omit stems on noteheads */
  omitStem?: boolean;
  /** Whether to colorize melody noteheads according to the PPT Solfège palette */
  colorNotes?: boolean;
}

/**
 * PPT Uniform Solfège Interval Palette
 * Source: https://ppt.midlifemuso.com/reference/specifications/design-system/
 * 
 * - Do (Unison):     #E13610
 * - Seconds (Ra, Re): #F98016
 * - Thirds (Me, Mi):  #F5D432
 * - Fourths (Fa):     #43A440
 * - Tritone (Fi):     #141414
 * - Fifths (So):      #0032A4
 * - Sixths (Le, La):  #5300A4
 * - Sevenths (Te, Ti):#F158A4
 */
export const PPT_SCHEME_COLOR_DEFINITIONS = `#(define colorDo (rgb-color (/ #xE1 255.0) (/ #x36 255.0) (/ #x10 255.0)))
#(define colorRe (rgb-color (/ #xF9 255.0) (/ #x80 255.0) (/ #x16 255.0)))
#(define colorMi (rgb-color (/ #xF5 255.0) (/ #xD4 255.0) (/ #x32 255.0)))
#(define colorFa (rgb-color (/ #x43 255.0) (/ #xA4 255.0) (/ #x40 255.0)))
#(define colorFi (rgb-color (/ #x14 255.0) (/ #x14 255.0) (/ #x14 255.0)))
#(define colorSo (rgb-color (/ #x00 255.0) (/ #x32 255.0) (/ #xA4 255.0)))
#(define colorLa (rgb-color (/ #x53 255.0) (/ #x00 255.0) (/ #xA4 255.0)))
#(define colorTi (rgb-color (/ #xF1 255.0) (/ #x58 255.0) (/ #xA4 255.0)))
`;

export const SOLFEGE_TO_SCHEME_COLOR: Record<string, string> = {
  Do: 'colorDo',
  Ra: 'colorRe',
  Di: 'colorRe',
  Re: 'colorRe',
  Me: 'colorMi',
  Ri: 'colorMi',
  Mi: 'colorMi',
  Fa: 'colorFa',
  Se: 'colorFa',
  Fi: 'colorFi',
  So: 'colorSo',
  Le: 'colorLa',
  Si: 'colorLa',
  La: 'colorLa',
  Te: 'colorTi',
  Li: 'colorTi',
  Ti: 'colorTi',
};

/**
 * Compiles an onset stream into a complete LilyPond source string (.ly).
 * 
 * @param onsets - The resolved onset stream
 * @param options - Compilation options
 * @returns Formatted LilyPond document string
 */
export function compileToLilyPond(
  onsets: OnsetStream,
  options: CompileOptions = {},
): string {
  const version = options.lilypondVersion ?? '2.24.4';
  const melClef = options.melodyClef ?? 'treble';
  const harmClef = options.harmonyClef ?? 'treble';
  const showChordNames = options.showChordNames ?? true;
  const accStyle = options.accidentalStyle ?? 'forget';
  const harmShift = options.harmonyOctaveShift ?? (harmClef === 'bass' ? -1 : 0);
  const dur = options.durationToken ?? '4';
  const noteheadStyle = options.noteheadStyle ?? 'default';
  const omitStem = options.omitStem ?? false;
  const colorNotes = options.colorNotes ?? false;
  const accMode =
    options.accidentalMode ??
    (onsets.some(
      o =>
        o.pitch.includes('b') ||
        o.pitch.includes('♭') ||
        o.chordTones.some(ct => ct.includes('b')),
    )
      ? 'flats'
      : 'sharps');

  const melodyLines: string[] = [
    `  \\clef ${melClef}`,
    `  \\accidentalStyle ${accStyle}`,
  ];

  // Configure shape noteheads aligned with Do (tonic)
  if (['sacredHarp', 'aiken', 'funk', 'walker'].includes(noteheadStyle)) {
    let tonicDutch = 'c';
    if (options.doPitch) {
      try {
        const midi = pitchNameToMidi(options.doPitch);
        const pc = ((midi % 12) + 12) % 12;
        const tonicAccMode = getAccidentalModeFromPitchName(options.doPitch);
        tonicDutch = (tonicAccMode === 'flats' ? LILYPOND_FLAT_NOTES : LILYPOND_SHARP_NOTES)[pc];
      } catch {
        tonicDutch = 'c';
      }
    }

    melodyLines.push(`  \\key ${tonicDutch} \\major`);
    melodyLines.push('  \\omit Staff.KeySignature');
    if (noteheadStyle === 'sacredHarp') {
      melodyLines.push('  \\sacredHarpHeads');
    } else if (noteheadStyle === 'aiken') {
      melodyLines.push('  \\aikenHeads');
    } else if (noteheadStyle === 'funk') {
      melodyLines.push('  \\funkHeads');
    } else if (noteheadStyle === 'walker') {
      melodyLines.push('  \\walkerHeads');
    }
  } else if (noteheadStyle === 'diamond') {
    melodyLines.push("  \\override NoteHead.style = #'diamond");
  }

  if (omitStem) {
    melodyLines.push('  \\omit Stem');
  }

  melodyLines.push('  \\cadenzaOn');

  const harmonyLines: string[] = [
    `  \\clef ${harmClef}`,
    `  \\accidentalStyle ${accStyle}`,
  ];

  if (omitStem) {
    harmonyLines.push('  \\omit Stem');
  }

  harmonyLines.push('  \\cadenzaOn');

  let lastCoilId: string | null = null;
  let lastWeaveId: string | null = null;

  const isShapeNoteMode = ['sacredHarp', 'aiken', 'funk', 'walker'].includes(noteheadStyle);
  const forceAccidentals = isShapeNoteMode;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];

    // Emit coil boundary barline when transitioning between distinct coils or repeating a coil
    if (
      i > 0 &&
      (onset.onsetIndex === 1 || onset.coilId !== lastCoilId || onset.weaveId !== lastWeaveId)
    ) {
      melodyLines.push('  \\bar "|"');
      harmonyLines.push('  \\bar "|"');
    }
    lastCoilId = onset.coilId;
    lastWeaveId = onset.weaveId;

    // Melody: \tag #'tag pitch4
    const melPitch = midiToLilyPondPitch(onset.midiNote, accMode, forceAccidentals);
    const colorTweak = colorNotes
      ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[onset.scaleDegree] ?? 'colorDo'} `
      : '';
    melodyLines.push(`  \\tag #'${onset.tag} ${colorTweak}${melPitch}${dur}`);

    // Harmony: \tag #'tag <chord>4
    const chord = chordMidiToLilyPond(
      onset.chordMidi,
      harmShift,
      accMode,
      forceAccidentals,
    );
    harmonyLines.push(`  \\tag #'${onset.tag} ${chord}${dur}`);
  }

  melodyLines.push('  \\cadenzaOff');
  harmonyLines.push('  \\cadenzaOff');

  const melodyVoiceStr = melodyLines.join('\n');
  const harmonyVoiceStr = harmonyLines.join('\n');

  const scoreBody = showChordNames
    ? `  <<
    \\new ChordNames {
      \\set chordChanges = ##t
      \\harmonyVoice
    }
    \\new PianoStaff <<
      \\new Staff \\melodyVoice
      \\new Staff \\harmonyVoice
    >>
  >>`
    : `  \\new PianoStaff <<
    \\new Staff \\melodyVoice
    \\new Staff \\harmonyVoice
  >>`;

  const colorPreamble = colorNotes ? `\n${PPT_SCHEME_COLOR_DEFINITIONS}\n` : '';

  return `\\version "${version}"
${colorPreamble}
melodyVoice = {
${melodyVoiceStr}
}

harmonyVoice = {
${harmonyVoiceStr}
}

\\score {
${scoreBody}
  \\layout {
    \\context {
      \\Staff
      \\remove "Time_signature_engraver"
    }
  }
}
`;
}





/**
 * Compiles an onset stream and writes the `.ly` file to disk.
 * 
 * @param onsets - Resolved onset stream
 * @param filePath - Output path for .ly file
 * @param options - Compilation options
 */
export function writeLilyPondFile(
  onsets: OnsetStream,
  filePath: string,
  options: CompileOptions = {},
): void {
  const content = compileToLilyPond(onsets, options);
  writeFileSync(filePath, content, 'utf-8');
}
