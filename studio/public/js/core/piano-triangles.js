/**
 * Core Piano Triangle Notation Module for Studio
 *
 * Implements physical keyboard topography and hand-shape ergonomics based on
 * the 4 Piano Triangles (Down, Left, Up, Right) partitioning the 12 chromatic pitches.
 *
 * Topographical partitioning:
 * - Down (D): C# (1), D (2), D# (3) [Inverted equilateral triangle, apex pointing down]
 * - Left (L): E (1), F (2), F# (3)   [Right triangle, right angle on right, apex up]
 * - Up   (U): G (1), G# (2), A (3)   [Equilateral triangle, apex up]
 * - Right (R): A# (1), B (2), C (3)  [Right triangle, right angle on left, apex up]
 *
 * Spec: https://ppt.midlifemuso.com/reference/piano-triangles/
 */

import { SOLFEGE_GLYPH_SPECS } from './glyphs.js';

export const PITCH_CLASS_TO_PIANO_TRIANGLE = {
  0: { triangle: 'R', point: 3 },  // C
  1: { triangle: 'D', point: 1 },  // C#
  2: { triangle: 'D', point: 2 },  // D
  3: { triangle: 'D', point: 3 },  // D#
  4: { triangle: 'L', point: 1 },  // E
  5: { triangle: 'L', point: 2 },  // F
  6: { triangle: 'L', point: 3 },  // F#
  7: { triangle: 'U', point: 1 },  // G
  8: { triangle: 'U', point: 2 },  // G#
  9: { triangle: 'U', point: 3 },  // A
  10: { triangle: 'R', point: 1 }, // A# / Bb
  11: { triangle: 'R', point: 2 }, // B
};

export const PIANO_TRIANGLE_TO_PITCH_CLASS = {
  D: { 1: 1, 2: 2, 3: 3 },
  L: { 1: 4, 2: 5, 3: 6 },
  U: { 1: 7, 2: 8, 3: 9 },
  R: { 1: 10, 2: 11, 3: 0 },
};

export const PIANO_TRIANGLE_METADATA = {
  D: {
    name: 'Down',
    alias: 'D',
    pitches: ['C#', 'D', 'D#'],
    shapeDescription: 'Inverted equilateral triangle',
    apexDirection: 'Points down (into the central white key)',
  },
  L: {
    name: 'Left',
    alias: 'L',
    pitches: ['E', 'F', 'F#'],
    shapeDescription: 'Right triangle (right angle on right)',
    apexDirection: 'Points up',
  },
  U: {
    name: 'Up',
    alias: 'U',
    pitches: ['G', 'G#', 'A'],
    shapeDescription: 'Equilateral triangle',
    apexDirection: 'Points up',
  },
  R: {
    name: 'Right',
    alias: 'R',
    pitches: ['A#', 'B', 'C'],
    shapeDescription: 'Right triangle (right angle on left)',
    apexDirection: 'Points up',
  },
};

export const TRIANGLE_VERTEX_COORDINATES = {
  D: {
    path: 'M 15 20 L 85 20 L 50 85 Z',
    points: {
      1: { x: 15, y: 20 },
      2: { x: 50, y: 85 },
      3: { x: 85, y: 20 },
    },
  },
  L: {
    path: 'M 15 80 L 85 80 L 85 20 Z',
    points: {
      1: { x: 15, y: 80 },
      2: { x: 85, y: 80 },
      3: { x: 85, y: 20 },
    },
  },
  U: {
    path: 'M 15 80 L 50 15 L 85 80 Z',
    points: {
      1: { x: 15, y: 80 },
      2: { x: 50, y: 15 },
      3: { x: 85, y: 80 },
    },
  },
  R: {
    path: 'M 15 20 L 15 80 L 85 80 Z',
    points: {
      1: { x: 15, y: 20 },
      2: { x: 15, y: 80 },
      3: { x: 85, y: 80 },
    },
  },
};

export const SOLFEGE_POSITIONS = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti',
];

export const SCALE_MODE_INTERVALS = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export function midiToPianoTrianglePitch(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const mapping = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
  return {
    triangle: mapping.triangle,
    point: mapping.point,
    octave,
  };
}

export function midiToPianoTriangleString(midi, includeOctave = false) {
  const { triangle, point, octave } = midiToPianoTrianglePitch(midi);
  return includeOctave && octave !== undefined ? `${triangle}${point}${octave}` : `${triangle}${point}`;
}

export function encodePianoTriangleScale(tonicMidi, mode = 'ionian') {
  const intervals = SCALE_MODE_INTERVALS[mode.toLowerCase()] || SCALE_MODE_INTERVALS.ionian;
  const tonicPc = ((tonicMidi % 12) + 12) % 12;

  const scalePcs = intervals.map(int => (tonicPc + int) % 12);
  const chainIndices = [4, 5, 6, 0, 1, 2, 3];
  const chainedPcs = chainIndices.map(idx => scalePcs[idx]);
  const rawSegments = chainedPcs.map(pc => PITCH_CLASS_TO_PIANO_TRIANGLE[pc]);

  const merged = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && last.triangle === seg.triangle) {
      if (!last.points.includes(seg.point)) {
        last.points.push(seg.point);
        last.points.sort((a, b) => a - b);
      }
    } else {
      merged.push({ triangle: seg.triangle, points: [seg.point] });
    }
  }

  return merged.map(m => `${m.triangle}${m.points.join('')}`).join('');
}

export function encodePianoTriangleChord(chordMidiNotes) {
  if (!chordMidiNotes || chordMidiNotes.length === 0) return '';

  const rawPoints = chordMidiNotes.map(midi => midiToPianoTrianglePitch(midi));
  const segments = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const current = rawPoints[i];
    const prev = rawPoints[i - 1];

    if (prev && prev.triangle === current.triangle) {
      const lastSeg = segments[segments.length - 1];
      if (!lastSeg.points.includes(current.point)) {
        lastSeg.points.push(current.point);
        lastSeg.points.sort((a, b) => a - b);
      }
    } else {
      segments.push({ triangle: current.triangle, points: [current.point] });
    }
  }

  return segments.map(s => `${s.triangle}${s.points.join('')}`).join('');
}

export function createPianoTriangleSvg(triangle, options = {}) {
  const size = options.size || 40;
  const strokeColor = options.strokeColor || '#333333';
  const strokeWidth = options.strokeWidth || 2;
  const fillColor = options.fillColor || 'none';
  const className = options.className || 'piano-triangle-svg';

  const geom = TRIANGLE_VERTEX_COORDINATES[triangle];
  const vertices = options.vertices || {};

  const circleElements = [];

  for (const pt of [1, 2, 3]) {
    const coords = geom.points[pt];
    const cfg = vertices[pt];
    const isActive = cfg ? (cfg.active ?? false) : false;
    const radius = cfg ? (cfg.radius || 8) : 8;
    const shading = cfg ? (cfg.shading || (isActive ? 'solid' : 'ghosted')) : (isActive ? 'solid' : 'ghosted');
    const color = cfg ? (cfg.color || '#E13610') : '#E13610';
    const vStrokeColor = cfg ? (cfg.strokeColor || '#1a1a1a') : '#1a1a1a';
    const vStrokeWidth = cfg ? (cfg.strokeWidth || 1.5) : 1.5;

    let fillAttr = 'none';
    let strokeAttr = vStrokeColor;
    let opacityAttr = '1.0';

    if (shading === 'solid') {
      fillAttr = color;
    } else if (shading === 'shaded') {
      fillAttr = color;
      opacityAttr = '0.5';
    } else if (shading === 'outline') {
      fillAttr = 'none';
      strokeAttr = color;
    } else if (shading === 'ghosted') {
      fillAttr = 'none';
      strokeAttr = '#cccccc';
      opacityAttr = '0.4';
    } else if (shading === 'none') {
      continue;
    }

    circleElements.push(
      `<circle cx="${coords.x}" cy="${coords.y}" r="${radius}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${vStrokeWidth}" opacity="${opacityAttr}" />`
    );

    if (options.showPointLabels && isActive) {
      circleElements.push(
        `<text x="${coords.x}" y="${coords.y + 3}" text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="bold" fill="#ffffff">${pt}</text>`
      );
    }
  }

  const labelElement = options.showTriangleLabel
    ? `<text x="50" y="98" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="bold" fill="${strokeColor}">${triangle}</text>`
    : '';

  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" class="${className}" style="display:inline-block; vertical-align:middle; overflow:visible;">
      <path d="${geom.path}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
      ${circleElements.join('\n')}
      ${labelElement}
    </svg>
  `.trim();
}

export function createPianoTriangleKeySignatureSvg(tonicMidi, mode = 'ionian', options = {}) {
  const triangleSize = options.triangleSize || 40;
  const gap = options.gap || 6;
  const showLabels = options.showLabels !== false;
  const darkMode = options.darkMode || false;
  const className = options.className || 'piano-triangle-key-signature';

  const intervals = SCALE_MODE_INTERVALS[mode.toLowerCase()] || SCALE_MODE_INTERVALS.ionian;
  const tonicPc = ((tonicMidi % 12) + 12) % 12;

  const diatonicMap = new Map();
  for (let i = 0; i < intervals.length; i++) {
    const semitonesFromDo = intervals[i];
    const pc = (tonicPc + semitonesFromDo) % 12;
    const syllable = SOLFEGE_POSITIONS[semitonesFromDo];
    const spec = SOLFEGE_GLYPH_SPECS[syllable];
    const color = spec ? spec.colorHex : '#E13610';
    diatonicMap.set(pc, { syllable, color });
  }

  const triangleTypes = ['D', 'L', 'U', 'R'];
  const svgTriangles = [];

  for (const tri of triangleTypes) {
    const vertices = {};

    for (const pt of [1, 2, 3]) {
      const pc = PIANO_TRIANGLE_TO_PITCH_CLASS[tri][pt];
      const diatonicInfo = diatonicMap.get(pc);

      if (diatonicInfo) {
        vertices[pt] = {
          active: true,
          color: diatonicInfo.color,
          shading: 'solid',
          strokeColor: darkMode ? '#ffffff' : '#1e2127',
          strokeWidth: 1.5,
          radius: 8.5,
        };
      } else {
        vertices[pt] = {
          active: false,
          shading: 'ghosted',
          strokeColor: darkMode ? '#555555' : '#d0d0d0',
          strokeWidth: 1,
          radius: 6,
        };
      }
    }

    const triSvg = createPianoTriangleSvg(tri, {
      size: triangleSize,
      strokeColor: darkMode ? '#cccccc' : '#333333',
      strokeWidth: 2.2,
      fillColor: darkMode ? '#22252b' : '#fafafa',
      vertices,
      showTriangleLabel: showLabels,
    });

    svgTriangles.push(triSvg);
  }

  return `
    <div class="${className}" style="display:inline-flex; align-items:center; gap:${gap}px; vertical-align:middle;">
      ${svgTriangles.join('\n')}
    </div>
  `.trim();
}
