/**
 * Core SVG Solfège Notehead & Glyph Generator (PPT Geometric Rotations & Palettes)
 */

export const SVG_PATH_BASE = 'M 0.262 0.806 L 0.389 0.674 L 0.559 0.498 L 0.750 0.302 L 0.848 0.000 L 0.750 -0.302 L 0.714 -0.412 L 0.686 -0.498 L 0.405 -0.702 L 0.262 -0.806 L 0.000 -0.848 L -0.262 -0.806 L -0.405 -0.702 L -0.686 -0.498 L -0.714 -0.412 L -0.750 -0.302 L -0.848 0.000 L -0.750 0.302 L -0.559 0.498 L -0.389 0.674 L -0.262 0.806 L -0.250 0.432 L -0.330 0.381 L -0.407 0.292 L -0.440 0.254 L -0.473 0.216 L -0.483 0.142 L -0.504 0.000 L -0.483 -0.142 L -0.445 -0.226 L -0.393 -0.340 L -0.330 -0.381 L -0.250 -0.432 L -0.209 -0.458 L -0.147 -0.498 L 0.000 -0.504 L 0.147 -0.498 L 0.209 -0.458 L 0.250 -0.432 L 0.330 -0.381 L 0.393 -0.340 L 0.445 -0.226 L 0.483 -0.142 L 0.504 0.000 L 0.483 0.142 L 0.473 0.216 L 0.440 0.254 L 0.407 0.292 L 0.330 0.381 L 0.250 0.432 Z';

export const SVG_PATH_SHARP = 'M 0.00 1.00 L 0.00 0.807 L 0.001 0.806 L 0.262 0.806 L 0.389 0.674 L 0.447 0.615 L 0.462 0.599 L 0.559 0.498 L 0.288 0.498 L 0.148 0.740 L 0.110 0.806 L 0.000 0.806 L 0.000 0.520 L 0.072 0.499 L 0.146 0.499 L 0.147 0.498 L 0.073 0.498 L 0.209 0.458 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.257 0.444 L -0.288 0.498 L -0.560 0.498 L -0.668 0.386 L -0.697 0.356 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.811 0.408 L 0.863 0.498 L 0.866 0.500 L 0.707 0.707 L 0.500 0.866 L 0.259 0.966 L 0.000 1.000 Z';

export const SVG_PATH_FLAT = 'M 0.00 1.00 L -0.259 0.966 L -0.500 0.866 L -0.707 0.707 L -0.866 0.500 L -0.863 0.498 L -0.811 0.408 L -0.750 0.302 L -0.848 0.000 L -0.750 -0.302 L -0.714 -0.412 L -0.686 -0.498 L -0.405 -0.702 L -0.262 -0.806 L 0.262 -0.806 L 0.110 -0.806 L 0.262 -0.806 L 0.405 -0.702 L 0.686 -0.498 L 0.714 -0.412 L 0.750 -0.302 L 0.848 0.000 L 0.750 0.302 L 0.697 0.356 L 0.668 0.386 L 0.559 0.498 L 0.288 0.498 L 0.257 0.444 L 0.250 0.432 L 0.330 0.381 L 0.407 0.292 L 0.424 0.272 L 0.440 0.254 L 0.473 0.216 L 0.480 0.165 L 0.483 0.142 L 0.504 0.000 L 0.514 -0.074 L 0.483 -0.142 L 0.445 -0.226 L 0.434 -0.250 L 0.424 -0.272 L 0.393 -0.340 L 0.371 -0.354 L 0.330 -0.381 L 0.250 -0.432 L 0.209 -0.458 L 0.147 -0.498 L 0.146 -0.499 L -0.146 -0.499 L -0.147 -0.498 L -0.209 -0.458 L -0.250 -0.432 L -0.330 -0.381 L -0.371 -0.354 L -0.393 -0.340 L -0.424 -0.272 L -0.434 -0.250 L -0.445 -0.226 L -0.483 -0.142 L -0.514 -0.074 L -0.504 0.000 L -0.483 0.142 L -0.480 0.165 L -0.473 0.216 L -0.440 0.254 L -0.424 0.272 L -0.407 0.292 L -0.330 0.381 L -0.250 0.432 L -0.073 0.498 L -0.147 0.498 L -0.146 0.499 L -0.072 0.499 L 0.000 0.520 L 0.000 0.806 L -0.110 0.806 L -0.148 0.740 L -0.288 0.498 L -0.560 0.498 L -0.463 0.599 L -0.447 0.615 L -0.389 0.675 L -0.262 0.806 L -0.001 0.806 L 0.000 0.807 L 0.000 1.000 Z';

export const SOLFEGE_GLYPH_SPECS = {
  Do: { glyphType: 'base', rotation: 0, colorHex: '#E13610' },
  Ra: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Di: { glyphType: 'sharp', rotation: 0, colorHex: '#F98016' },
  Re: { glyphType: 'flat', rotation: 90, colorHex: '#F98016' },
  Me: { glyphType: 'base', rotation: 90, colorHex: '#F5D432' },
  Ri: { glyphType: 'base', rotation: 90, colorHex: '#F5D432' },
  Mi: { glyphType: 'sharp', rotation: 90, colorHex: '#F5D432' },
  Fa: { glyphType: 'flat', rotation: 180, colorHex: '#43A440' },
  Fi: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  Se: { glyphType: 'base', rotation: 180, colorHex: '#141414' },
  So: { glyphType: 'sharp', rotation: 180, colorHex: '#0032A4' },
  Le: { glyphType: 'flat', rotation: 270, colorHex: '#5300A4' },
  Si: { glyphType: 'flat', rotation: 270, colorHex: '#5300A4' },
  La: { glyphType: 'base', rotation: 270, colorHex: '#5300A4' },
  Te: { glyphType: 'sharp', rotation: 270, colorHex: '#F158A4' },
  Li: { glyphType: 'sharp', rotation: 270, colorHex: '#F158A4' },
  Ti: { glyphType: 'flat', rotation: 0, colorHex: '#F158A4' },
};

export const SOLFEGE_GLYPH_MAP = SOLFEGE_GLYPH_SPECS;

export function getSolfegeGlyphSpec(syllable, hasAxis = false, octaveShift = 0) {
  let cleanSyllable = String(syllable || '');
  let parsedOctave = octaveShift;
  if (parsedOctave === 0 && (cleanSyllable.includes('^') || cleanSyllable.includes('_'))) {
    for (const ch of cleanSyllable) {
      if (ch === '^') parsedOctave++;
      else if (ch === '_') parsedOctave--;
    }
  }
  cleanSyllable = cleanSyllable.replace(/[\^_0-9\.xX]/g, '');
  if (cleanSyllable.length >= 2) {
    cleanSyllable = cleanSyllable.charAt(0).toUpperCase() + cleanSyllable.slice(1).toLowerCase();
  }

  const spec = SOLFEGE_GLYPH_SPECS[cleanSyllable] || SOLFEGE_GLYPH_SPECS['Do'];

  return {
    canonicalSyllable: cleanSyllable,
    glyphType: spec.glyphType,
    rotation: spec.rotation,
    colorHex: spec.colorHex,
    hasAxis,
    octaveShift: parsedOctave,
  };
}

/**
 * Generates an inline vector SVG Solfège glyph with rotation, axis line, and octave triangles.
 */
export function createSolfegeGlyphSvg(syllable, hasAxis = false, size = 18, octaveShift = 0) {
  let octShift = octaveShift;
  if (octShift === 0 && typeof syllable === 'string') {
    for (const ch of syllable) {
      if (ch === '^') octShift++;
      else if (ch === '_') octShift--;
    }
  }

  const cleanSyl = typeof syllable === 'string'
    ? syllable.replace(/[\^_0-9\.xX]/g, '')
    : '';

  const canonicalSyl = cleanSyl.length >= 2
    ? cleanSyl.charAt(0).toUpperCase() + cleanSyl.slice(1).toLowerCase()
    : 'Do';

  const spec = SOLFEGE_GLYPH_SPECS[canonicalSyl] || SOLFEGE_GLYPH_SPECS['Do'];

  const color = spec ? spec.colorHex : '#E13610';
  const rot = spec ? spec.rotation : 0;
  const glyphType = spec ? spec.glyphType : 'base';

  let pathD = SVG_PATH_BASE;
  if (glyphType === 'sharp') pathD = SVG_PATH_SHARP;
  else if (glyphType === 'flat') pathD = SVG_PATH_FLAT;

  const axisSvg = hasAxis
    ? `<line x1="-1.1" y1="0" x2="1.1" y2="0" stroke="${color}" stroke-width="0.22" stroke-linecap="round" />`
    : '';

  let octaveSvg = '';
  if (octShift !== 0) {
    const absOct = Math.abs(octShift);
    const triScale = absOct > 1 ? 0.65 : 0.75;
    const isUp = octShift > 0;
    const triPathD = isUp
      ? 'M 0 -0.25 L 0.22 0.25 L -0.22 0.25 Z'
      : 'M 0 0.25 L 0.22 -0.25 L -0.22 -0.25 Z';

    const xPos = -1.15;
    const spacing = 0.44;
    const triangles = [];
    for (let k = 0; k < absOct; k++) {
      const yPos = isUp ? (-0.52 + (k * spacing)) : (0.52 - (k * spacing));
      triangles.push(`
        <g transform="translate(${xPos}, ${yPos}) scale(${triScale})">
          <path d="${triPathD}" fill="${color}" stroke="#1e2127" stroke-width="0.08" stroke-linejoin="round" />
        </g>
      `);
    }
    octaveSvg = triangles.join('');
  }

  return `
    <svg viewBox="-1.5 -1.25 3.0 2.5" width="${size}" height="${size}" style="display:inline-block; vertical-align:middle; overflow:visible;">
      <g transform="scale(1, -1) rotate(${rot})">
        <path d="${pathD}" fill="${color}" stroke="#1e2127" stroke-width="0.08" stroke-linejoin="round" />
        ${axisSvg}
      </g>
      ${octaveSvg}
    </svg>
  `;
}
