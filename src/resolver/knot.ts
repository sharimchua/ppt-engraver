/**
 * Knot resolver: resolves the absolute pitch anchor for the Tapestry.
 * 
 * If a Knot is present, uses its `do` pitch as the anchor.
 * If no Knot exists anywhere, falls back to C4 with a warning (per §5.2).
 */
import { DEFAULT_DO, DEFAULT_TEMPO } from '../constants.js';
import {
  pitchNameToMidi,
  getAccidentalModeFromPitchName,
  type ResolvedKnot,
} from '../solfege/pitch.js';
import type { Tapestry } from '../schema/tapestry.js';

export interface KnotResolutionResult {
  knot: ResolvedKnot;
  warnings: string[];
}

/**
 * Resolves the Knot (absolute anchor) from a Tapestry.
 * 
 * @param tapestry - The validated Tapestry IR
 * @returns Resolved knot with MIDI note for Do, accidentalMode, plus any warnings
 */
export function resolveKnot(tapestry: Tapestry): KnotResolutionResult {
  const warnings: string[] = [];
  const knotDef = tapestry.tapestry.knot;
  
  if (!knotDef) {
    warnings.push(
      `No Knot defined — falling back to default: Do = ${DEFAULT_DO}, tempo = ${DEFAULT_TEMPO}`
    );
    return {
      knot: {
        doMidi: pitchNameToMidi(DEFAULT_DO),
        tonicMidi: pitchNameToMidi(DEFAULT_DO),
        tempo: DEFAULT_TEMPO,
        doName: DEFAULT_DO,
        tonicName: DEFAULT_DO,
        accidentalMode: 'sharps',
      },
      warnings,
    };
  }

  const tonicPitch = knotDef.tonic ?? knotDef.do ?? DEFAULT_DO;
  if (!knotDef.tonic && !knotDef.do) {
    warnings.push(`No tonic/do defined in Knot — falling back to default: ${DEFAULT_DO}`);
  }

  const doMidi = pitchNameToMidi(tonicPitch);
  const tempo = knotDef.tempo ?? DEFAULT_TEMPO;
  const accidentalMode = getAccidentalModeFromPitchName(tonicPitch);

  const eng = knotDef.engraving ?? {};

  // Resolve show flags from engraving.show array if provided
  let showMelody = eng.showMelody ?? knotDef.showMelody;
  let showMelodyCoilInterval = eng.showMelodyCoilInterval ?? knotDef.showMelodyCoilInterval;
  let showMelodyCoilAbsolute = eng.showMelodyCoilAbsolute ?? knotDef.showMelodyCoilAbsolute;
  let showRhythmCoil = eng.showRhythmCoil ?? knotDef.showRhythmCoil;
  let showHarmonyCoil = eng.showHarmonyCoil ?? knotDef.showHarmonyCoil;
  let showTraditionalHarmony = eng.showTraditionalHarmony ?? knotDef.showTraditionalHarmony;
  let showRhythmGrid = eng.showRhythmGrid ?? knotDef.showRhythmGrid;
  let showChordNames: boolean | undefined = undefined;

  if (eng.show && Array.isArray(eng.show)) {
    showMelody = eng.show.includes('melody');
    showMelodyCoilInterval = eng.show.includes('melodyCoilInterval');
    showMelodyCoilAbsolute = eng.show.includes('melodyCoilAbsolute');
    showRhythmCoil = eng.show.includes('rhythmCoil');
    showHarmonyCoil = eng.show.includes('harmonyCoil');
    showTraditionalHarmony = eng.show.includes('harmony') || eng.show.includes('traditionalHarmony');
    showRhythmGrid = eng.show.includes('rhythmGrid');
    showChordNames = eng.show.includes('chordNames');
  }

  const title = eng.title ?? knotDef.title;
  const subtitle = eng.subtitle ?? knotDef.subtitle;
  const composer = eng.composer ?? knotDef.composer ?? eng.artist ?? knotDef.artist ?? eng.author ?? knotDef.author;
  const arranger = eng.arranger ?? knotDef.arranger;
  const poet = eng.poet ?? knotDef.poet ?? eng.lyricist ?? knotDef.lyricist;
  const copyright = eng.copyright ?? knotDef.copyright;
  const tagline = eng.tagline ?? knotDef.tagline;

  const melodyClef = eng.melodyClef ?? knotDef.melodyClef;
  const harmonyClef = eng.harmonyClef ?? knotDef.harmonyClef;
  const harmonyOctave = eng.harmonyOctave ?? knotDef.harmonyOctave;
  const noteheadStyle = eng.noteheadStyle ?? knotDef.noteheadStyle;
  const harmonyChangesOnly = eng.harmonyChangesOnly ?? knotDef.harmonyChangesOnly;
  const omitStem = eng.omitStem ?? knotDef.omitStem;
  const colorNotes = eng.colorNotes ?? knotDef.colorNotes;
  const noteheadOutline = eng.noteheadOutline ?? knotDef.noteheadOutline;
  const harmonyStaffStyle = eng.harmonyStaffStyle ?? knotDef.harmonyStaffStyle;
  const zoom = eng.zoom ?? knotDef.zoom;
  const indent = eng.indent ?? knotDef.indent;
  const chordChanges = eng.chordChanges ?? knotDef.chordChanges;

  return {
    knot: {
      doMidi,
      tonicMidi: doMidi,
      tempo,
      doName: tonicPitch,
      tonicName: tonicPitch,
      rootWeaveId: knotDef.weave,
      title,
      subtitle,
      composer,
      arranger,
      poet,
      copyright,
      tagline,
      melodyClef,
      harmonyClef,
      harmonyOctave,
      accidentalMode,
      noteheadStyle,
      harmonyChangesOnly,
      omitStem,
      colorNotes,
      noteheadOutline,
      harmonyStaffStyle,
      showHarmonyCoil,
      showTraditionalHarmony,
      showMelody,
      showMelodyCoilAbsolute,
      showMelodyCoilInterval,
      showRhythmCoil,
      showChordNames,
      zoom,
      indent,
      showRhythmGrid,
      chordChanges,
    },
    warnings,
  };
}







