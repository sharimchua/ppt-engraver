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
import type { Tapestry, Knot, KnotSummary, Engraving } from '../schema/tapestry.js';

export interface KnotResolutionResult {
  knot: ResolvedKnot;
  availableKnots: KnotSummary[];
  selectedKnotId: string;
  warnings: string[];
}

interface RawKnotEntry {
  id: string;
  knot: Knot;
}

/**
 * Extracts and orders all declared knots from a Tapestry.
 */
function collectDeclaredKnots(tapestry: Tapestry): {
  orderedEntries: RawKnotEntry[];
  knotLibrary: Map<string, Knot>;
} {
  const orderedEntries: RawKnotEntry[] = [];
  const knotLibrary = new Map<string, Knot>();

  const rawKnots = tapestry.tapestry.knots;
  const singleKnot = tapestry.tapestry.knot;

  // 1. Process knots array or dictionary if present
  if (rawKnots) {
    if (Array.isArray(rawKnots)) {
      rawKnots.forEach((k, index) => {
        const id = k.id || k.name || k.label || `knot_${index + 1}`;
        const knotWithId: Knot = { ...k, id };
        orderedEntries.push({ id, knot: knotWithId });
        knotLibrary.set(id, knotWithId);
      });
    } else if (typeof rawKnots === 'object' && rawKnots !== null) {
      for (const [key, k] of Object.entries(rawKnots)) {
        const id = k.id || key;
        const knotWithId: Knot = { ...k, id };
        orderedEntries.push({ id, knot: knotWithId });
        knotLibrary.set(id, knotWithId);
      }
    }
  }

  // 2. Process single knot if present
  if (singleKnot) {
    const singleId = singleKnot.id || (orderedEntries.length === 0 ? 'default' : 'root');
    const knotWithId: Knot = { ...singleKnot, id: singleId };
    if (!knotLibrary.has(singleId)) {
      // If no other knots, make it the first; otherwise prepend it as default root
      orderedEntries.unshift({ id: singleId, knot: knotWithId });
      knotLibrary.set(singleId, knotWithId);
    }
  }

  return { orderedEntries, knotLibrary };
}

/**
 * Deeply merges parent Knot properties into child Knot with cycle detection.
 */
function inheritKnotProperties(
  rawKnot: Knot,
  library: Map<string, Knot>,
  warnings: string[],
  visited: Set<string> = new Set(),
): Knot {
  const knotId = rawKnot.id || 'anonymousKnot';
  const nextVisited = new Set(visited);
  if (rawKnot.id) nextVisited.add(rawKnot.id);

  // Normalize parents list from parent & parents fields
  const parentIds: string[] = [];
  if (rawKnot.parent) {
    parentIds.push(rawKnot.parent);
  }
  if (rawKnot.parents) {
    if (Array.isArray(rawKnot.parents)) {
      for (const p of rawKnot.parents) {
        if (!parentIds.includes(p)) parentIds.push(p);
      }
    } else if (typeof rawKnot.parents === 'string' && !parentIds.includes(rawKnot.parents)) {
      parentIds.push(rawKnot.parents);
    }
  }

  // Base merged result starting with empty/default attributes
  let merged: Knot = {};

  // Resolve and merge each parent in sequence (earlier parents provide fallback, later override)
  for (const parentId of parentIds) {
    if (visited.has(parentId)) {
      warnings.push(`Circular knot inheritance detected: "${knotId}" -> "${parentId}"`);
      continue;
    }

    const parentKnot = library.get(parentId);
    if (!parentKnot) {
      warnings.push(`Knot "${knotId}" references unknown parent knot "${parentId}"`);
      continue;
    }

    const resolvedParent = inheritKnotProperties(parentKnot, library, warnings, nextVisited);

    // Merge parent properties into accumulated merged knot
    merged = mergeKnotObjects(merged, resolvedParent);
  }

  // Finally merge the child's explicit properties on top of parents
  merged = mergeKnotObjects(merged, rawKnot);

  return merged;
}

/**
 * Checks if a knot is configured as abstract or hidden from user-facing projection selectors.
 */
export function isKnotHidden(knot: Knot): boolean {
  if (knot.abstract === true) return true;
  if (knot.hidden === true) return true;
  if (knot.visible === false) return true;
  return false;
}

/**
 * Helper to merge child knot properties on top of base/parent knot properties.
 */
function mergeKnotObjects(base: Knot, child: Knot): Knot {
  const result: Knot = { ...base, ...child };

  // Visibility / abstract flags MUST NOT be inherited from parent knots.
  // Child knots are visible/concrete by default unless explicitly marked abstract/hidden on the child.
  result.abstract = child.abstract;
  result.hidden = child.hidden;
  result.visible = child.visible;

  // Explicitly deep-merge engraving objects if either exists
  if (base.engraving || child.engraving) {
    const baseEng: Engraving = base.engraving || {};
    const childEng: Engraving = child.engraving || {};

    // If child specifies a new projection preset without its own show array, do not carry over base show array
    const baseProjection = child.projection ?? childEng.projection;
    const childHasNewProjection = baseProjection !== undefined &&
      baseProjection !== (base.projection ?? baseEng.projection);

    const show = childEng.show !== undefined
      ? childEng.show
      : (childHasNewProjection ? undefined : baseEng.show);

    result.engraving = {
      ...baseEng,
      ...childEng,
      show,
    };
  }

  return result;
}

/**
 * Resolves the Knot (absolute anchor & engraving settings) from a Tapestry.
 * 
 * @param tapestry - The validated Tapestry IR
 * @param selectedKnotId - Optional ID of the knot to resolve (defaults to the first declared non-abstract knot)
 * @returns Resolved knot with MIDI note for Do, accidentalMode, available knots list, plus any warnings
 */
export function resolveKnot(tapestry: Tapestry, selectedKnotId?: string): KnotResolutionResult {
  const warnings: string[] = [];
  const { orderedEntries, knotLibrary } = collectDeclaredKnots(tapestry);

  // If no knots were defined anywhere in the tapestry, fall back to global default
  if (orderedEntries.length === 0) {
    warnings.push(
      `No Knot defined — falling back to default: Do = ${DEFAULT_DO}, tempo = ${DEFAULT_TEMPO}`
    );
    const defaultKnot: ResolvedKnot = {
      id: 'default',
      name: 'Default',
      doMidi: pitchNameToMidi(DEFAULT_DO),
      tonicMidi: pitchNameToMidi(DEFAULT_DO),
      tempo: DEFAULT_TEMPO,
      doName: DEFAULT_DO,
      tonicName: DEFAULT_DO,
      accidentalMode: 'sharps',
    };
    return {
      knot: defaultKnot,
      availableKnots: [{ id: 'default', name: 'Default' }],
      selectedKnotId: 'default',
      warnings,
    };
  }

  // Build available knots summary list in declaration order (filtering out abstract/hidden knots)
  const visibleEntries = orderedEntries.filter(entry => !isKnotHidden(entry.knot));
  const candidateEntries = visibleEntries.length > 0 ? visibleEntries : orderedEntries;

  const availableKnots: KnotSummary[] = candidateEntries.map(entry => {
    const k = entry.knot;
    const title = k.title ?? k.engraving?.title;
    const name = k.name ?? k.label ?? title ?? entry.id;
    return {
      id: entry.id,
      name,
      title,
      abstract: k.abstract,
    };
  });

  // Determine active target knot ID (defaults to the first declared visible / non-abstract knot)
  const defaultEntry = orderedEntries.find(e => !isKnotHidden(e.knot)) || orderedEntries[0];
  let activeId = defaultEntry.id;
  if (selectedKnotId) {
    const matched = orderedEntries.find(
      e => e.id.toLowerCase() === selectedKnotId.toLowerCase()
    );
    if (matched) {
      activeId = matched.id;
    } else {
      warnings.push(
        `Selected knot "${selectedKnotId}" not found — falling back to default "${activeId}"`
      );
    }
  }

  // Resolve inheritance chain for the selected knot
  const rawActiveKnot = knotLibrary.get(activeId) || orderedEntries[0].knot;
  const knotDef = inheritKnotProperties(rawActiveKnot, knotLibrary, warnings);

  const tonicPitch = knotDef.tonic ?? knotDef.do ?? DEFAULT_DO;
  if (!knotDef.tonic && !knotDef.do) {
    warnings.push(`No tonic/do defined in Knot "${activeId}" — falling back to default: ${DEFAULT_DO}`);
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
  let showPulseCoil =
    eng.showPulseCoil ??
    eng.showMetricCoil ??
    knotDef.showPulseCoil ??
    knotDef.showMetricCoil;
  let showHarmonyCoil = eng.showHarmonyCoil ?? knotDef.showHarmonyCoil;
  let showTraditionalHarmony = eng.showTraditionalHarmony ?? knotDef.showTraditionalHarmony;
  
  const guitarTabObj = typeof eng.guitarTab === 'object' && eng.guitarTab !== null
    ? eng.guitarTab
    : (typeof knotDef.guitarTab === 'object' && knotDef.guitarTab !== null ? knotDef.guitarTab : {});

  let showGuitarTab = (typeof eng.guitarTab === 'boolean' ? eng.guitarTab : (typeof eng.guitarTab === 'object' ? eng.guitarTab?.show : undefined))
    ?? eng.showGuitarTab
    ?? (typeof knotDef.guitarTab === 'boolean' ? knotDef.guitarTab : (typeof knotDef.guitarTab === 'object' ? knotDef.guitarTab?.show : undefined))
    ?? knotDef.showGuitarTab;

  let showRhythmGrid = eng.showRhythmGrid ?? knotDef.showRhythmGrid;
  let showChordNames: boolean | undefined = undefined;

  let showPulseSignature = eng.showPulseSignature ?? knotDef.showPulseSignature;
  let pulseSignature = eng.pulseSignature ?? knotDef.pulseSignature;
  let showTimeSignature = eng.showTimeSignature ?? knotDef.showTimeSignature;
  let timeSignature = eng.timeSignature ?? knotDef.timeSignature;
  let gridSymbols = eng.gridSymbols ?? knotDef.gridSymbols;

  if (eng.show && Array.isArray(eng.show)) {
    showMelody = eng.show.includes('melody');
    showMelodyCoilInterval = eng.show.includes('melodyCoilInterval');
    showMelodyCoilAbsolute = eng.show.includes('melodyCoilAbsolute');
    showRhythmCoil = eng.show.includes('rhythmCoil');
    showPulseCoil = eng.show.includes('pulseCoil');
    showHarmonyCoil = eng.show.includes('harmonyCoil');
    showTraditionalHarmony =
      eng.show.includes('harmony') ||
      eng.show.includes('traditionalHarmony') ||
      eng.show.includes('harmonyStaff');
    if (eng.show.includes('guitarTab')) {
      showGuitarTab = true;
    }
    showRhythmGrid = eng.show.includes('rhythmGrid');
    showChordNames = eng.show.includes('chordNames');
    if (eng.show.includes('gridSymbols') && gridSymbols === undefined) {
      gridSymbols = true;
    }
    if (eng.show.includes('timeSignature') && showTimeSignature === undefined) {
      showTimeSignature = true;
    }
    if (eng.show.includes('pulseSignature') && showPulseSignature === undefined) {
      showPulseSignature = true;
    }
  }

  const title = eng.title ?? knotDef.title;
  const subtitle = eng.subtitle ?? knotDef.subtitle;
  const composer = eng.composer ?? knotDef.composer ?? (knotDef as any).artist ?? (knotDef as any).author;
  const arranger = eng.arranger ?? knotDef.arranger;
  const poet = eng.poet ?? knotDef.poet ?? (knotDef as any).lyricist;
  const copyright = eng.copyright ?? knotDef.copyright;
  const tagline = eng.tagline ?? knotDef.tagline;

  const melodyClef = eng.melodyClef ?? knotDef.melodyClef;
  const harmonyClef = eng.harmonyClef ?? knotDef.harmonyClef;
  const harmonyOctave = eng.harmonyOctave ?? knotDef.harmonyOctave;
  const noteheadStyle = eng.noteheadStyle ?? knotDef.noteheadStyle;
  let harmonyChangesOnly = eng.harmonyChangesOnly ?? knotDef.harmonyChangesOnly;
  const omitStem = eng.omitStem ?? knotDef.omitStem;
  const traditionalRhythms =
    eng.traditionalRhythms ??
    eng.traditionalDurations ??
    knotDef.traditionalRhythms ??
    knotDef.traditionalDurations ??
    false;
  const colorNotes = eng.colorNotes ?? knotDef.colorNotes;
  const noteheadOutline = eng.noteheadOutline ?? knotDef.noteheadOutline;
  const harmonyStaffStyle = eng.harmonyStaffStyle ?? knotDef.harmonyStaffStyle;
  const guitarTabMovement = guitarTabObj.movement ?? eng.guitarTabMovement ?? knotDef.guitarTabMovement ?? 'vertical';
  const guitarTabScope =
    guitarTabObj.scope ??
    guitarTabObj.phraseScope ??
    (guitarTabObj.crossCoil === true ? 'continuous' : (guitarTabObj.crossCoil === false ? 'coil' : undefined)) ??
    eng.guitarTabScope ??
    eng.guitarTabPhraseScope ??
    (eng.crossCoilGuitarTab === true ? 'continuous' : (eng.crossCoilGuitarTab === false ? 'coil' : undefined)) ??
    knotDef.guitarTabScope ??
    knotDef.guitarTabPhraseScope ??
    (knotDef.crossCoilGuitarTab === true ? 'continuous' : (knotDef.crossCoilGuitarTab === false ? 'coil' : undefined)) ??
    'coil';
  const guitarVoicing = guitarTabObj.voicing ?? eng.guitarVoicing ?? knotDef.guitarVoicing;
  const maximumFretSpan =
    guitarTabObj.fretSpan ??
    guitarTabObj.maxFretSpan ??
    eng.maximumFretSpan ??
    eng.maxFretSpan ??
    knotDef.maximumFretSpan ??
    knotDef.maxFretSpan;
  const maxFretSpan = maximumFretSpan;
  const guitarTuning = guitarTabObj.tuning ?? eng.guitarTuning ?? knotDef.guitarTuning;
  const tabStaffStyle = guitarTabObj.style ?? eng.tabStaffStyle ?? knotDef.tabStaffStyle;
  const zoom = eng.zoom ?? knotDef.zoom;
  const indent = eng.indent ?? knotDef.indent;
  const chordChanges = eng.chordChanges ?? knotDef.chordChanges;
  const projection = eng.projection ?? knotDef.projection;
  let harmonyVoicing = eng.harmonyVoicing ?? knotDef.harmonyVoicing;
  let melodyAugmentation = eng.melodyAugmentation ?? knotDef.melodyAugmentation;
  let melodyAugmentationDisplay = eng.melodyAugmentationDisplay ?? knotDef.melodyAugmentationDisplay;
  const pulse = eng.pulse ?? knotDef.pulse ?? eng.meter ?? knotDef.meter;
  const meter = pulse;
  const excludeGridDoSymbol =
    eng.excludeGridDoSymbol ??
    eng.gridSymbolExcludeDo ??
    knotDef.excludeGridDoSymbol ??
    knotDef.gridSymbolExcludeDo;
  const strongBeatGridWeight =
    eng.strongBeatGridWeight ??
    eng.gridBeatWeights ??
    knotDef.strongBeatGridWeight ??
    knotDef.gridBeatWeights;

  // Apply Projection Presets defaults if not explicitly configured
  if (projection === 'chordMelody') {
    if (!melodyAugmentation) melodyAugmentation = 'drop2';
    if (showTraditionalHarmony === undefined) showTraditionalHarmony = false;
  } else if (projection === 'leadSheet') {
    if (!melodyAugmentation) melodyAugmentation = 'none';
    if (showChordNames === undefined) showChordNames = true;
    if (showHarmonyCoil === undefined) showHarmonyCoil = true;
    if (showTraditionalHarmony === undefined) showTraditionalHarmony = false;
  } else if (projection === 'jazzComping') {
    if (!harmonyVoicing) harmonyVoicing = 'rootless';
    if (harmonyChangesOnly === undefined) harmonyChangesOnly = true;
  } else if (projection === 'acousticFolk') {
    if (!harmonyVoicing) harmonyVoicing = 'rootFifth';
    if (!melodyAugmentation) melodyAugmentation = 'thirdsBelow';
  } else if (projection === 'bassAndLead') {
    if (!harmonyVoicing) harmonyVoicing = 'walkingBass';
    if (!melodyAugmentation) melodyAugmentation = 'none';
  }

  // Default display for inferred notes is 'ghosted' (dimmed)
  if (!melodyAugmentationDisplay) {
    melodyAugmentationDisplay = 'ghosted';
  }

  const knotSummary = availableKnots.find(k => k.id === activeId);

  return {
    knot: {
      id: activeId,
      name: knotSummary?.name || activeId,
      abstract: knotDef.abstract,
      hidden: knotDef.hidden,
      visible: knotDef.visible,
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
      harmonyVoicing,
      guitarTabMovement,
      guitarTabScope,
      guitarVoicing,
      maximumFretSpan,
      maxFretSpan,
      guitarTuning,
      tabStaffStyle,
      melodyAugmentation,
      melodyAugmentationDisplay,
      projection,
      omitStem,
      traditionalRhythms,
      colorNotes,
      noteheadOutline,
      harmonyStaffStyle,
      showHarmonyCoil,
      showTraditionalHarmony,
      showGuitarTab,
      showMelody,
      showMelodyCoilAbsolute,
      showMelodyCoilInterval,
      showRhythmCoil,
      showPulseCoil,
      showTimeSignature,
      timeSignature,
      showPulseSignature,
      pulseSignature,
      pulse,
      meter,
      gridSymbols,
      excludeGridDoSymbol,
      strongBeatGridWeight,
      showChordNames,
      zoom,
      indent,
      showRhythmGrid,
      chordChanges,
    },
    availableKnots,
    selectedKnotId: activeId,
    warnings,
  };
}







