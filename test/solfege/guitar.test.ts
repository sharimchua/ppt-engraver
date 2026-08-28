import { describe, it, expect } from 'vitest';
import {
  solveGuitarGrip,
  solveGuitarPassage,
  calculateFretSpan,
  isGripPlayable,
  scoreGrip,
  findBestSingleNotePosition,
  getPlayablePositionsForMidi,
  STANDARD_GUITAR_TUNING,
} from '../../src/solfege/guitar.js';

describe('Guitar Fretboard & Grip Solver', () => {
  it('identifies open strings and low frets for single melody notes', () => {
    // E4 is string 1 open (fret 0)
    const posE4 = findBestSingleNotePosition(64);
    expect(posE4).toEqual({ stringNumber: 1, fretNumber: 0 });

    // B3 is string 2 open (fret 0)
    const posB3 = findBestSingleNotePosition(59);
    expect(posB3).toEqual({ stringNumber: 2, fretNumber: 0 });

    // G3 is string 3 open (fret 0)
    const posG3 = findBestSingleNotePosition(55);
    expect(posG3).toEqual({ stringNumber: 3, fretNumber: 0 });

    // D3 is string 4 open (fret 0)
    const posD3 = findBestSingleNotePosition(50);
    expect(posD3).toEqual({ stringNumber: 4, fretNumber: 0 });

    // A2 is string 5 open (fret 0)
    const posA2 = findBestSingleNotePosition(45);
    expect(posA2).toEqual({ stringNumber: 5, fretNumber: 0 });

    // E2 is string 6 open (fret 0)
    const posE2 = findBestSingleNotePosition(40);
    expect(posE2).toEqual({ stringNumber: 6, fretNumber: 0 });

    // C4 is string 2 fret 1
    const posC4 = findBestSingleNotePosition(60);
    expect(posC4).toEqual({ stringNumber: 2, fretNumber: 1 });
  });

  it('correctly computes fret span excluding open strings', () => {
    // Open strings (0) do not add to span
    expect(calculateFretSpan([0, 0, 0])).toBe(0);
    expect(calculateFretSpan([0, 2, 0, 1])).toBe(1); // 2 - 1 = 1
    expect(calculateFretSpan([3, 2, 0, 1, 0, 3])).toBe(2); // 3 - 1 = 2 (open C major chord)
    expect(calculateFretSpan([1, 5])).toBe(4); // 5 - 1 = 4
  });

  it('respects maximumFretSpan constraint', () => {
    const gripSmallSpan = [
      { stringNumber: 1, fretNumber: 1 },
      { stringNumber: 2, fretNumber: 3 },
      { stringNumber: 5, fretNumber: 0 }, // open string
    ];
    expect(isGripPlayable(gripSmallSpan, 3)).toBe(true);

    const gripLargeSpan = [
      { stringNumber: 1, fretNumber: 1 },
      { stringNumber: 2, fretNumber: 6 },
    ];
    expect(isGripPlayable(gripLargeSpan, 3)).toBe(false);
    expect(isGripPlayable(gripLargeSpan, 5)).toBe(true);
  });

  it('solves melodyOnly voicing', () => {
    const grip = solveGuitarGrip(60, 'Do', undefined, { voicing: 'melodyOnly' });
    expect(grip.length).toBe(1);
    expect(grip[0].midiNote).toBe(60);
    expect(grip[0].stringNumber).toBe(2);
    expect(grip[0].fretNumber).toBe(1);
  });

  it('solves root / bassAndMelody voicing with bass note under melody', () => {
    // Melody: E4 (64, Mi), Harmony: C major (Do) -> Root is C3 (MIDI 48) on string 5 fret 3
    const grip = solveGuitarGrip(64, 'Mi', 'Do', { voicing: 'root', knotDoMidi: 60 });
    expect(grip.length).toBe(2);
    // Root on string 5, Melody on string 1
    const rootNote = grip.find(n => n.stringNumber > 2);
    const melodyNote = grip.find(n => n.stringNumber <= 2);
    expect(rootNote).toBeDefined();
    expect(melodyNote).toBeDefined();
    expect(rootNote?.midiNote).toBe(48); // C3
    expect(melodyNote?.midiNote).toBe(64); // E4
  });

  it('solves triad / rootChordTones voicing fitting maxFretSpan', () => {
    // Melody: G4 (67, So), Harmony: C major (Do)
    const grip = solveGuitarGrip(67, 'So', 'Do', {
      voicing: 'triad',
      maxFretSpan: 3,
      knotDoMidi: 60,
    });
    expect(grip.length).toBeGreaterThanOrEqual(2);
    // Check that fret span across fretted notes is <= 3
    const frets = grip.map(g => g.fretNumber);
    expect(calculateFretSpan(frets)).toBeLessThanOrEqual(3);
  });

  it('voices root only on chord changes and emits single melody note on intermediate onsets', () => {
    // Chord change onset: should have root + melody
    const gripChange = solveGuitarGrip(64, 'Mi', 'Do', {
      voicing: 'root',
      isChordChange: true,
      knotDoMidi: 60,
    });
    expect(gripChange.length).toBe(2);

    // Intermediate onset (same chord sustained): should only have single melody note
    const gripIntermediate = solveGuitarGrip(67, 'So', 'Do', {
      voicing: 'root',
      isChordChange: false,
      knotDoMidi: 60,
    });
    expect(gripIntermediate.length).toBe(1);
    expect(gripIntermediate[0].midiNote).toBe(67);
  });

  it('voices chordMelody style with jazz grips on chord changes and downbeats', () => {
    // Chord change in chordMelody: should produce full grip (3 or 4 notes)
    const gripChange = solveGuitarGrip(67, 'So', 'Do', {
      voicing: 'chordMelody',
      isChordChange: true,
      maxFretSpan: 4,
      knotDoMidi: 60,
    });
    expect(gripChange.length).toBeGreaterThanOrEqual(3);

    // Passing note offbeat: single melody note
    const gripPassing = solveGuitarGrip(69, 'La', 'Do', {
      voicing: 'chordMelody',
      isChordChange: false,
      isStrongBeat: false,
      knotDoMidi: 60,
    });
    expect(gripPassing.length).toBe(1);
  });

  it('solves passages with vertical movement priority (staying in position box / limiting fret shifts)', () => {
    // C Major Scale: C4(60), D4(62), E4(64), F4(65), G4(67), A4(69), B4(71), C5(72)
    const scalePassage = [
      { midiNote: 60, scaleDegree: 'Do' },
      { midiNote: 62, scaleDegree: 'Re' },
      { midiNote: 64, scaleDegree: 'Mi' },
      { midiNote: 65, scaleDegree: 'Fa' },
      { midiNote: 67, scaleDegree: 'So' },
      { midiNote: 69, scaleDegree: 'La' },
      { midiNote: 71, scaleDegree: 'Ti' },
      { midiNote: 72, scaleDegree: 'Do' },
    ];

    const solvedVertical = solveGuitarPassage(scalePassage, {
      movement: 'vertical',
      voicing: 'melodyOnly',
    });

    expect(solvedVertical.length).toBe(8);

    // Verify all fretted notes have small fret shifts between adjacent notes (<= 4 frets)
    for (let i = 1; i < solvedVertical.length; i++) {
      const prev = solvedVertical[i - 1][0];
      const curr = solvedVertical[i][0];
      if (prev.fretNumber > 0 && curr.fretNumber > 0) {
        const fretShift = Math.abs(curr.fretNumber - prev.fretNumber);
        expect(fretShift).toBeLessThanOrEqual(4);
      }
    }
  });

  it('solves passages with horizontal movement priority (limiting string changes / linear single-string playing)', () => {
    // 5-note phrase starting on B string (string 2): C4(60), D4(62), E4(64), F4(65), G4(67)
    const phrase = [
      { midiNote: 60, scaleDegree: 'Do' },
      { midiNote: 62, scaleDegree: 'Re' },
      { midiNote: 64, scaleDegree: 'Mi' },
      { midiNote: 65, scaleDegree: 'Fa' },
      { midiNote: 67, scaleDegree: 'So' },
    ];

    const solvedHorizontal = solveGuitarPassage(phrase, {
      movement: 'horizontal',
      voicing: 'melodyOnly',
    });

    expect(solvedHorizontal.length).toBe(5);

    // In horizontal mode, notes should stay on the same string (String 2: frets 1, 3, 5, 6, 8)
    const strings = solvedHorizontal.map(grip => grip[0].stringNumber);
    const uniqueStrings = new Set(strings);
    expect(uniqueStrings.size).toBe(1);
    expect(strings[0]).toBe(2); // String 2 (B string)

    const frets = solvedHorizontal.map(grip => grip[0].fretNumber);
    expect(frets).toEqual([1, 3, 5, 6, 8]);
  });
});
