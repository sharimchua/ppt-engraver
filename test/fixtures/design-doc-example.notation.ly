\version "2.24.4"

#(define colorDo (rgb-color (/ #xE1 255.0) (/ #x36 255.0) (/ #x10 255.0)))
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
                      ((equal? tri-type "D") '((-0.50 . 0.50) (0.0 . -0.55) (0.50 . 0.50)))
                      ((equal? tri-type "L") '((-0.50 . -0.50) (0.50 . -0.50) (0.50 . 0.55)))
                      ((equal? tri-type "U") '((-0.50 . -0.50) (0.0 . 0.55) (0.50 . -0.50)))
                      (else                  '((-0.50 . 0.55) (-0.50 . -0.50) (0.50 . -0.50)))))
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

\header {
  poet = \markup \line \vcenter { \stencil #pptGlyphDoOutlined \fontsize #1.5 \bold " = C" }
  tagline = ##f
}

\paper {
  markup-system-spacing =
    #'((basic-distance . 12)
       (minimum-distance . 8)
       (padding . 3)
       (stretchability . 20))
}

chordNamesVoice = {
  \tag #'ppt_verse_introMotif_chordName_1 <c' e' g'>1
  \bar "|"
  \tag #'ppt_verse_cadence_chordName_1 <g' b' d''>2
  \bar "|."
}

melodyVoice = {
  \clef treble
  \accidentalStyle forget
  \override NoteHead.duration-log = #2
  \cadenzaOn
  \tag #'ppt_verse_introMotif_melody_1 c'4
  \tag #'ppt_verse_introMotif_melody_2 e'4
  \tag #'ppt_verse_introMotif_melody_3 g'4
  \tag #'ppt_verse_introMotif_melody_4 c''4
  \bar "|"
  \tag #'ppt_verse_cadence_melody_1 b'4
  \tag #'ppt_verse_cadence_melody_2 c''4
  \bar "|."
  \cadenzaOff
}

harmonyVoice = {
  \clef treble
  \accidentalStyle forget
  \override NoteHead.duration-log = #2
  \cadenzaOn
  \tag #'ppt_verse_introMotif_harmonyStaff_1 <c' e' g'>1
  \bar "|"
  \tag #'ppt_verse_cadence_harmonyStaff_1 <g b d'>2
  \bar "|."
  \cadenzaOff
}

\score {
  <<
    \new ChordNames \with {
      \override ChordName.self-alignment-X = #LEFT
    } {
      \chordNamesVoice
    }
  \new PianoStaff \with {
    \override StaffGrouper.staff-staff-spacing =
      #'((basic-distance . 9)
         (minimum-distance . 7)
         (padding . 2)
         (stretchability . 0))
    \override StaffGrouper.staffgroup-staff-spacing =
      #'((basic-distance . 9)
         (minimum-distance . 7)
         (padding . 2)
         (stretchability . 0))
  } <<
    \new Staff \melodyVoice
    \new Staff \harmonyVoice
  >>
  >>
  \layout {
    indent = 0\mm
    short-indent = 0\mm
    \context {
      \Staff
      \remove "Time_signature_engraver"
    }
  }
}
