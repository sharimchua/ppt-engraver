import { describe, it, expect } from 'vitest';
import { resolveYaml } from '../../src/resolver/resolve.js';

describe('Coil Inheritance & Default-Coil Injection', () => {
  it('inherits unfilled layers from parents using priority-fill rule', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  coils:
    rhythmParent:
      id: rhythmParent
      rhythm: DoLa
      melody: [Do, Re, Mi, Fa]
    harmonyParent:
      id: harmonyParent
      harmony: [So]
  weave:
    id: testWeave
    layout: concatenate
    children:
      - coil:
          id: childCoil
          parents: [rhythmParent, harmonyParent]
          melody: [Do, Mi, "So^", "Do^"]

`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    // Melody from child
    expect(onsets[0].pitch).toBe('C4');
    expect(onsets[1].pitch).toBe('E4');
    expect(onsets[2].pitch).toBe('G4');
    expect(onsets[3].pitch).toBe('C5');
    // Harmony from harmonyParent (So major triad = G3, B3, D4 root-position block chord)
    expect(onsets[0].chordRoot).toBe('So');
    expect(onsets[0].chordTones).toEqual(['G3', 'B3', 'D4']);

    // Rhythm from rhythmParent (DoLa = 4 onsets, validated against 4 melody notes)
    expect(onsets[0].tag).toBe('ppt_testWeave_childCoil_1');


  });

  it('first parent in list order takes precedence for shared layer', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  coils:
    parentA:
      id: parentA
      harmony: [Fa]
    parentB:
      id: parentB
      harmony: [So]
  weave:
    id: testWeave
    layout: concatenate
    children:
      - coil:
          id: childCoil
          parents: [parentA, parentB]
          melody: [Do, Mi]
`;
    const { onsets } = resolveYaml(yaml);
    // parentA comes first in parents list, so its harmony [Fa] is chosen
    expect(onsets[0].chordRoot).toBe('Fa');
  });

  it('injects layers from Weave defaultCoil', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  coils:
    commonDefault:
      id: commonDefault
      harmony: [So]
      rhythm: DoRe
  weave:
    id: testWeave
    layout: concatenate
    defaultCoil: commonDefault
    children:
      - coil:
          id: coil1
          melody: [Do, Mi, So]
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(3);
    // Harmony inherited from defaultCoil (So)
    expect(onsets[0].chordRoot).toBe('So');
  });

  it('resolves child referencing a coil ID from library', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  coils:
    sharedMotif:
      id: sharedMotif
      melody: [Do, Re, Do]
      harmony: [Do]
  weave:
    id: testWeave
    layout: concatenate
    children:
      - coil: sharedMotif
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(3);
    expect(onsets[0].coilId).toBe('sharedMotif');
    expect(onsets[0].tag).toBe('ppt_testWeave_sharedMotif_1');
  });

  it('throws error when referencing non-existent parent', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  weave:
    id: testWeave
    layout: concatenate
    children:
      - coil:
          id: childCoil
          parents: [ghostParent]
          melody: [Do]
`;
    expect(() => resolveYaml(yaml)).toThrow(/unknown parent coil "ghostParent"/);
  });

  it('supports single parent attribute (parent: rhythmParent)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: Eb4
  coils:
    rhythmTemplate:
      rhythm: [Do, Fi, Do, Fi]
  weave:
    id: testWeave
    children:
      - coil:
          id: childCoil
          parent: rhythmTemplate
          melody: [Do, Re, Mi, Fa]
          harmony: [Do]
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].rhythmToken).toBe('Do');
    expect(onsets[1].rhythmToken).toBe('Fi');
    expect(onsets[2].rhythmToken).toBe('Do');
    expect(onsets[3].rhythmToken).toBe('Fi');
  });

  it('resolves multi-level transitive inheritance (grandchild -> child -> grandparent)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
  coils:
    grandparentRhythm:
      rhythm: [Do, Fi, Do, Fi]
    parentHarmony:
      parent: grandparentRhythm
      harmony: [So]
  weave:
    id: testWeave
    children:
      - coil:
          id: grandchild
          parent: parentHarmony
          melody: [Do, Re, Mi, Fa]
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].chordRoot).toBe('So');
    expect(onsets[0].rhythmToken).toBe('Do');
    expect(onsets[1].rhythmToken).toBe('Fi');
  });

  it('resolves root weave from knot.weave and open weaves map', () => {
    const yaml = `
tapestry:
  knot:
    tonic: Eb4
    weave: song
    engraving:
      title: "Test Song"
      show:
        - melody
        - rhythmCoil
        - rhythmGrid
  coils:
    riffRhythm:
      rhythm: [Do, Fi, La, Do]
  weaves:
    verse:
      children:
        - coil:
            id: v1
            parent: riffRhythm
            melody: [Do, Re, Mi, Fa]
            harmony: [Do]
    song:
      children:
        - weave: verse
`;
    const { onsets, knot } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(knot.title).toBe('Test Song');
    expect(knot.showMelody).toBe(true);
    expect(knot.showRhythmCoil).toBe(true);
    expect(knot.showRhythmGrid).toBe(true);
    expect(knot.showMelodyCoilInterval).toBe(false);
    expect(onsets[0].tag).toBe('ppt_verse_v1_1');
  });
});
