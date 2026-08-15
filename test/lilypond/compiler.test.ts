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

  it('emits harmony chords in lower staff register', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain("\\tag #'ppt_verse_introMotif_1 <c e g>4");
    expect(ly).toContain("\\tag #'ppt_verse_cadence_1 <g b d'>4");
  });

  it('emits coil boundary barline between coils', () => {
    const ly = compileToLilyPond(sampleOnsets);
    expect(ly).toContain('\\bar "|"');
  });
});
