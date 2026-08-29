/**
 * High-level compiler orchestration module.
 * 
 * Takes Tapestry source (.ppt.yaml) and produces:
 * 1. piece.notation.ly (engraved LilyPond score)
 * 2. piece.ppt-map.json (sidecar expectation map for consistency checking)
 * 3. (Optional) rendered PDF/PNG via local lilypond binary if requested and available
 */
import { writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveFile, resolveYaml } from '../resolver/resolve.js';
import { compileToLilyPond, type CompileOptions } from '../lilypond/compiler.js';
import { generateSidecarMap, type SidecarMap } from '../sidecar/map.js';
import type { OnsetStream } from '../schema/onset.js';
import type { KnotSummary } from '../schema/tapestry.js';
import type { ResolvedKnot } from '../solfege/pitch.js';

export interface CompileResult {
  /** The emitted LilyPond notation string (.ly) */
  lilypondSource: string;
  /** The companion sidecar expectation map */
  sidecarMap: SidecarMap;
  /** The underlying resolved onset stream */
  onsets: OnsetStream;
  /** Any non-fatal warnings generated during resolution */
  warnings: string[];
  /** List of all available knots in the score */
  availableKnots?: KnotSummary[];
  /** The active resolved knot ID */
  selectedKnotId?: string;
  /** The resolved knot metadata and pitch anchor */
  knot?: ResolvedKnot;
}

export interface CompileFileOptions extends CompileOptions {
  /** Output path for the .ly file (defaults to <base>.notation.ly) */
  outLyPath?: string;
  /** Output path for the .ppt-map.json file (defaults to <base>.ppt-map.json) */
  outMapPath?: string;
  /** Attempt to render PDF using local lilypond binary */
  renderPdf?: boolean;
  /** ID of the knot to resolve and compile */
  knotId?: string;
}

/**
 * Compiles a `.ppt.yaml` file into LilyPond notation and sidecar map.
 * 
 * @param yamlFilePath - Path to source .ppt.yaml file
 * @param options - Compilation options
 * @returns Compilation result containing .ly code, sidecar map, and onsets
 */
export function compileFile(
  yamlFilePath: string,
  options: CompileFileOptions = {},
): CompileResult {
  const { onsets, warnings, knot, availableKnots, selectedKnotId } = resolveFile(yamlFilePath, options.knotId);
  const effectiveOptions: CompileFileOptions = {
    title: knot?.title,
    subtitle: knot?.subtitle,
    composer: knot?.composer,
    arranger: knot?.arranger,
    poet: knot?.poet,
    copyright: knot?.copyright,
    tagline: knot?.tagline,
    melodyClef: knot?.melodyClef,
    harmonyClef: knot?.harmonyClef,
    noteheadStyle: knot?.noteheadStyle,
    harmonyChangesOnly: knot?.harmonyChangesOnly,
    omitStem: knot?.omitStem,
    traditionalRhythms: knot?.traditionalRhythms,
    colorNotes: knot?.colorNotes,
    noteheadOutline: knot?.noteheadOutline,
    harmonyStaffStyle: knot?.harmonyStaffStyle,
    showHarmonyCoil: knot?.showHarmonyCoil,
    showTraditionalHarmony: knot?.showTraditionalHarmony,
    showGuitarTab: knot?.showGuitarTab,
    guitarVoicing: knot?.guitarVoicing,
    maximumFretSpan: knot?.maximumFretSpan,
    maxFretSpan: knot?.maxFretSpan,
    guitarTuning: knot?.guitarTuning,
    tabStaffStyle: knot?.tabStaffStyle,
    showMelody: knot?.showMelody,
    showMelodyCoilAbsolute: knot?.showMelodyCoilAbsolute,
    showMelodyCoilInterval: knot?.showMelodyCoilInterval,
    showRhythmCoil: knot?.showRhythmCoil,
    showPulseCoil: knot?.showPulseCoil,
    showTimeSignature: knot?.showTimeSignature,
    timeSignature: knot?.timeSignature,
    showPulseSignature: knot?.showPulseSignature,
    showScaleSignature: knot?.showScaleSignature,
    showScaleSignaturePianoTriangle: knot?.showScaleSignaturePianoTriangle,
    scaleSignature: knot?.scaleSignature,
    scaleSignaturePianoTriangle: knot?.scaleSignaturePianoTriangle,
    showKeySignature: knot?.showKeySignature,
    keySignature: knot?.keySignature,
    scale: knot?.scale,
    pulseSignature: knot?.pulseSignature,
    pulse: knot?.pulse ?? knot?.meter,
    meter: knot?.pulse ?? knot?.meter,
    gridSymbols: knot?.gridSymbols,
    excludeGridDoSymbol: knot?.excludeGridDoSymbol,
    strongBeatGridWeight: knot?.strongBeatGridWeight,
    showChordNames: knot?.showChordNames,
    showChordTriangles: knot?.showChordTriangles,
    harmonyOctave: knot?.harmonyOctave,
    zoom: knot?.zoom,
    indent: knot?.indent,
    showRhythmGrid: knot?.showRhythmGrid,
    chordChanges: knot?.chordChanges,
    keyAnchorStyle: knot?.keyAnchorStyle,
    harmonyVoicing: knot?.harmonyVoicing,
    melodyAugmentation: knot?.melodyAugmentation,
    melodyAugmentationDisplay: knot?.melodyAugmentationDisplay,
    projection: knot?.projection,
    doPitch: knot?.doName,
    accidentalMode: knot?.accidentalMode,
    ...options,
  };
  const lilypondSource = compileToLilyPond(onsets, effectiveOptions);
  const sidecarMap = generateSidecarMap(onsets);

  // Determine output file paths if saving
  const baseName = yamlFilePath.replace(/(\.ppt)?\.ya?ml$/, '');
  const outLy = options.outLyPath ?? `${baseName}.notation.ly`;
  const outMap = options.outMapPath ?? `${baseName}.ppt-map.json`;

  writeFileSync(outLy, lilypondSource, 'utf-8');
  writeFileSync(outMap, JSON.stringify(sidecarMap, null, 2) + '\n', 'utf-8');

  // Optional PDF rendering via lilypond binary
  if (options.renderPdf) {
    try {
      const proc = spawnSync('lilypond', ['--pdf', '-o', baseName, outLy], {
        stdio: 'inherit',
      });
      if (proc.error) {
        warnings.push(`LilyPond rendering skipped: ${(proc.error as Error).message}`);
      }
    } catch (err) {
      warnings.push(`LilyPond rendering failed: ${(err as Error).message}`);
    }
  }

  return {
    lilypondSource,
    sidecarMap,
    onsets,
    warnings,
    availableKnots,
    selectedKnotId,
    knot,
  };
}

/**
 * Compiles raw Tapestry YAML string into LilyPond notation and sidecar map.
 * 
 * @param yamlContent - Raw YAML string
 * @param options - Compilation options
 * @returns Compilation result (in-memory, no file I/O)
 */
export function compileYamlString(
  yamlContent: string,
  options: CompileOptions = {},
): CompileResult {
  const { onsets, warnings, knot, availableKnots, selectedKnotId } = resolveYaml(yamlContent, options.knotId);
  const effectiveOptions: CompileOptions = {
    title: knot?.title,
    subtitle: knot?.subtitle,
    composer: knot?.composer,
    arranger: knot?.arranger,
    poet: knot?.poet,
    copyright: knot?.copyright,
    tagline: knot?.tagline,
    melodyClef: knot?.melodyClef,
    harmonyClef: knot?.harmonyClef,
    noteheadStyle: knot?.noteheadStyle,
    harmonyChangesOnly: knot?.harmonyChangesOnly,
    omitStem: knot?.omitStem,
    traditionalRhythms: knot?.traditionalRhythms,
    colorNotes: knot?.colorNotes,
    noteheadOutline: knot?.noteheadOutline,
    harmonyStaffStyle: knot?.harmonyStaffStyle,
    showHarmonyCoil: knot?.showHarmonyCoil,
    showTraditionalHarmony: knot?.showTraditionalHarmony,
    showGuitarTab: knot?.showGuitarTab,
    guitarTabMovement: knot?.guitarTabMovement,
    guitarTabScope: knot?.guitarTabScope,
    guitarVoicing: knot?.guitarVoicing,
    maximumFretSpan: knot?.maximumFretSpan,
    maxFretSpan: knot?.maxFretSpan,
    guitarTuning: knot?.guitarTuning,
    tabStaffStyle: knot?.tabStaffStyle,
    showMelody: knot?.showMelody,
    showMelodyCoilAbsolute: knot?.showMelodyCoilAbsolute,
    showMelodyCoilInterval: knot?.showMelodyCoilInterval,
    showRhythmCoil: knot?.showRhythmCoil,
    showPulseCoil: knot?.showPulseCoil,
    showTimeSignature: knot?.showTimeSignature,
    timeSignature: knot?.timeSignature,
    showPulseSignature: knot?.showPulseSignature,
    showScaleSignature: knot?.showScaleSignature,
    showScaleSignaturePianoTriangle: knot?.showScaleSignaturePianoTriangle,
    scaleSignature: knot?.scaleSignature,
    scaleSignaturePianoTriangle: knot?.scaleSignaturePianoTriangle,
    showKeySignature: knot?.showKeySignature,
    keySignature: knot?.keySignature,
    scale: knot?.scale,
    pulseSignature: knot?.pulseSignature,
    pulse: knot?.pulse ?? knot?.meter,
    meter: knot?.pulse ?? knot?.meter,
    gridSymbols: knot?.gridSymbols,
    excludeGridDoSymbol: knot?.excludeGridDoSymbol,
    strongBeatGridWeight: knot?.strongBeatGridWeight,
    showChordNames: knot?.showChordNames,
    showChordTriangles: knot?.showChordTriangles,
    harmonyOctave: knot?.harmonyOctave,
    zoom: knot?.zoom,
    indent: knot?.indent,
    showRhythmGrid: knot?.showRhythmGrid,
    chordChanges: knot?.chordChanges,
    keyAnchorStyle: knot?.keyAnchorStyle,
    harmonyVoicing: knot?.harmonyVoicing,
    melodyAugmentation: knot?.melodyAugmentation,
    melodyAugmentationDisplay: knot?.melodyAugmentationDisplay,
    projection: knot?.projection,
    doPitch: knot?.doName,
    accidentalMode: knot?.accidentalMode,
    ...options,
  };
  const lilypondSource = compileToLilyPond(onsets, effectiveOptions);

  const sidecarMap = generateSidecarMap(onsets);

  return {
    lilypondSource,
    sidecarMap,
    onsets,
    warnings,
    availableKnots,
    selectedKnotId,
    knot,
  };
}



