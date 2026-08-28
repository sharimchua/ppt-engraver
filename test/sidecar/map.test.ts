import { describe, it, expect } from 'vitest';
import { generateSidecarMap } from '../../src/sidecar/map.js';
import type { OnsetStream } from '../../src/schema/onset.js';

describe('generateSidecarMap', () => {
  const sampleOnsets: OnsetStream = [
    {
      tag: 'ppt_verse_introMotif_1',
      pitch: 'C4',
      midiNote: 60,
      scaleDegree: 'Do',
      chordTones: ['C4', 'E4', 'G4'],
      chordMidi: [60, 64, 67],
      chordRoot: 'Do',
      coilId: 'introMotif',
      weaveId: 'verse',
      onsetIndex: 1,
    },
  ];

  it('generates an expectation map keyed by tag', () => {
    const map = generateSidecarMap(sampleOnsets);
    const entry = map['ppt_verse_introMotif_1'];
    expect(entry).toBeDefined();
    expect(entry.tag).toBe('ppt_verse_introMotif_1');
    expect(entry.weaveId).toBe('verse');
    expect(entry.coilId).toBe('introMotif');
    expect(entry.onsetIndex).toBe(1);

    // Melody expectations
    expect(entry.melody.scaleDegree).toBe('Do');
    expect(entry.melody.pitch).toBe('C4');
    expect(entry.melody.midiNote).toBe(60);

    // Harmony expectations
    expect(entry.harmony.root).toBe('Do');
    expect(entry.harmony.quality).toBe('major');
    expect(entry.harmony.chordTones).toEqual(['C4', 'E4', 'G4']);
    expect(entry.harmony.chordMidi).toEqual([60, 64, 67]);
  });

  it('generates voice-indexed tags for polyphonic onsets', () => {
    const multiVoiceOnsets: OnsetStream = [
      {
        tag: 'ppt_verse_poly_v2_1',
        pitch: 'Eb4',
        midiNote: 63,
        scaleDegree: 'Me',
        chordTones: ['C4', 'E4', 'G4'],
        chordMidi: [60, 64, 67],
        chordRoot: 'Do',
        coilId: 'poly',
        weaveId: 'verse',
        onsetIndex: 1,
        voiceIndex: 2,
      },
    ];

    const map = generateSidecarMap(multiVoiceOnsets);
    expect(map['ppt_verse_poly_v2_1']).toBeDefined();
    expect(map['ppt_verse_poly_melody_v2_1']).toBeDefined();
    expect(map['ppt_verse_poly_v2_1'].voiceIndex).toBe(2);
  });
});

import { compileYamlString } from '../../src/compiler/compile.js';
import {
  extractLayerFromTag,
  resolveTagFromLyLine,
  findYamlTarget,
} from '../../studio/public/js/core/ast-scanner.js';

describe('Point-and-Click & AST Scanner Navigation', () => {
  const sampleYaml = `tapestry:
  knot:
    tonic: "F4"
    engraving:
      show:
        - melody
        - rhythmCoil
        - harmonyCoil
        - chordNames
  weaves:
    song:
      stitch:
        - coil: verse
  coils:
    melody_rhythm:
      rhythm: [Do, Fi, 3.2, Do]
    verse_1:
      melody: [Lax, Re, Ra, Fa]
      rhythm: melody_rhythm
    verse_changes:
      harmony: [ReMe, SoTe, DoTi, FaTi]
    verse:
      harmony:
        chords: verse_changes
        rhythm: [DoxFi]
      concat:
        - verse_1
`;

  it('extracts correct layers from LilyPond tag strings', () => {
    expect(extractLayerFromTag('ppt_song_verse_melody_1')).toBe('melody');
    expect(extractLayerFromTag('ppt_song_verse_melody_v2_1')).toBe('melody');
    expect(extractLayerFromTag('ppt_song_verse_melodyAbs_1')).toBe('melody');
    expect(extractLayerFromTag('ppt_song_verse_melodyInt_1')).toBe('melody');
    expect(extractLayerFromTag('ppt_song_verse_rhythm_3')).toBe('rhythm');
    expect(extractLayerFromTag('ppt_song_verse_pulse_2')).toBe('pulse');
    expect(extractLayerFromTag('ppt_song_verse_harmony_1')).toBe('harmony');
    expect(extractLayerFromTag('ppt_song_verse_chordName_1')).toBe('harmony');
    expect(extractLayerFromTag('ppt_song_verse_chordTriangle_1')).toBe('harmony');
    expect(extractLayerFromTag('ppt_song_verse_tab_1')).toBe('melody');
  });

  it('resolves tagInfo with layer, voice, and coil metadata from LilyPond line', () => {
    const res = compileYamlString(sampleYaml);
    const lyLines = res.lilypondSource.split('\n');

    const melodyLineIdx = lyLines.findIndex(l => l.includes('ppt_song_verse_melody_1'));
    expect(melodyLineIdx).toBeGreaterThanOrEqual(0);

    const tagInfo = resolveTagFromLyLine(
      melodyLineIdx + 1,
      res.onsets,
      res.sidecarMap,
      res.lilypondSource
    );

    expect(tagInfo).toBeDefined();
    expect(tagInfo?.targetLayer).toBe('melody');
    expect(tagInfo?.coilId).toBe('verse');
    expect(tagInfo?.sourceCoilId).toBe('verse_1');
    expect(tagInfo?.melodySourceCoil).toBe('verse_1');
    expect(tagInfo?.rhythmSourceCoil).toBe('melody_rhythm');
    expect(tagInfo?.harmonySourceCoil).toBe('verse_changes');
  });

  it('navigates to the exact melody token in YAML', () => {
    const res = compileYamlString(sampleYaml);
    const lyLines = res.lilypondSource.split('\n');
    const melodyLineIdx = lyLines.findIndex(l => l.includes('ppt_song_verse_melody_1'));

    const tagInfo = resolveTagFromLyLine(
      melodyLineIdx + 1,
      res.onsets,
      res.sidecarMap,
      res.lilypondSource
    );

    const targetCoil = tagInfo?.melodySourceCoil || tagInfo?.sourceCoilId || tagInfo?.coilId;
    const target = findYamlTarget(
      sampleYaml,
      targetCoil,
      tagInfo?.melodyOnsetIndex || tagInfo?.sourceOnsetIndex || tagInfo?.onsetIndex,
      tagInfo?.targetLayer,
      tagInfo?.voiceIndex,
      [tagInfo?.sourceCoilId, tagInfo?.coilId]
    );

    expect(target).toBeDefined();
    expect(sampleYaml.split('\n')[target!.line]).toContain('melody: [Lax, Re, Ra, Fa]');
    expect(target!.col).toBeGreaterThanOrEqual(14);
  });

  it('navigates to the exact rhythm token in YAML', () => {
    const res = compileYamlString(sampleYaml);
    const lyLines = res.lilypondSource.split('\n');
    const rhythmLineIdx = lyLines.findIndex(l => l.includes('ppt_song_verse_rhythm_1'));

    const tagInfo = resolveTagFromLyLine(
      rhythmLineIdx + 1,
      res.onsets,
      res.sidecarMap,
      res.lilypondSource
    );

    expect(tagInfo?.targetLayer).toBe('rhythm');

    const targetCoil = tagInfo?.rhythmSourceCoil || tagInfo?.sourceCoilId || tagInfo?.coilId;
    const target = findYamlTarget(
      sampleYaml,
      targetCoil,
      tagInfo?.sourceOnsetIndex || tagInfo?.onsetIndex,
      tagInfo?.targetLayer,
      tagInfo?.voiceIndex,
      [tagInfo?.sourceCoilId, tagInfo?.coilId]
    );

    expect(target).toBeDefined();
    expect(sampleYaml.split('\n')[target!.line]).toContain('rhythm: [Do, Fi, 3.2, Do]');
  });

  it('navigates to structured harmony chords in YAML', () => {
    const res = compileYamlString(sampleYaml);
    const lyLines = res.lilypondSource.split('\n');
    const harmonyLineIdx = lyLines.findIndex(l => l.includes('ppt_song_verse_harmony_1'));

    const tagInfo = resolveTagFromLyLine(
      harmonyLineIdx + 1,
      res.onsets,
      res.sidecarMap,
      res.lilypondSource
    );

    expect(tagInfo?.targetLayer).toBe('harmony');

    const targetCoil = tagInfo?.harmonySourceCoil || tagInfo?.sourceCoilId || tagInfo?.coilId;
    const target = findYamlTarget(
      sampleYaml,
      targetCoil,
      tagInfo?.sourceOnsetIndex || tagInfo?.onsetIndex,
      tagInfo?.targetLayer,
      tagInfo?.voiceIndex,
      [tagInfo?.sourceCoilId, tagInfo?.coilId]
    );

    expect(target).toBeDefined();
    expect(sampleYaml.split('\n')[target!.line]).toContain('harmony: [ReMe, SoTe, DoTi, FaTi]');
  });

  it('navigates to anonymous inline child coils in itsumo_nandemo', () => {
    const itsumoYaml = `tapestry:
  knot:
    tonic: "F4"
    engraving:
      show: [melody, harmony, rhythmCoil, chordNames]
  weaves:
    motif_a_open:
      stitch:
        - coil: 
            melody: [Mi, Do, So^, Mi, Re, So^, Re]
            harmony: [Do, So]
            rhythm: [Do, Fi, Do, Dox, Fi, Do, Do, Dox, Fi]
        - coil:
            melody: [Do, La, Mi, Do, Ti, Do, Ti]
            harmony: [LaMe, MiMe]
            rhythm: [Do, Fi, Do, Dox, Fi, Do, Dox, Do, Fi]
`;
    const res = compileYamlString(itsumoYaml);
    const lyLines = res.lilypondSource.split('\n');
    const child2LineIdx = lyLines.findIndex(l => l.includes('ppt_motif_a_open_motif_a_open_coil_2_melody_1'));
    expect(child2LineIdx).toBeGreaterThanOrEqual(0);

    const tagInfo = resolveTagFromLyLine(
      child2LineIdx + 1,
      res.onsets,
      res.sidecarMap,
      res.lilypondSource
    );

    expect(tagInfo).toBeDefined();
    expect(tagInfo?.targetLayer).toBe('melody');

    const targetCoil = tagInfo?.melodySourceCoil || tagInfo?.sourceCoilId || tagInfo?.coilId;
    const target = findYamlTarget(
      itsumoYaml,
      targetCoil,
      tagInfo?.melodyOnsetIndex || tagInfo?.sourceOnsetIndex || tagInfo?.onsetIndex,
      tagInfo?.targetLayer,
      tagInfo?.voiceIndex
    );

    expect(target).toBeDefined();
    expect(itsumoYaml.split('\n')[target!.line]).toContain('melody: [Do, La, Mi, Do, Ti, Do, Ti]');
  });
});
