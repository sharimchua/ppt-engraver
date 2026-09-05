/**
 * Core Pitch Arithmetic, Token Parsing & Transposition Utilities
 */

import {
  SOLFEGE_TO_SEMITONE,
  SYLLABLE_TO_SEMITONE,
  BASE_OCTAVE_SYLLABLES,
  solfegeToNearestAddress,
  solfegeToHarmonyRootOffset,
} from './solfege.js';
import { parseRepeatSpec } from './rhythm.js';

const NOTE_ACCIDENTAL_OFFSETS = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1, 'D♭': 1,
  'D': 2,
  'D#': 3, 'Eb': 3, 'E♭': 3,
  'E': 4, 'Fb': 4, 'F♭': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6, 'G♭': 6,
  'G': 7,
  'G#': 8, 'Ab': 8, 'A♭': 8,
  'A': 9,
  'A#': 10, 'Bb': 10, 'B♭': 10,
  'B': 11, 'Cb': 11, 'C♭': 11,
};

export function pitchNameToMidi(pitchName) {
  const match = pitchName.match(/^([A-G](?:#|b|♭)?)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid pitch name: "${pitchName}" (expected format like "C4", "Eb4", "F#3")`);
  }
  const [, noteWithAccidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const semitone = NOTE_ACCIDENTAL_OFFSETS[noteWithAccidental];
  if (semitone === undefined) {
    throw new Error(`Unknown note name: "${noteWithAccidental}"`);
  }
  return (octave + 1) * 12 + semitone;
}

export function calculateTonicShift(oldTonicName, newTonicName) {
  const oldMidi = pitchNameToMidi(oldTonicName);
  const newMidi = pitchNameToMidi(newTonicName);
  return {
    semitones: oldMidi - newMidi,
    oldMidi,
    newMidi,
  };
}

export function parsePitch(notation) {
  let remaining = notation;
  let octaveShift = 0;
  while (remaining.startsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(1);
  }
  while (remaining.startsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(1);
  }
  while (remaining.endsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(0, -1);
  }
  while (remaining.endsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(0, -1);
  }
  let hasAxis = false;
  if (remaining.endsWith('x')) {
    hasAxis = true;
    remaining = remaining.slice(0, -1);
  }
  const syllable = remaining;
  if (SOLFEGE_TO_SEMITONE[syllable] === undefined) {
    throw new Error(`Invalid solfège syllable: "${notation}"`);
  }
  return { syllable, octaveShift, hasAxis };
}

export function parseMelodyToken(token) {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return { isRest: true, raw: clean };
  }

  const repeat = parseRepeatSpec(clean);
  if (repeat !== null) {
    return {
      isRepeat: true,
      count: repeat.repeatCount,
      windowSize: repeat.windowSize,
      raw: clean,
    };
  }

  const m = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!m) {
    return { isUnknown: true, raw: clean };
  }

  let syllable = m[1];
  let hasAxis = Boolean(m[2] || m[4]);
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x') && !m[2] && !m[4]) {
    syllable = syllable.slice(0, -1);
    hasAxis = true;
  }

  const octStr = m[3] || '';
  let octaveShift = 0;
  for (const ch of octStr) {
    if (ch === '^') octaveShift++;
    else if (ch === '_') octaveShift--;
  }

  let baseSemitone;
  try {
    baseSemitone = solfegeToNearestAddress(syllable);
  } catch {
    return { isUnknown: true, raw: clean };
  }

  return {
    syllable,
    hasAxis,
    octaveShift,
    octShift: octaveShift,
    baseSemitone,
    raw: clean,
  };
}

export function semitonesToSolfege(semitones) {
  const base = ((semitones + 5) % 12 + 12) % 12 - 5;
  const oct = Math.round((semitones - base) / 12);
  const baseName = BASE_OCTAVE_SYLLABLES[base] || 'Do';

  if (oct > 0) {
    return baseName + '^'.repeat(oct);
  } else if (oct < 0) {
    return baseName + '_'.repeat(-oct);
  }
  return baseName;
}

export function transposeSolfegeToken(token, semitones) {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return token;
  }

  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return token;
  }

  const match = clean.match(/^([a-zA-Z]+?)(x)?([\^_]*)(x)?$/);
  if (!match) {
    return token;
  }

  let syllable = match[1];
  const hasAxis = Boolean(match[2] || match[4] || syllable.toLowerCase().endsWith('x'));
  if (syllable.length > 2 && syllable.toLowerCase().endsWith('x')) {
    syllable = syllable.slice(0, -1);
  }

  const octStr = match[3] || '';
  let octShift = 0;
  for (const c of octStr) {
    if (c === '^') octShift++;
    else if (c === '_') octShift--;
  }

  const baseSemitone = solfegeToNearestAddress(syllable);
  const currentTotal = baseSemitone + (octShift * 12);
  const newTotal = currentTotal + semitones;

  const base = ((newTotal + 5) % 12 + 12) % 12 - 5;
  const newOct = Math.round((newTotal - base) / 12);

  const newBaseSyllable = BASE_OCTAVE_SYLLABLES[base] || 'Do';
  let result = newBaseSyllable;
  if (hasAxis) {
    result += 'x';
  }
  if (newOct > 0) {
    result += '^'.repeat(newOct);
  } else if (newOct < 0) {
    result += '_'.repeat(Math.abs(newOct));
  }

  return result;
}

export function parseHarmonyChord(token) {
  let remaining = token;
  let octaveShift = 0;
  while (remaining.endsWith('^')) {
    octaveShift++;
    remaining = remaining.slice(0, -1);
  }
  while (remaining.endsWith('_')) {
    octaveShift--;
    remaining = remaining.slice(0, -1);
  }

  const bassPrefixMatch = remaining.match(
    /^(Do|Ra|Di|Re|Me|Ri|Mi|Mie|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)([\^_]*)x(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)(.*)$/
  );

  let bassSyllable;
  let bassOctaveShift = 0;
  let hasAxisBass = false;
  let rootSyllable;
  let hasAxis = false;
  let rest = '';

  const isModifierOnly = (firstSyl, secondSyl) => {
    return firstSyl === 'Do' && ['Me', 'Ri', 'Te', 'Li', 'Fi', 'Se'].includes(secondSyl);
  };

  if (bassPrefixMatch && (bassPrefixMatch[5] !== '' || !isModifierOnly(bassPrefixMatch[1], bassPrefixMatch[3]))) {
    let rawBass = bassPrefixMatch[1];
    if (rawBass === 'Mie') rawBass = 'Mi';
    bassSyllable = rawBass;
    const bassOctStr = bassPrefixMatch[2];
    for (const ch of bassOctStr) {
      if (ch === '^') bassOctaveShift++;
      else if (ch === '_') bassOctaveShift--;
    }
    hasAxisBass = true;
    rootSyllable = bassPrefixMatch[3];
    hasAxis = bassPrefixMatch[4] === 'x';
    rest = bassPrefixMatch[5];
  } else {
    const match = remaining.match(/^(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)(.*)$/);
    if (!match) {
      throw new Error(`Invalid harmony chord token: "${token}"`);
    }
    rootSyllable = match[1];
    hasAxis = match[2] === 'x';
    rest = match[3];
  }

  const modifiers = [];
  const modifierRegex = /(Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(x?)/g;
  let modMatch;
  while ((modMatch = modifierRegex.exec(rest)) !== null) {
    modifiers.push({
      syllable: modMatch[1],
      hasAxis: modMatch[2] === 'x',
    });
  }

  const hasRa = modifiers.some(m => m.syllable === 'Ra' || m.syllable === 'Di');
  const hasRe = modifiers.some(m => m.syllable === 'Re');
  const hasMe = modifiers.some(m => m.syllable === 'Me' || m.syllable === 'Ri');
  const hasRi = modifiers.some(m => m.syllable === 'Ri');
  const hasMi = modifiers.some(m => m.syllable === 'Mi');
  const hasFa = modifiers.some(m => m.syllable === 'Fa');
  const hasFi = modifiers.some(m => m.syllable === 'Fi' || m.syllable === 'Se');
  const hasSo = modifiers.some(m => m.syllable === 'So');
  const hasLe = modifiers.some(m => m.syllable === 'Le' || m.syllable === 'Si');
  const hasLa = modifiers.some(m => m.syllable === 'La');
  const hasTe = modifiers.some(m => m.syllable === 'Te' || m.syllable === 'Li');
  const hasTi = modifiers.some(m => m.syllable === 'Ti');

  let quality = 'major';

  // 1. Alterations with Dominant/Major 7th
  if (hasTe && hasRa) {
    quality = 'dominant7b9';
  } else if (hasTe && (hasRi || (hasMe && hasMi))) {
    quality = 'dominant7sharp9';
  } else if (hasTe && hasFi && !hasMe) {
    quality = 'dominant7sharp11';
  } else if (hasTi && hasFi) {
    quality = 'major7sharp11';
  } else if (hasTe && hasLe) {
    quality = 'dominant7b13';
  }
  // 2. Extended 13th, 11th, 9th chords
  else if (hasMe && hasTe && hasLa) {
    quality = 'minor13';
  } else if (hasTi && hasLa) {
    quality = 'major13';
  } else if (hasTe && hasLa) {
    quality = 'dominant13';
  } else if (hasMe && hasTe && hasFa) {
    quality = 'minor11';
  } else if (hasTe && hasFa && hasRe) {
    quality = 'dominant11';
  } else if (hasMe && hasTe && hasRe) {
    quality = 'minor9';
  } else if (hasTi && hasRe) {
    quality = 'major9';
  } else if (hasTe && hasRe) {
    quality = 'dominant9';
  } else if (hasMi && hasRe) {
    quality = 'add9';
  }
  // 3. Diminished & Half-Diminished chords
  else if (hasFi && hasLa) {
    quality = 'diminished7';
  } else if (hasFi && hasTe) {
    quality = 'halfDiminished7';
  } else if (hasFi) {
    quality = 'diminished';
  }
  // 4. Standard 7ths & 6ths
  else if (hasMe && hasTi) {
    quality = 'minorMajor7';
  } else if (hasMe && hasTe) {
    quality = 'minor7';
  } else if (hasMe && hasLa) {
    quality = 'minor6';
  } else if (hasFa && hasTe) {
    quality = '7sus4';
  } else if (hasTi) {
    quality = 'major7';
  } else if (hasTe) {
    quality = 'dominant7';
  } else if (hasLa) {
    quality = 'major6';
  }
  // 5. Triads, Sus & 5th Power Chords
  else if (hasMe) {
    quality = 'minor';
  } else if (hasFa) {
    quality = 'sus4';
  } else if (hasRe) {
    quality = 'sus2';
  } else if (hasLe) {
    quality = 'augmented';
  } else if (hasSo) {
    quality = 'fifth';
  }

  const result = {
    rootSyllable,
    hasAxis,
    modifiers,
    octaveShift,
    quality,
  };

  if (hasAxisBass) {
    result.hasAxisBass = true;
    result.bassSyllable = bassSyllable;
    if (bassOctaveShift !== 0) {
      result.bassOctaveShift = bassOctaveShift;
    }
  }

  return result;
}

export function transposeHarmonyToken(token, semitones) {
  const clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') {
    return token;
  }

  try {
    const parsed = parseHarmonyChord(clean);
    const transposedRoot = transposeSolfegeToken(parsed.rootSyllable, semitones);
    const cleanTransposedRoot = transposedRoot.replace(/[\^_x]/g, '');

    let result = '';

    if (parsed.hasAxisBass && parsed.bassSyllable) {
      const transposedBass = transposeSolfegeToken(parsed.bassSyllable, semitones);
      const cleanTransposedBass = transposedBass.replace(/[\^_x]/g, '');
      result += cleanTransposedBass;
      const bassOct = parsed.bassOctaveShift ?? 0;
      if (bassOct > 0) {
        result += '^'.repeat(bassOct);
      } else if (bassOct < 0) {
        result += '_'.repeat(Math.abs(bassOct));
      }
      result += 'x';
    }

    result += cleanTransposedRoot;
    if (parsed.hasAxis) {
      result += 'x';
    }

    for (const mod of parsed.modifiers) {
      result += mod.syllable;
      if (mod.hasAxis) result += 'x';
    }

    if (parsed.octaveShift > 0) {
      result += '^'.repeat(parsed.octaveShift);
    } else if (parsed.octaveShift < 0) {
      result += '_'.repeat(Math.abs(parsed.octaveShift));
    }

    return result;
  } catch {
    return token;
  }
}

export function convertIntervalToAbsoluteMelody(tokenList) {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result = [];
  let currentOffset = 0;
  let hasAnchor = false;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown || parsed.baseSemitone === undefined) {
      result.push(rawTok);
      continue;
    }

    if (!hasAnchor) {
      currentOffset = parsed.baseSemitone + (parsed.octShift * 12);
      result.push(semitonesToSolfege(currentOffset));
      hasAnchor = true;
    } else {
      const interval = parsed.baseSemitone + (parsed.octShift * 12);
      currentOffset += interval;
      result.push(semitonesToSolfege(currentOffset));
    }
  }

  return result;
}

export function convertAbsoluteToIntervalMelody(tokenList) {
  if (!tokenList || tokenList.length === 0) return tokenList;

  const result = [];
  let prevOffset = null;

  for (let i = 0; i < tokenList.length; i++) {
    const rawTok = tokenList[i].trim();
    if (!rawTok) continue;

    const parsed = parseMelodyToken(rawTok);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown || parsed.baseSemitone === undefined) {
      result.push(rawTok);
      continue;
    }

    const currentOffset = parsed.baseSemitone + (parsed.octShift * 12);

    if (prevOffset === null) {
      const absName = semitonesToSolfege(currentOffset);
      const withAxis = absName.replace(/^([a-zA-Z]+)([\^_]*)$/, '$1x$2');
      result.push(withAxis);
      prevOffset = currentOffset;
    } else {
      const diff = currentOffset - prevOffset;
      const intervalTok = semitonesToSolfege(diff);
      result.push(intervalTok);
      prevOffset = currentOffset;
    }
  }

  return result;
}

export const PITCH_NAMES_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const PITCH_NAMES_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts a MIDI note number to pitch name string (e.g. 60 -> "C4", 67 -> "G4").
 */
export function midiToPitchName(midi, accidentalMode = 'sharps') {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = accidentalMode === 'flats' ? PITCH_NAMES_FLATS : PITCH_NAMES_SHARPS;
  return `${names[noteIndex]}${octave}`;
}

/**
 * Applies a tonic modulation shift specified as a Solfège syllable (or semitones)
 * to a base tonic MIDI note.
 */
export function applyModulation(currentTonicMidi, currentAccidentalMode = 'sharps', modulateSpec) {
  let semitones = 0;
  let preferredMode = currentAccidentalMode;

  if (typeof modulateSpec === 'number') {
    semitones = modulateSpec;
  } else if (typeof modulateSpec === 'string' && /^[+-]?\d+$/.test(modulateSpec.trim())) {
    semitones = parseInt(modulateSpec.trim(), 10);
  } else if (typeof modulateSpec === 'string') {
    const trimmed = modulateSpec.trim();
    const parsed = parsePitch(trimmed);
    semitones = solfegeToNearestAddress(parsed.syllable) + (parsed.octaveShift * 12);

    const flatSyllables = new Set(['Ra', 'Me', 'Se', 'Le', 'Te']);
    const sharpSyllables = new Set(['Di', 'Ri', 'Fi', 'Si', 'Li']);
    if (flatSyllables.has(parsed.syllable)) {
      preferredMode = 'flats';
    } else if (sharpSyllables.has(parsed.syllable)) {
      preferredMode = 'sharps';
    } else {
      const newPc = (((currentTonicMidi + semitones) % 12) + 12) % 12;
      if ([5, 10, 3, 8, 1].includes(newPc)) {
        preferredMode = 'flats';
      } else if ([0, 2, 4, 7, 9, 11].includes(newPc)) {
        preferredMode = 'sharps';
      }
    }
  } else {
    throw new Error(`Invalid modulate specification: ${JSON.stringify(modulateSpec)}`);
  }

  const newMidi = currentTonicMidi + semitones;
  const newTonicName = midiToPitchName(newMidi, preferredMode);

  return {
    tonicMidi: newMidi,
    tonicName: newTonicName,
    accidentalMode: preferredMode,
    semitones,
  };
}
