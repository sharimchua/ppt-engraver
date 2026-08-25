import { describe, it, expect } from 'vitest';
import {
  solveGuitarGrip,
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
});
