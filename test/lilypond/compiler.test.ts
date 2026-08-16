import { describe, it, expect } from 'vitest';
import { compileToLilyPond } from '../../src/lilypond/compiler.js';
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
    expect(ly).toContain('melodyVoice = {');
    expect(ly).toContain('harmonyVoice = {');
    expect(ly).toContain('\\new PianoStaff <<');
    expect(ly).toContain('\\remove "Time_signature_engraver"');
  });

  it('emits explicit clefs and accidentalStyle forget on voices', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('melodyVoice = {\n  \\clef treble\n  \\accidentalStyle forget\n  \\cadenzaOn');
    expect(ly).toContain('harmonyVoice = {\n  \\clef treble\n  \\accidentalStyle forget\n  \\cadenzaOn');
  });

  it('allows custom clef for harmonyVoice', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyClef: 'bass' });
    expect(ly).toContain('harmonyVoice = {\n  \\clef bass\n  \\accidentalStyle forget\n  \\cadenzaOn');
  });


  it('emits cadenzaOn and cadenzaOff in voices', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\cadenzaOn');
    expect(ly).toContain('\\cadenzaOff');
  });

  it('emits tags with native LilyPond tag syntax', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 b'4");
  });

  it('emits harmony chords in treble register by default (octave 0)', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c' e' g'>4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g' b' d''>4");
  });

  it('emits harmony chords in bass register when bass clef selected', () => {
    const ly = compileToLilyPond(sampleOnsets, { harmonyClef: 'bass' });
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c e g>4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g b d'>4");
  });


  it('emits coil boundary barline between coils', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\bar "|"');
  });

  it('emits ChordNames reading directly from harmonyVoice with chordChanges enabled by default', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\new ChordNames {\n      \\set chordChanges = ##t\n      \\harmonyVoice\n    }');
    expect(ly).not.toContain('chordVoice'); // No duplication!
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

  it('engraves sacredHarp shape noteheads aligned with Do anchor', () => {
    const ly = compileToLilyPond(sampleOnsets, {
      noteheadStyle: 'sacredHarp',
      doPitch: 'Eb4',
      omitStem: true,
    });
    expect(ly).toContain('\\key ees \\major');
    expect(ly).toContain('\\omit Staff.KeySignature');
    expect(ly).toContain('\\sacredHarpHeads');
    expect(ly).toContain('\\omit Stem');
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

  it('engraves PPT Solfège colors on melody noteheads when colorNotes is true', () => {
    const ly = compileToLilyPond(sampleOnsets, { colorNotes: true });
    expect(ly).toContain('#(define colorDo');
    expect(ly).toContain('#(define colorMi');
    expect(ly).toContain('#(define colorTi');
    expect(ly).toContain('#(define (color-notehead-with-outline grob)');
    expect(ly).toContain('\\override NoteHead.stencil = #color-notehead-with-outline');
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 \\tweak color #colorDo c'4");
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_2 \\tweak color #colorMi e'4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 \\tweak color #colorTi b'4");
  });

  it('allows disabling noteheadOutline when colorNotes is true', () => {
    const ly = compileToLilyPond(sampleOnsets, { colorNotes: true, noteheadOutline: false });
    expect(ly).not.toContain('\\override NoteHead.stencil = #color-notehead-with-outline');
  });
});





