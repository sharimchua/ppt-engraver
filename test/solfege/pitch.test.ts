import { describe, it, expect } from 'vitest';
import {
  solfegeToSemitone,
  solfegeToNearestAddress,
  parsePitch,
  pitchNameToMidi,
  midiToPitchName,
  resolveAbsolutePitch,
  resolveInterval,
  buildMajorTriad,
} from '../../src/solfege/pitch.js';

describe('solfegeToSemitone', () => {
  it('maps all 12 primary syllables correctly', () => {
    expect(solfegeToSemitone('Do')).toBe(0);
    expect(solfegeToSemitone('Ra')).toBe(1);
    expect(solfegeToSemitone('Re')).toBe(2);
    expect(solfegeToSemitone('Me')).toBe(3);
    expect(solfegeToSemitone('Mi')).toBe(4);
    expect(solfegeToSemitone('Fa')).toBe(5);
    expect(solfegeToSemitone('Fi')).toBe(6);
    expect(solfegeToSemitone('So')).toBe(7);
    expect(solfegeToSemitone('Le')).toBe(8);
    expect(solfegeToSemitone('La')).toBe(9);
    expect(solfegeToSemitone('Te')).toBe(10);
    expect(solfegeToSemitone('Ti')).toBe(11);
  });

  it('maps variation syllables correctly', () => {
    expect(solfegeToSemitone('Di')).toBe(1);  // = Ra
    expect(solfegeToSemitone('Ri')).toBe(3);  // = Me
    expect(solfegeToSemitone('Se')).toBe(6);  // = Fi
    expect(solfegeToSemitone('Si')).toBe(8);  // = Le
    expect(solfegeToSemitone('Li')).toBe(10); // = Te
  });

  it('throws for unknown syllable', () => {
    expect(() => solfegeToSemitone('Xyz')).toThrow('Unknown solfège syllable');
  });
});

describe('solfegeToNearestAddress', () => {
  it('maps ascending side (0 to +6)', () => {
    expect(solfegeToNearestAddress('Do')).toBe(0);
    expect(solfegeToNearestAddress('Ra')).toBe(1);
    expect(solfegeToNearestAddress('Re')).toBe(2);
    expect(solfegeToNearestAddress('Me')).toBe(3);
    expect(solfegeToNearestAddress('Mi')).toBe(4);
    expect(solfegeToNearestAddress('Fa')).toBe(5);
    expect(solfegeToNearestAddress('Fi')).toBe(6);
  });

  it('maps descending side (-5 to -1)', () => {
    expect(solfegeToNearestAddress('So')).toBe(-5);
    expect(solfegeToNearestAddress('Le')).toBe(-4);
    expect(solfegeToNearestAddress('La')).toBe(-3);
    expect(solfegeToNearestAddress('Te')).toBe(-2);
    expect(solfegeToNearestAddress('Ti')).toBe(-1);
  });
});

describe('parsePitch', () => {
  it('parses plain syllable', () => {
    expect(parsePitch('Do')).toEqual({ syllable: 'Do', octaveShift: 0, hasAxis: false });
    expect(parsePitch('Mi')).toEqual({ syllable: 'Mi', octaveShift: 0, hasAxis: false });
  });

  it('parses octave up', () => {
    expect(parsePitch('Do^')).toEqual({ syllable: 'Do', octaveShift: 1, hasAxis: false });
    expect(parsePitch('Do^^')).toEqual({ syllable: 'Do', octaveShift: 2, hasAxis: false });
  });

  it('parses octave down', () => {
    expect(parsePitch('So_')).toEqual({ syllable: 'So', octaveShift: -1, hasAxis: false });
  });

  it('parses axis marker', () => {
    expect(parsePitch('Dox')).toEqual({ syllable: 'Do', octaveShift: 0, hasAxis: true });
    expect(parsePitch('Fax')).toEqual({ syllable: 'Fa', octaveShift: 0, hasAxis: true });
  });

  it('parses axis marker with octave shift', () => {
    expect(parsePitch('Dox^')).toEqual({ syllable: 'Do', octaveShift: 1, hasAxis: true });
  });

  it('throws for invalid syllable', () => {
    expect(() => parsePitch('Xyz')).toThrow('Invalid solfège syllable');
  });
});

describe('pitchNameToMidi / midiToPitchName', () => {
  it('converts C4 to MIDI 60', () => {
    expect(pitchNameToMidi('C4')).toBe(60);
  });

  it('converts MIDI 60 to C4', () => {
    expect(midiToPitchName(60)).toBe('C4');
  });

  it('handles flats (b and ♭)', () => {
    expect(pitchNameToMidi('Eb4')).toBe(63);
    expect(pitchNameToMidi('E♭4')).toBe(63);
    expect(pitchNameToMidi('Bb3')).toBe(58);
    expect(pitchNameToMidi('Db5')).toBe(73);
    expect(pitchNameToMidi('Ab4')).toBe(68);
  });


  it('roundtrips all notes in octave 4', () => {
    for (let midi = 60; midi < 72; midi++) {
      expect(pitchNameToMidi(midiToPitchName(midi))).toBe(midi);
    }
  });

  it('throws for invalid pitch name', () => {
    expect(() => pitchNameToMidi('X9')).toThrow('Invalid pitch name');
  });
});

describe('resolveAbsolutePitch', () => {
  const doC4 = 60; // C4

  it('resolves Do to C4', () => {
    expect(resolveAbsolutePitch('Do', 0, doC4)).toBe(60);
  });

  it('resolves Mi to E4 (+4 semitones from Do)', () => {
    expect(resolveAbsolutePitch('Mi', 0, doC4)).toBe(64);
  });

  it('resolves So to G3 (-5 semitones from Do)', () => {
    expect(resolveAbsolutePitch('So', 0, doC4)).toBe(55);
  });

  it('resolves So^ to G4 (+7 semitones from Do with octave mark)', () => {
    expect(resolveAbsolutePitch('So', 1, doC4)).toBe(67);
  });

  it('resolves Te to Bb3 (-2 semitones from Do)', () => {
    expect(resolveAbsolutePitch('Te', 0, doC4)).toBe(58);
  });

  it('resolves Ti to B3 (-1 semitone from Do)', () => {
    expect(resolveAbsolutePitch('Ti', 0, doC4)).toBe(59);
  });

  it('resolves Ti^ to B4 (+11 semitones from Do with octave mark)', () => {
    expect(resolveAbsolutePitch('Ti', 1, doC4)).toBe(71);
  });

  it('resolves Do^ to C5', () => {
    expect(resolveAbsolutePitch('Do', 1, doC4)).toBe(72);
  });
});


describe('resolveInterval', () => {
  it('ascending intervals', () => {
    expect(resolveInterval('Ra', 0)).toBe(1);   // +1 semitone
    expect(resolveInterval('Re', 0)).toBe(2);   // +2
    expect(resolveInterval('Mi', 0)).toBe(4);   // +4
    expect(resolveInterval('Fa', 0)).toBe(5);   // +5
    expect(resolveInterval('Fi', 0)).toBe(6);   // +6 (tritone)
  });

  it('descending intervals', () => {
    expect(resolveInterval('Ti', 0)).toBe(-1);  // -1 semitone
    expect(resolveInterval('Te', 0)).toBe(-2);  // -2
    expect(resolveInterval('La', 0)).toBe(-3);  // -3
    expect(resolveInterval('So', 0)).toBe(-5);  // -5
  });

  it('ascending beyond tritone with octave mark', () => {
    // So^ = -5 + 12 = +7 (ascending perfect fifth)
    expect(resolveInterval('So', 1)).toBe(7);
  });

  it('descending beyond tritone with octave mark', () => {
    // Fa_ = +5 - 12 = -7 (descending perfect fifth)
    expect(resolveInterval('Fa', -1)).toBe(-7);
  });
});

describe('buildMajorTriad', () => {
  it('builds C major triad from C4', () => {
    expect(buildMajorTriad(60)).toEqual([60, 64, 67]); // C4, E4, G4
  });

  it('builds G major triad from G4', () => {
    expect(buildMajorTriad(67)).toEqual([67, 71, 74]); // G4, B4, D5
  });
});
