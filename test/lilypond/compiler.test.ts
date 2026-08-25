import { describe, it, expect } from 'vitest';
import { compileToLilyPond, chordTokenToCoilMarkup, rhythmTokenToCoilMarkup, computeOnsetBeaming } from '../../src/lilypond/compiler.js';
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
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_1 c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_2 e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_melody_1 b'4");
  });

  it('emits harmony chords in treble register by default (octave 0)', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmonyStaff_1 <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_harmonyStaff_1 <g' b' d''>1*1/4");
  });

  it('emits harmony chords in bass register when bass clef selected', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyClef: 'bass' });
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmonyStaff_1 <c e g>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_harmonyStaff_1 <g b d'>1*1/4");
  });

  it('allows repeating chord on every onset via harmonyChangesOnly: false', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyChangesOnly: false });
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmonyStaff_1 <c' e' g'>4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmonyStaff_2 <c' e' g'>4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_harmonyStaff_1 <g' b' d''>4");
  });




  it('emits coil boundary barline between coils and closing barline at end of score', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\bar "|"');
    expect(ly).toContain('\\bar "|."');
  });

  it('emits ChordNames reading from chordNamesVoice, showing all chords by default', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\new ChordNames {\n      \\chordNamesVoice\n    }');
  });

  it('allows enabling chordChanges: true to suppress duplicate consecutive chord names', () => {
    const ly = compileToLilyPond(sampleOnsets, { chordChanges: true });
    expect(ly).toContain('\\new ChordNames {\n      \\set chordChanges = ##t\n      \\chordNamesVoice\n    }');
  });

  it('renders repeated coil onsets with new barline when onset index resets to 1', () => {
    const repeatedCoilOnsets: OnsetStream = [
      ...sampleOnsets,
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
    expect(ly).toContain("\\tag #'ppt_verse_cadence_melody_1 b'4\n  \\bar \"|\"\n  \\tag #'ppt_verse_motif_melody_1 c'4");
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
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_1 \\tweak color #colorDo c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_2 \\tweak color #colorMi e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_melody_1 \\tweak color #colorTi b'4");
    // Leadsheet ChordNames colored by chord root
    expect(ly).toContain("chordNamesVoice = {");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_chordName_1 \\tweak color #colorDo <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_chordName_1 \\tweak color #colorSo <g' b' d''>1*1/4");
    // Traditional harmony staff remains clean without notehead color tweaks
    expect(ly).toContain("harmonyVoice = {");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmonyStaff_1 <c' e' g'>1*2/4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_harmonyStaff_1 <g' b' d''>1*1/4");
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
    expect(ly).toContain('\\override GridPoint.stencil = #make-grid-point-stencil');
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
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_1 \\tweak NoteHead.stencil #stencilDo \\tweak color #colorDo c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_melody_2 \\tweak NoteHead.stencil #stencilMi \\tweak color #colorMi e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_melody_1 \\tweak NoteHead.stencil #stencilTi \\tweak color #colorTi b'4");
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

      expect(ly).toContain("\\tag #'ppt_verse_introMotif_harmony_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) } b'1*2/4");
      expect(ly).toContain('\\bar "|"');
      expect(ly).toContain("\\tag #'ppt_verse_cadence_harmony_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #f) } b'1*1/4");
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

  it('formats chord with Axis Bass prefix (SoxDo)', () => {
    const markup = chordTokenToCoilMarkup('SoxDo');
    // Sox bass prefix (sharp 180 colorSo axis #t) + Do root (base 0 colorDo axis #f)
    expect(markup).toContain('\\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #t)');
    expect(markup).toContain('\\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f)');
  });

  it('formats tokens with octave displacement up and down (Do^, So_, Do^^, Me__)', () => {
    const markupUp = chordTokenToCoilMarkup('Do^');
    expect(markupUp).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f 1) }');

    const markupDown = chordTokenToCoilMarkup('So_');
    expect(markupDown).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #f -1) }');

    const markupDoubleUp = chordTokenToCoilMarkup('Do^^');
    expect(markupDoubleUp).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f 2) }');

    const markupDoubleDown = chordTokenToCoilMarkup('Me__');
    expect(markupDoubleDown).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 270 colorMi #f -2) }');
  });

  it('formats chord with octave displacement on Axis Bass prefix (So_xDo)', () => {
    const markup = chordTokenToCoilMarkup('So_xDo');
    expect(markup).toContain('\\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #t -1)');
    expect(markup).toContain('\\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f)');
  });
});

describe('polyphonic voice compilation', () => {
  it('engraves multi-voice onsets with \\new Voice, \\voiceOne, \\voiceTwo, and voice tags', () => {
    const onsets = [
      {
        tag: 'ppt_song_poly_v1_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
      },
      {
        tag: 'ppt_song_poly_v2_1',
        pitch: 'Eb4',
        midiNote: 63,
        scaleDegree: 'Me',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 2,
      },
    ];

    const ly = compileToLilyPond(onsets);
    expect(ly).toContain('\\new Voice = "v1" {');
    expect(ly).toContain('\\voiceOne');
    expect(ly).toContain('\\new Voice = "v2" {');
    expect(ly).toContain('\\voiceTwo');
    expect(ly).toContain("\\tag #'ppt_song_poly_melody_v1_1");
    expect(ly).toContain("\\tag #'ppt_song_poly_melody_v2_1");
  });

  it('generates indexed M1 and M2 row band staves when showMelodyCoilAbsolute is enabled for multi-voice', () => {
    const onsets = [
      {
        tag: 'ppt_song_poly_v1_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
        startBeat: 0.0,
        durationBeats: 1.0,
        duration: '4',
      },
      {
        tag: 'ppt_song_poly_v2_1',
        pitch: 'Eb4',
        midiNote: 63,
        scaleDegree: 'Me',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 2,
        startBeat: 0.0,
        durationBeats: 0.5,
        duration: '8',
      },
      {
        tag: 'ppt_song_poly_v2_2',
        pitch: 'G4',
        midiNote: 67,
        scaleDegree: 'So',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 2,
        voiceIndex: 2,
        startBeat: 0.5,
        durationBeats: 0.5,
        duration: '8',
      },
    ];

    const ly = compileToLilyPond(onsets, {
      showMelodyCoilAbsolute: true,
      showRhythmCoil: true,
      showHarmonyCoil: true,
    });

    // M1 and M2 clefs emitted
    expect(ly).toContain('\\override Clef.stencil = #(make-clef-text-stencil "M1")');
    expect(ly).toContain('\\override Clef.stencil = #(make-clef-text-stencil "M2")');
    expect(ly).toContain('\\override Clef.stencil = #pptClefRStencil');
    expect(ly).toContain('\\override Clef.stencil = #pptClefHStencil');

    // Voice defs
    expect(ly).toContain('melodyCoilAbsoluteVoiceOne = {');
    expect(ly).toContain('melodyCoilAbsoluteVoiceTwo = {');
    expect(ly).toContain('\\melodyCoilAbsoluteVoiceOne');
    expect(ly).toContain('\\melodyCoilAbsoluteVoiceTwo');
    expect(ly).toContain('rhythmCoilVoice = {');

    // Unified collapsed rhythm captures both 0.0 (Do) and 0.5 (Fi)
    expect(ly).toContain("\\tag #'ppt_song_poly_rhythm_1");
    expect(ly).toContain("\\tag #'ppt_song_poly_rhythm_2");
  });

  it('omits stems and flags inside polyphonic voice blocks and in layout context when omitStem is true', () => {
    const onsets = [
      {
        tag: 'ppt_song_poly_v1_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
      },
      {
        tag: 'ppt_song_poly_v2_1',
        pitch: 'Eb4',
        midiNote: 63,
        scaleDegree: 'Me',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 2,
      },
    ];

    const ly = compileToLilyPond(onsets, { omitStem: true });
    // Inside \new Voice blocks
    expect(ly).toContain('\\omit Stem');
    expect(ly).toContain('\\omit Flag');
    // Inside layout context
    expect(ly).toContain('\\Voice');
  });

  it('pads missing voices with skips across heterogeneous single/multi-voice coils', () => {
    const onsets = [
      // Coil 1 (polyphonic: v1 + v2)
      {
        tag: 'ppt_song_c1_v1_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c1',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
        duration: '4',
      },
      {
        tag: 'ppt_song_c1_v2_1',
        pitch: 'G4',
        midiNote: 67,
        scaleDegree: 'So',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c1',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 2,
        duration: '4',
      },
      // Coil 2 (monophonic: v1 only)
      {
        tag: 'ppt_song_c2_v1_1',
        pitch: 'D4',
        midiNote: 62,
        scaleDegree: 'Re',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c2',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
        duration: '2',
      },
    ];

    const ly = compileToLilyPond(onsets, { showMelodyCoilAbsolute: true });
    // In melodyVoice, Voice 2 receives skip s2 during coil 2
    expect(ly).toContain('s2');
    // In melodyCoilAbsoluteVoiceTwo, Voice 2 receives skip s2 during coil 2
    expect(ly).toContain('melodyCoilAbsoluteVoiceTwo = {\n  \\override NoteHead.stencil = #ly:text-interface::print\n  \\cadenzaOn\n  \\tag #\'ppt_song_c1_melodyAbs_v2_1');
  });

  it('generates exact number of bars in rhythmGridVoice without duplicating bars for polyphonic coils', () => {
    const onsets = [
      // Coil 1 (polyphonic: v1 + v2, 4 beats total)
      {
        tag: 'ppt_song_c1_v1_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c1',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
        durationBeats: 4.0,
      },
      {
        tag: 'ppt_song_c1_v2_1',
        pitch: 'G4',
        midiNote: 67,
        scaleDegree: 'So',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c1',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 2,
        durationBeats: 4.0,
      },
      // Coil 2 (monophonic: v1 only, 4 beats total)
      {
        tag: 'ppt_song_c2_v1_1',
        pitch: 'D4',
        midiNote: 62,
        scaleDegree: 'Re',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'c2',
        weaveId: 'song',
        onsetIndex: 1,
        voiceIndex: 1,
        durationBeats: 4.0,
      },
    ];

    const ly = compileToLilyPond(onsets, { showRhythmGrid: true });
    // rhythmGridVoice should contain exactly 2 bars (1 separator bar line + 1 final bar line)
    const gridMatch = ly.match(/rhythmGridVoice = \{([\s\S]*?)\}/);
    expect(gridMatch).not.toBeNull();
    const gridContent = gridMatch![1];
    const barCount = (gridContent.match(/\\bar/g) || []).length;
    expect(barCount).toBe(2); // Exactly 2 bars for 2 coils
  });
});

describe('rhythmTokenToCoilMarkup', () => {
  it('formats standard rhythm syllable without prefix', () => {
    const markup = rhythmTokenToCoilMarkup('Do');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) }');
  });

  it('formats Dox rhythm token as Do with axis line', () => {
    const markup = rhythmTokenToCoilMarkup('Dox');
    expect(markup).toBe('\\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #t) }');
  });

  it('formats compound sub-beat syllables (e.g. LeFi)', () => {
    const markup = rhythmTokenToCoilMarkup('LeFi');
    expect(markup).toContain('make-solfege-glyph');
    expect(markup).toContain('make-solfege-glyph-sub');
  });
});

describe('computeOnsetBeaming & LilyPond Beaming', () => {
  it('beams two eighth notes in the same beat with [ and ]', () => {
    const onsets: any[] = [
      { startBeat: 0.0, durationBeats: 0.5, isRest: false },
      { startBeat: 0.5, durationBeats: 0.5, isRest: false },
    ];
    const beamMap = computeOnsetBeaming(onsets);
    expect(beamMap.get(0)).toBe('[');
    expect(beamMap.get(1)).toBe(']');
  });

  it('beams four 16th notes across a single beat with [ on 0 and ] on 3', () => {
    const onsets: any[] = [
      { startBeat: 0.0, durationBeats: 0.25, isRest: false },
      { startBeat: 0.25, durationBeats: 0.25, isRest: false },
      { startBeat: 0.5, durationBeats: 0.25, isRest: false },
      { startBeat: 0.75, durationBeats: 0.25, isRest: false },
    ];
    const beamMap = computeOnsetBeaming(onsets);
    expect(beamMap.get(0)).toBe('[');
    expect(beamMap.get(1)).toBeUndefined();
    expect(beamMap.get(2)).toBeUndefined();
    expect(beamMap.get(3)).toBe(']');
  });

  it('does not beam isolated eighth notes or quarter notes', () => {
    const onsets: any[] = [
      { startBeat: 0.0, durationBeats: 0.5, isRest: false },
      { startBeat: 1.0, durationBeats: 1.0, isRest: false },
      { startBeat: 2.0, durationBeats: 0.5, isRest: false },
    ];
    const beamMap = computeOnsetBeaming(onsets);
    expect(beamMap.size).toBe(0);
  });

  it('does not beam through rests', () => {
    const onsets: any[] = [
      { startBeat: 0.0, durationBeats: 0.5, isRest: false },
      { startBeat: 0.5, durationBeats: 0.5, isRest: true },
    ];
    const beamMap = computeOnsetBeaming(onsets);
    expect(beamMap.size).toBe(0);
  });

  it('emits beam brackets in compiled LilyPond melody for eighth notes', () => {
    const onsets: any[] = [
      {
        tag: 'ppt_song_riff_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'riff',
        weaveId: 'song',
        onsetIndex: 1,
        startBeat: 0.0,
        durationBeats: 0.5,
        duration: '8',
      },
      {
        tag: 'ppt_song_riff_2',
        pitch: 'D4',
        midiNote: 62,
        scaleDegree: 'Re',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'riff',
        weaveId: 'song',
        onsetIndex: 2,
        startBeat: 0.5,
        durationBeats: 0.5,
        duration: '8',
      },
    ];
    const ly = compileToLilyPond(onsets);
    expect(ly).toContain("\\tag #'ppt_song_riff_melody_1 c'8[");
    expect(ly).toContain("\\tag #'ppt_song_riff_melody_2 d'8]");
  });

  it('supports traditionalRhythms: true (dotted notes, visible rests, open noteheads)', () => {
    const onsets: any[] = [
      {
        tag: 'ppt_song_motif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'motif',
        weaveId: 'song',
        onsetIndex: 1,
        startBeat: 0.0,
        durationBeats: 3.0, // 3 beats -> 2. in traditional
        duration: '4*3',
      },
      {
        tag: 'ppt_song_motif_2',
        pitch: 'D4',
        midiNote: 62,
        scaleDegree: 'Re',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'motif',
        weaveId: 'song',
        onsetIndex: 2,
        startBeat: 3.0,
        durationBeats: 1.0,
        isRest: true, // Rest -> r4 in traditional
        duration: '4',
      },
    ];

    const ly = compileToLilyPond(onsets, { traditionalRhythms: true });
    // Should NOT have duration-log = #2
    expect(ly).not.toContain('\\override NoteHead.duration-log = #2');
    // Should emit dotted half note 2.
    expect(ly).toContain("\\tag #'ppt_song_motif_melody_1 c'2.");
    // Should emit visible rest r4
    expect(ly).toContain("\\tag #'ppt_song_motif_melody_2 r4");
    // Harmony chord spanning 4 beats should be whole note <c' e' g'>1
    expect(ly).toContain("\\tag #'ppt_song_motif_harmonyStaff_1 <c' e' g'>1");
  });

  it('decouples ChordNames from harmonyVoicing so chord symbols remain canonical', () => {
    // Onsets with harmonyVoicing: 'rootless' (only 3rd and 5th [64, 67] in chordMidi)
    const onsets: any[] = [
      {
        tag: 'ppt_song_motif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['E4', 'G4'],
        chordMidi: [64, 67], // Rootless voicing on staff
        chordRoot: 'Do',      // Canonical C major chord
        coilId: 'motif',
        weaveId: 'song',
        onsetIndex: 1,
        startBeat: 0.0,
        durationBeats: 2.0,
        duration: '2',
      },
    ];

    const ly = compileToLilyPond(onsets, { doPitch: 'C4' });
    // Harmony staff should show the voiced noteheads <e' g'>
    expect(ly).toContain("\\tag #'ppt_song_motif_harmonyStaff_1 <e' g'>2");
    // ChordNames should show the canonical full C chord <c' e' g'>
    expect(ly).toContain("\\tag #'ppt_song_motif_chordName_1 <c' e' g'>2");
  });

  it('engraves slash chords and inversions in ChordNames with explicit slash bass', () => {
    const onsets: any[] = [
      {
        tag: 'ppt_song_motif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['G3', 'C4', 'E4'],
        chordMidi: [55, 60, 64],
        chordRoot: 'SoxDo', // C/G
        coilId: 'motif',
        weaveId: 'song',
        onsetIndex: 1,
        startBeat: 0.0,
        durationBeats: 2.0,
        duration: '2',
      },
      {
        tag: 'ppt_song_motif_2',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['E4', 'G4', 'C5'],
        chordMidi: [64, 67, 72],
        chordRoot: 'MiexDo', // C/E
        coilId: 'motif',
        weaveId: 'song',
        onsetIndex: 2,
        startBeat: 2.0,
        durationBeats: 2.0,
        duration: '2',
      },
    ];

    const ly = compileToLilyPond(onsets, { doPitch: 'C4' });
    // ChordNames should emit <c' e' g'>/g and <c' e' g'>/e
    expect(ly).toContain("\\tag #'ppt_song_motif_chordName_1 <c' e' g'>/g2");
    expect(ly).toContain("\\tag #'ppt_song_motif_chordName_2 <c' e' g'>/e2");
  });

  const metricOnsets: OnsetStream = [
    {
      tag: 'ppt_song_motif_1',
      pitch: 'C4',
      midiNote: 60,
      scaleDegree: 'Do',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'motif',
      weaveId: 'song',
      onsetIndex: 1,
      startBeat: 0.0,
      durationBeats: 2.0,
      duration: '2',
    },
    {
      tag: 'ppt_song_motif_2',
      pitch: 'G4',
      midiNote: 67,
      scaleDegree: 'So',
      chordTones: ['G4', 'B4', 'D5'],
      chordMidi: [67, 71, 74],
      chordRoot: 'So',
      coilId: 'motif',
      weaveId: 'song',
      onsetIndex: 2,
      startBeat: 2.0,
      durationBeats: 2.0,
      duration: '2',
    },
  ];

  it('emits pulseCoilVoice with P clef when showPulseCoil is true', () => {
    const ly = compileToLilyPond(metricOnsets, { showPulseCoil: true, meter: 'DoLa' });
    expect(ly).toContain('pulseCoilVoice = {');
    expect(ly).toContain('#pptClefPStencil');
    expect(ly).toContain("\\tag #'ppt_song_motif_pulse_1");
  });

  it('renders pulse signature as SVG glyphs on a separate line below key anchor in header', () => {
    const ly = compileToLilyPond(metricOnsets, {
      doPitch: 'C4',
      showPulseSignature: true,
      pulseSignature: 'DoLa',
    });
    // New format: column with key anchor body and pulse glyph body (no nested \markup inside column)
    expect(ly).toContain('poet = \\markup \\column {');
    expect(ly).toContain('\\line \\vcenter { \\stencil #pptGlyphDoOutlined \\fontsize #1.5 \\bold " = C" }');
    // Pulse row uses P: label and glyph stencils
    expect(ly).toContain('"P:"');
    expect(ly).toContain('make-solfege-glyph');
    // Should NOT use plain bold text for pulse
    expect(ly).not.toContain('\\bold "DoLa"');
  });

  it('renders time signature on traditional notation staves when showTimeSignature is true', () => {
    const ly = compileToLilyPond(metricOnsets, {
      doPitch: 'C4',
      showTimeSignature: true,
      timeSignature: '4/4',
    });
    expect(ly).toContain('\\time 4/4');
    expect(ly).not.toContain('\\remove "Time_signature_engraver"');
  });

  it('annotates rhythm grid lines with notehead shapes and respects excludeGridDoSymbol', () => {
    // When no coils are shown (numCoils === 0), gridSymbols renders as a dedicated compact staff
    const lyExcluded = compileToLilyPond(metricOnsets, {
      showRhythmGrid: true,
      gridSymbols: true,
      excludeGridDoSymbol: true,
      strongBeatGridWeight: true,
      meter: 'DoLa',
    });
    expect(lyExcluded).toContain('rhythmGridVoice = {');
    expect(lyExcluded).toContain('gridSymbolsVoice = {');
    expect(lyExcluded).toContain('\\new Staff \\with {');
    expect(lyExcluded).toContain('\\override StaffSymbol.stencil = ##f');
    expect(lyExcluded).not.toContain('\\markup { \\stencil #gridSymbolDo }');
    expect(lyExcluded).toContain('\\override GridLine.thickness = #0.8');
    expect(lyExcluded).toContain('\\override GridLine.color = #(x11-color \'gray65)');
    expect(lyExcluded).toContain('make-strong-grid-point-stencil');

    // When excludeGridDoSymbol is false, Do onsets get gridSymbolDo markup
    const lyWithSymbols = compileToLilyPond(metricOnsets, {
      showRhythmGrid: true,
      gridSymbols: true,
      excludeGridDoSymbol: false,
      meter: 'DoLa',
    });
    expect(lyWithSymbols).toContain('\\markup { \\stencil #gridSymbolDo }');

    // When coils are shown, grid symbols frame the top and bottom of the coil stack
    const lyWithCoils = compileToLilyPond(metricOnsets, {
      showRhythmCoil: true,
      showRhythmGrid: true,
      gridSymbols: true,
      excludeGridDoSymbol: true,
    });
    expect(lyWithCoils).toContain('gridSymbolsTopVoice = {');
    expect(lyWithCoils).toContain('gridSymbolsBottomVoice = {');
  });

  it('engraves guitar tablature staff with PPT shaped fret noteheads below harmony staff', () => {
    const ly = compileToLilyPond(metricOnsets, {
      showGuitarTab: true,
      noteheadStyle: 'ppt',
      colorNotes: true,
    });

    // Contains tabVoice definition
    expect(ly).toContain('tabVoice = {');
    expect(ly).toContain('\\new TabStaff \\with {');
    expect(ly).toContain('stringTunings = #guitar-tuning');

    // Tab noteheads are tweaked with PPT tab stencils and colors
    expect(ly).toContain('\\tweak TabNoteHead.stencil #tabStencilDo');
    expect(ly).toContain('\\tweak color #colorDo');
    expect(ly).toContain('\\tweak TabNoteHead.stencil #tabStencilSo');
    expect(ly).toContain('\\tweak color #colorSo');

    // Provenance tagging
    expect(ly).toContain("\\tag #'ppt_song_motif_tab_1");
    expect(ly).toContain("\\tag #'ppt_song_motif_tab_2");

    // TabStaff placed below harmony staff in PianoStaff
    const harmIndex = ly.indexOf('\\new Staff \\harmonyVoice');
    const tabIndex = ly.indexOf('\\new TabStaff');
    expect(harmIndex).toBeGreaterThan(0);
    expect(tabIndex).toBeGreaterThan(harmIndex);
  });

  it('supports guitar voicings and maximum fret span constraints', () => {
    const lyRoot = compileToLilyPond(metricOnsets, {
      showGuitarTab: true,
      guitarVoicing: 'root',
      maximumFretSpan: 3,
      noteheadStyle: 'ppt',
    });

    expect(lyRoot).toContain('tabVoice = {');
    // For C4 (Do) over Do (C major), root voicing generates a multi-note grip with string numbers
    expect(lyRoot).toMatch(/<.*\\tweak TabNoteHead\.stencil.*>/);
  });
});






