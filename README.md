# ppt-engraver

PPT (Tapestry/Coil) → LilyPond compiler — resolution engine.

Compiles [Prime Period Theory](https://ppt.midlifemuso.com/) Tapestry source into standard music notation via LilyPond, starting with a resolution engine that produces onset streams from `.ppt.yaml` files.

## Status

- ✅ **Phase 1 — Resolution Engine** (Tapestry IR → Onset Stream JSON + playable MIDI)
- ✅ **Phase 2 — LilyPond Compiler** (Onset Stream → Tagged `.notation.ly` + `.ppt-map.json` sidecar)
- ⏳ **Phase 3 — Consistency Checker + Regeneration** (Next)

## Quick Start

```bash
npm install
npm test                                            # run full test suite (85 tests)
npx tsx src/compile-cli.ts examples/verse.ppt.yaml  # compile → .notation.ly + .ppt-map.json
npx tsx src/index.ts examples/verse.ppt.yaml -m out.mid # resolve → MIDI audio playback
```

## CLI Usage

### `ppt-compile` (Phase 2)

Compiles Tapestry source into standalone LilyPond notation and sidecar expectation map:

```bash
# Compile to <base>.notation.ly and <base>.ppt-map.json
ppt-compile piece.ppt.yaml

# Specify custom output paths
ppt-compile piece.ppt.yaml -o custom.ly --map custom.ppt-map.json

# Optional: also render PDF via local lilypond binary if installed
ppt-compile piece.ppt.yaml --render
```

### `ppt-resolve` (Phase 1)

Resolves Tapestry source into an onset stream JSON or MIDI file:

```bash
# Resolve and print JSON to stdout
ppt-resolve piece.ppt.yaml

# Write JSON and playable MIDI file
ppt-resolve piece.ppt.yaml -o piece.json -m piece.mid
```


## Input Format

`.ppt.yaml` files use [Three-Layer Coil Notation](https://ppt.midlifemuso.com/reference/structure/coil-notation) with [Uniform Solfège](https://ppt.midlifemuso.com/reference/uniform-solfege):

```yaml
tapestry:
  knot:
    do: C4          # Absolute pitch anchor (default: C4)
    tempo: 120      # BPM (accepted but unused in v1)
  weave:
    id: verse
    layout: concatenate
    children:
      - coil:
          id: introMotif
          rhythm: DoLa                    # 4 onsets
          melody: [Do, Mi, So, "Do^"]     # Absolute mode
          harmony: [Do]                   # Do major triad held across all onsets
      - coil:
          id: cadence
          rhythm: DoSo                    # 2 onsets
          melody: [Ti, "Do^"]
          harmony: [So]                   # So major triad
```

### Melodic Modes

**Absolute mode** (default): each syllable names a scale degree from Do.
```yaml
melody: [Do, Mi, So, "Do^"]   # C4, E4, G4, C5
```

**Interval mode**: first syllable has axis marker `x`, subsequent syllables are offsets.
```yaml
melody: [Dox, Re, Mi, Ti]     # C4, D4 (+2), F#4 (+4), F4 (-1)
```

### Rhythm Labels

| Label  | Onsets |
|--------|--------|
| DoSo   | 2      |
| DoRe   | 3      |
| DoLa   | 4      |
| DoMi   | 5      |
| DoSi   | 6      |
| DoFi   | 7      |

## Output Format

Each onset in the JSON array contains:

| Field        | Description                                    |
|-------------|------------------------------------------------|
| `tag`       | Provenance tag: `ppt_<weaveId>_<coilId>_<n>`   |
| `pitch`     | Absolute pitch name (e.g. `"C4"`)              |
| `midiNote`  | MIDI note number                               |
| `scaleDegree` | Solfège syllable                              |
| `chordTones` | Chord pitch names (e.g. `["C4","E4","G4"]`)   |
| `chordMidi` | Chord MIDI note numbers                        |
| `chordRoot` | Chord root solfège syllable                    |
| `coilId`    | Source coil ID                                 |
| `weaveId`   | Source weave ID                                |
| `onsetIndex` | 1-based index within coil                     |

## Architecture

```
.ppt.yaml → [YAML Parser] → [Schema Validation] → [Knot Resolver]
                                                        ↓
                    [Onset Stream JSON] ← [Weave Resolver] ← [Coil Resolver]
```

## Roadmap

- **Phase 2**: LilyPond compiler (onset stream → tagged `.ly` + `.ppt-map.json`)
- **Phase 3**: Consistency checker + regeneration
- **Phase 4**: Custom PPT/Solfège engraving extension
- **Phase 5**: Rhythm duration resolution

## License

MIT
