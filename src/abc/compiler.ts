/**
 * Tapestry-to-ABC Compiler.
 *
 * Translates resolved PPT OnsetStream and Knot definitions into YuE2-compliant
 * ABC notation with V: Vocal and V: Ins voices, inline chord annotations,
 * section comments, and measure interleaving.
 */

import type { OnsetStream, Onset } from '../schema/onset.js';
import type { ResolvedKnot } from '../solfege/pitch.js';
import { parseHarmonyChord, solfegeToHarmonyRootOffset } from '../solfege/pitch.js';
import { pitchToAbc } from './pitch.js';
import { parseMeterToBeats, deriveAbcMeter, beatsToAbcDuration } from './rhythm.js';

export interface AbcOptions {
  /** Score title */
  title?: string;
  /** Composer */
  composer?: string;
  /** Tempo in BPM (default from knot or 120) */
  tempo?: number;
  /** Time signature (default from knot or "4/4") */
  meter?: string;
  /** Unit note length denominator (default: 8 for L: 1/8) */
  unitDenominator?: number;
  /** Explicit key signature override (e.g. "C", "G", "Am", "Dm") */
  keySignature?: string;
  /** Specific weave ID(s) to route to V: Vocal */
  vocalWeaveIds?: string[];
  /** Specific weave ID(s) to route to V: Ins */
  instrumentalWeaveIds?: string[];
  /** Number of measures per interleaved system block (default: 4) */
  measuresPerBlock?: number;
  /** Whether to emit section comments (e.g. % verse) */
  emitSectionComments?: boolean;
  /** Whether to format as pure instrumental */
  isInstrumental?: boolean;
  /** Voice mode: 'dual' (default, V: Vocal + V: Ins) or 'single' (V: Ins only) */
  voiceMode?: 'dual' | 'single';
  /** Whether to use timed section tags (e.g. % [intro 0:00-0:08]) instead of bare names (default: true) */
  useTimedTags?: boolean;
}

export type YuESectionName = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro';

export interface ScoreSection {
  name: YuESectionName;
  startMeasure: number;
  endMeasure: number;
  startBeat: number;
  endBeat: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  timedTag: string;
}

export interface ScoreTiming {
  tempo: number;
  meter: string;
  beatsPerMeasure: number;
  totalBeats: number;
  totalMeasures: number;
  durationSeconds: number;
  formattedDuration: string;
  sections: ScoreSection[];
  timedSectionPlan: string;
}

/**
 * Formats a duration in seconds to standard 'm:ss' time representation.
 */
export function formatTimestamp(seconds: number): string {
  const totalSec = Math.max(0, Math.round(seconds));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculates deterministic beat offsets, measures, section timings, and runtime in seconds
 * for a resolved PPT OnsetStream and Knot definition.
 */
export function calculateScoreTiming(
  onsets: OnsetStream,
  knot?: ResolvedKnot,
  options: AbcOptions = {}
): ScoreTiming {
  const tempo = options.tempo || knot?.tempo || 120;
  const rawMeter = options.meter || knot?.timeSignature || knot?.meter || knot?.pulse || knot?.pulseSignature || '4/4';
  const { meterString, beatsPerMeasure } = deriveAbcMeter(rawMeter);

  const secondsPerBeat = 60 / tempo;
  const secondsPerMeasure = beatsPerMeasure * secondsPerBeat;

  let maxBeat = 0;
  for (const onset of onsets) {
    const end = (onset.startBeat ?? 0) + (onset.durationBeats ?? 1.0);
    if (end > maxBeat) {
      maxBeat = end;
    }
  }

  const totalMeasures = Math.max(1, Math.ceil(maxBeat / beatsPerMeasure));
  const totalBeats = totalMeasures * beatsPerMeasure;

  let measuresPerBlock = options.measuresPerBlock;
  if (!measuresPerBlock) {
    if (totalMeasures <= 4) {
      measuresPerBlock = Math.max(1, Math.floor(totalMeasures / 2)) || 2;
    } else {
      measuresPerBlock = 4;
    }
  }

  const standardProgression: YuESectionName[] = [
    'intro',
    'verse',
    'chorus',
    'bridge',
    'verse',
    'chorus',
    'outro',
  ];

  const sections: ScoreSection[] = [];
  let blockIndex = 0;

  for (let m = 0; m < totalMeasures; m += measuresPerBlock) {
    const endM = Math.min(m + measuresPerBlock, totalMeasures);
    const startBeat = m * beatsPerMeasure;
    const endBeat = endM * beatsPerMeasure;
    const startTimeSeconds = Math.round(startBeat * secondsPerBeat * 10) / 10;
    const endTimeSeconds = Math.round(endBeat * secondsPerBeat * 10) / 10;

    // Check if onsets in this measure window have semantic weave names
    let detectedName: YuESectionName | undefined;
    for (const onset of onsets) {
      const onsetBeat = onset.startBeat ?? 0;
      if (onsetBeat >= startBeat - 1e-4 && onsetBeat < endBeat - 1e-4) {
        const wId = (onset.weaveId || '').toLowerCase();
        if (wId.includes('intro')) { detectedName = 'intro'; break; }
        if (wId.includes('verse')) { detectedName = 'verse'; break; }
        if (wId.includes('chorus') || wId.includes('hook') || wId.includes('refrain')) { detectedName = 'chorus'; break; }
        if (wId.includes('bridge') || wId.includes('turnaround')) { detectedName = 'bridge'; break; }
        if (wId.includes('outro') || wId.includes('coda') || wId.includes('resolution')) { detectedName = 'outro'; break; }
      }
    }

    let name: YuESectionName;
    if (detectedName) {
      name = detectedName;
    } else {
      if (totalMeasures <= 2 && m === 0) {
        name = 'intro';
      } else if (blockIndex < standardProgression.length) {
        name = standardProgression[blockIndex];
      } else {
        name = 'verse';
      }
    }

    const startFormatted = formatTimestamp(startTimeSeconds);
    const endFormatted = formatTimestamp(endTimeSeconds);

    sections.push({
      name,
      startMeasure: m,
      endMeasure: endM,
      startBeat,
      endBeat,
      startTimeSeconds,
      endTimeSeconds,
      startTimeFormatted: startFormatted,
      endTimeFormatted: endFormatted,
      timedTag: `[${name} ${startFormatted}-${endFormatted}]`,
    });

    blockIndex++;
  }

  // Ensure an outro section exists so the autoregressive model cleanly resolves
  // without looping, and allows natural reverb/decay of the final chord.
  const lastSection = sections[sections.length - 1];
  let finalDurationSeconds = lastSection ? lastSection.endTimeSeconds : 0;

  if (lastSection && lastSection.name !== 'outro') {
    const outroStartSec = lastSection.endTimeSeconds;
    const outroBufferSec = Math.max(2.0, Math.round(secondsPerMeasure / 2));
    const outroEndSec = Math.round((outroStartSec + outroBufferSec) * 10) / 10;
    const outroStartFormatted = formatTimestamp(outroStartSec);
    const outroEndFormatted = formatTimestamp(outroEndSec);

    sections.push({
      name: 'outro',
      startMeasure: lastSection.endMeasure,
      endMeasure: lastSection.endMeasure,
      startBeat: lastSection.endBeat,
      endBeat: lastSection.endBeat,
      startTimeSeconds: outroStartSec,
      endTimeSeconds: outroEndSec,
      startTimeFormatted: outroStartFormatted,
      endTimeFormatted: outroEndFormatted,
      timedTag: `[outro ${outroStartFormatted}-${outroEndFormatted}]`,
    });

    finalDurationSeconds = outroEndSec;
  }

  const timedSectionPlan = sections.map(s => s.timedTag).join('\n');
  const formattedDuration = formatTimestamp(finalDurationSeconds);

  return {
    tempo,
    meter: meterString,
    beatsPerMeasure,
    totalBeats,
    totalMeasures,
    durationSeconds: finalDurationSeconds,
    formattedDuration,
    sections,
    timedSectionPlan,
  };
}

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts a Solfège harmony chord token into a standard lead sheet chord symbol
 * for embedding in ABC notation (e.g. "Am7", "D7", "Gmaj7", "C", "C/G").
 */
export function chordTokenToLeadSheet(
  chordToken?: string | null,
  knotDoMidi = 60,
  preferredAccidental: 'sharp' | 'flat' = 'sharp'
): string {
  if (!chordToken) return '';

  try {
    const parsed = parseHarmonyChord(chordToken);
    const rootOffset = solfegeToHarmonyRootOffset(parsed.rootSyllable);
    const rootMidi = knotDoMidi + rootOffset + (parsed.octaveShift * 12);
    const rootPc = ((rootMidi % 12) + 12) % 12;
    const names = preferredAccidental === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
    const rootName = names[rootPc];

    // Map quality to lead sheet chord suffix
    let suffix = '';
    switch (parsed.quality) {
      case 'major': suffix = ''; break;
      case 'minor': suffix = 'm'; break;
      case 'dominant7': suffix = '7'; break;
      case 'major7': suffix = 'maj7'; break;
      case 'minor7': suffix = 'm7'; break;
      case 'halfDiminished7': suffix = 'm7b5'; break;
      case 'diminished': suffix = 'dim'; break;
      case 'diminished7': suffix = 'dim7'; break;
      case 'minorMajor7': suffix = 'm(maj7)'; break;
      case 'major6': suffix = '6'; break;
      case 'minor6': suffix = 'm6'; break;
      case 'sus4': suffix = 'sus4'; break;
      case 'sus2': suffix = 'sus2'; break;
      case '7sus4': suffix = '7sus4'; break;
      case 'dominant9': suffix = '9'; break;
      case 'major9': suffix = 'maj9'; break;
      case 'minor9': suffix = 'm9'; break;
      case 'add9': suffix = 'add9'; break;
      case 'dominant11': suffix = '11'; break;
      case 'minor11': suffix = 'm11'; break;
      case 'dominant13': suffix = '13'; break;
      case 'major13': suffix = 'maj13'; break;
      case 'minor13': suffix = 'm13'; break;
      case 'dominant7b9': suffix = '7b9'; break;
      case 'dominant7sharp9': suffix = '7#9'; break;
      case 'dominant7sharp11': suffix = '7#11'; break;
      case 'major7sharp11': suffix = 'maj7#11'; break;
      case 'dominant7b13': suffix = '7b13'; break;
      case 'augmented': suffix = 'aug'; break;
      case 'fifth': suffix = '5'; break;
      default: suffix = ''; break;
    }

    let slashBass = '';
    if (parsed.hasAxisBass && parsed.bassSyllable) {
      const bassOffset = solfegeToHarmonyRootOffset(parsed.bassSyllable);
      const bassMidi = knotDoMidi + bassOffset;
      const bassPc = ((bassMidi % 12) + 12) % 12;
      if (bassPc !== rootPc) {
        slashBass = `/${names[bassPc]}`;
      }
    }

    return `${rootName}${suffix}${slashBass}`;
  } catch {
    return '';
  }
}

/**
 * Derives an ABC Key signature string from knot tonic and scale.
 */
export function deriveAbcKey(knot?: ResolvedKnot): string {
  if (!knot) return 'C';
  const tonicPitch = knot.doName || (knot as any).tonic || 'C4';
  const match = tonicPitch.match(/^([A-Ga-g])([#b]?)/);
  if (!match) return 'C';
  const letter = match[1].toUpperCase();
  const acc = match[2].toLowerCase(); // Preserve lowercase 'b' for flat or '#' for sharp
  const baseTonic = `${letter}${acc}`;

  const scale = typeof knot.scale === 'string' ? knot.scale : 'Do';
  if (scale === 'La' || scale === 'LaTi' || scale === 'DoMe') {
    return `${baseTonic}m`;
  }
  if (scale === 'Re') {
    return `${baseTonic}m`; // Dorian
  }
  return baseTonic;
}

interface TimedEvent {
  startBeat: number;
  durationBeats: number;
  pitch: string;
  isRest: boolean;
  chord?: string;
  weaveId: string;
  coilId: string;
  voiceIndex: number;
}

/**
 * Compiles a resolved PPT OnsetStream and Knot into ABC music notation.
 */
export function compileToAbc(
  onsets: OnsetStream,
  knot?: ResolvedKnot,
  options: AbcOptions = {}
): string {
  const timing = calculateScoreTiming(onsets, knot, options);
  const title = options.title || knot?.title || 'Prime Period Composition';
  const composer = options.composer || knot?.composer || 'PPT Engraver';
  const tempo = timing.tempo;
  const meterString = timing.meter;
  const beatsPerMeasure = timing.beatsPerMeasure;
  const useTimedTags = options.useTimedTags !== false;

  // YuE / SheetSage standard is L: 1/16 for whole integer token durations without fractions
  const unitDen = options.unitDenominator || 16;
  const keySig = options.keySignature || deriveAbcKey(knot);
  const preferredAccidental: 'sharp' | 'flat' = (
    keySig.includes('b') || ['F', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'].includes(keySig)
  ) ? 'flat' : 'sharp';

  let measuresPerBlock = options.measuresPerBlock;
  if (!measuresPerBlock) {
    if (timing.totalMeasures <= 4) {
      measuresPerBlock = Math.max(1, Math.floor(timing.totalMeasures / 2)) || 2;
    } else {
      measuresPerBlock = 4;
    }
  }

  const emitSections = options.emitSectionComments !== false;
  const knotDoMidi = knot?.doMidi || 60;

  // 1. Separate onsets into Vocal (Lead) vs Instrumental (Accompaniment) tracks
  const vocalEvents: TimedEvent[] = [];
  const insEvents: TimedEvent[] = [];

  const vocalWeaves = new Set(options.vocalWeaveIds || []);
  const insWeaves = new Set(options.instrumentalWeaveIds || []);
  const isInstrumental = options.isInstrumental !== undefined
    ? Boolean(options.isInstrumental)
    : (vocalWeaves.size === 0);
  const voiceMode = options.voiceMode || 'dual';

  let lastChord = '';

  for (const onset of onsets) {
    const startBeat = onset.startBeat ?? 0;
    const durationBeats = onset.durationBeats ?? 1.0;
    const isRest = Boolean(onset.isRest);
    const pitch = onset.pitch || 'C4';
    const voiceIndex = onset.voiceIndex || 1;

    let chordLead = '';
    if (onset.chordRoot && onset.chordRoot !== lastChord) {
      chordLead = chordTokenToLeadSheet(onset.chordRoot, knotDoMidi, preferredAccidental);
      lastChord = onset.chordRoot;
    }

    const event: TimedEvent = {
      startBeat,
      durationBeats,
      pitch,
      isRest,
      chord: chordLead,
      weaveId: onset.weaveId,
      coilId: onset.coilId,
      voiceIndex,
    };

    if (insWeaves.size > 0 && insWeaves.has(onset.weaveId)) {
      insEvents.push(event);
    } else if (vocalWeaves.size > 0 && vocalWeaves.has(onset.weaveId)) {
      vocalEvents.push(event);
    } else {
      if (voiceMode === 'single') {
        insEvents.push(event);
      } else {
        if (voiceIndex === 1) {
          vocalEvents.push(event);
        } else {
          insEvents.push(event);
        }
      }
    }
  }

  // 2. Build measures from timed events
  const vocalMeasures = vocalEvents.length > 0
    ? buildMeasures(vocalEvents, beatsPerMeasure, unitDen)
    : [];

  const initialMeasureCount = Math.max(vocalMeasures.length, 1);

  const insMeasures = insEvents.length > 0
    ? buildMeasures(insEvents, beatsPerMeasure, unitDen)
    : buildChordProgressionMeasures(onsets, knotDoMidi, preferredAccidental, initialMeasureCount, beatsPerMeasure, unitDen);

  const totalMeasures = Math.max(vocalMeasures.length, insMeasures.length, 1);

  // 3. Assemble ABC Output with official SheetSage2 / YuE headers
  const lines: string[] = [];
  lines.push('X:1');
  lines.push(`T:${title}`);
  if (composer) lines.push(`C:${composer}`);
  lines.push(`M:${meterString}`);
  lines.push(`L:1/${unitDen}`);
  lines.push(`Q:1/4=${tempo}`);

  const leadVoiceId = isInstrumental ? 'InsLead' : 'Vocal';
  const leadName = isInstrumental ? 'InsLead Melody' : 'Vocal Melody';
  const leadSnm = isInstrumental ? 'Inst.' : 'Vocal';

  let currentSection = '';

  if (voiceMode === 'single') {
    // Single Voice: Declare ONLY V: InsLead or V: Ins
    lines.push(`V: ${leadVoiceId} clef=treble name="${leadName}" snm="${leadSnm}"`);
    lines.push(`K:${keySig}`);

    for (let m = 0; m < totalMeasures; m += measuresPerBlock) {
      const endM = Math.min(m + measuresPerBlock, totalMeasures);
      const sec = timing.sections.find(s => s.startMeasure === m) ||
                  timing.sections.find(s => m >= s.startMeasure && m < s.endMeasure);

      const secName = sec ? sec.name : (m === 0 ? 'intro' : 'verse');
      if (emitSections && secName !== currentSection) {
        lines.push(`% ${secName}`);
        currentSection = secName;
      }

      lines.push(`V: ${leadVoiceId}`);
      const leadSlice = (vocalMeasures.length > 0 ? vocalMeasures : insMeasures).slice(m, endM);
      lines.push(leadSlice.join('|') + '|');
    }
  } else {
    // Dual-Voice (SheetSage2 format: V: InsLead + V: Ins)
    lines.push(`V: ${leadVoiceId} clef=treble name="${leadName}" snm="${leadSnm}"`);
    lines.push('V: Ins clef=treble name="Ins Melody" snm="Inst."');
    lines.push(`K:${keySig}`);

    for (let m = 0; m < totalMeasures; m += measuresPerBlock) {
      const endM = Math.min(m + measuresPerBlock, totalMeasures);
      const blockSize = endM - m;
      const sec = timing.sections.find(s => s.startMeasure === m) ||
                  timing.sections.find(s => m >= s.startMeasure && m < s.endMeasure);

      const secName = sec ? sec.name : (m === 0 ? 'intro' : 'verse');
      if (emitSections && secName !== currentSection) {
        lines.push(`% ${secName}`);
        currentSection = secName;
      }

      // Lead Melody Block
      lines.push(`V: ${leadVoiceId}`);
      const leadSlice = (vocalMeasures.length > 0 ? vocalMeasures : insMeasures).slice(m, endM);
      lines.push(leadSlice.join('|') + '|');

      // Accompaniment Block
      lines.push('V: Ins');
      if (insEvents.length > 0) {
        const insSlice = insMeasures.slice(m, endM);
        const allRests = insSlice.every(bar => bar === 'Z' || bar === `z${beatsToAbcDuration(beatsPerMeasure, unitDen)}`);
        if (allRests) {
          lines.push(blockSize > 1 ? `Z${blockSize}|` : 'Z|');
        } else {
          lines.push(insSlice.join('|') + '|');
        }
      } else {
        // No explicit accompaniment notes -> emit standard SheetSage2 multi-measure rest
        lines.push(blockSize > 1 ? `Z${blockSize}|` : 'Z|');
      }
    }
  }

  // If timing contains an outro section that extends beyond totalMeasures:
  const outroSec = timing.sections.find(s => s.name === 'outro' && s.startMeasure === s.endMeasure);
  if (emitSections && outroSec && currentSection !== 'outro') {
    lines.push('% outro');
    lines.push(`V: ${leadVoiceId}`);
    lines.push('Z|');
    if (voiceMode !== 'single') {
      lines.push('V: Ins');
      lines.push('Z|');
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Builds harmonic accompaniment measures containing explicit chord symbols across the timeline.
 */
function buildChordProgressionMeasures(
  onsets: OnsetStream,
  knotDoMidi: number,
  preferredAccidental: 'sharp' | 'flat',
  totalMeasures: number,
  beatsPerMeasure: number,
  unitDen: number
): string[] {
  interface ChordPoint {
    beat: number;
    chord: string;
  }
  const chordPoints: ChordPoint[] = [];
  let lastChord = '';

  for (const onset of onsets) {
    if (onset.chordRoot && onset.chordRoot !== lastChord) {
      const chordName = chordTokenToLeadSheet(onset.chordRoot, knotDoMidi, preferredAccidental);
      if (chordName) {
        chordPoints.push({ beat: onset.startBeat ?? 0, chord: chordName });
        lastChord = onset.chordRoot;
      }
    }
  }

  const fullRest = `z${beatsToAbcDuration(beatsPerMeasure, unitDen)}`;
  if (chordPoints.length === 0) {
    return Array(totalMeasures).fill(fullRest);
  }

  function getChordAtBeat(beat: number): string {
    let chord = chordPoints[0].chord;
    for (const pt of chordPoints) {
      if (pt.beat <= beat + 1e-4) {
        chord = pt.chord;
      } else {
        break;
      }
    }
    return chord;
  }

  const measures: string[] = [];

  for (let m = 0; m < totalMeasures; m++) {
    const barStart = m * beatsPerMeasure;
    const barEnd = (m + 1) * beatsPerMeasure;

    const barChords: { beatInBar: number; chord: string }[] = [];
    barChords.push({ beatInBar: 0, chord: getChordAtBeat(barStart) });

    for (const pt of chordPoints) {
      if (pt.beat > barStart + 0.05 && pt.beat < barEnd - 0.05) {
        const beatInBar = pt.beat - barStart;
        if (barChords[barChords.length - 1].chord !== pt.chord) {
          barChords.push({ beatInBar, chord: pt.chord });
        }
      }
    }

    const tokens: string[] = [];
    for (let i = 0; i < barChords.length; i++) {
      const cur = barChords[i];
      const nextBeat = (i + 1 < barChords.length) ? barChords[i + 1].beatInBar : beatsPerMeasure;
      const durBeats = Math.max(0.25, nextBeat - cur.beatInBar);
      const abcDur = beatsToAbcDuration(durBeats, unitDen);
      tokens.push(`"${cur.chord}"z${abcDur}`);
    }
    measures.push(tokens.join(''));
  }

  return measures;
}

/**
 * Converts a sequence of timed musical events into bar-separated measure strings.
 */
function buildMeasures(events: TimedEvent[], beatsPerMeasure: number, unitDen: number): string[] {
  if (events.length === 0) {
    return ['Z'];
  }

  const measures: string[] = [];
  let currentMeasureTokens: string[] = [];
  let currentMeasureBeats = 0;
  let allRestsInBar = true;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const abcPitch = pitchToAbc(ev.pitch, ev.isRest);
    const chordPrefix = ev.chord ? `"${ev.chord}"` : '';
    if (!ev.isRest || ev.chord) {
      allRestsInBar = false;
    }

    let remainingDuration = ev.durationBeats;

    while (remainingDuration > 1e-4) {
      const spaceInMeasure = beatsPerMeasure - currentMeasureBeats;
      const durationInCurrentBar = Math.min(remainingDuration, spaceInMeasure);
      const abcDur = beatsToAbcDuration(durationInCurrentBar, unitDen);

      // Add tie '-' if note splits across barline
      const isSplit = remainingDuration > durationInCurrentBar + 1e-4;
      const tie = (isSplit && !ev.isRest) ? '-' : '';

      currentMeasureTokens.push(`${chordPrefix}${abcPitch}${abcDur}${tie}`);
      currentMeasureBeats += durationInCurrentBar;
      remainingDuration -= durationInCurrentBar;

      if (Math.abs(currentMeasureBeats - beatsPerMeasure) < 1e-4 || currentMeasureBeats > beatsPerMeasure - 1e-4) {
        if (allRestsInBar && currentMeasureTokens.every(t => t.startsWith('z') && !t.includes('"'))) {
          measures.push('Z');
        } else {
          measures.push(currentMeasureTokens.join(''));
        }
        currentMeasureTokens = [];
        currentMeasureBeats = 0;
        allRestsInBar = true;
      }
    }
  }

  // Handle remaining partial measure
  if (currentMeasureTokens.length > 0) {
    const remaining = beatsPerMeasure - currentMeasureBeats;
    if (remaining > 1e-4) {
      const restDur = beatsToAbcDuration(remaining, unitDen);
      currentMeasureTokens.push(`z${restDur}`);
    }
    if (allRestsInBar && currentMeasureTokens.every(t => t.startsWith('z') && !t.includes('"'))) {
      measures.push('Z');
    } else {
      measures.push(currentMeasureTokens.join(''));
    }
  }

  return measures;
}
