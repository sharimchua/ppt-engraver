/**
 * Web MIDI Input Manager & Contextual Solfège Typing Engine
 * 
 * Translates live MIDI notes from hardware/virtual controllers into PPT Solfège tokens
 * for melody, harmony, and rhythm layers in the CodeMirror editor.
 */

import { state, events, setPreference } from '../state.js';
import {
  solfegeToNearestAddress,
  SOLFEGE_POSITIONS,
} from './solfege.js';
import {
  pitchNameToMidi,
  semitonesToSolfege,
  parsePitch,
  parseMelodyToken,
} from './pitch.js';

export const RHYTHM_SYLLABLES_12 = [
  'Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Fi', 'So', 'Le', 'La', 'Te', 'Ti',
];

/**
 * Maps a MIDI note to a PPT rhythm Solfège token relative to universal Rhythm Do.
 * 
 * @param {number} midiNote - Pressed MIDI note number (e.g. 60 for C4)
 * @param {string} [rhythmDoPitch='C4'] - Universal Rhythm Do reference pitch
 * @returns {string} PPT Rhythm token (e.g. 'Do', 'Dox', 'Re', 'Mi', 'DoxRe')
 */
export function mapRhythmNoteToSolfege(midiNote, rhythmDoPitch = 'C4') {
  const doMidi = pitchNameToMidi(rhythmDoPitch || 'C4');
  const delta = midiNote - doMidi;

  if (delta === 0) {
    return 'Do';
  }
  if (delta === -12) {
    return 'Dox';
  }

  // Base octave (0 to 11 semitones above Do)
  if (delta > 0 && delta < 12) {
    return RHYTHM_SYLLABLES_12[delta] || 'Do';
  }

  // Higher octaves (+12, +24, etc.) -> Dox skips + syllable
  if (delta >= 12) {
    const octaves = Math.floor(delta / 12);
    const rem = delta % 12;
    const syl = rem === 0 ? 'Do' : (RHYTHM_SYLLABLES_12[rem] || 'Do');
    return 'Dox'.repeat(octaves) + syl;
  }

  // Negative offsets (-1 to -11) -> 1 Dox + subdivision
  if (delta > -12 && delta < 0) {
    const rem = delta + 12;
    const syl = RHYTHM_SYLLABLES_12[rem] || 'Do';
    return `Dox${syl}`;
  }

  // Deeper negative offsets (<= -24) -> multiple Dox skips
  const absDelta = Math.abs(delta);
  const octaves = Math.floor(absDelta / 12);
  const rem = ((delta % 12) + 12) % 12;
  const syl = rem === 0 ? '' : (RHYTHM_SYLLABLES_12[rem] || '');
  return 'Dox'.repeat(octaves) + syl;
}

/**
 * Resolves a signed semitone interval to PPT interval Solfège token.
 * 
 * @param {number} semitones - Signed interval
 * @returns {string} PPT Solfège interval token (e.g. 'Do', 'Re', 'Ti', 'So^', 'Fa_')
 */
export function semitoneIntervalToSolfege(semitones) {
  const INTERVAL_MAP = {
    0: 'Do',
    1: 'Ra',
    2: 'Re',
    3: 'Me',
    4: 'Mi',
    5: 'Fa',
    6: 'Fi',
    [-1]: 'Ti',
    [-2]: 'Te',
    [-3]: 'La',
    [-4]: 'Le',
    [-5]: 'So',
  };

  if (INTERVAL_MAP[semitones] !== undefined) {
    return INTERVAL_MAP[semitones];
  }

  const mod = ((semitones % 12) + 12) % 12;
  const nearest = mod <= 6 ? mod : mod - 12;
  const oct = Math.round((semitones - nearest) / 12);
  const baseSyllable = INTERVAL_MAP[nearest] || 'Do';

  if (oct > 0) {
    return baseSyllable + '^'.repeat(oct);
  } else if (oct < 0) {
    return baseSyllable + '_'.repeat(-oct);
  }
  return baseSyllable;
}

/**
 * Translates a set of held MIDI notes into a PPT Harmony Solfège chord token
 * relative to the current knot tonic.
 * 
 * @param {number[]} heldNotes - Array of active MIDI note numbers
 * @param {string} [tonicPitch='C4'] - Current Knot tonic pitch (e.g. 'C4', 'Eb4')
 * @returns {string} PPT Harmony chord token (e.g. 'Do', 'DoMe', 'DoTi', 'LaMe', 'SoTe')
 */
export function translateChordToSolfege(heldNotes, tonicPitch = 'C4') {
  if (!heldNotes || heldNotes.length === 0) return 'Do';

  const sortedNotes = [...heldNotes].sort((a, b) => a - b);
  const rootMidi = sortedNotes[0];
  const tonicMidi = pitchNameToMidi(tonicPitch || 'C4');

  // Root semitone offset from Tonic Do (0..11)
  const rootOffset = ((rootMidi - tonicMidi) % 12 + 12) % 12;
  const rootSyllable = RHYTHM_SYLLABLES_12[rootOffset] || 'Do';

  // Single note held -> default is Major Triad denoted by root alone (or root syllable)
  if (sortedNotes.length === 1) {
    return rootSyllable;
  }

  // Multiple notes held -> compute distinct pitch class intervals relative to root
  const intervals = Array.from(new Set(
    sortedNotes.map(n => ((n - rootMidi) % 12 + 12) % 12)
  )).sort((a, b) => a - b);

  const hasb9 = intervals.includes(1);
  const has9th = intervals.includes(2);
  const has3rdMinor = intervals.includes(3);
  const has3rdMajor = intervals.includes(4);
  const has11th = intervals.includes(5);
  const hasSus2 = intervals.includes(2) && !has3rdMinor && !has3rdMajor;
  const hasSus4 = intervals.includes(5) && !has3rdMinor && !has3rdMajor;
  const has5thDim = intervals.includes(6);
  const has5thPerf = intervals.includes(7);
  const has5thAug = intervals.includes(8);
  const has6th = intervals.includes(9);
  const has7thMin = intervals.includes(10);
  const has7thMaj = intervals.includes(11);

  // 1. 5th / Power Chord (Dyad: Root + 5th only, no 3rd, no 7th, no sus)
  if (
    has5thPerf &&
    !has3rdMinor &&
    !has3rdMajor &&
    !hasSus2 &&
    !hasSus4 &&
    !has5thDim &&
    !has5thAug &&
    !has6th &&
    !has7thMin &&
    !has7thMaj &&
    !hasb9
  ) {
    return `${rootSyllable}So`;
  }

  // 2. Alterations with Dominant/Major 7th
  if (has7thMin && hasb9) {
    return `${rootSyllable}TeRa`; // 7(b9)
  }
  if (has7thMin && has3rdMajor && has3rdMinor) {
    return `${rootSyllable}TeRi`; // 7(#9) Hendrix chord
  }
  if (has7thMin && (has3rdMajor || !has3rdMinor) && has5thDim) {
    return `${rootSyllable}TeFi`; // 7(#11) / 7(b5)
  }
  if (has7thMaj && has5thDim) {
    return `${rootSyllable}TiFi`; // maj7(#11)
  }
  if (has7thMin && has5thAug) {
    return `${rootSyllable}TeLe`; // 7(b13) / 7(#5)
  }

  // 3. Extended 13th, 11th, 9th Chords
  if (has7thMin && has3rdMinor && has6th) {
    return `${rootSyllable}MeTeLa`; // m13
  }
  if (has7thMaj && has6th) {
    return `${rootSyllable}TiLa`; // maj13
  }
  if (has7thMin && has6th) {
    return `${rootSyllable}TeLa`; // 13
  }
  if (has7thMin && has3rdMinor && has11th) {
    return `${rootSyllable}MeTeFa`; // m11
  }
  if (has7thMin && has11th && has9th) {
    return `${rootSyllable}TeReFa`; // 11
  }
  if (has7thMin && has3rdMinor && has9th) {
    return `${rootSyllable}MeTeRe`; // m9
  }
  if (has7thMaj && has9th) {
    return `${rootSyllable}TiRe`; // maj9
  }
  if (has7thMin && has9th) {
    return `${rootSyllable}TeRe`; // 9
  }
  if (has3rdMajor && has9th && !has7thMin && !has7thMaj) {
    return `${rootSyllable}MiRe`; // add9
  }

  // 4. Diminished 7th, Half-Diminished, Diminished Triad
  if (has5thDim && has6th) {
    return `${rootSyllable}MeFiLa`; // full diminished 7th (dim7)
  }
  if (has5thDim && has7thMin) {
    return `${rootSyllable}MeFiTe`; // half-diminished (m7b5)
  }
  if (has5thDim) {
    return `${rootSyllable}MeFi`; // diminished triad
  }

  // 5. Minor Chords
  if (has3rdMinor) {
    if (has7thMaj) return `${rootSyllable}MeTi`; // m(maj7)
    if (has7thMin) return `${rootSyllable}MeTe`; // m7
    if (has6th) return `${rootSyllable}MeLa`; // m6
    return `${rootSyllable}Me`; // minor triad
  }

  // 6. Sus Chords
  if (hasSus4) {
    if (has7thMin) return `${rootSyllable}FaTe`; // 7sus4
    return `${rootSyllable}Fa`; // sus4
  }
  if (hasSus2) {
    return `${rootSyllable}Re`; // sus2
  }

  // 7. Augmented Chords
  if (has5thAug) {
    return `${rootSyllable}Le`; // aug triad
  }

  // 8. 7th / 6th Major Triad Based Chords
  if (has7thMaj) {
    return `${rootSyllable}Ti`; // maj7
  }
  if (has7thMin) {
    return `${rootSyllable}Te`; // dom7
  }
  if (has6th) {
    return `${rootSyllable}La`; // 6
  }

  // 9. Default Triad (Major)
  return rootSyllable;
}

/**
 * Calculates absolute MIDI pitch of the preceding note in a melody array.
 * 
 * @param {string[]} precedingTokens - Array of Solfège tokens up to cursor
 * @param {string} [tonicPitch='C4'] - Knot tonic pitch
 * @returns {number} Absolute MIDI note number
 */
export function calculatePrecedingMelodyPitch(precedingTokens, tonicPitch = 'C4') {
  const tonicMidi = pitchNameToMidi(tonicPitch || 'C4');
  if (!precedingTokens || precedingTokens.length === 0) {
    return tonicMidi;
  }

  let currentPitch = tonicMidi;
  let isIntervalMode = false;

  for (let i = 0; i < precedingTokens.length; i++) {
    const raw = precedingTokens[i].trim();
    if (!raw || raw === 'R' || raw === '~') continue;

    const parsed = parseMelodyToken(raw);
    if (parsed.isRest || parsed.isRepeat || parsed.isUnknown || parsed.baseSemitone === undefined) {
      continue;
    }

    if (i === 0 && parsed.hasAxis) {
      isIntervalMode = true;
      currentPitch = tonicMidi + parsed.baseSemitone + (parsed.octShift * 12);
    } else if (isIntervalMode) {
      const interval = parsed.baseSemitone + (parsed.octShift * 12);
      currentPitch += interval;
    } else {
      currentPitch = tonicMidi + parsed.baseSemitone + (parsed.octShift * 12);
    }
  }

  return currentPitch;
}

/**
 * Translates a MIDI note into a PPT Melody Solfège token in either Absolute or Interval mode.
 * 
 * @param {number} midiNote - Pressed MIDI note number
 * @param {string} [tonicPitch='C4'] - Knot tonic pitch
 * @param {'absolute'|'interval'} [mode='absolute'] - Melody representation mode
 * @param {string[]} [precedingTokens=[]] - Tokens preceding the cursor
 * @returns {string} Solfège token (e.g. 'Do', 'Re', 'So^', 'Dox')
 */
export function translateMelodyNoteToSolfege(midiNote, tonicPitch = 'C4', mode = 'absolute', precedingTokens = []) {
  const tonicMidi = pitchNameToMidi(tonicPitch || 'C4');

  if (mode === 'interval') {
    if (!precedingTokens || precedingTokens.length === 0) {
      // First token in interval mode gets axis anchor 'x'
      const delta = midiNote - tonicMidi;
      const absSyllable = semitonesToSolfege(delta);
      return absSyllable.replace(/^([a-zA-Z]+)([\^_]*)$/, '$1x$2');
    }

    const prevPitch = calculatePrecedingMelodyPitch(precedingTokens, tonicPitch);
    const diff = midiNote - prevPitch;
    return semitoneIntervalToSolfege(diff);
  }

  // Absolute mode: semitones relative to Tonic
  const delta = midiNote - tonicMidi;
  return semitonesToSolfege(delta);
}

/**
 * Scans CodeMirror editor at current cursor position to detect enclosing Solfège array context.
 * 
 * @param {object} cm - CodeMirror instance
 * @returns {object|null} Context metadata or null if cursor is not on a Solfège array
 */
export function getSolfegeArrayContextAtCursor(cm) {
  if (!cm) return null;
  const cursor = cm.getCursor();
  const lineNum = cursor.line;
  const lineText = cm.getLine(lineNum) || '';

  // 1. Check if line contains a Solfège property key
  const propMatch = lineText.match(/^\s*(?:-\s*)?(melody|harmony|chords|rhythm|pitches|pulse)\s*:\s*(.*)$/i);
  let layer = null;
  let rawContent = '';
  let isInlineArray = false;

  if (propMatch) {
    const rawKey = propMatch[1].toLowerCase();
    if (rawKey === 'melody' || rawKey === 'pitches') layer = 'melody';
    else if (rawKey === 'harmony' || rawKey === 'chords') layer = 'harmony';
    else if (rawKey === 'rhythm' || rawKey === 'pulse') layer = 'rhythm';
    rawContent = propMatch[2];
  } else {
    // Check if cursor is on a bullet array item under a Solfège block
    const bulletMatch = lineText.match(/^\s*-\s+(?:\[(.*?)\]|(.*))$/);
    if (bulletMatch) {
      // Look up lines to find parent property
      for (let l = lineNum - 1; l >= Math.max(0, lineNum - 10); l--) {
        const pLine = cm.getLine(l) || '';
        const pMatch = pLine.match(/^\s*(melody|harmony|chords|rhythm|pitches|pulse)\s*:/i);
        if (pMatch) {
          const rawKey = pMatch[1].toLowerCase();
          if (rawKey === 'melody' || rawKey === 'pitches') layer = 'melody';
          else if (rawKey === 'harmony' || rawKey === 'chords') layer = 'harmony';
          else if (rawKey === 'rhythm' || rawKey === 'pulse') layer = 'rhythm';
          break;
        }
      }
    }
  }

  if (!layer) return null;

  // 2. Parse inline array bracket bounds if present
  const openBracketIdx = lineText.indexOf('[');
  const closeBracketIdx = lineText.lastIndexOf(']');
  isInlineArray = openBracketIdx !== -1;

  // Extract tokens from line
  const tokenRegex = /([a-zA-Z0-9\^_~#\/\.\+\-]+)/g;
  const tokens = [];
  let tm;
  while ((tm = tokenRegex.exec(lineText)) !== null) {
    const raw = tm[1];
    if (raw === '[' || raw === ']' || raw === ',') continue;
    if (propMatch && tm.index < lineText.indexOf(':')) continue; // Skip property name
    tokens.push({
      token: raw,
      start: tm.index,
      end: tm.index + raw.length,
    });
  }

  // Find token index nearest/before cursor
  let precedingTokens = [];
  let tokenIndexAtCursor = -1;

  for (let i = 0; i < tokens.length; i++) {
    if (cursor.ch >= tokens[i].start) {
      tokenIndexAtCursor = i;
    }
  }

  if (tokenIndexAtCursor >= 0) {
    precedingTokens = tokens.slice(0, tokenIndexAtCursor + 1).map(t => t.token);
  }

  // Determine mode for melody (Interval if 1st token has axis marker 'x', otherwise Absolute)
  let melodyMode = 'absolute';
  if (layer === 'melody') {
    if (tokens.length > 0 && /x/i.test(tokens[0].token)) {
      melodyMode = 'interval';
    }
  }

  return {
    layer,
    lineNum,
    lineText,
    isInlineArray,
    openBracketIdx,
    closeBracketIdx,
    tokens,
    tokenIndexAtCursor,
    precedingTokens,
    melodyMode,
    cursor,
  };
}

/**
 * Inserts or appends a Solfège token at or after the current cursor position in CodeMirror.
 * Automatically advances cursor to the newly inserted token.
 * 
 * @param {object} cm - CodeMirror instance
 * @param {string} token - Solfège token to insert (e.g. 'Do', 'Re', 'LaMe')
 * @returns {boolean} True if inserted successfully
 */
export function insertSolfegeTokenAtCursor(cm, token) {
  if (!cm || !token) return false;
  const context = getSolfegeArrayContextAtCursor(cm);
  if (!context) return false;

  const { lineNum, lineText, isInlineArray, openBracketIdx, closeBracketIdx, tokens, tokenIndexAtCursor, cursor } = context;

  // Case 1: Line has inline array `[...]`
  if (isInlineArray) {
    // Array is empty: `prop: []`
    if (openBracketIdx !== -1 && closeBracketIdx !== -1 && tokens.length === 0) {
      const insertPos = { line: lineNum, ch: openBracketIdx + 1 };
      cm.replaceRange(token, insertPos, insertPos);
      const newCursor = { line: lineNum, ch: openBracketIdx + 1 + token.length };
      cm.setCursor(newCursor);
      return true;
    }

    // Cursor is at or after the last token, or after close bracket
    if (tokenIndexAtCursor === tokens.length - 1 || (tokenIndexAtCursor === -1 && cursor.ch >= closeBracketIdx)) {
      const lastToken = tokens[tokens.length - 1];
      const insertCh = closeBracketIdx > 0 ? closeBracketIdx : (lastToken ? lastToken.end : lineText.length);
      const textToInsert = tokens.length > 0 ? `, ${token}` : token;
      const insertPos = { line: lineNum, ch: insertCh };
      cm.replaceRange(textToInsert, insertPos, insertPos);
      const newCursor = { line: lineNum, ch: insertCh + textToInsert.length };
      cm.setCursor(newCursor);
      return true;
    }

    // Cursor is at a middle token -> insert immediately after it
    if (tokenIndexAtCursor >= 0 && tokenIndexAtCursor < tokens.length - 1) {
      const currentToken = tokens[tokenIndexAtCursor];
      const insertCh = currentToken.end;
      const textToInsert = `, ${token}`;
      const insertPos = { line: lineNum, ch: insertCh };
      cm.replaceRange(textToInsert, insertPos, insertPos);
      const newCursor = { line: lineNum, ch: insertCh + textToInsert.length };
      cm.setCursor(newCursor);
      return true;
    }
  }

  // Case 2: Line is `property:` without brackets
  const colonIdx = lineText.indexOf(':');
  if (colonIdx !== -1) {
    const afterColon = lineText.slice(colonIdx + 1).trim();
    if (!afterColon) {
      const insertPos = { line: lineNum, ch: lineText.length };
      cm.replaceRange(` [${token}]`, insertPos, insertPos);
      cm.setCursor({ line: lineNum, ch: lineText.length + 2 + token.length });
      return true;
    }
  }

  // Case 3: Fallback standard insertion at cursor
  cm.replaceRange(token, cursor, cursor);
  cm.setCursor({ line: cursor.line, ch: cursor.ch + token.length });
  return true;
}

/**
 * Central Web MIDI Input Manager Class
 */
export class MidiManager {
  constructor() {
    this.midiAccess = null;
    this.devices = [];
    this.activeDeviceId = 'all';
    this.heldNotes = new Set();
    this.editorGetter = null;
    this.isListening = false;
  }

  /**
   * Initializes MIDI access and binds hardware listeners.
   * 
   * @param {Function} editorGetter - Function returning active CodeMirror instance
   */
  async init(editorGetter) {
    this.editorGetter = editorGetter;
    this.activeDeviceId = state.preferences.midiDeviceId || 'all';

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.warn('Web MIDI API is not supported in this browser environment.');
      events.emit('midi:status', { status: 'unsupported', message: 'Web MIDI API not supported' });
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateDeviceList();
      this.bindInputs();

      this.midiAccess.onstatechange = (e) => {
        this.updateDeviceList();
        this.bindInputs();
        events.emit('midi:devicechange', { port: e.port, devices: this.devices });
      };

      this.isListening = true;
      events.emit('midi:status', {
        status: this.devices.length > 0 ? 'connected' : 'no-devices',
        devices: this.devices,
      });
      return true;
    } catch (err) {
      console.warn('MIDI Access request denied or failed:', err);
      events.emit('midi:status', { status: 'denied', error: err });
      return false;
    }
  }

  /**
   * Scans and updates available MIDI input devices.
   */
  updateDeviceList() {
    if (!this.midiAccess) return;
    const inputs = Array.from(this.midiAccess.inputs.values());
    this.devices = inputs.map(input => ({
      id: input.id,
      name: input.name || `MIDI Device (${input.id})`,
      manufacturer: input.manufacturer || '',
      state: input.state,
    }));
    events.emit('midi:devices', this.devices);
  }

  /**
   * Binds MIDI message listener to connected inputs according to device filter.
   */
  bindInputs() {
    if (!this.midiAccess) return;
    const inputs = Array.from(this.midiAccess.inputs.values());

    for (const input of inputs) {
      input.onmidimessage = (event) => {
        if (!state.preferences.midiEnabled) return;
        if (this.activeDeviceId !== 'all' && input.id !== this.activeDeviceId) {
          return;
        }
        this.handleMidiMessage(event);
      };
    }
  }

  /**
   * Sets target MIDI input device ID ('all' for all devices).
   * 
   * @param {string} deviceId
   */
  selectDevice(deviceId) {
    this.activeDeviceId = deviceId || 'all';
    setPreference('midiDeviceId', this.activeDeviceId);
    this.bindInputs();
    events.emit('midi:device-selected', this.activeDeviceId);
  }

  /**
   * Handles incoming raw MIDI message.
   * 
   * @param {MIDIMessageEvent} event
   */
  handleMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status >> 4;

    // Note On (with velocity > 0)
    if (command === 0x9 && velocity > 0) {
      this.handleNoteOn(note, velocity);
    }
    // Note Off (or Note On with velocity 0)
    else if (command === 0x8 || (command === 0x9 && velocity === 0)) {
      this.handleNoteOff(note);
    }
  }

  /**
   * Handles Note On event with contextual routing.
   * 
   * @param {number} note - MIDI note number (0..127)
   * @param {number} velocity - Key velocity (1..127)
   */
  handleNoteOn(note, velocity) {
    const cm = this.editorGetter?.();
    if (!cm) return;

    const context = getSolfegeArrayContextAtCursor(cm);
    if (!context) {
      // Cursor not in a Solfège array, record note for tracking only
      this.heldNotes.add(note);
      return;
    }

    const { layer } = context;

    // 1. Rhythm Layer -> Universal Rhythm Do
    if (layer === 'rhythm') {
      const rhythmDo = state.preferences.midiRhythmDo || 'C4';
      const token = mapRhythmNoteToSolfege(note, rhythmDo);
      insertSolfegeTokenAtCursor(cm, token);
      events.emit('midi:note', { note, token, layer: 'rhythm' });
      this.heldNotes.add(note);
      return;
    }

    // 2. Melody Layer -> Absolute / Interval relative to active Knot tonic
    if (layer === 'melody') {
      const tonic = this.getActiveKnotTonic();
      const token = translateMelodyNoteToSolfege(
        note,
        tonic,
        context.melodyMode,
        context.precedingTokens
      );
      insertSolfegeTokenAtCursor(cm, token);
      events.emit('midi:note', { note, token, layer: 'melody', mode: context.melodyMode });
      this.heldNotes.add(note);
      return;
    }

    // 3. Harmony Layer -> Confirmation key protocol (lowest note - 12)
    if (layer === 'harmony') {
      if (this.heldNotes.size > 0) {
        const minHeldNote = Math.min(...Array.from(this.heldNotes));
        const confirmationNote = minHeldNote - 12;

        if (note === confirmationNote) {
          // Confirmation key pressed! Translate held chord tones to Solfège
          const tonic = this.getActiveKnotTonic();
          const chordNotes = Array.from(this.heldNotes);
          const chordToken = translateChordToSolfege(chordNotes, tonic);
          insertSolfegeTokenAtCursor(cm, chordToken);
          events.emit('midi:chord', { chordNotes, token: chordToken, layer: 'harmony' });
          return;
        }
      }

      // Add to held chord tones
      this.heldNotes.add(note);
      events.emit('midi:harmony-held', { heldNotes: Array.from(this.heldNotes) });
    }
  }

  /**
   * Handles Note Off event.
   * 
   * @param {number} note - Released MIDI note number
   */
  handleNoteOff(note) {
    this.heldNotes.delete(note);
    events.emit('midi:noteoff', { note, remainingHeld: Array.from(this.heldNotes) });
  }

  /**
   * Reads active Knot's declared tonic pitch from editor or state.
   * 
   * @returns {string} Tonic pitch name (e.g. 'C4', 'Eb4', 'D#4')
   */
  getActiveKnotTonic() {
    const cm = this.editorGetter?.();
    if (cm) {
      const yamlText = cm.getValue();
      const currentKnotId = state.currentKnotId || 'default';

      // Search for knot definition
      const knotRegex = new RegExp(`(?:knots:\\s*[\\s\\S]*?${currentKnotId}\\s*:[\\s\\S]*?tonic\\s*:\\s*["']?([A-G](?:#|b|♭)?\\d+)["']?|knot\\s*:[\\s\\S]*?tonic\\s*:\\s*["']?([A-G](?:#|b|♭)?\\d+)["']?)`, 'i');
      const match = yamlText.match(knotRegex);
      if (match && (match[1] || match[2])) {
        return match[1] || match[2];
      }

      // General tonic fallback match
      const fallbackMatch = yamlText.match(/^\s*tonic\s*:\s*["']?([A-G](?:#|b|♭)?\\d+)["']?/m);
      if (fallbackMatch) {
        return fallbackMatch[1];
      }
    }
    return 'C4';
  }
}

export const midiManager = new MidiManager();
