import { describe, it, expect } from 'vitest';
import { resolveYaml } from '../../src/resolver/resolve.js';
import { compileYamlString } from '../../src/compiler/compile.js';

describe('Coil Concatenation & Rhythm Boundary Collapsing', () => {
  it('concatenates sub-coils referenced by ID into a single unified coil onset stream', () => {
    const yaml = `
tapestry:
  knot:
    tonic: A4
    weave: song
  weaves:
    song:
      coils:
        part1:
          melody: [Do, Re]
          harmony: [Do]
        part2:
          melody: [Mi, Fa]
          harmony: [Fa]
        full_phrase:
          concat: [part1, part2]
      children:
        - coil: full_phrase
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].scaleDegree).toBe('Do');
    expect(onsets[0].tag).toBe('ppt_song_full_phrase_1');
    expect(onsets[0].chordRoot).toBe('Do');

    expect(onsets[1].scaleDegree).toBe('Re');
    expect(onsets[1].tag).toBe('ppt_song_full_phrase_2');
    expect(onsets[1].chordRoot).toBe('Do');

    expect(onsets[2].scaleDegree).toBe('Mi');
    expect(onsets[2].tag).toBe('ppt_song_full_phrase_3');
    expect(onsets[2].chordRoot).toBe('Fa');

    expect(onsets[3].scaleDegree).toBe('Fa');
    expect(onsets[3].tag).toBe('ppt_song_full_phrase_4');
    expect(onsets[3].chordRoot).toBe('Fa');
  });

  it('supports inline anonymous concat coils inside weave.children', () => {
    const yaml = `
tapestry:
  knot:
    tonic: A4
    weave: song
  weaves:
    song:
      coils:
        part1:
          melody: [Do, Re]
        part2:
          melody: [Mi, Fa]
      children:
        - coil:
            id: myPhrase
            concat: [part1, part2]
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    expect(onsets[0].tag).toBe('ppt_song_myPhrase_1');
    expect(onsets[3].tag).toBe('ppt_song_myPhrase_4');
  });

  it('allows composite concat coil to override the harmony progression across the entire phrase', () => {
    const yaml = `
tapestry:
  knot:
    tonic: A4
    weave: song
  weaves:
    song:
      coils:
        part1:
          melody: [Do, Re]
          harmony: [Do]
        part2:
          melody: [Mi, Fa]
          harmony: [Fa]
        full_phrase:
          concat: [part1, part2]
          harmony: [So, 4]
      children:
        - coil: full_phrase
`;
    const { onsets } = resolveYaml(yaml);
    expect(onsets).toHaveLength(4);
    for (const onset of onsets) {
      expect(onset.chordRoot).toBe('So');
    }
  });

  it('collapses boundary rests when trailing downbeat rest meets a leading pushed Dox rest (Strive motif)', () => {
    const yaml = `
tapestry:
  knot:
    tonic: A4
    weave: song
  weaves:
    song:
      coils:
        _verse1:
          melody: [Dox, Do, Me, La, Me]
          rhythm: [Do, Fi, Do, Fi, Do, Do]
        _verse2:
          melody: [Dox, Me, Re]
          rhythm: [DoxMe, Fi, La]
        _verse3:
          melody: [Sox^, Te, Re, Te, Te, Re]
          rhythm: [Do, Fi, Le, Te, Do, Fi]
        verse_phrase:
          concat: [_verse1, _verse2, _verse3]
      children:
        - coil: verse_phrase
`;
    const { onsets } = resolveYaml(yaml);
    // _verse1: 5 onsets (rest + 4 notes, trailing Do collapsed with _verse2's Dox)
    // _verse2: 4 onsets (Dox rest + 2 notes + trailing La 16th rest)
    // _verse3: 6 onsets (6 notes)
    // Total onsets = 5 + 4 + 6 = 15 onsets
    expect(onsets).toHaveLength(15);

    // Verify all onsets belong to verse_phrase with tags 1..15
    for (let i = 0; i < onsets.length; i++) {
      expect(onsets[i].tag).toBe(`ppt_song_verse_phrase_${i + 1}`);
    }

    // Verify boundary collapse between _verse1 and _verse2 (onset index 5 is Dox at beat 3)
    expect(onsets[4].scaleDegree).toBe('Me'); // end of _verse1 melody
    expect(onsets[5].isRest).toBe(true);      // collapsed Dox boundary rest
    expect(onsets[5].rhythmToken).toBe('Dox');
    expect(onsets[5].duration).toBe('16');
    expect(onsets[7].scaleDegree).toBe('Me'); // audible melody note in _verse2
    expect(onsets[8].scaleDegree).toBe('Fa'); // interval Re relative to Me -> Fa
  });

  it('emits a single barline per active staff at the end of the entire concatenated coil in LilyPond', () => {
    const yaml = `
tapestry:
  knot:
    tonic: A4
    weave: song
    engraving:
      show:
        - melody
  weaves:
    song:
      coils:
        part1:
          melody: [Do, Re]
        part2:
          melody: [Mi, Fa]
        phrase:
          concat: [part1, part2]
      children:
        - coil: phrase
`;
    const result = compileYamlString(yaml);
    // Single staff score -> exactly 1 barline at the end of the phrase
    const barMatches = result.lilypondSource.match(/\\bar\s*"/g);
    expect(barMatches?.length).toBe(1);
  });
});
