import { describe, it, expect } from 'vitest';
import { generateSidecarMap } from '../../src/sidecar/map.js';
import type { OnsetStream } from '../../src/schema/onset.js';

describe('generateSidecarMap', () => {
  const sampleOnsets: OnsetStream = [
    {
      tag: 'ppt_verse_introMotif_1',
      pitch: 'C4',
      midiNote: 60,
      scaleDegree: 'Do',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'introMotif',
      weaveId: 'verse',
      onsetIndex: 1,
    },
  ];

  it('generates an expectation map keyed by tag', () => {
    const map = generateSidecarMap(sampleOnsets);
    const entry = map['ppt_verse_introMotif_1'];
    expect(entry).toBeDefined();
    expect(entry.tag).toBe('ppt_verse_introMotif_1');
    expect(entry.weaveId).toBe('verse');
    expect(entry.coilId).toBe('introMotif');
    expect(entry.onsetIndex).toBe(1);

    // Melody expectations
    expect(entry.melody.scaleDegree).toBe('Do');
    expect(entry.melody.pitch).toBe('C4');
    expect(entry.melody.midiNote).toBe(60);

    // Harmony expectations
    expect(entry.harmony.root).toBe('Do');
    expect(entry.harmony.quality).toBe('major');
    expect(entry.harmony.chordTones).toEqual(['C4', 'E4', 'G4']);
    expect(entry.harmony.chordMidi).toEqual([60, 64, 67]);
  });
});
