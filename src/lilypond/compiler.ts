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
import { midiToLilyPondPitch, chordMidiToLilyPond } from './pitch.js';

export interface CompileOptions {
  /** LilyPond version string to emit (default: "2.24.4") */
  lilypondVersion?: string;
  /** Clef for the melody staff (default: "treble") */
  melodyClef?: string;
  /** Clef for the harmony staff (default: "treble") */
  harmonyClef?: string;
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
  const harmShift = options.harmonyOctaveShift ?? (harmClef === 'bass' ? -1 : 0);
  const dur = options.durationToken ?? '4';

  const melodyLines: string[] = [
    `  \\clef ${melClef}`,
    '  \\cadenzaOn',
  ];

  const harmonyLines: string[] = [
    `  \\clef ${harmClef}`,
    '  \\cadenzaOn',
  ];



  let lastCoilId: string | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];

    // Emit coil boundary barline when transitioning between distinct coils
    if (lastCoilId !== null && onset.coilId !== lastCoilId) {
      melodyLines.push('  \\bar "|"');
      harmonyLines.push('  \\bar "|"');
    }
    lastCoilId = onset.coilId;

    // Melody: \tag #'tag pitch4
    const melPitch = midiToLilyPondPitch(onset.midiNote);
    melodyLines.push(`  \\tag #'${onset.tag} ${melPitch}${dur}`);

    // Harmony: \tag #'tag <chord>4
    const chord = chordMidiToLilyPond(
      onset.chordMidi,
      harmShift,
    );
    harmonyLines.push(`  \\tag #'${onset.tag} ${chord}${dur}`);

  }

  melodyLines.push('  \\cadenzaOff');
  harmonyLines.push('  \\cadenzaOff');

  const melodyVoiceStr = melodyLines.join('\n');
  const harmonyVoiceStr = harmonyLines.join('\n');

  return `\\version "${version}"

melodyVoice = {
${melodyVoiceStr}
}

harmonyVoice = {
${harmonyVoiceStr}
}

\\score {
  \\new PianoStaff <<
    \\new Staff \\melodyVoice
    \\new Staff \\harmonyVoice
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
