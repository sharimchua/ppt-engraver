import { describe, it, expect } from 'vitest';
import {
  midiToLilyPondPitch,
  chordMidiToLilyPond,
  chordToLilyPondChordMode,
  canonicalChordToLilyPond,
} from '../../src/lilypond/pitch.js';

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

  it('formats Db minor triad (e.g. TeMe in Eb) with proper tertian spelling (fes instead of e)', () => {
    // Db4 minor triad [61, 64, 68] -> <des' fes' aes'>
    expect(chordMidiToLilyPond([61, 64, 68], 0, 'flats')).toBe("<des' fes' aes'>");
  });

  it('formats Ab minor triad with proper tertian spelling (ces instead of b)', () => {
    // Ab4 minor triad [68, 71, 75] -> <aes' ces'' ees''>
    expect(chordMidiToLilyPond([68, 71, 75], 0, 'flats')).toBe("<aes' ces'' ees''>");
  });

  it('formats Eb minor triad with proper tertian spelling (ges instead of f#)', () => {
    // Eb4 minor triad [63, 66, 70] -> <ees' ges' bes'>
    expect(chordMidiToLilyPond([63, 66, 70], 0, 'flats')).toBe("<ees' ges' bes'>");
  });

  it('formats Bb minor triad with flat spelling', () => {
    // Bb4 minor triad [70, 73, 77] -> <bes' des'' f''>
    expect(chordMidiToLilyPond([70, 73, 77], 0, 'flats')).toBe("<bes' des'' f''>");
  });
});

describe('chordToLilyPondChordMode', () => {
  it('formats standard chords without slash bass', () => {
    expect(chordToLilyPondChordMode(60, 'major', '4', 'sharps')).toBe('c4');
    expect(chordToLilyPondChordMode(60, 'minor', '4', 'sharps')).toBe('c4:m');
    expect(chordToLilyPondChordMode(67, 'dominant7', '4', 'sharps')).toBe('g4:7');
  });

  it('formats slash chords and inversions when bass note is specified', () => {
    // C/G (C major over G bass)
    expect(chordToLilyPondChordMode(60, 'major', '4', 'sharps', 55)).toBe('c4/g');

    // C/E (C major over E bass / 1st inversion)
    expect(chordToLilyPondChordMode(60, 'major', '4', 'sharps', 52)).toBe('c4/e');

    // Cm/Eb (C minor over Eb bass / 1st inversion)
    expect(chordToLilyPondChordMode(60, 'minor', '4', 'flats', 51)).toBe('c4:m/ees');

    // G/D (G major over D bass)
    expect(chordToLilyPondChordMode(67, 'major', '4', 'sharps', 62)).toBe('g4/d');

    // Root position bass note matches root -> no redundant slash
    expect(chordToLilyPondChordMode(60, 'major', '4', 'sharps', 48)).toBe('c4');
  });
});

describe('canonicalChordToLilyPond', () => {
  it('formats root-position triads and 7ths directly from Solfege tokens', () => {
    // When Do is C (60)
    expect(canonicalChordToLilyPond('Do', 60)).toBe("<c' e' g'>");
    expect(canonicalChordToLilyPond('DoMe', 60, 'flats')).toBe("<c' ees' g'>");
    expect(canonicalChordToLilyPond('So', 60)).toBe("<g' b' d''>");
    expect(canonicalChordToLilyPond('SoTe', 60)).toBe("<g' b' d'' f''>");
    expect(canonicalChordToLilyPond('DoTi', 60)).toBe("<c' e' g' b'>");
  });

  it('formats diminished 7th chords correctly (e.g. TiMeFiLa when Do is F4)', () => {
    // When Do is F4 (65): Ti is E4. E dim7 -> <e' g' bes' des''>
    expect(canonicalChordToLilyPond('TiMeFiLa', 65, 'flats')).toBe("<e' g' bes' des''>");

    // DoMeFiLa when Do is C4 -> <c' ees' ges' a'>
    expect(canonicalChordToLilyPond('DoMeFiLa', 60, 'flats')).toBe("<c' ees' ges' a'>");
  });

  it('formats half-diminished, sus, and 6th chords', () => {
    // Half-diminished: DoMeFiTe -> <c' ees' ges' bes'>
    expect(canonicalChordToLilyPond('DoMeFiTe', 60, 'flats')).toBe("<c' ees' ges' bes'>");

    // Sus4: DoFa -> <c' f' g'>
    expect(canonicalChordToLilyPond('DoFa', 60)).toBe("<c' f' g'>");

    // Sus2: DoRe -> <c' d' g'>
    expect(canonicalChordToLilyPond('DoRe', 60)).toBe("<c' d' g'>");

    // Major 6th: DoLa -> <c' e' g' a'>
    expect(canonicalChordToLilyPond('DoLa', 60)).toBe("<c' e' g' a'>");
  });

  it('formats slash chords and inversions with explicit slash bass', () => {
    // SoxDo (C/G) -> <c' e' g'>/g
    expect(canonicalChordToLilyPond('SoxDo', 60)).toBe("<c' e' g'>/g");

    // MiexDo (C/E) -> <c' e' g'>/e
    expect(canonicalChordToLilyPond('MiexDo', 60)).toBe("<c' e' g'>/e");

    // MexDoMe (Cm/Eb) -> <c' ees' g'>/ees
    expect(canonicalChordToLilyPond('MexDoMe', 60, 'flats')).toBe("<c' ees' g'>/ees");
  });
});

