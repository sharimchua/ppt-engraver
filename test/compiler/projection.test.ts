import { describe, it, expect } from 'vitest';
import { compileYamlString } from '../../src/compiler/compile.js';
import { resolveYaml } from '../../src/resolver/resolve.js';

describe('Arrangement Projections Compiler Integration', () => {
  it('resolves and compiles melody augmentation and harmony voicings', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    engraving:
      harmonyVoicing: rootless
      melodyAugmentation: thirdsBelow
      melodyAugmentationDisplay: ghosted
  coils:
    main:
      melody: [Do, Re, Mi, Fa]
      harmony: [Do, Do, Fa, Fa]
  weave:
    children:
      - coil: main
`;
    const res = resolveYaml(yaml);
    expect(res.onsets.length).toBe(4);
    
    // Check that melody onsets have augmentation notes
    expect(res.onsets[0].melodyAugmentationNotes).toBeDefined();
    expect(res.onsets[0].melodyAugmentationNotes!.length).toBeGreaterThan(0);
    expect(res.onsets[0].melodyAugmentationNotes![0].isInferred).toBe(true);

    // Check rootless harmony voicing does not contain root (60)
    expect(res.onsets[0].chordMidi).not.toContain(60);

    const comp = compileYamlString(yaml);
    expect(comp.lilypondSource).toBeDefined();
    // LilyPond melody voice should contain composite chords with \tweak color
    expect(comp.lilypondSource).toContain('<');
    expect(comp.lilypondSource).toContain('color');
  });

  it('handles projection presets such as chordMelody and jazzComping', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    projection: chordMelody
  coils:
    main:
      melody: [Do, Mi, So, Do]
      harmony: [Do, Do, Do, Do]
  weave:
    children:
      - coil: main
`;
    const res = resolveYaml(yaml);
    expect(res.knot.projection).toBe('chordMelody');
    expect(res.knot.melodyAugmentation).toBe('drop2');
    expect(res.onsets[0].melodyAugmentationNotes).toBeDefined();

    const comp = compileYamlString(yaml);
    expect(comp.lilypondSource).toContain('<');
  });

  it('maintains smooth voice leading across coils and bars', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    engraving:
      harmonyVoicing: smoothLead
  coils:
    c1:
      melody: [Do, Do]
      harmony: [Do, Re]
    c2:
      melody: [Mi, Mi]
      harmony: [So, Do]
  weave:
    children:
      - coil: c1
      - coil: c2
`;
    const res = resolveYaml(yaml);
    expect(res.onsets.length).toBe(4);
    expect(res.knot.harmonyVoicing).toBe('smoothLead');
    // Ensure all onsets have valid chordMidi arrays
    for (const onset of res.onsets) {
      expect(onset.chordMidi.length).toBeGreaterThanOrEqual(3);
    }
  });
});
