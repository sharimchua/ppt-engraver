import { describe, it, expect } from 'vitest';
import { applyModulation, deriveModulatedKnot, type ResolvedKnot } from '../../src/solfege/pitch.js';
import { resolveTapestry } from '../../src/resolver/graph.js';
import { compileToLilyPond } from '../../src/lilypond/compiler.js';
import type { Tapestry } from '../../src/schema/tapestry.js';

describe('Tonic Modulation Subsystem', () => {
  describe('applyModulation()', () => {
    it('modulates G4 by Fa to C5 (+5 semitones)', () => {
      const result = applyModulation(67, 'sharps', 'Fa');
      expect(result.semitones).toBe(5);
      expect(result.tonicMidi).toBe(72);
      expect(result.tonicName).toBe('C5');
    });

    it('modulates C5 by So back to G4 (-5 semitones nearest address)', () => {
      const result = applyModulation(72, 'sharps', 'So');
      expect(result.semitones).toBe(-5);
      expect(result.tonicMidi).toBe(67);
      expect(result.tonicName).toBe('G4');
    });

    it('supports downward octave prefix _Fa (-7 semitones)', () => {
      const result = applyModulation(67, 'sharps', '_Fa');
      expect(result.semitones).toBe(-7);
      expect(result.tonicMidi).toBe(60);
      expect(result.tonicName).toBe('C4');
    });

    it('supports upward octave prefix ^So (+7 semitones)', () => {
      const result = applyModulation(60, 'sharps', '^So');
      expect(result.semitones).toBe(7);
      expect(result.tonicMidi).toBe(67);
      expect(result.tonicName).toBe('G4');
    });

    it('infers flat accidental mode for flat-side solfege degrees', () => {
      const result = applyModulation(60, 'sharps', 'Me');
      expect(result.semitones).toBe(3);
      expect(result.tonicMidi).toBe(63);
      expect(result.accidentalMode).toBe('flats');
      expect(result.tonicName).toBe('Eb4');
    });

    it('infers sharp accidental mode for sharp-side solfege degrees', () => {
      const result = applyModulation(60, 'flats', 'Fi');
      expect(result.semitones).toBe(6);
      expect(result.tonicMidi).toBe(66);
      expect(result.accidentalMode).toBe('sharps');
      expect(result.tonicName).toBe('F#4');
    });

    it('supports direct semitone integers', () => {
      const result = applyModulation(60, 'sharps', 5);
      expect(result.semitones).toBe(5);
      expect(result.tonicMidi).toBe(65);
      expect(result.tonicName).toBe('F4');
    });
  });

  describe('deriveModulatedKnot()', () => {
    const baseKnot: ResolvedKnot = {
      id: 'test',
      name: 'Test Knot',
      doMidi: 67,
      tonicMidi: 67,
      doName: 'G4',
      tonicName: 'G4',
      tempo: 120,
      accidentalMode: 'sharps',
    };

    it('returns baseKnot if no modulation or tonic override is provided', () => {
      const derived = deriveModulatedKnot(baseKnot);
      expect(derived).toBe(baseKnot);
    });

    it('derives modulated knot from Solfège interval', () => {
      const derived = deriveModulatedKnot(baseKnot, 'Fa');
      expect(derived.tonicMidi).toBe(72);
      expect(derived.doMidi).toBe(72);
      expect(derived.tonicName).toBe('C5');
      expect(derived.doName).toBe('C5');
    });

    it('derives knot from absolute tonic override', () => {
      const derived = deriveModulatedKnot(baseKnot, undefined, 'Eb4');
      expect(derived.tonicMidi).toBe(63);
      expect(derived.tonicName).toBe('Eb4');
      expect(derived.accidentalMode).toBe('flats');
    });
  });

  describe('Weave-level Sequential Modulation Resolution', () => {
    it('shifts tonic from G to C via Fa, and back to G via So across sequential weaves', () => {
      const tapestry: Tapestry = {
        tapestry: {
          knot: {
            tonic: 'G4',
            weave: 'song',
          },
          weaves: {
            intro: {
              stitch: [
                {
                  coil: {
                    melody: ['Do'], // In G: G4
                    harmony: ['Do'], // In G: G major
                  },
                },
              ],
            },
            verse: {
              modulate: 'Fa', // G4 + Fa -> C5
              stitch: [
                {
                  coil: {
                    melody: ['So'], // In C: So is G5 (7 semitones above C5) or 79
                    harmony: ['Do'], // In C: C major
                  },
                },
              ],
            },
            chorus: {
              modulate: 'So', // C5 + So (-5 st) -> G4
              stitch: [
                {
                  coil: {
                    melody: ['So'], // In G: So is D5 (7 semitones above G4) or 74
                    harmony: ['Do'], // In G: G major
                  },
                },
              ],
            },
            song: {
              stitch: [
                { weave: 'intro' },
                { weave: 'verse' },
                { weave: 'chorus' },
              ],
            },
          },
        },
      };

      const result = resolveTapestry(tapestry);
      const onsets = result.onsets;

      expect(onsets).toHaveLength(3);

      // 1. Intro onset (Tonic: G4)
      expect(onsets[0].weaveId).toBe('intro');
      expect(onsets[0].tonic).toBe('G4');
      expect(onsets[0].tonicMidi).toBe(67);
      expect(onsets[0].scaleDegree).toBe('Do');
      expect(onsets[0].pitch).toBe('G4');
      expect(onsets[0].midiNote).toBe(67);
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[0].chordTones).toEqual(['G4', 'B4', 'D5']);

      // 2. Verse onset (Tonic: C5 modulated via Fa)
      expect(onsets[1].weaveId).toBe('verse');
      expect(onsets[1].tonic).toBe('C5');
      expect(onsets[1].tonicMidi).toBe(72);
      expect(onsets[1].scaleDegree).toBe('So');
      // In C5: So has nearest address -5 (72 - 5 = 67, G4)
      expect(onsets[1].pitch).toBe('G4');
      expect(onsets[1].midiNote).toBe(67);
      expect(onsets[1].chordRoot).toBe('Do');
      // In C5: Do triad is C, E, G
      expect(onsets[1].chordTones).toEqual(['C5', 'E5', 'G5']);

      // 3. Chorus onset (Tonic: G4 modulated back via So)
      expect(onsets[2].weaveId).toBe('chorus');
      expect(onsets[2].tonic).toBe('G4');
      expect(onsets[2].tonicMidi).toBe(67);
      expect(onsets[2].scaleDegree).toBe('So');
      // In G4: So has nearest address -5 (67 - 5 = 62, D4)
      expect(onsets[2].pitch).toBe('D4');
      expect(onsets[2].midiNote).toBe(62);
      expect(onsets[2].chordRoot).toBe('Do');
      expect(onsets[2].chordTones).toEqual(['G4', 'B4', 'D5']);
    });

    it('supports stitch-level modulate attribute', () => {
      const tapestry: Tapestry = {
        tapestry: {
          knot: {
            tonic: 'C4',
            weave: 'song',
          },
          weaves: {
            partA: {
              stitch: [
                { coil: { melody: ['Do'] } },
              ],
            },
            partB: {
              stitch: [
                { coil: { melody: ['Do'] } },
              ],
            },
            song: {
              stitch: [
                { weave: 'partA' },
                { weave: 'partB', modulate: 'Re' }, // C4 + 2 semitones = D4
              ],
            },
          },
        },
      };

      const result = resolveTapestry(tapestry);
      expect(result.onsets[0].tonic).toBe('C4');
      expect(result.onsets[0].pitch).toBe('C4');
      expect(result.onsets[1].tonic).toBe('D4');
      expect(result.onsets[1].pitch).toBe('D4');
    });

    it('keeps parallel weaves isolated from sibling modulations', () => {
      const tapestry: Tapestry = {
        tapestry: {
          knot: {
            tonic: 'G4',
            weave: 'poly',
          },
          weaves: {
            voice1: {
              modulate: 'Fa', // Should only affect voice 1
              stitch: [{ coil: { melody: ['Do'] } }],
            },
            voice2: {
              stitch: [{ coil: { melody: ['Do'] } }],
            },
            poly: {
              layout: 'parallel',
              stitch: [
                { weave: 'voice1' },
                { weave: 'voice2' },
              ],
            },
          },
        },
      };

      const result = resolveTapestry(tapestry);
      const v1Onset = result.onsets.find(o => o.weaveId === 'voice1');
      const v2Onset = result.onsets.find(o => o.weaveId === 'voice2');

      expect(v1Onset?.tonic).toBe('C5');
      expect(v2Onset?.tonic).toBe('G4');
    });
  });

  describe('LilyPond Key Signatures & Chord Rendering with Modulation', () => {
    it('emits in-place \\key changes when tonic modulates mid-score with showKeySignature', () => {
      const tapestry: Tapestry = {
        tapestry: {
          knot: {
            tonic: 'G4',
            weave: 'song',
            engraving: {
              show: ['keySignature', 'melody', 'chordNames'],
            },
          },
          weaves: {
            sectionG: {
              stitch: [{ coil: { melody: ['Do'], harmony: ['Do'] } }],
            },
            sectionC: {
              modulate: 'Fa',
              stitch: [{ coil: { melody: ['Do'], harmony: ['Do'] } }],
            },
            song: {
              stitch: [
                { weave: 'sectionG' },
                { weave: 'sectionC' },
              ],
            },
          },
        },
      };

      const { onsets } = resolveTapestry(tapestry);
      const ly = compileToLilyPond(onsets, {
        doPitch: 'G4',
        showKeySignature: true,
        showChordNames: true,
      });

      // Initial key is G major
      expect(ly).toContain('\\key g \\major');
      // Section boundary emits key change to C major
      expect(ly).toContain('\\key c \\major');
    });

    it('evaluates chord names relative to modulated tonics', () => {
      const tapestry: Tapestry = {
        tapestry: {
          knot: {
            tonic: 'G4',
            weave: 'song',
            engraving: {
              show: ['chordNames'],
            },
          },
          weaves: {
            verse: {
              stitch: [{ coil: { harmony: ['Do'] } }], // G Major
            },
            chorus: {
              modulate: 'Fa',
              stitch: [{ coil: { harmony: ['Do'] } }], // C Major
            },
            song: {
              stitch: [
                { weave: 'verse' },
                { weave: 'chorus' },
              ],
            },
          },
        },
      };

      const { onsets } = resolveTapestry(tapestry);
      const ly = compileToLilyPond(onsets, {
        doPitch: 'G4',
        showChordNames: true,
      });

      // In verse: Do relative to G4 is G major -> <g' b' d''>
      // In chorus: Do relative to C5 is C major -> <c' e' g'>
      expect(ly).toContain("chordName_1 <g' b' d''>1");
      expect(ly).toContain("chordName_1 <c' e' g'>1");
    });
  });
});
