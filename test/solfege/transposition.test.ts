import { describe, it, expect } from 'vitest';
import {
  transposeSolfegeToken,
  transposeHarmonyToken,
  calculateTonicShift,
  MODE_DEGREE_OFFSETS,
} from '../../src/solfege/pitch.js';
import {
  transposeRhythmTokens,
  analyzeRhythmComplexity,
  suggestOptimalRhythmicPeriod,
  offsetInBeatToSolfege,
  timestampsToRhythmTokens,
  calculateHarmonyPhaseOffset,
} from '../../src/solfege/rhythm.js';

describe('Solfège Pitch & Mode Transposition', () => {
  it('calculates tonic shifts correctly for mode transitions', () => {
    // C4 (60) to A3 (57) -> shift = +3 semitones (Aeolian / relative minor)
    const shiftAeolian = calculateTonicShift('C4', 'A3');
    expect(shiftAeolian.semitones).toBe(3);
    expect(shiftAeolian.oldMidi).toBe(60);
    expect(shiftAeolian.newMidi).toBe(57);

    // C4 (60) to Eb4 (63) -> shift = -3 semitones (Eb major)
    const shiftEb = calculateTonicShift('C4', 'Eb4');
    expect(shiftEb.semitones).toBe(-3);
  });

  it('transposes absolute solfege tokens preserving sounding pitch', () => {
    // When changing tonic from C4 to A3 (+3 semitones):
    // C4 was Do -> under A3 becomes Me (+3 st)
    expect(transposeSolfegeToken('Do', 3)).toBe('Me');
    // D4 was Re -> under A3 becomes Fa (+3 st)
    expect(transposeSolfegeToken('Re', 3)).toBe('Fa');
    // E4 was Mi -> under A3 becomes So^ (+3 st -> +7 st above Do)
    expect(transposeSolfegeToken('Mi', 3)).toBe('So^');
    // G4 was So (-5) -> under A3 becomes Te (-2) (+3 st)
    expect(transposeSolfegeToken('So', 3)).toBe('Te');
    // A4 was La (-3) -> under A3 becomes Do (0)
    expect(transposeSolfegeToken('La', 3)).toBe('Do');
  });

  it('preserves axis markers and octave displacements during pitch transposition', () => {
    // Dox anchor transposed by +3 -> Mex
    expect(transposeSolfegeToken('Dox', 3)).toBe('Mex');
    // Do^ transposed by +3 -> Me^
    expect(transposeSolfegeToken('Do^', 3)).toBe('Me^');
    // So_ transposed by +3 -> Te_
    expect(transposeSolfegeToken('So_', 3)).toBe('Te_');
    // Rests remain unchanged
    expect(transposeSolfegeToken('R', 3)).toBe('R');
    expect(transposeSolfegeToken('~', 3)).toBe('~');
  });

  it('transposes harmony chords preserving qualities and bass prefixes', () => {
    // C minor (DoMe) transposed +3 st -> Eb minor (MeMe)
    expect(transposeHarmonyToken('DoMe', 3)).toBe('MeMe');
    // G7 (SoTe) transposed +3 st -> Bb7 (TeTe)
    expect(transposeHarmonyToken('SoTe', 3)).toBe('TeTe');
    // C/G slash chord (SoxDo) transposed +3 st -> Eb/Bb (TexMe)
    expect(transposeHarmonyToken('SoxDo', 3)).toBe('TexMe');
    // Cmaj7 (DoTi) transposed +3 st -> Ebmaj7 (MeTi)
    expect(transposeHarmonyToken('DoTi', 3)).toBe('MeTi');
  });
});

describe('Rhythmic Transposition & Grammar Optimization', () => {
  it('converts sub-beat fractional offsets to solfege syllables', () => {
    expect(offsetInBeatToSolfege(0)).toBe('Do');
    expect(offsetInBeatToSolfege(0.5)).toBe('Fi');
    expect(offsetInBeatToSolfege(0.25)).toBe('Me');
    expect(offsetInBeatToSolfege(0.75)).toBe('La');
    expect(offsetInBeatToSolfege(1 / 3)).toBe('Mi');
    expect(offsetInBeatToSolfege(2 / 3)).toBe('Le');
  });

  it('transposes rhythm tokens by scaling factors (double time & half time)', () => {
    // Downbeat notes [Do, Do, Do, Do] scaled 0.5x (half time period) becomes alternating [Do, Fi, Do, Fi]
    const downbeats = ['Do', 'Do', 'Do', 'Do'];
    const halfPeriod = transposeRhythmTokens(downbeats, 0.5);
    expect(halfPeriod).toEqual(['Do', 'Fi', 'Do', 'Fi']);

    // 8th notes [Do, Fi, Do, Fi] scaled 2.0x (double time pulse) becomes 4 downbeats [Do, Do, Do, Do]
    const eighthNotes = ['Do', 'Fi', 'Do', 'Fi'];
    const doubleTime = transposeRhythmTokens(eighthNotes, 2.0);
    expect(doubleTime).toEqual(['Do', 'Do', 'Do', 'Do']);

    // Half notes with Dox delays [Do, DoxDo, DoxDo] scaled 0.5x becomes [Do, Do, Do]
    const halfNotes = ['Do', 'DoxDo', 'DoxDo'];
    const halfTime = transposeRhythmTokens(halfNotes, 0.5);
    expect(halfTime).toEqual(['Do', 'Do', 'Do']);

    // Offbeat notes [Fi, Fi, Fi, Fi] (onbeats 0.5, 1.5, 2.5, 3.5) scaled 2.0x becomes [DoxDo, DoxDo, DoxDo, DoxDo]
    const offbeats = ['Fi', 'Fi', 'Fi', 'Fi'];
    const scaledOffbeats = transposeRhythmTokens(offbeats, 2.0);
    expect(scaledOffbeats).toEqual(['DoxDo', 'DoxDo', 'DoxDo', 'DoxDo']);
  });

  it('calculates harmony phase offset and aligns pickups with chord downbeats', () => {
    // Autumn Leaves style 3-beat pickup with chord entering at beat 3 (DoxDoxDoxDo)
    const autumnLeavesChordRhythm = ['DoxDoxDoxDo'];
    const phase = calculateHarmonyPhaseOffset(autumnLeavesChordRhythm, 0.5);
    expect(phase).toBe(1.0);

    // 4 melody quarter notes [Do, Do, Do, Do] transposed with 0.5x and phase 1.0
    // Notes land at t = (0+1)*0.5 = 0.5 (Fi), (1+1)*0.5 = 1.0 (Do), (2+1)*0.5 = 1.5 (Fi), (3+1)*0.5 = 2.0 (Do)
    const melody = ['Do', 'Do', 'Do', 'Do'];
    const phaseShifted = transposeRhythmTokens(melody, 0.5, phase);
    expect(phaseShifted).toEqual(['Fi', 'Do', 'Fi', 'Do']);

    // The 4th note (where chord enters) is a clean downbeat 'Do'
    expect(phaseShifted[3]).toBe('Do');

    // Harmony chord rhythm [DoxDoxDoxDo] transposed with 0.5x and phase 1.0 lands at (3+1)*0.5 = 2.0 (DoxDoxDo)
    const transposedChordRhythm = transposeRhythmTokens(autumnLeavesChordRhythm, 0.5, phase);
    expect(transposedChordRhythm).toEqual(['DoxDoxDo']);
  });

  it('analyzes rhythm complexity and detects Dox and compound suffixes', () => {
    const complexRhythm = ['Do', 'DoxDo', 'DoxFi', 'LeFi'];
    const stats = analyzeRhythmComplexity(complexRhythm);
    expect(stats.doxCount).toBe(2);
    expect(stats.compoundSuffixCount).toBe(1);
    expect(stats.totalTokens).toBe(4);
  });

  it('suggests optimal rhythmic period length to minimize Dox delays and compound suffixes', () => {
    // A rhythm with many 8th notes [Do, Fi, Do, Fi, Do, Fi] can be optimized with 2x scaling to clean downbeats
    const eighths = ['Do', 'Fi', 'Do', 'Fi', 'Do', 'Fi', 'Do', 'Fi'];
    const suggestion = suggestOptimalRhythmicPeriod(eighths);
    expect(suggestion.recommendedFactor).toBe(2.0);
    expect(suggestion.transposedTokens).toEqual(['Do', 'Do', 'Do', 'Do', 'Do', 'Do', 'Do', 'Do']);
    expect(suggestion.recommendedComplexity.compoundSuffixCount).toBe(0);
    expect(suggestion.recommendedComplexity.doxCount).toBe(0);
  });
});
