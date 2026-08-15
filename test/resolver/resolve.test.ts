import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolveFile, resolveYaml } from '../../src/resolver/resolve.js';

const FIXTURES = resolve(import.meta.dirname, '..', 'fixtures');

describe('end-to-end resolution', () => {
  describe('§6.2 worked example', () => {
    it('produces the exact onset stream from the design document', () => {
      const { onsets, warnings } = resolveFile(
        resolve(FIXTURES, 'design-doc-example.ppt.yaml')
      );

      expect(warnings).toHaveLength(0);
      expect(onsets).toHaveLength(6);

      // Onset 1: intro-motif, Do → C4, harmony Do (C-E-G)
      expect(onsets[0]).toMatchObject({
        tag: 'ppt_verse_introMotif_1',
        pitch: 'C4',
        midiNote: 60,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        chordRoot: 'Do',
        coilId: 'introMotif',
        weaveId: 'verse',
        onsetIndex: 1,
      });

      // Onset 2: intro-motif, Mi → E4
      expect(onsets[1]).toMatchObject({
        tag: 'ppt_verse_introMotif_2',
        pitch: 'E4',
        midiNote: 64,
        scaleDegree: 'Mi',
        chordTones: ['C4', 'E4', 'G4'],
        coilId: 'introMotif',
        onsetIndex: 2,
      });

      // Onset 3: intro-motif, So → G4
      expect(onsets[2]).toMatchObject({
        tag: 'ppt_verse_introMotif_3',
        pitch: 'G4',
        midiNote: 67,
        scaleDegree: 'So',
        chordTones: ['C4', 'E4', 'G4'],
        coilId: 'introMotif',
        onsetIndex: 3,
      });

      // Onset 4: intro-motif, Do^ → C5
      expect(onsets[3]).toMatchObject({
        tag: 'ppt_verse_introMotif_4',
        pitch: 'C5',
        midiNote: 72,
        scaleDegree: 'Do',
        chordTones: ['C4', 'E4', 'G4'],
        coilId: 'introMotif',
        onsetIndex: 4,
      });

      // Onset 5: cadence, Ti → B4, harmony So (G-B-D)
      expect(onsets[4]).toMatchObject({
        tag: 'ppt_verse_cadence_1',
        pitch: 'B4',
        midiNote: 71,
        scaleDegree: 'Ti',
        chordTones: ['G4', 'B4', 'D5'],
        chordRoot: 'So',
        coilId: 'cadence',
        onsetIndex: 1,
      });

      // Onset 6: cadence, Do^ → C5
      expect(onsets[5]).toMatchObject({
        tag: 'ppt_verse_cadence_2',
        pitch: 'C5',
        midiNote: 72,
        scaleDegree: 'Do',
        chordTones: ['G4', 'B4', 'D5'],
        chordRoot: 'So',
        coilId: 'cadence',
        onsetIndex: 2,
      });
    });
  });

  describe('simple melody (no harmony, no rhythm)', () => {
    it('resolves with default harmony', () => {
      const { onsets } = resolveFile(
        resolve(FIXTURES, 'simple-melody.ppt.yaml')
      );
      expect(onsets).toHaveLength(3);
      expect(onsets[0].pitch).toBe('C4');
      expect(onsets[1].pitch).toBe('D4');
      expect(onsets[2].pitch).toBe('E4');
      // Default harmony: Do major triad
      expect(onsets[0].chordTones).toEqual(['C4', 'E4', 'G4']);
    });
  });

  describe('cross-layer alignment', () => {
    it('distributes 2 chords across 4 melody notes', () => {
      const { onsets } = resolveFile(
        resolve(FIXTURES, 'melody-harmony.ppt.yaml')
      );
      expect(onsets).toHaveLength(4);
      // First 2 onsets: Do chord
      expect(onsets[0].chordRoot).toBe('Do');
      expect(onsets[1].chordRoot).toBe('Do');
      // Last 2 onsets: So chord
      expect(onsets[2].chordRoot).toBe('So');
      expect(onsets[3].chordRoot).toBe('So');
    });
  });

  describe('no knot fallback', () => {
    it('resolves with default C4 and emits warning', () => {
      const { onsets, warnings } = resolveFile(
        resolve(FIXTURES, 'no-knot.ppt.yaml')
      );
      expect(onsets).toHaveLength(3);
      expect(onsets[0].pitch).toBe('C4'); // Default Do = C4
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('No Knot defined'))).toBe(true);
    });
  });

  describe('interval mode melody', () => {
    it('resolves interval offsets from axis anchor', () => {
      const { onsets } = resolveFile(
        resolve(FIXTURES, 'interval-melody.ppt.yaml')
      );
      expect(onsets).toHaveLength(4);
      // Dox = C4 (60)
      expect(onsets[0].pitch).toBe('C4');
      // Re = +2 → D4 (62)
      expect(onsets[1].pitch).toBe('D4');
      // Mi = +4 → F#4 (66)
      expect(onsets[2].pitch).toBe('F#4');
      // Ti = -1 → F4 (65)
      expect(onsets[3].pitch).toBe('F4');
    });
  });

  describe('resolveYaml (string input)', () => {
    it('resolves inline YAML', () => {
      const yaml = `
tapestry:
  knot:
    do: C4
  weave:
    id: inline
    layout: concatenate
    children:
      - coil:
          id: test
          melody: [Do, "So^"]
`;
      const { onsets } = resolveYaml(yaml);
      expect(onsets).toHaveLength(2);
      expect(onsets[0].pitch).toBe('C4');
      expect(onsets[1].pitch).toBe('G4');

    });
  });
});
