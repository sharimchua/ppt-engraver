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

  it('supports composition with nested weaves for different song sections', () => {
    const songWeave: Weave = {
      id: 'song',
      layout: 'concatenate',
      children: [
        {
          weave: {
            id: 'verse',
            children: [
              { coil: { id: 'motif', melody: ['Do', 'Re'] } },
            ],
          },
        },
        {
          weave: {
            id: 'chorus',
            children: [
              { coil: { id: 'climax', melody: ['So', 'Do^'] } },
            ],
          },
        },
        { weave: 'verse' },  // Re-use verse section by ID
        { weave: 'chorus' }, // Re-use chorus section by ID
      ],
    };

    const { onsets } = resolveWeave(songWeave, knotC4);
    expect(onsets).toHaveLength(8);
    // Verse 1
    expect(onsets[0].tag).toBe('ppt_verse_motif_1');
    expect(onsets[1].tag).toBe('ppt_verse_motif_2');
    // Chorus 1
    expect(onsets[2].tag).toBe('ppt_chorus_climax_1');
    expect(onsets[3].tag).toBe('ppt_chorus_climax_2');
    // Verse 2 (re-used)
    expect(onsets[4].tag).toBe('ppt_verse_motif_1');
    expect(onsets[5].tag).toBe('ppt_verse_motif_2');
    // Chorus 2 (re-used)
    expect(onsets[6].tag).toBe('ppt_chorus_climax_1');
    expect(onsets[7].tag).toBe('ppt_chorus_climax_2');
  });

  it('detects circular weave references and throws an informative error', () => {
    const cyclicWeave: Weave = {
      id: 'A',
      children: [
        {
          weave: {
            id: 'B',
            children: [
              { weave: 'A' },
            ],
          },
        },
      ],
    };

    expect(() => resolveWeave(cyclicWeave, knotC4)).toThrow(
      'Circular weave reference detected: A -> B -> A'
    );
  });

  it('throws an informative error when referencing an unknown weave ID', () => {
    const brokenWeave: Weave = {
      id: 'song',
      children: [
        { weave: 'nonExistentSection' },
      ],
    };

    expect(() => resolveWeave(brokenWeave, knotC4)).toThrow(
      'Weave "song" child references unknown weave "nonExistentSection"'
    );
  });

  it('inherits defaultCoil down nested weave hierarchy', () => {
    const parentWeave: Weave = {
      id: 'song',
      defaultCoil: {
        id: 'default',
        harmony: ['So'],
      },
      children: [
        {
          weave: {
            id: 'verse',
            children: [
              { coil: { id: 'motif', melody: ['Do'] } },
            ],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(parentWeave, knotC4);
    expect(onsets[0].chordRoot).toBe('So');
  });
});

