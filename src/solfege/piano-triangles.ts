/**
 * Prime Period Theory (PPT) — Piano Triangle Notation Module
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

import { SOLFEGE_POSITIONS, SOLFEGE_GLYPH_MAP } from './pitch.js';

export type PianoTriangleType = 'D' | 'L' | 'U' | 'R';

export type PianoTrianglePoint = 1 | 2 | 3;

export interface PianoTrianglePitch {
  triangle: PianoTriangleType;
  point: PianoTrianglePoint;
  octave?: number;
}

export interface VertexConfig {
  /** Whether this vertex is active / lit */
  active?: boolean;
  /** Fill color for the vertex circle (e.g. Solfège hex color) */
  color?: string;
  /** Stroke color for the vertex circle */
  strokeColor?: string;
  /** Stroke width for the vertex circle */
  strokeWidth?: number;
  /** Radius of the vertex circle */
  radius?: number;
  /** Shading style for the vertex */
  shading?: 'solid' | 'shaded' | 'outline' | 'ghosted' | 'none';
  /** Optional text label */
  label?: string;
}

export interface PianoTriangleRenderOptions {
  /** Size in pixels (width and height) */
  size?: number;
  /** Stroke color of the triangle boundary */
  strokeColor?: string;
  /** Stroke width of the triangle boundary */
  strokeWidth?: number;
  /** Fill color of the triangle body */
  fillColor?: string;
  /** Vertex circle configurations for points 1, 2, and 3 */
  vertices?: {
    1?: VertexConfig;
    2?: VertexConfig;
    3?: VertexConfig;
  };
  /** Whether to show point digit numbers */
  showPointLabels?: boolean;
  /** Whether to show the triangle letter label below */
  showTriangleLabel?: boolean;
  /** Custom CSS class */
  className?: string;
}

export interface KeySignatureOptions {
  /** Size per triangle in pixels (default: 40) */
  triangleSize?: number;
  /** Gap between triangles in pixels (default: 6) */
  gap?: number;
  /** Whether to show triangle letter labels below */
  showLabels?: boolean;
  /** Dark mode styling */
  darkMode?: boolean;
  /** Custom CSS class name */
  className?: string;
}

/**
 * Mapping from pitch class (0..11, where 0=C, 1=C#, ..., 11=B) to Piano Triangle representation.
 */
export const PITCH_CLASS_TO_PIANO_TRIANGLE: Record<number, { triangle: PianoTriangleType; point: PianoTrianglePoint }> = {
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

/**
 * Mapping from Piano Triangle (type + point) to pitch class (0..11).
 */
export const PIANO_TRIANGLE_TO_PITCH_CLASS: Record<PianoTriangleType, Record<PianoTrianglePoint, number>> = {
  D: { 1: 1, 2: 2, 3: 3 },
  L: { 1: 4, 2: 5, 3: 6 },
  U: { 1: 7, 2: 8, 3: 9 },
  R: { 1: 10, 2: 11, 3: 0 },
};

/**
 * Canonical names and geometric descriptions for each triangle.
 */
export const PIANO_TRIANGLE_METADATA: Record<PianoTriangleType, {
  name: string;
  alias: string;
  pitches: string[];
  shapeDescription: string;
  apexDirection: string;
}> = {
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

/**
 * Normalized 2D vertex coordinates in a 100x100 coordinate box.
 * Matches the physical keyboard geometry.
 */
export const TRIANGLE_VERTEX_COORDINATES: Record<PianoTriangleType, {
  path: string;
  points: Record<PianoTrianglePoint, { x: number; y: number }>;
}> = {
  // Down: Inverted equilateral triangle (apex pointing down at point 2)
  D: {
    path: 'M 15 20 L 85 20 L 50 85 Z',
    points: {
      1: { x: 15, y: 20 }, // C# (top-left raised key)
      2: { x: 50, y: 85 }, // D (bottom central white key)
      3: { x: 85, y: 20 }, // D# (top-right raised key)
    },
  },
  // Left: Right triangle with vertical leg on right (right angle at bottom-right, apex at top-right)
  L: {
    path: 'M 15 80 L 85 80 L 85 20 Z',
    points: {
      1: { x: 15, y: 80 }, // E (bottom-left white key)
      2: { x: 85, y: 80 }, // F (bottom-right white key)
      3: { x: 85, y: 20 }, // F# (top-right raised key)
    },
  },
  // Up: Equilateral triangle (apex pointing up at point 2)
  U: {
    path: 'M 15 80 L 50 15 L 85 80 Z',
    points: {
      1: { x: 15, y: 80 }, // G (bottom-left white key)
      2: { x: 50, y: 15 }, // G# (top central raised key)
      3: { x: 85, y: 80 }, // A (bottom-right white key)
    },
  },
  // Right: Right triangle with vertical leg on left (right angle at bottom-left, apex at top-left)
  R: {
    path: 'M 15 20 L 15 80 L 85 80 Z',
    points: {
      1: { x: 15, y: 20 }, // A# (top-left raised key)
      2: { x: 15, y: 80 }, // B (bottom-left white key)
      3: { x: 85, y: 80 }, // C (bottom-right white key)
    },
  },
};

/**
 * Converts a MIDI note number to its Piano Triangle representation.
 */
export function midiToPianoTrianglePitch(midi: number): PianoTrianglePitch {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const mapping = PITCH_CLASS_TO_PIANO_TRIANGLE[pc];
  return {
    triangle: mapping.triangle,
    point: mapping.point,
    octave,
  };
}

/**
 * Converts a MIDI note number to a Piano Triangle pitch string (e.g. 62 -> "D2", 60 -> "R3").
 */
export function midiToPianoTriangleString(midi: number, includeOctave = false): string {
  const { triangle, point, octave } = midiToPianoTrianglePitch(midi);
  return includeOctave && octave !== undefined ? `${triangle}${point}${octave}` : `${triangle}${point}`;
}

/**
 * Checks if a string is a valid Piano Triangle pitch token (e.g. "D2", "R3", "L1", "U1").
 */
export function isPianoTrianglePitchToken(token: string): boolean {
  return /^[DLUR][1-3](?:\d+)?$/.test(token.trim());
}

/**
 * Parses a Piano Triangle pitch token (e.g. "D2", "R34", "L13").
 */
export function parsePianoTrianglePitchToken(token: string): PianoTrianglePitch {
  const clean = token.trim();
  const match = clean.match(/^([DLUR])([1-3])(\d+)?$/);
  if (!match) {
    throw new Error(`Invalid Piano Triangle pitch token: "${token}"`);
  }
  const triangle = match[1] as PianoTriangleType;
  const point = parseInt(match[2], 10) as PianoTrianglePoint;
  const octave = match[3] ? parseInt(match[3], 10) : undefined;
  return { triangle, point, octave };
}

/**
 * Converts a Piano Triangle pitch token to a concrete MIDI note number.
 * Defaults to octave 4 (Middle C register, C4 = MIDI 60) if unspecified.
 */
export function pianoTriangleToMidi(token: string, defaultOctave = 4): number {
  const { triangle, point, octave } = parsePianoTrianglePitchToken(token);
  const pc = PIANO_TRIANGLE_TO_PITCH_CLASS[triangle][point];
  const oct = octave !== undefined ? octave : defaultOctave;
  return (oct + 1) * 12 + pc;
}

/**
 * Mode interval definitions in semitones relative to tonic (scale degrees 1..7).
 */
export const SCALE_MODE_INTERVALS: Record<string, number[]> = {
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

/**
 * Encodes a heptatonic scale into Piano Triangle notation using Tetrachord Chaining around Tonic:
 * Sequence: [5, 6, 7] (dominant fragment) + [1] (tonic) + [2, 3, 4] (tonic fragment).
 * Adjacent notes within the same triangle are merged into concatenated digits.
 *
 * Examples:
 * - D Major -> "U3R2D12L13U1"
 * - C Major -> "U13R23D2L12"
 */
export function encodePianoTriangleScale(tonicMidi: number, mode = 'ionian'): string {
  const intervals = SCALE_MODE_INTERVALS[mode.toLowerCase()] ?? SCALE_MODE_INTERVALS.ionian;
  const tonicPc = ((tonicMidi % 12) + 12) % 12;

  // Compute 7 pitch classes (indices 0..6 correspond to degrees 1..7)
  const scalePcs = intervals.map(int => (tonicPc + int) % 12);

  // Tetrachord chaining order: [5, 6, 7] + [1] + [2, 3, 4]
  // 1-indexed degrees: 5 -> index 4, 6 -> index 5, 7 -> index 6, 1 -> index 0, 2 -> index 1, 3 -> index 2, 4 -> index 3
  const chainIndices = [4, 5, 6, 0, 1, 2, 3];
  const chainedPcs = chainIndices.map(idx => scalePcs[idx]);

  // Convert to triangle points
  const rawSegments = chainedPcs.map(pc => PITCH_CLASS_TO_PIANO_TRIANGLE[pc]);

  // Merge adjacent points in the same triangle
  const merged: Array<{ triangle: PianoTriangleType; points: number[] }> = [];

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

/**
 * Encodes a chord's pitch sequence into Piano Triangle notation.
 * Merges contiguous points within the same triangle in ascending order.
 *
 * Examples:
 * - C Major (C, E, G): "R3L1U1"
 * - D Major (D, F#, A): "D2L3U3"
 * - D Minor (D, F, A): "D2L2U3"
 * - Dm7 (D, F, A, C): "D2L2U3R3"
 * - Dmaj7 (D, F#, A, C#): "D2L3U3D1"
 * - Dmaj7 with 7th in bass (C#, D, F#, A): "D12L3U3"
 */
export function encodePianoTriangleChord(chordMidiNotes: number[]): string {
  if (!chordMidiNotes || chordMidiNotes.length === 0) return '';

  const rawPoints = chordMidiNotes.map(midi => midiToPianoTrianglePitch(midi));
  const segments: Array<{ triangle: PianoTriangleType; points: number[] }> = [];

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

export interface ParsedPianoTriangleChord {
  segments: Array<{ triangle: PianoTriangleType; points: number[]; isSkipMarker?: boolean }>;
  pitchClasses: number[];
}

/**
 * Parses a Piano Triangle string into constituent segments and pitch classes.
 * Handles skip markers (bare triangle letters with no points).
 */
export function parsePianoTriangleString(encoded: string): ParsedPianoTriangleChord {
  const clean = encoded.trim();
  const segments: Array<{ triangle: PianoTriangleType; points: number[]; isSkipMarker?: boolean }> = [];
  const pitchClasses: number[] = [];

  const regex = /([DLUR])([1-3]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    const triangle = match[1] as PianoTriangleType;
    const digitsStr = match[2];

    if (!digitsStr || digitsStr.length === 0) {
      segments.push({ triangle, points: [], isSkipMarker: true });
    } else {
      const points = digitsStr.split('').map(d => parseInt(d, 10) as PianoTrianglePoint);
      segments.push({ triangle, points });
      for (const pt of points) {
        pitchClasses.push(PIANO_TRIANGLE_TO_PITCH_CLASS[triangle][pt]);
      }
    }
  }

  return { segments, pitchClasses };
}

/**
 * Generates an SVG string for a single Piano Triangle with configurable vertex circles.
 */
export function createPianoTriangleSvg(
  triangle: PianoTriangleType,
  options: PianoTriangleRenderOptions = {}
): string {
  const size = options.size ?? 40;
  const strokeColor = options.strokeColor ?? '#333333';
  const strokeWidth = options.strokeWidth ?? 2;
  const fillColor = options.fillColor ?? 'none';
  const className = options.className ?? 'piano-triangle-svg';

  const geom = TRIANGLE_VERTEX_COORDINATES[triangle];
  const vertices = options.vertices ?? {};

  // Build vertex circles
  const circleElements: string[] = [];

  for (const pt of [1, 2, 3] as PianoTrianglePoint[]) {
    const coords = geom.points[pt];
    const cfg = vertices[pt];
    const isActive = cfg?.active ?? false;
    const radius = cfg?.radius ?? 8;
    const shading = cfg?.shading ?? (isActive ? 'solid' : 'ghosted');
    const color = cfg?.color ?? '#E13610';
    const vStrokeColor = cfg?.strokeColor ?? '#1a1a1a';
    const vStrokeWidth = cfg?.strokeWidth ?? 1.5;

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

export interface PianoTriangleScaleSegment {
  triangle: PianoTriangleType;
  points: PianoTrianglePoint[];
  vertices: Partial<Record<PianoTrianglePoint, {
    active: boolean;
    syllable: string;
    color: string;
    schemeColorVar: string;
  }>>;
}

/**
 * Generates the tetrachord-chained sequence of Piano Triangles representing
 * a Diatonic Key Signature, centered around the tonic with 3 notes to the left [5, 6, 7]
 * and 3 notes to the right [2, 3, 4]. Adjacent notes sharing the same triangle are merged.
 */
export function getScaleTetrachordChainTriangles(
  tonicMidi: number,
  mode = 'ionian'
): PianoTriangleScaleSegment[] {
  const intervals = SCALE_MODE_INTERVALS[mode.toLowerCase()] ?? SCALE_MODE_INTERVALS.ionian;
  // Tetrachord chain degree order: [5, 6, 7] (indices 4, 5, 6), [1] (index 0), [2, 3, 4] (indices 1, 2, 3)
  const chainIndices = [4, 5, 6, 0, 1, 2, 3];
  const tonicPc = ((tonicMidi % 12) + 12) % 12;

  const chainNotes = chainIndices.map((idx) => {
    const semitonesFromDo = intervals[idx];
    const pc = (tonicPc + semitonesFromDo) % 12;
    const syllable = SOLFEGE_POSITIONS[semitonesFromDo];
    const spec = SOLFEGE_GLYPH_MAP[syllable];
    const color = spec ? spec.colorHex : '#E13610';
    const pt = midiToPianoTrianglePitch(60 + pc);
    return {
      pc,
      syllable,
      color,
      schemeColorVar: `color${syllable.replace(/x$/i, '')}`,
      triangle: pt.triangle,
      point: pt.point,
    };
  });

  const segments: PianoTriangleScaleSegment[] = [];
  let currentSegment: PianoTriangleScaleSegment | null = null;

  for (const note of chainNotes) {
    if (!currentSegment || currentSegment.triangle !== note.triangle) {
      currentSegment = {
        triangle: note.triangle,
        points: [note.point],
        vertices: {
          [note.point]: {
            active: true,
            syllable: note.syllable,
            color: note.color,
            schemeColorVar: note.schemeColorVar,
          },
        },
      };
      segments.push(currentSegment);
    } else {
      if (!currentSegment.points.includes(note.point)) {
        currentSegment.points.push(note.point);
      }
      currentSegment.vertices[note.point] = {
        active: true,
        syllable: note.syllable,
        color: note.color,
        schemeColorVar: note.schemeColorVar,
      };
    }
  }

  return segments;
}

/**
 * Generates a full composite SVG rendering of Piano Triangles representing a Diatonic Key Signature,
 * with the tonic in the center and 3 notes to the left and right ([5, 6, 7] + [1] + [2, 3, 4]),
 * with diatonic scale degrees colored in their PPT chromatic Solfège colors.
 */
export function createPianoTriangleKeySignatureSvg(
  tonicMidi: number,
  mode = 'ionian',
  options: KeySignatureOptions = {}
): string {
  const triangleSize = options.triangleSize ?? 40;
  const gap = options.gap ?? 6;
  const showLabels = options.showLabels ?? true;
  const darkMode = options.darkMode ?? false;
  const className = options.className ?? 'piano-triangle-key-signature';

  const segments = getScaleTetrachordChainTriangles(tonicMidi, mode);
  const svgTriangles: string[] = [];

  for (const seg of segments) {
    const vertices: PianoTriangleRenderOptions['vertices'] = {};

    for (const pt of [1, 2, 3] as PianoTrianglePoint[]) {
      const vInfo = seg.vertices[pt];
      if (vInfo) {
        vertices[pt] = {
          active: true,
          color: vInfo.color,
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

    const triSvg = createPianoTriangleSvg(seg.triangle, {
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
