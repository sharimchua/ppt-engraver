# LilyPond Code Generation & Scheme Stencils (`src/lilypond/`)

## Purpose & Scope

The `src/lilypond/` directory generates valid, beautiful, standalone LilyPond markup (`.ly`) from resolved PPT score onsets. It includes custom Scheme functions and PostScript path stencils to engrave PPT geometric noteheads, solfège lyric lines, rhythm grids, and harmony blocks.

---

## LilyPond Score Structure

Generated `.ly` documents contain:
1. **Scheme Header & Path Definitions**:
   - `pptPathBase`, `pptPathSharp`, `pptPathFlat` defining the vector bezier curves.
   - `pptPathTriangleUp`, `pptPathTriangleDown` defining directional octave displacement indicators.
   - `make-solfege-glyph` / `make-path-stencil` computing scale, rotation, color, optional axis stroke, and vertical-stacked directional octave displacement triangles.
2. **Engraving Visibility Config**:
   - `\layout` and `\paper` blocks configured for Frescobaldi and PPT Studio rendering.
3. **Voice Lines**:
   - `\melodyVoice`: Standard notation staff with custom notehead stencils (`<< \new Voice = "v1" \\ \new Voice = "v2" >>` when polyphonic).
   - `\melodyCoilAbsolute`: Row band displaying absolute Solfège pitch classes (emits `M1`, `M2`, etc. clefs when polyphonic, or `M` when single-voice).
   - `\melodyCoilInterval`: Lyric line rendering interval tokens with `M` / `M1` clef.
   - `\rhythmCoil`: Unified collapsed rhythm row band with `R` clef, merging all active subdivisions across melody voices and harmony into a single chronological rhythmic spine.
   - `\pulseCoil`: Row band with `P` clef displaying macro metric pulses across the timeline (`showPulseCoil`).
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
  - Pulse coil: `pulse` (e.g. `ppt_verse_introMotif_pulse_1`)
  - Harmony coil: `harmony` (e.g. `ppt_verse_introMotif_harmony_1`)
  - Harmony staff: `harmonyStaff` (e.g. `ppt_verse_introMotif_harmonyStaff_1`)
  - Chord names: `chordName` (e.g. `ppt_verse_introMotif_chordName_1`)
- Polyphony compiles into `\new Voice = "v1" { \voiceOne ... }` and `\new Voice = "v2" { \voiceTwo ... }` inside the top staff.
- This enables PPT Studio point-and-click navigation to route clicks unambiguously to the exact layer line (`melody:`, `rhythm:`, or `harmony:`) and voice, tracing concatenated / inherited sub-coils back to their definition in YAML.

---

## Rules for LilyPond Generation

- **Zero Missing Glyphs**: Every valid Solfège pitch must map to one of the 3 path stencils with correct rotation and color.
- **Strict Syntax Safety**: Ensure all scheme expressions (`#(...)`) are properly balanced and escaped. Inside `\markup \column { ... }`, child elements must be markup bodies (markup expressions **without** a leading `\markup` keyword) — nesting `\markup` inside `\column` is a LilyPond syntax error.
- **Preserve Tags**: Never omit `\tag #'ppt_...` on notes or rests, as Point-and-Click navigation relies on them.
- **Decoupled Canonical ChordNames**: `\new ChordNames` uses canonical block chords (`canonicalChordToLilyPond`) derived directly from Solfège tokens and key context, completely independent of harmony staff voicings (e.g. `rootless`, `shell`, `bassOnly`), preserving clean lead sheet symbols and slash chords (`C/G`, `C/E`, `Cm/Eb`).
- **Rhythmic Beaming in Cadenza Mode**: Because `\cadenzaOn` suppresses LilyPond's automatic beam engraver, sub-quarter notes (< 1.0 beat) within each integer beat window are beamed deterministically using manual beam brackets (`[` and `]`), respecting voice, rest, and coil barline boundaries.
- **Traditional Rhythms Mode (`traditionalRhythms: true`)**: Formats periods with standard traditional duration tokens (dotted notes `2.`, `4.`, `8.`, `1.`, half notes `2`, whole notes `1`), visible rests (`r4`, `r2`, `r8`, etc.), and omits `\override NoteHead.duration-log = #2` so half and whole noteheads render as open/hollow noteheads.
- **Traditional Time Signature on Staves (`showTimeSignature: true`)**: Emits standard `\time <sig>` on traditional 5-line notation staves (`melodyVoice`, `harmonyVoice`) and retains `Time_signature_engraver` on standard staves while keeping coil staves uncluttered.
- **Score Header Pulse Signature (`showPulseSignature: true` / `pulseSignature`)**: Rendered on a **separate line** below the key anchor. Each syllable in the pulse string is parsed and emitted as a full-color PPT Solfège glyph stencil (`make-solfege-glyph`) in its chromatic color, preceded by a small "P:" label. Implemented as `\markup \column { keyAnchorBody pulseRow }` where each row body is a `\line \vcenter { ... }` expression (no nested `\markup` prefix).
- **Rhythm Grid Strong Beat Weighting (`strongBeatGridWeight: true`)**: Uses a **solid** (continuous, non-dashed) line (`make-strong-grid-point-stencil`, `0.12` thickness, `gray65`) applied via `\once \override Staff.GridPoint.stencil = #make-strong-grid-point-stencil` for strong downbeats (`Do`/`Dox`, `Di`/`Dix`), while weak offbeats use lighter dashed lines (`make-weak-grid-point-stencil`, `gray85`).
- **Grid Notehead Symbol Annotations (`gridSymbols: true | 'no-do' | 'all'`)**: Annotates onset columns with light chromatic geometric PPT notehead shapes (Circle for `Do`, Cross for `Fi`, Triangles for `Me`/`La`/`Mi`/`Le`, Squares/Diamonds for `Re`/`Te`, etc.). When multiple coil layers are present, symbols frame the stack (top of the topmost coil and bottom of the bottommost coil); when only a single coil layer is present, a single row is placed above it (between the coil layer and the melody staff); when no coil layers are shown, symbols sit at the exact vertical midpoint between melody and harmony staves. Horizontal centering over noteheads and rhythm gridlines is achieved by `make-grid-symbol-stencil` in Scheme (`(cons 0.65 0)` offset). Vertical consistency is locked with `\override TextScript.outside-staff-priority = ##f`, `\override TextScript.self-alignment-Y = #CENTER`, and fixed `Y-offset` (`#4.5`/`#-4.5` between staves without coils, `#3.6`/`#-3.6` outside coil row bands). Circles on `Do` can be suppressed via `excludeGridDoSymbol: true` or `gridSymbols: 'no-do'`.
