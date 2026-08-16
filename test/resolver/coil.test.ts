import { describe, it, expect } from 'vitest';
import { resolveCoil } from '../../src/resolver/coil.js';
import type { Coil } from '../../src/schema/tapestry.js';
import type { ResolvedKnot } from '../../src/solfege/pitch.js';

const knotC4: ResolvedKnot = { doMidi: 60, tempo: 120 };

describe('resolveCoil', () => {
  describe('absolute mode melody', () => {
    it('resolves simple melody (Do, Mi, So^)', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Mi', 'So^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(3);
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[1].melodyMidi).toBe(64); // E4
      expect(onsets[2].melodyMidi).toBe(67); // G4
    });

    it('resolves melody with octave up (Do^)', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Mi', 'So^', 'Do^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets[3].melodyMidi).toBe(72); // C5
    });


    it('preserves scale degree names', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Ti', 'Do^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[1].scaleDegree).toBe('Ti');
      expect(onsets[2].scaleDegree).toBe('Do');
    });
  });

  describe('interval mode melody', () => {
    it('resolves interval melody (Dox, Re, Mi, Ti)', () => {
      const coil: Coil = { id: 'test', melody: ['Dox', 'Re', 'Mi', 'Ti'] };
      const { onsets } = resolveCoil(coil, knotC4);
      // Dox = C4 (60), Re = +2 → D4 (62), Mi = +4 → F#4 (66), Ti = -1 → F4 (65)
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[1].melodyMidi).toBe(62); // D4
      expect(onsets[2].melodyMidi).toBe(66); // F#4
      expect(onsets[3].melodyMidi).toBe(65); // F4
    });

    it('resolves ascending perfect fifth with octave mark', () => {
      // So^ in interval mode = -5 + 12 = +7 semitones
      const coil: Coil = { id: 'test', melody: ['Dox', 'So^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[1].melodyMidi).toBe(67); // G4 (+7)
    });
  });

  describe('harmony resolution', () => {
    it('defaults to Do major triad when no harmony specified', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Re'] };
      const { onsets } = resolveCoil(coil, knotC4);
      // Default: Do major triad = C4, E4, G4
      expect(onsets[0].chordMidi).toEqual([60, 64, 67]);
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordMidi).toEqual([60, 64, 67]);
    });

    it('resolves single chord held across all onsets', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Mi', 'So^'], harmony: ['So^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      // So^ = G4 major triad: G4, B4, D5
      const expected = [67, 71, 74];
      expect(onsets[0].chordMidi).toEqual(expected);
      expect(onsets[1].chordMidi).toEqual(expected);
      expect(onsets[2].chordMidi).toEqual(expected);
    });


    it('distributes multiple chords across melody (stretch)', () => {
      const coil: Coil = {
        id: 'test',
        melody: ['Do', 'Re', 'Mi', 'Fa'],
        harmony: ['Do', 'So'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      // 4 melody / 2 harmony = 2 onsets per chord
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordRoot).toBe('Do');
      expect(onsets[2].chordRoot).toBe('So');
      expect(onsets[3].chordRoot).toBe('So');
    });
  });

  describe('rhythm validation', () => {
    it('accepts matching rhythm label and melody length', () => {
      const coil: Coil = { id: 'test', rhythm: 'DoLa', melody: ['Do', 'Re', 'Mi', 'Fa'] };
      expect(() => resolveCoil(coil, knotC4)).not.toThrow();
    });

    it('emits warning on mismatched rhythm label and melody length', () => {
      const coil: Coil = { id: 'test', rhythm: 'DoLa', melody: ['Do', 'Re'] };
      const { warnings } = resolveCoil(coil, knotC4);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('rhythm label "DoLa" specifies 4 beats, but melody has 2 onsets');
    });

    it('flattens space-separated melody tokens in a single entry', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Re Te', 'Mi'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[1].scaleDegree).toBe('Re');
      expect(onsets[2].scaleDegree).toBe('Te');
      expect(onsets[3].scaleDegree).toBe('Mi');
    });


    it('accepts omitted rhythm (onset count = melody length)', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Re', 'Mi'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(3);
    });
  });
});
