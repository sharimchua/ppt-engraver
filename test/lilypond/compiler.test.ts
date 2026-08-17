import { describe, it, expect } from 'vitest';
import { compileToLilyPond, chordTokenToCoilMarkup, rhythmTokenToCoilMarkup } from '../../src/lilypond/compiler.js';
import type { OnsetStream } from '../../src/schema/onset.js';

describe('compileToLilyPond', () => {
  const sampleOnsets: OnsetStream = [
    {
      tag: 'ppt_verse_introMotif_1',
      pitch: 'C4',
      midiNote: 60,
      scaleDegree: 'Do',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'introMotif',
      weaveId: 'verse',
      onsetIndex: 1,
    },
    {
      tag: 'ppt_verse_introMotif_2',
      pitch: 'E4',
      midiNote: 64,
      scaleDegree: 'Mi',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'introMotif',
      weaveId: 'verse',
      onsetIndex: 2,
    },
    {
      tag: 'ppt_verse_cadence_1',
      pitch: 'B4',
      midiNote: 71,
      scaleDegree: 'Ti',
      chordTones: ['G4', 'B4', 'D5'],
      chordMidi: [67, 71, 74],
      chordRoot: 'So',
      coilId: 'cadence',
      weaveId: 'verse',
      onsetIndex: 1,
    },
  ];

  it('emits standard LilyPond header and score structure', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\version "2.24.4"');
    expect(ly).toContain('indent = 0\\mm');
    expect(ly).toContain('short-indent = 0\\mm');
    expect(ly).toContain('melodyVoice = {');
    expect(ly).toContain('harmonyVoice = {');
    expect(ly).toContain('\\new PianoStaff \\with {');
    expect(ly).toContain('\\remove "Time_signature_engraver"');
  });

  it('allows custom indentation in mm', () => {
    const ly = compileToLilyPond(sampleOnsets, { indent: 15 });
    expect(ly).toContain('indent = 15\\mm');
  });

  it('emits explicit clefs and accidentalStyle forget on voices', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('melodyVoice = {\n  \\clef treble\n  \\accidentalStyle forget\n  \\override NoteHead.duration-log = #2\n  \\cadenzaOn');
    expect(ly).toContain('harmonyVoice = {\n  \\clef treble\n  \\accidentalStyle forget\n  \\override NoteHead.duration-log = #2\n  \\cadenzaOn');
  });

  it('allows custom clef for harmonyVoice', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyClef: 'bass' });
    expect(ly).toContain('harmonyVoice = {\n  \\clef bass\n  \\accidentalStyle forget\n  \\override NoteHead.duration-log = #2\n  \\cadenzaOn');
  });

  it('formats octave-marked clefs (e.g. bass_8, treble_8) with quotes and applies bass octave shift', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      harmonyClef: 'bass_8',
      melodyClef: 'treble_8',
    });
    expect(ly).toContain('melodyVoice = {\n  \\clef "treble_8"');
    expect(ly).toContain('harmonyVoice = {\n  \\clef "bass_8"');
    // Bass_8 octave shift (-2) automatically places triads cleanly on the bass staff
    expect(ly).toContain("<c, e, g,>1*2/4");
  });





  it('emits cadenzaOn and duration-log = #2 in voices to preserve solid noteheads regardless of duration', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\cadenzaOn');
    expect(ly).toContain('\\cadenzaOff');
    expect(ly).toContain('\\override NoteHead.duration-log = #2');
  });

  it('emits tags with native LilyPond tag syntax', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 b'4");
  });

  it('emits harmony chords in treble register by default (octave 0)', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g' b' d''>1*1/4");
  });

  it('emits harmony chords in bass register when bass clef selected', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyClef: 'bass' });
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c e g>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g b d'>1*1/4");
  });

  it('allows repeating chord on every onset via harmonyChangesOnly: false', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyChangesOnly: false });
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c' e' g'>4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 <c' e' g'>4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g' b' d''>4");
  });




  it('emits coil boundary barline between coils and closing barline at end of score', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\bar "|"');
    expect(ly).toContain('\\bar "|."');
  });

  it('emits ChordNames reading from chordNamesVoice, showing all chords by default', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\new ChordNames {\n      \\chordNamesVoice\n    }');
    expect(ly).toContain('chordNamesVoice = {');
  });

  it('allows enabling chordChanges: true to suppress duplicate consecutive chord names', () => {
    const ly = compileToLilyPond(sampleOnsets, { chordChanges: true });
    expect(ly).toContain('\\new ChordNames {\n      \\set chordChanges = ##t\n      \\chordNamesVoice\n    }');
  });


  it('emits coil boundary barline when repeating the same coil', () => {
    const repeatedCoilOnsets: OnsetStream = [
      {
        tag: 'ppt_verse_motif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'motif',
        weaveId: 'verse',
        onsetIndex: 1,
      },
      {
        tag: 'ppt_verse_motif_2',
        pitch: 'E4',
        midiNote: 64,
        scaleDegree: 'Mi',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'motif',
        weaveId: 'verse',
        onsetIndex: 2,
      },
      {
        tag: 'ppt_verse_motif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'motif',
        weaveId: 'verse',
        onsetIndex: 1, // Repeated coil starting at onset 1
      },
    ];

    const ly = compileToLilyPond(repeatedCoilOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_motif_2 e'4\n  \\bar \"|\"\n  \\tag #'ppt_verse_motif_1 c'4");
  });

  it('allows disabling chord names via showChordNames: false', () => {
    const ly = compileToLilyPond(sampleOnsets, { showChordNames: false });
    expect(ly).not.toContain('chordVoice');
    expect(ly).not.toContain('\\new ChordNames');
  });

  it('engraves sacredHarp shape noteheads aligned with Do anchor and omits stems, flags, and beams', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      noteheadStyle: 'sacredHarp',
      doPitch: 'Eb4',
      omitStem: true,
    });
    expect(ly).toContain('\\key ees \\major');
    expect(ly).toContain('\\omit Staff.KeySignature');
    expect(ly).toContain('\\sacredHarpHeads');
    expect(ly).toContain('\\omit Stem');
    expect(ly).toContain('\\omit Flag');
    expect(ly).toContain('\\omit Beam');
  });

  it('engraves Rhythm Coil voice and staff (single line with R clef) when showRhythmCoil is true', () => {
    const onsetsWithRhythm = sampleOnsets.map((o, idx) => ({
      ...o,
      rhythmToken: idx % 2 === 0 ? 'Do' : 'Fi',
    }));
    const ly = compileToLilyPond(onsetsWithRhythm, { showRhythmCoil: true });
    expect(ly).toContain('#(define pptClefRStencil (make-clef-text-stencil "R"))');
    expect(ly).toContain('rhythmCoilVoice = {');
    expect(ly).toContain('\\override Clef.stencil = #pptClefRStencil');
    expect(ly).toContain('\\rhythmCoilVoice');
  });

  it('engraves aiken shape noteheads aligned with Do anchor', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      noteheadStyle: 'aiken',
      doPitch: 'C4',
    });
    expect(ly).toContain('\\key c \\major');
    expect(ly).toContain('\\omit Staff.KeySignature');
    expect(ly).toContain('\\aikenHeads');
  });

  it('engraves PPT Solfège colors on melody and harmony noteheads when colorNotes is true', () => {
    const ly = compileToLilyPond(sampleOnsets, { colorNotes: true });
    expect(ly).toContain('#(define colorDo');
    expect(ly).toContain('#(define colorRa');
    expect(ly).toContain('#(define colorRe');
    expect(ly).toContain('#(define colorMe');
    expect(ly).toContain('#(define colorMi');
    expect(ly).toContain('#(define colorFa');
    expect(ly).toContain('#(define colorFi');
    expect(ly).toContain('#(define colorSo');
    expect(ly).toContain('#(define colorLe');
    expect(ly).toContain('#(define colorLa');
    expect(ly).toContain('#(define colorTe');
    expect(ly).toContain('#(define colorTi');
    expect(ly).toContain('#(define (color-notehead-with-outline grob)');
    expect(ly).toContain('\\override NoteHead.stencil = #color-notehead-with-outline');
    // Melody noteheads
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 \\tweak color #colorDo c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 \\tweak color #colorMi e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 \\tweak color #colorTi b'4");
    // Leadsheet ChordNames colored by chord root
    expect(ly).toContain("chordNamesVoice = {");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 \\tweak color #colorDo <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 \\tweak color #colorSo <g' b' d''>1*1/4");
    // Traditional harmony staff remains clean without notehead color tweaks
    expect(ly).toContain("harmonyVoice = {");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g' b' d''>1*1/4");
  });

  it('allows disabling noteheadOutline when colorNotes is true', () => {
    const ly = compileToLilyPond(sampleOnsets, { colorNotes: true, noteheadOutline: false });
    expect(ly).not.toContain('\\override NoteHead.stencil = #color-notehead-with-outline');
  });

  it('scales staff and noteheads via zoom attribute (scaling factor e.g. 1.2 -> 24pt, or explicit pt size e.g. 18)', () => {
    const lyFactor = compileToLilyPond(sampleOnsets, { zoom: 1.2 });
    expect(lyFactor).toContain('#(set-global-staff-size 24)');

    const lyDirect = compileToLilyPond(sampleOnsets, { zoom: 18 });
    expect(lyDirect).toContain('#(set-global-staff-size 18)');
  });

  it('enables rhythmic grid lines when showRhythmGrid is true', () => {
    const ly = compileToLilyPond(sampleOnsets, { showRhythmGrid: true });
    expect(ly).toContain('\\consists "Grid_line_span_engraver"');
    expect(ly).toContain('\\consists "Grid_point_engraver"');
    expect(ly).toContain('gridInterval = #(ly:make-moment 1/4)');
    expect(ly).toContain('\\override GridPoint.X-offset = #0.65');
    expect(ly).toContain('\\override GridPoint.Y-offset = #0');
    expect(ly).toContain('\\override GridLine.stencil = #ly:grid-line-interface::print');
    expect(ly).toContain('rhythmGridVoice = {');
    expect(ly).toContain('\\new Staff << \\melodyVoice \\rhythmGridVoice >>');
  });

  it('omits natural signs in shape-note mode by default to prevent unwanted naturals from hidden key signature', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      noteheadStyle: 'sacredHarp',
      doPitch: 'A4',
    });
    expect(ly).toContain('\\key a \\major');
    expect(ly).toContain('\\omit Staff.KeySignature');
    expect(ly).toContain('#(define (drop-naturals-stencil grob)');
    expect(ly).toContain('\\override Accidental.stencil = #drop-naturals-stencil');
  });

  it('engraves standard PPT geometric notehead shapes by default (noteheadStyle: ppt)', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      noteheadStyle: 'ppt',
      colorNotes: true,
    });
    expect(ly).toContain('#(define stencilDo');
    expect(ly).toContain('#(define stencilMi');
    expect(ly).toContain('#(define stencilTi');
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 \\tweak NoteHead.stencil #stencilDo \\tweak color #colorDo c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 \\tweak NoteHead.stencil #stencilMi \\tweak color #colorMi e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 \\tweak NoteHead.stencil #stencilTi \\tweak color #colorTi b'4");
  });

  it('emits header block with metadata and suppresses tagline by default', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      title: 'Dracula',
      composer: 'Midlife Muso',
    });
    expect(ly).toContain('\\header {\n  title = "Dracula"\n  composer = "Midlife Muso"\n  tagline = ##f\n}');
  });

  it('allows custom tagline string in header block', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      title: 'Dracula',
      tagline: 'Custom PPT Engraver',
    });
    expect(ly).toContain('tagline = "Custom PPT Engraver"');
  });

  it('emits Do key anchor with SVG/vector glyph and pitch class in header block', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      title: 'Dracula',
      doPitch: 'Eb4',
    });
    expect(ly).toContain('#(define pptGlyphDo');
    expect(ly).toContain('#(define pptGlyphDoOutlined (make-solfege-glyph pptPathBase 0 colorDo #f))');
    expect(ly).toContain('poet = \\markup \\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = Eb" }');
    expect(ly).toContain('markup-system-spacing =');
  });

  describe('harmonyStaffStyle: "coil" (Three-Layer Coil Notation)', () => {
    it('generates row band staff with light background, border edge lines, H clef stencil, no ledgers, and hidden stems/time signature', () => {
      const ly = compileToLilyPond(sampleOnsets, {
        harmonyStaffStyle: 'coil',
      });

      expect(ly).toContain("\\override StaffSymbol.line-positions = #'(-2.0 2.0)");
      expect(ly).toContain('\\override StaffSymbol.stencil = #ppt-row-band-stencil');
      expect(ly).toContain('\\override StaffSymbol.layer = #-2');
      expect(ly).toContain('\\override NoteHead.no-ledgers = ##t');
      expect(ly).toContain('\\override Clef.stencil = #pptClefHStencil');
      expect(ly).toContain('\\override Clef.Y-offset = #0');
      expect(ly).toContain('\\override Clef.staff-position = #0');
      expect(ly).toContain('\\override TimeSignature.stencil = ##f');
      expect(ly).toContain('\\override Stem.stencil = ##f');
      expect(ly).toContain('\\override NoteHead.stencil = #ly:text-interface::print');
      expect(ly).toContain('#(define (ppt-row-band-stencil grob)');
      expect(ly).toContain('#(define pptClefHStencil (make-clef-text-stencil "H"))');
    });

    it('emits center-aligned solfège glyph noteheads with barlines and durations', () => {
      const ly = compileToLilyPond(sampleOnsets, {
        harmonyStaffStyle: 'coil',
      });

      expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) } b'1*2/4");
      expect(ly).toContain('\\bar "|"');
      expect(ly).toContain("\\tag #'ppt_verse_cadence_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #f) } b'1*1/4");
    });

    it('aligns melody staff, harmony coil staff, and traditional harmony staff together in PianoStaff with stacked zero-padding', () => {
      const ly = compileToLilyPond(sampleOnsets, {
        harmonyStaffStyle: 'coil',
      });

      expect(ly).toContain('melodyVoice = {');
      expect(ly).toContain('harmonyCoilVoice = {');
      expect(ly).toContain('harmonyVoice = {');
      expect(ly).toContain('\\new PianoStaff \\with {');
      expect(ly).toContain('\\override Clef.stencil = #pptClefHStencil');
      expect(ly).toContain('\\melodyVoice');
      expect(ly).toContain('\\harmonyCoilVoice');
      expect(ly).toContain('\\harmonyVoice');
    });

    it('generates Melody Coil Absolute and Melody Coil Interval row layers inside tight StaffGroup when enabled', () => {
      const ly = compileToLilyPond(sampleOnsets, {
        showMelodyCoilAbsolute: true,
        showMelodyCoilInterval: true,
        showHarmonyCoil: true,
      });

      expect(ly).toContain('melodyCoilAbsoluteVoice = {');
      expect(ly).toContain('melodyCoilIntervalVoice = {');
      expect(ly).toContain('\\new StaffGroup \\with {');
      expect(ly).toContain('\\remove "System_start_delimiter_engraver"');
      expect(ly).toContain('\\melodyCoilAbsoluteVoice');
      expect(ly).toContain('\\melodyCoilIntervalVoice');
      expect(ly).toContain('\\override Clef.stencil = #pptClefMStencil');
      expect(ly).toContain('\\melodyVoice');
      expect(ly).toContain('\\harmonyCoilVoice');
      expect(ly).toContain('\\harmonyVoice');
    });
  });
});

describe('chordTokenToCoilMarkup', () => {
  it('formats root glyph markup without modifiers', () => {
    const markup = chordTokenToCoilMarkup('Do');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) }');
  });

  it('formats root glyph markup with axis diacritic (x)', () => {
    const markup = chordTokenToCoilMarkup('Dox');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #t) }');
  });

  it('formats root glyph with subscript minor 3rd modifier (DoMe)', () => {
    const markup = chordTokenToCoilMarkup('DoMe');
    expect(markup).toBe(
      '\\markup \\vcenter \\concat { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) \\lower #0.35 \\stencil #(make-solfege-glyph-sub pptPathBase 270 colorMi #f) }'
    );
  });

  it('formats rotated root with modifier and modifier axis', () => {
    const markup = chordTokenToCoilMarkup('SoMex');
    // So is sharp, rotation 180, colorSo; Mex is base, rotation 270, colorMi, axis #t
    expect(markup).toBe(
      '\\markup \\vcenter \\concat { \\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #f) \\lower #0.35 \\stencil #(make-solfege-glyph-sub pptPathBase 270 colorMi #t) }'
    );
  });

  it('formats chord with multiple subscript modifiers (DoMeTe)', () => {
    const markup = chordTokenToCoilMarkup('DoMeTe');
    expect(markup).toContain('\\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f)');
    expect(markup).toContain('\\lower #0.35 \\stencil #(make-solfege-glyph-sub pptPathBase 270 colorMi #f)');
    expect(markup).toContain('\\lower #0.35 \\stencil #(make-solfege-glyph-sub pptPathSharp 90 colorTi #f)');
  });
});

describe('rhythmTokenToCoilMarkup', () => {
  it('formats standard rhythm syllable without prefix', () => {
    const markup = rhythmTokenToCoilMarkup('Do');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) }');
  });

  it('combines Dox shifted prior to origin so that main syllable aligns with grid line', () => {
    const markup = rhythmTokenToCoilMarkup('DoxDo');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph-with-prefix pptPathBase 0 colorDo #f 1) }');
  });

  it('handles multiple Dox prefixes with count passed to make-solfege-glyph-with-prefix', () => {
    const markup = rhythmTokenToCoilMarkup('DoxDoxDo');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph-with-prefix pptPathBase 0 colorDo #f 2) }');
  });
});









