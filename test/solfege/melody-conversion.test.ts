import { describe, it, expect } from 'vitest';
import {
  convertIntervalToAbsoluteMelody,
  convertAbsoluteToIntervalMelody,
  parseMelodyToken,
  semitonesToSolfege,
} from '../../src/solfege/pitch.js';

describe('Melody Mode Conversion & Token Parsing', () => {
  it('parses melody tokens correctly', () => {
    expect(parseMelodyToken('Do')).toEqual({
      syllable: 'Do',
      hasAxis: false,
      octaveShift: 0,
      baseSemitone: 0,
      raw: 'Do',
    });

    expect(parseMelodyToken('Dox')).toEqual({
      syllable: 'Do',
      hasAxis: true,
      octaveShift: 0,
      baseSemitone: 0,
      raw: 'Dox',
    });

    expect(parseMelodyToken('So^')).toEqual({
      syllable: 'So',
      hasAxis: false,
      octaveShift: 1,
      baseSemitone: -5,
      raw: 'So^',
    });

    expect(parseMelodyToken('R')).toEqual({
      isRest: true,
      raw: 'R',
    });

    expect(parseMelodyToken('2.2')).toEqual({
      isRepeat: true,
      repeatCount: 2,
      windowSize: 2,
      raw: '2.2',
    });
  });

  it('converts semitones to solfege canonical representation in base octave [-5, +6]', () => {
    expect(semitonesToSolfege(0)).toBe('Do');
    expect(semitonesToSolfege(2)).toBe('Re');
    expect(semitonesToSolfege(4)).toBe('Mi');
    expect(semitonesToSolfege(5)).toBe('Fa');
    expect(semitonesToSolfege(6)).toBe('Fi');
    expect(semitonesToSolfege(7)).toBe('So^');
    expect(semitonesToSolfege(12)).toBe('Do^');
    expect(semitonesToSolfege(-1)).toBe('Ti');
    expect(semitonesToSolfege(-5)).toBe('So');
    expect(semitonesToSolfege(-6)).toBe('Fi_');
    expect(semitonesToSolfege(-12)).toBe('Do_');
  });

  it('converts interval melody to absolute scale degrees', () => {
    // Dox (0) -> Re (+2) -> Mi (+4 from Re = +6 / Fi) -> Ti (-1 from Fi = +5 / Fa)
    const intervalTokens = ['Dox', 'Re', 'Mi', 'Ti'];
    const absolute = convertIntervalToAbsoluteMelody(intervalTokens);
    expect(absolute).toEqual(['Do', 'Re', 'Fi', 'Fa']);
  });

  it('converts absolute melody to interval mode with axis anchor', () => {
    const absoluteTokens = ['Do', 'Re', 'Fi', 'Fa'];
    const interval = convertAbsoluteToIntervalMelody(absoluteTokens);
    expect(interval).toEqual(['Dox', 'Re', 'Mi', 'Ti']);
  });

  it('preserves rests and repeat tokens during conversion', () => {
    const intervalTokens = ['Dox', 'Re', 'R', '2.2'];
    const absolute = convertIntervalToAbsoluteMelody(intervalTokens);
    expect(absolute).toEqual(['Do', 'Re', 'R', '2.2']);

    const absoluteTokens = ['Do', 'Re', 'R', '2.2'];
    const interval = convertAbsoluteToIntervalMelody(absoluteTokens);
    expect(interval).toEqual(['Dox', 'Re', 'R', '2.2']);
  });
});
