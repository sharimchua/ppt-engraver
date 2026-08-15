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
});
