import { describe, it, expect } from 'vitest';
import { parseTapestryYaml } from '../../src/parser/yaml-loader.js';

describe('YAML Loader Schema Validation Error Reporting', () => {
  it('formats invalid enum values with allowed options and path', () => {
    const yaml = `
tapestry:
  knot:
    tonic: Eb4
    engraving:
      show:
        - melody
        - unknownElement
  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [Do]
`;
    expect(() => parseTapestryYaml(yaml)).toThrowError(/Invalid value "unknownElement"/);
    expect(() => parseTapestryYaml(yaml)).toThrowError(/tapestry\.knot\.engraving\.show\[1\]/);
    expect(() => parseTapestryYaml(yaml)).toThrowError(/Allowed values:/);
  });

  it('formats invalid pitch names clearly', () => {
    const yaml = `
tapestry:
  knot:
    tonic: Z9
  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [Do]
`;
    expect(() => parseTapestryYaml(yaml)).toThrowError(/tapestry\.knot\.tonic/);
    expect(() => parseTapestryYaml(yaml)).toThrowError(/Must be a pitch name/);
  });

  it('formats empty collections clearly', () => {
    const yaml = `
tapestry:
  weave:
    id: song
    children: []
`;
    expect(() => parseTapestryYaml(yaml)).toThrowError(/tapestry\.weave\.children/);
    expect(() => parseTapestryYaml(yaml)).toThrowError(/Cannot be empty/);
  });

  it('formats invalid melody solfege clearly', () => {
    const yaml = `
tapestry:
  weave:
    id: song
    children:
      - coil:
          id: c1
          melody: [InvalidSyllable]
`;
    expect(() => parseTapestryYaml(yaml)).toThrowError(/tapestry\.weave\.children\[0\]\.coil\.melody\[0\]/);
  });
});
