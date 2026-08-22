/**
 * Core Solfège Constants and Wheel Mapping Utilities
 */

export const SOLFEGE_POSITIONS = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti',
];

export const SOLFEGE_TO_SEMITONE = {
  Do: 0,
  Ra: 1, Di: 1,
  Re: 2,
  Me: 3, Ri: 3,
  Mi: 4,
  Fa: 5,
  Fi: 6, Se: 6,
  So: 7,
  Le: 8, Si: 8,
  La: 9,
  Te: 10, Li: 10,
  Ti: 11,
};

export const SYLLABLE_TO_SEMITONE = {
  do: 0,
  ra: 1, di: 1,
  re: 2,
  me: 3, ri: 3,
  mi: 4,
  fa: 5,
  fi: 6, se: 6,
  so: 7,
  le: 8, si: 8,
  la: 9,
  te: 10, li: 10,
  ti: 11,
};

export const NEAREST_ADDRESS = {
  0: 0,    // Do
  1: 1,    // Ra
  2: 2,    // Re
  3: 3,    // Me
  4: 4,    // Mi
  5: 5,    // Fa
  6: 6,    // Fi
  7: -5,   // So
  8: -4,   // Le
  9: -3,   // La
  10: -2,  // Te
  11: -1,  // Ti
};

export const BASE_OCTAVE_SYLLABLES = {
  [-5]: 'So',
  [-4]: 'Le',
  [-3]: 'La',
  [-2]: 'Te',
  [-1]: 'Ti',
  0: 'Do',
  1: 'Ra',
  2: 'Re',
  3: 'Me',
  4: 'Mi',
  5: 'Fa',
  6: 'Fi',
};

export const SOLFEGE_COLORS = {
  do: '#E13610',
  ra: '#F98016',
  di: '#F98016',
  re: '#F98016',
  me: '#F5D432',
  ri: '#F5D432',
  mi: '#F5D432',
  fa: '#43A440',
  fi: '#141414',
  se: '#141414',
  so: '#0032A4',
  le: '#5300A4',
  si: '#5300A4',
  la: '#5300A4',
  te: '#F158A4',
  li: '#F158A4',
  ti: '#F158A4',
};

export const MODE_DEGREE_OFFSETS = {
  ionian: { degree: 'Do', semitones: 0, label: 'Ionian (Major / Do)' },
  dorian: { degree: 'Re', semitones: 2, label: 'Dorian (Re / +2 st)' },
  phrygian: { degree: 'Me', semitones: 3, label: 'Phrygian (Me / +3 st)' },
  lydian: { degree: 'Fa', semitones: 5, label: 'Lydian (Fa / +5 st)' },
  mixolydian: { degree: 'So', semitones: 7, label: 'Mixolydian (So / +7 st)' },
  aeolian: { degree: 'La', semitones: 9, label: 'Aeolian (Natural Minor / La / -3 st)' },
  locrian: { degree: 'Ti', semitones: 11, label: 'Locrian (Ti / -1 st)' },
};

const SOLFEGE_TOKEN_REGEX = /^(?:(?:Do|Ra|Di|Re|Me|Ri|Mi|Fa|Fi|Se|So|Le|Si|La|Te|Li|Ti)(?:x)?(?:[\^_]*))+$/i;

/**
 * Validates whether a token is a legitimate PPT Solfège degree token.
 */
export function isValidSolfegeToken(word) {
  if (!word || typeof word !== 'string') return false;
  const clean = word.trim().replace(/^['"]|['"]$/g, '');
  if (!clean || clean === 'R' || clean === '~') return false;
  if (/^\d+(?:\.\d+)?$/.test(clean)) return false;
  return SOLFEGE_TOKEN_REGEX.test(clean);
}

/**
 * Scans a line of text and extracts all valid Solfège tokens with character offsets.
 */
export function getSolfegeTokensOnLine(lineText) {
  const results = [];
  const regex = /[A-Za-z0-9_.\^~]+/g;
  let match;
  while ((match = regex.exec(lineText)) !== null) {
    const raw = match[0];
    if (isValidSolfegeToken(raw)) {
      results.push({
        token: raw,
        start: match.index,
        end: match.index + raw.length,
      });
    }
  }
  return results;
}

export function solfegeToSemitone(syllable) {
  const clean = syllable.replace(/[\^_x]/g, '');
  const semitone = SOLFEGE_TO_SEMITONE[clean];
  if (semitone === undefined) {
    throw new Error(`Unknown solfège syllable: "${syllable}"`);
  }
  return semitone;
}

export function solfegeToNearestAddress(syllable) {
  const semitone = solfegeToSemitone(syllable);
  return NEAREST_ADDRESS[semitone] ?? 0;
}

export function solfegeToHarmonyRootOffset(syllable) {
  const semitone = solfegeToSemitone(syllable);
  if (semitone >= 5) {
    return semitone - 12;
  }
  return semitone;
}
