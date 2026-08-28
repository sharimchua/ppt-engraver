import { describe, it, expect } from 'vitest';
import { parseScaleDefinition, inferLilyPondModeFromIntervals } from '../../src/solfege/scale.js';

describe('Solfège Scale Grammar', () => {
  it('defaults to Ionian / Major scale for empty input or "Do"', () => {
    const emptyScale = parseScaleDefinition();
    expect(emptyScale.root).toBe('Do');
    expect(emptyScale.semitoneIntervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(emptyScale.syllables).toEqual(['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti']);
    expect(emptyScale.lilypondMode).toBe('major');

    const doScale = parseScaleDefinition('Do');
    expect(doScale.semitoneIntervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(doScale.syllables).toEqual(['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti']);
    expect(doScale.lilypondMode).toBe('major');
  });

  it('resolves mode offsets from Do', () => {
    // Re = Dorian (b3, b7)
    const dorian = parseScaleDefinition('Re');
    expect(dorian.root).toBe('Re');
    expect(dorian.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(dorian.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'La', 'Te']);
    expect(dorian.lilypondMode).toBe('dorian');

    // Mi = Phrygian (b2, b3, b6, b7)
    const phrygian = parseScaleDefinition('Mi');
    expect(phrygian.root).toBe('Mi');
    expect(phrygian.semitoneIntervals).toEqual([0, 1, 3, 5, 7, 8, 10]);
    expect(phrygian.syllables).toEqual(['Do', 'Ra', 'Me', 'Fa', 'So', 'Le', 'Te']);
    expect(phrygian.lilypondMode).toBe('phrygian');

    // Fa = Lydian (#4)
    const lydian = parseScaleDefinition('Fa');
    expect(lydian.root).toBe('Fa');
    expect(lydian.semitoneIntervals).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(lydian.syllables).toEqual(['Do', 'Re', 'Mi', 'Fi', 'So', 'La', 'Ti']);
    expect(lydian.lilypondMode).toBe('lydian');

    // So = Mixolydian (b7)
    const mixolydian = parseScaleDefinition('So');
    expect(mixolydian.root).toBe('So');
    expect(mixolydian.semitoneIntervals).toEqual([0, 2, 4, 5, 7, 9, 10]);
    expect(mixolydian.syllables).toEqual(['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Te']);
    expect(mixolydian.lilypondMode).toBe('mixolydian');

    // La = Aeolian / Natural Minor (b3, b6, b7)
    const aeolian = parseScaleDefinition('La');
    expect(aeolian.root).toBe('La');
    expect(aeolian.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(aeolian.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Te']);
    expect(aeolian.lilypondMode).toBe('minor');

    // Ti = Locrian (b2, b3, b5, b6, b7)
    const locrian = parseScaleDefinition('Ti');
    expect(locrian.root).toBe('Ti');
    expect(locrian.semitoneIntervals).toEqual([0, 1, 3, 5, 6, 8, 10]);
    expect(locrian.syllables).toEqual(['Do', 'Ra', 'Me', 'Fa', 'Fi', 'Le', 'Te']);
    expect(locrian.lilypondMode).toBe('locrian');
  });

  it('applies modifier suffixes to alter scale degree slots', () => {
    // DoMe = Jazz / Melodic Minor Ascending (minor 3rd)
    const melodicMinor = parseScaleDefinition('DoMe');
    expect(melodicMinor.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 9, 11]);
    expect(melodicMinor.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'La', 'Ti']);
    expect(melodicMinor.lilypondMode).toBe('minor');

    // DoMeLe = Harmonic Minor
    const harmMinor1 = parseScaleDefinition('DoMeLe');
    expect(harmMinor1.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 8, 11]);
    expect(harmMinor1.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Ti']);
    expect(harmMinor1.lilypondMode).toBe('minor');

    // LaTi = Aeolian base with Ti (major 7th) -> Harmonic Minor
    const harmMinor2 = parseScaleDefinition('LaTi');
    expect(harmMinor2.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 8, 11]);
    expect(harmMinor2.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Ti']);
    expect(harmMinor2.lilypondMode).toBe('minor');

    // DoFiTe = Lydian Dominant
    const lydianDom = parseScaleDefinition('DoFiTe');
    expect(lydianDom.semitoneIntervals).toEqual([0, 2, 4, 6, 7, 9, 10]);
    expect(lydianDom.syllables).toEqual(['Do', 'Re', 'Mi', 'Fi', 'So', 'La', 'Te']);
    expect(lydianDom.lilypondMode).toBe('major');
  });

  it('supports explicit arrays and space-delimited Solfège strings', () => {
    const fromArray = parseScaleDefinition(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Ti']);
    expect(fromArray.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 8, 11]);
    expect(fromArray.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Ti']);

    const fromString = parseScaleDefinition('Do Re Me Fa So Le Te');
    expect(fromString.semitoneIntervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(fromString.syllables).toEqual(['Do', 'Re', 'Me', 'Fa', 'So', 'Le', 'Te']);
  });
});
