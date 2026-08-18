# LilyPond Code Generation & Scheme Stencils (`src/lilypond/`)

## Purpose & Scope

The `src/lilypond/` directory generates valid, beautiful, standalone LilyPond markup (`.ly`) from resolved PPT score onsets. It includes custom Scheme functions and PostScript path stencils to engrave PPT geometric noteheads, solfège lyric lines, rhythm grids, and harmony blocks.

---

## LilyPond Score Structure

Generated `.ly` documents contain:
1. **Scheme Header & Path Definitions**:
   - `pptPathBase`, `pptPathSharp`, `pptPathFlat` defining the vector bezier curves.
   - `make-solfege-glyph` / `make-path-stencil` computing scale, rotation, color, and optional axis stroke.
2. **Engraving Visibility Config**:
   - `\layout` and `\paper` blocks configured for Frescobaldi and PPT Studio rendering.
3. **Voice Lines**:
   - `\melodyVoice`: Standard notation staff with custom notehead stencils (`<< \new Voice = "v1" \\ \new Voice = "v2" >>` when polyphonic).
   - `\melodyCoilAbsolute`: Row band displaying absolute Solfège pitch classes (emits `M1`, `M2`, etc. clefs when polyphonic, or `M` when single-voice).
   - `\melodyCoilInterval`: Lyric line rendering interval tokens with `M` / `M1` clef.
   - `\rhythmCoil`: Unified collapsed rhythm row band with `R` clef, merging all active subdivisions across melody voices and harmony into a single chronological rhythmic spine.
   - `\harmonyCoil`: Row band with `H` clef displaying Solfège chord glyphs and alterations.
   - `\harmonyVoice`: Traditional 5-line harmony chord staff (e.g. Bass clef).
   - `\rhythmGrid`: Subdivision tick marks and beat pulse indicators.

---

## Point-and-Click Source Tagging

- Every musical onset in LilyPond is tagged with an explicit layer-encoded identifier:
  - Single Voice: `\tag #'ppt_${weaveId}_${coilId}_${layer}_${onsetIndex}`
  - Polyphonic Voice: `\tag #'ppt_${weaveId}_${coilId}_${layer}_v${voiceIndex}_${onsetIndex}`
  - Melody staff: `melody` (e.g. `ppt_verse_introMotif_melody_1` or `ppt_verse_poly_melody_v2_1`)
  - Melody Absolute coil: `melodyAbs` (e.g. `ppt_verse_introMotif_melodyAbs_1`)
  - Melody Interval coil: `melodyInt` (e.g. `ppt_verse_introMotif_melodyInt_1`)
  - Rhythm coil: `rhythm` (e.g. `ppt_verse_introMotif_rhythm_1`)
  - Harmony coil: `harmony` (e.g. `ppt_verse_introMotif_harmony_1`)
  - Harmony staff: `harmonyStaff` (e.g. `ppt_verse_introMotif_harmonyStaff_1`)
  - Chord names: `chordName` (e.g. `ppt_verse_introMotif_chordName_1`)
- Polyphony compiles into `\new Voice = "v1" { \voiceOne ... }` and `\new Voice = "v2" { \voiceTwo ... }` inside the top staff.
- This enables PPT Studio point-and-click navigation to route clicks unambiguously to the exact layer line (`melody:`, `rhythm:`, or `harmony:`) and voice, tracing concatenated / inherited sub-coils back to their definition in YAML.

---

## Rules for LilyPond Generation

- **Zero Missing Glyphs**: Every valid Solfège pitch must map to one of the 3 path stencils with correct rotation and color.
- **Strict Syntax Safety**: Ensure all scheme expressions (`#(...)`) are properly balanced and escaped.
- **Preserve Tags**: Never omit `\tag #'ppt_...` on notes or rests, as Point-and-Click navigation relies on them.
- **Rhythmic Beaming in Cadenza Mode**: Because `\cadenzaOn` suppresses LilyPond's automatic beam engraver, sub-quarter notes (< 1.0 beat) within each integer beat window are beamed deterministically using manual beam brackets (`[` and `]`), respecting voice, rest, and coil barline boundaries.
- **Traditional Rhythms Mode (`traditionalRhythms: true`)**: Formats periods with standard traditional duration tokens (dotted notes `2.`, `4.`, `8.`, `1.`, half notes `2`, whole notes `1`), visible rests (`r4`, `r2`, `r8`, etc.), and omits `\override NoteHead.duration-log = #2` so half and whole noteheads render as open/hollow noteheads.
