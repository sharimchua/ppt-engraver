import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { compileFile, compileYamlString } from '../../src/compiler/compile.js';

const FIXTURES = resolve(import.meta.dirname, '..', 'fixtures');

describe('compileFile & compileYamlString (Phase 2)', () => {
  it('compiles §6.2 worked example to exact expected LilyPond document', () => {
    const yamlPath = resolve(FIXTURES, 'design-doc-example.ppt.yaml');
    const result = compileFile(yamlPath);

    expect(result.warnings).toHaveLength(0);
    expect(result.onsets).toHaveLength(6);

    const expectedLy = readFileSync(
      resolve(FIXTURES, 'design-doc-example.notation.ly'),
      'utf-8',
    );




    // Compare normalized (ignoring carriage returns)
    expect(result.lilypondSource.replace(/\r\n/g, '\n').trim()).toBe(
      expectedLy.replace(/\r\n/g, '\n').trim()
    );

    // Verify sidecar map has entries for onsets
    expect(result.sidecarMap['ppt_verse_introMotif_1']).toBeDefined();
    expect(result.sidecarMap['ppt_verse_introMotif_melody_1']).toBeDefined();
    expect(result.sidecarMap['ppt_verse_cadence_2']).toBeDefined();
  });

  it('compiles YAML string directly in memory', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  weave:
    id: verse
    layout: concatenate
    children:
      - coil:
          id: motif
          melody: [Do, Mi]
          harmony: [Do]
`;
    const result = compileYamlString(yaml);
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_melody_1 c'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_melody_2 e'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_harmonyStaff_1 <c' e' g'>2");
  });

  it('compiles flat-keyed scores using flat accidental spelling (ees, bes, etc.)', () => {
    const yaml = `
tapestry:
  knot:
    do: Eb4
  weave:
    id: song
    layout: concatenate
    children:
      - coil:
          id: motif
          melody: [Do, Te, So]
          harmony: [Do, Fa]
`;
    const result = compileYamlString(yaml);
    // Melody: Do (Eb4) -> ees', Te (Db4) -> des', So (Bb3) -> bes
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_melody_1 ees'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_melody_2 des'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_melody_3 bes4");

    // Harmony: Do (Eb major) -> <ees' g' bes'>2, Fa (Ab major) -> <aes c' ees'>4
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_harmonyStaff_1 <ees' g' bes'>2");
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_harmonyStaff_3 <aes c' ees'>4");
  });

  it('compiles sharp-keyed scores using sharp accidental spelling (dis, ais, etc.)', () => {
    const yaml = `
tapestry:
  knot:
    do: "D#4"
  weave:
    id: song
    layout: concatenate
    children:
      - coil:
          id: motif
          melody: [Do, Te]
          harmony: [Do]
`;
    const result = compileYamlString(yaml);
    // Melody: Do (D#4) -> dis', Te (C#4) -> cis'
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_melody_1 dis'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_melody_2 cis'4");
    // Harmony: Do (D# major) -> <dis' g' ais'>2
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_motif_harmonyStaff_1 <dis' g' ais'>2");
  });

  it('compiles coil harmony staff notation with geometric glyphs and chord modifiers (DoMe, Dox)', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
    harmonyStaffStyle: coil
  weave:
    id: verse
    layout: concatenate
    children:
      - coil:
          id: part1
          melody: [Do, Re, Mi, Fa]
          harmony: [Dox, DoMe]
      - coil:
          id: part2
          melody: [So, La, Ti, Do^]
          harmony: [So]
`;
    const result = compileYamlString(yaml);
    expect(result.warnings).toHaveLength(0);
    expect(result.lilypondSource).toContain('\\override StaffSymbol.line-positions = #\'(-2.0 2.0)');
    expect(result.lilypondSource).toContain('\\override StaffSymbol.stencil = #ppt-row-band-stencil');
    expect(result.lilypondSource).toContain('\\override StaffSymbol.layer = #-2');
    expect(result.lilypondSource).toContain('\\override NoteHead.no-ledgers = ##t');
    expect(result.lilypondSource).toContain('\\override Clef.stencil = #pptClefHStencil');
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_harmony_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #t) } b\'2');
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_harmony_3 \\tweak NoteHead.text \\markup \\vcenter \\concat { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) \\lower #0.35 \\stencil #(make-solfege-glyph-sub pptPathBase 270 colorMi #f) } b\'2');
    expect(result.lilypondSource).toContain('\\bar "|"');
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part2_harmony_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathSharp 180 colorSo #f) } b\'1');
    expect(result.lilypondSource).toContain('melodyVoice = {');
    expect(result.lilypondSource).toContain('harmonyCoilVoice = {');
    expect(result.lilypondSource).toContain('harmonyVoice = {');
    expect(result.lilypondSource).toContain('\\melodyVoice');
    expect(result.lilypondSource).toContain('\\harmonyCoilVoice');
    expect(result.lilypondSource).toContain('\\harmonyVoice');
  });

  it('compiles score with both Melody Coil Absolute and Melody Coil Interval layers', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
    showMelodyCoilAbsolute: true
    showMelodyCoilInterval: true
    showHarmonyCoil: true
  weave:
    id: verse
    layout: concatenate
    children:
      - coil:
          id: part1
          melody: [Do, Re, Mi, Fa]
          harmony: [Do]
`;
    const result = compileYamlString(yaml);
    expect(result.warnings).toHaveLength(0);
    expect(result.lilypondSource).toContain('melodyCoilAbsoluteVoice = {');
    expect(result.lilypondSource).toContain('melodyCoilIntervalVoice = {');
    expect(result.lilypondSource).toContain('harmonyCoilVoice = {');
    // Absolute melody layer contains Do, Re, Mi, Fa glyphs
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_melodyAbs_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #f) } b\'4');
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_melodyAbs_2 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathFlat 270 colorRe #f) } b\'4');
    // Interval melody layer starts with Dox (anchor), followed by Re (+2), Re (+2), Ra (+1)
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_melodyInt_1 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathBase 0 colorDo #t) } b\'4');
    expect(result.lilypondSource).toContain('\\tag #\'ppt_verse_part1_melodyInt_4 \\tweak NoteHead.text \\markup \\vcenter { \\stencil #(make-solfege-glyph pptPathSharp 0 colorRe #f) } b\'4');
    expect(result.lilypondSource).toContain('\\melodyCoilAbsoluteVoice');
    expect(result.lilypondSource).toContain('\\melodyCoilIntervalVoice');
  });

  it('compiles score with custom zoom in knot', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
    zoom: 1.2
  weave:
    id: song
    children:
      - coil:
          id: part1
          melody: [Do]
`;
    const result = compileYamlString(yaml);
    expect(result.lilypondSource).toContain('#(set-global-staff-size 24)');
  });

  it('compiles score with Solfège rhythmic array grammar (16ths, 8ths, beat skips)', () => {
    const yaml = `
tapestry:
  knot:
    do: Eb4
  weave:
    id: song
    children:
      - coil:
          id: riff
          rhythm: [Do, Me, Fi, La, Do, Fi, Do, DoxDo]
          melody: [Do, Re, Me, Fa, So, Fa, Mi, Do^]
          harmony: [Do, 3, DoMe, 1, So, 1]
`;
    const result = compileYamlString(yaml);
    expect(result.warnings).toHaveLength(0);
    expect(result.onsets).toHaveLength(8);

    // 16th notes on beat 1
    expect(result.onsets[0].duration).toBe('16');
    expect(result.onsets[1].duration).toBe('16');
    expect(result.onsets[2].duration).toBe('16');
    expect(result.onsets[3].duration).toBe('16');
    // 8th notes on beat 2
    expect(result.onsets[4].duration).toBe('8');
    expect(result.onsets[5].duration).toBe('8');
    // Half note on beat 3 (beat 2.0 to 4.0 until next onset at beat 4.0)
    expect(result.onsets[6].duration).toBe('2');
    // DoxDo skip on beat 4 (beat 4.0 to 5.0)
    expect(result.onsets[7].rhythmToken).toBe('DoxDo');
    expect(result.onsets[7].isRest).toBe(false);
    expect(result.onsets[7].startBeat).toBe(4.0);
    expect(result.onsets[7].scaleDegree).toBe('Do');

    // Check LilyPond melody emission contains 16 and 8 durations
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_riff_melody_1");
    expect(result.lilypondSource).toContain("16");
    expect(result.lilypondSource).toContain("8");
  });

  it('compiles score with Rhythm Coil staff enabled in knot (showRhythmCoil: true)', () => {
    const yaml = `
tapestry:
  knot:
    do: Eb4
    showRhythmCoil: true
  weave:
    id: song
    children:
      - coil:
          id: riff
          rhythm: [Do, Fi, Do, Fi]
          melody: [Do, Re, Mi, Fa]
`;
    const result = compileYamlString(yaml);
    expect(result.lilypondSource).toContain('\\rhythmCoilVoice');
    expect(ly => expect(result.lilypondSource).toContain('\\override Clef.stencil = #pptClefRStencil'));
  });

  it('compiles score where rhythm extends past melody, emitting rests in melody', () => {
    const yaml = `
tapestry:
  knot:
    do: C4
  weave:
    id: song
    children:
      - coil:
          id: riff
          rhythm: [Do, Fi, Do, Fi]
          melody: [Do, Re]
          harmony: [Do, 1, So, 1]
`;
    const result = compileYamlString(yaml);
    expect(result.onsets).toHaveLength(4);
    expect(result.onsets[0].pitch).toBe('C4');
    expect(result.onsets[1].pitch).toBe('D4');
    expect(result.onsets[2].pitch).toBe('r');
    expect(result.onsets[2].isRest).toBe(true);
    expect(result.onsets[3].pitch).toBe('r');
    expect(result.onsets[3].isRest).toBe(true);

    // LilyPond melody contains spacer rest tokens (invisible in cadenza mode)
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_riff_melody_3 s8");
    expect(result.lilypondSource).toContain("\\tag #'ppt_song_riff_melody_4 s8");
  });

  it('omits ChordNames block when chordNames is not in engraving.show', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    engraving:
      show:
        - melody
        - harmony
  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [Do, Re]
          harmony: [Do, So]
`;
    const result = compileYamlString(yaml);
    expect(result.lilypondSource).not.toContain('\\new ChordNames');
  });

  it('includes ChordNames block when chordNames is explicitly in engraving.show', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
    engraving:
      show:
        - melody
        - harmony
        - chordNames
  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [Do, Re]
          harmony: [Do, So]
`;
    const result = compileYamlString(yaml);
    expect(result.lilypondSource).toContain('\\new ChordNames');
  });

  it('compiles specific knot projection when knotId is provided', () => {
    const yaml = `
tapestry:
  knots:
    - id: fullScore
      name: Full Score
      tonic: C4
      engraving:
        title: Master Score
        projection: default
    - id: leadSheet
      name: Lead Sheet
      parent: fullScore
      engraving:
        projection: leadSheet
    - id: concertEb
      name: Eb Transposition
      parent: fullScore
      tonic: Eb4

  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [Do, Mi]
          harmony: [Do]
`;

    // 1. Default (first knot = fullScore)
    const resDefault = compileYamlString(yaml);
    expect(resDefault.selectedKnotId).toBe('fullScore');
    expect(resDefault.availableKnots).toHaveLength(3);
    expect(resDefault.lilypondSource).toContain("c'4"); // Do = C4
    expect(resDefault.lilypondSource).toContain('\\new Staff \\harmonyVoice');

    // 2. Selected knot = leadSheet (no harmonyStaff, has chord names)
    const resLead = compileYamlString(yaml, { knotId: 'leadSheet' });
    expect(resLead.selectedKnotId).toBe('leadSheet');
    expect(resLead.lilypondSource).toContain('\\new ChordNames');
    expect(resLead.lilypondSource).not.toContain('\\new Staff \\harmonyVoice');

    // 3. Selected knot = concertEb (transposed Do = Eb4)
    const resEb = compileYamlString(yaml, { knotId: 'concertEb' });
    expect(resEb.selectedKnotId).toBe('concertEb');
    expect(resEb.lilypondSource).toContain("ees'4"); // Do = Eb4
  });

  it('compiles score with pulseCoil, gridSymbols, strongBeatGridWeight, and nested weave pulse cascading', () => {
    const yaml = `
tapestry:
  knot:
    tonic: "F4"
    weave: song
    engraving:
      gridSymbols: true
      strongBeatGridWeight: true
      showPulseCoil: true
      showRhythmGrid: true
      show: [melody, harmony, pulseCoil, rhythmGrid]

  weaves:
    song:
      pulse: [Dox, Re, So]
      children:
        - weave: pickup
        - weave: main_phrase

    pickup:
      children:
        - coil:
            melody: [Do, Re]
            harmony: [SoTe]
            rhythm: [Do, Fi]

    main_phrase:
      children:
        - coil:
            melody: [Mi, Do, So^]
            harmony: [Do]
            rhythm: [Do, Fi, Do]
`;

    const result = compileYamlString(yaml);
    expect(result.warnings).toHaveLength(0);
    // Verified pulseCoilVoice contains P clef and pulse tokens
    expect(result.lilypondSource).toContain('\\pulseCoilVoice');
    expect(result.lilypondSource).toContain('#pptClefPStencil');
    expect(result.lilypondSource).toContain('#make-strong-grid-point-stencil');
    expect(result.lilypondSource).toContain('#make-weak-grid-point-stencil');
    expect(result.lilypondSource).toContain('s4^\\markup { \\stencil #gridSymbol');
    expect(result.lilypondSource).not.toContain('\\markup \\vcenter { \\lower #0.5 \\fontsize #-3 \\markup');

    // Check pickup alignment: pickup is 1 beat in a 3-beat pulse (offset 2 -> syllable So)
    expect(result.lilypondSource).toContain("ppt_pickup_");
    expect(result.lilypondSource).toContain("ppt_main_phrase_");
  });

  it('keeps compound rhythm tokens like DoxFi intact without index decoupling', () => {
    const yaml = `
tapestry:
  knot:
    tonic: C4
  weaves:
    song:
      children:
        - coil:
            melody: [Do, Re]
            harmony: [Do, So]
            rhythm: [DoxFi, Do]
`;

    const result = compileYamlString(yaml);
    expect(result.warnings).toHaveLength(0);
    expect(result.onsets).toHaveLength(2);
    expect(result.onsets[0].rhythmToken).toBe('DoxFi');
    expect(result.onsets[0].startBeat).toBe(1.5);
    expect(result.onsets[1].rhythmToken).toBe('Do');
    expect(result.onsets[1].startBeat).toBe(2);
  });
});


