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
   - `\melodyVoice`: Standard notation staff with custom notehead stencils.
   - `\melodyCoilInterval`: Lyric line rendering interval tokens above each onset.
   - `\melodyCoilAbsolute`: Lyric line rendering absolute scale degrees above each onset.
   - `\rhythmCoil`: Lyric line displaying rhythm solfège syllables.
   - `\harmonyCoil`: Chord names and Roman numeral / triad indicators.
   - `\rhythmGrid`: Subdivision tick marks and beat pulse indicators.

---

## Point-and-Click Source Tagging

- Every musical onset in LilyPond is tagged with an explicit layer-encoded identifier:
  `\tag #'ppt_${weaveId}_${coilId}_${layer}_${onsetIndex}`
  - Melody staff: `melody` (e.g. `ppt_verse_introMotif_melody_1`)
  - Melody Absolute coil: `melodyAbs` (e.g. `ppt_verse_introMotif_melodyAbs_1`)
  - Melody Interval coil: `melodyInt` (e.g. `ppt_verse_introMotif_melodyInt_1`)
  - Rhythm coil: `rhythm` (e.g. `ppt_verse_introMotif_rhythm_1`)
  - Harmony coil: `harmony` (e.g. `ppt_verse_introMotif_harmony_1`)
  - Harmony staff: `harmonyStaff` (e.g. `ppt_verse_introMotif_harmonyStaff_1`)
  - Chord names: `chordName` (e.g. `ppt_verse_introMotif_chordName_1`)
- Example: `\tag #'ppt_verse_introMotif_melody_1 c'4`
- This enables PPT Studio point-and-click navigation to route clicks unambiguously to the exact layer line (`melody:`, `rhythm:`, or `harmony:`), and trace concatenated / inherited sub-coils back to their definition in YAML.

---

## Rules for LilyPond Generation

- **Zero Missing Glyphs**: Every valid Solfège pitch must map to one of the 3 path stencils with correct rotation and color.
- **Strict Syntax Safety**: Ensure all scheme expressions (`#(...)`) are properly balanced and escaped.
- **Preserve Tags**: Never omit `\tag #'ppt_...` on notes or rests, as Point-and-Click navigation relies on them.
