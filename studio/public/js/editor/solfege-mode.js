/**
 * CodeMirror Solfège Syntax Highlighting & ID Reference Overlay Mode
 */

import { isValidSolfegeToken } from '../core/solfege.js';
import { getDeclaredIdsCache } from '../core/ast-scanner.js';

export const SOLFEGE_SYLLABLES_LIST = [
  'Dox', 'Rax', 'Dix', 'Rex', 'Mex', 'Rix', 'Mix', 'Fax', 'Fix', 'Sex', 'Sox', 'Lex', 'Six', 'Lax', 'Tex', 'Lix', 'Tix',
  'Do', 'Ra', 'Di', 'Re', 'Me', 'Ri', 'Mi', 'Fa', 'Fi', 'Se', 'So', 'Le', 'Si', 'La', 'Te', 'Li', 'Ti'
];

export const SOLFEGE_COLOR_MAP = {
  'do': 'ppt-do',
  'ra': 'ppt-ra',
  'di': 'ppt-di',
  're': 'ppt-re',
  'me': 'ppt-me',
  'ri': 'ppt-ri',
  'mi': 'ppt-mi',
  'fa': 'ppt-fa',
  'fi': 'ppt-fi',
  'se': 'ppt-se',
  'so': 'ppt-so',
  'si': 'ppt-si',
  'le': 'ppt-le',
  'la': 'ppt-la',
  'li': 'ppt-li',
  'te': 'ppt-te',
  'ti': 'ppt-ti',
};

export function createSolfegeOverlay() {
  return {
    token: function (stream) {
      const line = stream.string;

      // Skip YAML comments
      if (stream.match(/^\s*#.*/)) {
        return null;
      }

      // Skip whitespace
      if (stream.eatSpace()) return null;

      // Check if we are at the start of a word
      const rest = line.slice(stream.pos);
      const wordMatch = rest.match(/^["']?([_A-Za-z0-9\^_]+)["']?/);
      if (!wordMatch) {
        stream.next();
        return null;
      }

      const fullWord = wordMatch[0];
      const cleanWord = wordMatch[1];
      const afterWordPos = stream.pos + fullWord.length;
      const isColonFollowed = line.charAt(afterWordPos) === ':' &&
        (line.charAt(afterWordPos + 1) === ' ' || afterWordPos + 1 === line.length);

      // 1. Highlight declared structure IDs (clickable references vs definitions)
      const declaredIds = getDeclaredIdsCache();
      if (declaredIds && declaredIds.has(cleanWord)) {
        const isDefinition = isColonFollowed || new RegExp(`^\\s*id\\s*:\\s*["']?${cleanWord}["']?`, 'i').test(line);
        stream.pos += fullWord.length;
        return isDefinition ? 'ppt-id-def' : 'ppt-id-reference';
      }

      // If it's a key before a colon (e.g. "melody:", "rhythm:", "engraving:"), skip past it
      if (isColonFollowed) {
        stream.pos += fullWord.length;
        return null;
      }

      // 2. Only highlight if the word is a valid Solfège expression
      if (!isValidSolfegeToken(fullWord)) {
        stream.pos += fullWord.length;
        return null;
      }

      // Incrementally match and color each sub-syllable of the valid Solfège word
      for (const syl of SOLFEGE_SYLLABLES_LIST) {
        if (stream.match(new RegExp('^' + syl, 'i'))) {
          const baseSyl = syl.replace(/x$/i, '').toLowerCase();
          return SOLFEGE_COLOR_MAP[baseSyl] || 'ppt-do';
        }
      }

      // Advance past octave indicators (^, _) or modifiers
      stream.next();
      return null;
    }
  };
}

export const solfegeOverlay = createSolfegeOverlay();

export function registerSolfegeOverlayMode(CodeMirror) {
  CodeMirror.defineMode('solfegeOverlay', function () {
    return solfegeOverlay;
  });
}
