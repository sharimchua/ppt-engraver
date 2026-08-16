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
  chordToLilyPondChordMode,
} from './pitch.js';
import { parseHarmonyChord } from '../solfege/pitch.js';

export interface CompileOptions {
  /** LilyPond version string to emit (default: "2.24.4") */
  lilypondVersion?: string;
  /** Clef for the melody staff (default: "treble") */
  melodyClef?: string;
  /** Clef for the harmony staff (default: "treble") */
  harmonyClef?: string;
  /** Whether to show chord names above the staff (default: true) */
  showChordNames?: boolean;
  /** Accidental spelling mode ('sharps' or 'flats', auto-detected if omitted) */
  accidentalMode?: 'sharps' | 'flats';
  /** Accidental style for unmetered notation (default: "forget" so all accidentals are explicitly engraved) */
  accidentalStyle?: string;
  /** Octave transposition for harmony triads (default: 0 for treble, -1 for bass) */
  harmonyOctaveShift?: number;
  /** Note duration placeholder string (default: "4" for quarter notes) */
  durationToken?: string;
}

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

  const chordLines: string[] = showChordNames
    ? ['  \\set chordChanges = ##t', '  \\cadenzaOn']
    : [];

  const melodyLines: string[] = [
    `  \\clef ${melClef}`,
    `  \\accidentalStyle ${accStyle}`,
    '  \\cadenzaOn',
  ];

  const harmonyLines: string[] = [
    `  \\clef ${harmClef}`,
    `  \\accidentalStyle ${accStyle}`,
    '  \\cadenzaOn',
  ];

  let lastCoilId: string | null = null;
  let lastWeaveId: string | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];

    // Emit coil boundary barline when transitioning between distinct coils or repeating a coil
    if (
      i > 0 &&
      (onset.onsetIndex === 1 || onset.coilId !== lastCoilId || onset.weaveId !== lastWeaveId)
    ) {
      melodyLines.push('  \\bar "|"');
      harmonyLines.push('  \\bar "|"');
      if (showChordNames) {
        chordLines.push('  \\bar "|"');
      }
    }
    lastCoilId = onset.coilId;
    lastWeaveId = onset.weaveId;


    // Melody: \tag #'tag pitch4
    const melPitch = midiToLilyPondPitch(onset.midiNote, accMode);
    melodyLines.push(`  \\tag #'${onset.tag} ${melPitch}${dur}`);

    // Harmony: \tag #'tag <chord>4
    const chord = chordMidiToLilyPond(
      onset.chordMidi,
      harmShift,
      accMode,
    );
    harmonyLines.push(`  \\tag #'${onset.tag} ${chord}${dur}`);

    // ChordNames: \tag #'tag c4:m
    if (showChordNames) {
      const parsedChord = parseHarmonyChord(onset.chordRoot);
      const rootMidi = onset.chordMidi[0];
      const chordModeToken = chordToLilyPondChordMode(rootMidi, parsedChord.quality, dur, accMode);
      chordLines.push(`  \\tag #'${onset.tag} ${chordModeToken}`);
    }
  }

  melodyLines.push('  \\cadenzaOff');
  harmonyLines.push('  \\cadenzaOff');
  if (showChordNames) {
    chordLines.push('  \\cadenzaOff');
  }

  const melodyVoiceStr = melodyLines.join('\n');
  const harmonyVoiceStr = harmonyLines.join('\n');
  const chordVoiceStr = showChordNames ? chordLines.join('\n') : '';

  const chordVoiceDef = showChordNames
    ? `chordVoice = \\chordmode {
${chordVoiceStr}
}

`
    : '';

  const chordStaffDef = showChordNames ? '    \\new ChordNames \\chordVoice\n' : '';

  return `\\version "${version}"

${chordVoiceDef}melodyVoice = {
${melodyVoiceStr}
}

harmonyVoice = {
${harmonyVoiceStr}
}

\\score {
  <<
${chordStaffDef}    \\new PianoStaff <<
      \\new Staff \\melodyVoice
      \\new Staff \\harmonyVoice
    >>
  >>
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
