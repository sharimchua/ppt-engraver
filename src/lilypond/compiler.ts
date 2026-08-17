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
import type { OnsetStream } from "../schema/onset.js";
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
`;

/**
 * Converts a harmony chord token (e.g. "Do", "DoMe", "Dox", "DoxMe", "DoTe")
 * into a LilyPond markup string using rotated and outlined Solfège glyphs.
 */
export function chordTokenToCoilMarkup(token: string): string {
  const parsed = parseHarmonyChord(token);
  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";
  const rootStencil = `(make-solfege-glyph ${basePathVar} ${rootSpec.rotation} ${rootSpec.colorSchemeVar} ${rootAxisBool})`;

  if (parsed.modifiers.length === 0) {
    return `\\markup \\vcenter { \\stencil #${rootStencil} }`;
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

  return `\\markup \\vcenter \\concat { \\stencil #${rootStencil} ${modifierStencils.join(" ")} }`;
}

/**
 * Converts a rhythm token (e.g. "Do", "Fi", "DoxDo", "DoxFi", "LeFi")
 * into a LilyPond markup string. Dox prefixes are rendered adjacent to the main syllable.
 */
export function rhythmTokenToCoilMarkup(token: string): string {
  let remaining = token;
  let doxCount = 0;
  while (remaining.startsWith("Dox")) {
    doxCount++;
    remaining = remaining.slice(3);
  }
  if (remaining.length === 0) {
    remaining = "Do";
  }

  const parsed = parseHarmonyChord(remaining);
  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";

  const rootStencil =
    doxCount > 0
      ? `\\stencil #(make-solfege-glyph-with-prefix ${basePathVar} ${rootSpec.rotation} ${rootSpec.colorSchemeVar} ${rootAxisBool} ${doxCount})`
      : `\\stencil #(make-solfege-glyph ${basePathVar} ${rootSpec.rotation} ${rootSpec.colorSchemeVar} ${rootAxisBool})`;

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

  melodyLines.push("  \\override NoteHead.duration-log = #2");
  melodyLines.push("  \\cadenzaOn");

  let lastMelodyCoilId: string | null = null;
  let lastMelodyWeaveId: string | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];

    // Emit coil boundary barline when transitioning between distinct coils or repeating a coil
    if (
      i > 0 &&
      (onset.onsetIndex === 1 ||
        onset.coilId !== lastMelodyCoilId ||
        onset.weaveId !== lastMelodyWeaveId)
    ) {
      melodyLines.push('  \\bar "|"');
    }
    lastMelodyCoilId = onset.coilId;
    lastMelodyWeaveId = onset.weaveId;

    const onsetDur = onset.duration ?? dur;
    if (onset.isRest) {
      melodyLines.push(`  \\tag #'${onset.tag} s${onsetDur}`);
    } else {
      // Melody: \tag #'tag pitch4
      const melPitch = midiToLilyPondPitch(
        onset.midiNote,
        accMode,
        forceAccidentals,
      );
      const stencilTweak =
        noteheadStyle === "ppt"
          ? `\\tweak NoteHead.stencil #${SOLFEGE_TO_PPT_STENCIL[onset.scaleDegree] ?? "stencilDo"} `
          : "";
      const colorTweak = colorNotes
        ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[onset.scaleDegree] ?? "colorDo"} `
        : "";
      melodyLines.push(
        `  \\tag #'${onset.tag} ${stencilTweak}${colorTweak}${melPitch}${onsetDur}`,
      );
    }
  }

  if (onsets.length > 0) {
    melodyLines.push('  \\bar "|."');
  }
  melodyLines.push("  \\cadenzaOff");

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

  // ---------------------------------------------------------------------------
  // 1. Melody Coil Absolute Voice (Row band displaying absolute Solfège pitch classes)
  // ---------------------------------------------------------------------------
  const melodyCoilAbsoluteLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];
  if (showMelodyCoilAbsolute) {
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
        melodyCoilAbsoluteLines.push('  \\bar "|"');
      }
      lastAbsCoilId = onset.coilId;
      lastAbsWeaveId = onset.weaveId;
      const onsetDur = onset.duration ?? dur;
      if (onset.isRest) {
        melodyCoilAbsoluteLines.push(`  \\tag #'${onset.tag} s${onsetDur}`);
      } else {
        const markup = chordTokenToCoilMarkup(onset.scaleDegree);
        melodyCoilAbsoluteLines.push(
          `  \\tag #'${onset.tag} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
        );
      }
    }
    melodyCoilAbsoluteLines.push('  \\bar "|."');
  }
  melodyCoilAbsoluteLines.push("  \\cadenzaOff");

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
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
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
        melodyCoilIntervalLines.push(`  \\tag #'${onset.tag} s${onsetDur}`);
      } else {
        let token: string;
        if (i === 0 || isNewCoil) {
          // Anchor note at start of coil: absolute scale degree with axis marker (x)
          token = `${onset.scaleDegree}x`;
        } else {
          // Subsequent note: interval from previous non-rest pitch
          let prevMidi = onsets[i - 1].midiNote;
          for (let p = i - 1; p >= 0; p--) {
            if (!onsets[p].isRest) {
              prevMidi = onsets[p].midiNote;
              break;
            }
          }
          const diff = onset.midiNote - prevMidi;
          token = semitoneIntervalToSolfege(diff);
        }
        const markup = chordTokenToCoilMarkup(token);
        melodyCoilIntervalLines.push(
          `  \\tag #'${onset.tag} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
        );
      }
    }
    melodyCoilIntervalLines.push('  \\bar "|."');
  }
  melodyCoilIntervalLines.push("  \\cadenzaOff");

  // ---------------------------------------------------------------------------
  // 3. Rhythm Coil Voice (Row band displaying Solfège rhythm tokens / glyphs)
  // ---------------------------------------------------------------------------
  const rhythmCoilLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];
  if (showRhythmCoil) {
    let lastRhythmCoilId: string | null = null;
    let lastRhythmWeaveId: string | null = null;
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== lastRhythmCoilId ||
          onset.weaveId !== lastRhythmWeaveId);

      if (isNewCoil) {
        rhythmCoilLines.push('  \\bar "|"');
      }
      lastRhythmCoilId = onset.coilId;
      lastRhythmWeaveId = onset.weaveId;

      const onsetDur = onset.duration ?? dur;
      if (!onset.rhythmToken) {
        rhythmCoilLines.push(`  \\tag #'${onset.tag} s${onsetDur}`);
      } else {
        const markup = rhythmTokenToCoilMarkup(onset.rhythmToken);
        rhythmCoilLines.push(
          `  \\tag #'${onset.tag} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
        );
      }
    }
    rhythmCoilLines.push('  \\bar "|."');
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
      tag: string;
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    }> = [];

    let currentChunk: {
      tag: string;
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
      coilId: string;
      weaveId: string;
    } | null = null;

    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== onsets[i - 1].coilId ||
          onset.weaveId !== onsets[i - 1].weaveId);

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
          chordRoot: onset.chordRoot,
          spanCount: 1,
          totalDurationBeats: onset.durationBeats,
          isBarStart: isNewCoil,
          coilId: onset.coilId,
          weaveId: onset.weaveId,
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
      const markup = chordTokenToCoilMarkup(chunk.chordRoot);
      harmonyCoilLines.push(
        `  \\tag #'${chunk.tag} \\tweak NoteHead.text ${markup} b'${chordDuration}`,
      );
    }
  } else {
    let lastCoilId: string | null = null;
    let lastWeaveId: string | null = null;
    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
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
      const markup = chordTokenToCoilMarkup(onset.chordRoot);
      const onsetDur = onset.duration ?? dur;
      harmonyCoilLines.push(
        `  \\tag #'${onset.tag} \\tweak NoteHead.text ${markup} b'${onsetDur}`,
      );
    }
  }

  if (onsets.length > 0) {
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

  harmonyLines.push("  \\override NoteHead.duration-log = #2");
  harmonyLines.push("  \\cadenzaOn");

  if (harmonyChangesOnly) {
    // Group consecutive onsets within the same coil that share the same chord
    const harmonyChunks: Array<{
      tag: string;
      chordMidi: number[];
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    }> = [];

    let currentChunk: {
      tag: string;
      chordMidi: number[];
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
      coilId: string;
      weaveId: string;
    } | null = null;

    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== onsets[i - 1].coilId ||
          onset.weaveId !== onsets[i - 1].weaveId);

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
          chordMidi: onset.chordMidi,
          chordRoot: onset.chordRoot,
          spanCount: 1,
          totalDurationBeats: onset.durationBeats,
          isBarStart: isNewCoil,
          coilId: onset.coilId,
          weaveId: onset.weaveId,
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
      const chord = chordMidiToLilyPond(
        chunk.chordMidi,
        harmShift,
        accMode,
        forceAccidentals,
      );
      const chordDuration =
        chunk.totalDurationBeats !== undefined
          ? beatsToLilyPondDuration(chunk.totalDurationBeats)
          : chunk.spanCount === 4
            ? "1"
            : `1*${chunk.spanCount}/4`;
      harmonyLines.push(`  \\tag #'${chunk.tag} ${chord}${chordDuration}`);

      const rootSyllable = parseHarmonyChord(chunk.chordRoot).rootSyllable;
      const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
      const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
      chordNamesLines.push(
        `  \\tag #'${chunk.tag} ${colorTweak}${chord}${chordDuration}`,
      );
    }
  } else {
    let lastCoilId: string | null = null;
    let lastWeaveId: string | null = null;

    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      if (
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== lastCoilId ||
          onset.weaveId !== lastWeaveId)
      ) {
        harmonyLines.push('  \\bar "|"');
        chordNamesLines.push('  \\bar "|"');
      }
      lastCoilId = onset.coilId;
      lastWeaveId = onset.weaveId;

      const chord = chordMidiToLilyPond(
        onset.chordMidi,
        harmShift,
        accMode,
        forceAccidentals,
      );
      const onsetDur = onset.duration ?? dur;
      harmonyLines.push(`  \\tag #'${onset.tag} ${chord}${onsetDur}`);

      const rootSyllable = parseHarmonyChord(onset.chordRoot).rootSyllable;
      const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
      const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
      chordNamesLines.push(
        `  \\tag #'${onset.tag} ${colorTweak}${chord}${onsetDur}`,
      );
    }
  }

  if (onsets.length > 0) {
    harmonyLines.push('  \\bar "|."');
    chordNamesLines.push('  \\bar "|."');
  }
  harmonyLines.push("  \\cadenzaOff");

  const melodyVoiceStr = melodyLines.join("\n");
  const melodyCoilAbsoluteVoiceStr = melodyCoilAbsoluteLines.join("\n");
  const melodyCoilIntervalVoiceStr = melodyCoilIntervalLines.join("\n");
  const rhythmCoilVoiceStr = rhythmCoilLines.join("\n");
  const harmonyCoilVoiceStr = harmonyCoilLines.join("\n");
  const harmonyVoiceStr = harmonyLines.join("\n");
  const chordNamesVoiceStr = chordNamesLines.join("\n");

  // Assemble staves in PianoStaff
  const coilStaffLines: string[] = [];
  if (showMelodyCoilAbsolute) {
    coilStaffLines.push(`      \\new Staff \\with {
        \\override StaffSymbol.line-positions = #'(-2.0 2.0)
        \\override StaffSymbol.thickness = #1.0
        \\override StaffSymbol.stencil = #ppt-row-band-stencil
        \\override StaffSymbol.layer = #-2
        \\override Clef.stencil = #pptClefMStencil
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
      } \\melodyCoilAbsoluteVoice`);
  }

  if (showMelodyCoilInterval) {
    coilStaffLines.push(`      \\new Staff \\with {
        \\override StaffSymbol.line-positions = #'(-2.0 2.0)
        \\override StaffSymbol.thickness = #1.0
        \\override StaffSymbol.stencil = #ppt-row-band-stencil
        \\override StaffSymbol.layer = #-2
        \\override Clef.stencil = #pptClefMStencil
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
      } \\melodyCoilIntervalVoice`);
  }

  if (showRhythmCoil) {
    coilStaffLines.push(`      \\new Staff \\with {
        \\override StaffSymbol.line-positions = #'(-2.0 2.0)
        \\override StaffSymbol.thickness = #1.0
        \\override StaffSymbol.stencil = #ppt-row-band-stencil
        \\override StaffSymbol.layer = #-2
        \\override Clef.stencil = #pptClefRStencil
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
      } \\rhythmCoilVoice`);
  }

  if (showHarmonyCoil) {
    coilStaffLines.push(`      \\new Staff \\with {
        \\override StaffSymbol.line-positions = #'(-2.0 2.0)
        \\override StaffSymbol.thickness = #1.0
        \\override StaffSymbol.stencil = #ppt-row-band-stencil
        \\override StaffSymbol.layer = #-2
        \\override Clef.stencil = #pptClefHStencil
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
      } \\harmonyCoilVoice`);
  }

  const rhythmGridLines: string[] = ["  \\cadenzaOn"];
  if (options.showRhythmGrid) {
    const coilDurations: Array<{ totalBeats: number }> = [];
    let currentCoilId: string | null = null;
    let currentWeaveId: string | null = null;
    let currentBeats = 0;

    for (let i = 0; i < onsets.length; i++) {
      const onset = onsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== currentCoilId ||
          onset.weaveId !== currentWeaveId);

      if (isNewCoil && currentCoilId !== null) {
        coilDurations.push({ totalBeats: currentBeats });
        currentBeats = 0;
      }
      currentCoilId = onset.coilId;
      currentWeaveId = onset.weaveId;
      const durBeats =
        onset.durationBeats !== undefined ? onset.durationBeats : 1.0;
      currentBeats += durBeats;
    }
    if (currentCoilId !== null) {
      coilDurations.push({ totalBeats: currentBeats });
    }

    for (let c = 0; c < coilDurations.length; c++) {
      const totalBeats = Math.round(coilDurations[c].totalBeats * 48) / 48;
      const fullBeats = Math.floor(totalBeats);
      const fracBeats = totalBeats - fullBeats;
      const spacers: string[] = [];
      for (let b = 0; b < fullBeats; b++) {
        spacers.push("s4");
      }
      if (fracBeats > 0.001) {
        spacers.push(`s${beatsToLilyPondDuration(fracBeats)}`);
      }
      rhythmGridLines.push(`  ${spacers.join(" ")}`);
      if (c < coilDurations.length - 1) {
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
    staffLines.push("    \\new Staff \\harmonyVoice");
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
    voiceDefs.push(
      `melodyCoilAbsoluteVoice = {\n${melodyCoilAbsoluteVoiceStr}\n}`,
    );
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
      \\override GridPoint.Y-offset = #0
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
${outlineLayoutContext}${gridLayoutContext}    \\context {
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
