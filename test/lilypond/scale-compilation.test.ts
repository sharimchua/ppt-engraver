import { describe, it, expect } from 'vitest';
import { compileYamlString } from '../../src/compiler/compile.js';

describe('Scale and Key Signature Compilation', () => {
  it('renders Solfège glyph scale signature in header with show: [scaleSignature]', () => {
    const yaml = `
tapestry:
  title: Scale Sig Test
  knot:
    tonic: D4
    scale: DoMe
    engraving:
      show: [scaleSignature, melody]
    weave: main
  weaves:
    main:
      stitch:
        - coil:
            melody: [Do, Re, Me, Fa]
`;
    const compiled = compileYamlString(yaml);
    const poetHeader = compiled.lilypondSource.match(/poet\s*=\s*\\markup\s*([\s\S]*?)\n\s*tagline/)?.[1] ?? '';

    expect(poetHeader).toContain('"Scale:"');
    expect(poetHeader).toContain('make-solfege-glyph');
    expect(poetHeader).not.toContain('make-piano-triangle-stencil');
  });

  it('renders Piano Triangle scale signature in header with show: [scaleSignaturePianoTriangle]', () => {
    const yaml = `
tapestry:
  title: Piano Triangle Scale Sig Test
  knot:
    tonic: D4
    scale: La
    engraving:
      show: [scaleSignaturePianoTriangle, melody]
    weave: main
  weaves:
    main:
      stitch:
        - coil:
            melody: [Do, Re, Me, Fa]
`;
    const compiled = compileYamlString(yaml);
    const poetHeader = compiled.lilypondSource.match(/poet\s*=\s*\\markup\s*([\s\S]*?)\n\s*tagline/)?.[1] ?? '';

    expect(poetHeader).toContain('"Scale:"');
    expect(poetHeader).toContain('make-piano-triangle-stencil');
    expect(poetHeader).not.toContain('make-solfege-glyph');
  });

  it('renders single composite Scale row when both scaleSignature and scaleSignaturePianoTriangle are active', () => {
    const yaml = `
tapestry:
  title: Composite Scale Row Test
  knot:
    tonic: D4
    scale: DoMe
    engraving:
      show: [scaleSignature, scaleSignaturePianoTriangle, melody]
    weave: main
  weaves:
    main:
      stitch:
        - coil:
            melody: [Do, Re, Me, Fa]
`;
    const compiled = compileYamlString(yaml);
    const poetHeader = compiled.lilypondSource.match(/poet\s*=\s*\\markup\s*([\s\S]*?)\n\s*tagline/)?.[1] ?? '';

    // Header should contain both stencils under a single Scale: row
    expect(poetHeader).toContain('"Scale:"');
    expect(poetHeader).toContain('make-solfege-glyph');
    expect(poetHeader).toContain('make-piano-triangle-stencil');
  });

  it('controls traditional 5-line staff key signature visibility with show: [keySignature]', () => {
    const yamlWithKey = `
tapestry:
  title: Staff Key Sig Active
  knot:
    tonic: D4
    scale: La
    engraving:
      show: [keySignature, melody]
    weave: main
  weaves:
    main:
      stitch:
        - coil:
            melody: [Do, Re, Me, Fa]
`;
    const compiledWithKey = compileYamlString(yamlWithKey);

    expect(compiledWithKey.lilypondSource).toContain('\\key d \\minor');
    expect(compiledWithKey.lilypondSource).not.toContain('\\omit Staff.KeySignature');

    const yamlWithoutKey = `
tapestry:
  title: Staff Key Sig Omitted
  knot:
    tonic: D4
    scale: La
    engraving:
      show: [melody]
    weave: main
  weaves:
    main:
      stitch:
        - coil:
            melody: [Do, Re, Me, Fa]
`;
    const compiledWithoutKey = compileYamlString(yamlWithoutKey);

    expect(compiledWithoutKey.lilypondSource).toContain('\\key d \\minor');
    expect(compiledWithoutKey.lilypondSource).toContain('\\omit Staff.KeySignature');
  });

  it('emits mid-score key signature changes across weave boundaries with different scales', () => {
    const yaml = `
tapestry:
  title: Mid-Score Scale Change
  knot:
    tonic: D4
    engraving:
      show: [keySignature, melody]
    weave: main
  weaves:
    main:
      stitch:
        - weave:
            id: sectionA
            scale: Do
            stitch:
              - coil:
                  melody: [Do, Re, Mi, Fa]
        - weave:
            id: sectionB
            scale: La
            stitch:
              - coil:
                  melody: [Do, Re, Me, Fa]
`;
    const compiled = compileYamlString(yaml);

    // First weave: sectionA (Do -> major)
    expect(compiled.lilypondSource).toContain('\\key d \\major');
    // Second weave: sectionB (La -> minor)
    expect(compiled.lilypondSource).toContain('\\key d \\minor');
  });
});
