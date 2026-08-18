# Core Compiler & Music Engine (`src/`)

## Purpose & Responsibilities

The `src/` directory contains the core TypeScript engine for Prime Period Theory (PPT). It is responsible for parsing YAML score descriptions, resolving hierarchical musical objects, mapping chromatic pitches to Solfège tokens, calculating harmonic relationships, and producing deterministic outputs (LilyPond `.ly`, MIDI `.mid`, and Sidecar maps `.ppt-map.json`).

---

## Subsystem Architecture

```
src/
├── parser/        # YAML parsing and AST building (yaml-loader.ts)
├── schema/        # Zod schemas & TypeScript type definitions (tapestry.ts)
├── resolver/      # Knots, Weaves, Coils, Concat, and Inheritance resolvers
├── solfege/       # Solfège pitch mapping, interval calculators, glyph geometry
├── lilypond/      # LilyPond template generation, PostScript stencils, tagging
├── sidecar/       # Machine-readable onset expectation maps (.ppt-map.json)
├── midi/          # Standard MIDI file writer
├── compiler/      # Top-level orchestrator (compile.ts)
└── index.ts       # Public API exports
```

---

## Child DOX Index

| Subdirectory | AGENTS.md Link | Key Details |
|---|---|---|
| `solfege/` | [src/solfege/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/solfege/AGENTS.md) | 12-chromatic degrees, SVG glyphs, angle rotations, interval calculators |
| `lilypond/` | [src/lilypond/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/lilypond/AGENTS.md) | Scheme stencil paths (`pptPathBase`, `pptPathSharp`, `pptPathFlat`), voice layout |
| `resolver/` | [src/resolver/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/src/resolver/AGENTS.md) | AST resolution, weave hierarchies, rhythm expansion, chord harmonization |

---

## Key Compilation Pipelines

1. **`compileYamlString(yamlText)`**:
   - Parses YAML into AST using `yaml-loader`.
   - Validates schema against `TapestrySchema`.
   - Resolves all knots and weaves into flat onset streams via `resolveTapestry()`.
   - Generates LilyPond `.ly` source markup via `generateLilyPond()`.
   - Constructs `SidecarMap` (`sidecarMap`) mapping tagged notes (`\tag #'ppt_${coil}_...`) to their respective `coilId` and `onsetIndex`.
   - Returns `{ lilypondSource, onsets, sidecarMap, midiBuffer, warnings }`.

---

## Rules for Agents Working in `src/`

- **Pure Functional Core**: Keep AST resolution and Solfège mapping free from side effects and file I/O where possible.
- **Never Break Interval Geometry**: Ensure `semitoneIntervalToSolfege` always follows the PPT chromatic wheel (Do=0, Ra=1, Re=2, Me=3, Mi=4, Fa=5, Fi=6, So=7, Le=8, La=9, Te=10, Ti=11).
- **Maintain Test Suite**: When adding new musical attributes or schema properties, update corresponding unit tests in `test/`.
- **Synchronize README & DOX**: When extending or modifying syntax (e.g. Solfège pitch tokens, rhythm subdivisions/suffixes, harmony inversions/voicings, arrangement projections) or compiler schema options, ensure `README.md` and local `AGENTS.md` docs are updated to document the new user-facing capabilities.
