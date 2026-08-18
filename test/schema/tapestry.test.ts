import { describe, it, expect } from 'vitest';
import { TapestrySchema } from '../../src/schema/tapestry.js';

describe('TapestrySchema', () => {
  const validTapestry = {
    tapestry: {
      knot: { do: 'C4', tempo: 120 },
      weave: {
        id: 'verse',
        layout: 'concatenate',
        children: [
          {
            coil: {
              id: 'introMotif',
              rhythm: 'DoLa',
              melody: ['Do', 'Mi', 'So', 'Do^'],
              harmony: ['Do'],
            },
          },
          {
            coil: {
              id: 'cadence',
              rhythm: 'DoSo',
              melody: ['Ti', 'Do^'],
              harmony: ['So'],
            },
          },
        ],
      },
    },
  };

  it('accepts the §5.1/§6.2 worked example', () => {
    const result = TapestrySchema.safeParse(validTapestry);
    expect(result.success).toBe(true);
  });

  it('accepts tapestry without knot (will use defaults)', () => {
    const noKnot = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [
            { coil: { id: 'motif', melody: ['Do', 'Re', 'Mi'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(noKnot);
    expect(result.success).toBe(true);
  });

  it('defaults layout to concatenate when omitted', () => {
    const noLayout = {
      tapestry: {
        weave: {
          id: 'test',
          children: [
            { coil: { id: 'motif', melody: ['Do'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(noLayout);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tapestry.weave.layout).toBe('concatenate');
    }
  });

  it('rejects invalid solfège in melody', () => {
    const bad = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [
            { coil: { id: 'motif', melody: ['Xyz'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects invalid pitch name in knot', () => {
    const bad = {
      tapestry: {
        knot: { do: 'Z9' },
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [
            { coil: { id: 'motif', melody: ['Do'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported layout modes', () => {
    const bad = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'equal-period',
          children: [
            { coil: { id: 'motif', melody: ['Do'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty melody array', () => {
    const bad = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [
            { coil: { id: 'motif', melody: [] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty children array', () => {
    const bad = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [],
        },
      },
    };
    const result = TapestrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts axis-marked melody tokens', () => {
    const withAxis = {
      tapestry: {
        weave: {
          id: 'test',
          layout: 'concatenate',
          children: [
            { coil: { id: 'motif', melody: ['Dox', 'Re', 'Mi', 'Fa'] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(withAxis);
    expect(result.success).toBe(true);
  });

  it('accepts all valid rhythm labels', () => {
    const rhythms = ['DoSo', 'DoRe', 'DoLa', 'DoMi', 'DoSi', 'DoFi'];
    for (const rhythm of rhythms) {
      const tap = {
        tapestry: {
          weave: {
            id: 'test',
            layout: 'concatenate',
            children: [
              { coil: { id: 'motif', rhythm, melody: ['Do'] } },
            ],
          },
        },
      };
      const result = TapestrySchema.safeParse(tap);
      expect(result.success, `rhythm '${rhythm}' should be valid`).toBe(true);
    }
  });

  it('accepts noteheadStyle, omitStem, and zoom in knot', () => {
    const withNotehead = {
      tapestry: {
        knot: {
          do: 'Eb4',
          noteheadStyle: 'sacredHarp',
          omitStem: true,
          zoom: 1.25,
        },
        weave: {
          id: 'song',
          children: [
            { coil: { id: 'motif', melody: ['Do', 3, 'Mi', 1] } },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(withNotehead);
    expect(result.success).toBe(true);
  });

  it('accepts structured melody object with dedicated rhythm', () => {
    const tap = {
      tapestry: {
        weave: {
          id: 'song',
          children: [
            {
              coil: {
                id: 'motif',
                melody: {
                  pitches: ['Dox', 'Do', 'Me', 'La'],
                  rhythm: ['Do', 'Me', 'Fi', 'La'],
                },
                harmony: {
                  chords: ['DoMe', 'Fa'],
                  rhythm: ['Do', 'Do'],
                  harmonyOctave: -1,
                },
              },
            },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(tap);
    expect(result.success).toBe(true);
  });

  it('accepts polyphonic melody array of arrays and array of voice objects', () => {
    const tap = {
      tapestry: {
        weave: {
          id: 'poly_song',
          children: [
            {
              coil: {
                id: 'poly1',
                melody: [
                  ['Dox', 'Do', 'Me', 'La'],
                  ['Mex', 'Me', 'So', 'Do^'],
                ],
                rhythm: ['Do', 'Me', 'Fi', 'La'],
              },
            },
            {
              coil: {
                id: 'poly2',
                melody: [
                  { pitches: ['Dox', 'Do'], rhythm: ['Do', 'Me'] },
                  { pitches: ['Mex', 'So'], rhythm: ['Do', 'Do'] },
                ],
              },
            },
          ],
        },
      },
    };
    const result = TapestrySchema.safeParse(tap);
    expect(result.success).toBe(true);
  });
});


