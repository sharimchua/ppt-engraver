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
  canonicalChordToLilyPond,
  canonicalChordToPianoTriangle,
  canonicalChordToPianoTriangleMarkup,
  LILYPOND_FLAT_NOTES,
  LILYPOND_SHARP_NOTES,
  SOLFEGE_TO_SCHEME_COLOR,
  SOLFEGE_TO_PPT_STENCIL,
  SOLFEGE_TO_PPT_TAB_STENCIL,
} from "./pitch.js";
import {
  midiToPianoTriangleString,
  midiToPianoTrianglePitch,
  encodePianoTriangleScale,
  encodePianoTriangleChord,
  getScaleTetrachordChainTriangles,
} from "../solfege/piano-triangles.js";
import {
  pitchNameToMidi,
  getAccidentalModeFromPitchName,
  parseHarmonyChord,
  getSolfegeGlyphSpec,
  semitoneIntervalToSolfege,
  SOLFEGE_POSITIONS,
  SOLFEGE_TO_SEMITONE,
} from "../solfege/pitch.js";
import {
  solveGuitarGrip,
  solveGuitarPassage,
  solveStandaloneHarmonyGrip,
  type GuitarVoicing,
  type GuitarTabMovement,
  type GuitarTabScope,
  type GuitarPassageOnset,
  type GuitarNotePosition,
} from "../solfege/guitar.js";
import {
  beatsToLilyPondDuration,
  resolveMetricGrammar,
  resolveMetricPulseTimeline,
  solfegeToGlyphShape,
  type MetricPulseOnset,
} from "../solfege/rhythm.js";

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
  /** Whether to show the guitar tablature staff */
  showGuitarTab?: boolean;
  /** Movement priority for guitar tablature phrasing ('vertical' | 'horizontal') */
  guitarTabMovement?: GuitarTabMovement;
  /** Phrasing solver scope ('coil' | 'continuous') */
  guitarTabScope?: GuitarTabScope;
  /** Guitar tablature voicing style: 'melodyOnly' | 'root' | 'triad' | 'shell' | 'rootChordTones' | 'guideTones' | 'bassAndMelody' | 'auto' */
  guitarVoicing?: GuitarVoicing;
  /** Maximum allowable fret distance between simultaneous fretted notes (default: 4) */
  maximumFretSpan?: number;
  /** Alias for maximumFretSpan */
  maxFretSpan?: number;
  /** Custom guitar tuning string (default: '#guitar-tuning') */
  guitarTuning?: string;
  /** Tablature notehead styling: 'ppt' (geometric shapes) | 'numbersOnly' | 'default' */
  tabStaffStyle?: "ppt" | "numbersOnly" | "default";
  /** Whether to show the melody staff (default: true) */
  showMelody?: boolean;
  /** Whether to show the Melody Coil Absolute row layer (displays absolute Solfège pitch classes) */
  showMelodyCoilAbsolute?: boolean;
  /** Whether to show the Melody Coil Interval row layer (displays relative interval Solfège glyphs) */
  showMelodyCoilInterval?: boolean;
  /** Whether to show the Rhythm Coil row layer (displays Solfège rhythm tokens / glyphs) */
  showRhythmCoil?: boolean;
  /** Whether to show the Pulse / Metric Coil row layer (displays Solfège metric pulse glyphs with 'P' clef) */
  showPulseCoil?: boolean;
  /** Whether to show the time signature on the traditional notation staff */
  showTimeSignature?: boolean;
  /** Custom time signature or metric grammar label override (e.g. "4/4", "3/4", "6/8") */
  timeSignature?: string;
  /** Whether to show the PPT pulse signature in the score header next to key anchor */
  showPulseSignature?: boolean;
  /** Whether to show the Diatonic Key Signature map in the score header */
  showKeySignature?: boolean;
  /** Scale mode (e.g. 'ionian', 'aeolian', 'dorian') for key signature generation */
  mode?: string;
  /** Custom pulse signature label override for the score header (e.g. "DoLa", "DoRe", "[Dox, Re, So]") */
  pulseSignature?: string;
  /** Metric pulse grammar specification for knot */
  pulse?: string | string[];
  /** Alias for pulse */
  meter?: string | string[];
  /** Whether to annotate rhythm grid lines with geometric Solfège notehead symbols */
  gridSymbols?: boolean | 'all' | 'no-do' | 'off';
  /** Whether to exclude circle symbol on Do/downbeats when annotating rhythm grid */
  excludeGridDoSymbol?: boolean;
  /** Whether to draw heavier / darker grid lines on strong beats (Do/Dix) */
  strongBeatGridWeight?: boolean;
  /** Whether to show chord names above the staff (default: true, reads directly from harmonyVoice) */
  showChordNames?: boolean;
  /** Whether to show Piano Triangle chord spellings above the staff */
  showChordTriangles?: boolean;
  /** Key anchor notation style in score header: 'standard' or 'pianoTriangle' or 'both' */
  keyAnchorStyle?: 'standard' | 'pianoTriangle' | 'both';
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
  /** Optional knot ID to resolve */
  knotId?: string;
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

#(define pptTabShapeDo (make-circle-stencil 0.50 0.0 #t))
#(define pptTabShapeRa (make-path-stencil '(moveto -0.48 -0.46 lineto 0.48 -0.46 lineto 0.48 0.46 lineto -0.48 0.46 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeRe (make-path-stencil '(moveto -0.48 -0.46 lineto 0.48 -0.46 lineto 0.48 0.46 lineto -0.48 0.46 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeMe (make-path-stencil '(moveto -0.54 0.46 lineto 0.54 0.46 lineto 0.0 -0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeMi (make-path-stencil '(moveto -0.54 -0.46 lineto 0.54 -0.46 lineto 0.0 0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeFa (make-path-stencil '(moveto 0.32 -0.48 lineto 0.32 0.48 curveto -0.22 0.48 -0.60 0.28 -0.60 0.0 curveto -0.60 -0.28 -0.22 -0.48 0.32 -0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeFi (ly:stencil-add (make-line-stencil 0.24 -0.42 -0.42 0.42 0.42) (make-line-stencil 0.24 -0.42 0.42 0.42 -0.42)))
#(define pptTabShapeSo (make-path-stencil '(moveto -0.32 -0.48 lineto -0.32 0.48 curveto 0.22 0.48 0.60 0.28 0.60 0.0 curveto 0.60 -0.28 0.22 -0.48 -0.32 -0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeLe (make-path-stencil '(moveto -0.54 0.46 lineto 0.54 0.46 lineto 0.0 -0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeLa (make-path-stencil '(moveto -0.54 -0.46 lineto 0.54 -0.46 lineto 0.0 0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeTe (make-path-stencil '(moveto -0.56 0.0 lineto 0.0 0.48 lineto 0.56 0.0 lineto 0.0 -0.48 closepath) 0.0 1.0 1.0 #t))
#(define pptTabShapeTi (make-path-stencil '(moveto -0.56 0.0 lineto 0.0 0.48 lineto 0.56 0.0 lineto 0.0 -0.48 closepath) 0.0 1.0 1.0 #t))

#(define (make-ppt-tab-stencil base-shape-stencil)
   (lambda (grob)
     (let* ((fret-stencil (tab-note-head::print grob))
            (col (ly:grob-property grob 'color #f))
            (fret-x-ext (if (ly:stencil? fret-stencil) (ly:stencil-extent fret-stencil X) '(-0.4 . 0.4)))
            (fret-y-ext (if (ly:stencil? fret-stencil) (ly:stencil-extent fret-stencil Y) '(-0.4 . 0.4)))
            (fw (max 0.7 (- (cdr fret-x-ext) (car fret-x-ext))))
            (fx-center (/ (+ (car fret-x-ext) (cdr fret-x-ext)) 2.0))
            (fy-center (/ (+ (car fret-y-ext) (cdr fret-y-ext)) 2.0))
            ;; Sized to maintain clean 0.28+ space between adjacent strings (spacing 1.50)
            (sx (max 1.15 (* 0.92 (+ fw 0.38))))
            (sy 1.12)
            (shape-scaled (ly:stencil-scale base-shape-stencil sx sy))
            (shape-centered (ly:stencil-aligned-to (ly:stencil-aligned-to shape-scaled X CENTER) Y CENTER))
            (shape-placed (ly:stencil-translate shape-centered (cons fx-center fy-center)))
            (d 0.05)
            (black-shape (stencil-with-color shape-placed black))
            (colored-shape (if (and col (list? col))
                               (stencil-with-color shape-placed col)
                               shape-placed))
            (outlined (ly:stencil-add
                        (ly:stencil-translate black-shape (cons (- d) 0))
                        (ly:stencil-translate black-shape (cons d 0))
                        (ly:stencil-translate black-shape (cons 0 (- d)))
                        (ly:stencil-translate black-shape (cons 0 d))
                        (ly:stencil-translate black-shape (cons (- d) (- d)))
                        (ly:stencil-translate black-shape (cons d d))
                        (ly:stencil-translate black-shape (cons (- d) d))
                        (ly:stencil-translate black-shape (cons d (- d)))
                        colored-shape))
            (fret-black (if (ly:stencil? fret-stencil)
                            (stencil-with-color fret-stencil black)
                            empty-stencil))
            (fret-white (if (ly:stencil? fret-stencil)
                            (stencil-with-color fret-stencil white)
                            empty-stencil))
            (fd 0.045)
            (fret-outlined (if (ly:stencil? fret-stencil)
                               (ly:stencil-add
                                 (ly:stencil-translate fret-white (cons (- fd) 0))
                                 (ly:stencil-translate fret-white (cons fd 0))
                                 (ly:stencil-translate fret-white (cons 0 (- fd)))
                                 (ly:stencil-translate fret-white (cons 0 fd))
                                 (ly:stencil-translate fret-white (cons (- fd) (- fd)))
                                 (ly:stencil-translate fret-white (cons fd fd))
                                 (ly:stencil-translate fret-white (cons (- fd) fd))
                                 (ly:stencil-translate fret-white (cons fd (- fd)))
                                 fret-black)
                               empty-stencil)))
       (if (ly:stencil? fret-stencil)
           (ly:stencil-add outlined fret-outlined)
           outlined))))

#(define tabStencilDo (make-ppt-tab-stencil pptTabShapeDo))
#(define tabStencilRa (make-ppt-tab-stencil pptTabShapeRa))
#(define tabStencilRe (make-ppt-tab-stencil pptTabShapeRe))
#(define tabStencilMe (make-ppt-tab-stencil pptTabShapeMe))
#(define tabStencilMi (make-ppt-tab-stencil pptTabShapeMi))
#(define tabStencilFa (make-ppt-tab-stencil pptTabShapeFa))
#(define tabStencilFi (make-ppt-tab-stencil pptTabShapeFi))
#(define tabStencilSo (make-ppt-tab-stencil pptTabShapeSo))
#(define tabStencilLe (make-ppt-tab-stencil pptTabShapeLe))
#(define tabStencilLa (make-ppt-tab-stencil pptTabShapeLa))
#(define tabStencilTe (make-ppt-tab-stencil pptTabShapeTe))
#(define tabStencilTi (make-ppt-tab-stencil pptTabShapeTi))

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

#(define pptPathTriangleUp
   '(moveto -0.22 -0.25
     lineto 0.22 -0.25
     lineto 0.00 0.25
     closepath))

#(define pptPathTriangleDown
   '(moveto -0.22 0.25
     lineto 0.22 0.25
     lineto 0.00 -0.25
     closepath))

#(define (make-solfege-glyph base-path rot-deg fill-col has-axis? . rest)
   (let* ((oct-shift (if (null? rest) 0 (car rest)))
          (raw-stencil (make-path-stencil base-path 0.0 0.9 0.9 #t))
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
          (main-centered (ly:stencil-aligned-to (ly:stencil-aligned-to outlined X CENTER) Y CENTER))
          (abs-oct (abs oct-shift))
          (oct-stencil
            (if (= oct-shift 0)
                empty-stencil
                (let* ((tri-path (if (> oct-shift 0) pptPathTriangleUp pptPathTriangleDown))
                       (tri-scale (if (> abs-oct 1) 0.65 0.75))
                       (tri-raw (make-path-stencil tri-path 0.0 tri-scale tri-scale #t))
                       (tri-col (if fill-col (stencil-with-color tri-raw fill-col) tri-raw))
                       (tri-black (stencil-with-color tri-raw black))
                       (td 0.06)
                       (tri-out (ly:stencil-add
                                  (ly:stencil-translate tri-black (cons (- td) 0))
                                  (ly:stencil-translate tri-black (cons td 0))
                                  (ly:stencil-translate tri-black (cons 0 (- td)))
                                  (ly:stencil-translate tri-black (cons 0 td))
                                  (ly:stencil-translate tri-black (cons (- td) (- td)))
                                  (ly:stencil-translate tri-black (cons td td))
                                  (ly:stencil-translate tri-black (cons (- td) td))
                                  (ly:stencil-translate tri-black (cons td (- td)))
                                  tri-col))
                       (tri-center (ly:stencil-aligned-to (ly:stencil-aligned-to tri-out X CENTER) Y CENTER))
                       (x-pos -1.15)
                       (spacing 0.44))
                  (let loop ((k 0)
                             (accum empty-stencil))
                    (if (>= k abs-oct)
                        accum
                        (let* ((y-pos (if (> oct-shift 0)
                                          (- 0.52 (* k spacing))
                                          (+ -0.52 (* k spacing))))
                               (placed (ly:stencil-translate tri-center (cons x-pos y-pos))))
                          (loop (+ k 1) (ly:stencil-add accum placed))))))))
          (with-octave (ly:stencil-add main-centered oct-stencil)))
     (ly:stencil-translate with-octave (cons 0.65 0))))

#(define (make-solfege-glyph-sub base-path rot-deg fill-col has-axis? . rest)
   (let ((oct (if (null? rest) 0 (car rest))))
     (ly:stencil-scale (make-solfege-glyph base-path rot-deg fill-col has-axis? oct) 0.55 0.55)))

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

#(define pptPianoTriDownPath '(moveto -0.7 0.6 lineto 0.7 0.6 lineto 0.0 -0.7 closepath))
#(define pptPianoTriLeftPath '(moveto -0.7 -0.6 lineto 0.7 -0.6 lineto 0.7 0.7 closepath))
#(define pptPianoTriUpPath   '(moveto -0.7 -0.6 lineto 0.0 0.7 lineto 0.7 -0.6 closepath))
#(define pptPianoTriRightPath '(moveto -0.7 0.7 lineto -0.7 -0.6 lineto 0.7 -0.6 closepath))

#(define (make-piano-triangle-stencil tri-type v1-col v2-col v3-col)
   (let* ((tri-path (cond
                      ((equal? tri-type "D") pptPianoTriDownPath)
                      ((equal? tri-type "L") pptPianoTriLeftPath)
                      ((equal? tri-type "U") pptPianoTriUpPath)
                      (else pptPianoTriRightPath)))
          (tri-outline (stencil-with-color (make-path-stencil tri-path 0.08 1.0 1.0 #f) (rgb-color 0.25 0.25 0.25)))
          (make-v-dot (lambda (col x y)
                        (if col
                            (let* ((dot (stencil-with-color (make-circle-stencil 0.22 0.0 #t) col))
                                   (out (stencil-with-color (make-circle-stencil 0.22 0.05 #f) (rgb-color 0.1 0.1 0.1))))
                              (ly:stencil-translate (ly:stencil-add dot out) (cons x y)))
                            (ly:stencil-translate (stencil-with-color (make-circle-stencil 0.15 0.04 #f) (rgb-color 0.75 0.75 0.75)) (cons x y))))))
     (let* ((coords (cond
                      ((equal? tri-type "D") '((-0.70 . 0.60) (0.0 . -0.70) (0.70 . 0.60)))
                      ((equal? tri-type "L") '((-0.70 . -0.60) (0.70 . -0.60) (0.70 . 0.70)))
                      ((equal? tri-type "U") '((-0.70 . -0.60) (0.0 . 0.70) (0.70 . -0.60)))
                      (else                  '((-0.70 . 0.70) (-0.70 . -0.60) (0.70 . -0.60)))))
            (c1 (list-ref coords 0))
            (c2 (list-ref coords 1))
            (c3 (list-ref coords 2))
            (dot1 (make-v-dot v1-col (car c1) (cdr c1)))
            (dot2 (make-v-dot v2-col (car c2) (cdr c2)))
            (dot3 (make-v-dot v3-col (car c3) (cdr c3)))
            (raw-stc (ly:stencil-add tri-outline dot1 dot2 dot3)))
       (ly:stencil-aligned-to raw-stc X LEFT))))

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
#(define pptClefPStencil (make-clef-text-stencil "P"))

#(define (make-grid-symbol-stencil stc)
   (ly:stencil-translate (ly:stencil-aligned-to (ly:stencil-aligned-to stc X CENTER) Y CENTER) (cons 0.65 0)))

#(define gridSymbolDo (make-grid-symbol-stencil (stencil-with-color (make-circle-stencil 0.30 0.0 #t) colorDo)))
#(define gridSymbolFi (make-grid-symbol-stencil (stencil-with-color (ly:stencil-add (make-line-stencil 0.18 -0.24 -0.24 0.24 0.24) (make-line-stencil 0.18 -0.24 0.24 0.24 -0.24)) colorFi)))
#(define gridSymbolMe (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 0.24 lineto 0.28 0.24 lineto 0.0 -0.26 closepath) 0.0 1.0 1.0 #t) colorMe)))
#(define gridSymbolLa (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 -0.24 lineto 0.28 -0.24 lineto 0.0 0.26 closepath) 0.0 1.0 1.0 #t) colorLa)))
#(define gridSymbolMi (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 -0.24 lineto 0.28 -0.24 lineto 0.0 0.26 closepath) 0.0 1.0 1.0 #t) colorMi)))
#(define gridSymbolLe (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 0.24 lineto 0.28 0.24 lineto 0.0 -0.26 closepath) 0.0 1.0 1.0 #t) colorLe)))
#(define gridSymbolRe (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.24 -0.24 lineto 0.24 -0.24 lineto 0.24 0.24 lineto -0.24 0.24 closepath) 0.0 1.0 1.0 #t) colorRe)))
#(define gridSymbolTe (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 0.0 lineto 0.0 0.24 lineto 0.28 0.0 lineto 0.0 -0.24 closepath) 0.0 1.0 1.0 #t) colorTe)))
#(define gridSymbolDi (make-grid-symbol-stencil (stencil-with-color (ly:stencil-add (make-line-stencil 0.16 -0.22 -0.22 0.22 0.22) (make-line-stencil 0.16 -0.22 0.22 0.22 -0.22)) colorRa)))
#(define gridSymbolFa (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto 0.18 -0.24 lineto 0.18 0.24 curveto -0.12 0.24 -0.32 0.14 -0.32 0.0 curveto -0.32 -0.14 -0.12 -0.24 0.18 -0.24 closepath) 0.0 1.0 1.0 #t) colorFa)))
#(define gridSymbolSo (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.18 -0.24 lineto -0.18 0.24 curveto 0.12 0.24 0.32 0.14 0.32 0.0 curveto 0.32 -0.14 0.12 -0.24 -0.18 -0.24 closepath) 0.0 1.0 1.0 #t) colorSo)))
#(define gridSymbolTi (make-grid-symbol-stencil (stencil-with-color (make-path-stencil '(moveto -0.28 0.0 lineto 0.0 0.24 lineto 0.28 0.0 lineto 0.0 -0.24 closepath) 0.0 1.0 1.0 #t) colorTi)))

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

#(define (make-strong-grid-point-stencil grob)
   (let* ((col (x11-color 'gray65))
          (thickness 0.12)
          (y-bottom -2.5)
          (y-top 2.5))
     (stencil-with-color
       (make-line-stencil thickness 0.0 y-bottom 0.0 y-top)
       col)))

#(define (make-weak-grid-point-stencil grob)
   (let* ((col (x11-color 'gray85))
          (dash-len 0.4)
          (space-len 0.4)
          (thickness 0.08)
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
 * Returns inner LilyPond stencil markup for a chord/pulse token without wrapping in outer \markup.
 */
export function chordTokenToInnerMarkup(token: string): string {
  const parsed = parseHarmonyChord(token);

  let bassStencil = "";
  if (parsed.hasAxisBass && parsed.bassSyllable) {
    const bassOct = parsed.bassOctaveShift ?? 0;
    const bassSpec = getSolfegeGlyphSpec(parsed.bassSyllable, true, bassOct);
    const bassPathVar =
      bassSpec.glyphType === "base"
        ? "pptPathBase"
        : bassSpec.glyphType === "sharp"
          ? "pptPathSharp"
          : "pptPathFlat";
    const bassOctArg = bassOct !== 0 ? " " + bassOct : "";
    bassStencil = "\\stencil #(make-solfege-glyph " + bassPathVar + " " + bassSpec.rotation + " " + bassSpec.colorSchemeVar + " #t" + bassOctArg + ") ";
  }

  const rootOct = parsed.octaveShift ?? 0;
  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis, rootOct);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";
  const rootOctArg = rootOct !== 0 ? " " + rootOct : "";
  const rootStencil = "\\stencil #(make-solfege-glyph " + basePathVar + " " + rootSpec.rotation + " " + rootSpec.colorSchemeVar + " " + rootAxisBool + rootOctArg + ")";

  if (parsed.modifiers.length === 0 && !bassStencil) {
    return rootStencil;
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
    return "\\lower #0.35 \\stencil #(make-solfege-glyph-sub " + modPathVar + " " + modSpec.rotation + " " + modSpec.colorSchemeVar + " " + modAxisBool + ")";
  });

  return "\\concat { " + bassStencil + rootStencil + " " + modifierStencils.join(" ") + " }";
}

/**
 * Converts a harmony chord token (e.g. "Do", "DoMe", "Dox", "DoxMe", "DoTe")
 * into a LilyPond markup string using rotated and outlined Solfège glyphs.
 */
export function chordTokenToCoilMarkup(token: string): string {
  const inner = chordTokenToInnerMarkup(token);
  if (inner.startsWith("\\concat")) {
    return "\\markup \\vcenter " + inner;
  }
  return "\\markup \\vcenter { " + inner + " }";
}

/**
 * Converts a rhythm token (e.g. "Do", "Fi", "DoxDo", "DoxFi", "LeFi")
 * into a LilyPond markup string. Dox prefixes are rendered adjacent to the main syllable.
 */
export function rhythmTokenToCoilMarkup(token: string): string {
  const parsed = parseHarmonyChord(token);
  const rootOct = parsed.octaveShift ?? 0;
  const rootSpec = getSolfegeGlyphSpec(parsed.rootSyllable, parsed.hasAxis, rootOct);
  const basePathVar =
    rootSpec.glyphType === "base"
      ? "pptPathBase"
      : rootSpec.glyphType === "sharp"
        ? "pptPathSharp"
        : "pptPathFlat";
  const rootAxisBool = rootSpec.hasAxis ? "#t" : "#f";
  const rootOctArg = rootOct !== 0 ? " " + rootOct : "";

  const rootStencil = "\\stencil #(make-solfege-glyph " + basePathVar + " " + rootSpec.rotation + " " + rootSpec.colorSchemeVar + " " + rootAxisBool + rootOctArg + ")";

  if (parsed.modifiers.length === 0) {
    return "\\markup \\vcenter { " + rootStencil + " }";
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
    return "\\lower #0.35 \\stencil #(make-solfege-glyph-sub " + modPathVar + " " + modSpec.rotation + " " + modSpec.colorSchemeVar + " " + modAxisBool + ")";
  });

  return "\\markup \\vcenter \\concat { " + rootStencil + " " + modifierStencils.join(" ") + " }";
}

/**
 * Determines the Scheme grid symbol stencil name for an onset based on its rhythm token and fractional beat offset.
 */
export function getGridSymbolSchemeVar(onset: Onset, excludeDo: boolean = false): string | null {
  const token = onset.rhythmToken ?? "";
  const startBeat = onset.startBeat ?? 0;
  const frac = Math.abs(startBeat - Math.floor(startBeat + 1e-5));

  // Downbeat: Do / Dox
  if (frac < 0.03 || frac > 0.97 || token === "Do" || token === "Dox" || token.startsWith("DoxDo")) {
    return excludeDo ? null : "gridSymbolDo";
  }

  // Check 8th offbeat (Fi)
  if (Math.abs(frac - 0.5) < 0.04 || token === "Fi" || token.endsWith("Fi")) {
    return "gridSymbolFi";
  }

  // Check 16th notes (Me = 0.25, La = 0.75)
  if (Math.abs(frac - 0.25) < 0.04 || token.includes("Me") || token.includes("Ri")) {
    return "gridSymbolMe";
  }
  if (Math.abs(frac - 0.75) < 0.04 || token.includes("La") || token.includes("Li")) {
    return "gridSymbolLa";
  }

  // Check Triplets (Mi = 1/3, Le = 2/3)
  if (Math.abs(frac - 1/3) < 0.04 || token.includes("Mi")) {
    return "gridSymbolMi";
  }
  if (Math.abs(frac - 2/3) < 0.04 || token.includes("Le")) {
    return "gridSymbolLe";
  }

  // Check Sextuplets (Re = 1/6, Te = 5/6)
  if (Math.abs(frac - 1/6) < 0.04 || token.includes("Re")) {
    return "gridSymbolRe";
  }
  if (Math.abs(frac - 5/6) < 0.04 || token.includes("Te")) {
    return "gridSymbolTe";
  }

  // Dodecaplet / 12th (Ra/Di = 1/12, Fa = 5/12, So = 7/12, Ti = 11/12)
  if (Math.abs(frac - 1/12) < 0.04 || token.includes("Ra") || token.includes("Di")) {
    return "gridSymbolDi";
  }
  if (Math.abs(frac - 5/12) < 0.04 || token.includes("Fa") || token.includes("Se")) {
    return "gridSymbolFa";
  }
  if (Math.abs(frac - 7/12) < 0.04 || token.includes("So") || token.includes("Si")) {
    return "gridSymbolSo";
  }
  if (Math.abs(frac - 11/12) < 0.04 || token.includes("Ti")) {
    return "gridSymbolTi";
  }

  return null;
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
  const showChordTriangles = options.showChordTriangles ?? false;
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
        o.pitch?.includes("b") ||
        o.pitch?.includes("♭") ||
        o.chordTones?.some((ct) => ct.includes("b")),
    )
      ? "flats"
      : "sharps");

  const doMidi = options.doPitch ? pitchNameToMidi(options.doPitch) : undefined;
  const resolvedDoMidi = (() => {
    if (doMidi !== undefined) return doMidi;
    const firstWithPitch = onsets.find(
      (o) => o.scaleDegree && o.midiNote !== undefined && o.midiNote > 0,
    );
    if (firstWithPitch) {
      const semitone = SOLFEGE_TO_SEMITONE[firstWithPitch.scaleDegree] ?? 0;
      return firstWithPitch.midiNote - semitone;
    }
    return 60;
  })();

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

  const showTimeSignature =
    options.showTimeSignature === true || options.timeSignature !== undefined;
  const resolvedTimeSig =
    options.timeSignature ??
    (options.pulse || options.meter
      ? resolveMetricGrammar(options.pulse ?? options.meter).timeSignature
      : "4/4");

  if (showTimeSignature) {
    melodyLines.push(`  \\time ${resolvedTimeSig}`);
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

  const showGuitarTab = options.showGuitarTab ?? false;
  const guitarTabMovement = options.guitarTabMovement ?? "vertical";
  const guitarVoicing = options.guitarVoicing ?? "melodyOnly";
  const maxFretSpan = options.maximumFretSpan ?? options.maxFretSpan ?? 4;
  const guitarTuning = options.guitarTuning;
  const tabStaffStyle =
    options.tabStaffStyle ?? (noteheadStyle === "ppt" ? "ppt" : "default");

  function formatTabNote(
    onset: Onset,
    grip: GuitarNotePosition[] | undefined,
    beamBracket: string = "",
  ): string {
    const onsetDur =
      traditionalRhythms && onset.durationBeats !== undefined
        ? beatsToLilyPondDuration(onset.durationBeats, true)
        : (onset.duration ?? dur);

    const isPptTab =
      tabStaffStyle === "ppt" || (tabStaffStyle === "default" && noteheadStyle === "ppt");

    if (onset.isRest) {
      if (grip && grip.length > 0) {
        if (grip.length === 1) {
          const pos = grip[0];
          const pitchStr = midiToLilyPondPitch(pos.midiNote, accMode, forceAccidentals);
          const semitoneOffset = ((pos.midiNote - resolvedDoMidi) % 12 + 12) % 12;
          const chromaticDegree = SOLFEGE_POSITIONS[semitoneOffset];
          const stencilTweak = isPptTab
            ? `\\tweak TabNoteHead.stencil #${SOLFEGE_TO_PPT_TAB_STENCIL[chromaticDegree] ?? "tabStencilDo"} `
            : "";
          const colorTweak = colorNotes
            ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[chromaticDegree] ?? "colorDo"} `
            : "";
          return `${stencilTweak}${colorTweak}${pitchStr}${onsetDur}\\${pos.stringNumber}${beamBracket}`;
        }

        const noteTokens = grip.map((pos) => {
          const pitchStr = midiToLilyPondPitch(pos.midiNote, accMode, forceAccidentals);
          const semitoneOffset = ((pos.midiNote - resolvedDoMidi) % 12 + 12) % 12;
          const chromaticDegree = SOLFEGE_POSITIONS[semitoneOffset];
          const stencilTweak = isPptTab
            ? `\\tweak TabNoteHead.stencil #${SOLFEGE_TO_PPT_TAB_STENCIL[chromaticDegree] ?? "tabStencilDo"} `
            : "";
          const colorTweak = colorNotes
            ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[chromaticDegree] ?? "colorDo"} `
            : "";
          return `${stencilTweak}${colorTweak}${pitchStr}\\${pos.stringNumber}`;
        });

        return `<${noteTokens.join(" ")}>${onsetDur}${beamBracket}`;
      }
      const restPrefix = traditionalRhythms ? "r" : "s";
      return `${restPrefix}${onsetDur}`;
    }

    const activeGrip = grip && grip.length > 0
      ? grip
      : [{
          midiNote: onset.midiNote,
          scaleDegree: onset.scaleDegree,
          stringNumber: 1,
          fretNumber: Math.max(0, onset.midiNote - 64),
        }];

    if (activeGrip.length === 1) {
      const pos = activeGrip[0];
      const pitchStr = midiToLilyPondPitch(pos.midiNote, accMode, forceAccidentals);
      const semitoneOffset = ((pos.midiNote - resolvedDoMidi) % 12 + 12) % 12;
      const chromaticDegree = SOLFEGE_POSITIONS[semitoneOffset];
      const stencilTweak = isPptTab
        ? `\\tweak TabNoteHead.stencil #${SOLFEGE_TO_PPT_TAB_STENCIL[chromaticDegree] ?? "tabStencilDo"} `
        : "";
      const colorTweak = colorNotes
        ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[chromaticDegree] ?? "colorDo"} `
        : "";
      return `${stencilTweak}${colorTweak}${pitchStr}${onsetDur}\\${pos.stringNumber}${beamBracket}`;
    }

    const noteTokens = activeGrip.map((pos) => {
      const pitchStr = midiToLilyPondPitch(pos.midiNote, accMode, forceAccidentals);
      const semitoneOffset = ((pos.midiNote - resolvedDoMidi) % 12 + 12) % 12;
      const chromaticDegree = SOLFEGE_POSITIONS[semitoneOffset];
      const stencilTweak = isPptTab
        ? `\\tweak TabNoteHead.stencil #${SOLFEGE_TO_PPT_TAB_STENCIL[chromaticDegree] ?? "tabStencilDo"} `
        : "";
      const colorTweak = colorNotes
        ? `\\tweak color #${SOLFEGE_TO_SCHEME_COLOR[chromaticDegree] ?? "colorDo"} `
        : "";
      return `${stencilTweak}${colorTweak}${pitchStr}\\${pos.stringNumber}`;
    });

    return `<${noteTokens.join(" ")}>${onsetDur}${beamBracket}`;
  }

  const tabLines: string[] = [];
  const tabVoiceMap = new Map<number, string>();

  if (showGuitarTab) {
    if (omitStem) {
      tabLines.push("  \\omit Stem");
      tabLines.push("  \\omit Flag");
      tabLines.push("  \\omit Beam");
      tabLines.push("  \\omit Dots");
    }
    if (!traditionalRhythms) {
      tabLines.push("  \\override TabNoteHead.duration-log = #2");
    }
    tabLines.push("  \\cadenzaOn");

    if (isMultiVoice) {
      const guitarTabScope: GuitarTabScope = options.guitarTabScope ?? "coil";
      const voiceCommands = ["\\voiceOne", "\\voiceTwo", "\\voiceThree", "\\voiceFour"];

      for (let vIdx = 0; vIdx < voiceIndices.length; vIdx++) {
        const vNum = voiceIndices[vIdx];
        const voiceCmd = voiceCommands[vIdx] ?? "\\voiceOne";
        const vLines: string[] = [
          `  ${voiceCmd}`,
        ];
        if (omitStem) {
          vLines.push("  \\omit Stem");
          vLines.push("  \\omit Flag");
          vLines.push("  \\omit Beam");
          vLines.push("  \\omit Dots");
        }
        if (!traditionalRhythms) {
          vLines.push("  \\override TabNoteHead.duration-log = #2");
        }
        vLines.push("  \\cadenzaOn");

        let solvedGripsForVoice: GuitarNotePosition[][] = [];
        if (guitarTabScope === "continuous") {
          const allVoiceOnsets: Onset[] = [];
          for (const group of coilGroups) {
            const vOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === vNum);
            allVoiceOnsets.push(...vOnsets);
          }
          const passageOnsets: GuitarPassageOnset[] = allVoiceOnsets.map((onset, idx) => {
            const prev = idx > 0 ? allVoiceOnsets[idx - 1] : undefined;
            const chordKey = `${onset.chordRoot}_${(onset.chordMidi ?? []).join(",")}`;
            const prevChordKey = prev ? `${prev.chordRoot}_${(prev.chordMidi ?? []).join(",")}` : null;
            const isChordChange =
              idx === 0
                ? true
                : chordKey !== prevChordKey || (onset.onsetIndex === 1 && onset.coilId !== prev?.coilId);
            const isStrongBeat =
              onset.startBeat === undefined ||
              onset.startBeat % 2.0 === 0 ||
              (onset.durationBeats !== undefined && onset.durationBeats >= 1.5);
            return {
              midiNote: onset.midiNote,
              scaleDegree: onset.scaleDegree,
              chordRoot: onset.chordRoot,
              isRest: onset.isRest,
              isChordChange,
              isStrongBeat,
              durationBeats: onset.durationBeats,
              startBeat: onset.startBeat,
              onsetIndex: onset.onsetIndex,
              coilId: onset.coilId,
            };
          });

          solvedGripsForVoice = solveGuitarPassage(passageOnsets, {
            voicing: guitarVoicing,
            movement: guitarTabMovement,
            scope: "continuous",
            maxFretSpan,
            knotDoMidi: resolvedDoMidi,
            changesOnly: options.harmonyChangesOnly !== false,
          });
        }

        let voiceContinuousIdx = 0;

        for (let c = 0; c < coilGroups.length; c++) {
          const group = coilGroups[c];
          if (c > 0) {
            vLines.push('  \\bar "|"');
          }
          const vOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === vNum);
          if (vOnsets.length > 0) {
            let solvedGrips: GuitarNotePosition[][] = [];
            if (guitarTabScope === "continuous") {
              solvedGrips = vOnsets.map(() => solvedGripsForVoice[voiceContinuousIdx++]);
            } else {
              const passageOnsets: GuitarPassageOnset[] = vOnsets.map((onset, idx) => {
                const prev = idx > 0 ? vOnsets[idx - 1] : undefined;
                const chordKey = `${onset.chordRoot}_${(onset.chordMidi ?? []).join(",")}`;
                const prevChordKey = prev ? `${prev.chordRoot}_${(prev.chordMidi ?? []).join(",")}` : null;
                const isChordChange =
                  idx === 0
                    ? true
                    : chordKey !== prevChordKey || onset.onsetIndex === 1;
                const isStrongBeat =
                  onset.startBeat === undefined ||
                  onset.startBeat % 2.0 === 0 ||
                  (onset.durationBeats !== undefined && onset.durationBeats >= 1.5);
                return {
                  midiNote: onset.midiNote,
                  scaleDegree: onset.scaleDegree,
                  chordRoot: onset.chordRoot,
                  isRest: onset.isRest,
                  isChordChange,
                  isStrongBeat,
                  durationBeats: onset.durationBeats,
                  startBeat: onset.startBeat,
                  onsetIndex: onset.onsetIndex,
                  coilId: onset.coilId,
                };
              });

              solvedGrips = solveGuitarPassage(passageOnsets, {
                voicing: guitarVoicing,
                movement: guitarTabMovement,
                scope: "coil",
                maxFretSpan,
                knotDoMidi: resolvedDoMidi,
                changesOnly: options.harmonyChangesOnly !== false,
              });
            }

            const beamMap = computeOnsetBeaming(vOnsets);
            for (let idx = 0; idx < vOnsets.length; idx++) {
              const onset = vOnsets[idx];
              const beamBracket = beamMap.get(idx) ?? "";
              const grip = solvedGrips[idx];
              const formatted = formatTabNote(onset, grip, beamBracket);
              vLines.push(
                `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_tab_v${vNum}_${onset.onsetIndex} ${formatted}`,
              );
            }
          } else {
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
        tabVoiceMap.set(vNum, vLines.join("\n"));
      }
    } else {
      const guitarTabScope: GuitarTabScope = options.guitarTabScope ?? "coil";
      let solvedGripsContinuous: GuitarNotePosition[][] = [];
      if (guitarTabScope === "continuous") {
        const allOnsets: Onset[] = [];
        for (const group of coilGroups) {
          allOnsets.push(...group.onsets);
        }
        const passageOnsets: GuitarPassageOnset[] = allOnsets.map((onset, idx) => {
          const prev = idx > 0 ? allOnsets[idx - 1] : undefined;
          const chordKey = `${onset.chordRoot}_${(onset.chordMidi ?? []).join(",")}`;
          const prevChordKey = prev ? `${prev.chordRoot}_${(prev.chordMidi ?? []).join(",")}` : null;
          const isChordChange =
            idx === 0
              ? true
              : chordKey !== prevChordKey || (onset.onsetIndex === 1 && onset.coilId !== prev?.coilId);
          const isStrongBeat =
            onset.startBeat === undefined ||
            onset.startBeat % 2.0 === 0 ||
            (onset.durationBeats !== undefined && onset.durationBeats >= 1.5);
          return {
            midiNote: onset.midiNote,
            scaleDegree: onset.scaleDegree,
            chordRoot: onset.chordRoot,
            isRest: onset.isRest,
            isChordChange,
            isStrongBeat,
            durationBeats: onset.durationBeats,
            startBeat: onset.startBeat,
            onsetIndex: onset.onsetIndex,
            coilId: onset.coilId,
          };
        });

        solvedGripsContinuous = solveGuitarPassage(passageOnsets, {
          voicing: guitarVoicing,
          movement: guitarTabMovement,
          scope: "continuous",
          maxFretSpan,
          knotDoMidi: resolvedDoMidi,
          changesOnly: options.harmonyChangesOnly !== false,
        });
      }

      let singleContinuousIdx = 0;

      for (let c = 0; c < coilGroups.length; c++) {
        const group = coilGroups[c];
        if (c > 0) {
          tabLines.push('  \\bar "|"');
        }
        let solvedGrips: GuitarNotePosition[][] = [];
        if (guitarTabScope === "continuous") {
          solvedGrips = group.onsets.map(() => solvedGripsContinuous[singleContinuousIdx++]);
        } else {
          const passageOnsets: GuitarPassageOnset[] = group.onsets.map((onset, idx) => {
            const prev = idx > 0 ? group.onsets[idx - 1] : undefined;
            const chordKey = `${onset.chordRoot}_${(onset.chordMidi ?? []).join(",")}`;
            const prevChordKey = prev ? `${prev.chordRoot}_${(prev.chordMidi ?? []).join(",")}` : null;
            const isChordChange =
              idx === 0
                ? true
                : chordKey !== prevChordKey || onset.onsetIndex === 1;
            const isStrongBeat =
              onset.startBeat === undefined ||
              onset.startBeat % 2.0 === 0 ||
              (onset.durationBeats !== undefined && onset.durationBeats >= 1.5);
            return {
              midiNote: onset.midiNote,
              scaleDegree: onset.scaleDegree,
              chordRoot: onset.chordRoot,
              isRest: onset.isRest,
              isChordChange,
              isStrongBeat,
              durationBeats: onset.durationBeats,
              startBeat: onset.startBeat,
              onsetIndex: onset.onsetIndex,
              coilId: onset.coilId,
            };
          });

          solvedGrips = solveGuitarPassage(passageOnsets, {
            voicing: guitarVoicing,
            movement: guitarTabMovement,
            scope: "coil",
            maxFretSpan,
            knotDoMidi: resolvedDoMidi,
            changesOnly: options.harmonyChangesOnly !== false,
          });
        }

        const beamMap = computeOnsetBeaming(group.onsets);
        for (let idx = 0; idx < group.onsets.length; idx++) {
          const onset = group.onsets[idx];
          const beamBracket = beamMap.get(idx) ?? "";
          const grip = solvedGrips[idx];
          const formatted = formatTabNote(onset, grip, beamBracket);
          tabLines.push(
            `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_tab_${onset.onsetIndex} ${formatted}`,
          );
        }
      }
      if (onsets.length > 0) {
        tabLines.push('  \\bar "|."');
      }
      tabLines.push("  \\cadenzaOff");
    }
  }

  const harmonyStaffStyle = options.harmonyStaffStyle ?? "standard";
  const showMelody = options.showMelody ?? true;
  const showMelodyCoilAbsolute = options.showMelodyCoilAbsolute ?? false;
  const showMelodyCoilInterval = options.showMelodyCoilInterval ?? false;
  const showRhythmCoil = options.showRhythmCoil ?? false;
  const showPulseCoil = options.showPulseCoil ?? false;
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
                const absToken = (doMidi !== undefined && onset.midiNote !== undefined)
                  ? semitoneIntervalToSolfege(onset.midiNote - doMidi)
                  : onset.scaleDegree;
                const markup = chordTokenToCoilMarkup(absToken);
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
          const absToken = (doMidi !== undefined && onset.midiNote !== undefined)
            ? semitoneIntervalToSolfege(onset.midiNote - doMidi)
            : onset.scaleDegree;
          const markup = chordTokenToCoilMarkup(absToken);
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
          const baseAnchor = (doMidi !== undefined && onset.midiNote !== undefined)
            ? semitoneIntervalToSolfege(onset.midiNote - doMidi)
            : onset.scaleDegree;
          if (baseAnchor.includes('^') || baseAnchor.includes('_')) {
            const octIdx = baseAnchor.search(/[\^_]/);
            token = `${baseAnchor.slice(0, octIdx)}x${baseAnchor.slice(octIdx)}`;
          } else {
            token = `${baseAnchor}x`;
          }
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

  function roundBeat(b: number): number {
    return Math.round(b * 9600) / 9600;
  }

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
        const start = roundBeat(o.startBeat ?? (o.onsetIndex - 1));
        const durB = o.durationBeats !== undefined ? roundBeat(o.durationBeats) : 1.0;
        const end = roundBeat(start + durB);
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
  // 3b. Pulse / Metric Coil Voice (Row band displaying Solfège metric pulse glyphs)
  // ---------------------------------------------------------------------------
  const pulseCoilLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];

  if (showPulseCoil) {
    let runningPhaseOffset = 0;
    let prevPulseKey = "";

    for (let g = 0; g < coilGroups.length; g++) {
      const group = coilGroups[g];
      if (g > 0) {
        pulseCoilLines.push('  \\bar "|"');
      }

      const pOnsets = group.onsets.filter((o) => (o.voiceIndex ?? 1) === 1);
      const totalBeats = pOnsets.reduce(
        (sum, o) => sum + (o.durationBeats !== undefined ? o.durationBeats : 1.0),
        0,
      );
      const groupPulse = (group.onsets[0] as any)?.pulse ?? (group.onsets[0] as any)?.meter ?? options.pulse ?? options.meter ?? 'DoLa';
      const pulseKey = Array.isArray(groupPulse) ? groupPulse.join(',') : String(groupPulse);
      const grammar = resolveMetricGrammar(groupPulse);
      const barBeats = grammar.totalBeats;

      if (g === 0) {
        // Check if first coil is a pickup
        const remainder = totalBeats % barBeats;
        if (remainder > 1e-4) {
          runningPhaseOffset = (barBeats - remainder) % barBeats;
        } else {
          runningPhaseOffset = 0;
        }
      } else if (pulseKey !== prevPulseKey) {
        // Reset pulse tracking to downbeat if pulse definition changed
        runningPhaseOffset = 0;
      }

      const pulses = resolveMetricPulseTimeline(groupPulse, totalBeats, runningPhaseOffset);
      runningPhaseOffset = (runningPhaseOffset + totalBeats) % barBeats;
      prevPulseKey = pulseKey;

      for (let pIdx = 0; pIdx < pulses.length; pIdx++) {
        const pulse = pulses[pIdx];
        const markup = chordTokenToCoilMarkup(pulse.syllable);
        pulseCoilLines.push(
          `  \\tag #'ppt_${group.weaveId}_${group.coilId}_pulse_${pIdx + 1} \\tweak NoteHead.text ${markup} b'${pulse.lilypondDuration ?? '4'}`,
        );
      }
    }

    if (coilGroups.length > 0) {
      pulseCoilLines.push('  \\bar "|."');
    }
  }
  pulseCoilLines.push("  \\cadenzaOff");

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
  const chordTrianglesLines: string[] = [];

  if (omitStem) {
    harmonyLines.push("  \\omit Stem");
    harmonyLines.push("  \\omit Flag");
    harmonyLines.push("  \\omit Beam");
    harmonyLines.push("  \\omit Dots");
  }

  if (showTimeSignature) {
    harmonyLines.push(`  \\time ${resolvedTimeSig}`);
  }

  if (!traditionalRhythms) {
    harmonyLines.push("  \\override NoteHead.duration-log = #2");
  }
  harmonyLines.push("  \\cadenzaOn");

  if (harmonyChangesOnly) {
    // 4a. Traditional Harmony Voice (5-line staff): Group consecutive onsets with same voiced chord
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

    let currentHarmonyChunk: typeof harmonyChunks[0] | null = null;

    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== primaryOnsets[i - 1].coilId ||
          onset.weaveId !== primaryOnsets[i - 1].weaveId);

      const isSameChord =
        currentHarmonyChunk &&
        !isNewCoil &&
        currentHarmonyChunk.chordMidi.length === onset.chordMidi.length &&
        currentHarmonyChunk.chordMidi.every((m, idx) => m === onset.chordMidi[idx]);

      if (isSameChord && currentHarmonyChunk) {
        currentHarmonyChunk.spanCount++;
        if (onset.durationBeats !== undefined) {
          currentHarmonyChunk.totalDurationBeats =
            (currentHarmonyChunk.totalDurationBeats ?? 0) + onset.durationBeats;
        }
      } else {
        if (currentHarmonyChunk) {
          harmonyChunks.push(currentHarmonyChunk);
        }
        currentHarmonyChunk = {
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
    if (currentHarmonyChunk) {
      harmonyChunks.push(currentHarmonyChunk);
    }

    for (const chunk of harmonyChunks) {
      if (chunk.isBarStart) {
        harmonyLines.push('  \\bar "|"');
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
      } else {
        const chord = chordMidiToLilyPond(
          chunk.chordMidi,
          harmShift,
          accMode,
          forceAccidentals,
        );
        harmonyLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_harmonyStaff_${chunk.onsetIndex} ${chord}${chordDuration}`);
      }
    }

    // 4b. Lead Sheet ChordNames: Group consecutive onsets with same Solfège chordRoot
    const chordNameChunks: Array<{
      weaveId: string;
      coilId: string;
      onsetIndex: number;
      tag: string;
      chordRoot: string;
      spanCount: number;
      totalDurationBeats?: number;
      isBarStart: boolean;
    }> = [];

    let currentChordNameChunk: typeof chordNameChunks[0] | null = null;

    for (let i = 0; i < primaryOnsets.length; i++) {
      const onset = primaryOnsets[i];
      const isNewCoil =
        i > 0 &&
        (onset.onsetIndex === 1 ||
          onset.coilId !== primaryOnsets[i - 1].coilId ||
          onset.weaveId !== primaryOnsets[i - 1].weaveId);

      const isSameRoot =
        currentChordNameChunk &&
        !isNewCoil &&
        currentChordNameChunk.chordRoot === onset.chordRoot;

      if (isSameRoot && currentChordNameChunk) {
        currentChordNameChunk.spanCount++;
        if (onset.durationBeats !== undefined) {
          currentChordNameChunk.totalDurationBeats =
            (currentChordNameChunk.totalDurationBeats ?? 0) + onset.durationBeats;
        }
      } else {
        if (currentChordNameChunk) {
          chordNameChunks.push(currentChordNameChunk);
        }
        currentChordNameChunk = {
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
    if (currentChordNameChunk) {
      chordNameChunks.push(currentChordNameChunk);
    }

    for (const chunk of chordNameChunks) {
      if (chunk.isBarStart) {
        chordNamesLines.push('  \\bar "|"');
        chordTrianglesLines.push('  \\bar "|"');
      }
      const chordDuration =
        chunk.totalDurationBeats !== undefined
          ? beatsToLilyPondDuration(chunk.totalDurationBeats, traditionalRhythms)
          : chunk.spanCount === 4
            ? "1"
            : traditionalRhythms
              ? beatsToLilyPondDuration(chunk.spanCount, true)
              : `1*${chunk.spanCount}/4`;

      if (!chunk.chordRoot) {
        chordNamesLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordName_${chunk.onsetIndex} s${chordDuration}`);
        chordTrianglesLines.push(`  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordTriangle_${chunk.onsetIndex} s${chordDuration}`);
      } else {
        const canonicalChord = canonicalChordToLilyPond(
          chunk.chordRoot,
          resolvedDoMidi,
          accMode,
          forceAccidentals,
        );
        const rootSyllable = parseHarmonyChord(chunk.chordRoot).rootSyllable;
        const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
        const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
        chordNamesLines.push(
          `  \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordName_${chunk.onsetIndex} ${colorTweak}${canonicalChord}${chordDuration}`,
        );

        const ptMarkup = canonicalChordToPianoTriangleMarkup(chunk.chordRoot, resolvedDoMidi);
        chordTrianglesLines.push(
          `  \\once \\override ChordName.text = \\markup ${ptMarkup} \\tag #'ppt_${chunk.weaveId}_${chunk.coilId}_chordTriangle_${chunk.onsetIndex} ${canonicalChord}${chordDuration}`,
        );
      }
    }
  } else {
    for (let c = 0; c < coilGroups.length; c++) {
      const group = coilGroups[c];
      if (c > 0) {
        harmonyLines.push('  \\bar "|"');
        chordNamesLines.push('  \\bar "|"');
        chordTrianglesLines.push('  \\bar "|"');
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

        if (!onset.chordRoot) {
          chordNamesLines.push(
            `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_chordName_${onset.onsetIndex} s${onsetDur}`,
          );
          chordTrianglesLines.push(
            `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_chordTriangle_${onset.onsetIndex} s${onsetDur}`,
          );
        } else {
          const canonicalChord = canonicalChordToLilyPond(
            onset.chordRoot,
            resolvedDoMidi,
            accMode,
            forceAccidentals,
          );
          const rootSyllable = parseHarmonyChord(onset.chordRoot).rootSyllable;
          const rootColor = SOLFEGE_TO_SCHEME_COLOR[rootSyllable] ?? "colorDo";
          const colorTweak = colorNotes ? `\\tweak color #${rootColor} ` : "";
          chordNamesLines.push(
            `  \\tag #'ppt_${onset.weaveId}_${onset.coilId}_chordName_${onset.onsetIndex} ${colorTweak}${canonicalChord}${onsetDur}`,
          );

          const ptMarkup = canonicalChordToPianoTriangleMarkup(onset.chordRoot, resolvedDoMidi);
          chordTrianglesLines.push(
            `  \\once \\override ChordName.text = \\markup ${ptMarkup} \\tag #'ppt_${onset.weaveId}_${onset.coilId}_chordTriangle_${onset.onsetIndex} ${canonicalChord}${onsetDur}`,
          );
        }
      }
    }
  }

  if (primaryOnsets.length > 0) {
    harmonyLines.push('  \\bar "|."');
    chordNamesLines.push('  \\bar "|."');
    chordTrianglesLines.push('  \\bar "|."');
  }
  harmonyLines.push("  \\cadenzaOff");

  const melodyVoiceStr = melodyLines.join("\n");
  const melodyCoilAbsoluteVoiceStr = melodyCoilAbsoluteLinesSingle.join("\n");
  const melodyCoilIntervalVoiceStr = melodyCoilIntervalLines.join("\n");
  const rhythmCoilVoiceStr = rhythmCoilLines.join("\n");
  const pulseCoilVoiceStr = pulseCoilLines.join("\n");
  const harmonyCoilVoiceStr = harmonyCoilLines.join("\n");
  const harmonyVoiceStr = harmonyLines.join("\n");
  const chordNamesVoiceStr = chordNamesLines.join("\n");
  const chordTrianglesVoiceStr = chordTrianglesLines.join("\n");

  const gridSymbolsMode = options.gridSymbols;
  const hasGridSymbols =
    gridSymbolsMode === true ||
    gridSymbolsMode === "all" ||
    gridSymbolsMode === "no-do";
  const excludeDo =
    options.excludeGridDoSymbol === true || gridSymbolsMode === "no-do";
  const hasCoils =
    showMelodyCoilAbsolute ||
    showMelodyCoilInterval ||
    showRhythmCoil ||
    showPulseCoil ||
    showHarmonyCoil;

  // Assemble staves in PianoStaff
  const gridSuffix = options.showRhythmGrid ? " \\rhythmGridVoice >>" : "";
  const wrapWithGrid = (voiceName: string) =>
    options.showRhythmGrid ? `<< ${voiceName}${gridSuffix}` : voiceName;

  const makeCoilStaff = (voiceName: string, clefStencil: string, isTopCoil = false, isBottomCoil = false) => {
    let combinedVoice = voiceName;
    if (hasGridSymbols) {
      if (isTopCoil && isBottomCoil) {
        // When only one coil layer is shown, place the single row between the coil layer and the melody staff (top)
        combinedVoice = `<< ${combinedVoice} \\gridSymbolsTopVoice >>`;
      } else if (isTopCoil) {
        combinedVoice = `<< ${combinedVoice} \\gridSymbolsTopVoice >>`;
      } else if (isBottomCoil) {
        combinedVoice = `<< ${combinedVoice} \\gridSymbolsBottomVoice >>`;
      }
    }

    return `      \\new Staff \\with {
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
      } ${wrapWithGrid(combinedVoice)}`;
  };

  const coilStaffDefList: Array<{ voiceName: string; clefStencil: string }> = [];
  if (showMelodyCoilAbsolute) {
    if (isMultiVoice) {
      for (const v of voiceIndices) {
        coilStaffDefList.push({
          voiceName: `\\melodyCoilAbsoluteVoice${voiceNumberToWord(v)}`,
          clefStencil: `#(make-clef-text-stencil "M${v}")`,
        });
      }
    } else {
      coilStaffDefList.push({
        voiceName: "\\melodyCoilAbsoluteVoice",
        clefStencil: "#pptClefMStencil",
      });
    }
  }

  if (showMelodyCoilInterval) {
    coilStaffDefList.push({
      voiceName: "\\melodyCoilIntervalVoice",
      clefStencil: isMultiVoice ? '#(make-clef-text-stencil "M1")' : "#pptClefMStencil",
    });
  }

  if (showRhythmCoil) {
    coilStaffDefList.push({
      voiceName: "\\rhythmCoilVoice",
      clefStencil: "#pptClefRStencil",
    });
  }

  if (showPulseCoil) {
    coilStaffDefList.push({
      voiceName: "\\pulseCoilVoice",
      clefStencil: "#pptClefPStencil",
    });
  }

  if (showHarmonyCoil) {
    coilStaffDefList.push({
      voiceName: "\\harmonyCoilVoice",
      clefStencil: "#pptClefHStencil",
    });
  }

  const numCoils = coilStaffDefList.length;

  const gridSymbolsTopLines: string[] = [
    "  \\override TextScript.outside-staff-priority = ##f",
    "  \\override TextScript.self-alignment-Y = #CENTER",
    hasCoils
      ? "  \\override TextScript.Y-offset = #3.6"
      : "  \\override TextScript.Y-offset = #4.5",
    "  \\cadenzaOn",
  ];
  const gridSymbolsBottomLines: string[] = [
    "  \\override TextScript.outside-staff-priority = ##f",
    "  \\override TextScript.self-alignment-Y = #CENTER",
    hasCoils
      ? "  \\override TextScript.Y-offset = #-3.6"
      : "  \\override TextScript.Y-offset = #-4.5",
    "  \\cadenzaOn",
  ];
  const gridSymbolsVoiceLines: string[] = [
    "  \\override NoteHead.stencil = #ly:text-interface::print",
    "  \\cadenzaOn",
  ];

  if (hasGridSymbols) {
    if (numCoils === 0) {
      // When no coil staves are shown, grid symbols are rendered in a dedicated compact staff
      // with real notes/durations to drive LilyPond horizontal spacing and prevent note collisions
      for (let c = 0; c < coilGroups.length; c++) {
        const group = coilGroups[c];
        if (c > 0) {
          gridSymbolsVoiceLines.push('  \\bar "|"');
        }

        const timestampMap = new Map<number, { rhythmToken?: string; isRest?: boolean }>();
        let maxEndBeat = 0;

        for (const o of group.onsets) {
          const start = roundBeat(o.startBeat ?? (o.onsetIndex - 1));
          const durB = o.durationBeats !== undefined ? roundBeat(o.durationBeats) : 1.0;
          const end = roundBeat(start + durB);
          if (end > maxEndBeat) {
            maxEndBeat = end;
          }

          const existing = timestampMap.get(start);
          if (!existing) {
            timestampMap.set(start, { rhythmToken: o.rhythmToken, isRest: o.isRest });
          } else {
            if (!existing.rhythmToken && o.rhythmToken) {
              existing.rhythmToken = o.rhythmToken;
            }
            if (existing.isRest === undefined && o.isRest !== undefined) {
              existing.isRest = o.isRest;
            }
          }
        }

        const sortedTimes = Array.from(timestampMap.keys()).sort((a, b) => a - b);
        if (sortedTimes.length === 0) {
          sortedTimes.push(0);
          maxEndBeat = 1.0;
        }

        const tokens: string[] = [];
        for (let tIdx = 0; tIdx < sortedTimes.length; tIdx++) {
          const startBeat = sortedTimes[tIdx];
          const nextBeat = tIdx < sortedTimes.length - 1 ? sortedTimes[tIdx + 1] : maxEndBeat;
          const durationBeats = Math.max(0.125, nextBeat - startBeat);
          const durationStr = beatsToLilyPondDuration(durationBeats);

          const entry = timestampMap.get(startBeat);
          let rhythmToken = entry?.rhythmToken;
          if (!rhythmToken) {
            const f = startBeat - Math.floor(startBeat);
            const s = Math.round(f * 12) % 12;
            rhythmToken = SOLFEGE_POSITIONS[s] ?? "Do";
          }

          const schemeVar = getGridSymbolSchemeVar(
            {
              rhythmToken,
              startBeat,
              isRest: entry?.isRest,
            } as any,
            excludeDo,
          );

          if (schemeVar) {
            tokens.push(`\\tweak NoteHead.text \\markup { \\stencil #${schemeVar} } b'${durationStr}`);
          } else {
            tokens.push(`\\tweak NoteHead.stencil ##f b'${durationStr}`);
          }
        }
        gridSymbolsVoiceLines.push(`  ${tokens.join(" ")}`);
      }

      if (coilGroups.length > 0) {
        gridSymbolsVoiceLines.push('  \\bar "|."');
      }
      gridSymbolsVoiceLines.push("  \\cadenzaOff");
    } else {
      // When coil staves are shown, top & bottom grid symbols frame the coil stack
      for (let c = 0; c < coilGroups.length; c++) {
        const group = coilGroups[c];
        const timestampMap = new Map<number, { rhythmToken?: string; isRest?: boolean }>();
        let maxEndBeat = 0;

        for (const o of group.onsets) {
          const start = roundBeat(o.startBeat ?? (o.onsetIndex - 1));
          const durB = o.durationBeats !== undefined ? roundBeat(o.durationBeats) : 1.0;
          const end = roundBeat(start + durB);
          if (end > maxEndBeat) {
            maxEndBeat = end;
          }

          const existing = timestampMap.get(start);
          if (!existing) {
            timestampMap.set(start, { rhythmToken: o.rhythmToken, isRest: o.isRest });
          } else {
            if (existing.isRest && !o.isRest) {
              existing.isRest = false;
              existing.rhythmToken = o.rhythmToken;
            } else if (!existing.rhythmToken && o.rhythmToken) {
              existing.rhythmToken = o.rhythmToken;
            }
          }
        }

        const sortedTimes = Array.from(timestampMap.keys()).sort((a, b) => a - b);
        if (sortedTimes.length === 0) {
          sortedTimes.push(0);
          maxEndBeat = 1.0;
        }

        const topSpacers: string[] = [];
        const bottomSpacers: string[] = [];

        for (let tIdx = 0; tIdx < sortedTimes.length; tIdx++) {
          const startBeat = sortedTimes[tIdx];
          const nextBeat = tIdx < sortedTimes.length - 1 ? sortedTimes[tIdx + 1] : maxEndBeat;
          const durationBeats = Math.max(0.125, nextBeat - startBeat);
          const durationStr = beatsToLilyPondDuration(durationBeats);

          const entry = timestampMap.get(startBeat);
          let rhythmToken = entry?.rhythmToken;
          if (!rhythmToken) {
            const f = startBeat - Math.floor(startBeat);
            const s = Math.round(f * 12) % 12;
            rhythmToken = SOLFEGE_POSITIONS[s] ?? "Do";
          }

          const schemeVar = getGridSymbolSchemeVar(
            {
              rhythmToken,
              startBeat,
              isRest: entry?.isRest,
            } as any,
            excludeDo,
          );

          if (schemeVar) {
            topSpacers.push(`s${durationStr}^\\markup { \\stencil #${schemeVar} }`);
            bottomSpacers.push(`s${durationStr}_\\markup { \\stencil #${schemeVar} }`);
          } else {
            topSpacers.push(`s${durationStr}`);
            bottomSpacers.push(`s${durationStr}`);
          }
        }

        gridSymbolsTopLines.push(`  ${topSpacers.join(" ")}`);
        gridSymbolsBottomLines.push(`  ${bottomSpacers.join(" ")}`);
        if (c < coilGroups.length - 1) {
          gridSymbolsTopLines.push('  \\bar "|"');
          gridSymbolsBottomLines.push('  \\bar "|"');
        } else {
          gridSymbolsTopLines.push('  \\bar "|."');
          gridSymbolsBottomLines.push('  \\bar "|."');
        }
      }
      gridSymbolsTopLines.push("  \\cadenzaOff");
      gridSymbolsBottomLines.push("  \\cadenzaOff");
    }
  }

  const gridSymbolsTopVoiceStr = gridSymbolsTopLines.join("\n");
  const gridSymbolsBottomVoiceStr = gridSymbolsBottomLines.join("\n");
  const gridSymbolsVoiceStr = gridSymbolsVoiceLines.join("\n");

  const coilStaffLines: string[] = coilStaffDefList.map((def, idx) =>
    makeCoilStaff(def.voiceName, def.clefStencil, idx === 0, idx === numCoils - 1),
  );

  const rhythmGridLines: string[] = ["  \\cadenzaOn"];
  if (options.showRhythmGrid) {
    const strongBeatGridWeight = options.strongBeatGridWeight === true;

    let runningPhaseOffset = 0;
    let prevPulseKey = "";

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
      const groupPulse = (group.onsets[0] as any)?.pulse ?? (group.onsets[0] as any)?.meter ?? options.pulse ?? options.meter ?? 'DoLa';
      const pulseKey = Array.isArray(groupPulse) ? groupPulse.join(',') : String(groupPulse);
      const grammar = resolveMetricGrammar(groupPulse);
      const barBeats = grammar.totalBeats;

      if (c === 0) {
        const remainder = totalBeats % barBeats;
        if (remainder > 1e-4) {
          runningPhaseOffset = (barBeats - remainder) % barBeats;
        } else {
          runningPhaseOffset = 0;
        }
      } else if (pulseKey !== prevPulseKey) {
        runningPhaseOffset = 0;
      }

      const pulses = strongBeatGridWeight
        ? resolveMetricPulseTimeline(groupPulse, totalBeats, runningPhaseOffset)
        : [];

      runningPhaseOffset = (runningPhaseOffset + totalBeats) % barBeats;
      prevPulseKey = pulseKey;

      const spacers: string[] = [];
      for (let b = 0; b < fullBeats; b++) {
        const pulse = pulses[b];
        const isStrong = pulse
          ? (pulse.weight === "primary" || pulse.syllable.startsWith("Do") || pulse.syllable.startsWith("Dox") || pulse.syllable.startsWith("Di") || pulse.syllable.startsWith("Dix"))
          : (b === 0);
        const pt = isStrong
          ? "make-strong-grid-point-stencil"
          : "make-weak-grid-point-stencil";
        spacers.push(`\\once \\override Staff.GridPoint.stencil = #${pt} s4`);
      }
      if (fracBeats > 1e-4) {
        const fracDur = beatsToLilyPondDuration(fracBeats);
        spacers.push(`\\once \\override Staff.GridPoint.stencil = #make-weak-grid-point-stencil s${fracDur}`);
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
    const melodyInnerVoices = ["\\melodyVoice"];
    if (options.showRhythmGrid) {
      melodyInnerVoices.push("\\rhythmGridVoice");
    }
    if (melodyInnerVoices.length > 1) {
      staffLines.push(`    \\new Staff << ${melodyInnerVoices.join(" ")} >>`);
    } else {
      staffLines.push("    \\new Staff \\melodyVoice");
    }
  }

  if (hasGridSymbols && numCoils === 0) {
    staffLines.push(`      \\new Staff \\with {
        \\override StaffSymbol.stencil = ##f
        \\override Clef.stencil = ##f
        \\override Clef.X-extent = #'(-0.2 . 1.2)
        \\override Clef.Y-extent = #'(-1.0 . 1.0)
        \\override NoteHead.Y-extent = #'(-1.0 . 1.0)
        \\override TimeSignature.stencil = ##f
        \\override Stem.stencil = ##f
        \\override Flag.stencil = ##f
        \\override Beam.stencil = ##f
        \\override Dots.stencil = ##f
        \\override NoteHead.no-ledgers = ##t
      } ${wrapWithGrid('\\gridSymbolsVoice')}`);
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
    const harmonyInnerVoices = ["\\harmonyVoice"];
    if (options.showRhythmGrid) {
      harmonyInnerVoices.push("\\rhythmGridVoice");
    }
    if (harmonyInnerVoices.length > 1) {
      staffLines.push(`    \\new Staff << ${harmonyInnerVoices.join(" ")} >>`);
    } else {
      staffLines.push("    \\new Staff \\harmonyVoice");
    }
  }

  if (showGuitarTab) {
    const tabInnerVoices = isMultiVoice
      ? voiceIndices.map((v) => `\\tabVoice${voiceNumberToWord(v)}`)
      : ["\\tabVoice"];
    if (options.showRhythmGrid) {
      tabInnerVoices.push("\\rhythmGridVoice");
    }
    const tabTuningConfig = guitarTuning
      ? `stringTunings = #${guitarTuning}\n`
      : `stringTunings = #guitar-tuning\n`;
    if (tabInnerVoices.length > 1) {
      staffLines.push(`    \\new TabStaff \\with {\n      ${tabTuningConfig.trim()}\n    } << ${tabInnerVoices.join(" ")} >>`);
    } else {
      staffLines.push(`    \\new TabStaff \\with {\n      ${tabTuningConfig.trim()}\n    } ${tabInnerVoices[0]}`);
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
  const chordWithConfig = `\\with {
      \\override ChordName.self-alignment-X = #LEFT
      \\override VerticalAxisGroup.nonstaff-relatedstaff-spacing =
        #'((basic-distance . 4)
           (minimum-distance . 3)
           (padding . 1.2)
           (stretchability . 0))
    }`;
  const chordBlocks: string[] = [];
  if (showChordNames) {
    chordBlocks.push(`    \\new ChordNames ${chordWithConfig} {\n${chordChangesDirective}      \\chordNamesVoice\n    }`);
  }
  if (showChordTriangles) {
    chordBlocks.push(`    \\new ChordNames ${chordWithConfig} {\n${chordChangesDirective}      \\chordTrianglesVoice\n    }`);
  }

  const scoreBody = chordBlocks.length > 0
    ? `  <<\n${chordBlocks.join("\n")}\n  ${staffGroupBody.trim()}\n  >>`
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

  // Key anchor & Pulse Signature: vertically aligned with composer/artist on the left side (poet), with vertical padding
  // Each row is stored as its markup body (without the leading \markup keyword)
  // so they can be placed inside \markup \column { ... } without double-\markup.
  let keyAnchorBody: string | null = null;
  let keySignatureBody: string | null = null;
  let pulseSignatureBody: string | null = null;
  if (options.piece) {
    headerLines.push(`  piece = "${options.piece.replace(/"/g, '\\"')}"`);
  } else if (options.doPitch && options.showKeyAnchor !== false) {
    const doPitchClass = options.doPitch.replace(/\d+$/, "");
    const doMidiNum = options.doPitch ? pitchNameToMidi(options.doPitch) : 60;
    const ptPitchStr = midiToPianoTriangleString(doMidiNum);
    const keyAnchorStyle = options.keyAnchorStyle ?? 'standard';

    if (keyAnchorStyle === 'pianoTriangle') {
      const pt = midiToPianoTrianglePitch(doMidiNum);
      const v1 = pt.point === 1 ? 'colorDo' : '#f';
      const v2 = pt.point === 2 ? 'colorDo' : '#f';
      const v3 = pt.point === 3 ? 'colorDo' : '#f';
      keyAnchorBody = `\\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = " \\stencil #(make-piano-triangle-stencil "${pt.triangle}" ${v1} ${v2} ${v3}) }`;
    } else if (keyAnchorStyle === 'both') {
      const pt = midiToPianoTrianglePitch(doMidiNum);
      const v1 = pt.point === 1 ? 'colorDo' : '#f';
      const v2 = pt.point === 2 ? 'colorDo' : '#f';
      const v3 = pt.point === 3 ? 'colorDo' : '#f';
      keyAnchorBody = `\\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = ${doPitchClass} (" \\stencil #(make-piano-triangle-stencil "${pt.triangle}" ${v1} ${v2} ${v3}) \\fontsize #1.5 \\bold ")" }`;
    } else {
      keyAnchorBody = `\\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = ${doPitchClass}" }`;
    }

    if (options.showKeySignature) {
      const segments = getScaleTetrachordChainTriangles(doMidiNum, options.mode ?? 'ionian');
      const stencils = segments.map((seg) => {
        const v1 = seg.vertices[1]?.schemeColorVar ?? '#f';
        const v2 = seg.vertices[2]?.schemeColorVar ?? '#f';
        const v3 = seg.vertices[3]?.schemeColorVar ?? '#f';
        return `\\stencil #(make-piano-triangle-stencil "${seg.triangle}" ${v1} ${v2} ${v3})`;
      });
      keySignatureBody = `\\line \\vcenter { \\fontsize #-1.5 "Key:" \\hspace #0.3 ${stencils.join(" \\hspace #0.4 ")} }`;
    }

    if (options.showPulseSignature || options.pulseSignature) {
      const pulseVal = options.pulse ?? options.meter;
      const displayPulse =
        options.pulseSignature ??
        (pulseVal
          ? Array.isArray(pulseVal)
            ? pulseVal.join("")
            : String(pulseVal)
          : "");

      if (displayPulse) {
        // Parse pulse string into syllables (e.g. "DoRe" -> ["Do","Re"], "[Do, Re, So]" -> ["Do","Re","So"])
        const cleanPulse = displayPulse.replace(/[\[\]]/g, "").replace(/,\s*/g, "");
        const SYL_RE = /Dox|Rax|Dix|Rex|Mex|Rix|Mix|Fax|Fix|Sex|Sox|Lex|Six|Lax|Tex|Lix|Tix|Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti/gi;
        const syllables: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = SYL_RE.exec(cleanPulse)) !== null) {
          syllables.push(m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase());
        }

        if (syllables.length > 0) {
          const glyphStencils = syllables.map((syl) => {
            const hasAxis = syl.endsWith("x") || syl.endsWith("X");
            try {
              const spec = getSolfegeGlyphSpec(syl, hasAxis);
              const basePathVar =
                spec.glyphType === "base"
                  ? "pptPathBase"
                  : spec.glyphType === "sharp"
                    ? "pptPathSharp"
                    : "pptPathFlat";
              const axisBool = hasAxis ? "#t" : "#f";
              return `\\stencil #(make-solfege-glyph ${basePathVar} ${spec.rotation} ${spec.colorSchemeVar} ${axisBool})`;
            } catch {
              return `\\bold "${syl}"`;
            }
          });
          pulseSignatureBody = `\\line \\vcenter { \\fontsize #-1.5 "Pulse:" \\hspace #0.3 ${glyphStencils.join(" ")} }`;
        }
      }
    }
  }

  // Build poet field: compose rows. Inside \markup \column { } each element is a markup body (no \markup prefix).
  const poetRowBodies: string[] = [];
  if (options.poet) poetRowBodies.push(`"${options.poet.replace(/"/g, '\\"')}"`);
  if (keyAnchorBody) poetRowBodies.push(keyAnchorBody);
  if (keySignatureBody) poetRowBodies.push(keySignatureBody);
  if (pulseSignatureBody) poetRowBodies.push(pulseSignatureBody);

  if (poetRowBodies.length === 1) {
    // Single row: emit as standalone \markup
    headerLines.push(`  poet = \\markup ${poetRowBodies[0]}`);
  } else if (poetRowBodies.length > 1) {
    // Multiple rows: wrap in \markup \column { body1 body2 ... }
    headerLines.push(`  poet = \\markup \\column { ${poetRowBodies.join(" ")} }`);
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
  bookTitleMarkup = \\markup {
    \\override #'(baseline-skip . 3.5)
    \\column {
      \\fill-line { \\fromproperty #'header:dedication }
      \\override #'(baseline-skip . 3.5)
      \\column {
        \\fill-line {
          \\huge \\larger \\bold
          \\fromproperty #'header:title
        }
        \\fill-line {
          \\large \\bold
          \\fromproperty #'header:subtitle
        }
        \\fill-line {
          \\smaller \\bold
          \\fromproperty #'header:subsubtitle
        }
        \\fill-line {
          \\general-align #Y #UP \\fromproperty #'header:poet
          { \\large \\bold \\fromproperty #'header:instrument }
          \\general-align #Y #UP \\column {
            \\line { \\fromproperty #'header:composer }
            \\line { \\fromproperty #'header:arranger }
          }
        }
        \\fill-line {
          \\fromproperty #'header:piece
          \\fromproperty #'header:opus
        }
      }
    }
  }
}\n`;

  let preambles = "";
  if (
    colorNotes ||
    noteheadStyle === "ppt" ||
    showGuitarTab ||
    showHarmonyCoil ||
    showMelodyCoilAbsolute ||
    showMelodyCoilInterval ||
    showRhythmCoil ||
    showPulseCoil ||
    options.showRhythmGrid ||
    hasGridSymbols ||
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
  if (showChordTriangles) {
    voiceDefs.push(`chordTrianglesVoice = {\n${chordTrianglesVoiceStr}\n}`);
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
  if (showPulseCoil) {
    voiceDefs.push(`pulseCoilVoice = {\n${pulseCoilVoiceStr}\n}`);
  }
  if (showHarmonyCoil) {
    voiceDefs.push(`harmonyCoilVoice = {\n${harmonyCoilVoiceStr}\n}`);
  }
  if (showTraditionalHarmony) {
    voiceDefs.push(`harmonyVoice = {\n${harmonyVoiceStr}\n}`);
  }
  if (showGuitarTab) {
    if (isMultiVoice) {
      for (const v of voiceIndices) {
        voiceDefs.push(
          `tabVoice${voiceNumberToWord(v)} = {\n${tabVoiceMap.get(v)}\n}`,
        );
      }
    } else {
      voiceDefs.push(`tabVoice = {\n${tabLines.join("\n")}\n}`);
    }
  }
  if (options.showRhythmGrid) {
    voiceDefs.push(`rhythmGridVoice = {\n${rhythmGridVoiceStr}\n}`);
  }
  if (hasGridSymbols) {
    if (numCoils === 0) {
      voiceDefs.push(`gridSymbolsVoice = {\n${gridSymbolsVoiceStr}\n}`);
    } else {
      voiceDefs.push(`gridSymbolsTopVoice = {\n${gridSymbolsTopVoiceStr}\n}`);
      voiceDefs.push(`gridSymbolsBottomVoice = {\n${gridSymbolsBottomVoiceStr}\n}`);
    }
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

  const gridLineThickness = options.strongBeatGridWeight ? "0.8" : "0.5";
  const gridLineColor = options.strongBeatGridWeight ? "(x11-color 'gray65)" : "(x11-color 'gray80)";

  const gridLayoutContext = options.showRhythmGrid
    ? `    \\context {
      \\Score
      \\consists "Grid_line_span_engraver"
      \\override GridLine.stencil = #ly:grid-line-interface::print
      \\override GridLine.color = #${gridLineColor}
      \\override GridLine.style = #'dashed-line
      \\override GridLine.thickness = #${gridLineThickness}
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

  const timeSignatureLayoutContext = showTimeSignature
    ? ""
    : `      \\remove "Time_signature_engraver"\n`;

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
${timeSignatureLayoutContext}${dropNaturalsContext}    }
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
