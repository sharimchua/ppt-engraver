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
  /** Piece title */
  title?: string;
  /** Subtitle or secondary description */
  subtitle?: string;
  /** Composer or Artist name */
  composer?: string;
  /** Arranger */
  arranger?: string;
  /** Poet or lyricist */
  poet?: string;
  /** Copyright statement */
  copyright?: string;
  /** Piece or top-left section label (defaults to Do key anchor [Do Glyph] = PitchClass if doPitch is present) */
  piece?: string;
  /** Whether to show the Do key anchor symbol at the top of the engraving (default: true if doPitch is present) */
  showKeyAnchor?: boolean;
  /** Custom tagline or boolean (false suppresses LilyPond default footer, default: false) */
  tagline?: string | boolean;

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
  /** Notehead style: 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default' */
  noteheadStyle?: 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default';
  /** Pitch name of Do anchor (e.g. "Eb4", "C4") to align shape note heads to Do */
  doPitch?: string;
  /** Whether to omit stems on noteheads */
  omitStem?: boolean;
  /** Whether to colorize melody noteheads according to the PPT Solfège palette */
  colorNotes?: boolean;
  /** Whether to draw a dark outline around colored noteheads for contrast (default: true when colorNotes is true) */
  noteheadOutline?: boolean;
  /** Whether to omit natural accidental signs on unmetered staves with hidden key signatures (default: true in shape-note mode) */
  omitNaturals?: boolean;
}


/**
 * Scheme definitions for PPT Solfège Interval Palette, Notehead Outline Stencil,
 * and standard PPT Geometric Notehead Stencils:
 * - Do (Tonic): Circle
 * - Ra/Re (2nds): Square
 * - Me/Le (m3/m6): Triangle Down
 * - Mi/La (M3/M6): Triangle Up
 * - Fa (P4): Half Circle Left
 * - Fi (Tritone): Cross
 * - So (P5): Half Circle Right
 * - Te/Ti (7ths): Diamond
 */
export const PPT_SCHEME_COLOR_DEFINITIONS = `#(define colorDo (rgb-color (/ #xE1 255.0) (/ #x36 255.0) (/ #x10 255.0)))
#(define colorRe (rgb-color (/ #xF9 255.0) (/ #x80 255.0) (/ #x16 255.0)))
#(define colorMi (rgb-color (/ #xF5 255.0) (/ #xD4 255.0) (/ #x32 255.0)))
#(define colorFa (rgb-color (/ #x43 255.0) (/ #xA4 255.0) (/ #x40 255.0)))
#(define colorFi (rgb-color (/ #x14 255.0) (/ #x14 255.0) (/ #x14 255.0)))
#(define colorSo (rgb-color (/ #x00 255.0) (/ #x32 255.0) (/ #xA4 255.0)))
#(define colorLa (rgb-color (/ #x53 255.0) (/ #x00 255.0) (/ #xA4 255.0)))
#(define colorTi (rgb-color (/ #xF1 255.0) (/ #x58 255.0) (/ #xA4 255.0)))

#(define (make-ppt-stencil base-stencil)
   (lambda (grob)
     (let* ((default-stencil (ly:note-head::print grob))
            (x-ext (if (ly:stencil? default-stencil)
                       (ly:stencil-extent default-stencil X)
                       '(0.0 . 1.30)))
            (x-center (/ (+ (car x-ext) (cdr x-ext)) 2.0))
            (orig (ly:stencil-translate-axis base-stencil x-center X))
            (col (ly:grob-property grob 'color #f)))
       (if (and col (list? col))
           (let* ((black-stencil (stencil-with-color orig black))
                  (colored-stencil (stencil-with-color orig col))
                  (d 0.08))
             (ly:stencil-add
               (ly:stencil-translate black-stencil (cons (- d) 0))
               (ly:stencil-translate black-stencil (cons d 0))
               (ly:stencil-translate black-stencil (cons 0 (- d)))
               (ly:stencil-translate black-stencil (cons 0 d))
               (ly:stencil-translate black-stencil (cons (- d) (- d)))
               (ly:stencil-translate black-stencil (cons d d))
               (ly:stencil-translate black-stencil (cons (- d) d))
               (ly:stencil-translate black-stencil (cons d (- d)))
               colored-stencil))
           orig))))


#(define stencilDo (make-ppt-stencil (make-circle-stencil 0.52 0.0 #t)))
#(define stencilRe (make-ppt-stencil (make-path-stencil '(moveto -0.50 -0.48 lineto 0.50 -0.48 lineto 0.50 0.48 lineto -0.50 0.48 closepath) 0.0 1.0 1.0 #t)))
#(define stencilMe (make-ppt-stencil (make-path-stencil '(moveto -0.58 0.48 lineto 0.58 0.48 lineto 0.0 -0.52 closepath) 0.0 1.0 1.0 #t)))
#(define stencilMi (make-ppt-stencil (make-path-stencil '(moveto -0.58 -0.48 lineto 0.58 -0.48 lineto 0.0 0.52 closepath) 0.0 1.0 1.0 #t)))
#(define stencilFa (make-ppt-stencil (make-path-stencil '(moveto 0.35 -0.50 lineto 0.35 0.50 curveto -0.25 0.50 -0.65 0.30 -0.65 0.0 curveto -0.65 -0.30 -0.25 -0.50 0.35 -0.50 closepath) 0.0 1.0 1.0 #t)))
#(define stencilFi (make-ppt-stencil (ly:stencil-add (make-line-stencil 0.28 -0.45 -0.45 0.45 0.45) (make-line-stencil 0.28 -0.45 0.45 0.45 -0.45))))
#(define stencilSo (make-ppt-stencil (make-path-stencil '(moveto -0.35 -0.50 lineto -0.35 0.50 curveto 0.25 0.50 0.65 0.30 0.65 0.0 curveto 0.65 -0.30 0.25 -0.50 -0.35 -0.50 closepath) 0.0 1.0 1.0 #t)))
#(define stencilLe (make-ppt-stencil (make-path-stencil '(moveto -0.58 0.48 lineto 0.58 0.48 lineto 0.0 -0.52 closepath) 0.0 1.0 1.0 #t)))
#(define stencilLa (make-ppt-stencil (make-path-stencil '(moveto -0.58 -0.48 lineto 0.58 -0.48 lineto 0.0 0.52 closepath) 0.0 1.0 1.0 #t)))
#(define stencilTe (make-ppt-stencil (make-path-stencil '(moveto -0.62 0.0 lineto 0.0 0.52 lineto 0.62 0.0 lineto 0.0 -0.52 closepath) 0.0 1.0 1.0 #t)))
#(define stencilTi (make-ppt-stencil (make-path-stencil '(moveto -0.62 0.0 lineto 0.0 0.52 lineto 0.62 0.0 lineto 0.0 -0.52 closepath) 0.0 1.0 1.0 #t)))

#(define pptGlyphDo
   (make-path-stencil
     '(moveto 0.29 0.502
       lineto 0.50 0.866
       lineto 0.866 0.50
       lineto 1.00 0.00
       lineto 0.866 -0.50
       lineto 0.50 -0.866
       lineto -0.50 -0.866
       lineto -0.866 -0.50
       lineto -1.00 0.00
       lineto -0.866 0.50
       lineto -0.50 0.866
       lineto -0.29 0.502
       lineto -0.502 0.29
       lineto -0.58 0.00
       lineto -0.502 -0.29
       lineto -0.29 -0.502
       lineto 0.29 -0.502
       lineto 0.502 -0.29
       lineto 0.58 0.00
       lineto 0.502 0.29
       closepath)
     0.0 0.9 0.9 #t))

#(define (make-outlined-glyph base-stencil fill-col)
   (let* ((orig (if fill-col (stencil-with-color base-stencil fill-col) base-stencil))
          (black-stencil (stencil-with-color base-stencil black))
          (d 0.07))
     (ly:stencil-add
       (ly:stencil-translate black-stencil (cons (- d) 0))
       (ly:stencil-translate black-stencil (cons d 0))
       (ly:stencil-translate black-stencil (cons 0 (- d)))
       (ly:stencil-translate black-stencil (cons 0 d))
       (ly:stencil-translate black-stencil (cons (- d) (- d)))
       (ly:stencil-translate black-stencil (cons d d))
       (ly:stencil-translate black-stencil (cons (- d) d))
       (ly:stencil-translate black-stencil (cons d (- d)))
       orig)))

#(define pptGlyphDoOutlined (make-outlined-glyph pptGlyphDo colorDo))




#(define (color-notehead-with-outline grob)
   (let* ((orig (ly:note-head::print grob))
          (col (ly:grob-property grob 'color #f)))
     (if (and col (list? col))
         (let* ((black-stencil (stencil-with-color orig black))
                (colored-stencil (stencil-with-color orig col))
                (d 0.08))
           (ly:stencil-add
             (ly:stencil-translate black-stencil (cons (- d) 0))
             (ly:stencil-translate black-stencil (cons d 0))
             (ly:stencil-translate black-stencil (cons 0 (- d)))
             (ly:stencil-translate black-stencil (cons 0 d))
             (ly:stencil-translate black-stencil (cons (- d) (- d)))
             (ly:stencil-translate black-stencil (cons d d))
             (ly:stencil-translate black-stencil (cons (- d) d))
             (ly:stencil-translate black-stencil (cons d (- d)))
             colored-stencil))
         orig)))
`;

export const DROP_NATURALS_SCHEME_DEFINITION = `#(define (drop-naturals-stencil grob)
   (let ((alt (ly:grob-property grob 'alteration 0)))
     (if (and (number? alt) (= alt 0))
         #f
         (ly:accidental-interface::print grob))))
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

/**
 * Compiles an onset stream into a complete LilyPond source string (.ly).
 * 
 * @param onsets - The resolved onset stream
 * @param options - Compilation options
 * @returns Formatted LilyPond document string
 */
export function getDefaultHarmonyOctaveShift(clef: string): number {
  const clean = clef.replace(/"/g, '').trim();
  if (clean === 'bass_15' || clean === 'F_15') return -3;
  if (clean === 'bass_8' || clean === 'F_8') return -2;
  if (clean.startsWith('bass') || clean.startsWith('F')) return -1;
  if (clean === 'treble_8' || clean === 'G_8') return -1;
  if (clean === 'treble^8' || clean === 'G^8') return 1;
  return 0;
}

export function compileToLilyPond(
  onsets: OnsetStream,
  options: CompileOptions = {},
): string {
  const version = options.lilypondVersion ?? '2.24.4';
  const melClef = options.melodyClef ?? 'treble';
  const harmClef = options.harmonyClef ?? 'treble';
  const showChordNames = options.showChordNames ?? true;
  const accStyle = options.accidentalStyle ?? 'forget';
  const harmShift =
    options.harmonyOctaveShift ?? getDefaultHarmonyOctaveShift(harmClef);
  const dur = options.durationToken ?? '4';

  const noteheadStyle = options.noteheadStyle ?? 'default';
  const omitStem = options.omitStem ?? false;
  const colorNotes = options.colorNotes ?? false;
  const noteheadOutline = options.noteheadOutline ?? (colorNotes ? true : false);
  const isTraditionalShapeNote = ['sacredHarp', 'aiken', 'funk', 'walker'].includes(noteheadStyle);
  const isShapeNoteMode = noteheadStyle === 'ppt' || isTraditionalShapeNote;
  const omitNaturals = options.omitNaturals ?? isShapeNoteMode;
  const forceAccidentals = isShapeNoteMode;

  const formatClef = (c: string) =>
    c.includes('_') || c.includes('^') || c.includes(' ') || c.startsWith('"')
      ? c.startsWith('"')
        ? c
        : `"${c}"`
      : c;

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
    `  \\clef ${formatClef(melClef)}`,
    `  \\accidentalStyle ${accStyle}`,
  ];


  // Configure shape noteheads aligned with Do (tonic)
  if (isTraditionalShapeNote) {
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
    `  \\clef ${formatClef(harmClef)}`,
    `  \\accidentalStyle ${accStyle}`,
  ];


  if (omitStem) {
    harmonyLines.push('  \\omit Stem');
  }

  harmonyLines.push('  \\cadenzaOn');

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
    }
    lastCoilId = onset.coilId;
    lastWeaveId = onset.weaveId;

    // Melody: \tag #'tag pitch4
    const melPitch = midiToLilyPondPitch(onset.midiNote, accMode, forceAccidentals);
    const stencilTweak = noteheadStyle === 'ppt'
      ? `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[onset.scaleDegree] ?? 'stencilDo'} `
      : '';
    const colorTweak = colorNotes
      ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[onset.scaleDegree] ?? 'colorDo'} `
      : '';
    melodyLines.push(`  \\tag #'${onset.tag} ${stencilTweak}${colorTweak}${melPitch}${dur}`);

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

  // Generate \header block
  const headerLines: string[] = [];
  if (options.title) headerLines.push(`  title = "${options.title.replace(/"/g, '\\"')}"`);
  if (options.subtitle) headerLines.push(`  subtitle = "${options.subtitle.replace(/"/g, '\\"')}"`);
  if (options.composer) headerLines.push(`  composer = "${options.composer.replace(/"/g, '\\"')}"`);
  if (options.arranger) headerLines.push(`  arranger = "${options.arranger.replace(/"/g, '\\"')}"`);
  if (options.poet) headerLines.push(`  poet = "${options.poet.replace(/"/g, '\\"')}"`);
  if (options.copyright) headerLines.push(`  copyright = "${options.copyright.replace(/"/g, '\\"')}"`);

  // Key anchor or piece header line
  if (options.piece) {
    headerLines.push(`  piece = "${options.piece.replace(/"/g, '\\"')}"`);
  } else if (options.doPitch && options.showKeyAnchor !== false) {
    const doPitchClass = options.doPitch.replace(/\d+$/, '');
    headerLines.push(
      `  piece = \\markup \\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = ${doPitchClass}" }`,
    );
  }

  // Tagline handling: default to false (suppresses "Music engraving by LilyPond")
  const tagline = options.tagline ?? false;
  if (tagline === false) {
    headerLines.push('  tagline = ##f');
  } else if (typeof tagline === 'string') {
    headerLines.push(`  tagline = "${tagline.replace(/"/g, '\\"')}"`);
  }

  const headerBlock = headerLines.length > 0
    ? `\n\\header {\n${headerLines.join('\n')}\n}\n`
    : '';

  let preambles = '';
  if (
    colorNotes ||
    noteheadStyle === 'ppt' ||
    (options.doPitch && options.showKeyAnchor !== false)
  ) {
    preambles += `\n${PPT_SCHEME_COLOR_DEFINITIONS}`;
  }
  if (omitNaturals) {
    preambles += `\n${DROP_NATURALS_SCHEME_DEFINITION}`;
  }


  const outlineLayoutContext = noteheadOutline
    ? `    \\context {
      \\Voice
      \\override NoteHead.stencil = #color-notehead-with-outline
    }\n`
    : '';

  const dropNaturalsContext = omitNaturals
    ? `      \\override Accidental.stencil = #drop-naturals-stencil\n`
    : '';

  return `\\version "${version}"
${preambles}${headerBlock}
melodyVoice = {
${melodyVoiceStr}
}


harmonyVoice = {
${harmonyVoiceStr}
}

\\score {
${scoreBody}
  \\layout {
${outlineLayoutContext}    \\context {
      \\Staff
      \\remove "Time_signature_engraver"
${dropNaturalsContext}    }
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
