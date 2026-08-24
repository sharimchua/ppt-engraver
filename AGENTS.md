# Prime Period Theory (PPT) Engraver & Studio

## DOX Framework Contract

- **DOX is a hierarchical AGENTS.md framework** installed across this repository.
- Every AI agent working on this codebase must follow the DOX instructions before and after any edit.
- **Read Before Editing**:
  1. Read this root `AGENTS.md`.
  2. Walk from the repository root to each target file/directory you plan to touch.
  3. Read every `AGENTS.md` along the route (e.g. `src/AGENTS.md`, `studio/public/AGENTS.md`).
  4. Use the nearest `AGENTS.md` as the local contract and parent docs for repository-wide rules.
- **Update After Editing**:
  - Every meaningful change requires a DOX pass to keep docs aligned with implementation.
  - Whenever new musical features, grammar rules, schema properties, or CLI/Studio capabilities are added or changed, keep the root `README.md` synchronized alongside the relevant DOX (`AGENTS.md`) files.
  - Keep docs concise, clear, and up-to-date. Remove stale information immediately.

---

## Project Overview

**`ppt-engraver`** is the reference compiler and interactive visual studio for **Prime Period Theory (PPT)** — a geometric, cyclic music theory that unifies melody, rhythm, and harmony using **12 chromatic Solfège degrees**, **geometric glyph rotations**, and **hierarchical structural coils/weaves**.

The repository consists of:
1. **Core TypeScript Library & CLI (`src/`)**: Resolves high-level PPT Tapestry/Knot/Weave/Coil definitions into deterministic onset streams, generates LilyPond score markup (`.ly`), emits expectation sidecar maps (`.ppt-map.json`), and exports standard MIDI.
2. **Interactive IDE & Visual Studio (`studio/`)**: Full-stack web application with CodeMirror YAML editor, live LilyPond PDF/SVG rendering via PDF.js, Frescobaldi-style Point-and-Click source navigation, real-time text-aligned Solfège glyph previews, non-destructive Tonic/Mode & Rhythmic Period Transposition modals, structural shortcuts, Go-To symbol palette (`Ctrl+G`), loupe magnifier, and URL deeplinking.
3. **Score Library (`scores/`)**: High-level YAML score definitions (`*.ppt.yaml`).
4. **Test Suite (`test/`)**: 280+ automated tests across parser, resolvers, compiler, rhythm, pitch, transposition, and sidecars.

---

- **Tapestry / Knot(s)**: The global musical piece and root metadata (title, composer, tonic, tempo, engraving visibility toggles, arrangement projections). Supports single `knot:` or multiple named `knots:` (ordered arrays or dictionaries) with single/multi-parent inheritance (`parent`, `parents`), abstract base templates (`abstract: true` / `hidden: true` excluded from dropdown and un-inherited), custom per-knot weave selections, transpositions, and projection switching via dropdown or CLI `-k`.
- **Weave**: A structural container representing a voice, part, or section composed of hierarchical stitches (`stitch: [...]`) organized via `layout: concatenate` (sequential) or `layout: parallel` (simultaneous layering / polyphony).
- **Coil**: The fundamental musical motif containing:
  - `melody: [...]`: Solfège pitch degree array relative to reference root.
  - `rhythm: [...]`: Duration / rhythm token array.
  - `harmony: [...]`: Chord root and quality array.
- **12 Chromatic Solfège Degrees**:
  - `Do` (0 semitones, Base 0°, Red `#E13610`)
  - `Ra` / `Di` (1 semitone, Sharp 0°, Orange `#F98016`)
  - `Re` (2 semitones, Flat 270°, Orange `#F98016`)
  - `Me` / `Ri` (3 semitones, Base 270°, Yellow `#F5D432`)
  - `Mi` (4 semitones, Sharp 270°, Yellow `#F5D432`)
  - `Fa` / `Se` (5 semitones, Flat 180°, Green `#43A440`)
  - `Fi` (6 semitones, Base 180°, Slate/Dark `#141414`)
  - `So` / `Si` (7 semitones, Sharp 180°, Blue `#0032A4`)
  - `Le` (8 semitones, Flat 90°, Purple `#5300A4`)
  - `La` / `Li` (9 semitones, Base 90°, Indigo `#5300A4`)
  - `Te` (10 semitones, Sharp 90°, Pink `#F158A4`)
  - `Ti` (11 semitones, Flat 0°, Pink `#F158A4`)
- **Axis Diacritic (`x`)**:
  - Suffix `x` on any syllable (e.g. `Dox`, `Rex`, `Mex`, `Tex`) denotes an axis anchor/root notehead with a horizontal line through the glyph center, drawn in the syllable's own color.
- **Octave Displacement Prefix Triangles (`^` / `_`)**:
  - Prefixed directional triangle (pointing UP `▲` for `^` / octave up, pointing DOWN `▼` for `_` / octave down) drawn in the syllable's own chromatic color to the left of the glyph.
  - **Top/Bottom Aligned Inward Growth**: Upward octave markers align at the top-left and grow downwards toward the centre; downward octave markers align at the bottom-left and grow upwards toward the centre.
  - Main syllable centroid remains anchored at $(0, 0)$ without horizontal offset.
- **Dual Melody Coil Representations**:
  - **Melody Absolute**: Displays absolute scale degrees with octave displacement triangles for each onset.
  - **Melody Interval**: Anchor note at start with axis (`${scaleDegree}x`), followed by interval tokens computed via `semitoneIntervalToSolfege(diff)` with directional octave triangles.

---

## Directory & Subtree DOX Index

| Subtree Path | AGENTS.md Link | Primary Responsibility |
|---|---|---|
| `src/` | [src/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/AGENTS.md) | Core compiler, AST resolvers, LilyPond code gen, Solfège tables, MIDI export |
| `src/solfege/` | [src/solfege/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/solfege/AGENTS.md) | Solfège pitch mapping, interval calculations, glyph specifications |
| `src/lilypond/` | [src/lilypond/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/lilypond/AGENTS.md) | LilyPond markup templates, PostScript path stencils, source tagging |
| `src/resolver/` | [src/resolver/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/resolver/AGENTS.md) | Tapestry, Knot, Weave, and Coil resolution, inheritance, and concat trees |
| `studio/` | [studio/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/studio/AGENTS.md) | PPT Studio backend server, LilyPond runner, PDF/SVG compile APIs |
| `studio/public/` | [studio/public/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/studio/public/AGENTS.md) | Studio web client, CodeMirror editor, Point-and-Click PDF.js navigation, loupe |
| `scores/` | [scores/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/scores/AGENTS.md) | PPT score YAML definitions and test fixtures |
| `snippets/` | [snippets/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/snippets/AGENTS.md) | Modular YAML snippet templates for Studio autocomplete and Command Palette |
| `test/` | [test/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/test/AGENTS.md) | Vitest test suite and verification criteria |

---

## Common Development Commands

```bash
# Run test suite
npm test

# Build TypeScript package
npm run build

# Start PPT Studio Web Server (runs on http://localhost:3333)
npm run studio

# Compile a score via CLI
npm run compile -- scores/strive.ppt.yaml
```

---

## Operating Rules for AI Agents

1. **Test-Driven Integrity**: Always run `npm test` after modifying core engine or resolver logic. All tests must pass before completing a task.
2. **Grammar & Lexer Boundaries**: Solfège syntax coloring and preview strips must validate whole tokens (`isValidSolfegeToken`) and protect YAML keys from accidental coloring.
3. **LilyPond Execution**: Ensure LilyPond commands pass `-dpoint-and-click` so PDF and SVG point-and-click links remain active for studio navigation.
4. **README & Documentation Synchronization**: When introducing or modifying grammar, syntax (rhythm, pitch, harmony, bass/inversions, arrangement projections), schema properties, or studio features, update `README.md` and the associated DOX (`AGENTS.md`) files in the same changeset.
5. **Git Branching**: The default and active branch is `main`.
