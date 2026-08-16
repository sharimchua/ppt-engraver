import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { compileFile, compileYamlString } from '../../src/compiler/compile.js';

const FIXTURES = resolve(import.meta.dirname, '..', 'fixtures');

describe('compileFile & compileYamlString (Phase 2)', () => {
  it('compiles §6.2 worked example to exact expected LilyPond document', () => {
    const yamlPath = resolve(FIXTURES, 'design-doc-example.ppt.yaml');
    const result = compileFile(yamlPath);

    expect(result.warnings).toHaveLength(0);
    expect(result.onsets).toHaveLength(6);

    const expectedLy = `\\version "2.24.4"

melodyVoice = {
  \\clef treble
  \\cadenzaOn
  \\tag #'ppt_verse_introMotif_1 c'4
  \\tag #'ppt_verse_introMotif_2 e'4
  \\tag #'ppt_verse_introMotif_3 g'4
  \\tag #'ppt_verse_introMotif_4 c''4
  \\bar "|"
  \\tag #'ppt_verse_cadence_1 b'4
  \\tag #'ppt_verse_cadence_2 c''4
  \\cadenzaOff
}

harmonyVoice = {
  \\clef treble
  \\cadenzaOn
  \\tag #'ppt_verse_introMotif_1 <c' e' g'>4
  \\tag #'ppt_verse_introMotif_2 <c' e' g'>4
  \\tag #'ppt_verse_introMotif_3 <c' e' g'>4
  \\tag #'ppt_verse_introMotif_4 <c' e' g'>4
  \\bar "|"
  \\tag #'ppt_verse_cadence_1 <g' b' d''>4
  \\tag #'ppt_verse_cadence_2 <g' b' d''>4
  \\cadenzaOff
}

\\score {
  \\new PianoStaff <<
    \\new Staff \\melodyVoice
    \\new Staff \\harmonyVoice
  >>
  \\layout {
    \\context {
      \\Staff
      \\remove "Time_signature_engraver"
    }
  }
}
`;

    // Compare normalized (ignoring carriage returns)
    expect(result.lilypondSource.replace(/\r\n/g, '\n').trim()).toBe(
      expectedLy.replace(/\r\n/g, '\n').trim()
    );

    // Verify sidecar map has all 6 tags
    expect(Object.keys(result.sidecarMap)).toHaveLength(6);
    expect(result.sidecarMap['ppt_verse_introMotif_1']).toBeDefined();
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
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_1 c'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_2 e'4");
    expect(result.lilypondSource).toContain("\\tag #'ppt_verse_motif_1 <c' e' g'>4");
  });

});
