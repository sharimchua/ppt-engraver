import { describe, it, expect } from 'vitest';
import {
  mapRhythmNoteToSolfege,
  semitoneIntervalToSolfege,
  translateChordToSolfege,
  calculatePrecedingMelodyPitch,
  translateMelodyNoteToSolfege,
  getSolfegeArrayContextAtCursor,
  insertSolfegeTokenAtCursor,
  MidiManager,
} from '../../studio/public/js/core/midi-input.js';
import { state, setPreference } from '../../studio/public/js/state.js';
import { getScopeAtCursor } from '../../studio/public/js/core/ast-scanner.js';
import { applyModulation, midiToPitchName } from '../../studio/public/js/core/pitch.js';
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

    it('translates 5th power chords (excluding 3rd)', () => {
      // C4-G4 -> DoSo
      expect(translateChordToSolfege([60, 67], 'C4')).toBe('DoSo');
      // D4-A4 -> ReSo
      expect(translateChordToSolfege([62, 69], 'C4')).toBe('ReSo');
    });

    it('translates diminished, sus, and augmented chords', () => {
      // B4-D5-F5 (diminished triad) -> TiMeFi
      expect(translateChordToSolfege([71, 74, 77], 'C4')).toBe('TiMeFi');

      // C4-Eb4-Gb4 (diminished triad) -> DoMeFi
      expect(translateChordToSolfege([60, 63, 66], 'C4')).toBe('DoMeFi');

      // C4-Eb4-Gb4-Bb4 (half-diminished 7th / m7b5) -> DoMeFiTe
      expect(translateChordToSolfege([60, 63, 66, 70], 'C4')).toBe('DoMeFiTe');

      // C4-Eb4-Gb4-A4 (full diminished 7th / dim7) -> DoMeFiLa
      expect(translateChordToSolfege([60, 63, 66, 69], 'C4')).toBe('DoMeFiLa');

      // C4-F4-G4 (sus4) -> DoFa
      expect(translateChordToSolfege([60, 65, 67], 'C4')).toBe('DoFa');

      // C4-D4-G4 (sus2) -> DoRe
      expect(translateChordToSolfege([60, 62, 67], 'C4')).toBe('DoRe');

      // C4-E4-G#4 (augmented) -> DoLe
      expect(translateChordToSolfege([60, 64, 68], 'C4')).toBe('DoLe');

      // C4-E4-G4-A4 (major 6th) -> DoLa
      expect(translateChordToSolfege([60, 64, 67, 69], 'C4')).toBe('DoLa');
    });

    it('translates extended (9th, 13th) and altered chords from MIDI', () => {
      // C4-E4-G4-Bb4-D5 (dominant 9th) -> DoTeRe
      expect(translateChordToSolfege([60, 64, 67, 70, 74], 'C4')).toBe('DoTeRe');

      // C4-E4-G4-B4-D5 (major 9th) -> DoTiRe
      expect(translateChordToSolfege([60, 64, 67, 71, 74], 'C4')).toBe('DoTiRe');

      // C4-Eb4-G4-Bb4-D5 (minor 9th) -> DoMeTeRe
      expect(translateChordToSolfege([60, 63, 67, 70, 74], 'C4')).toBe('DoMeTeRe');

      // C4-E4-G4-Bb4-Db5 (7(b9)) -> DoTeRa
      expect(translateChordToSolfege([60, 64, 67, 70, 73], 'C4')).toBe('DoTeRa');

      // C4-E4-G4-Bb4-Eb5 (7(#9) Hendrix chord) -> DoTeRi
      expect(translateChordToSolfege([60, 64, 67, 70, 75], 'C4')).toBe('DoTeRi');

      // C4-E4-G4-Bb4-F#5 (7(#11)) -> DoTeFi
      expect(translateChordToSolfege([60, 64, 67, 70, 78], 'C4')).toBe('DoTeFi');

      // C4-E4-G4-B4-F#5 (maj7(#11)) -> DoTiFi
      expect(translateChordToSolfege([60, 64, 67, 71, 78], 'C4')).toBe('DoTiFi');

      // C4-E4-G4-Bb4-A5 (dominant 13th) -> DoTeLa
      expect(translateChordToSolfege([60, 64, 67, 70, 81], 'C4')).toBe('DoTeLa');
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

  describe('MidiManager Hardware Device Filtering', () => {
    function createMockMidiInput(id, name) {
      return {
        id,
        name,
        manufacturer: 'TestVendor',
        state: 'connected',
        onmidimessage: null,
      };
    }

    function createMockCm(initialText = '  melody: []', cursorCh = 11) {
      let content = initialText;
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

    it('correctly matches devices with isDeviceMatch by ID or Name', () => {
      const mgr = new MidiManager();
      const dev1 = createMockMidiInput('port-1', 'Arturia KeyLab');

      expect(mgr.isDeviceMatch(dev1, 'all')).toBe(true);
      expect(mgr.isDeviceMatch(dev1, '')).toBe(true);
      expect(mgr.isDeviceMatch(dev1, 'port-1')).toBe(true);
      expect(mgr.isDeviceMatch(dev1, 'Arturia KeyLab')).toBe(true);
      expect(mgr.isDeviceMatch(dev1, 'port-2')).toBe(false);
      expect(mgr.isDeviceMatch(dev1, 'Launchkey')).toBe(false);
      expect(mgr.isDeviceMatch(null, 'port-1')).toBe(false);
    });

    it('processes messages from all controllers when device filter is "all"', () => {
      const mgr = new MidiManager();
      const mockCm = createMockCm();
      mgr.editorGetter = () => mockCm;

      const input1 = createMockMidiInput('dev-1', 'Arturia KeyLab');
      const input2 = createMockMidiInput('dev-2', 'Novation Launchkey');

      mgr.midiAccess = {
        inputs: new Map([
          ['dev-1', input1],
          ['dev-2', input2],
        ]),
      };

      setPreference('midiEnabled', true);
      setPreference('midiDeviceId', 'all');
      mgr.bindInputs();

      // Send Note On (C4 = 60, velocity 100) from Controller 1
      input1.onmidimessage({
        data: new Uint8Array([0x90, 60, 100]),
        target: input1,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do]');

      // Send Note On (D4 = 62, velocity 100) from Controller 2
      input2.onmidimessage({
        data: new Uint8Array([0x90, 62, 100]),
        target: input2,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do, Re]');
    });

    it('filters out messages from unselected controllers when a specific device is selected', () => {
      const mgr = new MidiManager();
      const mockCm = createMockCm();
      mgr.editorGetter = () => mockCm;

      const input1 = createMockMidiInput('dev-1', 'Arturia KeyLab');
      const input2 = createMockMidiInput('dev-2', 'Novation Launchkey');

      mgr.midiAccess = {
        inputs: new Map([
          ['dev-1', input1],
          ['dev-2', input2],
        ]),
      };

      setPreference('midiEnabled', true);
      setPreference('midiDeviceId', 'dev-1');
      mgr.bindInputs();

      // Controller 2 sends note (should be ignored)
      input2.onmidimessage({
        data: new Uint8Array([0x90, 64, 100]),
        target: input2,
      });
      expect(mockCm.getValue()).toBe('  melody: []');

      // Controller 1 sends note (should be accepted)
      input1.onmidimessage({
        data: new Uint8Array([0x90, 60, 100]),
        target: input1,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do]');
    });

    it('dynamically reacts to preference changes without requiring full re-initialization', () => {
      const mgr = new MidiManager();
      const mockCm = createMockCm();
      mgr.editorGetter = () => mockCm;

      const input1 = createMockMidiInput('dev-1', 'Arturia KeyLab');
      const input2 = createMockMidiInput('dev-2', 'Novation Launchkey');

      mgr.midiAccess = {
        inputs: new Map([
          ['dev-1', input1],
          ['dev-2', input2],
        ]),
      };

      setPreference('midiEnabled', true);
      setPreference('midiDeviceId', 'dev-1');
      mgr.bindInputs();

      // Initially dev-1 is active
      input1.onmidimessage({
        data: new Uint8Array([0x90, 60, 100]),
        target: input1,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do]');

      // Switch preference to dev-2
      setPreference('midiDeviceId', 'dev-2');

      // Now dev-1 is ignored
      input1.onmidimessage({
        data: new Uint8Array([0x90, 64, 100]),
        target: input1,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do]');

      // dev-2 is accepted
      input2.onmidimessage({
        data: new Uint8Array([0x90, 62, 100]),
        target: input2,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do, Re]');
    });

    it('filters by device name fallback if ID differs', () => {
      const mgr = new MidiManager();
      const mockCm = createMockCm();
      mgr.editorGetter = () => mockCm;

      const input1 = createMockMidiInput('dev-uuid-xyz', 'Arturia KeyLab');
      const input2 = createMockMidiInput('dev-uuid-abc', 'Novation Launchkey');

      mgr.midiAccess = {
        inputs: new Map([
          ['dev-uuid-xyz', input1],
          ['dev-uuid-abc', input2],
        ]),
      };

      setPreference('midiEnabled', true);
      setPreference('midiDeviceId', 'Arturia KeyLab');
      mgr.bindInputs();

      // Launchkey ignored
      input2.onmidimessage({
        data: new Uint8Array([0x90, 60, 100]),
        target: input2,
      });
      expect(mockCm.getValue()).toBe('  melody: []');

      // Arturia accepted by name match
      input1.onmidimessage({
        data: new Uint8Array([0x90, 60, 100]),
        target: input1,
      });
      expect(mockCm.getValue()).toBe('  melody: [Do]');
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

  describe('Scope-Aware MIDI Input Tonic Inference & Overrides', () => {
    const sampleYaml = `tapestry:
  knot:
    tonic: "G4"
  weaves:
    verse:
      stitch:
        - coil:
            melody: [La, Ti, Do]
    chorus:
      modulate: Fa
      stitch:
        - coil:
            melody: [Sox, Te, Re]
    chorus_end:
      modulate: So
      stitch:
        - coil:
            melody: [La]
`;

    it('infers base knot tonic when cursor is in an unmodulated weave', () => {
      // Line 8 is inside verse coil: melody: [La, Ti, Do]
      const lines = sampleYaml.split('\n');
      const verseLine = lines.findIndex(l => l.includes('[La, Ti, Do]'));
      const scope = getScopeAtCursor(sampleYaml, verseLine);

      expect(scope.weaveId).toBe('verse');
      expect(scope.coilId).toBe('verse_coil_1');
      expect(scope.inferredTonic).toBe('G4');
      expect(scope.inferredTonicMidi).toBe(67);
    });

    it('infers modulated tonic when cursor is in a weave with modulate: Fa', () => {
      // Line with chorus melody
      const lines = sampleYaml.split('\n');
      const chorusLine = lines.findIndex(l => l.includes('[Sox, Te, Re]'));
      const scope = getScopeAtCursor(sampleYaml, chorusLine);

      expect(scope.weaveId).toBe('chorus');
      expect(scope.coilId).toBe('chorus_coil_1');
      // G4 (67) + Fa (+5) = C5 (72)
      expect(scope.inferredTonic).toBe('C5');
      expect(scope.inferredTonicMidi).toBe(72);
    });

    it('infers tonic correctly with compiled onsets', () => {
      const mockCompiledData = {
        onsets: [
          { weaveId: 'verse', sourceCoilId: 'verse_coil_1', tonic: 'G4', tonicMidi: 67 },
          { weaveId: 'chorus', sourceCoilId: 'chorus_coil_1', tonic: 'C5', tonicMidi: 72 },
          { weaveId: 'chorus_end', sourceCoilId: 'chorus_end_coil_1', tonic: 'G4', tonicMidi: 67 },
        ],
        knot: { tonicName: 'G4', tonicMidi: 67 },
      };

      const lines = sampleYaml.split('\n');
      const chorusLine = lines.findIndex(l => l.includes('[Sox, Te, Re]'));
      const scope = getScopeAtCursor(sampleYaml, chorusLine, mockCompiledData);

      expect(scope.weaveId).toBe('chorus');
      expect(scope.coilId).toBe('chorus_coil_1');
      expect(scope.inferredTonic).toBe('C5');
      expect(scope.inferredTonicMidi).toBe(72);
    });

    it('MidiManager manages temporary coil-level tonic overrides', () => {
      const mgr = new MidiManager();
      const mockCm = {
        getValue: () => sampleYaml,
        lineCount: () => sampleYaml.split('\n').length,
        getLine: (l: number) => sampleYaml.split('\n')[l],
        getCursor: () => {
          const lines = sampleYaml.split('\n');
          const line = lines.findIndex(l => l.includes('[Sox, Te, Re]'));
          return { line, ch: 15 };
        },
      };

      // 1. Initial state -> auto inferred tonic C5
      const initialScope = mgr.getScopeAndTonic(mockCm);
      expect(initialScope.inferredTonic).toBe('C5');
      expect(initialScope.effectiveTonic).toBe('C5');
      expect(initialScope.isOverridden).toBe(false);

      // 2. Set temporary override for chorus_coil_1 to D4
      mgr.setCoilTonicOverride('chorus_coil_1', 'D4');

      const overriddenScope = mgr.getScopeAndTonic(mockCm);
      expect(overriddenScope.inferredTonic).toBe('C5');
      expect(overriddenScope.effectiveTonic).toBe('D4');
      expect(overriddenScope.isOverridden).toBe(true);

      // 3. Switch cursor to verse -> should show verse tonic G4 without override
      const verseCm = {
        ...mockCm,
        getCursor: () => {
          const lines = sampleYaml.split('\n');
          const line = lines.findIndex(l => l.includes('[La, Ti, Do]'));
          return { line, ch: 15 };
        },
      };
      const verseScope = mgr.getScopeAndTonic(verseCm);
      expect(verseScope.inferredTonic).toBe('G4');
      expect(verseScope.effectiveTonic).toBe('G4');
      expect(verseScope.isOverridden).toBe(false);

      // 4. Switch back to chorus -> preference for chorus_coil_1 is retained
      const backScope = mgr.getScopeAndTonic(mockCm);
      expect(backScope.effectiveTonic).toBe('D4');
      expect(backScope.isOverridden).toBe(true);

      // 5. Clear override for chorus_coil_1
      mgr.clearCoilTonicOverride('chorus_coil_1');
      const clearedScope = mgr.getScopeAndTonic(mockCm);
      expect(clearedScope.effectiveTonic).toBe('C5');
      expect(clearedScope.isOverridden).toBe(false);

      // 6. Test clearAllCoilTonicOverrides
      mgr.setCoilTonicOverride('chorus_coil_1', 'E4');
      mgr.clearAllCoilTonicOverrides();
      const allClearedScope = mgr.getScopeAndTonic(mockCm);
      expect(allClearedScope.effectiveTonic).toBe('C5');
      expect(allClearedScope.isOverridden).toBe(false);
    });

    it('translates MIDI notes according to active scope tonic and overrides', () => {
      // Note G4 (67)
      // When tonic is G4: G4 (67) - 67 = 0 -> 'Do'
      expect(translateMelodyNoteToSolfege(67, 'G4')).toBe('Do');
      // When tonic is C5: C5 (72) - 72 = 0 -> 'Do', G4 (67) - 72 = -5 -> 'So' (base octave)
      expect(translateMelodyNoteToSolfege(72, 'C5')).toBe('Do');
      expect(translateMelodyNoteToSolfege(67, 'C5')).toBe('So');

      // In chorus overridden to D4:
      // D4 (62) -> 'Do', G4 (67) -> 'Fa'
      expect(translateMelodyNoteToSolfege(62, 'D4')).toBe('Do');
      expect(translateMelodyNoteToSolfege(67, 'D4')).toBe('Fa');
    });

    it('exports applyModulation and midiToPitchName correctly in studio pitch.js', () => {
      expect(midiToPitchName(60)).toBe('C4');
      expect(midiToPitchName(67)).toBe('G4');
      expect(midiToPitchName(72)).toBe('C5');

      const modFa = applyModulation(67, 'sharps', 'Fa');
      expect(modFa.tonicName).toBe('C5');
      expect(modFa.tonicMidi).toBe(72);

      const modSo = applyModulation(72, 'sharps', 'So');
      expect(modSo.tonicName).toBe('G4');
      expect(modSo.tonicMidi).toBe(67);
    });
  });
});

