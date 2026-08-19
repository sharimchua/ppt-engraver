import { describe, it, expect } from 'vitest';
import { resolveKnot } from '../../src/resolver/knot.js';
import type { Tapestry } from '../../src/schema/tapestry.js';

describe('resolveKnot', () => {
  it('resolves knot with explicit Do = C4', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knot: { do: 'C4', tempo: 120 },
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, warnings } = resolveKnot(tapestry);
    expect(knot.doMidi).toBe(60); // C4
    expect(knot.tempo).toBe(120);
    expect(warnings).toHaveLength(0);
  });

  it('resolves knot with Do = F#3', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knot: { do: 'F#3' },
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, warnings } = resolveKnot(tapestry);
    expect(knot.doMidi).toBe(54); // F#3
    expect(knot.tempo).toBe(120); // default
    expect(warnings).toHaveLength(0);
  });

  it('falls back to C4 with warning when no knot', () => {
    const tapestry: Tapestry = {
      tapestry: {
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, warnings } = resolveKnot(tapestry);
    expect(knot.doMidi).toBe(60); // C4 default
    expect(knot.tempo).toBe(120);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('No Knot defined');
  });

  it('resolves knots array and defaults to first declared knot', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: [
          { id: 'concert', name: 'Concert Pitch', tonic: 'C4', tempo: 130 },
          { id: 'transposed', name: 'Eb Transposition', tonic: 'Eb4', tempo: 140 },
        ],
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, availableKnots, selectedKnotId } = resolveKnot(tapestry);
    expect(selectedKnotId).toBe('concert');
    expect(knot.id).toBe('concert');
    expect(knot.name).toBe('Concert Pitch');
    expect(knot.doMidi).toBe(60);
    expect(knot.tempo).toBe(130);
    expect(availableKnots).toHaveLength(2);
    expect(availableKnots[0].id).toBe('concert');
    expect(availableKnots[1].id).toBe('transposed');
  });

  it('resolves specified knot by ID', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: [
          { id: 'concert', name: 'Concert Pitch', tonic: 'C4' },
          { id: 'transposed', name: 'Eb Transposition', tonic: 'Eb4' },
        ],
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, selectedKnotId } = resolveKnot(tapestry, 'transposed');
    expect(selectedKnotId).toBe('transposed');
    expect(knot.id).toBe('transposed');
    expect(knot.doMidi).toBe(63); // Eb4 = 63
  });

  it('resolves single parent knot inheritance and overrides', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: [
          {
            id: 'baseScore',
            name: 'Full Score',
            tonic: 'C4',
            tempo: 120,
            engraving: {
              title: 'Master Title',
              composer: 'Master Composer',
              show: ['melody', 'harmony', 'chordNames'],
              colorNotes: true,
            },
          },
          {
            id: 'leadSheet',
            name: 'Lead Sheet View',
            parent: 'baseScore',
            engraving: {
              subtitle: 'Lead Sheet Edition',
              projection: 'leadSheet',
            },
          },
        ],
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };

    const { knot } = resolveKnot(tapestry, 'leadSheet');
    expect(knot.id).toBe('leadSheet');
    expect(knot.doMidi).toBe(60); // inherited from baseScore
    expect(knot.tempo).toBe(120); // inherited from baseScore
    expect(knot.title).toBe('Master Title'); // inherited from baseScore
    expect(knot.composer).toBe('Master Composer'); // inherited from baseScore
    expect(knot.subtitle).toBe('Lead Sheet Edition'); // overridden in leadSheet
    expect(knot.projection).toBe('leadSheet'); // overridden in leadSheet
    expect(knot.colorNotes).toBe(true); // inherited from baseScore engraving
    expect(knot.showTraditionalHarmony).toBe(false); // leadSheet preset default
  });

  it('resolves dictionary/record of knots', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: {
          firstKnot: { tonic: 'D4', title: 'Song 1' },
          secondKnot: { tonic: 'G4', parent: 'firstKnot', subtitle: 'Transposed' },
        },
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const res1 = resolveKnot(tapestry);
    expect(res1.selectedKnotId).toBe('firstKnot');
    expect(res1.knot.doMidi).toBe(62); // D4
    expect(res1.knot.title).toBe('Song 1');

    const res2 = resolveKnot(tapestry, 'secondKnot');
    expect(res2.selectedKnotId).toBe('secondKnot');
    expect(res2.knot.doMidi).toBe(67); // G4
    expect(res2.knot.title).toBe('Song 1'); // inherited from firstKnot
    expect(res2.knot.subtitle).toBe('Transposed');
  });

  it('detects circular parent inheritance gracefully', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: [
          { id: 'knotA', parent: 'knotB', tonic: 'C4' },
          { id: 'knotB', parent: 'knotA', tempo: 140 },
        ],
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };
    const { knot, warnings } = resolveKnot(tapestry, 'knotA');
    expect(knot.id).toBe('knotA');
    expect(knot.doMidi).toBe(60);
    expect(warnings.some(w => w.includes('Circular knot inheritance'))).toBe(true);
  });

  it('excludes abstract/hidden knots from availableKnots dropdown and chooses first visible knot as default', () => {
    const tapestry: Tapestry = {
      tapestry: {
        knots: [
          {
            id: '_baseTemplate',
            name: 'Base Abstract Template',
            abstract: true,
            tonic: 'C4',
            tempo: 128,
            engraving: { title: 'Master Title', colorNotes: true },
          },
          {
            id: 'fullScore',
            name: 'Full Score',
            parent: '_baseTemplate',
            engraving: { projection: 'default' },
          },
          {
            id: 'leadSheet',
            name: 'Lead Sheet',
            parent: '_baseTemplate',
            engraving: { projection: 'leadSheet' },
          },
          {
            id: '_internalSecret',
            name: 'Hidden Knot',
            hidden: true,
            parent: 'fullScore',
          },
        ],
        weave: { id: 'test', layout: 'concatenate', children: [{ coil: { id: 'x', melody: ['Do'] } }] },
      },
    };

    // Default resolution: should select fullScore (first non-abstract knot)
    const resDefault = resolveKnot(tapestry);
    expect(resDefault.selectedKnotId).toBe('fullScore');
    expect(resDefault.knot.id).toBe('fullScore');
    expect(resDefault.knot.doMidi).toBe(60); // inherited from _baseTemplate
    expect(resDefault.knot.tempo).toBe(128); // inherited from _baseTemplate
    expect(resDefault.knot.colorNotes).toBe(true); // inherited from _baseTemplate
    expect(resDefault.knot.abstract).toBeUndefined(); // abstract flag was NOT inherited!

    // availableKnots should only include fullScore and leadSheet (_baseTemplate & _internalSecret excluded)
    expect(resDefault.availableKnots).toHaveLength(2);
    expect(resDefault.availableKnots.map(k => k.id)).toEqual(['fullScore', 'leadSheet']);

    // Explicitly targeting abstract knot still works if requested
    const resAbstract = resolveKnot(tapestry, '_baseTemplate');
    expect(resAbstract.selectedKnotId).toBe('_baseTemplate');
    expect(resAbstract.knot.id).toBe('_baseTemplate');
    expect(resAbstract.knot.abstract).toBe(true);
  });
});
