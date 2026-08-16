import { describe, it, expect } from 'vitest';
import { midiToLilyPondPitch, chordMidiToLilyPond } from '../../src/lilypond/pitch.js';

describe('midiToLilyPondPitch', () => {
  it('formats Middle C (C4, MIDI 60) as c\'', () => {
    expect(midiToLilyPondPitch(60)).toBe("c'");
  });

  it('formats C3 (MIDI 48) as c', () => {
    expect(midiToLilyPondPitch(48)).toBe('c');
  });

  it('formats C2 (MIDI 36) as c,', () => {
    expect(midiToLilyPondPitch(36)).toBe('c,');
  });

  it('formats C5 (MIDI 72) as c\'\'', () => {
    expect(midiToLilyPondPitch(72)).toBe("c''");
  });

  it('formats notes in the §6.2 worked example correctly', () => {
    // Melody notes
    expect(midiToLilyPondPitch(60)).toBe("c'");  // C4
    expect(midiToLilyPondPitch(64)).toBe("e'");  // E4
    expect(midiToLilyPondPitch(67)).toBe("g'");  // G4
    expect(midiToLilyPondPitch(72)).toBe("c''"); // C5
    expect(midiToLilyPondPitch(71)).toBe("b'");  // B4

    // Harmony notes (in octave 3 register)
    expect(midiToLilyPondPitch(48)).toBe('c');   // C3
    expect(midiToLilyPondPitch(52)).toBe('e');   // E3
    expect(midiToLilyPondPitch(55)).toBe('g');   // G3
    expect(midiToLilyPondPitch(59)).toBe('b');   // B3
    expect(midiToLilyPondPitch(62)).toBe("d'");  // D4
  });

  it('formats accidentals using Dutch names (is for sharp)', () => {
    expect(midiToLilyPondPitch(54)).toBe('fis');  // F#3
    expect(midiToLilyPondPitch(61)).toBe("cis'"); // C#4
    expect(midiToLilyPondPitch(63)).toBe("dis'"); // D#4
    expect(midiToLilyPondPitch(66)).toBe("fis'"); // F#4
    expect(midiToLilyPondPitch(68)).toBe("gis'"); // G#4
    expect(midiToLilyPondPitch(70)).toBe("ais'"); // A#4
  });

  it('formats accidentals using Dutch flat names (es/ees for flat) when accidentalMode is flats', () => {
    expect(midiToLilyPondPitch(61, 'flats')).toBe("des'"); // Db4
    expect(midiToLilyPondPitch(63, 'flats')).toBe("ees'"); // Eb4
    expect(midiToLilyPondPitch(66, 'flats')).toBe("ges'"); // Gb4
    expect(midiToLilyPondPitch(68, 'flats')).toBe("aes'"); // Ab4
    expect(midiToLilyPondPitch(70, 'flats')).toBe("bes'"); // Bb4
  });
});

describe('chordMidiToLilyPond', () => {
  it('formats C major triad shifted down by 1 octave to bass register', () => {
    // C4 triad [60, 64, 67] shifted -1 octave -> [48, 52, 55] -> <c e g>
    expect(chordMidiToLilyPond([60, 64, 67], -1)).toBe('<c e g>');
  });

  it('formats G major triad shifted down by 1 octave to bass register', () => {
    // G4 triad [67, 71, 74] shifted -1 octave -> [55, 59, 62] -> <g b d'>
    expect(chordMidiToLilyPond([67, 71, 74], -1)).toBe("<g b d'>");
  });

  it('formats Eb major triad with flat spelling', () => {
    // Eb4 triad [63, 67, 70] -> <ees' g' bes'>
    expect(chordMidiToLilyPond([63, 67, 70], 0, 'flats')).toBe("<ees' g' bes'>");
  });
});

