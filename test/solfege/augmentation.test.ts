import { describe, it, expect } from 'vitest';
import { generateMelodyAugmentation } from '../../src/solfege/augmentation.js';

describe('Melody Augmentation Engine', () => {
  it('returns empty array when augmentation is none', () => {
    const res = generateMelodyAugmentation(67, 'Do', 60, 'none');
    expect(res).toEqual([]);
  });

  it('generates octaves below', () => {
    // Melody = G4 (67), octave below = G3 (55) -> So
    const res = generateMelodyAugmentation(67, 'Do', 60, 'octaves');
    expect(res.length).toBe(1);
    expect(res[0].midiNote).toBe(55);
    expect(res[0].scaleDegree).toBe('So');
    expect(res[0].isInferred).toBe(true);
  });

  it('generates thirdsBelow matching active chord', () => {
    // Melody = G4 (67) with C major chord (Do = C4 = 60: chord tones C, E, G = 60, 64, 67)
    // 3 semitones below G is E (64, 3 semitones below = minor 3rd = 64) -> Mi
    const res = generateMelodyAugmentation(67, 'Do', 60, 'thirdsBelow');
    expect(res.length).toBe(1);
    expect(res[0].midiNote).toBe(64); // E4
    expect(res[0].scaleDegree).toBe('Mi');
  });

  it('generates sixthsBelow matching active chord', () => {
    // Melody = E4 (64) with C major chord (Do = C4 = 60)
    // 9 semitones below E4 is G3 (55) -> So
    const res = generateMelodyAugmentation(64, 'Do', 60, 'sixthsBelow');
    expect(res.length).toBe(1);
    expect(res[0].midiNote).toBe(55); // G3
    expect(res[0].scaleDegree).toBe('So');
  });

  it('generates triadClose block chords under melody', () => {
    // Melody = G4 (67) with C major chord (tones 60 C4, 64 E4, 67 G4)
    // 2 tones directly beneath 67 are 64 (E4) and 60 (C4)
    const res = generateMelodyAugmentation(67, 'Do', 60, 'triadClose');
    expect(res.length).toBe(2);
    expect(res[0].midiNote).toBe(64); // E4 (Mi)
    expect(res[1].midiNote).toBe(60); // C4 (Do)
  });

  it('generates drop2 jazz chord melody', () => {
    // Melody = G4 (67) with C7 chord (tones C4 60, E4 64, G4 67, Bb3 58 / Bb4 70)
    const res = generateMelodyAugmentation(67, 'DoTe', 60, 'drop2');
    expect(res.length).toBeGreaterThanOrEqual(1);
    for (const note of res) {
      expect(note.isInferred).toBe(true);
      expect(note.midiNote).toBeLessThan(67);
    }
  });

  it('generates guideToneDyad under melody', () => {
    // Melody = G4 (67) with C7 chord (DoTe -> 3rd is E4 64, 7th is Bb3 58)
    const res = generateMelodyAugmentation(67, 'DoTe', 60, 'guideToneDyad');
    expect(res.length).toBe(1);
    expect(res[0].midiNote).toBe(64); // E4
  });
});
