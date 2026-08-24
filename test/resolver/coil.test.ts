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

    it('expands repeat numbers in melody array', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 3, 'Mi', 1] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(6);
      expect(onsets[0].melodyMidi).toBe(60); // Do
      expect(onsets[1].melodyMidi).toBe(60); // Do
      expect(onsets[2].melodyMidi).toBe(60); // Do
      expect(onsets[3].melodyMidi).toBe(60); // Do
      expect(onsets[4].melodyMidi).toBe(64); // Mi
      expect(onsets[5].melodyMidi).toBe(64); // Mi
    });

    it('expands X.Y lookback window repeats in melody array', () => {
      // 1.2 repeats the last 2 items 1 time: [Do, Re] -> [Do, Re, Do, Re]
      const coil1: Coil = { id: 'test1', melody: ['Do', 'Re', 1.2] };
      const { onsets: onsets1 } = resolveCoil(coil1, knotC4);
      expect(onsets1).toHaveLength(4);
      expect(onsets1.map(o => o.scaleDegree)).toEqual(['Do', 'Re', 'Do', 'Re']);

      // 2.3 repeats the last 3 items 2 times: [Do, Re, Mi, Fa] -> [Do, Re, Mi, Fa, Re, Mi, Fa, Re, Mi, Fa]
      const coil2: Coil = { id: 'test2', melody: ['Do', 'Re', 'Mi', 'Fa', 2.3] };
      const { onsets: onsets2 } = resolveCoil(coil2, knotC4);
      expect(onsets2).toHaveLength(10);
      expect(onsets2.map(o => o.scaleDegree)).toEqual([
        'Do', 'Re', 'Mi', 'Fa',
        'Re', 'Mi', 'Fa',
        'Re', 'Mi', 'Fa',
      ]);
    });

    it('supports string formatted X.Y lookback repeats', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 'Re', '1.2'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets.map(o => o.scaleDegree)).toEqual(['Do', 'Re', 'Do', 'Re']);
    });

    it('throws when melody lookback window exceeds available items', () => {
      const coil: Coil = { id: 'test', melody: ['Do', 1.2] };
      expect(() => resolveCoil(coil, knotC4)).toThrow(/Repeat lookback window \(2\) exceeds available items/);
    });

    it('throws when melody array starts with repeat padding number', () => {
      const coil: Coil = { id: 'test', melody: [2, 'Do'] };
      expect(() => resolveCoil(coil, knotC4)).toThrow(/Melody array cannot start with a repeat padding number/);
    });
  });

  describe('interval mode melody', () => {
    it('resolves interval melody (Dox, Re, Mi, Ti) with tonic-relative scale degrees', () => {
      const coil: Coil = { id: 'test', melody: ['Dox', 'Re', 'Mi', 'Ti'] };
      const { onsets } = resolveCoil(coil, knotC4);
      // Dox = C4 (60), Re = +2 → D4 (62), Mi = +4 → F#4 (66), Ti = -1 → F4 (65)
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[1].melodyMidi).toBe(62); // D4
      expect(onsets[1].scaleDegree).toBe('Re');
      expect(onsets[2].melodyMidi).toBe(66); // F#4
      expect(onsets[2].scaleDegree).toBe('Fi'); // F# relative to C is Fi (tritone)
      expect(onsets[3].melodyMidi).toBe(65); // F4
      expect(onsets[3].scaleDegree).toBe('Fa'); // F relative to C is Fa (fourth)
    });

    it('resolves ascending perfect fifth with octave mark', () => {
      // So^ in interval mode = -5 + 12 = +7 semitones
      const coil: Coil = { id: 'test', melody: ['Dox', 'So^'] };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[1].melodyMidi).toBe(67); // G4 (+7)
      expect(onsets[1].scaleDegree).toBe('So'); // G relative to C is So (fifth)
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
      const coil: Coil = { id: 'test', melody: ['Do', 'Mi', 'So^'], harmony: ['So'] };
      const { onsets } = resolveCoil(coil, knotC4);
      // So = G3 major triad: G3, B3, D4 (55, 59, 62)
      const expected = [55, 59, 62];
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

    it('supports repeat padding numbers for explicit onset alignment', () => {
      const coil: Coil = {
        id: 'test',
        melody: ['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti'], // 7 onsets
        harmony: ['Do', 2, 'Fa', 1, 'So'], // Do x 3, Fa x 2, So x 1 + remainder So = 7 onsets
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(7);
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordRoot).toBe('Do');
      expect(onsets[2].chordRoot).toBe('Do');
      expect(onsets[3].chordRoot).toBe('Fa');
      expect(onsets[4].chordRoot).toBe('Fa');
      expect(onsets[5].chordRoot).toBe('So');
      expect(onsets[6].chordRoot).toBe('So'); // Remainder filled with last chord
    });

    it('resolves harmony chords with Axis Bass prefix (slash chords / inversions)', () => {
      const coil: Coil = {
        id: 'test',
        melody: ['Do', 'Re', 'Mi', 'Fa'],
        harmony: ['DoxFa', 'SoxDo', 'MiexDo', 'RexSo'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      // DoxFa: F3 major (53, 57, 60) in 2nd inversion with C3 bass (48) -> [48, 53, 57] (C-F-A)
      expect(onsets[0].chordRoot).toBe('DoxFa');
      expect(onsets[0].chordMidi).toEqual([48, 53, 57]);

      // SoxDo: C major (60, 64, 67) in 2nd inversion with G3 bass (55) -> [55, 60, 64] (G-C-E)
      expect(onsets[1].chordRoot).toBe('SoxDo');
      expect(onsets[1].chordMidi).toEqual([55, 60, 64]);

      // MiexDo: C major (60, 64, 67) in 1st inversion with E4 bass (64) -> [64, 67, 72] (E-G-C)
      expect(onsets[2].chordRoot).toBe('MiexDo');
      expect(onsets[2].chordMidi).toEqual([64, 67, 72]);

      // RexSo: G3 major (55, 59, 62) in 2nd inversion with D3 bass (50) -> [50, 55, 59] (D-G-B)
      expect(onsets[3].chordRoot).toBe('RexSo');
      expect(onsets[3].chordMidi).toEqual([50, 55, 59]);
    });

    it('throws when harmony starts with a repeat number', () => {
      const coil: Coil = {
        id: 'test',
        melody: ['Do', 'Re'],
        harmony: [2, 'So'],
      };
      expect(() => resolveCoil(coil, knotC4)).toThrow(/Harmony array cannot start with a repeat padding number/);
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

    it('resolves fine-grained Solfège rhythm array into exact onset durations', () => {
      const coil: Coil = {
        id: 'test',
        rhythm: ['Do', 'Me', 'Fi', 'La'],
        melody: ['Do', 'Re', 'Me', 'Fa'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets[0].rhythmToken).toBe('Do');
      expect(onsets[0].durationBeats).toBeCloseTo(0.25);
      expect(onsets[0].duration).toBe('16');

      expect(onsets[3].rhythmToken).toBe('La');
      expect(onsets[3].durationBeats).toBeCloseTo(0.25);
      expect(onsets[3].duration).toBe('16');
    });

    it('resolves Solfège rhythm array with repeat numbers', () => {
      const coil: Coil = {
        id: 'test',
        rhythm: ['Do', 2, 'Fi'],
        melody: ['Do', 'Re', 'Me', 'Fa'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets[0].rhythmToken).toBe('Do');
      expect(onsets[1].rhythmToken).toBe('Do');
      expect(onsets[2].rhythmToken).toBe('Do');
      expect(onsets[3].rhythmToken).toBe('Fi');
    });

    it('allows rhythm layer to extend past melody length, creating rests for trailing onsets', () => {
      const coil: Coil = {
        id: 'test',
        rhythm: ['Do', 'Fi', 'Do', 'Fi'],
        melody: ['Do', 'Re'],
        harmony: ['Do', 1, 'So', 1],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets[0].isRest).toBe(false);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[1].isRest).toBe(false);
      expect(onsets[1].scaleDegree).toBe('Re');
      expect(onsets[2].isRest).toBe(true);
      expect(onsets[2].scaleDegree).toBe('');
      expect(onsets[3].isRest).toBe(true);
      expect(onsets[3].scaleDegree).toBe('');
      // Harmony continues across the rests
      expect(onsets[2].chordRoot).toBe('So');
      expect(onsets[3].chordRoot).toBe('So');
    });

    it('preserves compound delayed rhythm token (e.g. DoxDo) directly on first melody onset', () => {
      const coil: Coil = {
        id: 'test',
        rhythm: ['DoxDo', 'Fi', 'Do', 1],
        melody: ['Re', 'Mi'],
        harmony: ['So', 3],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      // 2 melody notes + 2 trailing rests = 4 onsets
      expect(onsets).toHaveLength(4);

      // First melody note starts at beat 1.0 with DoxDo rhythm token
      expect(onsets[0].isRest).toBe(false);
      expect(onsets[0].scaleDegree).toBe('Re');
      expect(onsets[0].rhythmToken).toBe('DoxDo');
      expect(onsets[0].startBeat).toBe(1.0);
      expect(onsets[0].durationBeats).toBe(0.5);
      expect(onsets[0].duration).toBe('8');

      // Second melody note at beat 1.5
      expect(onsets[1].isRest).toBe(false);
      expect(onsets[1].scaleDegree).toBe('Mi');
      expect(onsets[1].rhythmToken).toBe('Fi');
      expect(onsets[1].startBeat).toBe(1.5);

      // Trailing rests
      expect(onsets[2].isRest).toBe(true);
      expect(onsets[3].isRest).toBe(true);
    });
  });

  describe('polymorphic melody and harmony', () => {
    it('resolves structured single voice with dedicated rhythm and structured harmony', () => {
      const coil: Coil = {
        id: 'structured_test',
        melody: {
          pitches: ['Dox', 'Do', 'Me', 'La'],
          rhythm: ['Do', 'Me', 'Fi', 'La'],
        },
        harmony: {
          chords: ['DoMe', 'Fa'],
          rhythm: ['Do', 'Do'],
          harmonyOctave: -1,
        },
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);
      expect(onsets[0].voiceIndex).toBe(1);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[0].rhythmToken).toBe('Do');
      expect(onsets[0].chordRoot).toBe('DoMe');
      // Bass octave shift
      expect(onsets[0].chordMidi[0]).toBe(48); // C3 instead of C4 (60 - 12)
    });

    it('resolves polyphonic multi-voice coil with array of arrays', () => {
      const coil: Coil = {
        id: 'poly_test',
        melody: [
          ['Dox', 'Do', 'Me', 'La'],
          ['Mex', 'Me', 'So', 'Do^'],
        ],
        rhythm: ['Do', 'Me', 'Fi', 'La'],
        harmony: ['DoMe'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      // 4 onsets in voice 1 + 4 onsets in voice 2 = 8 onsets
      expect(onsets).toHaveLength(8);

      const v1 = onsets.filter(o => o.voiceIndex === 1);
      const v2 = onsets.filter(o => o.voiceIndex === 2);
      expect(v1).toHaveLength(4);
      expect(v2).toHaveLength(4);

      expect(v1[0].scaleDegree).toBe('Do');
      expect(v2[0].scaleDegree).toBe('Me');
      expect(v1[0].sourceOnsetIndex).toBe(1);
      expect(v2[0].sourceOnsetIndex).toBe(1);
    });

    it('resolves polyphonic multi-voice coil with independent voice rhythms', () => {
      const coil: Coil = {
        id: 'poly_rhythm_test',
        melody: [
          { pitches: ['Dox', 'Do', 'Me', 'La'], rhythm: ['Do', 'Me', 'Fi', 'La'] },
          { pitches: ['Mex', 'So'], rhythm: ['Do', 'Do'] },
        ],
        harmony: ['DoMe'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(6);

      const v1 = onsets.filter(o => o.voiceIndex === 1);
      const v2 = onsets.filter(o => o.voiceIndex === 2);
      expect(v1).toHaveLength(4);
      expect(v2).toHaveLength(2);
      expect(v2[0].rhythmToken).toBe('Do');
      expect(v2[1].rhythmToken).toBe('Do');
    });

    it('aligns harmonic rhythm [Do, DoxDo, Do] to beats 1, 3, and 4 across 8th-note melody', () => {
      const coil: Coil = {
        id: 'harmonic_rhythm_test',
        melody: ['Dox', 'Do', 'So^', 'Do', 'Re', 'Do', 'Te'],
        rhythm: ['Do', 'Fi', 2.2, 'Do'],
        harmony: {
          chords: ['Do', 'Fa', 'Do'],
          rhythm: ['Do', 'DoxDo', 'Do'],
        },
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(7);
      // Onsets 0, 1, 2, 3 (beats 0.0, 0.5, 1.0, 1.5) belong to first chord 'Do' (beats 1 & 2)
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordRoot).toBe('Do');
      expect(onsets[2].chordRoot).toBe('Do');
      expect(onsets[3].chordRoot).toBe('Do');

      // Onsets 4, 5 (beats 2.0, 2.5) belong to second chord 'Fa' (beat 3)
      expect(onsets[4].chordRoot).toBe('Fa');
      expect(onsets[5].chordRoot).toBe('Fa');

      // Onset 6 (beat 3.0) belongs to third chord 'Do' (beat 4)
      expect(onsets[6].chordRoot).toBe('Do');
    });

    it('does not apply coil-level rhythm to standard harmony array, preserving stretch logic', () => {
      const coil: Coil = {
        id: 'standard_harmony_with_rhythm',
        melody: ['Fax', 'Do', 'Ti', 'Do', 'Te', 'Do', 'Te'],
        rhythm: ['Do', 'Fi', 2.2, 'Do'],
        harmony: ['Fa', 'Do', 'So^', 'Do'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(7);
      // 4 chords stretched across 7 onsets (onsetsPerChord = ceil(7/4) = 2)
      // Onsets 0, 1 -> Fa
      expect(onsets[0].chordRoot).toBe('Fa');
      expect(onsets[1].chordRoot).toBe('Fa');
      // Onsets 2, 3 -> Do
      expect(onsets[2].chordRoot).toBe('Do');
      expect(onsets[3].chordRoot).toBe('Do');
      // Onsets 4, 5 -> So^
      expect(onsets[4].chordRoot).toBe('So^');
      expect(onsets[5].chordRoot).toBe('So^');
      // Onset 6 -> Do
      expect(onsets[6].chordRoot).toBe('Do');
    });
  });

  describe('default layer expansions (composing from any layer)', () => {
    it('resolves harmony-only coil with default 4-beat pulse downbeats and melody matching chord roots', () => {
      const coil: Coil = {
        id: 'harmony_only',
        harmony: ['Do', 'Fa', 'So', 'Do'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);

      // Onset 0: Do (whole note / 4 beats)
      expect(onsets[0].startBeat).toBe(0);
      expect(onsets[0].durationBeats).toBe(4);
      expect(onsets[0].duration).toBe('1');
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[0].melodyMidi).toBe(60); // C4
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[0].chordMidi).toEqual([60, 64, 67]);

      // Onset 1: Fa (beat 4)
      expect(onsets[1].startBeat).toBe(4);
      expect(onsets[1].durationBeats).toBe(4);
      expect(onsets[1].scaleDegree).toBe('Fa');
      expect(onsets[1].melodyMidi).toBe(65); // F4
      expect(onsets[1].chordRoot).toBe('Fa');

      // Onset 2: So (beat 8)
      expect(onsets[2].startBeat).toBe(8);
      expect(onsets[2].durationBeats).toBe(4);
      expect(onsets[2].scaleDegree).toBe('So');
      expect(onsets[2].melodyMidi).toBe(55); // G3
      expect(onsets[2].chordRoot).toBe('So');

      // Onset 3: Do (beat 12)
      expect(onsets[3].startBeat).toBe(12);
      expect(onsets[3].durationBeats).toBe(4);
      expect(onsets[3].scaleDegree).toBe('Do');
      expect(onsets[3].melodyMidi).toBe(60); // C4
      expect(onsets[3].chordRoot).toBe('Do');
    });

    it('resolves harmony-only coil with custom 3-beat pulse (DoRe)', () => {
      const knot34: ResolvedKnot = { doMidi: 60, tempo: 120, pulse: 'DoRe' };
      const coil: Coil = {
        id: 'harmony_34',
        harmony: ['Do', 'Fa'],
      };
      const { onsets } = resolveCoil(coil, knot34);
      expect(onsets).toHaveLength(2);
      expect(onsets[0].startBeat).toBe(0);
      expect(onsets[0].durationBeats).toBe(3);
      expect(onsets[0].duration).toBe('2.');
      expect(onsets[0].scaleDegree).toBe('Do');

      expect(onsets[1].startBeat).toBe(3);
      expect(onsets[1].durationBeats).toBe(3);
      expect(onsets[1].duration).toBe('2.');
      expect(onsets[1].scaleDegree).toBe('Fa');
    });

    it('resolves harmony-only coil with its own explicit rhythm layer', () => {
      const coil: Coil = {
        id: 'harmony_with_own_rhythm',
        harmony: {
          chords: ['Do', 'Fa'],
          rhythm: ['Do', 'DoxDo'], // Do at beat 0 (lasts 2 beats), Fa at beat 2 (lasts 2 beats)
        },
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(2);
      expect(onsets[0].startBeat).toBe(0);
      expect(onsets[0].durationBeats).toBe(2);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[0].chordRoot).toBe('Do');

      expect(onsets[1].startBeat).toBe(2);
      expect(onsets[1].durationBeats).toBe(1);
      expect(onsets[1].scaleDegree).toBe('Fa');
      expect(onsets[1].chordRoot).toBe('Fa');
    });

    it('resolves rhythm-only coil defaulting harmony to tonic Do and melody to Do', () => {
      const coil: Coil = {
        id: 'rhythm_only',
        rhythm: ['Do', 'Fi', 'Dox', 'Do'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);

      // Onset 0: Do (beat 0)
      expect(onsets[0].isRest).toBe(false);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[0].melodyMidi).toBe(60);
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[0].startBeat).toBe(0);
      expect(onsets[0].durationBeats).toBe(0.5);

      // Onset 1: Fi (beat 0.5)
      expect(onsets[1].isRest).toBe(false);
      expect(onsets[1].scaleDegree).toBe('Do');
      expect(onsets[1].melodyMidi).toBe(60);
      expect(onsets[1].chordRoot).toBe('Do');
      expect(onsets[1].startBeat).toBe(0.5);
      expect(onsets[1].durationBeats).toBe(0.5);

      // Onset 2: Dox (beat 1.0, rest)
      expect(onsets[2].isRest).toBe(true);
      expect(onsets[2].scaleDegree).toBe('');
      expect(onsets[2].startBeat).toBe(1.0);
      expect(onsets[2].durationBeats).toBe(1.0);

      // Onset 3: Do (beat 2.0)
      expect(onsets[3].isRest).toBe(false);
      expect(onsets[3].scaleDegree).toBe('Do');
      expect(onsets[3].melodyMidi).toBe(60);
      expect(onsets[3].startBeat).toBe(2.0);
    });

    it('resolves rhythm + harmony coil with strumming pattern and multi-measure chord progression', () => {
      // 8 beats of 8th notes across 2 measures of 4/4 (DoLa):
      // Measure 1 (beats 0..4): Do chord
      // Measure 2 (beats 4..8): Fa chord
      const coil: Coil = {
        id: 'rhythm_and_harmony_strum',
        rhythm: ['Do', 'Fi', 7.2], // 8 beats total = 16 eighth notes
        harmony: ['Do', 'Fa'],     // Pulse is DoLa (4 beats per chord)
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(16);

      // First 8 eighth notes (beats 0 to 3.5) belong to 'Do' chord
      for (let i = 0; i < 8; i++) {
        expect(onsets[i].chordRoot).toBe('Do');
        expect(onsets[i].scaleDegree).toBe('Do');
        expect(onsets[i].melodyMidi).toBe(60);
        expect(onsets[i].startBeat).toBe(i * 0.5);
      }

      // Second 8 eighth notes (beats 4.0 to 7.5) belong to 'Fa' chord
      for (let i = 8; i < 16; i++) {
        expect(onsets[i].chordRoot).toBe('Fa');
        expect(onsets[i].scaleDegree).toBe('Fa');
        expect(onsets[i].melodyMidi).toBe(65);
        expect(onsets[i].startBeat).toBe(i * 0.5);
      }
    });

    it('resolves rhythm + harmony with explicit harmony rhythm', () => {
      const coil: Coil = {
        id: 'rhythm_and_harmony_custom_change',
        rhythm: ['Do', 'Fi', 3.2], // 4 beats = 8 eighth notes
        harmony: {
          chords: ['Do', 'So'],
          rhythm: ['Do', 'DoxDoxDo'], // Do chord at beat 0, So chord at beat 3
        },
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(8);

      // Beats 0.0, 0.5, 1.0, 1.5, 2.0, 2.5 belong to Do chord
      for (let i = 0; i < 6; i++) {
        expect(onsets[i].chordRoot).toBe('Do');
        expect(onsets[i].scaleDegree).toBe('Do');
      }

      // Beats 3.0, 3.5 belong to So chord
      for (let i = 6; i < 8; i++) {
        expect(onsets[i].chordRoot).toBe('So');
        expect(onsets[i].scaleDegree).toBe('So');
      }
    });

    it('suppresses implicit melody when melody: [] is explicitly defined on harmony coil', () => {
      const coil: Coil = {
        id: 'changes_only',
        melody: [],
        harmony: ['Do', 'Fa', 'So', 'Do'],
      };
      const { onsets } = resolveCoil(coil, knotC4);
      expect(onsets).toHaveLength(4);

      for (let i = 0; i < 4; i++) {
        expect(onsets[i].isRest).toBe(true);
        expect(onsets[i].scaleDegree).toBe('');
        expect(onsets[i].melodyMidi).toBe(0);
        expect(onsets[i].melodyOnsetIndex).toBeUndefined();
      }
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordRoot).toBe('Fa');
      expect(onsets[2].chordRoot).toBe('So');
      expect(onsets[3].chordRoot).toBe('Do');
    });

    it('throws when no layers are defined anywhere on the coil', () => {
      const emptyCoil: Coil = {
        id: 'empty_coil',
      };
      expect(() => resolveCoil(emptyCoil, knotC4)).toThrow(
        /at least one layer \(melody, harmony, or rhythm\) must be defined/
      );
    });
  });
});
