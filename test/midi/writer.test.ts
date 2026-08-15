import { describe, it, expect } from 'vitest';
import { createMidiBuffer } from '../../src/midi/writer.js';
import type { OnsetStream } from '../../src/schema/onset.js';

describe('MIDI writer', () => {
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
    {
      tag: 'ppt_verse_introMotif_2',
      pitch: 'E4',
      midiNote: 64,
      scaleDegree: 'Mi',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'introMotif',
      weaveId: 'verse',
      onsetIndex: 2,
    },
  ];

  it('generates a valid Standard MIDI File buffer (Format 1)', () => {
    const bytes = createMidiBuffer(sampleOnsets, { tempo: 120 });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(30);

    // Check Header "MThd"
    const headerTag = String.fromCharCode(...bytes.slice(0, 4));
    expect(headerTag).toBe('MThd');

    // Header length should be 6
    expect(bytes[4]).toBe(0);
    expect(bytes[5]).toBe(0);
    expect(bytes[6]).toBe(0);
    expect(bytes[7]).toBe(6);

    // Format = 1 (bytes 8-9)
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(1);

    // Num tracks = 3 (bytes 10-11: Tempo, Melody, Harmony)
    expect(bytes[10]).toBe(0);
    expect(bytes[11]).toBe(3);

    // Check that track chunks exist
    const trk1Tag = String.fromCharCode(...bytes.slice(14, 18));
    expect(trk1Tag).toBe('MTrk');
  });

  it('handles empty onset stream gracefully', () => {
    const bytes = createMidiBuffer([], { tempo: 120 });
    const headerTag = String.fromCharCode(...bytes.slice(0, 4));
    expect(headerTag).toBe('MThd');
  });
});
