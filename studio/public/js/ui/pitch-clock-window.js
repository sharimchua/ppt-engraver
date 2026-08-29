/**
 * Pitch Clock Pedagogical Reference Floating Window Controller
 * 
 * Manages the draggable/resizable floating pitch clock window in PPT Studio,
 * providing real-time multi-representation 12-TET geometry for teaching & reference.
 */

import { state } from '../state.js';

// Canonical Uniform Solfège SVG Paths
const PATH_BASE = 'M 26.2,80.6 L 38.9,67.4 L 55.9,49.8 L 75,30.2 L 84.8,0 L 75,-30.2 L 71.4,-41.2 L 68.6,-49.8 L 40.5,-70.2 L 26.2,-80.6 L 0,-84.8 L -26.2,-80.6 L -40.5,-70.2 L -68.6,-49.8 L -71.4,-41.2 L -75,-30.2 L -84.8,0 L -75,30.2 L -55.9,49.8 L -38.9,67.4 L -26.2,80.6 L -25,43.2 L -33,38.1 L -40.7,29.2 L -44,25.4 L -47.3,21.6 L -48.3,14.2 L -50.4,0 L -48.3,-14.2 L -44.5,-22.6 L -39.3,-34 L -33,-38.1 L -25,-43.2 L -20.9,-45.8 L -14.7,-49.8 L 0,-50.4 L 14.7,-49.8 L 20.9,-45.8 L 25,-43.2 L 33,-38.1 L 39.3,-34 L 44.5,-22.6 L 48.3,-14.2 L 50.4,0 L 48.3,14.2 L 47.3,21.6 L 44,25.4 L 40.7,29.2 L 33,38.1 L 25,43.2 Z';
const PATH_SHARP = 'M 0,100 L 0,80.7 L 0.1,80.6 L 26.2,80.6 L 38.9,67.4 L 44.7,61.5 L 46.2,59.9 L 55.9,49.8 L 28.8,49.8 L 14.8,74 L 11,80.6 L 0,80.6 L 0,52 L 7.2,49.9 L 14.6,49.9 L 14.7,49.8 L 7.3,49.8 L 20.9,45.8 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -25.7,44.4 L -28.8,49.8 L -56,49.8 L -66.8,38.6 L -69.7,35.6 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 81.1,40.8 L 86.3,49.8 L 86.6,50 A 100,100 0 0 1 58.8,80.9 A 100,100 0 0 1 50,86.6 A 100,100 0 0 1 0,100 Z';
const PATH_FLAT = 'M 0,100 A 100,100 0 0 1 -50,86.6 A 100,100 0 0 1 -58.8,80.9 A 100,100 0 0 1 -86.6,50 L -86.3,49.8 L -81.1,40.8 L -75,30.2 L -84.8,0 L -75,-30.2 L -71.4,-41.2 L -68.6,-49.8 L -40.5,-70.2 L -26.2,-80.6 L 26.2,-80.6 L 11,-80.6 L 26.2,-80.6 L 40.5,-70.2 L 68.6,-49.8 L 71.4,-41.2 L 75,-30.2 L 84.8,0 L 75,30.2 L 69.7,35.6 L 66.8,38.6 L 55.9,49.8 L 28.8,49.8 L 25.7,44.4 L 25,43.2 L 33,38.1 L 40.7,29.2 L 42.4,27.2 L 44,25.4 L 47.3,21.6 L 48,16.5 L 48.3,14.2 L 50.4,0 L 51.4,-7.4 L 48.3,-14.2 L 44.5,-22.6 L 43.4,-25 L 42.4,-27.2 L 39.3,-34 L 37.1,-35.4 L 33,-38.1 L 25,-43.2 L 20.9,-45.8 L 14.7,-49.8 L 14.6,-49.9 L -14.6,-49.9 L -14.7,-49.8 L -20.9,-45.8 L -25,-43.2 L -33,-38.1 L -37.1,-35.4 L -39.3,-34 L -42.4,-27.2 L -43.4,-25 L -44.5,-22.6 L -48.3,-14.2 L -51.4,-7.4 L -50.4,0 L -48.3,14.2 L -48,16.5 L -47.3,21.6 L -44,25.4 L -42.4,27.2 L -40.7,29.2 L -33,38.1 L -25,43.2 L -20.9,45.8 L -7.3,49.8 L -14.7,49.8 L -14.6,49.9 L -7.2,49.9 L 0,52 L 0,80.6 L -11,80.6 L -14.8,74 L -28.8,49.8 L -56,49.8 L -46.3,59.9 L -44.7,61.5 L -38.9,67.5 L -26.2,80.6 L -0.1,80.6 L 0,80.7 L 0,99.7 Z';

// Canonical Uniform Solfège Rotations:
// 0° (Top / 12 o'clock): Do (Base), Ra/Di (Sharp), Ti (Flat)
// 90° (Right / 3 o'clock): Re (Flat), Me/Ri (Base), Mi (Sharp)
// 180° (Bottom / 6 o'clock): Fa (Flat), Fi/Se (Base), So/Si (Sharp)
// 270° (Left / 9 o'clock): Le (Flat), La/Li (Base), Te (Sharp)
const UNIFORM_SOLFEGE_SPECS = {
  Do: { glyphType: 'base', rotation: 0, colorHex: '#E13610' },
  Ra: { glyphType: 'sharp', rotation: 0, colorHex: '#EA580C' },
  Di: { glyphType: 'sharp', rotation: 0, colorHex: '#EA580C' },
  Re: { glyphType: 'flat', rotation: 90, colorHex: '#EA580C' },
  Me: { glyphType: 'base', rotation: 90, colorHex: '#CA8A04' },
  Ri: { glyphType: 'base', rotation: 90, colorHex: '#CA8A04' },
  Mi: { glyphType: 'sharp', rotation: 90, colorHex: '#CA8A04' },
  Fa: { glyphType: 'flat', rotation: 180, colorHex: '#16A34A' },
  Fi: { glyphType: 'base', rotation: 180, colorHex: '#334155' },
  Se: { glyphType: 'base', rotation: 180, colorHex: '#334155' },
  So: { glyphType: 'sharp', rotation: 180, colorHex: '#0284C7' },
  Le: { glyphType: 'flat', rotation: 270, colorHex: '#7C3AED' },
  Si: { glyphType: 'flat', rotation: 270, colorHex: '#7C3AED' },
  La: { glyphType: 'base', rotation: 270, colorHex: '#7C3AED' },
  Te: { glyphType: 'sharp', rotation: 270, colorHex: '#DB2777' },
  Li: { glyphType: 'sharp', rotation: 270, colorHex: '#DB2777' },
  Ti: { glyphType: 'flat', rotation: 0, colorHex: '#DB2777' }
};

const PITCH_NAMES_DUAL = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
const SOLFEGE_SYLLABLES = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti'];
const SCALE_DEGREES = ['1', '♭2', '2', '♭3', '3', '4', '♯4/♭5', '5', '♭6', '6', '♭7', '7'];

// Piano Triangle Topography (Down, Left, Up, Right)
const PITCH_CLASS_TO_PIANO_TRIANGLE = {
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

const TRIANGLE_COORDINATES = {
  D: {
    path: 'M 18 25 L 82 25 L 50 82 Z',
    points: { 1: { x: 18, y: 25 }, 2: { x: 50, y: 82 }, 3: { x: 82, y: 25 } }
  },
  L: {
    path: 'M 18 82 L 82 82 L 82 18 Z',
    points: { 1: { x: 18, y: 82 }, 2: { x: 82, y: 82 }, 3: { x: 82, y: 18 } }
  },
  U: {
    path: 'M 18 82 L 50 18 L 82 82 Z',
    points: { 1: { x: 18, y: 82 }, 2: { x: 50, y: 18 }, 3: { x: 82, y: 82 } }
  },
  R: {
    path: 'M 18 18 L 18 82 L 82 82 Z',
    points: { 1: { x: 18, y: 18 }, 2: { x: 18, y: 82 }, 3: { x: 82, y: 82 } }
  }
};

export const PRESET_SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  whole_tone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  triad_major: [0, 4, 7],
  triad_minor: [0, 3, 7],
  triad_diminished: [0, 3, 6],
  triad_augmented: [0, 4, 8],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10]
};

export function parseTonic(tonic) {
  if (typeof tonic === 'number') return ((Math.floor(tonic) % 12) + 12) % 12;
  if (!tonic) return 0;
  const rawStr = String(tonic).trim();
  const directNum = parseInt(rawStr, 10);
  if (!isNaN(directNum) && /^\d+$/.test(rawStr)) {
    return ((directNum % 12) + 12) % 12;
  }

  let str = rawStr.toLowerCase();
  // Strip trailing octave numbers (e.g. C4 -> c, Eb4 -> eb, F#3 -> f#)
  str = str.replace(/\d+$/, '');
  const pitchMap = {
    c: 0, 'c#': 1, 'c♯': 1, db: 1, 'd♭': 1,
    d: 2, 'd#': 3, 'd♯': 3, eb: 3, 'e♭': 3,
    e: 4,
    f: 5, 'f#': 6, 'f♯': 6, gb: 6, 'g♭': 6,
    g: 7, 'g#': 8, 'g♯': 8, ab: 8, 'a♭': 8,
    a: 9, 'a#': 10, 'a♯': 10, bb: 10, 'b♭': 10,
    b: 11
  };
  if (pitchMap[str] !== undefined) return pitchMap[str];
  return 0;
}

/**
 * Register Native Pitch Clock Custom Element in PPT Studio
 */
if (typeof customElements !== 'undefined' && !customElements.get('ppt-pitch-clock')) {
  class PPTPitchClockElement extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
      return ['tonic', 'representations', 'active-pitches', 'scale', 'orientation'];
    }

    attributeChangedCallback() {
      this.render();
    }

    connectedCallback() {
      this.render();
    }

    render() {
      if (!this.shadowRoot) return;
      const tonicAttr = this.getAttribute('tonic') || 'C';
      const tonicIdx = parseTonic(tonicAttr);
      const orientation = this.getAttribute('orientation') || 'c-top';
      const reprAttr = this.getAttribute('representations') || 'pitch-names,solfege,scale-degrees,solfege-glyphs,piano-triangles';
      const reprSet = new Set(reprAttr.split(',').map(s => s.trim().toLowerCase()));

      const activeSet = new Set();
      const scaleAttr = (this.getAttribute('scale') || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
      if (scaleAttr && PRESET_SCALES[scaleAttr]) {
        for (const semi of PRESET_SCALES[scaleAttr]) {
          activeSet.add((tonicIdx + semi) % 12);
        }
      }

      const activeAttr = this.getAttribute('active-pitches') || '';
      if (activeAttr.trim()) {
        activeAttr.split(/[,\s]+/).filter(Boolean).forEach(tok => {
          const num = parseInt(tok, 10);
          if (!isNaN(num)) activeSet.add(((num % 12) + 12) % 12);
          else activeSet.add(parseTonic(tok));
        });
      }

      const nodes = [];
      const radius = 37.5;
      const centerX = 50;
      const centerY = 50;

      for (let pos = 0; pos < 12; pos++) {
        const angleRad = (pos * 30 - 90) * (Math.PI / 180);
        const cx = centerX + radius * Math.cos(angleRad);
        const cy = centerY + radius * Math.sin(angleRad);

        const pitchClass = orientation === 'tonic-top' ? (tonicIdx + pos) % 12 : pos;
        const semitone = ((pitchClass - tonicIdx) % 12 + 12) % 12;
        const isTonic = semitone === 0;
        const isActive = activeSet.has(pitchClass);
        const solfege = SOLFEGE_SYLLABLES[semitone];
        const spec = UNIFORM_SOLFEGE_SPECS[solfege] || UNIFORM_SOLFEGE_SPECS['Do'];
        const ptInfo = PITCH_CLASS_TO_PIANO_TRIANGLE[pitchClass];

        // Uniform Solfege SVG
        let pathD = PATH_BASE;
        if (spec.glyphType === 'sharp') pathD = PATH_SHARP;
        else if (spec.glyphType === 'flat') pathD = PATH_FLAT;

        const glyphSvg = `
          <svg viewBox="-120 -120 240 240" class="solfege-glyph-svg" style="transform: rotate(${spec.rotation}deg);">
            <path d="${pathD}" fill="${spec.colorHex}" stroke="#0f172a" stroke-width="6" transform="scale(1, -1)" />
          </svg>
        `;

        // Piano Triangle Mini SVG (Larger with visible vertex circles, without text)
        const triGeom = TRIANGLE_COORDINATES[ptInfo.triangle];
        const triCircles = [1, 2, 3].map(pt => {
          const coords = triGeom.points[pt];
          const isPointActive = pt === ptInfo.point;
          return `<circle cx="${coords.x}" cy="${coords.y}" r="${isPointActive ? 11 : 6.5}" fill="${isPointActive ? spec.colorHex : '#ffffff'}" stroke="${isPointActive ? '#0f172a' : '#64748b'}" stroke-width="${isPointActive ? 3 : 1.5}" opacity="${isPointActive ? 1 : 0.6}" />`;
        }).join('');

        const triangleSvg = `
          <div class="piano-tri-wrapper">
            <svg viewBox="0 0 100 100" class="piano-tri-svg">
              <path d="${triGeom.path}" fill="none" stroke="#475569" stroke-width="3.5" stroke-linejoin="round" />
              ${triCircles}
            </svg>
          </div>
        `;

        nodes.push({
          pos,
          pitchClass,
          semitone,
          isTonic,
          isActive,
          cx,
          cy,
          pitchName: PITCH_NAMES_DUAL[pitchClass],
          solfege,
          colorHex: spec.colorHex,
          degree: SCALE_DEGREES[semitone],
          glyphSvg,
          triangleSvg,
        });
      }

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            height: 100%;
            aspect-ratio: 1;
            position: relative;
            user-select: none;
            container-type: inline-size;
          }
          .clock-wrap {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg.clock-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
            pointer-events: none;
          }
          .ring-outer {
            fill: none;
            stroke: #475569;
            stroke-width: 1.5;
            stroke-dasharray: 2 4;
            opacity: 0.4;
          }
          .ring-main {
            fill: none;
            stroke: #64748b;
            stroke-width: 2;
            opacity: 0.5;
          }

          .center-hub {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: max(42px, 14cqi);
            height: max(42px, 14cqi);
            border-radius: 50%;
            background: #ffffff;
            border: 2.5px solid #2563eb;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            z-index: 5;
            cursor: pointer;
            text-align: center;
          }
          .hub-sub {
            font-size: max(6px, 1.8cqi);
            font-weight: 800;
            color: #64748b;
            line-height: 1;
            letter-spacing: 0.05em;
          }
          .hub-main {
            font-size: max(11px, 3.6cqi);
            font-weight: 800;
            color: #1d4ed8;
            line-height: 1.1;
          }

          .node-badge {
            position: absolute;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: max(8px, 2.5cqi);
            padding: max(3px, 0.8cqi) max(6px, 1.4cqi);
            background: #ffffff;
            border: 2px solid var(--n-color, #94a3b8);
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
            z-index: 10;
            min-width: max(32px, 10cqi);
            text-align: center;
            gap: max(1px, 0.3cqi);
          }
          .node-badge:hover {
            transform: translate(-50%, -50%) scale(1.18);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            z-index: 20;
            border-color: #2563eb;
          }
          .node-badge.is-tonic {
            border-width: 3px;
            border-color: #E13610 !important;
            box-shadow: 0 0 0 3.5px rgba(225, 54, 16, 0.3), 0 6px 16px rgba(0, 0, 0, 0.3);
          }
          .node-badge.is-active {
            background: #f0fdf4;
            border-color: #16a34a;
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.35);
          }

          .node-glyph-box {
            width: max(16px, 4.4cqi);
            height: max(16px, 4.4cqi);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .solfege-glyph-svg {
            width: 100%;
            height: 100%;
            overflow: visible;
          }

          .solf-txt {
            font-size: max(8px, 2.7cqi);
            font-weight: 800;
            color: var(--n-color, #0f172a);
            line-height: 1;
          }
          .pitch-txt {
            font-size: max(8px, 2.5cqi);
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
          }
          .deg-txt {
            font-size: max(6px, 1.9cqi);
            font-weight: 700;
            color: #475569;
            line-height: 1;
          }

          .piano-tri-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 1px;
          }
          .piano-tri-svg {
            width: max(16px, 4.2cqi);
            height: max(16px, 4.2cqi);
            overflow: visible;
          }
        </style>

        <div class="clock-wrap">
          <svg class="clock-svg" viewBox="0 0 100 100">
            <circle class="ring-outer" cx="50" cy="50" r="46" />
            <circle class="ring-main" cx="50" cy="50" r="${radius}" />
          </svg>

          <div class="center-hub" title="Tonic: ${PITCH_NAMES_DUAL[tonicIdx]} (Click to advance)">
            <span class="hub-sub">TONIC</span>
            <span class="hub-main">${PITCH_NAMES_DUAL[tonicIdx]}</span>
          </div>

          ${nodes.map(node => `
            <div 
              class="node-badge ${node.isTonic ? 'is-tonic' : ''} ${node.isActive ? 'is-active' : ''}"
              style="left: ${node.cx.toFixed(2)}%; top: ${node.cy.toFixed(2)}%; --n-color: ${node.colorHex};"
              data-pitch-class="${node.pitchClass}"
              data-semitone="${node.semitone}"
              data-is-tonic="${node.isTonic}"
              title="${node.pitchName} • Solfège: ${node.solfege} • Degree: ${node.degree}"
            >
              ${reprSet.has('solfege-glyphs') ? `<div class="node-glyph-box">${node.glyphSvg}</div>` : ''}
              ${reprSet.has('solfege') ? `<span class="solf-txt">${node.solfege}</span>` : ''}
              ${reprSet.has('pitch-names') ? `<span class="pitch-txt">${node.pitchName}</span>` : ''}
              ${reprSet.has('scale-degrees') ? `<span class="deg-txt">${node.degree}</span>` : ''}
              ${reprSet.has('piano-triangles') ? node.triangleSvg : ''}
            </div>
          `).join('')}
        </div>
      `;

      this.shadowRoot.querySelectorAll('.node-badge').forEach(el => {
        const pitchClass = parseInt(el.getAttribute('data-pitch-class') || '0', 10);
        const semitone = parseInt(el.getAttribute('data-semitone') || '0', 10);
        const isTonic = el.getAttribute('data-is-tonic') === 'true';

        el.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('ppt-pitch-selected', {
            bubbles: true,
            composed: true,
            detail: { pitchClass, pitchName: PITCH_NAMES_DUAL[pitchClass], solfege: SOLFEGE_SYLLABLES[semitone], degree: SCALE_DEGREES[semitone], isTonic }
          }));
        });

        el.addEventListener('dblclick', () => {
          this.setAttribute('tonic', String(pitchClass));
          this.dispatchEvent(new CustomEvent('ppt-tonic-changed', {
            bubbles: true,
            composed: true,
            detail: { tonicIndex: pitchClass, tonicName: PITCH_NAMES_DUAL[pitchClass] }
          }));
        });
      });

      const hub = this.shadowRoot.querySelector('.center-hub');
      if (hub) {
        hub.addEventListener('click', () => {
          const next = (tonicIdx + 1) % 12;
          this.setAttribute('tonic', String(next));
          this.dispatchEvent(new CustomEvent('ppt-tonic-changed', {
            bubbles: true,
            composed: true,
            detail: { tonicIndex: next, tonicName: PITCH_NAMES_DUAL[next] }
          }));
        });
      }
    }
  }

  customElements.define('ppt-pitch-clock', PPTPitchClockElement);
}

/**
 * Controller for PPT Studio Pitch Clock Floating Window
 */
class PitchClockWindowController {
  constructor() {
    this.windowEl = null;
    this.dragHandleEl = null;
    this.resizeHandleEl = null;
    this.clockEl = null;
    this.tonicSelect = null;
    this.scaleSelect = null;
    this.infoText = null;

    this.isDragging = false;
    this.isResizing = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.windowStartX = 0;
    this.windowStartY = 0;
    this.startWidth = 0;
    this.startHeight = 0;

    this.isMinimized = false;
    this.onSetStatus = null;
  }

  init(options = {}) {
    this.onSetStatus = options.onSetStatus || null;
    this.getEditor = options.getEditor || null;
    this.windowEl = document.getElementById('pitch-clock-floating-window');
    if (!this.windowEl) return;

    this.dragHandleEl = document.getElementById('pitch-clock-drag-handle');
    this.resizeHandleEl = document.getElementById('pitch-clock-resize-handle');
    this.clockEl = document.getElementById('studio-pitch-clock');
    this.tonicSelect = document.getElementById('pitch-clock-tonic-select');
    this.scaleSelect = document.getElementById('pitch-clock-scale-select');
    this.orientationSelect = document.getElementById('pitch-clock-orientation-select');
    this.infoText = document.getElementById('pitch-clock-info-text');

    this.bindWindowEvents();
    this.bindControls();
    this.restoreSavedState();
  }

  extractTonicFromEditor() {
    try {
      const cm = this.getEditor?.();
      if (!cm) return null;
      const yaml = cm.getValue();
      if (!yaml) return null;
      const currentKnotId = state.currentKnotId || 'default';

      // 1. Check for knot block matching current knot ID
      const knotRegex = new RegExp(`(?:knots:\\s*[\\s\\S]*?${currentKnotId}\\s*:[\\s\\S]*?(?:tonic|do|root)\\s*:\\s*["']?([A-G][b#♯♭]?\\d*)["']?|knot\\s*:[\\s\\S]*?(?:tonic|do|root)\\s*:\\s*["']?([A-G][b#♯♭]?\\d*)["']?)`, 'i');
      const m = yaml.match(knotRegex);
      if (m && (m[1] || m[2])) return m[1] || m[2];

      // 2. Generic fallback match for tonic:
      const fallbackMatch = yaml.match(/^\s*(?:tonic|do|root)\s*:\s*["']?([A-G][b#♯♭]?\\d*)["']?/im);
      if (fallbackMatch && fallbackMatch[1]) return fallbackMatch[1];
    } catch (e) {
      // ignore
    }
    return null;
  }

  syncFromActiveScore() {
    let knotTonic = state.currentKnot?.doName || state.currentScoreTonic || this.extractTonicFromEditor() || 'C';

    const tonicIdx = parseTonic(knotTonic);
    if (this.tonicSelect) this.tonicSelect.value = String(tonicIdx);
    this.clockEl?.setAttribute('tonic', String(tonicIdx));

    this.onSetStatus?.('info', `Pitch Clock synchronized to score tonic: ${PITCH_NAMES_DUAL[tonicIdx]}`);
    if (this.infoText) {
      this.infoText.innerHTML = `Synchronized to Score Tonic: <strong>${PITCH_NAMES_DUAL[tonicIdx]}</strong>`;
    }
    this.saveState();
  }

  bindWindowEvents() {
    // Close button
    document.getElementById('btn-pitch-clock-close')?.addEventListener('click', () => {
      this.close();
    });

    // Minimize button
    document.getElementById('btn-pitch-clock-minimize')?.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // Sync with Knot button
    document.getElementById('btn-pitch-clock-sync-knot')?.addEventListener('click', () => {
      this.syncFromActiveScore();
    });

    // Dragging
    this.dragHandleEl?.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.windowEl.getBoundingClientRect();
      this.windowStartX = rect.left;
      this.windowStartY = rect.top;
      document.body.style.userSelect = 'none';
    });

    // Resizing
    this.resizeHandleEl?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isResizing = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.windowEl.getBoundingClientRect();
      this.startWidth = rect.width;
      this.startHeight = rect.height;
      document.body.style.userSelect = 'none';
    });

    // Global Mouse Move & Up
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        let newX = Math.max(10, Math.min(window.innerWidth - 100, this.windowStartX + dx));
        let newY = Math.max(10, Math.min(window.innerHeight - 60, this.windowStartY + dy));
        this.windowEl.style.left = `${newX}px`;
        this.windowEl.style.top = `${newY}px`;
        this.windowEl.style.right = 'auto';
        this.windowEl.style.bottom = 'auto';
      } else if (this.isResizing) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        const newW = Math.max(280, Math.min(800, this.startWidth + dx));
        const newH = Math.max(320, Math.min(900, this.startHeight + dy));
        this.windowEl.style.width = `${newW}px`;
        this.windowEl.style.height = `${newH}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging || this.isResizing) {
        this.isDragging = false;
        this.isResizing = false;
        document.body.style.userSelect = '';
        this.saveState();
      }
    });

    // Clock custom events
    this.clockEl?.addEventListener('ppt-pitch-selected', (e) => {
      const d = e.detail;
      if (this.infoText) {
        this.infoText.innerHTML = `<strong>${d.pitchName}</strong> • Solfège: <strong>${d.solfege}</strong> • Degree: <strong>${d.degree}</strong> ${d.isTonic ? '<em>(Tonic)</em>' : ''}`;
      }
    });

    this.clockEl?.addEventListener('ppt-tonic-changed', (e) => {
      const d = e.detail;
      if (this.tonicSelect) {
        this.tonicSelect.value = String(d.tonicIndex);
      }
      if (this.infoText) {
        this.infoText.innerHTML = `Tonic changed to <strong>${d.tonicName}</strong>`;
      }
      this.saveState();
    });
  }

  bindControls() {
    // Tonic change
    this.tonicSelect?.addEventListener('change', () => {
      const tonic = this.tonicSelect.value;
      this.clockEl?.setAttribute('tonic', tonic);
      this.saveState();
    });

    // Scale change
    this.scaleSelect?.addEventListener('change', () => {
      const scale = this.scaleSelect.value;
      this.clockEl?.setAttribute('scale', scale);
      this.saveState();
    });

    // Orientation change
    this.orientationSelect?.addEventListener('change', () => {
      const orientation = this.orientationSelect.value;
      this.clockEl?.setAttribute('orientation', orientation);
      this.saveState();
    });

    // Layer checkboxes
    const chkPitch = document.getElementById('chk-repr-pitch');
    const chkSolf = document.getElementById('chk-repr-solfege');
    const chkDeg = document.getElementById('chk-repr-degrees');
    const chkGlyphs = document.getElementById('chk-repr-glyphs');
    const chkTri = document.getElementById('chk-repr-triangles');

    const updateLayers = () => {
      const active = [];
      if (chkPitch?.checked) active.push('pitch-names');
      if (chkSolf?.checked) active.push('solfege');
      if (chkDeg?.checked) active.push('scale-degrees');
      if (chkGlyphs?.checked) active.push('solfege-glyphs');
      if (chkTri?.checked) active.push('piano-triangles');

      this.clockEl?.setAttribute('representations', active.join(','));
      this.saveState();
    };

    [chkPitch, chkSolf, chkDeg, chkGlyphs, chkTri].forEach(chk => {
      chk?.addEventListener('change', updateLayers);
    });
  }

  open() {
    if (!this.windowEl) return;
    this.windowEl.classList.remove('hidden');
    this.syncFromActiveScore();
    this.saveState();
  }

  close() {
    if (!this.windowEl) return;
    this.windowEl.classList.add('hidden');
    this.saveState();
  }

  toggle() {
    if (!this.windowEl) return;
    if (this.windowEl.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  }

  toggleMinimize() {
    if (!this.windowEl) return;
    this.isMinimized = !this.isMinimized;
    const body = document.getElementById('pitch-clock-window-body');
    const resizeHandle = document.getElementById('pitch-clock-resize-handle');
    if (this.isMinimized) {
      body?.classList.add('hidden');
      if (resizeHandle) resizeHandle.style.display = 'none';
      this.windowEl.classList.add('is-minimized');
    } else {
      body?.classList.remove('hidden');
      if (resizeHandle) resizeHandle.style.display = '';
      this.windowEl.classList.remove('is-minimized');
    }
    this.saveState();
  }

  saveState() {
    try {
      const rect = this.windowEl.getBoundingClientRect();
      const st = {
        visible: !this.windowEl.classList.contains('hidden'),
        minimized: this.isMinimized,
        left: this.windowEl.style.left,
        top: this.windowEl.style.top,
        width: this.windowEl.style.width,
        height: this.windowEl.style.height,
        tonic: this.tonicSelect?.value || '0',
        scale: this.scaleSelect?.value || '',
        orientation: this.orientationSelect?.value || 'c-top',
        chkPitch: document.getElementById('chk-repr-pitch')?.checked,
        chkSolf: document.getElementById('chk-repr-solfege')?.checked,
        chkDeg: document.getElementById('chk-repr-degrees')?.checked,
        chkGlyphs: document.getElementById('chk-repr-glyphs')?.checked,
        chkTri: document.getElementById('chk-repr-triangles')?.checked,
      };
      localStorage.setItem('ppt_pitch_clock_state', JSON.stringify(st));
    } catch (e) {
      // ignore
    }
  }

  restoreSavedState() {
    try {
      const raw = localStorage.getItem('ppt_pitch_clock_state');
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st.left) this.windowEl.style.left = st.left;
      if (st.top) this.windowEl.style.top = st.top;
      if (st.width) this.windowEl.style.width = st.width;
      if (st.height) this.windowEl.style.height = st.height;

      if (st.tonic && this.tonicSelect) {
        this.tonicSelect.value = st.tonic;
        this.clockEl?.setAttribute('tonic', st.tonic);
      }
      if (st.scale !== undefined && this.scaleSelect) {
        this.scaleSelect.value = st.scale;
        this.clockEl?.setAttribute('scale', st.scale);
      }
      if (st.orientation && this.orientationSelect) {
        this.orientationSelect.value = st.orientation;
        this.clockEl?.setAttribute('orientation', st.orientation);
      }

      if (st.chkPitch !== undefined) document.getElementById('chk-repr-pitch').checked = st.chkPitch;
      if (st.chkSolf !== undefined) document.getElementById('chk-repr-solfege').checked = st.chkSolf;
      if (st.chkDeg !== undefined) document.getElementById('chk-repr-degrees').checked = st.chkDeg;
      if (st.chkGlyphs !== undefined) document.getElementById('chk-repr-glyphs').checked = st.chkGlyphs;
      if (st.chkTri !== undefined) document.getElementById('chk-repr-triangles').checked = st.chkTri;

      const active = [];
      if (document.getElementById('chk-repr-pitch')?.checked) active.push('pitch-names');
      if (document.getElementById('chk-repr-solfege')?.checked) active.push('solfege');
      if (document.getElementById('chk-repr-degrees')?.checked) active.push('scale-degrees');
      if (document.getElementById('chk-repr-glyphs')?.checked) active.push('solfege-glyphs');
      if (document.getElementById('chk-repr-triangles')?.checked) active.push('piano-triangles');

      this.clockEl?.setAttribute('representations', active.join(','));

      if (st.minimized) {
        this.toggleMinimize();
      }

      if (st.visible) {
        this.open();
      }
    } catch (e) {
      // ignore
    }
  }
}

export const pitchClockWindow = new PitchClockWindowController();
