# ppt-engraver

**Prime Period Theory (Tapestry/Coil) → LilyPond Compiler & Resolution Engine.**

Compiles [Prime Period Theory](https://ppt.midlifemuso.com/) Tapestry source files (`.ppt.yaml`) into standard music notation via LilyPond and playable MIDI audio.

---

## Status

- ✅ **Phase 1 — Resolution Engine**: Tapestry IR → Onset Stream JSON + Playable MIDI
- ✅ **Phase 2 — LilyPond Compiler**: Onset Stream → Provenance-Tagged `.notation.ly` + `.ppt-map.json` Sidecar
- ⏳ **Phase 3 — Consistency Checker + Safe Regeneration** (In Progress)

---

## Quick Start

```bash
npm install
npm test                                            # run full test suite (122 tests)
npm run build                                       # bundle distribution CLI

# Compile YAML to LilyPond notation (.notation.ly) & sidecar map (.ppt-map.json)
node dist/compile-cli.js scores/dracula.ppt.yaml

# Resolve YAML to MIDI audio & JSON onset stream
npx tsx src/index.ts scores/dracula.ppt.yaml -o out.json -m out.mid
```

---

## Tapestry Specification (`.ppt.yaml`)

A Tapestry file consists of three main sections:
1. **`knot`** (Score Metadata, Key Anchor, Clefs, Engraving Options)
2. **`coils`** *(Optional)* (Reusable Library of Named Coils)
3. **`weave`** (Hierarchical Sequence & Structure)

```yaml
tapestry:
  knot:
    title: "Dracula"
    composer: "Tame Impala"
    arranger: "Midlife Muso"
    do: "Eb4"
    harmonyClef: "bass_8"
    noteheadStyle: ppt
    omitStem: true
    colorNotes: true

  coils:
    verseBase:
      rhythm: DoFi
      melody: [Dox, Me, Re, La, Te, Re, Te]
      harmony: [DoMe]

  weave:
    id: song
    layout: concatenate
    children:
      - coil:
          id: verse1
          parents: [verseBase]
      - coil:
          id: verse2
          parents: [verseBase]
```

---

## Knot Attributes (`tapestry.knot`)

The `knot` establishes the concrete pitch anchor, score headers, staff clefs, and engraving visual styles.

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `do` | `string` | `"C4"` | Absolute pitch anchor for $Do$ (e.g. `"Eb4"`, `"C4"`, `"F#3"`). |
| `tempo` | `number` | `120` | Playback tempo in BPM. |
| `title` | `string` | — | Piece title engraved in score header. |
| `subtitle` | `string` | — | Subtitle or secondary description. |
| `composer` | `string` | — | Composer name (aliases: `artist`, `author`). |
| `arranger` | `string` | — | Arranger name. |
| `poet` | `string` | — | Poet or lyricist name (alias: `lyricist`). |
| `copyright` | `string` | — | Copyright notice. |
| `tagline` | `string \| boolean` | `false` | Custom footer text, or `false` to suppress LilyPond default footer. |
| `melodyClef` | `string` | `"treble"` | Melody staff clef (`"treble"`, `"treble_8"`, `"treble^8"`, `"bass"`). |
| `harmonyClef` | `string` | `"treble"` | Harmony staff clef (`"treble"`, `"bass"`, `"bass_8"`, `"bass_15"`). |
| `harmonyOctave` | `number` | Auto | Global octave transposition shift for harmony chords (e.g. `0`, `-1`, `-2`). |
| `noteheadStyle` | `enum` | `'default'` | Notehead styling: `'ppt'`, `'sacredHarp'`, `'aiken'`, `'funk'`, `'walker'`, `'diamond'`, `'default'`. |
| `omitStem` | `boolean` | `false` | Omit note stems for unmetered cadenza display. |
| `colorNotes` | `boolean` | `false` | Colorize melody noteheads according to the PPT Solfège palette. |
| `noteheadOutline` | `boolean` | `true` | Apply high-contrast black outline mask around colored noteheads. |
| `harmonyChangesOnly`| `boolean` | `true` | Display harmony chords as whole noteheads only when changed and at bar starts. |

---

## Solfège Pitch Vocabulary (12 Chromatic Tones)

PPT uses **Uniform Solfège** with 12 distinct chromatic syllables mapped to standard geometric shapes and colors:

| Syllable | Degree | Interval | Geometric Shape | Color | Hex |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Do`** | 1 | Tonic ($0$) | Circle | Red | `#E13610` |
| **`Ra`** / `Di` | $\flat 2$ / $\sharp 1$ | Minor 2nd ($+1$) | Square | Orange | `#F98016` |
| **`Re`** | 2 | Major 2nd ($+2$) | Square | Orange | `#F98016` |
| **`Me`** / `Ri` | $\flat 3$ / $\sharp 2$ | Minor 3rd ($+3$) | Triangle Down | Yellow | `#F5D432` |
| **`Mi`** | 3 | Major 3rd ($+4$) | Triangle Up | Yellow | `#F5D432` |
| **`Fa`** / `Se` | 4 | Perfect 4th ($+5$) | Semicircle Left | Green | `#43A440` |
| **`Fi`** | $\sharp 4$ / $\flat 5$| Tritone ($+6$) | Cross ($\times$) | Charcoal | `#141414` |
| **`So`** | 5 | Perfect 5th ($+7$) | Semicircle Right | Blue | `#0032A4` |
| **`Le`** / `Si` | $\flat 6$ / $\sharp 5$| Minor 6th ($+8$) | Triangle Down | Purple | `#5300A4` |
| **`La`** | 6 | Major 6th ($+9$) | Triangle Up | Purple | `#5300A4` |
| **`Te`** / `Li` | $\flat 7$ / $\sharp 6$| Minor 7th ($+10$)| Diamond | Magenta | `#F158A4` |
| **`Ti`** | 7 | Major 7th ($+11$)| Diamond | Magenta | `#F158A4` |

---

## Melodic Layer (`coil.melody`)

Melody arrays support two distinct resolution modes:

### 1. Absolute Mode (Default)
Each syllable directly represents its scale degree from $Do$:
```yaml
melody: [Do, Me, Re, La, Te, Re, Te]
```

### 2. Interval Mode (Axis Marker `x`)
Prefixing the first note with `x` activates interval mode. The first note anchors the starting pitch; all subsequent notes are resolved as relative steps from the preceding note using nearest-address circular topology:
```yaml
melody: [Dox, Me, Re, La, Te, Re, Te]
# Dox -> Starts on Do
# Me  -> Moves by minor 3rd from previous note
# Re  -> Moves by major 2nd from previous note
```

### Octave Modifiers & Multi-Token Syntax
- **`^` / `^^`**: Shift pitch up by 1 or 2 octaves (`"Do^"`, `"Sox^"`).
- **`_` / `__`**: Shift pitch down by 1 or 2 octaves (`"So_"`, `"Me__"`).
- **Inline Spacing**: Tokens can be written space-separated in a single string (e.g. `melody: ["Do Mi", "So Do^"]`).

---

## Harmony Layer (`coil.harmony`)

Harmony chords are automatically voiced into tertian triads/sevenths and adapted to the active clef register.

### Supported Chord Qualities

| Token | Chord Name | Harmonic Formula | Example ($Do = \text{C}$) |
| :--- | :--- | :--- | :--- |
| `Do` | Major Triad | $1 - 3 - 5$ | C major (`C - E - G`) |
| `DoMe` | Minor Triad | $1 - \flat 3 - 5$ | C minor (`C - Eb - G`) |
| `FaMe` | Minor Triad on 4th | $4 - \flat 6 - 1$ | F minor (`F - Ab - C`) |
| `SoTe` / `DoTe` | Dominant 7th | $1 - 3 - 5 - \flat 7$ | G7 / C7 |
| `DoMeTe` | Minor 7th | $1 - \flat 3 - 5 - \flat 7$ | C minor 7th |
| `DoFi` / `TiFi` | Diminished Triad | $1 - \flat 3 - \flat 5$ | C dim / B dim |
| `Do^` / `Do_` | Octave Shift | Transposed $\pm 1$ Octave | `Do` shifted up or down |

### Harmony Distribution & Repeat Counts

1. **Repeat Padding Counts**: Use integers to sustain a chord across specific onsets:
   ```yaml
   harmony: [DoMe, 3, So, 2, Le]
   # DoMe held for 4 beats (1 + 3), So held for 3 beats (1 + 2), Le for 1 beat
   ```
2. **Automatic Stretch Mode**: Unpadded chord lists are stretched evenly across the melody length:
   ```yaml
   melody: [Do, Re, Mi, Fa, So, La]  # 6 onsets
   harmony: [Do, So]                # Do spans onsets 1-3, So spans onsets 4-6
   ```

---

## Rhythm Layer (`coil.rhythm`)

Named rhythm block-length labels validate the expected melody onset count per coil:

| Rhythm Label | Expected Onset Count |
| :--- | :--- |
| `DoSo` | 2 beats |
| `DoRe` | 3 beats |
| `DoLa` | 4 beats |
| `DoMi` | 5 beats |
| `DoSi` | 6 beats |
| `DoFi` | 7 beats |

---

## Coil Composition & Layer Inheritance

Coils support priority-based layer inheritance:
1. **Explicit Local Layer**: Defined directly on the coil.
2. **`parents` Array**: Inherited from named coils in order of priority.
3. **`defaultCoil`**: Inherited from the enclosing weave scope.
4. **System Fallback**: Harmony defaults to `[Do]`.

```yaml
tapestry:
  coils:
    verseBase:
      rhythm: DoLa
      harmony: [DoMe]

  weave:
    id: song
    defaultCoil:
      rhythm: DoLa
    children:
      - coil:
          id: motif1
          parents: [verseBase]
          melody: [Dox, Me, Re, Do] # Inherits harmony: [DoMe]
```

---

## CLI Reference

### `ppt-compile` (LilyPond Compiler)

```bash
# Compile to <base>.notation.ly & <base>.ppt-map.json
ppt-compile scores/dracula.ppt.yaml

# Custom output file paths
ppt-compile scores/dracula.ppt.yaml -o score.ly --map score.map.json

# Render PDF using local LilyPond engine
ppt-compile scores/dracula.ppt.yaml --render
```

### `ppt-resolve` (Resolution Engine)

```bash
# Print resolved onset stream JSON to stdout
ppt-resolve scores/dracula.ppt.yaml

# Save JSON onset stream and playable MIDI file
ppt-resolve scores/dracula.ppt.yaml -o dracula.json -m dracula.mid
```

---

## License

MIT © Midlife Muso

