import { describe, it, expect } from 'vitest';
import {
  mapRhythmNoteToSolfege,
  semitoneIntervalToSolfege,
  translateChordToSolfege,
  calculatePrecedingMelodyPitch,
  translateMelodyNoteToSolfege,
  getSolfegeArrayContextAtCursor,
  insertSolfegeTokenAtCursor,
} from '../../studio/public/js/core/midi-input.js';
import {
  isRhythmRestToken,
  expandLayerTokensWithOnsets,
  extractTokensForPaired,
} from '../../studio/public/js/editor/paired-highlights.js';

describe('MIDI Solfège Typing Engine', () => {
  describe('Rhythm MIDI Mapping (mapRhythmNoteToSolfege)', () => {
    it('maps standard octave notes to Solfège rhythm tokens with default Do=C4', () => {
      expect(mapRhythmNoteToSolfege(60, 'C4')).toBe('Do');
      expect(mapRhythmNoteToSolfege(61, 'C4')).toBe('Ra');
      expect(mapRhythmNoteToSolfege(62, 'C4')).toBe('Re');
      expect(mapRhythmNoteToSolfege(63, 'C4')).toBe('Me');
      expect(mapRhythmNoteToSolfege(64, 'C4')).toBe('Mi');
      expect(mapRhythmNoteToSolfege(65, 'C4')).toBe('Fa');
      expect(mapRhythmNoteToSolfege(66, 'C4')).toBe('Fi');
      expect(mapRhythmNoteToSolfege(67, 'C4')).toBe('So');
      expect(mapRhythmNoteToSolfege(68, 'C4')).toBe('Le');
      expect(mapRhythmNoteToSolfege(69, 'C4')).toBe('La');
      expect(mapRhythmNoteToSolfege(70, 'C4')).toBe('Te');
      expect(mapRhythmNoteToSolfege(71, 'C4')).toBe('Ti');
    });

    it('maps octave down notes to Dox and subdivisions', () => {
      // 1 octave down (C3 = 48)
      expect(mapRhythmNoteToSolfege(48, 'C4')).toBe('Dox');
      // 2 octaves down (C2 = 36)
      expect(mapRhythmNoteToSolfege(36, 'C4')).toBe('DoxDox');
      // D3 (-10 semitones) -> DoxRe
      expect(mapRhythmNoteToSolfege(50, 'C4')).toBe('DoxRe');
      // E3 (-8 semitones) -> DoxMi
      expect(mapRhythmNoteToSolfege(52, 'C4')).toBe('DoxMi');
    });

    it('maps higher octave notes to Dox skips', () => {
      // C5 (72 = +12 st) -> DoxDo
      expect(mapRhythmNoteToSolfege(72, 'C4')).toBe('DoxDo');
      // D5 (74 = +14 st) -> DoxRe
      expect(mapRhythmNoteToSolfege(74, 'C4')).toBe('DoxRe');
      // C6 (84 = +24 st) -> DoxDoxDo
      expect(mapRhythmNoteToSolfege(84, 'C4')).toBe('DoxDoxDo');
    });

    it('respects custom universal Rhythm Do setting', () => {
      // With Rhythm Do set to D4 (62)
      expect(mapRhythmNoteToSolfege(62, 'D4')).toBe('Do');
      expect(mapRhythmNoteToSolfege(50, 'D4')).toBe('Dox');
      expect(mapRhythmNoteToSolfege(64, 'D4')).toBe('Re');
      expect(mapRhythmNoteToSolfege(66, 'D4')).toBe('Mi');
    });
  });

  describe('Harmony Chord Translation (translateChordToSolfege)', () => {
    it('translates single held notes into major triad root syllable', () => {
      // In Key of C (Do=C4)
      expect(translateChordToSolfege([60], 'C4')).toBe('Do');
      expect(translateChordToSolfege([69], 'C4')).toBe('La');
      expect(translateChordToSolfege([65], 'C4')).toBe('Fa');
      expect(translateChordToSolfege([67], 'C4')).toBe('So');
      expect(translateChordToSolfege([62], 'C4')).toBe('Re');
    });

    it('translates major 7th and dominant 7th chords', () => {
      // C4-E4-G4-B4 -> DoTi
      expect(translateChordToSolfege([60, 64, 67, 71], 'C4')).toBe('DoTi');
      // C4-B4 (shell dyad) -> DoTi
      expect(translateChordToSolfege([60, 71], 'C4')).toBe('DoTi');

      // G4-B4-D5-F5 -> SoTe
      expect(translateChordToSolfege([67, 71, 74, 77], 'C4')).toBe('SoTe');
      // G4-F5 (shell dyad) -> SoTe
      expect(translateChordToSolfege([67, 77], 'C4')).toBe('SoTe');
    });

    it('translates minor triads and minor 7th chords', () => {
      // A4-C5-E5 -> LaMe
      expect(translateChordToSolfege([69, 72, 76], 'C4')).toBe('LaMe');
      // A4-C5 (dyad) -> LaMe
      expect(translateChordToSolfege([69, 72], 'C4')).toBe('LaMe');

      // D4-F4-A4-C5 -> ReMeTe
      expect(translateChordToSolfege([62, 65, 69, 72], 'C4')).toBe('ReMeTe');
    });

    it('translates diminished, sus, and augmented chords', () => {
      // B4-D5-F5 (diminished) -> TiFi
      expect(translateChordToSolfege([71, 74, 77], 'C4')).toBe('TiFi');

      // C4-F4-G4 (sus4) -> DoFa
      expect(translateChordToSolfege([60, 65, 67], 'C4')).toBe('DoFa');

      // C4-D4-G4 (sus2) -> DoRe
      expect(translateChordToSolfege([60, 62, 67], 'C4')).toBe('DoRe');

      // C4-E4-G#4 (augmented) -> DoLe
      expect(translateChordToSolfege([60, 64, 68], 'C4')).toBe('DoLe');

      // C4-E4-G4-A4 (major 6th) -> DoLa
      expect(translateChordToSolfege([60, 64, 67, 69], 'C4')).toBe('DoLa');
    });

    it('translates chords accurately with non-C tonics', () => {
      // In Key of Eb (Eb4=63)
      expect(translateChordToSolfege([63], 'Eb4')).toBe('Do');
      // Eb4-G4-Bb4-D5 -> DoTi
      expect(translateChordToSolfege([63, 67, 70, 74], 'Eb4')).toBe('DoTi');
      // C4-Eb4-G4 (Cm in key of Eb is La / vi) -> LaMe
      expect(translateChordToSolfege([60, 63, 67], 'Eb4')).toBe('LaMe');
    });
  });

  describe('Melody MIDI Translation (translateMelodyNoteToSolfege)', () => {
    it('translates absolute melody notes relative to Tonic', () => {
      // In Key of C (C4=60)
      expect(translateMelodyNoteToSolfege(60, 'C4', 'absolute')).toBe('Do');
      expect(translateMelodyNoteToSolfege(62, 'C4', 'absolute')).toBe('Re');
      expect(translateMelodyNoteToSolfege(64, 'C4', 'absolute')).toBe('Mi');
      expect(translateMelodyNoteToSolfege(67, 'C4', 'absolute')).toBe('So^');
      expect(translateMelodyNoteToSolfege(55, 'C4', 'absolute')).toBe('So');
      expect(translateMelodyNoteToSolfege(48, 'C4', 'absolute')).toBe('Do_');
    });

    it('translates interval melody notes with initial anchor and relative intervals', () => {
      // First note in interval mode gets axis anchor 'x'
      expect(translateMelodyNoteToSolfege(60, 'C4', 'interval', [])).toBe('Dox');
      expect(translateMelodyNoteToSolfege(62, 'C4', 'interval', [])).toBe('Rex');

      // Subsequent notes calculate interval from previous note
      // Preceding note is Dox (pitch 60)
      expect(translateMelodyNoteToSolfege(62, 'C4', 'interval', ['Dox'])).toBe('Re');
      expect(translateMelodyNoteToSolfege(59, 'C4', 'interval', ['Dox'])).toBe('Ti');
      expect(translateMelodyNoteToSolfege(67, 'C4', 'interval', ['Dox'])).toBe('So^');
      expect(translateMelodyNoteToSolfege(60, 'C4', 'interval', ['Dox'])).toBe('Do');

      // Preceding sequence: Dox (60), Re (+2 -> 62) -> preceding pitch is 62
      // Next note is 65 (F4) -> diff = 65 - 62 = +3 (Me)
      expect(translateMelodyNoteToSolfege(65, 'C4', 'interval', ['Dox', 'Re'])).toBe('Me');
    });
  });

  describe('CodeMirror Context Detection & Insertion', () => {
    function createMockCm(lineText, cursorCh = 0) {
      let content = lineText;
      let cur = { line: 0, ch: cursorCh };

      return {
        getCursor: () => ({ ...cur }),
        getLine: () => content,
        setCursor: (newPos) => { cur = { ...newPos }; },
        replaceRange: (text, from) => {
          const before = content.slice(0, from.ch);
          const after = content.slice(from.ch);
          content = before + text + after;
        },
        getValue: () => content,
      };
    }

    it('detects Solfège context on inline melody array', () => {
      const mockCm = createMockCm('  melody: [Do, Re, Mi]', 15);
      const ctx = getSolfegeArrayContextAtCursor(mockCm);

      expect(ctx).not.toBeNull();
      expect(ctx?.layer).toBe('melody');
      expect(ctx?.melodyMode).toBe('absolute');
      expect(ctx?.isInlineArray).toBe(true);
      expect(ctx?.tokens.map(t => t.token)).toEqual(['Do', 'Re', 'Mi']);
    });

    it('detects interval mode when 1st token has axis marker', () => {
      const mockCm = createMockCm('  melody: [Dox, Re, Mi]', 16);
      const ctx = getSolfegeArrayContextAtCursor(mockCm);

      expect(ctx?.melodyMode).toBe('interval');
    });

    it('detects rhythm and harmony contexts', () => {
      const rhythmCm = createMockCm('  rhythm: [Do, Re, Ra]', 12);
      expect(getSolfegeArrayContextAtCursor(rhythmCm)?.layer).toBe('rhythm');

      const harmonyCm = createMockCm('  harmony: [Do, Fa, So]', 12);
      expect(getSolfegeArrayContextAtCursor(harmonyCm)?.layer).toBe('harmony');
    });

    it('returns null on non-Solfège lines', () => {
      const metaCm = createMockCm('  tempo: 120', 5);
      expect(getSolfegeArrayContextAtCursor(metaCm)).toBeNull();
    });

    it('inserts token into empty array and updates cursor', () => {
      const mockCm = createMockCm('  melody: []', 11);
      const success = insertSolfegeTokenAtCursor(mockCm, 'Do');

      expect(success).toBe(true);
      expect(mockCm.getValue()).toBe('  melody: [Do]');
      expect(mockCm.getCursor()).toEqual({ line: 0, ch: 13 });
    });

    it('appends token after the last element in array', () => {
      const mockCm = createMockCm('  melody: [Do, Re]', 18);
      const success = insertSolfegeTokenAtCursor(mockCm, 'Mi');

      expect(success).toBe(true);
      expect(mockCm.getValue()).toBe('  melody: [Do, Re, Mi]');
      expect(mockCm.getCursor()).toEqual({ line: 0, ch: 21 });
    });

    it('inserts token in the middle after the active token', () => {
      // Cursor is at 'Do' (ch: 12)
      const mockCm = createMockCm('  melody: [Do, Mi]', 12);
      const success = insertSolfegeTokenAtCursor(mockCm, 'Re');

      expect(success).toBe(true);
      expect(mockCm.getValue()).toBe('  melody: [Do, Re, Mi]');
    });
  });
});

describe('Paired Music Layer Token Synchronization', () => {
  describe('isRhythmRestToken', () => {
    it('correctly identifies pure rest tokens', () => {
      expect(isRhythmRestToken('Dox')).toBe(true);
      expect(isRhythmRestToken('DoxDox')).toBe(true);
      expect(isRhythmRestToken('R')).toBe(true);
      expect(isRhythmRestToken('~')).toBe(true);
    });

    it('correctly identifies sounding rhythm tokens with Dox delay prefixes', () => {
      expect(isRhythmRestToken('Do')).toBe(false);
      expect(isRhythmRestToken('Fi')).toBe(false);
      expect(isRhythmRestToken('DoxDo')).toBe(false);
      expect(isRhythmRestToken('DoxFi')).toBe(false);
      expect(isRhythmRestToken('DoxDoxDo')).toBe(false);
      expect(isRhythmRestToken('LeFi')).toBe(false);
    });
  });

  describe('expandLayerTokensWithOnsets', () => {
    it('assigns soundingIndex correctly when rhythm starts with Dox skip', () => {
      const lineText = '  rhythm: [Dox, Do, Fi, La]';
      const tokens = extractTokensForPaired(lineText);
      const onsets = expandLayerTokensWithOnsets(tokens, 'rhythm');

      expect(onsets.length).toBe(4);

      // Dox (rest)
      expect(onsets[0].sourceToken.word).toBe('Dox');
      expect(onsets[0].isRest).toBe(true);
      expect(onsets[0].soundingIndex).toBe(null);

      // Do (1st sounding onset)
      expect(onsets[1].sourceToken.word).toBe('Do');
      expect(onsets[1].isRest).toBe(false);
      expect(onsets[1].soundingIndex).toBe(0);

      // Fi (2nd sounding onset)
      expect(onsets[2].sourceToken.word).toBe('Fi');
      expect(onsets[2].isRest).toBe(false);
      expect(onsets[2].soundingIndex).toBe(1);

      // La (3rd sounding onset)
      expect(onsets[3].sourceToken.word).toBe('La');
      expect(onsets[3].isRest).toBe(false);
      expect(onsets[3].soundingIndex).toBe(2);
    });

    it('aligns melody tokens with sounding rhythm onsets', () => {
      const melodyText = '  melody: [Do, Me, Re]';
      const rhythmText = '  rhythm: [Dox, Do, Fi, La]';

      const melodyTokens = extractTokensForPaired(melodyText);
      const melodyOnsets = expandLayerTokensWithOnsets(melodyTokens, 'melody');

      const rhythmTokens = extractTokensForPaired(rhythmText);
      const rhythmOnsets = expandLayerTokensWithOnsets(rhythmTokens, 'rhythm');

      expect(melodyOnsets[0].soundingIndex).toBe(0);
      expect(melodyOnsets[1].soundingIndex).toBe(1);
      expect(melodyOnsets[2].soundingIndex).toBe(2);

      // 1st melody syllable (Do) pairs with 1st sounding rhythm token (Do, not Dox)
      const pairedRhythm0 = rhythmOnsets.find(r => r.soundingIndex === melodyOnsets[0].soundingIndex);
      expect(pairedRhythm0?.sourceToken.word).toBe('Do');

      // 2nd melody syllable (Me) pairs with 2nd sounding rhythm token (Fi)
      const pairedRhythm1 = rhythmOnsets.find(r => r.soundingIndex === melodyOnsets[1].soundingIndex);
      expect(pairedRhythm1?.sourceToken.word).toBe('Fi');

      // 3rd melody syllable (Re) pairs with 3rd sounding rhythm token (La)
      const pairedRhythm2 = rhythmOnsets.find(r => r.soundingIndex === melodyOnsets[2].soundingIndex);
      expect(pairedRhythm2?.sourceToken.word).toBe('La');
    });

    it('handles lookback repeats with rests and sounding onsets', () => {
      const rhythmText = '  rhythm: [Dox, Do, 2.2]';
      const rhythmTokens = extractTokensForPaired(rhythmText);
      const rhythmOnsets = expandLayerTokensWithOnsets(rhythmTokens, 'rhythm');

      // [Dox, Do, Dox, Do, Dox, Do] -> length 6
      expect(rhythmOnsets.length).toBe(6);

      expect(rhythmOnsets[0].isRest).toBe(true);
      expect(rhythmOnsets[0].soundingIndex).toBe(null);

      expect(rhythmOnsets[1].isRest).toBe(false);
      expect(rhythmOnsets[1].soundingIndex).toBe(0);

      expect(rhythmOnsets[2].isRest).toBe(true);
      expect(rhythmOnsets[2].soundingIndex).toBe(null);

      expect(rhythmOnsets[3].isRest).toBe(false);
      expect(rhythmOnsets[3].soundingIndex).toBe(1);

      expect(rhythmOnsets[4].isRest).toBe(true);
      expect(rhythmOnsets[4].soundingIndex).toBe(null);

      expect(rhythmOnsets[5].isRest).toBe(false);
      expect(rhythmOnsets[5].soundingIndex).toBe(2);
    });
  });
});
