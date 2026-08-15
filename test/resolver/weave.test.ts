import { describe, it, expect } from 'vitest';
import { resolveWeave } from '../../src/resolver/weave.js';
import type { Weave } from '../../src/schema/tapestry.js';
import type { ResolvedKnot } from '../../src/solfege/pitch.js';

const knotC4: ResolvedKnot = { doMidi: 60, tempo: 120 };

describe('resolveWeave', () => {
  it('concatenates coils in order', () => {
    const weave: Weave = {
      id: 'verse',
      layout: 'concatenate',
      children: [
        { coil: { id: 'first', melody: ['Do', 'Re'] } },
        { coil: { id: 'second', melody: ['Mi', 'Fa'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets).toHaveLength(4);
    // First coil onsets
    expect(onsets[0].coilId).toBe('first');
    expect(onsets[1].coilId).toBe('first');
    // Second coil onsets
    expect(onsets[2].coilId).toBe('second');
    expect(onsets[3].coilId).toBe('second');
  });

  it('generates correct provenance tags', () => {
    const weave: Weave = {
      id: 'verse',
      layout: 'concatenate',
      children: [
        { coil: { id: 'introMotif', melody: ['Do', 'Mi'] } },
        { coil: { id: 'cadence', melody: ['Ti'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets[0].tag).toBe('ppt_verse_introMotif_1');
    expect(onsets[1].tag).toBe('ppt_verse_introMotif_2');
    expect(onsets[2].tag).toBe('ppt_verse_cadence_1');
  });

  it('uses 1-based onset indexing within each coil', () => {
    const weave: Weave = {
      id: 'test',
      layout: 'concatenate',
      children: [
        { coil: { id: 'a', melody: ['Do', 'Re', 'Mi'] } },
        { coil: { id: 'b', melody: ['Fa', 'So'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets[0].onsetIndex).toBe(1);
    expect(onsets[1].onsetIndex).toBe(2);
    expect(onsets[2].onsetIndex).toBe(3);
    // Second coil resets to 1
    expect(onsets[3].onsetIndex).toBe(1);
    expect(onsets[4].onsetIndex).toBe(2);
  });

  it('populates pitch names and MIDI in output', () => {
    const weave: Weave = {
      id: 'test',
      layout: 'concatenate',
      children: [
        { coil: { id: 'motif', melody: ['Do', 'Mi'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets[0].pitch).toBe('C4');
    expect(onsets[0].midiNote).toBe(60);
    expect(onsets[1].pitch).toBe('E4');
    expect(onsets[1].midiNote).toBe(64);
  });
});
