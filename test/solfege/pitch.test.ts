import { describe, it, expect } from 'vitest';
import {
  solfegeToSemitone,
  solfegeToNearestAddress,
  fitRootToClefRegister,
  parsePitch,
  pitchNameToMidi,
  midiToPitchName,
  resolveAbsolutePitch,
  resolveInterval,
  buildMajorTriad,
  parseHarmonyChord,
  buildChordFromToken,
  getSolfegeGlyphSpec,
  semitoneIntervalToSolfege,
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

describe('fitRootToClefRegister', () => {
  it('fits roots into treble staff register (A3..G5)', () => {
    // When Do = A4 (69)
    expect(fitRootToClefRegister(69, 'treble')).toBe(69); // Do = A4
    expect(fitRootToClefRegister(69 + 5, 'treble')).toBe(62); // Fa = D4 (shifted down from D5)
    expect(fitRootToClefRegister(69 + 7, 'treble')).toBe(64); // So = E4 (shifted down from E5)
    expect(fitRootToClefRegister(69 + 8, 'treble')).toBe(65); // Le = F4 (shifted down from F5)
    expect(fitRootToClefRegister(69 + 10, 'treble')).toBe(67); // Te = G4 (shifted down from G5)

    // When Do = C4 (60)
    expect(fitRootToClefRegister(60, 'treble')).toBe(60); // Do = C4
    expect(fitRootToClefRegister(60 + 5, 'treble')).toBe(65); // Fa = F4
    expect(fitRootToClefRegister(60 + 7, 'treble')).toBe(67); // So = G4
    expect(fitRootToClefRegister(60 + 9, 'treble')).toBe(69); // La = A4

    // When Do = Eb4 (63)
    expect(fitRootToClefRegister(63, 'treble')).toBe(63); // Do = Eb4
    expect(fitRootToClefRegister(63 + 5, 'treble')).toBe(68); // Fa = Ab4
    expect(fitRootToClefRegister(63 + 7, 'treble')).toBe(70); // So = Bb4
  });

  it('fits roots into bass staff register (C2..C4)', () => {
    expect(fitRootToClefRegister(60, 'bass')).toBe(48); // C4 -> C3 (48)
    expect(fitRootToClefRegister(69, 'bass')).toBe(45); // A4 -> A2 (45)
  });

  it('fits roots into octave-transposed clef registers (bass_8, bass_15, treble_8)', () => {
    expect(fitRootToClefRegister(60, 'bass_8')).toBe(36); // C4 -> C2 (36)
    expect(fitRootToClefRegister(60, 'bass_15')).toBe(24); // C4 -> C1 (24)
    expect(fitRootToClefRegister(72, 'treble_8')).toBe(60); // C5 -> C4 (60)
    expect(fitRootToClefRegister(60, 'treble_8')).toBe(60); // C4 (60) stays within treble_8 register (45..67)
  });
});



describe('buildChordFromToken & parseHarmonyChord', () => {
  it('parses chord qualities', () => {
    expect(parseHarmonyChord('Do')).toMatchObject({ rootSyllable: 'Do', quality: 'major', octaveShift: 0 });
    expect(parseHarmonyChord('FaMe')).toMatchObject({ rootSyllable: 'Fa', quality: 'minor', octaveShift: 0 });
    expect(parseHarmonyChord('DoMe')).toMatchObject({ rootSyllable: 'Do', quality: 'minor', octaveShift: 0 });
    expect(parseHarmonyChord('SoTe')).toMatchObject({ rootSyllable: 'So', quality: 'dominant7', octaveShift: 0 });
    expect(parseHarmonyChord('So^')).toMatchObject({ rootSyllable: 'So', quality: 'major', octaveShift: 1 });
    expect(parseHarmonyChord('Fa_')).toMatchObject({ rootSyllable: 'Fa', quality: 'major', octaveShift: -1 });
  });

  it('builds FaMe minor triad (D-F-A) with Do as A4', () => {
    const doA4 = 69; // A4
    const rawRoot = doA4 + solfegeToSemitone('Fa'); // 69 + 5 = 74 (D5)
    const fittedRoot = fitRootToClefRegister(rawRoot, 'treble'); // fitted to D4 (62)
    const chord = buildChordFromToken(fittedRoot, 'FaMe');
    // D4 (62), F4 (65), A4 (69) -> D minor
    expect(chord).toEqual([62, 65, 69]);
  });

  it('builds Fa major triad (D-F#-A) with Do as A4', () => {
    const doA4 = 69; // A4
    const rawRoot = doA4 + solfegeToSemitone('Fa'); // 69 + 5 = 74 (D5)
    const fittedRoot = fitRootToClefRegister(rawRoot, 'treble'); // fitted to D4 (62)
    const chord = buildChordFromToken(fittedRoot, 'Fa');
    // D4 (62), F#4 (66), A4 (69) -> D major
    expect(chord).toEqual([62, 66, 69]);
  });

  it('parses harmony chords with axis diacritic (x) on root and modifiers', () => {
    expect(parseHarmonyChord('Dox')).toEqual({
      rootSyllable: 'Do',
      hasAxis: true,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });

    expect(parseHarmonyChord('DoMe')).toEqual({
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [{ syllable: 'Me', hasAxis: false }],
      octaveShift: 0,
      quality: 'minor',
    });

    expect(parseHarmonyChord('DoxMe')).toEqual({
      rootSyllable: 'Do',
      hasAxis: true,
      modifiers: [{ syllable: 'Me', hasAxis: false }],
      octaveShift: 0,
      quality: 'minor',
    });

    expect(parseHarmonyChord('DoMex')).toEqual({
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [{ syllable: 'Me', hasAxis: true }],
      octaveShift: 0,
      quality: 'minor',
    });

    expect(parseHarmonyChord('DoxMex')).toEqual({
      rootSyllable: 'Do',
      hasAxis: true,
      modifiers: [{ syllable: 'Me', hasAxis: true }],
      octaveShift: 0,
      quality: 'minor',
    });

    expect(parseHarmonyChord('DoMeTe')).toEqual({
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [
        { syllable: 'Me', hasAxis: false },
        { syllable: 'Te', hasAxis: false },
      ],
      octaveShift: 0,
      quality: 'minor7',
    });

    // Axis Bass prefix tests (slash chords / inversions)
    expect(parseHarmonyChord('SoxDo')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'So',
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });

    expect(parseHarmonyChord('MiexDo')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'Mi',
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });

    expect(parseHarmonyChord('MexDoMe')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'Me',
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [{ syllable: 'Me', hasAxis: false }],
      octaveShift: 0,
      quality: 'minor',
    });

    expect(parseHarmonyChord('RexSo')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'Re',
      rootSyllable: 'So',
      hasAxis: false,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });

    expect(parseHarmonyChord('DoxDo')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'Do',
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });

    expect(parseHarmonyChord('So_xDo')).toEqual({
      hasAxisBass: true,
      bassSyllable: 'So',
      bassOctaveShift: -1,
      rootSyllable: 'Do',
      hasAxis: false,
      modifiers: [],
      octaveShift: 0,
      quality: 'major',
    });
  });

  it('builds chord inversions by revoicing chord tones starting from the bass', () => {
    // DoxFa: F major (65, 69, 72) in 2nd inversion with C4 bass -> [60, 65, 69] (C-F-A)
    const chordDoxFa = buildChordFromToken(65, 'DoxFa', 60);
    expect(chordDoxFa).toEqual([60, 65, 69]);

    // MiexDo: C major (60, 64, 67) in 1st inversion with E4 bass -> [64, 67, 72] (E-G-C)
    const chordMiexDo = buildChordFromToken(60, 'MiexDo', 60);
    expect(chordMiexDo).toEqual([64, 67, 72]);

    // SoxDo: C major (60, 64, 67) in 2nd inversion with G3 bass -> [55, 60, 64] (G-C-E)
    const chordSoxDo = buildChordFromToken(60, 'SoxDo', 60);
    expect(chordSoxDo).toEqual([55, 60, 64]);

    // MexDoMe: C minor (60, 63, 67) in 1st inversion with Eb4 bass -> [63, 67, 72] (Eb-G-C)
    const chordMexDoMe = buildChordFromToken(60, 'MexDoMe', 60);
    expect(chordMexDoMe).toEqual([63, 67, 72]);

    // TexDo: C major (60, 64, 67) with non-chord Bb3 bass -> [58, 60, 64, 67] (Bb-C-E-G)
    const chordTexDo = buildChordFromToken(60, 'TexDo', 60);
    expect(chordTexDo).toEqual([58, 60, 64, 67]);
  });

  it('correctly parses and builds fully diminished 7th chords (e.g. TeMeFiLa, TiMeFiLa, DoMeFiLa)', () => {
    // TeMeFiLa (root Te, modifiers Me, Fi, La)
    const parsedTe = parseHarmonyChord('TeMeFiLa');
    expect(parsedTe.quality).toBe('diminished7');
    expect(parsedTe.rootSyllable).toBe('Te');

    // TiMeFiLa (root Ti, modifiers Me, Fi, La)
    const parsedTi = parseHarmonyChord('TiMeFiLa');
    expect(parsedTi.quality).toBe('diminished7');
    expect(parsedTi.rootSyllable).toBe('Ti');

    // When Do is F4 (65): Ti is E4 (76 / 64). E dim7 -> [64, 67, 70, 73] (E-G-Bb-Db)
    const eDim7 = buildChordFromToken(64, 'TiMeFiLa', 65);
    expect(eDim7).toEqual([64, 67, 70, 73]);

    // DoMeFiLa (root Do, modifiers Me, Fi, La) -> C dim7: [60, 63, 66, 69] (C-Eb-Gb-A)
    const cDim7 = buildChordFromToken(60, 'DoMeFiLa', 60);
    expect(cDim7).toEqual([60, 63, 66, 69]);
  });

  it('correctly parses and builds half-diminished, sus, 6th, and major 7th chords', () => {
    // Half-diminished 7th: DoMeFiTe -> [60, 63, 66, 70] (C-Eb-Gb-Bb / Cm7b5)
    expect(parseHarmonyChord('DoMeFiTe').quality).toBe('halfDiminished7');
    expect(buildChordFromToken(60, 'DoMeFiTe')).toEqual([60, 63, 66, 70]);

    // Minor-major 7th: DoMeTi -> [60, 63, 67, 71] (C-Eb-G-B / Cm(maj7))
    expect(parseHarmonyChord('DoMeTi').quality).toBe('minorMajor7');
    expect(buildChordFromToken(60, 'DoMeTi')).toEqual([60, 63, 67, 71]);

    // Major 7th: DoTi -> [60, 64, 67, 71] (C-E-G-B / Cmaj7)
    expect(parseHarmonyChord('DoTi').quality).toBe('major7');
    expect(buildChordFromToken(60, 'DoTi')).toEqual([60, 64, 67, 71]);

    // Sus4: DoFa -> [60, 65, 67] (C-F-G / Csus4)
    expect(parseHarmonyChord('DoFa').quality).toBe('sus4');
    expect(buildChordFromToken(60, 'DoFa')).toEqual([60, 65, 67]);

    // Sus2: DoRe -> [60, 62, 67] (C-D-G / Csus2)
    expect(parseHarmonyChord('DoRe').quality).toBe('sus2');
    expect(buildChordFromToken(60, 'DoRe')).toEqual([60, 62, 67]);

    // 7sus4: DoFaTe -> [60, 65, 67, 70] (C-F-G-Bb / C7sus4)
    expect(parseHarmonyChord('DoFaTe').quality).toBe('7sus4');
    expect(buildChordFromToken(60, 'DoFaTe')).toEqual([60, 65, 67, 70]);

    // Major 6th: DoLa -> [60, 64, 67, 69] (C-E-G-A / C6)
    expect(parseHarmonyChord('DoLa').quality).toBe('major6');
    expect(buildChordFromToken(60, 'DoLa')).toEqual([60, 64, 67, 69]);

    // Minor 6th: DoMeLa -> [60, 63, 67, 69] (C-Eb-G-A / Cm6)
    expect(parseHarmonyChord('DoMeLa').quality).toBe('minor6');
    expect(buildChordFromToken(60, 'DoMeLa')).toEqual([60, 63, 67, 69]);

    // 5th Power Chord: DoSo -> [60, 67] (C-G / C5, excluding 3rd)
    expect(parseHarmonyChord('DoSo').quality).toBe('fifth');
    expect(buildChordFromToken(60, 'DoSo')).toEqual([60, 67]);

    // Diminished Triad: DoMeFi -> [60, 63, 66] (C-Eb-Gb / Cdim)
    expect(parseHarmonyChord('DoMeFi').quality).toBe('diminished');
    expect(buildChordFromToken(60, 'DoMeFi')).toEqual([60, 63, 66]);
  });

  it('correctly parses and builds extended (9th, 11th, 13th) and altered chords', () => {
    // Dominant 9th: DoTeRe -> [60, 64, 67, 70, 74] (C9)
    expect(parseHarmonyChord('DoTeRe').quality).toBe('dominant9');
    expect(buildChordFromToken(60, 'DoTeRe')).toEqual([60, 64, 67, 70, 74]);

    // Major 9th: DoTiRe -> [60, 64, 67, 71, 74] (Cmaj9)
    expect(parseHarmonyChord('DoTiRe').quality).toBe('major9');
    expect(buildChordFromToken(60, 'DoTiRe')).toEqual([60, 64, 67, 71, 74]);

    // Minor 9th: DoMeTeRe -> [60, 63, 67, 70, 74] (Cm9)
    expect(parseHarmonyChord('DoMeTeRe').quality).toBe('minor9');
    expect(buildChordFromToken(60, 'DoMeTeRe')).toEqual([60, 63, 67, 70, 74]);

    // 7(b9): DoTeRa -> [60, 64, 67, 70, 73] (C7b9)
    expect(parseHarmonyChord('DoTeRa').quality).toBe('dominant7b9');
    expect(buildChordFromToken(60, 'DoTeRa')).toEqual([60, 64, 67, 70, 73]);

    // 7(#9): DoTeRi -> [60, 64, 67, 70, 75] (C7#9 Hendrix chord)
    expect(parseHarmonyChord('DoTeRi').quality).toBe('dominant7sharp9');
    expect(buildChordFromToken(60, 'DoTeRi')).toEqual([60, 64, 67, 70, 75]);

    // 7(#11): DoTeFi -> [60, 64, 67, 70, 78] (C7#11 / C7b5)
    expect(parseHarmonyChord('DoTeFi').quality).toBe('dominant7sharp11');
    expect(buildChordFromToken(60, 'DoTeFi')).toEqual([60, 64, 67, 70, 78]);

    // maj7(#11): DoTiFi -> [60, 64, 67, 71, 78] (Cmaj7#11)
    expect(parseHarmonyChord('DoTiFi').quality).toBe('major7sharp11');
    expect(buildChordFromToken(60, 'DoTiFi')).toEqual([60, 64, 67, 71, 78]);

    // 7(b13): DoTeLe -> [60, 64, 68, 70] (C7b13 / C7#5)
    expect(parseHarmonyChord('DoTeLe').quality).toBe('dominant7b13');
    expect(buildChordFromToken(60, 'DoTeLe')).toEqual([60, 64, 68, 70]);

    // Dominant 13th: DoTeLa -> [60, 64, 67, 70, 74, 81] (C13)
    expect(parseHarmonyChord('DoTeLa').quality).toBe('dominant13');
    expect(buildChordFromToken(60, 'DoTeLa')).toEqual([60, 64, 67, 70, 74, 81]);

    // Major 13th: DoTiLa -> [60, 64, 67, 71, 74, 81] (Cmaj13)
    expect(parseHarmonyChord('DoTiLa').quality).toBe('major13');
    expect(buildChordFromToken(60, 'DoTiLa')).toEqual([60, 64, 67, 71, 74, 81]);

    // Minor 13th: DoMeTeLa -> [60, 63, 67, 70, 74, 81] (Cm13)
    expect(parseHarmonyChord('DoMeTeLa').quality).toBe('minor13');
    expect(buildChordFromToken(60, 'DoMeTeLa')).toEqual([60, 63, 67, 70, 74, 81]);
  });
});

describe('getSolfegeGlyphSpec (12-Tone Geometric Rotations)', () => {
  it('maps Base glyph rotations (Do: 0°, Me: 270° CW, Fi: 180°, La: 90° CCW)', () => {
    expect(getSolfegeGlyphSpec('Do')).toEqual({
      canonicalSyllable: 'Do',
      glyphType: 'base',
      rotation: 0,
      colorHex: '#E13610',
      colorSchemeVar: 'colorDo',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Me')).toEqual({
      canonicalSyllable: 'Me',
      glyphType: 'base',
      rotation: 270,
      colorHex: '#F5D432',
      colorSchemeVar: 'colorMi',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Fi')).toEqual({
      canonicalSyllable: 'Fi',
      glyphType: 'base',
      rotation: 180,
      colorHex: '#141414',
      colorSchemeVar: 'colorFi',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('La')).toEqual({
      canonicalSyllable: 'La',
      glyphType: 'base',
      rotation: 90,
      colorHex: '#5300A4',
      colorSchemeVar: 'colorLa',
      hasAxis: false,
      octaveShift: 0,
    });
  });

  it('maps Sharp glyph rotations (Ra: 0°, Mi: 270° CW, So: 180°, Te: 90° CCW)', () => {
    expect(getSolfegeGlyphSpec('Ra')).toEqual({
      canonicalSyllable: 'Ra',
      glyphType: 'sharp',
      rotation: 0,
      colorHex: '#F98016',
      colorSchemeVar: 'colorRe',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Mi')).toEqual({
      canonicalSyllable: 'Mi',
      glyphType: 'sharp',
      rotation: 270,
      colorHex: '#F5D432',
      colorSchemeVar: 'colorMi',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('So')).toEqual({
      canonicalSyllable: 'So',
      glyphType: 'sharp',
      rotation: 180,
      colorHex: '#0032A4',
      colorSchemeVar: 'colorSo',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Te')).toEqual({
      canonicalSyllable: 'Te',
      glyphType: 'sharp',
      rotation: 90,
      colorHex: '#F158A4',
      colorSchemeVar: 'colorTi',
      hasAxis: false,
      octaveShift: 0,
    });
  });

  it('maps Flat glyph rotations (Ti: 0°, Re: 270° CW, Fa: 180°, Le: 90° CCW)', () => {
    expect(getSolfegeGlyphSpec('Ti')).toEqual({
      canonicalSyllable: 'Ti',
      glyphType: 'flat',
      rotation: 0,
      colorHex: '#F158A4',
      colorSchemeVar: 'colorTi',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Re')).toEqual({
      canonicalSyllable: 'Re',
      glyphType: 'flat',
      rotation: 270,
      colorHex: '#F98016',
      colorSchemeVar: 'colorRe',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Fa')).toEqual({
      canonicalSyllable: 'Fa',
      glyphType: 'flat',
      rotation: 180,
      colorHex: '#43A440',
      colorSchemeVar: 'colorFa',
      hasAxis: false,
      octaveShift: 0,
    });

    expect(getSolfegeGlyphSpec('Le')).toEqual({
      canonicalSyllable: 'Le',
      glyphType: 'flat',
      rotation: 90,
      colorHex: '#5300A4',
      colorSchemeVar: 'colorLa',
      hasAxis: false,
      octaveShift: 0,
    });
  });

  it('supports hasAxis flag in glyph spec', () => {
    const spec = getSolfegeGlyphSpec('Do', true);
    expect(spec.hasAxis).toBe(true);
    expect(spec.octaveShift).toBe(0);
  });

  it('supports octaveShift parameter and token string parsing in getSolfegeGlyphSpec', () => {
    const specUp = getSolfegeGlyphSpec('Do^');
    expect(specUp.canonicalSyllable).toBe('Do');
    expect(specUp.octaveShift).toBe(1);

    const specDoubleUp = getSolfegeGlyphSpec('So^^');
    expect(specDoubleUp.canonicalSyllable).toBe('So');
    expect(specDoubleUp.octaveShift).toBe(2);

    const specDown = getSolfegeGlyphSpec('Fa_');
    expect(specDown.canonicalSyllable).toBe('Fa');
    expect(specDown.octaveShift).toBe(-1);

    const specDoubleDown = getSolfegeGlyphSpec('Me__');
    expect(specDoubleDown.canonicalSyllable).toBe('Me');
    expect(specDoubleDown.octaveShift).toBe(-2);

    const specExplicit = getSolfegeGlyphSpec('Dox', true, 1);
    expect(specExplicit.hasAxis).toBe(true);
    expect(specExplicit.octaveShift).toBe(1);
    expect(specExplicit.glyphType).toBe('base');
    expect(specExplicit.rotation).toBe(0);
  });
});

describe('semitoneIntervalToSolfege', () => {
  it('maps ascending and descending intervals within -5..+6 correctly', () => {
    expect(semitoneIntervalToSolfege(0)).toBe('Do');
    expect(semitoneIntervalToSolfege(1)).toBe('Ra');
    expect(semitoneIntervalToSolfege(2)).toBe('Re');
    expect(semitoneIntervalToSolfege(3)).toBe('Me');
    expect(semitoneIntervalToSolfege(4)).toBe('Mi');
    expect(semitoneIntervalToSolfege(5)).toBe('Fa');
    expect(semitoneIntervalToSolfege(6)).toBe('Fi');
    expect(semitoneIntervalToSolfege(-1)).toBe('Ti');
    expect(semitoneIntervalToSolfege(-2)).toBe('Te');
    expect(semitoneIntervalToSolfege(-3)).toBe('La');
    expect(semitoneIntervalToSolfege(-4)).toBe('Le');
    expect(semitoneIntervalToSolfege(-5)).toBe('So');
  });

  it('maps compound intervals with octave markers', () => {
    expect(semitoneIntervalToSolfege(7)).toBe('So^');
    expect(semitoneIntervalToSolfege(12)).toBe('Do^');
    expect(semitoneIntervalToSolfege(-7)).toBe('Fa_');
    expect(semitoneIntervalToSolfege(-12)).toBe('Do_');
  });
});


