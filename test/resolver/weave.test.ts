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
      stitch: [
        { weave: 'nonExistentSection' },
      ],
    };

    expect(() => resolveWeave(brokenWeave, knotC4)).toThrow(
      /references unknown weave "nonExistentSection"/
    );
  });

  it('resolves weaves declared with stitch: [...] syntax', () => {
    const weave: Weave = {
      id: 'verse',
      layout: 'concatenate',
      stitch: [
        { coil: { id: 'first', melody: ['Do', 'Re'] } },
        { coil: { id: 'second', melody: ['Mi', 'Fa'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].tag).toBe('ppt_verse_first_1');
    expect(onsets[2].tag).toBe('ppt_verse_second_1');
  });

  it('resolves weaves with layout: parallel merging separate melody and harmony coils', () => {
    const parallelWeave: Weave = {
      id: 'song',
      layout: 'parallel',
      stitch: [
        {
          coil: {
            id: 'melody_part',
            melody: ['Do', 'Me', 'So', 'Do^'],
            rhythm: ['Do', 'Fi', 'Do', 'Fi', 'Do', 'Fi', 'Do', 'Fi'], // 8 eighth notes across 4 beats
          },
        },
        {
          coil: {
            id: 'harmony_part',
            pulse: 'Do', // 1 beat per chord: beat 0 = Do, beat 1 = Fa, beat 2 = So, beat 3 = Do
            harmony: ['Do', 'Fa', 'So', 'Do'],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(parallelWeave, knotC4);
    expect(onsets).toHaveLength(8);

    // Check that melody onsets received chords from the parallel harmony coil at their timestamps
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[0].chordRoot).toBe('Do');

    expect(onsets[1].scaleDegree).toBe('Me');
    expect(onsets[1].chordRoot).toBe('Do');

    expect(onsets[2].scaleDegree).toBe('So');
    expect(onsets[2].chordRoot).toBe('Fa');

    expect(onsets[3].scaleDegree).toBe('Do');
    expect(onsets[3].chordRoot).toBe('Fa');

    expect(onsets[4].chordRoot).toBe('So');
    expect(onsets[6].chordRoot).toBe('Do');
  });

  it('resolves nested concatenated weaves stitched in parallel with harmony coils', () => {
    const parallelWeave: Weave = {
      id: 'song',
      layout: 'parallel',
      pulse: 'DoRe', // 3 beats per bar
      stitch: [
        {
          weave: {
            id: 'melody_section',
            layout: 'concatenate',
            stitch: [
              {
                coil: {
                  id: 'tune1',
                  melody: ['Do', 'Re', 'Mi'],
                  rhythm: ['Do', 'Do', 'Do'], // 3 beats: beats 0..3
                },
              },
              {
                coil: {
                  id: 'tune2',
                  melody: ['Fa', 'So', 'La'],
                  rhythm: ['Do', 'Do', 'Do'], // 3 beats: beats 3..6
                },
              },
            ],
          },
        },
        {
          coil: {
            id: 'changes',
            pulse: 'DoRe', // 3 beats per chord: beats 0, 3, 6, 9 -> total 12 beats
            harmony: ['Do', 'Fa', 'LaMe', 'So'],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(parallelWeave, knotC4);
    // tune1 (3 onsets) + tune2 (3 onsets) + 6 padded rest onsets for remaining 6 beats = 12 onsets
    expect(onsets).toHaveLength(12);

    // tune1 onsets (beats 0, 1, 2) match chord 1 'Do'
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[0].chordRoot).toBe('Do');
    expect(onsets[0].startBeat).toBe(0);

    expect(onsets[2].scaleDegree).toBe('Mi');
    expect(onsets[2].chordRoot).toBe('Do');
    expect(onsets[2].startBeat).toBe(2);

    // tune2 onsets (beats 3, 4, 5) match chord 2 'Fa'
    expect(onsets[3].scaleDegree).toBe('Fa');
    expect(onsets[3].chordRoot).toBe('Fa');
    expect(onsets[3].startBeat).toBe(3);

    expect(onsets[5].scaleDegree).toBe('La');
    expect(onsets[5].chordRoot).toBe('Fa');
    expect(onsets[5].startBeat).toBe(5);

    // Padded rest onsets at beats 6..8 match chord 3 'LaMe'
    expect(onsets[6].isRest).toBe(true);
    expect(onsets[6].chordRoot).toBe('LaMe');
    expect(onsets[6].startBeat).toBe(6);

    // Padded rest onsets at beats 9..11 match chord 4 'So'
    expect(onsets[9].isRest).toBe(true);
    expect(onsets[9].chordRoot).toBe('So');
    expect(onsets[9].startBeat).toBe(9);
  });

  it('resolves weaves with layout: parallel merging multiple melodic coils into polyphonic voices', () => {
    const polyphonicWeave: Weave = {
      id: 'poly_weave',
      layout: 'parallel',
      stitch: [
        {
          coil: {
            id: 'soprano',
            melody: ['Do', 'Re', 'Mi', 'Fa'],
            rhythm: ['Do', 'Do', 'Do', 'Do'],
          },
        },
        {
          coil: {
            id: 'bass',
            melody: ['Do_', 'So_', 'Do', 'Fa_'],
            rhythm: ['Do', 'Do', 'Do', 'Do'],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(polyphonicWeave, knotC4);
    expect(onsets).toHaveLength(8);

    // Voice 1 (soprano)
    const v1Onsets = onsets.filter(o => o.voiceIndex === 1);
    expect(v1Onsets).toHaveLength(4);
    expect(v1Onsets[0].tag).toBe('ppt_poly_weave_soprano_v1_1');
    expect(v1Onsets[0].scaleDegree).toBe('Do');

    // Voice 2 (bass)
    const v2Onsets = onsets.filter(o => o.voiceIndex === 2);
    expect(v2Onsets).toHaveLength(4);
    expect(v2Onsets[0].tag).toBe('ppt_poly_weave_bass_v2_1');
    expect(v2Onsets[0].scaleDegree).toBe('Do');
    expect(v2Onsets[0].pitch).toBe('C3');
  });

  it('resolves multiple melody coils (including stitch coils) merged in parallel with harmony', () => {
    const complexParallelWeave: Weave = {
      id: 'song',
      layout: 'parallel',
      pulse: 'DoRe',
      stitch: [
        {
          coil: {
            id: 'lead',
            melody: ['So^', 'Mi', 'So^'],
            rhythm: ['Do', 'Do', 'Do'],
          },
        },
        {
          coil: {
            id: 'counter',
            stitch: [
              {
                coil: {
                  melody: ['Do', 'Re', 'Mi'],
                  rhythm: ['Do', 'Do', 'Do'],
                },
              },
              {
                coil: {
                  melody: ['Fa', 'So', 'La'],
                  rhythm: ['Do', 'Do', 'Do'],
                },
              },
            ],
          },
        },
        {
          coil: {
            id: 'changes',
            pulse: 'DoRe',
            harmony: ['Do', 'Fa'],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(complexParallelWeave, knotC4);
    // Voice 1 (lead: 3 notes + 3 rests = 6 onsets)
    const v1Onsets = onsets.filter(o => o.voiceIndex === 1);
    expect(v1Onsets).toHaveLength(6);
    expect(v1Onsets[0].scaleDegree).toBe('So');
    expect(v1Onsets[0].chordRoot).toBe('Do');
    expect(v1Onsets[3].isRest).toBe(true);
    expect(v1Onsets[3].chordRoot).toBe('Fa');

    // Voice 2 (counter: 3 notes + 3 notes = 6 onsets)
    const v2Onsets = onsets.filter(o => o.voiceIndex === 2);
    expect(v2Onsets).toHaveLength(6);
    expect(v2Onsets[0].scaleDegree).toBe('Do');
    expect(v2Onsets[0].chordRoot).toBe('Do');
    expect(v2Onsets[3].scaleDegree).toBe('Fa');
    expect(v2Onsets[3].chordRoot).toBe('Fa');
  });

  it('inherits defaultCoil down nested weave hierarchy', () => {
    const parentWeave: Weave = {
      id: 'song',
      defaultCoil: {
        id: 'default',
        harmony: ['So'],
      },
      stitch: [
        {
          weave: {
            id: 'verse',
            stitch: [
              { coil: { id: 'motif', melody: ['Do'] } },
            ],
          },
        },
      ],
    };

    const { onsets } = resolveWeave(parentWeave, knotC4);
    expect(onsets[0].chordRoot).toBe('So');
  });

  it('cascades meter from Weave to child coils without explicit meter', () => {
    const weave: Weave = {
      id: 'song',
      meter: 'DoLa',
      stitch: [
        { coil: { id: 'motif', melody: ['Do', 'Mi', 'So', 'Mi'] } },
      ],
    };
    const { onsets } = resolveWeave(weave, knotC4);
    expect(onsets).toHaveLength(4);
  });
});


