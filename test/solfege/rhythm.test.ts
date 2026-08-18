import { describe, it, expect } from 'vitest';
import {
  parseRhythmToken,
  expandRhythmEntries,
  beatsToLilyPondDuration,
  resolveRhythmTimeline,
} from '../../src/solfege/rhythm.js';

describe('Solfège Rhythmic Grammar', () => {
  describe('parseRhythmToken', () => {
    it('parses downbeat (Do)', () => {
      const parsed = parseRhythmToken('Do');
      expect(parsed.beatSkips).toBe(0);
      expect(parsed.baseSyllable).toBe('Do');
      expect(parsed.offsetInBeat).toBeCloseTo(0.0);
    });

    it('parses 8th-note offbeat (Fi = 1/2)', () => {
      const parsed = parseRhythmToken('Fi');
      expect(parsed.beatSkips).toBe(0);
      expect(parsed.baseSyllable).toBe('Fi');
      expect(parsed.offsetInBeat).toBeCloseTo(0.5);
    });

    it('parses 16th-note subdivisions (Me = 1/4, Fi = 2/4, La = 3/4)', () => {
      expect(parseRhythmToken('Me').offsetInBeat).toBeCloseTo(0.25);
      expect(parseRhythmToken('Fi').offsetInBeat).toBeCloseTo(0.5);
      expect(parseRhythmToken('La').offsetInBeat).toBeCloseTo(0.75);
    });

    it('parses triplets (Mi = 1/3, Le = 2/3)', () => {
      expect(parseRhythmToken('Mi').offsetInBeat).toBeCloseTo(1 / 3);
      expect(parseRhythmToken('Le').offsetInBeat).toBeCloseTo(2 / 3);
    });

    it('parses Dox prefix beat skips (DoxDo = 1 beat skip, DoxFi = 1 beat skip + 0.5 offset)', () => {
      const doxDo = parseRhythmToken('DoxDo');
      expect(doxDo.beatSkips).toBe(1);
      expect(doxDo.baseSyllable).toBe('Do');
      expect(doxDo.offsetInBeat).toBeCloseTo(0.0);

      const doxFi = parseRhythmToken('DoxFi');
      expect(doxFi.beatSkips).toBe(1);
      expect(doxFi.baseSyllable).toBe('Fi');
      expect(doxFi.offsetInBeat).toBeCloseTo(0.5);

      const doxDoxDo = parseRhythmToken('DoxDoxDo');
      expect(doxDoxDo.beatSkips).toBe(2);
    });

    it('parses recursive suffix subdivisions (LeFi = 5/6, MeFi = 5/8)', () => {
      // Le = 2/3, remaining = 1/3, Fi = 1/2 -> 2/3 + (1/2)*(1/3) = 5/6
      const leFi = parseRhythmToken('LeFi');
      expect(leFi.baseSyllable).toBe('Le');
      expect(leFi.suffixes).toEqual(['Fi']);
      expect(leFi.offsetInBeat).toBeCloseTo(5 / 6);

      // Me = 1/4, remaining = 3/4, Fi = 1/2 -> 1/4 + 3/8 = 5/8
      const meFi = parseRhythmToken('MeFi');
      expect(meFi.baseSyllable).toBe('Me');
      expect(meFi.offsetInBeat).toBeCloseTo(5 / 8);
    });
  });

  describe('expandRhythmEntries', () => {
    it('expands repeat numbers in rhythm array', () => {
      const expanded = expandRhythmEntries(['Do', 3, 'Fi'], 5);
      expect(expanded).toEqual(['Do', 'Do', 'Do', 'Do', 'Fi']);
    });

    it('expands X.Y lookback window repeats in rhythm array', () => {
      const expanded = expandRhythmEntries(['Do', 'Fi', 1.2]);
      expect(expanded).toEqual(['Do', 'Fi', 'Do', 'Fi']);

      const expanded2 = expandRhythmEntries(['Do', 'Fi', 'Me', 2.3]);
      expect(expanded2).toEqual([
        'Do', 'Fi', 'Me',
        'Do', 'Fi', 'Me',
        'Do', 'Fi', 'Me',
      ]);
    });

    it('supports string formatted X.Y lookback repeats in rhythm array', () => {
      const expanded = expandRhythmEntries(['Do', 'Fi', '1.2']);
      expect(expanded).toEqual(['Do', 'Fi', 'Do', 'Fi']);
    });

    it('throws when rhythm lookback window exceeds available items', () => {
      expect(() => expandRhythmEntries(['Do', 1.2])).toThrow(/Repeat lookback window \(2\) exceeds available items/);
    });

    it('pads with last token when fewer entries than targetCount', () => {
      const expanded = expandRhythmEntries(['Do', 'Fi'], 4);
      expect(expanded).toEqual(['Do', 'Fi', 'Fi', 'Fi']);
    });
  });

  describe('beatsToLilyPondDuration', () => {
    it('converts standard note durations', () => {
      expect(beatsToLilyPondDuration(1.0)).toBe('4');   // Quarter
      expect(beatsToLilyPondDuration(0.5)).toBe('8');   // 8th
      expect(beatsToLilyPondDuration(0.25)).toBe('16'); // 16th
      expect(beatsToLilyPondDuration(2.0)).toBe('2');   // Half
      expect(beatsToLilyPondDuration(4.0)).toBe('1');   // Whole
      expect(beatsToLilyPondDuration(0.75)).toBe('4*3/4'); // 0.75 beats (undotted)
    });

    it('converts triplet durations', () => {
      expect(beatsToLilyPondDuration(1 / 3)).toBe('4*1/3');
      expect(beatsToLilyPondDuration(2 / 3)).toBe('4*2/3');
    });
  });

  describe('resolveRhythmTimeline', () => {
    it('resolves four 16th notes on a single beat [Do, Me, Fi, La]', () => {
      const timeline = resolveRhythmTimeline(['Do', 'Me', 'Fi', 'La']);
      expect(timeline).toHaveLength(4);
      expect(timeline[0].startBeat).toBeCloseTo(0.0);
      expect(timeline[0].durationBeats).toBeCloseTo(0.25);
      expect(timeline[0].lilypondDuration).toBe('16');

      expect(timeline[1].startBeat).toBeCloseTo(0.25);
      expect(timeline[1].durationBeats).toBeCloseTo(0.25);
      expect(timeline[1].lilypondDuration).toBe('16');

      expect(timeline[2].startBeat).toBeCloseTo(0.5);
      expect(timeline[2].durationBeats).toBeCloseTo(0.25);
      expect(timeline[2].lilypondDuration).toBe('16');

      expect(timeline[3].startBeat).toBeCloseTo(0.75);
      expect(timeline[3].durationBeats).toBeCloseTo(0.25);
      expect(timeline[3].lilypondDuration).toBe('16');
    });

    it('resolves 8th notes across multiple beats [Do, Fi, Do, Fi]', () => {
      const timeline = resolveRhythmTimeline(['Do', 'Fi', 'Do', 'Fi']);
      expect(timeline).toHaveLength(4);
      expect(timeline[0].startBeat).toBeCloseTo(0.0);
      expect(timeline[0].durationBeats).toBeCloseTo(0.5);
      expect(timeline[0].lilypondDuration).toBe('8');

      expect(timeline[1].startBeat).toBeCloseTo(0.5);
      expect(timeline[1].durationBeats).toBeCloseTo(0.5);
      expect(timeline[1].lilypondDuration).toBe('8');

      expect(timeline[2].startBeat).toBeCloseTo(1.0);
      expect(timeline[2].durationBeats).toBeCloseTo(0.5);
      expect(timeline[2].lilypondDuration).toBe('8');

      expect(timeline[3].startBeat).toBeCloseTo(1.5);
      expect(timeline[3].durationBeats).toBeCloseTo(0.5);
      expect(timeline[3].lilypondDuration).toBe('8');
    });

    it('resolves triplets [Do, Mi, Le, Do]', () => {
      const timeline = resolveRhythmTimeline(['Do', 'Mi', 'Le', 'Do']);
      expect(timeline).toHaveLength(4);
      expect(timeline[0].startBeat).toBeCloseTo(0.0);
      expect(timeline[0].durationBeats).toBeCloseTo(1 / 3);
      expect(timeline[0].lilypondDuration).toBe('4*1/3');

      expect(timeline[1].startBeat).toBeCloseTo(1 / 3);
      expect(timeline[1].durationBeats).toBeCloseTo(1 / 3);
      expect(timeline[1].lilypondDuration).toBe('4*1/3');

      expect(timeline[2].startBeat).toBeCloseTo(2 / 3);
      expect(timeline[2].durationBeats).toBeCloseTo(1 / 3);
      expect(timeline[2].lilypondDuration).toBe('4*1/3');

      expect(timeline[3].startBeat).toBeCloseTo(1.0);
      expect(timeline[3].durationBeats).toBeCloseTo(1.0);
    });

    it('expands compound Dox tokens into individual downbeat onsets', () => {
      const expanded = expandRhythmEntries(['Do', 'Fi', 'Do', 'DoxDoxDo', 'Fi', 'Do']);
      expect(expanded).toEqual(['Do', 'Fi', 'Do', 'Dox', 'Dox', 'Do', 'Fi', 'Do']);
    });

    it('resolves DoxDoxDo with single beat increments on each Dox without doubling', () => {
      const expanded = expandRhythmEntries(['Do', 'Fi', 'Do', 'DoxDoxDo', 'Fi', 'Do']);
      const timeline = resolveRhythmTimeline(expanded);
      expect(timeline).toHaveLength(8);
      expect(timeline[0].startBeat).toBeCloseTo(0.0); // Do
      expect(timeline[1].startBeat).toBeCloseTo(0.5); // Fi
      expect(timeline[2].startBeat).toBeCloseTo(1.0); // Do
      expect(timeline[3].startBeat).toBeCloseTo(2.0); // Dox
      expect(timeline[4].startBeat).toBeCloseTo(3.0); // Dox
      expect(timeline[5].startBeat).toBeCloseTo(4.0); // Do
      expect(timeline[6].startBeat).toBeCloseTo(4.5); // Fi
      expect(timeline[7].startBeat).toBeCloseTo(5.0); // Do

      // Each Dox is exactly 1.0 beat (quarter note)
      expect(timeline[3].durationBeats).toBeCloseTo(1.0);
      expect(timeline[4].durationBeats).toBeCloseTo(1.0);
    });
  });
});
