\version "2.24.4"

#(define colorDo (rgb-color (/ #xE1 255.0) (/ #x36 255.0) (/ #x10 255.0)))
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

\header {
  piece = \markup \line \vcenter { \stencil #pptGlyphDoOutlined \fontsize #1.5 \bold " = C" }
  tagline = ##f
}

melodyVoice = {
  \clef treble
  \accidentalStyle forget
  \cadenzaOn
  \tag #'ppt_verse_introMotif_1 c'4
  \tag #'ppt_verse_introMotif_2 e'4
  \tag #'ppt_verse_introMotif_3 g'4
  \tag #'ppt_verse_introMotif_4 c''4
  \bar "|"
  \tag #'ppt_verse_cadence_1 b'4
  \tag #'ppt_verse_cadence_2 c''4
  \cadenzaOff
}


harmonyVoice = {
  \clef treble
  \accidentalStyle forget
  \cadenzaOn
  \tag #'ppt_verse_introMotif_1 <c' e' g'>1
  \bar "|"
  \tag #'ppt_verse_cadence_1 <g b d'>1*2/4
  \cadenzaOff
}

\score {
  <<
    \new ChordNames {
      \set chordChanges = ##t
      \harmonyVoice
    }
    \new PianoStaff <<
      \new Staff \melodyVoice
      \new Staff \harmonyVoice
    >>
  >>
  \layout {
    \context {
      \Staff
      \remove "Time_signature_engraver"
    }
  }
}
