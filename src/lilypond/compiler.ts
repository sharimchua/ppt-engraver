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
import { writeFileSync } from "node:fs";
import type { Onset, OnsetStream } from "../schema/onset.js";
import {
  midiToLilyPondPitch,
  chordMidiToLilyPond,
  LILYPOND_FLAT_NOTES,
  LILYPOND_SHARP_NOTES,
  SOLFEGE_TO_SCHEME_COLOR,
  SOLFEGE_TO_PPT_STENCIL,
} from "./pitch.js";
import {
  pitchNameToMidi,
  getAccidentalModeFromPitchName,
  parseHarmonyChord,
  getSolfegeGlyphSpec,
  semitoneIntervalToSolfege,
  SOLFEGE_POSITIONS,
} from "../solfege/pitch.js";
import { beatsToLilyPondDuration } from "../solfege/rhythm.js";

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
  /** Harmony staff rendering style: 'standard' (traditional 5-line staff), 'coil' (adds single-line staff with circle clef and solfège glyphs), or 'both' */
  harmonyStaffStyle?: "standard" | "coil" | "both";
  /** Whether to show the Harmony Coil staff (default: true when harmonyStaffStyle is 'coil' or 'both') */
  showHarmonyCoil?: boolean;
  /** Whether to show the traditional 5-line harmony staff (default: true) */
  showTraditionalHarmony?: boolean;
  /** Whether to show the melody staff (default: true) */
  showMelody?: boolean;
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute?: boolean;
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval?: boolean;
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil?: boolean;
  /** Whether to show chord names above the staff (default: true, reads directly from harmonyVoice) */
  showChordNames?: boolean;
  /** Whether to only display chord names when the chord changes (default: false, displaying every chord) */
  chordChanges?: boolean;
  /** Accidental spelling mode ('sharps' or 'flats', auto-detected if omitted) */
  accidentalMode?: "sharps" | "flats";
  /** Accidental style for unmetered notation (default: "forget" so all accidentals are explicitly engraved) */
  accidentalStyle?: string;
  /** Octave transposition for harmony triads */
  harmonyOctaveShift?: number;
  /** Global octave shift for harmony layer (alias for harmonyOctaveShift) */
  harmonyOctave?: number;
  /** Note duration placeholder string (default: "4" for quarter notes) */
  durationToken?: string;
  /** Notehead style: 'ppt' | 'sacredHarp' | 'aiken' | 'funk' | 'walker' | 'diamond' | 'default' */
  noteheadStyle?:
    "ppt" | "sacredHarp" | "aiken" | "funk" | "walker" | "diamond" | "default";
  /** Pitch name of Do anchor (e.g. "Eb4", "C4") to align shape note heads to Do */
  doPitch?: string;
  /** Whether to omit stems on noteheads */
  omitStem?: boolean;
  /** Whether to format note durations with traditional dotted values (e.g. 2., 4., 8.), open noteheads for half/whole, and visible rests */
  traditionalRhythms?: boolean;
  /** Alias for traditionalRhythms */
  traditionalDurations?: boolean;
  /** Whether to show harmony chords only when changed and at bar starts, using whole notehead durations (default: true) */
  harmonyChangesOnly?: boolean;
  /** Whether to colorize melody noteheads according to the PPT Solfège palette */
  colorNotes?: boolean;
  /** Whether to draw a dark outline around colored noteheads for contrast (default: true when colorNotes is true) */
  noteheadOutline?: boolean;
  /** Whether to omit natural accidental signs on unmetered staves with hidden key signatures (default: true in shape-note mode) */
  omitNaturals?: boolean;
  /** Global zoom / staff size scaling factor (e.g. 1.2 for +20%, 0.8 for -20%) or absolute pt size (e.g. 24) */
  zoom?: number;
  /** First-line indentation in mm (default: 0 for flush alignment) */
  indent?: number;
  /** Whether to draw light vertical grid lines indicating onset alignment */
  showRhythmGrid?: boolean;
  /** Harmony chord voicing projection style */
  harmonyVoicing?: string;
  /** Melody harmonic augmentation style */
  melodyAugmentation?: string;
  /** Visual presentation style for inferred melody augmentation notes */
  melodyAugmentationDisplay?:
    | "ghosted"
    | "dimmed"
    | "smallColored"
    | "smallMuted"
    | "parenthesized"
    | "diamond"
    | "normal";
  /** High-level arrangement / projection preset */
  projection?: string;
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
#(define colorRa (rgb-color (/ #xF9 255.0) (/ #x80 255.0) (/ #x16 255.0)))
#(define colorRe (rgb-color (/ #xF9 255.0) (/ #x80 255.0) (/ #x16 255.0)))
#(define colorMe (rgb-color (/ #xF5 255.0) (/ #xD4 255.0) (/ #x32 255.0)))
#(define colorMi (rgb-color (/ #xF5 255.0) (/ #xD4 255.0) (/ #x32 255.0)))
#(define colorFa (rgb-color (/ #x43 255.0) (/ #xA4 255.0) (/ #x40 255.0)))
#(define colorFi (rgb-color (/ #x14 255.0) (/ #x14 255.0) (/ #x14 255.0)))
#(define colorSo (rgb-color (/ #x00 255.0) (/ #x32 255.0) (/ #xA4 255.0)))
#(define colorLe (rgb-color (/ #x53 255.0) (/ #x00 255.0) (/ #xA4 255.0)))
#(define colorLa (rgb-color (/ #x53 255.0) (/ #x00 255.0) (/ #xA4 255.0)))
#(define colorTe (rgb-color (/ #xF1 255.0) (/ #x58 255.0) (/ #xA4 255.0)))
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

#(define pptPathBase
   '(moveto 0.262 0.806
     lineto 0.389 0.674
     lineto 0.559 0.498
     lineto 0.750 0.302
     lineto 0.848 0.000
     lineto 0.750 -0.302
     lineto 0.714 -0.412
     lineto 0.686 -0.498
     lineto 0.405 -0.702
     lineto 0.262 -0.806
     lineto 0.000 -0.848
     lineto -0.262 -0.806
     lineto -0.405 -0.702
     lineto -0.686 -0.498
     lineto -0.714 -0.412
     lineto -0.750 -0.302
     lineto -0.848 0.000
     lineto -0.750 0.302
     lineto -0.559 0.498
     lineto -0.389 0.674
     lineto -0.262 0.806
     lineto -0.250 0.432
     lineto -0.330 0.381
     lineto -0.407 0.292
     lineto -0.440 0.254
     lineto -0.473 0.216
     lineto -0.483 0.142
     lineto -0.504 0.000
     lineto -0.483 -0.142
     lineto -0.445 -0.226
     lineto -0.393 -0.340
     lineto -0.330 -0.381
     lineto -0.250 -0.432
     lineto -0.209 -0.458
     lineto -0.147 -0.498
     lineto 0.000 -0.504
     lineto 0.147 -0.498
     lineto 0.209 -0.458
     lineto 0.250 -0.432
     lineto 0.330 -0.381
     lineto 0.393 -0.340
     lineto 0.445 -0.226
     lineto 0.483 -0.142
     lineto 0.504 0.000
     lineto 0.483 0.142
     lineto 0.473 0.216
     lineto 0.440 0.254
     lineto 0.407 0.292
     lineto 0.330 0.381
     lineto 0.250 0.432
     closepath))

#(define pptPathSharp
   '(moveto 0.00 1.00
     lineto 0.00 0.807
     lineto 0.001 0.806
     lineto 0.262 0.806
     lineto 0.389 0.674
     lineto 0.447 0.615
     lineto 0.462 0.599
     lineto 0.559 0.498
     lineto 0.288 0.498
     lineto 0.148 0.740
     lineto 0.110 0.806
     lineto 0.000 0.806
     lineto 0.000 0.520
     lineto 0.072 0.499
     lineto 0.146 0.499
     lineto 0.147 0.498
     lineto 0.073 0.498
     lineto 0.209 0.458
     lineto 0.250 0.432
     lineto 0.330 0.381
     lineto 0.407 0.292
     lineto 0.424 0.272
     lineto 0.440 0.254
     lineto 0.473 0.216
     lineto 0.480 0.165
     lineto 0.483 0.142
     lineto 0.504 0.000
     lineto 0.514 -0.074
     lineto 0.483 -0.142
     lineto 0.445 -0.226
     lineto 0.434 -0.250
     lineto 0.424 -0.272
     lineto 0.393 -0.340
     lineto 0.371 -0.354
     lineto 0.330 -0.381
     lineto 0.250 -0.432
     lineto 0.209 -0.458
     lineto 0.147 -0.498
     lineto 0.146 -0.499
     lineto -0.146 -0.499
     lineto -0.147 -0.498
     lineto -0.209 -0.458
     lineto -0.250 -0.432
     lineto -0.330 -0.381
     lineto -0.371 -0.354
     lineto -0.393 -0.340
     lineto -0.424 -0.272
     lineto -0.434 -0.250
     lineto -0.445 -0.226
     lineto -0.483 -0.142
     lineto -0.514 -0.074
     lineto -0.504 0.000
     lineto -0.483 0.142
     lineto -0.480 0.165
     lineto -0.473 0.216
     lineto -0.440 0.254
     lineto -0.424 0.272
     lineto -0.407 0.292
     lineto -0.330 0.381
     lineto -0.250 0.432
     lineto -0.257 0.444
     lineto -0.288 0.498
     lineto -0.560 0.498
     lineto -0.668 0.386
     lineto -0.697 0.356
     lineto -0.750 0.302
     lineto -0.848 0.000
     lineto -0.750 -0.302
     lineto -0.714 -0.412
     lineto -0.686 -0.498
     lineto -0.405 -0.702
     lineto -0.262 -0.806
     lineto 0.262 -0.806
     lineto 0.110 -0.806
     lineto 0.262 -0.806
     lineto 0.405 -0.702
     lineto 0.686 -0.498
     lineto 0.714 -0.412
     lineto 0.750 -0.302
     lineto 0.848 0.000
     lineto 0.750 0.302
     lineto 0.811 0.408
     lineto 0.863 0.498
     lineto 0.866 0.500
     lineto 0.707 0.707
     lineto 0.500 0.866
     lineto 0.259 0.966
     lineto 0.000 1.000
     closepath))

#(define pptPathFlat
   '(moveto 0.00 1.00
     lineto -0.259 0.966
     lineto -0.500 0.866
     lineto -0.707 0.707
     lineto -0.866 0.500
     lineto -0.863 0.498
     lineto -0.811 0.408
     lineto -0.750 0.302
     lineto -0.848 0.000
     lineto -0.750 -0.302
     lineto -0.714 -0.412
     lineto -0.686 -0.498
     lineto -0.405 -0.702
     lineto -0.262 -0.806
     lineto 0.262 -0.806
     lineto 0.110 -0.806
     lineto 0.262 -0.806
     lineto 0.405 -0.702
     lineto 0.686 -0.498
     lineto 0.714 -0.412
     lineto 0.750 -0.302
     lineto 0.848 0.000
     lineto 0.750 0.302
     lineto 0.697 0.356
     lineto 0.668 0.386
     lineto 0.559 0.498
     lineto 0.288 0.498
     lineto 0.257 0.444
     lineto 0.250 0.432
     lineto 0.330 0.381
     lineto 0.407 0.292
     lineto 0.424 0.272
     lineto 0.440 0.254
     lineto 0.473 0.216
     lineto 0.480 0.165
     lineto 0.483 0.142
     lineto 0.504 0.000
     lineto 0.514 -0.074
     lineto 0.483 -0.142
     lineto 0.445 -0.226
     lineto 0.434 -0.250
     lineto 0.424 -0.272
     lineto 0.393 -0.340
     lineto 0.371 -0.354
     lineto 0.330 -0.381
     lineto 0.250 -0.432
     lineto 0.209 -0.458
     lineto 0.147 -0.498
     lineto 0.146 -0.499
     lineto -0.146 -0.499
     lineto -0.147 -0.498
     lineto -0.209 -0.458
     lineto -0.250 -0.432
     lineto -0.330 -0.381
     lineto -0.371 -0.354
     lineto -0.393 -0.340
     lineto -0.424 -0.272
     lineto -0.434 -0.250
     lineto -0.445 -0.226
     lineto -0.483 -0.142
     lineto -0.514 -0.074
     lineto -0.504 0.000
     lineto -0.483 0.142
     lineto -0.480 0.165
     lineto -0.473 0.216
     lineto -0.440 0.254
     lineto -0.424 0.272
     lineto -0.407 0.292
     lineto -0.330 0.381
     lineto -0.250 0.432
     lineto -0.209 0.458
     lineto -0.073 0.498
     lineto -0.147 0.498
     lineto -0.146 0.499
     lineto -0.072 0.499
     lineto 0.000 0.520
     lineto 0.000 0.806
     lineto -0.110 0.806
     lineto -0.148 0.740
     lineto -0.288 0.498
     lineto -0.560 0.498
     lineto -0.463 0.599
     lineto -0.447 0.615
     lineto -0.389 0.675
     lineto -0.262 0.806
     lineto -0.001 0.806
     lineto 0.000 0.807
     lineto 0.000 1.000
     closepath))

#(define (make-solfege-glyph base-path rot-deg fill-col has-axis?)
   (let* ((raw-stencil (make-path-stencil base-path 0.0 0.9 0.9 #t))
          (rotated-stencil (if (= rot-deg 0)
                               raw-stencil
                               (ly:stencil-rotate raw-stencil rot-deg 0 0)))
          (axis-stencil (if has-axis?
                            (ly:stencil-rotate (make-line-stencil 0.12 -0.95 0.0 0.95 0.0) rot-deg 0 0)
                            empty-stencil))
          (combined (if has-axis?
                        (ly:stencil-add rotated-stencil axis-stencil)
                        rotated-stencil))
          (colored (if fill-col (stencil-with-color combined fill-col) combined))
          (black-stencil (stencil-with-color combined black))
          (d 0.07)
          (outlined (ly:stencil-add
                      (ly:stencil-translate black-stencil (cons (- d) 0))
                      (ly:stencil-translate black-stencil (cons d 0))
                      (ly:stencil-translate black-stencil (cons 0 (- d)))
                      (ly:stencil-translate black-stencil (cons 0 d))
                      (ly:stencil-translate black-stencil (cons (- d) (- d)))
                      (ly:stencil-translate black-stencil (cons d d))
                      (ly:stencil-translate black-stencil (cons (- d) d))
                      (ly:stencil-translate black-stencil (cons d (- d)))
                      colored))
          (centered (ly:stencil-aligned-to (ly:stencil-aligned-to outlined X CENTER) Y CENTER)))
     (ly:stencil-translate centered (cons 0.65 0))))

#(define (make-solfege-glyph-sub base-path rot-deg fill-col has-axis?)
   (ly:stencil-scale (make-solfege-glyph base-path rot-deg fill-col has-axis?) 0.55 0.55))

#(define (make-solfege-glyph-with-prefix base-path rot-deg fill-col has-axis? dox-count)
   (let* ((main-stencil (make-solfege-glyph base-path rot-deg fill-col has-axis?))
          (dox-base (make-solfege-glyph pptPathBase 0 colorDo #t)))
     (let loop ((count dox-count)
                (res main-stencil))
       (if (<= count 0)
           res
           (let* ((offset (* (- count) 1.8))
                  (shifted-dox (ly:stencil-translate-axis dox-base offset X)))
             (loop (- count 1) (ly:stencil-add res shifted-dox)))))))

#(define pptGlyphDo (make-path-stencil pptPathBase 0.0 0.9 0.9 #t))
#(define pptGlyphDoOutlined (make-solfege-glyph pptPathBase 0 colorDo #f))

#(define (color-notehead-with-outline grob)
   (let* ((orig (ly:note-head::print grob))
          (col (ly:grob-property grob 'color #f))
          (dur-log (ly:grob-property grob 'duration-log 2)))
     (if (and col (list? col))
         (if (<= dur-log 1)
             ;; Whole / half notes: fill interior with Solfège color, overlaid with black whole notehead outline
             (let* ((fill-glyph (grob-interpret-markup grob (markup #:musicglyph "noteheads.s2")))
                    (colored-fill (stencil-with-color fill-glyph col))
                    (black-outline (stencil-with-color orig black)))
               (ly:stencil-add colored-fill black-outline))
             ;; Quarter notes or shorter: solid colored notehead with 8-directional contrast outline
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
                 colored-stencil)))
         orig)))

#(define (ppt-row-band-stencil grob)
   (let* ((orig (ly:staff-symbol::print grob))
          (ext-x (if (ly:stencil? orig) (ly:stencil-extent orig X) '(-0.5 . 0.5)))
          (ext-y (if (ly:stencil? orig) (ly:stencil-extent orig Y) '(-2.0 . 2.0)))
          (bg-col (rgb-color 0.94 0.95 0.97))
          (edge-col (rgb-color 0.70 0.72 0.76))
          (bg-box (stencil-with-color
                    (make-filled-box-stencil ext-x ext-y)
                    bg-col))
          (edges (if (ly:stencil? orig)
                     (stencil-with-color orig edge-col)
                     empty-stencil)))
     (ly:stencil-add bg-box edges)))

#(define (make-clef-text-stencil text-str)
   (lambda (grob)
     (let* ((stc (grob-interpret-markup grob (markup #:vcenter #:bold #:fontsize -1.5 text-str)))
            (centered-y (ly:stencil-aligned-to stc Y CENTER)))
       centered-y)))

#(define pptClefMStencil (make-clef-text-stencil "M"))
#(define pptClefHStencil (make-clef-text-stencil "H"))
#(define pptClefRStencil (make-clef-text-stencil "R"))

#(define (make-grid-point-stencil grob)
   (let* ((col (x11-color 'gray80))
          (dash-len 0.6)
          (space-len 0.4)
          (thickness 0.12)
          (y-bottom -2.5)
          (y-top 2.5))
     (let loop ((y y-bottom)
                (res empty-stencil))
       (if (>= y y-top)
           (stencil-with-color res col)
           (let* ((next-y (min (+ y dash-len) y-top))
                  (seg (make-line-stencil thickness 0.0 y 0.0 next-y)))
             (loop (+ next-y space-len) (ly:stencil-add res seg)))))))
`;

/**
 * Converts a harmony chord token (e.g. "Do", "DoMe", "Dox", "DoxMe", "DoTe")
 * into a LilyPond markup string using rotated and outlined Solfège glyphs.
 */
export function chordTokenToCoilMarkup(token: string): string {
  const parsed = parseHarmonyChord(token);

  let bassStencil = "";
  if (parsed.hasAxisBass && parsed.bassSyllable) {
    const bassSpec = getSolfegeGlyphSpec(parsed.bassSyllable, true);
    const bassPathVar =
      bassSpec.glyphType === "base"
        ? "pptPathBase"
        : bassSpec.glyphType === "sharp"
          ? "pptPathSharp"
          : "pptPathFlat";
    bassStencil = `\\stencil #(make-solfege-glyph ${bassPathVar} ${bassSpec.rotation} ${bassSpec.colorSchemeVar} #t) `;
  }

  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";
  const rootStencil = `\\stencil #(make-solfege-glyph ${basePathVar} ${rootSpec.rotation} ${rootSpec.colorSchemeVar} ${rootAxisBool})`;

  if (parsed.modifiers.length === 0 && !bassStencil) {
    return `\\markup \\vcenter { ${rootStencil} }`;
  }

  const modifierStencils = parsed.modifiers.map((mod) => {
    const modSpec = getSolfegeGlyphSpec(mod.syllable, mod.hasAxis);
    const modPathVar =
      modSpec.glyphType === "base"
        ? "pptPathBase"
        : modSpec.glyphType === "sharp"
          ? "pptPathSharp"
          : "pptPathFlat";
    const modAxisBool = modSpec.hasAxis ? "#t" : "#f";
    return `\\lower #0.35 \\stencil #(make-solfege-glyph-sub ${modPathVar} ${modSpec.rotation} ${modSpec.colorSchemeVar} ${modAxisBool})`;
  });

  return `\\markup \\vcenter \\concat { ${bassStencil}${rootStencil} ${modifierStencils.join(" ")} }`;
}

/**
 * Converts a rhythm token (e.g. "Do", "Fi", "DoxDo", "DoxFi", "LeFi")
 * into a LilyPond markup string. Dox prefixes are rendered adjacent to the main syllable.
 */
export function rhythmTokenToCoilMarkup(token: string): string {
  const parsed = parseHarmonyChord(token);
  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";

  const rootStencil = `\\stencil #(make-solfege-glyph ${basePathVar} ${rootSpec.rotation} ${rootSpec.colorSchemeVar} ${rootAxisBool})`;

  if (parsed.modifiers.length === 0) {
    return `\\markup \\vcenter { ${rootStencil} }`;
  }

  const modifierStencils = parsed.modifiers.map((mod) => {
    const modSpec = getSolfegeGlyphSpec(mod.syllable, mod.hasAxis);
    const modPathVar =
      modSpec.glyphType === "base"
        ? "pptPathBase"
        : modSpec.glyphType === "sharp"
          ? "pptPathSharp"
          : "pptPathFlat";
    const modAxisBool = modSpec.hasAxis ? "#t" : "#f";
    return `\\lower #0.35 \\stencil #(make-solfege-glyph-sub ${modPathVar} ${modSpec.rotation} ${modSpec.colorSchemeVar} ${modAxisBool})`;
  });

  return `\\markup \\vcenter \\concat { ${rootStencil} ${modifierStencils.join(" ")} }`;
}

export const DROP_NATURALS_SCHEME_DEFINITION = `#(define (drop-naturals-stencil grob)
   (let ((alt (ly:grob-property grob 'alteration 0)))
     (if (and (number? alt) (= alt 0))
         #f
         (ly:accidental-interface::print grob))))
`;

/**
 * Compiles an onset stream into a complete LilyPond source string (.ly).
 *
 * @param onsets - The resolved onset stream
 * @param options - Compilation options
 * @returns Formatted LilyPond document string
 */
export function getDefaultHarmonyOctaveShift(clef: string): number {
  const clean = clef.replace(/"/g, "").trim();
  if (clean === "bass_15" || clean === "F_15") return -3;
  if (clean === "bass_8" || clean === "F_8") return -2;
  if (clean.startsWith("bass") || clean.startsWith("F")) return -1;
  if (clean === "treble_8" || clean === "G_8") return -1;
  if (clean === "treble^8" || clean === "G^8") return 1;
  return 0;
}

/**
 * Computes manual LilyPond beaming brackets ('[' for start beam, ']' for end beam)
 * for a sequence of onsets within a single voice and coil.
 *
 * Beaming groups consecutive non-rest onsets with duration < 1 beat (e.g. 8th notes, 16th notes, triplets)
 * that fall within the same quarter-note beat window (Math.floor(startBeat)).
 */
export function computeOnsetBeaming(onsets: Onset[]): Map<number, "[" | "]"> {
  const beamMap = new Map<number, "[" | "]">();
  let currentGroup: number[] = [];
  let currentBeat = -1;

  for (let i = 0; i < onsets.length; i++) {
    const o = onsets[i];
    const durBeats = o.durationBeats ?? 1.0;
    const startBeat = o.startBeat ?? i;
    const beatIndex = Math.floor(startBeat + 1e-5);
    const isBeamable = !o.isRest && durBeats < 1.0 - 1e-5;

    if (isBeamable && beatIndex === currentBeat) {
      currentGroup.push(i);
    } else {
      if (currentGroup.length >= 2) {
        beamMap.set(currentGroup[0], "[");
        beamMap.set(currentGroup[currentGroup.length - 1], "]");
      }
      if (isBeamable) {
        currentGroup = [i];
        currentBeat = beatIndex;
      } else {
        currentGroup = [];
        currentBeat = -1;
      }
    }
  }

  if (currentGroup.length >= 2) {
    beamMap.set(currentGroup[0], "[");
    beamMap.set(currentGroup[currentGroup.length - 1], "]");
  }

  return beamMap;
}

export function compileToLilyPond(
  onsets: OnsetStream,
  options: CompileOptions = {},
): string {
  const version = options.lilypondVersion ?? "2.24.4";
  const melClef = options.melodyClef ?? "treble";
  const harmClef = options.harmonyClef ?? "treble";
  const showChordNames = options.showChordNames ?? true;
  const accStyle = options.accidentalStyle ?? "forget";
  const harmShift =
    options.harmonyOctaveShift ?? getDefaultHarmonyOctaveShift(harmClef);
  const dur = options.durationToken ?? "4";

  const noteheadStyle = options.noteheadStyle ?? "default";
  const omitStem = options.omitStem ?? false;
  const traditionalRhythms =
    options.traditionalRhythms ?? options.traditionalDurations ?? false;
  const colorNotes = options.colorNotes ?? false;
  const noteheadOutline =
    options.noteheadOutline ?? (colorNotes ? true : false);
  const isTraditionalShapeNote = [
    "sacredHarp",
    "aiken",
    "funk",
    "walker",
  ].includes(noteheadStyle);
  const isShapeNoteMode = noteheadStyle === "ppt" || isTraditionalShapeNote;
  const omitNaturals = options.omitNaturals ?? isShapeNoteMode;
  const forceAccidentals = isShapeNoteMode;

  const formatClef = (c: string) =>
    c.includes("_") || c.includes("^") || c.includes(" ") || c.startsWith('"')
      ? c.startsWith('"')
        ? c
        : `"${c}"`
      : c;

  const accMode =
    options.accidentalMode ??
    (onsets.some(
      (o) =>
        o.pitch.includes("b") ||
        o.pitch.includes("♭") ||
        o.chordTones.some((ct) => ct.includes("b")),
    )
      ? "flats"
      : "sharps");

  const melodyLines: string[] = [
    `  \\clef ${formatClef(melClef)}`,
    `  \\accidentalStyle ${accStyle}`,
  ];

  // Configure shape noteheads aligned with Do (tonic)
  if (isTraditionalShapeNote) {
    let tonicDutch = "c";
    if (options.doPitch) {
      try {
        const midi = pitchNameToMidi(options.doPitch);
        const pc = ((midi % 12) + 12) % 12;
        const tonicAccMode = getAccidentalModeFromPitchName(options.doPitch);
        tonicDutch = (
          tonicAccMode === "flats" ? LILYPOND_FLAT_NOTES : LILYPOND_SHARP_NOTES
        )[pc];
      } catch {
        tonicDutch = "c";
      }
    }

    melodyLines.push(`  \\key ${tonicDutch} \\major`);
    melodyLines.push("  \\omit Staff.KeySignature");
    if (noteheadStyle === "sacredHarp") {
      melodyLines.push("  \\sacredHarpHeads");
    } else if (noteheadStyle === "aiken") {
      melodyLines.push("  \\aikenHeads");
    } else if (noteheadStyle === "funk") {
      melodyLines.push("  \\funkHeads");
    } else if (noteheadStyle === "walker") {
      melodyLines.push("  \\walkerHeads");
    }
  } else if (noteheadStyle === "diamond") {
    melodyLines.push("  \\override NoteHead.style = #'diamond");
  }

  if (omitStem) {
    melodyLines.push("  \\omit Stem");
    melodyLines.push("  \\omit Flag");
    melodyLines.push("  \\omit Beam");
    melodyLines.push("  \\omit Dots");
  }

  if (!traditionalRhythms) {
    melodyLines.push("  \\override NoteHead.duration-log = #2");
  }
  melodyLines.push("  \\cadenzaOn");
  const isMultiVoice = onsets.some((o) => (o.voiceIndex ?? 1) > 1);
  const voiceIndices = isMultiVoice
    ? Array.from(new Set(onsets.map((o) => o.voiceIndex ?? 1))).sort((a, b) => a - b)
    : [1];

  // Group all onsets by contiguous coil segment for aligned multi-voice rendering
  interface CoilGroup {
    weaveId: string;
    coilId: string;
    onsets: Onset[];
  }
  const coilGroups: CoilGroup[] = [];
  let currentGroup: CoilGroup | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    const isNewCoil =
      !currentGroup ||
      (onset.onsetIndex === 1 && (onset.voiceIndex ?? 1) === 1 && currentGroup.onsets.length > 0) ||
      onset.coilId !== currentGroup.coilId ||
      onset.weaveId !== currentGroup.weaveId;

    if (isNewCoil) {
      if (currentGroup) {
        coilGroups.push(currentGroup);
      }
      currentGroup = {
        weaveId: onset.weaveId,
        coilId: onset.coilId,
        onsets: [onset],
      };
    } else if (currentGroup) {
      currentGroup.onsets.push(onset);
    }
  }
  if (currentGroup) {
    coilGroups.push(currentGroup);
  }



  const augDisplay = options.melodyAugmentationDisplay ?? "ghosted";

  function formatMelodyNote(onset: Onset, beamBracket: string = ""): string {
    const onsetDur =
      traditionalRhythms && onset.durationBeats !== undefined
        ? beatsToLilyPondDuration(onset.durationBeats, true)
        : (onset.duration ?? dur);
    if (onset.isRest) {
      const restPrefix = traditionalRhythms ? "r" : "s";
      return `${restPrefix}${onsetDur}`;
    }

    const primaryPitch = midiToLilyPondPitch(
      onset.midiNote,
      accMode,
      forceAccidentals,
    );
    const primaryStencil =
      noteheadStyle === "ppt"
        ? `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[onset.scaleDegree] ?? "stencilDo"} `
        : "";
    const primaryColor = colorNotes
      ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[onset.scaleDegree] ?? "colorDo"} `
      : "";

    const augNotes = onset.melodyAugmentationNotes;
    if (!augNotes || augNotes.length === 0) {
      return `${primaryStencil}${primaryColor}${primaryPitch}${onsetDur}${beamBracket}`;
    }

    // Composite chord for melody + inferred companion notes
    const noteTokens: string[] = [];
    noteTokens.push(`${primaryStencil}${primaryColor}${primaryPitch}`);

    for (const aug of augNotes) {
      const augPitch = midiToLilyPondPitch(aug.midiNote, accMode, forceAccidentals);
      let tweakPrefix = "";

      if (augDisplay === "parenthesized") {
        tweakPrefix += "\\parenthesize ";
      } else if (augDisplay === "diamond") {
        tweakPrefix += "\\tweak NoteHead.style #'diamond ";
      }

      if (augDisplay === "ghosted" || augDisplay === "dimmed") {
        // Dimmed / translucent notehead with Solfège stencil and muted gray color
        tweakPrefix += "\\tweak font-size #-2 \\tweak color #(x11-color 'gray60) ";
        if (noteheadStyle === "ppt") {
          tweakPrefix += `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[aug.scaleDegree] ?? "stencilDo"} `;
        }
      } else if (augDisplay === "smallColored") {
        tweakPrefix += "\\tweak font-size #-3 ";
        if (noteheadStyle === "ppt") {
          tweakPrefix += `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[aug.scaleDegree] ?? "stencilDo"} `;
        }
        if (colorNotes) {
          tweakPrefix += `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[aug.scaleDegree] ?? "colorDo"} `;
        }
      } else if (augDisplay === "smallMuted") {
        tweakPrefix += "\\tweak font-size #-3 \\tweak color #(x11-color 'gray60) ";
      } else if (augDisplay === "normal") {
        if (noteheadStyle === "ppt") {
          tweakPrefix += `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[aug.scaleDegree] ?? "stencilDo"} `;
        }
        if (colorNotes) {
          tweakPrefix += `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[aug.scaleDegree] ?? "colorDo"} `;
        }
      }

      noteTokens.push(`${tweakPrefix}${augPitch}`);
    }

    return `<${noteTokens.join(" ")}>${onsetDur}${beamBracket}`;
  }

  if (isMultiVoice) {
    melodyLines.push("  <<");
    const voiceCommands = ["\\voiceOne", "\\voiceTwo", "\\voiceThree", "\\voiceFour"];

    for (let vIdx = 0; vIdx < voiceIndices.length; vIdx++) {
      const vNum = voiceIndices[vIdx];
      const voiceCmd = voiceCommands[vIdx] ?? "\\voiceOne";

      melodyLines.push(`    \\new Voice = "v${vNum}" {`);
      melodyLines.push(`      ${voiceCmd}`);
      if (omitStem) {
        melodyLines.push("      \\omit Stem");
        melodyLines.push("      \\omit Flag");
        melodyLines.push("      \\omit Beam");
        melodyLines.push("      \\omit Dots");
      }

      for (let c = 0; c < coilGroups.length; c++) {
        const group = coilGroups[c];
        if (c > 0) {
          melodyLines.push('      \\bar "|"');
        }
        const vOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === vNum);
        if (vOnsets.length > 0) {
          const beamMap = computeOnsetBeaming(vOnsets);
          for (let idx = 0; idx < vOnsets.length; idx++) {
            const onset = vOnsets[idx];
            const beamBracket = beamMap.get(idx) ?? "";
            const formatted = formatMelodyNote(onset, beamBracket);
            melodyLines.push(
              `      \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melody_v${vNum}_${onset.onsetIndex} ${formatted}`,
            );
          }
        } else {
          // Coil has no notes for this voice: fill with skips matching primary voice onsets
          const primaryGroupOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === 1);
          for (const pOnset of primaryGroupOnsets) {
            const onsetDur = pOnset.duration ?? dur;
            melodyLines.push(`      s${onsetDur}`);
          }
        }
      }
      if (coilGroups.length > 0) {
        melodyLines.push('      \\bar "|."');
      }
      melodyLines.push("    }");
    }
    melodyLines.push("  >>");
    melodyLines.push("  \\cadenzaOff");
  } else {
    for (let c = 0; c < coilGroups.length; c++) {
      const group = coilGroups[c];
      if (c > 0) {
        melodyLines.push('  \\bar "|"');
      }
      const beamMap = computeOnsetBeaming(group.onsets);
      for (let idx = 0; idx < group.onsets.length; idx++) {
        const onset = group.onsets[idx];
        const beamBracket = beamMap.get(idx) ?? "";
        const formatted = formatMelodyNote(onset, beamBracket);
        melodyLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melody_${onset.onsetIndex} ${formatted}`,
        );
      }
    }

    if (onsets.length > 0) {
      melodyLines.push('  \\bar "|."');
    }
    melodyLines.push("  \\cadenzaOff");
  }

  const harmonyStaffStyle = options.harmonyStaffStyle ?? "standard";
  const showMelody = options.showMelody ?? true;
  const showMelodyCoilAbsolute = options.showMelodyCoilAbsolute ?? false;
  const showMelodyCoilInterval = options.showMelodyCoilInterval ?? false;
  const showRhythmCoil = options.showRhythmCoil ?? false;
  const showTraditionalHarmony = options.showTraditionalHarmony ?? true;
  const showHarmonyCoil =
    options.showHarmonyCoil ??
    (harmonyStaffStyle === "coil" || harmonyStaffStyle === "both");
  const harmonyChangesOnly = options.harmonyChangesOnly ?? true;

  const VOICE_NUMBER_WORDS = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  ];
  const voiceNumberToWord = (n: number) => VOICE_NUMBER_WORDS[n] ?? `V${n}`;

  const primaryOnsets = isMultiVoice ? onsets.filter((o) => (o.voiceIndex ?? 1) === 1) : onsets;

  // ---------------------------------------------------------------------------
  // 1. Melody Coil Absolute Voice(s) (Row band displaying absolute Solfège pitch classes)
  // ---------------------------------------------------------------------------
  const melodyCoilAbsoluteVoiceMap = new Map<number, string>();
  const melodyCoilAbsoluteLinesSingle: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];

  if (showMelodyCoilAbsolute) {
    if (isMultiVoice) {
      for (const v of voiceIndices) {
        const vLines: string[] = [
          "  \\override NoteHead.stencil = #ly:text-interface::print",
          "  \\cadenzaOn",
        ];
        for (let c = 0; c < coilGroups.length; c++) {
          const group = coilGroups[c];
          if (c > 0) {
            vLines.push('  \\bar "|"');
          }
          const vOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === v);
          if (vOnsets.length > 0) {
            for (const onset of vOnsets) {
              const onsetDur = onset.duration ?? dur;
              if (onset.isRest) {
                vLines.push(`  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyAbs_v${v}_${onset.onsetIndex} s${onsetDur}`);
              } else {
                const markup = chordTokenToCoilMarkup(onset.scaleDegree);
                vLines.push(
                  `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyAbs_v${v}_${onset.onsetIndex} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
                );
              }
            }
          } else {
            // Coil has no notes for this voice: fill with skips matching primary onsets
            const primaryGroupOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === 1);
            for (const pOnset of primaryGroupOnsets) {
              const onsetDur = pOnset.duration ?? dur;
              vLines.push(`  s${onsetDur}`);
            }
          }
        }
        if (coilGroups.length > 0) {
          vLines.push('  \\bar "|."');
        }
        vLines.push("  \\cadenzaOff");
        melodyCoilAbsoluteVoiceMap.set(v, vLines.join("\n"));
      }
    } else {
      let lastAbsCoilId: string | null = null;
      let lastAbsWeaveId: string | null = null;
      for (let i = 0; i < onsets.length; i++) {
        const onset = onsets[i];
        if (
          i > 0 &&
          (onset.onsetIndex === 1 ||
            onset.coilId !== lastAbsCoilId ||
            onset.weaveId !== lastAbsWeaveId)
        ) {
          melodyCoilAbsoluteLinesSingle.push('  \\bar "|"');
        }
        lastAbsCoilId = onset.coilId;
        lastAbsWeaveId = onset.weaveId;
        const onsetDur = onset.duration ?? dur;
        if (onset.isRest) {
          melodyCoilAbsoluteLinesSingle.push(`  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyAbs_${onset.onsetIndex} s${onsetDur}`);
        } else {
          const markup = chordTokenToCoilMarkup(onset.scaleDegree);
          melodyCoilAbsoluteLinesSingle.push(
            `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyAbs_${onset.onsetIndex} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
          );
        }
      }
      if (onsets.length > 0) {
        melodyCoilAbsoluteLinesSingle.push('  \\bar "|."');
      }
      melodyCoilAbsoluteLinesSingle.push("  \\cadenzaOff");
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Melody Coil Interval Voice (Row band displaying relative interval Solfège glyphs)
  // ---------------------------------------------------------------------------
  const melodyCoilIntervalLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];
  if (showMelodyCoilInterval) {
    let lastIntCoilId: string | null = null;
    let lastIntWeaveId: string | null = null;
    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== lastIntCoilId ||
          onset.weaveId !== lastIntWeaveId);

      if (isNewCoil) {
        melodyCoilIntervalLines.push('  \\bar "|"');
      }
      lastIntCoilId = onset.coilId;
      lastIntWeaveId = onset.weaveId;

      const onsetDur = onset.duration ?? dur;
      if (onset.isRest) {
        melodyCoilIntervalLines.push(`  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyInt_${onset.onsetIndex} s${onsetDur}`);
      } else {
        let token: string;
        if (i === 0 || isNewCoil) {
          // Anchor note at start of coil: absolute scale degree with axis marker (x)
          token = `${onset.scaleDegree}x`;
        } else {
          // Subsequent note: interval from previous non-rest pitch
          let prevMidi = primaryOnsets[i - 1].midiNote;
          for (let p = i - 1; p >= 0; p--) {
            if (!primaryOnsets[p].isRest) {
              prevMidi = primaryOnsets[p].midiNote;
              break;
            }
          }
          const diff = onset.midiNote - prevMidi;
          token = semitoneIntervalToSolfege(diff);
        }
        const markup = chordTokenToCoilMarkup(token);
        melodyCoilIntervalLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_melodyInt_${onset.onsetIndex} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
        );
      }
    }
    melodyCoilIntervalLines.push('  \\bar "|."');
  }
  melodyCoilIntervalLines.push("  \\cadenzaOff");

  // ---------------------------------------------------------------------------
  // 3. Unified Collapsed Rhythm Coil Voice (Row band displaying collapsed Solfège rhythm tokens)
  // ---------------------------------------------------------------------------
  const rhythmCoilLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];

  if (showRhythmCoil) {
    for (let g = 0; g < coilGroups.length; g++) {
      const group = coilGroups[g];
      if (g > 0) {
        rhythmCoilLines.push('  \\bar "|"');
      }

      // Collect distinct start timestamps within this coil group
      const timestampMap = new Map<number, { rhythmToken?: string }>();
      let maxEndBeat = 0;

      for (const o of group.onsets) {
        const start = o.startBeat ?? (o.onsetIndex - 1);
        const durB = o.durationBeats ?? 1.0;
        const end = start + durB;
        if (end > maxEndBeat) {
          maxEndBeat = end;
        }

        const existing = timestampMap.get(start);
        if (!existing) {
          timestampMap.set(start, { rhythmToken: o.rhythmToken });
        } else if (!existing.rhythmToken && o.rhythmToken) {
          existing.rhythmToken = o.rhythmToken;
        }
      }

      // Sort distinct timestamps
      const sortedTimes = Array.from(timestampMap.keys()).sort((a, b) => a - b);
      if (sortedTimes.length === 0) {
        sortedTimes.push(0);
        maxEndBeat = 1.0;
      }

      for (let tIdx = 0; tIdx < sortedTimes.length; tIdx++) {
        const startBeat = sortedTimes[tIdx];
        const nextBeat = tIdx < sortedTimes.length - 1 ? sortedTimes[tIdx + 1] : maxEndBeat;
        const durationBeats = Math.max(0.125, nextBeat - startBeat);
        const durationStr = beatsToLilyPondDuration(durationBeats);

        let rhythmToken = timestampMap.get(startBeat)?.rhythmToken;
        if (!rhythmToken) {
          // Derive Solfège rhythm token from fractional position within beat [0, 1)
          const f = startBeat - Math.floor(startBeat);
          const s = Math.round(f * 12) % 12;
          rhythmToken = SOLFEGE_POSITIONS[s] ?? "Do";
        }

        const markup = rhythmTokenToCoilMarkup(rhythmToken);
        rhythmCoilLines.push(
          `  \\tag #'ppt_${group.weaveId}_${group.coilId}_rhythm_${tIdx + 1} \\tweak NoteHead.text ${markup} b'${durationStr}`,
        );
      }
    }

    if (coilGroups.length > 0) {
      rhythmCoilLines.push('  \\bar "|."');
    }
  }
  rhythmCoilLines.push("  \\cadenzaOff");

  // ---------------------------------------------------------------------------
  // 4. Harmony Coil Voice (Row band with Solfège glyphs and alterations)
  // ---------------------------------------------------------------------------
  const harmonyCoilLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];

  if (harmonyChangesOnly) {
    const coilChunks: Array<{
      weaveId: string;
      coilId: string;
      onsetIndex: number;
      tag: string;
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    }> = [];

    let currentChunk: {
      weaveId: string;
      coilId: string;
      onsetIndex: number;
      tag: string;
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    } | null = null;

    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== primaryOnsets[i - 1].coilId ||
          onset.weaveId !== primaryOnsets[i - 1].weaveId);

      const isSameRoot =
        currentChunk &&
        !isNewCoil &&
        currentChunk.chordRoot === onset.chordRoot;

      if (isSameRoot && currentChunk) {
        currentChunk.spanCount++;
        if (onset.durationBeats !== undefined) {
          currentChunk.totalDurationBeats =
            (currentChunk.totalDurationBeats ?? 0) + onset.durationBeats;
        }
      } else {
        if (currentChunk) {
          coilChunks.push(currentChunk);
        }
        currentChunk = {
          tag: onset.tag,
          weaveId: onset.weaveId,
          coilId: onset.coilId,
          onsetIndex: onset.onsetIndex,
          chordRoot: onset.chordRoot,
          spanCount: 1,
          totalDurationBeats: onset.durationBeats,
          isBarStart: isNewCoil,
        };
      }
    }
    if (currentChunk) {
      coilChunks.push(currentChunk);
    }

    for (const chunk of coilChunks) {
      if (chunk.isBarStart) {
        harmonyCoilLines.push('  \\bar "|"');
      }
      const chordDuration =
        chunk.totalDurationBeats !== undefined
          ? beatsToLilyPondDuration(chunk.totalDurationBeats)
          : chunk.spanCount === 4
            ? "1"
            : `1*${chunk.spanCount}/4`;
      if (!chunk.chordRoot) {
        harmonyCoilLines.push(
          `  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_harmony_${chunk.onsetIndex} s${chordDuration}`,
        );
      } else {
        const markup = chordTokenToCoilMarkup(chunk.chordRoot);
        harmonyCoilLines.push(
          `  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_harmony_${chunk.onsetIndex} \\tweak NoteHead.text ${markup} b'${chordDuration}`,
        );
      }
    }
  } else {
    let lastCoilId: string | null = null;
    let lastWeaveId: string | null = null;
    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      if (
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== lastCoilId ||
          onset.weaveId !== lastWeaveId)
      ) {
        harmonyCoilLines.push('  \\bar "|"');
      }
      lastCoilId = onset.coilId;
      lastWeaveId = onset.weaveId;
      const onsetDur = onset.duration ?? dur;
      if (!onset.chordRoot) {
        harmonyCoilLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_harmony_${onset.onsetIndex} s${onsetDur}`,
        );
      } else {
        const markup = chordTokenToCoilMarkup(onset.chordRoot);
        harmonyCoilLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_harmony_${onset.onsetIndex} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
        );
      }
    }
  }

  if (primaryOnsets.length > 0) {
    harmonyCoilLines.push('  \\bar "|."');
  }
  harmonyCoilLines.push("  \\cadenzaOff");

  // ---------------------------------------------------------------------------
  // 4. Traditional Harmony Voice (5-line staff) and Leadsheet Chord Names
  // ---------------------------------------------------------------------------
  const harmonyLines: string[] = [
    `  \\clef ${formatClef(harmClef)}`,
    `  \\accidentalStyle ${accStyle}`,
  ];
  const chordNamesLines: string[] = [];

  if (omitStem) {
    harmonyLines.push("  \\omit Stem");
    harmonyLines.push("  \\omit Flag");
    harmonyLines.push("  \\omit Beam");
    harmonyLines.push("  \\omit Dots");
  }

  if (!traditionalRhythms) {
    harmonyLines.push("  \\override NoteHead.duration-log = #2");
  }
  harmonyLines.push("  \\cadenzaOn");

  if (harmonyChangesOnly) {
    // Group consecutive onsets within the same coil that share the same chord
    const harmonyChunks: Array<{
      weaveId: string;
      coilId: string;
      onsetIndex: number;
      tag: string;
      chordMidi: number[];
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    }> = [];

    let currentChunk: {
      weaveId: string;
      coilId: string;
      onsetIndex: number;
      tag: string;
      chordMidi: number[];
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    } | null = null;

    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== primaryOnsets[i - 1].coilId ||
          onset.weaveId !== primaryOnsets[i - 1].weaveId);

      const isSameChord =
        currentChunk &&
        !isNewCoil &&
        currentChunk.chordMidi.length === onset.chordMidi.length &&
        currentChunk.chordMidi.every((m, idx) => m === onset.chordMidi[idx]);

      if (isSameChord && currentChunk) {
        currentChunk.spanCount++;
        if (onset.durationBeats !== undefined) {
          currentChunk.totalDurationBeats =
            (currentChunk.totalDurationBeats ?? 0) + onset.durationBeats;
        }
      } else {
        if (currentChunk) {
          harmonyChunks.push(currentChunk);
        }
        currentChunk = {
          tag: onset.tag,
          weaveId: onset.weaveId,
          coilId: onset.coilId,
          onsetIndex: onset.onsetIndex,
          chordMidi: onset.chordMidi,
          chordRoot: onset.chordRoot,
          spanCount: 1,
          totalDurationBeats: onset.durationBeats,
          isBarStart: isNewCoil,
        };
      }
    }
    if (currentChunk) {
      harmonyChunks.push(currentChunk);
    }

    for (const chunk of harmonyChunks) {
      if (chunk.isBarStart) {
        harmonyLines.push('  \\bar "|"');
        chordNamesLines.push('  \\bar "|"');
      }
      const chordDuration =
        chunk.totalDurationBeats !== undefined
          ? beatsToLilyPondDuration(chunk.totalDurationBeats, traditionalRhythms)
          : chunk.spanCount === 4
            ? "1"
            : traditionalRhythms
              ? beatsToLilyPondDuration(chunk.spanCount, true)
              : `1*${chunk.spanCount}/4`;

      if (chunk.chordMidi.length === 0 || !chunk.chordRoot) {
        harmonyLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_harmonyStaff_${chunk.onsetIndex} s${chordDuration}`);
        chordNamesLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordName_${chunk.onsetIndex} s${chordDuration}`);
      } else {
        const chord = chordMidiToLilyPond(
          chunk.chordMidi,
          harmShift,
          accMode,
          forceAccidentals,
        );
        harmonyLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_harmonyStaff_${chunk.onsetIndex} ${chord}${chordDuration}`);

        const rootSyllable = parseHarmonyChord(chunk.chordRoot).rootSyllable;
        const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
        const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
        chordNamesLines.push(
          `  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordName_${chunk.onsetIndex} ${colorTweak}${chord}${chordDuration}`,
        );
      }
    }
  } else {
    for (let c = 0; c < coilGroups.length; c++) {
      const group = coilGroups[c];
      if (c > 0) {
        harmonyLines.push('  \\bar "|"');
        chordNamesLines.push('  \\bar "|"');
      }
      const groupPrimaryOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === 1);
      const beamMap = computeOnsetBeaming(groupPrimaryOnsets);

      for (let idx = 0; idx < groupPrimaryOnsets.length; idx++) {
        const onset = groupPrimaryOnsets[idx];
        const chord = chordMidiToLilyPond(
          onset.chordMidi,
          harmShift,
          accMode,
          forceAccidentals,
        );
        const onsetDur =
          traditionalRhythms && onset.durationBeats !== undefined
            ? beatsToLilyPondDuration(onset.durationBeats, true)
            : (onset.duration ?? dur);
        const beamBracket = beamMap.get(idx) ?? "";
        harmonyLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_harmonyStaff_${onset.onsetIndex} ${chord}${onsetDur}${beamBracket}`,
        );

        const rootSyllable = parseHarmonyChord(onset.chordRoot).rootSyllable;
        const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
        const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
        chordNamesLines.push(
          `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_chordName_${onset.onsetIndex} ${colorTweak}${chord}${onsetDur}`,
        );
      }
    }
  }

  if (primaryOnsets.length > 0) {
    harmonyLines.push('  \\bar "|."');
    chordNamesLines.push('  \\bar "|."');
  }
  harmonyLines.push("  \\cadenzaOff");

  const melodyVoiceStr = melodyLines.join("\n");
  const melodyCoilAbsoluteVoiceStr = melodyCoilAbsoluteLinesSingle.join("\n");
  const melodyCoilIntervalVoiceStr = melodyCoilIntervalLines.join("\n");
  const rhythmCoilVoiceStr = rhythmCoilLines.join("\n");
  const harmonyCoilVoiceStr = harmonyCoilLines.join("\n");
  const harmonyVoiceStr = harmonyLines.join("\n");
  const chordNamesVoiceStr = chordNamesLines.join("\n");

  // Assemble staves in PianoStaff
  const gridSuffix = options.showRhythmGrid ? " \\rhythmGridVoice >>" : "";
  const wrapWithGrid = (voiceName: string) =>
    options.showRhythmGrid ? `<< ${voiceName}${gridSuffix}` : voiceName;

  const makeCoilStaff = (voiceName: string, clefStencil: string) => `      \\new Staff \\with {
        \\override StaffSymbol.line-positions = #'(-2.0 2.0)
        \\override StaffSymbol.thickness = #1.0
        \\override StaffSymbol.stencil = #ppt-row-band-stencil
        \\override StaffSymbol.layer = #-2
        \\override Clef.stencil = ${clefStencil}
        \\override Clef.Y-offset = #0
        \\override Clef.staff-position = #0
        \\override Clef.X-extent = #'(-0.2 . 1.2)
        \\override Clef.Y-extent = #'(-1.0 . 1.0)
        \\override NoteHead.Y-extent = #'(-1.0 . 1.0)
        \\override TimeSignature.stencil = ##f
        \\override Stem.stencil = ##f
        \\override Flag.stencil = ##f
        \\override Beam.stencil = ##f
        \\override Dots.stencil = ##f
        \\override NoteHead.no-ledgers = ##t
      } ${wrapWithGrid(voiceName)}`;

  const coilStaffLines: string[] = [];
  if (showMelodyCoilAbsolute) {
    if (isMultiVoice) {
      for (const v of voiceIndices) {
        coilStaffLines.push(
          makeCoilStaff(
            `\\melodyCoilAbsoluteVoice${voiceNumberToWord(v)}`,
            `#(make-clef-text-stencil "M${v}")`,
          ),
        );
      }
    } else {
      coilStaffLines.push(makeCoilStaff("\\melodyCoilAbsoluteVoice", "#pptClefMStencil"));
    }
  }

  if (showMelodyCoilInterval) {
    coilStaffLines.push(
      makeCoilStaff(
        "\\melodyCoilIntervalVoice",
        isMultiVoice ? '#(make-clef-text-stencil "M1")' : "#pptClefMStencil",
      ),
    );
  }

  if (showRhythmCoil) {
    coilStaffLines.push(makeCoilStaff("\\rhythmCoilVoice", "#pptClefRStencil"));
  }

  if (showHarmonyCoil) {
    coilStaffLines.push(makeCoilStaff("\\harmonyCoilVoice", "#pptClefHStencil"));
  }

  const rhythmGridLines: string[] = ["  \\cadenzaOn"];
  if (options.showRhythmGrid) {
    for (let c = 0; c < coilGroups.length; c++) {
      const group = coilGroups[c];
      const pOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === 1);
      const totalBeats = pOnsets.reduce(
        (sum, o) => sum + (o.durationBeats !== undefined ? o.durationBeats : 1.0),
        0,
      );
      const roundedBeats = Math.round(totalBeats * 48) / 48;
      const fullBeats = Math.floor(roundedBeats);
      const fracBeats = roundedBeats - fullBeats;
      const spacers: string[] = [];
      for (let b = 0; b < fullBeats; b++) {
        spacers.push("s4");
      }
      if (fracBeats > 0.001) {
        spacers.push(`s${beatsToLilyPondDuration(fracBeats)}`);
      }
      rhythmGridLines.push(`  ${spacers.join(" ")}`);
      if (c < coilGroups.length - 1) {
        rhythmGridLines.push('  \\bar "|"');
      } else {
        rhythmGridLines.push('  \\bar "|."');
      }
    }
    rhythmGridLines.push("  \\cadenzaOff");
  }
  const rhythmGridVoiceStr = rhythmGridLines.join("\n");

  const staffLines: string[] = [];
  if (showMelody) {
    if (options.showRhythmGrid) {
      staffLines.push("    \\new Staff << \\melodyVoice \\rhythmGridVoice >>");
    } else {
      staffLines.push("    \\new Staff \\melodyVoice");
    }
  }
  if (coilStaffLines.length > 1) {
    staffLines.push(`    \\new StaffGroup \\with {
      \\remove "System_start_delimiter_engraver"
      \\override StaffGrouper.staff-staff-spacing =
        #'((basic-distance . 2.0)
           (minimum-distance . 2.0)
           (padding . -0.1)
           (stretchability . 0))
    } <<
${coilStaffLines.join("\n")}
    >>`);
  } else if (coilStaffLines.length === 1) {
    staffLines.push(`  ${coilStaffLines[0].trim()}`);
  }
  if (showTraditionalHarmony) {
    if (options.showRhythmGrid) {
      staffLines.push("    \\new Staff << \\harmonyVoice \\rhythmGridVoice >>");
    } else {
      staffLines.push("    \\new Staff \\harmonyVoice");
    }
  }

  const staffGroupBody =
    staffLines.length === 1
      ? staffLines[0]
      : `  \\new PianoStaff \\with {
    \\override StaffGrouper.staff-staff-spacing =
      #'((basic-distance . 9)
         (minimum-distance . 7)
         (padding . 2)
         (stretchability . 0))
    \\override StaffGrouper.staffgroup-staff-spacing =
      #'((basic-distance . 9)
         (minimum-distance . 7)
         (padding . 2)
         (stretchability . 0))
  } <<\n${staffLines.join("\n")}\n  >>`;

  const chordChangesDirective = options.chordChanges
    ? "      \\set chordChanges = ##t\n"
    : "";
  const scoreBody = showChordNames
    ? `  <<
    \\new ChordNames {
${chordChangesDirective}      \\chordNamesVoice
    }
  ${staffGroupBody.trim()}
  >>`
    : `  ${staffGroupBody.trim()}`;

  // Generate \header block
  const headerLines: string[] = [];
  if (options.title)
    headerLines.push(`  title = "${options.title.replace(/"/g, '\\"')}"`);
  if (options.subtitle)
    headerLines.push(`  subtitle = "${options.subtitle.replace(/"/g, '\\"')}"`);
  if (options.composer)
    headerLines.push(`  composer = "${options.composer.replace(/"/g, '\\"')}"`);
  if (options.arranger)
    headerLines.push(`  arranger = "${options.arranger.replace(/"/g, '\\"')}"`);
  if (options.copyright)
    headerLines.push(
      `  copyright = "${options.copyright.replace(/"/g, '\\"')}"`,
    );

  // Key anchor: vertically aligned with composer/artist on the left side (poet), with vertical padding
  let keyAnchorMarkup: string | null = null;
  if (options.piece) {
    headerLines.push(`  piece = "${options.piece.replace(/"/g, '\\"')}"`);
  } else if (options.doPitch && options.showKeyAnchor !== false) {
    const doPitchClass = options.doPitch.replace(/\d+$/, "");
    keyAnchorMarkup = `\\markup \\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = ${doPitchClass}" }`;
  }

  if (options.poet && keyAnchorMarkup) {
    headerLines.push(
      `  poet = \\markup \\column { "${options.poet.replace(/"/g, '\\"')}" ${keyAnchorMarkup} }`,
    );
  } else if (options.poet) {
    headerLines.push(`  poet = "${options.poet.replace(/"/g, '\\"')}"`);
  } else if (keyAnchorMarkup) {
    headerLines.push(`  poet = ${keyAnchorMarkup}`);
  }

  // Tagline handling: default to false (suppresses "Music engraving by LilyPond")
  const tagline = options.tagline ?? false;
  if (tagline === false) {
    headerLines.push("  tagline = ##f");
  } else if (typeof tagline === "string") {
    headerLines.push(`  tagline = "${tagline.replace(/"/g, '\\"')}"`);
  }

  const headerBlock =
    headerLines.length > 0
      ? `\n\\header {\n${headerLines.join("\n")}\n}\n`
      : "";

  const paperBlock = `\n\\paper {
  markup-system-spacing =
    #'((basic-distance . 12)
       (minimum-distance . 8)
       (padding . 3)
       (stretchability . 20))
}\n`;

  let preambles = "";
  if (
    colorNotes ||
    noteheadStyle === "ppt" ||
    showHarmonyCoil ||
    showMelodyCoilAbsolute ||
    showMelodyCoilInterval ||
    showRhythmCoil ||
    options.showRhythmGrid ||
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
    : "";

  const dropNaturalsContext = omitNaturals
    ? `      \\override Accidental.stencil = #drop-naturals-stencil\n`
    : "";

  const voiceDefs: string[] = [];
  if (showChordNames) {
    voiceDefs.push(`chordNamesVoice = {\n${chordNamesVoiceStr}\n}`);
  }
  if (showMelody) {
    voiceDefs.push(`melodyVoice = {\n${melodyVoiceStr}\n}`);
  }
  if (showMelodyCoilAbsolute) {
    if (isMultiVoice) {
      for (const v of voiceIndices) {
        voiceDefs.push(
          `melodyCoilAbsoluteVoice${voiceNumberToWord(v)} = {\n${melodyCoilAbsoluteVoiceMap.get(v)}\n}`,
        );
      }
    } else {
      voiceDefs.push(
        `melodyCoilAbsoluteVoice = {\n${melodyCoilAbsoluteVoiceStr}\n}`,
      );
    }
  }
  if (showMelodyCoilInterval) {
    voiceDefs.push(
      `melodyCoilIntervalVoice = {\n${melodyCoilIntervalVoiceStr}\n}`,
    );
  }
  if (showRhythmCoil) {
    voiceDefs.push(`rhythmCoilVoice = {\n${rhythmCoilVoiceStr}\n}`);
  }
  if (showHarmonyCoil) {
    voiceDefs.push(`harmonyCoilVoice = {\n${harmonyCoilVoiceStr}\n}`);
  }
  if (showTraditionalHarmony) {
    voiceDefs.push(`harmonyVoice = {\n${harmonyVoiceStr}\n}`);
  }
  if (options.showRhythmGrid) {
    voiceDefs.push(`rhythmGridVoice = {\n${rhythmGridVoiceStr}\n}`);
  }
  let zoomPreamble = "";
  if (options.zoom !== undefined) {
    const staffSize =
      options.zoom <= 5
        ? Math.round(20 * options.zoom * 10) / 10
        : Math.round(options.zoom * 10) / 10;
    zoomPreamble = `\n#(set-global-staff-size ${staffSize})\n`;
  }

  const indentMm = options.indent ?? 0;

  const gridLayoutContext = options.showRhythmGrid
    ? `    \\context {
      \\Score
      \\consists "Grid_line_span_engraver"
      \\override GridLine.stencil = #ly:grid-line-interface::print
      \\override GridLine.color = #(x11-color 'gray80)
      \\override GridLine.style = #'dashed-line
      \\override GridLine.thickness = #0.5
      \\override GridLine.layer = #-1
    }
    \\context {
      \\Staff
      \\consists "Grid_point_engraver"
      gridInterval = #(ly:make-moment 1/4)
      \\override GridPoint.X-offset = #0.65
      \\override GridPoint.Y-offset = #0
      \\override GridPoint.stencil = #make-grid-point-stencil
      \\override GridPoint.layer = #-1
    }\n`
    : "";

  const omitStemLayoutContext = omitStem
    ? `    \\context {
      \\Voice
      \\omit Stem
      \\omit Flag
      \\omit Beam
      \\omit Dots
    }\n`
    : "";

  return `\\version "${version}"
${zoomPreamble}${preambles}${headerBlock}${paperBlock}
${voiceDefs.join("\n\n")}

\\score {
${scoreBody}
  \\layout {
    indent = ${indentMm}\\mm
    short-indent = 0\\mm
${outlineLayoutContext}${gridLayoutContext}${omitStemLayoutContext}    \\context {
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
  writeFileSync(filePath, content, "utf-8");
}
