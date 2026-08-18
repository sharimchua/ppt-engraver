# Test Suite & Quality Verification (`test/`)

## Purpose & Scope

The `test/` directory contains automated unit and integration tests powered by **Vitest**. It validates compiler correctness, schema parsing, resolver math, pitch intervals, rhythm alignment, LilyPond generation, and sidecar map emission.

---

## Test Execution

```bash
# Run all tests
npm test

# Run tests in watch mode
npx vitest

# Run a specific test file
npx vitest test/compiler/compile.test.ts
```

---

## Key Test Suites

| Test File | Focus Area |
|---|---|
| `test/compiler/compile.test.ts` | End-to-end compilation pipeline (`compileYamlString`) |
| `test/lilypond/compiler.test.ts` | LilyPond markup generation, Scheme stencils, voice tags |
| `test/lilypond/pitch.test.ts` | MIDI pitch to LilyPond note name conversion |
| `test/resolver/coil.test.ts` | Coil onset alignment, melody, rhythm, and harmony |
| `test/resolver/concat.test.ts` | Concat tree resolution and timing continuity |
| `test/resolver/inheritance.test.ts` | Parent coil attribute inheritance (`parents: [...]`) |
| `test/resolver/knot.test.ts` | Knot tonic and tempo extraction |
| `test/resolver/weave.test.ts` | Hierarchical weave traversal |
| `test/schema/tapestry.test.ts` | Zod schema validation rules |
| `test/sidecar/map.test.ts` | Sidecar expectation map generation and tag lookups |
| `test/solfege/pitch.test.ts` | 12 chromatic degrees, semitone intervals, glyph specs |
| `test/solfege/rhythm.test.ts` | Rhythm token duration calculations |
| `test/midi/writer.test.ts` | MIDI byte generation |
| `test/parser/yaml-loader.test.ts` | YAML parsing error handling |

---

## Acceptance Criteria for PRs and Commits

- **100% Passing Tests**: All 190+ test assertions must pass without regressions.
- **Strict Linting / Syntax**: No unhandled syntax or type errors in TypeScript or client JS (`node --check studio/public/app.js`).
