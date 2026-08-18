import { describe, it, expect } from 'vitest';
import { resolveYaml } from '../../src/resolver/resolve.js';
import { compileYamlString } from '../../src/compiler/compile.js';

describe('Layer Injection & Cross-Coil Referencing', () => {
  it('supports shorthand string injection for harmony layer (harmony: changes)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        changes:
          harmony: [Do, Fa, So, Do]
        melody_coil:
          melody: [Do, Re, Mi, Fa]
          harmony: changes
      children:
        - coil: melody_coil
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].chordRoot).toBe('Do');
    expect(onsets[1].chordRoot).toBe('Fa');
    expect(onsets[2].chordRoot).toBe('So');
    expect(onsets[3].chordRoot).toBe('Do');
    expect(onsets[0].harmonySourceCoil).toBe('changes');
  });

  it('supports structured harmony injection with local overrides (from, harmonyOctave, harmonyVoicing)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        changes:
          harmony: [Do, Fa]
        melody_coil:
          melody: [Do, Re]
          harmony:
            from: changes
            harmonyOctave: -1
            harmonyVoicing: shell
      children:
        - coil: melody_coil
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(2);
    expect(onsets[0].chordRoot).toBe('Do');
    expect(onsets[1].chordRoot).toBe('Fa');
    // Root C4 is MIDI 60, harmonyOctave: -1 shifts down 12 semitones
    expect(onsets[0].chordMidi[0]).toBeLessThan(60);
    expect(onsets[0].harmonySourceCoil).toBe('changes');
  });

  it('supports shorthand and structured rhythm injection (rhythm: groove_1)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        groove_1:
          rhythm: [Do, Fi, Do, Fi]
        motif:
          melody: [Do, Re, Mi, Fa]
          rhythm: groove_1
      children:
        - coil: motif
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].duration).toBe('8');
    expect(onsets[1].duration).toBe('8');
    expect(onsets[0].rhythmSourceCoil).toBe('groove_1');
  });

  it('supports melody injection (melody: motif_a)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        motif_a:
          melody: [Dox, Do, Mi, So]
        variation:
          melody: motif_a
          harmony: [Do]
      children:
        - coil: variation
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[0].melodySourceCoil).toBe('motif_a');
  });

  it('supports cross-layer extraction (melody: { from: changes.harmony })', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        changes:
          harmony: [Do, Fa, So, Do]
        bass_melody:
          melody:
            from: changes.harmony
          harmony: [Do]
      children:
        - coil: bass_melody
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[1].scaleDegree).toBe('Fa');
    expect(onsets[2].scaleDegree).toBe('So');
    expect(onsets[3].scaleDegree).toBe('Do');
  });

  it('supports harmony injection and parent inheritance on composite concat coils', () => {
    const yaml = `
tapestry:
  knot:
    tonic: F4
    weave: song
  weaves:
    song:
      coils:
        v1:
          melody: [Lax, Re, Ra, Fa]
        v2:
          melody: [Mix, Me, Re, Do]
        changes:
          harmony: [Do, Fa]
        verse_phrase:
          harmony: changes
          concat: [v1, v2]
      children:
        - coil: verse_phrase
`;
    const { onsets } = resolveYaml(yaml);
    // 4 notes in v1 + 4 notes in v2 = 8 onsets
    expect(onsets).toHaveLength(8);
    // Stretched across 8 onsets with 2 chords: first 4 get Do, next 4 get Fa
    expect(onsets[0].chordRoot).toBe('Do');
    expect(onsets[1].chordRoot).toBe('Do');
    expect(onsets[2].chordRoot).toBe('Do');
    expect(onsets[3].chordRoot).toBe('Do');
    expect(onsets[4].chordRoot).toBe('Fa');
    expect(onsets[5].chordRoot).toBe('Fa');
    expect(onsets[6].chordRoot).toBe('Fa');
    expect(onsets[7].chordRoot).toBe('Fa');
    expect(onsets[0].harmonySourceCoil).toBe('changes');
  });

  it('supports parents: inheritance on composite concat coils', () => {
    const yaml = `
tapestry:
  knot:
    tonic: F4
    weave: song
  weaves:
    song:
      coils:
        v1:
          melody: [Lax, Re]
        v2:
          melody: [Mix, Me]
        changes:
          harmony: [Do, Fa]
        verse_phrase:
          parents: changes
          concat: [v1, v2]
      children:
        - coil: verse_phrase
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].chordRoot).toBe('Do');
    expect(onsets[1].chordRoot).toBe('Do');
    expect(onsets[2].chordRoot).toBe('Fa');
    expect(onsets[3].chordRoot).toBe('Fa');
    expect(onsets[0].harmonySourceCoil).toBe('changes');
  });

  it('supports harmony injection via chords: changes with dedicated rhythm override', () => {
    const yaml = `
tapestry:
  knot:
    tonic: F4
    weave: song
  weaves:
    song:
      coils:
        v1:
          melody: [Lax, Re, Ra, Fa]
        v2:
          melody: [Mix, Me, Re, Do]
        changes:
          harmony:
            chords: [ReMe, SoTe]
        verse:
          harmony:
            chords: changes
            rhythm: [Do, Dox, 2, Do]
          concat: [v1, v2]
      children:
        - coil: verse
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(8);
    expect(onsets[0].chordRoot).toBe('ReMe');
    expect(onsets[4].chordRoot).toBe('SoTe');
    expect(onsets[0].harmonySourceCoil).toBe('changes');
  });

  it('supports melody injection via pitches: motif with dedicated rhythm override', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        motif:
          melody: [Do, Re, Me, So]
        verse:
          melody:
            pitches: motif
            rhythm: [Do, Fi, Do, Fi]
          harmony: [Do]
      children:
        - coil: verse
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[1].scaleDegree).toBe('Re');
    expect(onsets[2].scaleDegree).toBe('Me');
    expect(onsets[3].scaleDegree).toBe('So');
    expect(onsets[0].duration).toBe('8');
    expect(onsets[0].melodySourceCoil).toBe('motif');
  });

  it('supports DoxDo prefix in harmony rhythm to delay first chord after melody pickup', () => {
    const yaml = `
tapestry:
  knot:
    tonic: F4
    weave: song
  weaves:
    song:
      coils:
        verse:
          melody: [Lax, Re, Ra, Fa, Mix, Me]
          harmony:
            chords: [ReMe, SoTe]
            rhythm: [DoxDo, 2, Do]
      children:
        - coil: verse
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(6);
    // Onset 0 (beat 0) is before DoxDo (beat 1.0) -> pickup note with empty chord
    expect(onsets[0].chordRoot).toBe('');
    expect(onsets[0].chordMidi).toEqual([]);
    // Onset 1 (beat 1) reaches DoxDo (beat 1.0) -> ReMe enters
    expect(onsets[1].chordRoot).toBe('ReMe');
    // Onset 4 (beat 4) reaches next Do -> SoTe enters
    expect(onsets[4].chordRoot).toBe('SoTe');
  });

  it('throws descriptive error on unknown referenced coil', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        verse:
          melody: [Do, Re]
          harmony: nonexistent_changes
      children:
        - coil: verse
`;
    expect(() => resolveYaml(yaml)).toThrowError(/references unknown coil "nonexistent_changes"/);
  });

  it('throws descriptive error on circular layer injection', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    weave: song
  weaves:
    song:
      coils:
        coilA:
          melody: [Do, Re]
          harmony: coilB
        coilB:
          melody: [Mi, Fa]
          harmony: coilA
      children:
        - coil: coilA
`;
    expect(() => resolveYaml(yaml)).toThrowError(/Circular coil layer reference detected/);
  });
});
