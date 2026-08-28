import { describe, it, expect } from 'vitest';
import {
  PITCH_CLASS_TO_PIANO_TRIANGLE,
  PIANO_TRIANGLE_TO_PITCH_CLASS,
  PIANO_TRIANGLE_METADATA,
  TRIANGLE_VERTEX_COORDINATES,
  midiToPianoTrianglePitch,
  midiToPianoTriangleString,
  isPianoTrianglePitchToken,
  parsePianoTrianglePitchToken,
  pianoTriangleToMidi,
  encodePianoTriangleScale,
  encodePianoTriangleChord,
  parsePianoTriangleString,
  createPianoTriangleSvg,
  createPianoTriangleKeySignatureSvg,
  getScaleTetrachordChainTriangles,
} from '../../src/solfege/piano-triangles.js';
import { canonicalChordToPianoTriangle } from '../../src/lilypond/pitch.js';
import { compileToLilyPond } from '../../src/lilypond/compiler.js';
import type { Onset } from '../../src/schema/onset.js';

describe('Piano Triangle Notation Engine', () => {
  describe('Topographical Pitch Class Mappings', () => {
    it('maps all 12 chromatic pitch classes to their correct triangle and point', () => {
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[0]).toEqual({ triangle: 'R', point: 3 });  // C
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[1]).toEqual({ triangle: 'D', point: 1 });  // C#
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[2]).toEqual({ triangle: 'D', point: 2 });  // D
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[3]).toEqual({ triangle: 'D', point: 3 });  // D#
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[4]).toEqual({ triangle: 'L', point: 1 });  // E
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[5]).toEqual({ triangle: 'L', point: 2 });  // F
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[6]).toEqual({ triangle: 'L', point: 3 });  // F#
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[7]).toEqual({ triangle: 'U', point: 1 });  // G
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[8]).toEqual({ triangle: 'U', point: 2 });  // G#
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[9]).toEqual({ triangle: 'U', point: 3 });  // A
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[10]).toEqual({ triangle: 'R', point: 1 }); // A# / Bb
      expect(PITCH_CLASS_TO_PIANO_TRIANGLE[11]).toEqual({ triangle: 'R', point: 2 }); // B
    });

    it('reverse maps each triangle and point to its corresponding pitch class', () => {
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.D[1]).toBe(1);  // C#
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.D[2]).toBe(2);  // D
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.D[3]).toBe(3);  // D#
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.L[1]).toBe(4);  // E
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.L[2]).toBe(5);  // F
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.L[3]).toBe(6);  // F#
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.U[1]).toBe(7);  // G
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.U[2]).toBe(8);  // G#
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.U[3]).toBe(9);  // A
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.R[1]).toBe(10); // A#
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.R[2]).toBe(11); // B
      expect(PIANO_TRIANGLE_TO_PITCH_CLASS.R[3]).toBe(0);  // C
    });

    it('provides accurate geometric metadata and shape descriptions', () => {
      expect(PIANO_TRIANGLE_METADATA.D.name).toBe('Down');
      expect(PIANO_TRIANGLE_METADATA.D.pitches).toEqual(['C#', 'D', 'D#']);
      expect(PIANO_TRIANGLE_METADATA.L.name).toBe('Left');
      expect(PIANO_TRIANGLE_METADATA.L.pitches).toEqual(['E', 'F', 'F#']);
      expect(PIANO_TRIANGLE_METADATA.U.name).toBe('Up');
      expect(PIANO_TRIANGLE_METADATA.U.pitches).toEqual(['G', 'G#', 'A']);
      expect(PIANO_TRIANGLE_METADATA.R.name).toBe('Right');
      expect(PIANO_TRIANGLE_METADATA.R.pitches).toEqual(['A#', 'B', 'C']);
    });
  });

  describe('MIDI & Pitch Token Conversion', () => {
    it('converts MIDI notes to piano triangle pitch objects', () => {
      expect(midiToPianoTrianglePitch(60)).toEqual({ triangle: 'R', point: 3, octave: 4 }); // C4
      expect(midiToPianoTrianglePitch(62)).toEqual({ triangle: 'D', point: 2, octave: 4 }); // D4
      expect(midiToPianoTrianglePitch(67)).toEqual({ triangle: 'U', point: 1, octave: 4 }); // G4
      expect(midiToPianoTrianglePitch(64)).toEqual({ triangle: 'L', point: 1, octave: 4 }); // E4
    });

    it('converts MIDI notes to string representations', () => {
      expect(midiToPianoTriangleString(60)).toBe('R3');
      expect(midiToPianoTriangleString(60, true)).toBe('R34');
      expect(midiToPianoTriangleString(62)).toBe('D2');
      expect(midiToPianoTriangleString(62, true)).toBe('D24');
    });

    it('validates and parses piano triangle pitch tokens', () => {
      expect(isPianoTrianglePitchToken('D2')).toBe(true);
      expect(isPianoTrianglePitchToken('R34')).toBe(true);
      expect(isPianoTrianglePitchToken('L1')).toBe(true);
      expect(isPianoTrianglePitchToken('U3')).toBe(true);
      expect(isPianoTrianglePitchToken('X2')).toBe(false);
      expect(isPianoTrianglePitchToken('D4')).toBe(false);

      expect(parsePianoTrianglePitchToken('D2')).toEqual({ triangle: 'D', point: 2, octave: undefined });
      expect(parsePianoTrianglePitchToken('R34')).toEqual({ triangle: 'R', point: 3, octave: 4 });
    });

    it('converts piano triangle pitch tokens to concrete MIDI note numbers', () => {
      expect(pianoTriangleToMidi('R3')).toBe(60);   // C4 default
      expect(pianoTriangleToMidi('R34')).toBe(60);  // C4
      expect(pianoTriangleToMidi('D2')).toBe(62);   // D4
      expect(pianoTriangleToMidi('D23')).toBe(50);  // D3
      expect(pianoTriangleToMidi('U15')).toBe(79);  // G5
    });
  });

  describe('Scale Encoding via Tetrachord Chaining', () => {
    it('encodes D Major as U3R2D12L13U1 matching the specification worked example', () => {
      // D Major (tonic D4 = MIDI 62): [A, B, C#] + [D] + [E, F#, G] -> U3 + R2 + D1 + D2 + L1 + L3 + U1 -> U3R2D12L13U1
      const encoded = encodePianoTriangleScale(62, 'ionian');
      expect(encoded).toBe('U3R2D12L13U1');
    });

    it('encodes C Major as U13R23D2L12 matching the specification worked example', () => {
      // C Major (tonic C4 = MIDI 60): [G, A, B] + [C] + [D, E, F] -> U1 + U3 + R2 + R3 + D2 + L1 + L2 -> U13R23D2L12
      const encoded = encodePianoTriangleScale(60, 'ionian');
      expect(encoded).toBe('U13R23D2L12');
    });

    it('encodes A Minor (Aeolian)', () => {
      // A Natural Minor (tonic A3 = MIDI 57): pitches E(L1), F(L2), G(U1), A(U3), B(R2), C(R3), D(D2)
      // Chaining [5,6,7] + [1] + [2,3,4] -> [E, F, G] + [A] + [B, C, D]
      // L1, L2, U1 + U3 + R2, R3, D2 -> L12U13R23D2
      const encoded = encodePianoTriangleScale(57, 'aeolian');
      expect(encoded).toBe('L12U13R23D2');
    });
  });

  describe('Chord Encoding & Inversions', () => {
    it('encodes standard triads according to specification', () => {
      // C Major triad (C4, E4, G4 = [60, 64, 67]) -> R3L1U1
      expect(encodePianoTriangleChord([60, 64, 67])).toBe('R3L1U1');

      // D Major triad (D4, F#4, A4 = [62, 66, 69]) -> D2L3U3
      expect(encodePianoTriangleChord([62, 66, 69])).toBe('D2L3U3');

      // D Minor triad (D4, F4, A4 = [62, 65, 69]) -> D2L2U3
      expect(encodePianoTriangleChord([62, 65, 69])).toBe('D2L2U3');
    });

    it('encodes 7th chords and voicings according to specification', () => {
      // Dm7 close position (D4, F4, A4, C5 = [62, 65, 69, 72]) -> D2L2U3R3
      expect(encodePianoTriangleChord([62, 65, 69, 72])).toBe('D2L2U3R3');

      // Dmaj7 root position (D4, F#4, A4, C#5 = [62, 66, 69, 73]) -> D2L3U3D1
      expect(encodePianoTriangleChord([62, 66, 69, 73])).toBe('D2L3U3D1');

      // Dmaj7 with 7th in the bass (C#4, D4, F#4, A4 = [61, 62, 66, 69]) -> D12L3U3
      expect(encodePianoTriangleChord([61, 62, 66, 69])).toBe('D12L3U3');
    });

    it('parses piano triangle chord strings including clusters and skip markers', () => {
      const parsed = parsePianoTriangleString('D12L3U3');
      expect(parsed.segments).toEqual([
        { triangle: 'D', points: [1, 2] },
        { triangle: 'L', points: [3] },
        { triangle: 'U', points: [3] },
      ]);
      expect(parsed.pitchClasses).toEqual([1, 2, 6, 9]);

      const skipParsed = parsePianoTriangleString('L3DD1');
      expect(skipParsed.segments).toEqual([
        { triangle: 'L', points: [3] },
        { triangle: 'D', points: [], isSkipMarker: true },
        { triangle: 'D', points: [1] },
      ]);
    });

    it('translates Solfège chord tokens to Piano Triangle notation via canonicalChordToPianoTriangle', () => {
      // In C (Do = 60)
      expect(canonicalChordToPianoTriangle('Do', 60)).toBe('R3L1U1');      // C major: C, E, G
      expect(canonicalChordToPianoTriangle('DoMe', 60)).toBe('R3D3U1');    // C minor: C, Eb, G
      expect(canonicalChordToPianoTriangle('DoTe', 60)).toBe('R3L1U1R1');  // C7: C, E, G, Bb

      // In D (Do = 62)
      expect(canonicalChordToPianoTriangle('Do', 62)).toBe('D2L3U3');      // D major: D, F#, A
      expect(canonicalChordToPianoTriangle('DoMe', 62)).toBe('D2L2U3');    // D minor: D, F, A
      expect(canonicalChordToPianoTriangle('DoMeTe', 62)).toBe('D2L2U3R3'); // Dm7: D, F, A, C
    });
  });

  describe('Geometric Rendering & Configurable Vertex Circles', () => {
    it('creates valid SVG markup for the 4 triangle geometries', () => {
      const downSvg = createPianoTriangleSvg('D', { size: 50 });
      expect(downSvg).toContain('<svg');
      expect(downSvg).toContain(TRIANGLE_VERTEX_COORDINATES.D.path);

      const leftSvg = createPianoTriangleSvg('L', { size: 50 });
      expect(leftSvg).toContain(TRIANGLE_VERTEX_COORDINATES.L.path);

      const upSvg = createPianoTriangleSvg('U', { size: 50 });
      expect(upSvg).toContain(TRIANGLE_VERTEX_COORDINATES.U.path);

      const rightSvg = createPianoTriangleSvg('R', { size: 50 });
      expect(rightSvg).toContain(TRIANGLE_VERTEX_COORDINATES.R.path);
    });

    it('configures active vertex circles with custom colors and shading', () => {
      const svg = createPianoTriangleSvg('D', {
        size: 60,
        vertices: {
          1: { active: true, color: '#F98016', shading: 'solid' }, // C#
          2: { active: true, color: '#E13610', shading: 'solid' }, // D
          3: { active: false, shading: 'ghosted' },                 // D#
        },
      });

      expect(svg).toContain('fill="#F98016"');
      expect(svg).toContain('fill="#E13610"');
      expect(svg).toContain('opacity="0.4"');
    });

    it('generates a composite Diatonic Key Signature SVG with all 4 triangles', () => {
      // D Major: D, E, F#, G, A, B, C#
      const keySigSvg = createPianoTriangleKeySignatureSvg(62, 'ionian', {
        triangleSize: 36,
        gap: 6,
        showLabels: true,
      });

      expect(keySigSvg).toContain('class="piano-triangle-key-signature"');
      // D Major tetrachord chain has 5 triangle segments: U3, R2, D12, L13, U1
      const svgCount = (keySigSvg.match(/<svg/g) || []).length;
      expect(svgCount).toBe(5);

      // Verify Solfège colors are present in diatonic vertices
      expect(keySigSvg).toContain('#E13610'); // Do color (Red)
      expect(keySigSvg).toContain('#F98016'); // Re color (Orange)
      expect(keySigSvg).toContain('#43A440'); // Fa color (Green)
    });

    it('computes tetrachord-chained key signature triangles centered around tonic', () => {
      // D Major: [5, 6, 7] + [1] + [2, 3, 4] -> U3, R2, D12, L13, U1
      const segments = getScaleTetrachordChainTriangles(62, 'ionian');
      expect(segments.map((s) => ({ tri: s.triangle, pts: s.points }))).toEqual([
        { tri: 'U', pts: [3] },
        { tri: 'R', pts: [2] },
        { tri: 'D', pts: [1, 2] },
        { tri: 'L', pts: [1, 3] },
        { tri: 'U', pts: [1] },
      ]);
    });
  });

  describe('LilyPond Engraving Integration', () => {
    it('compiles chord spellings in Piano Triangle notation when showChordTriangles is true', () => {
      const onsets: Onset[] = [
        {
          onsetIndex: 1,
          voiceIndex: 1,
          tag: 'test_1',
          weaveId: 'w',
          coilId: 'c1',
          scaleDegree: 'Do',
          midiNote: 62,
          chordTones: ['D4', 'F#4', 'A4'],
          chordMidi: [62, 66, 69],
          chordRoot: 'Do',
          durationBeats: 4,
        },
        {
          onsetIndex: 2,
          voiceIndex: 1,
          tag: 'test_2',
          weaveId: 'w',
          coilId: 'c2',
          scaleDegree: 'Re',
          midiNote: 64,
          chordTones: ['E4', 'G4', 'B4'],
          chordMidi: [64, 67, 71],
          chordRoot: 'ReMe',
          durationBeats: 4,
        },
      ];

      const lyOutput = compileToLilyPond(onsets, {
        doPitch: 'D4',
        showChordTriangles: true,
      });

      // D major triad (D, F#, A) in D -> D2 (Do), L3 (Mi), U3 (So)
      expect(lyOutput).toContain('chordTrianglesVoice');
      expect(lyOutput).toContain('make-piano-triangle-stencil "D" #f colorDo #f');
      expect(lyOutput).toContain('make-piano-triangle-stencil "L" #f #f colorMi');
      expect(lyOutput).toContain('make-piano-triangle-stencil "U" #f #f colorSo');

      const lyStandardOutput = compileToLilyPond(onsets, {
        doPitch: 'D4',
        showChordNames: true,
      });
      expect(lyStandardOutput).toContain('chordNamesVoice');
      expect(lyStandardOutput).toContain('<d\' fis\' a\'>1');
      expect(lyStandardOutput).not.toContain('chordTrianglesVoice');
    });

    it('formats single-triangle tonic anchor when keyAnchorStyle is pianoTriangle or both', () => {
      const onsets: Onset[] = [
        {
          onsetIndex: 1,
          voiceIndex: 1,
          tag: 'test_1',
          weaveId: 'w',
          coilId: 'c',
          scaleDegree: 'Do',
          midiNote: 62,
          chordTones: ['D4'],
          chordMidi: [62],
          durationBeats: 4,
        },
      ];

      const lyPtAnchor = compileToLilyPond(onsets, {
        doPitch: 'D4',
        showKeyAnchor: true,
        keyAnchorStyle: 'pianoTriangle',
      });
      // D is D2 -> triangle D with point 2 in colorDo
      expect(lyPtAnchor).toContain('\\stencil #(make-piano-triangle-stencil "D" #f colorDo #f)');

      const lyBothAnchor = compileToLilyPond(onsets, {
        doPitch: 'D4',
        showKeyAnchor: true,
        keyAnchorStyle: 'both',
      });
      expect(lyBothAnchor).toContain('\\stencil #(make-piano-triangle-stencil "D" #f colorDo #f)');
      expect(lyBothAnchor).toContain('" = D ("');
    });

    it('renders tetrachord-chained Key Signature in header when showKeySignature is true', () => {
      const onsets: Onset[] = [
        {
          onsetIndex: 1,
          voiceIndex: 1,
          tag: 'test_1',
          weaveId: 'w',
          coilId: 'c',
          scaleDegree: 'Do',
          midiNote: 62,
          chordTones: ['D4'],
          chordMidi: [62],
          durationBeats: 4,
        },
      ];

      const ly = compileToLilyPond(onsets, {
        doPitch: 'D4',
        showKeySignature: true,
      });

      expect(ly).toContain('"Key:"');
      expect(ly).toContain('make-piano-triangle-stencil');
      expect(ly).not.toContain('"(D2)"');
    });
  });
});
