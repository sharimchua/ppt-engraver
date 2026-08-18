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

- Every musical onset in LilyPond is tagged with a unique identifier:
  `\tag #'ppt_${coilId}_${voiceId}_${onsetIndex}`
- Example: `\tag #'ppt_introMotif_melody_1 c'4`
- This enables Frescobaldi and the PPT Studio preview to map PDF/SVG clicks directly back to the original token in the YAML source document.

---

## Rules for LilyPond Generation

- **Zero Missing Glyphs**: Every valid Solfège pitch must map to one of the 3 path stencils with correct rotation and color.
- **Strict Syntax Safety**: Ensure all scheme expressions (`#(...)`) are properly balanced and escaped.
- **Preserve Tags**: Never omit `\tag #'ppt_...` on notes or rests, as Point-and-Click navigation relies on them.
