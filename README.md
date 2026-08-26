# ppt-engraver

**Prime Period Theory (Tapestry/Coil) → LilyPond Compiler & Web Studio.**

Compiles [Prime Period Theory](https://ppt.midlifemuso.com/) Tapestry source files (`.ppt.yaml`) into standard music notation via LilyPond and playable MIDI audio.

---

## Features

- 🎼 **Live Web Studio**: Real-time side-by-side YAML editor with instant vector SVG and high-resolution PDF preview (`npm run studio`), Frescobaldi-style Point-and-Click source navigation, Solfège preview strips, scroll depth preservation, Auto-Compile toggle, and Command Palette (`Ctrl+Shift+P` / `F1`).
- 🎨 **PPT Solfège Geometry & Colors**: Standard 12-chromatic Solfège noteheads, vector SVG glyphs, custom clefs (`H`, `Do`, `Rhythm`), and tailored HSL color palette.
- 🧬 **Multi-Layer Coils**: Melody, Harmony, Rhythm, and metric block layers with priority-fill inheritance and polyphonic multi-voice support.
- 🔗 **Coil Concatenation & In-Place Maps**: Compose complex phrases using `concat: [...]` with automatic downbeat rhythm boundary collapsing.
- 📐 **Solfège Rhythmic Grammar**: Full sub-beat subdivisions via 12 chromatic degrees (`Fi` = 8th note, `Me`/`La` = 16th notes, `Mi`/`Le` = triplets, `Re`/`Te` = sextuplets), recursive compound suffixes (`LeFi`, `MeFi`), downbeat skips/rests (`Dox`, `DoxDo`, `DoxFi`), and repeat lookback windows (`X.Y`).
- 🎹 **Harmonic Grammar, Inversions & Slash Chords**: 12-chromatic Solfège chord qualities, explicit bass notes and inversions via Axis Bass prefix (`${Bass}x${Root}${Quality}`, e.g., `SoxDo` = C/G, `MiexDo` = C/E, `MexDoMe` = Cm/Eb, `FaxDo` = C/F), chord voicing styles (`close`, `rootless`, `shell`, `open`, `smoothLead`, `bassOnly`, `walkingBass`), and melody harmonic augmentations (`thirdsBelow`, `drop2`, `triadClose`).
- 🎸 **Guitar Tablature & Voicings (`TabStaff`)**: Automatic string/fret fingering solver (`showGuitarTab: true`) placed underneath traditional harmony, with PPT geometric noteheads rendered behind fret numbers, customizable guitar voicings (`melodyOnly`, `root`, `triad`, `shell`, `auto`), open string handling, and hand reach span limits (`maximumFretSpan: 3` or `4`).
- 📄 **LilyPond Engine**: Compiles to `.notation.ly`, vector `.svg`, `.pdf`, and `.ppt-map.json` provenance sidecars with standard MIDI export.

---

## Quick Start

### 1. Launch the Live Web Studio

```bash
npm install
npm run studio
```
Opens the interactive Web Studio in your browser at `http://localhost:3333` with live vector score preview, schema validation, diagnostics, and interactive point-and-click source navigation.

### 2. Command-Line Compilation

```bash
# Build the distribution CLI
npm run build

# Run unit test suite (270+ tests)
npm test

# Compile YAML score to LilyPond notation (.notation.ly) & sidecar map (.ppt-map.json)
node dist/compile-cli.js scores/strive.ppt.yaml -o scores/

# Compile a specific knot projection from a multi-knot score
node dist/compile-cli.js scores/autumn_leaves_variants.ppt.yaml -k leadSheet
```

---

## Configuring LilyPond

The compiler and Web Studio look for the LilyPond binary automatically at:
1. Environment variable: `LILYPOND_PATH` or `LILYPOND_BIN`
2. `C:\lilypond-2.24.4\bin\lilypond.exe` (Windows default)
3. `C:\Program Files\LilyPond\bin\lilypond.exe`
4. System PATH: `lilypond`

You can also adjust the LilyPond path anytime in the Web Studio **Settings (⚙)** modal.

---

## Tapestry Specification (`.ppt.yaml`)

```yaml
tapestry:
  knot:
    tonic: "A4"
    weave: song
    engraving:
      title: "Strive"
      composer: "Christopher Larkin"
      arranger: "Kieran + Midlife Muso"
      harmonyClef: treble_8
      harmonyVoicing: close
      colorNotes: true
      omitStem: true
      show:
        - melody
        - harmony
        - melodyCoilAbsolute
        - harmonyCoil
        - rhythmCoil
        - rhythmGrid
        - chordNames

  weaves:
    song:
      stitch:
        - weave: verse

    verse:
      coils:
        _v1:
          melody: [Dox, Do, Me, La, Me]
          rhythm: [Do, Fi, Do, Fi, Do, Do]
          harmony: [DoMe, 2, SoxDo, 2]
        _v2:
          melody: [Dox, Me, Re]
          rhythm: [DoxMe, Fi, La]
          harmony: [MexDoMe, 2]
        _v3:
          melody: [Sox^, Te, Re, Te, Te, Re]
          rhythm: [Do, Fi, Le, Te, Do, Fi]
          harmony: [FaMe, 3, SoxDo, 3]

        verse1:
          concat: [_v1, _v2, _v3]

      stitch:
        - coil: verse1
```

---

## Knot Attributes & Multi-Knot Projections (`tapestry.knot` / `tapestry.knots`)

Scores can define a single root `knot:` or multiple named `knots:` (ordered arrays or dictionaries) to provide different arrangement projections, transpositions, and part views of the same score.

- **Declaration Order & Default Projection**: The first declared non-abstract knot in the tapestry serves as the default projection view.
- **Knot Inheritance (`parent` / `parents`)**: Child knots inherit settings from parent knots with priority overrides (e.g. overriding only `projection: leadSheet` or `tonic: "Eb4"`).
- **Abstract Knots (`abstract: true` / `hidden: true`)**: Mark shared baseline templates as abstract so they are excluded from the Studio dropdown. The `abstract` / `hidden` visibility parameter is explicitly **not inherited** by children, so child knots remain concrete, visible projections.
- **Studio Dropdown & Deeplinking**: Switch projections instantly from the Studio toolbar header dropdown or share direct URLs (`?score=autumn_leaves_variants.ppt.yaml&knot=leadSheet`).
- **CLI Projection Selection**: Compile specific knots from the command line using `-k <knotId>` or `--knot <knotId>`.

### Multi-Knot Example with Abstract Base Knot & Inheritance

```yaml
tapestry:
  knots:
    - id: _baseArrangement
      name: "Abstract Base (Common Settings)"
      abstract: true
      tonic: "C5"
      weave: song
      engraving:
        title: "Autumn Leaves"
        composer: "Joseph Kosma"
        colorNotes: true

    - id: fullScore
      name: "Full Score (Concert C5)"
      parent: _baseArrangement
      engraving:
        subtitle: "Full Arrangement"
        projection: default

    - id: leadSheet
      name: "Lead Sheet"
      parent: _baseArrangement
      engraving:
        subtitle: "Lead Sheet Edition"
        projection: leadSheet

    - id: chordMelody
      name: "Chord Melody (Solo)"
      parent: _baseArrangement
      engraving:
        subtitle: "Chord Melody Solo"
        projection: chordMelody

    - id: transposedEb
      name: "Alto Sax (Eb5)"
      parent: _baseArrangement
      tonic: "Eb5"
```

### Knot Configuration Attributes

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `"default"` | Unique identifier for the knot projection. |
| `name` / `label` | `string` | ID | Human-readable label displayed in Studio dropdown. |
| `abstract` / `hidden` | `boolean` | `false` | When `true`, marks knot as an abstract template excluded from the dropdown (not inherited by children). |
| `visible` | `boolean` | `true` | Visibility toggle in Studio dropdown (not inherited by children). |
| `parent` / `parents` | `string \| string[]` | — | Single or ordered parent knot IDs to inherit settings from. |
| `tonic` / `do` | `string` | `"C4"` | Absolute pitch anchor for $Do$ (e.g. `"Eb4"`, `"C4"`, `"F#3"`). |
| `weave` | `string` | First weave | Target root weave ID to engrave for this knot projection. |
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
| `harmonyVoicing` | `enum` | `'close'` | Harmony chord voicing projection: `'close'`, `'rootless'`, `'rootFifth'`, `'shell'`, `'open'`, `'smoothLead'`, `'bassOnly'`, `'walkingBass'`, `'octaves'`. |
| `melodyAugmentation` | `enum` | `'none'` | Melodic harmonic augmentation: `'none'`, `'thirdsBelow'`, `'sixthsBelow'`, `'triadClose'`, `'drop2'`, `'guideToneDyad'`, `'octaves'`. |
| `melodyAugmentationDisplay` | `enum` | `'ghosted'` | Visual styling for inferred melody augmentation notes: `'ghosted'`, `'dimmed'`, `'smallColored'`, `'smallMuted'`, `'parenthesized'`, `'diamond'`, `'normal'`. |
| `projection` | `enum` | `'default'` | High-level arrangement preset: `'default'`, `'chordMelody'`, `'leadSheet'`, `'jazzComping'`, `'acousticFolk'`, `'bassAndLead'`. |
| `noteheadStyle` | `enum` | `'default'` | Notehead styling: `'ppt'`, `'sacredHarp'`, `'aiken'`, `'funk'`, `'walker'`, `'diamond'`, `'default'`. |
| `omitStem` | `boolean` | `false` | Omit note stems for unmetered / cadenza display. |
| `traditionalRhythms` | `boolean` | `false` | Use traditional notation formatting (dotted notes, open noteheads for half/whole, rests). |
| `colorNotes` | `boolean` | `false` | Colorize melody noteheads according to the PPT Solfège palette. |
| `noteheadOutline` | `boolean` | `true` | Apply high-contrast black outline mask around colored noteheads. |
| `harmonyChangesOnly`| `boolean` | `true` | Display harmony chords only when changed and at bar starts. |
| `chordChanges` | `boolean` | `false` | Display chord symbol names only when changed. |
| `showChordNames` | `boolean` | `false` | Display chord symbol names above harmony staff. |
| `zoom` | `number` | `1.0` | Global staff scaling factor (e.g. `1.2` for +20%) or absolute pt size. |
| `indent` | `number` | `0` | First-line score indentation in mm (`0` for flush alignment). |
| `show` | `string[]` | `['melody']` | Visible score layers: `melody`, `harmony`, `melodyCoilAbsolute`, `melodyCoilInterval`, `harmonyCoil`, `rhythmCoil`, `rhythmGrid`, `chordNames`. |

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

Melody arrays support two distinct resolution modes, octave displacements, and repetition syntax:

### 1. Absolute Mode (Default)
Each syllable directly represents its scale degree from $Do$:
```yaml
melody: [Do, Me, Re, La, Te, Re, Te]
```

### 2. Interval Mode (Axis Marker `x`)
Prefixing the first note with `x` activates interval mode. The first note anchors the starting pitch; all subsequent notes are resolved as relative steps from the preceding note using nearest-address circular topology:
```yaml
melody: [Dox, Me, Re, La, Te, Re, Te]
# Dox -> Starts on Do (anchor)
# Me  -> Moves by minor 3rd (+3) from previous note
# Re  -> Moves by major 2nd (+2) from previous note
```

### Octave Modifiers & Directional Prefix Triangles
- **`^` / `^^`**: Shift pitch up by 1 or 2 octaves (`"Do^"`, `"Sox^"`, `"Do^^"`). Renders a directional triangle pointing UP (`▲`) prefixed to the left of the syllable glyph in the syllable's color, aligned at the top-left and growing downwards toward the centre for multi-octave leaps.
- **`_` / `__`**: Shift pitch down by 1 or 2 octaves (`"So_"`, `"Me__"`). Renders a directional triangle pointing DOWN (`▼`) prefixed to the left of the syllable glyph in the syllable's color, aligned at the bottom-left and growing upwards toward the centre for multi-octave leaps.
- **Centroid Stability**: The syllable's $(0, 0)$ horizontal centroid and metric grid alignment are strictly preserved.
- **Inline Spacing**: Tokens can be written space-separated in a single string (e.g. `melody: ["Do Mi", "So Do^"]`).

### Melody Repetitions & Lookback Notation
- **Integer Repeat (`X`)**: Repeats the preceding token $X$ times:
  ```yaml
  melody: [Do, 3, Mi, So] # Expands to: [Do, Do, Do, Do, Mi, So]
  ```
- **Window Lookback Repeat (`X.Y`)**: Repeats the preceding $Y$ tokens $X$ times:
  ```yaml
  melody: [Do, Re, Mi, 2.3] # Repeats last 3 tokens twice -> [Do, Re, Mi, Do, Re, Mi, Do, Re, Mi]
  ```

### Polyphonic & Multi-Voice Melody Coils
Coils support polyphonic voices either as arrays of voice arrays or voice objects:
```yaml
melody:
  - [Do, Mi, So]     # Voice 1 (Primary)
  - [So_, Do, Mi]    # Voice 2 (Counter-melody)
```

---

## Flexible Layer Composition & Default Expansions

You can start composing from any primary layer (**Melody**, **Harmony**, or **Rhythm**). Unspecified layers are automatically expanded:

| Starting Layer(s) | Melody Resolution | Harmony Resolution | Rhythm Resolution |
| :--- | :--- | :--- | :--- |
| **Melody only** | Explicit pitch sequence | Defaults to tonic (`['Do']`) | 1 downbeat beat per onset (quarter note) |
| **Melody + Rhythm** | Mapped to non-rest rhythm onsets | Defaults to tonic (`['Do']`) | Defined rhythm timeline |
| **Melody + Harmony** | Explicit pitch sequence | Stretched or indexed across melody | 1 downbeat beat per onset |
| **Harmony only** | Root of each harmony chord | Explicit chord progression | Strong downbeat lasting the pulse cycle (e.g. 4 beats for `DoLa`, 3 for `DoRe`), or harmony's own `rhythm` |
| **Harmony only (`melody: []`)** | Suppressed / Rests (no implicit melody) | Explicit chord progression | Strong downbeat lasting the pulse cycle, or harmony's own `rhythm` |
| **Rhythm only** | Root of harmony (`Do`) across non-rest onsets | Defaults to tonic (`['Do']`) | Defined rhythm timeline |
| **Rhythm + Harmony (No Melody)** | Root of the active harmony chord at each rhythm onset timestamp | Aligned to pulse cycle (e.g. every 4 beats for `DoLa`) or harmony's own `rhythm` | Defined rhythm timeline (acts as the strumming pattern) |

> [!TIP]
> **Excluding Implicit Melody**: If a coil defines `melody: []` alongside `harmony: [...]`, the implicit melody from the chord roots is suppressed. In parallel/parallelPeriod weaves, this allows using a coil purely as an accompaniment harmony track without creating an extra melody voice.

### Examples

#### 1. Harmony-Only Progression (Defaults to Pulse Cycle Whole Notes)
```yaml
coils:
  intro_chords:
    harmony: [Do, Fa, So, Do] # Each chord lasts 4 beats (under default DoLa pulse)
```

#### 2. Harmony-Only Accompaniment Track (No Implicit Melody)
```yaml
coils:
  changes:
    melody: []                # Explicitly empty: suppresses root melody in score/staff
    harmony: [Do, Fa, So, Do]
```

#### 2. Rhythm-Only Pattern (Defaults to Tonic Melody & Harmony)
```yaml
coils:
  clapping_rhythm:
    rhythm: [Do, Fi, Dox, Do] # Melody is Do on active onsets
```

#### 3. Rhythm + Harmony (Strumming Pattern with Chord Changes)
```yaml
coils:
  guitar_strum:
    rhythm: [Do, Fi, 7.2] # 16 eighth notes (8 beats total)
    harmony: [Do, Fa]     # Do for beats 0..4, Fa for beats 4..8; melody plays chord roots
```

---

## Rhythmic Grammar Layer (`coil.rhythm`)

PPT features a **cyclic Solfège rhythmic grammar** that subdivides beats (where 1 beat = quarter note = 1.0) into 12 equal chromatic sub-beat divisions and fractional micro-rhythms:

### 1. Sub-Beat Chromatic Divisions

| Syllable | Fractional Offset | Decimal | Metric / Subdivision Role |
| :--- | :--- | :--- | :--- |
| **`Do`** | $0 / 12$ | $0.0$ | **Downbeat** / on the beat |
| **`Ra`** / `Di` | $1 / 12$ | $\approx 0.083$ | 12-EDO / Dodecaplet subdivision |
| **`Re`** | $2 / 12 = 1/6$ | $\approx 0.167$ | 1st sextuplet offbeat |
| **`Me`** / `Ri` | $3 / 12 = 1/4$ | $0.25$ | **16th note** (1st sixteenth / "e") |
| **`Mi`** | $4 / 12 = 1/3$ | $\approx 0.333$ | **Triplet** (1st triplet offbeat) |
| **`Fa`** / `Se` | $5 / 12$ | $\approx 0.417$ | 5/12 subdivision |
| **`Fi`** | $6 / 12 = 1/2$ | $0.5$ | **8th note offbeat** (upbeat / "and") |
| **`So`** / `Si` | $7 / 12$ | $\approx 0.583$ | 7/12 subdivision |
| **`Le`** | $8 / 12 = 2/3$ | $\approx 0.667$ | **Triplet** (2nd triplet offbeat) |
| **`La`** / `Li` | $9 / 12 = 3/4$ | $0.75$ | **16th note** (3rd sixteenth / "a") |
| **`Te`** | $10 / 12 = 5/6$ | $\approx 0.833$ | 2nd sextuplet offbeat |
| **`Ti`** | $11 / 12$ | $\approx 0.917$ | 11/12 subdivision |

### 2. Recursive Compound Suffixes
Suffix syllables recursively subdivide the remaining duration between the current offset and the next downbeat boundary (1.0):
- **`LeFi`**: Starts at $Le = 8/12 = 2/3$. Suffix $Fi$ ($1/2$) subdivides the remaining $1/3$, producing $2/3 + 1/6 = 5/6$ (sextuplet offset).
- **`MeFi`**: Starts at $Me = 3/12 = 1/4$. Suffix $Fi$ ($1/2$) subdivides the remaining $3/4$, producing $1/4 + 3/8 = 5/8$.

### 3. Downbeat Skips, Delays, and Standalone Rest Padding (`Dox`)
- **`Dox` (standalone token)**: Represents a full-beat downbeat rest (1.0 beat) that occupies rhythmic timeline space without consuming notes from the melody or harmony arrays. Can be repeated via repeat multipliers:
  ```yaml
  rhythm: [Dox, 3, Do, Fi] # 4 beats of downbeat rest padding, followed by 8th notes on beat 5
  ```
- **`Dox` Prefix**: Delays an onset by one or more downbeats before sounding:
  - `DoxDo`: 1 downbeat skip + on the beat (lands on beat 2).
  - `DoxFi`: 1 downbeat skip + 8th offbeat (lands at beat 1.5).
  - `DoxDoxDo`: 2 downbeat skips (lands on beat 3).

---

## Metric Grammar & Pulse Layer (`pulse`, `showPulseCoil`, `timeSignature`)

While `coil.rhythm` defines micro-rhythmic onsets, **Metric Grammar** defines the macro rhythmic pulse and cadential shapes (analogous to traditional time signatures). Metric grammar is declared using the `pulse` property at Knot, Weave, and Coil levels:

### 1. Solfège Metric Cadential Chains & Token Arrays

Metric grammar is specified exclusively via Solfège cadential chains or Solfège token arrays:
- **Single Cadential Blocks**:
  - $N=1$: `Dox`
  - $N=2$ (`DoSo`): `Dox – So`
  - $N=3$ (`DoRe`): `Dox – Re – So`
  - $N=4$ (`DoLa`): `Dox – La – Re – So`
  - $N=5$ (`DoMi`): `Dox – Mi – La – Re – So`
  - $N=6$ (`DoSi`): `Dox – Si – Mi – La – Re – So`
  - $N=7$ (`DoFi`): `Dox – Fi – Si – Mi – La – Re – So`
  - $N=8$ (`DoRa`): `Dox – Ra – Fi – Si – Mi – La – Re – So`
- **Compound Metric Chains**:
  - `DoLaDiLa` (4/4 compound): `Dox` (primary) – `La` (weak) – `Dix` (secondary) – `So` (weak)
  - `DoReDiRe` (6/8 compound): `Dox` (primary) – `Re` (weak) – `So` (weak) – `Dix` (secondary) – `Re` (weak) – `So` (weak)
  - `DoReDiSo` (5/8, $3+2$): `Dox` – `Re` – `So` – `Dix` – `So`
  - `DoSoDiRe` (5/8, $2+3$): `Dox` – `So` – `Dix` – `Re` – `So`
- **Explicit Array Definitions**:
  - `pulse: [Dox, Re, So]` or `pulse: [Dox, Mi, La, Re, So]`
- **Pickup Measure Alignment & Mid-Score Pulse Changes**:
  - Any initial coils that do not match the full extent of the pulse definition are automatically treated as pick-up measures aligning to the tail beats of the pulse pattern.
  - Consecutive coils continue the pulse phase seamlessly.
  - Mid-score pulse changes reset downbeat tracking to `Dox` at the point of change.

### 2. Pulse Layer (`P` Clef / `showPulseCoil`)
The Pulse layer renders the macro metric pulses across the timeline on a dedicated row-band staff with `P` clef.

### 3. Rhythm Grid Weights & Geometric Symbol Annotations
- **Traditional Time Signature on Staff (`showTimeSignature: true` / `timeSignature` / `show: [timeSignature]`)**: Emits standard `\time <sig>` (e.g. `\time 4/4` or `\time 3/4`) on the traditional notation staves (`melodyVoice`, `harmonyVoice`).
- **PPT Pulse Signature in Header (`showPulseSignature: true` / `pulseSignature` / `show: [pulseSignature]`)**: Displays the PPT metric pulse chain declaration next to the key anchor (`[Do Glyph] = C  •  DoLa`).
- **Strong Beat Weighting (`strongBeatGridWeight: true`)**: Uses a subtly darker dashed gridline (`gray65`) on primary (`Do`/`Dox`) and secondary (`Di`/`Dix`) beats, while weak beats use lighter dashed lines (`gray85`). Same style and thickness as regular grid lines — just slightly darker for visual distinction without being distracting.
- **Geometric Symbol Annotations (`gridSymbols: true | 'no-do' | 'all'`)**: Annotates onset columns with light chromatic geometric PPT notehead shapes (Circle for `Do`, Cross for `Fi`, Triangles for `Me`/`La`/`Mi`/`Le`, Squares/Diamonds for `Re`/`Te`, etc.) positioned at the top and bottom of the coil system. When coils are hidden, symbols are rendered in a dedicated compact transparent staff between melody and harmony with duration noteheads that drive full horizontal note spacing and provide clean vertical clearance.
- **Exclude Do Circle (`excludeGridDoSymbol: true` / `gridSymbols: 'no-do'`)**: Suppresses the circle symbol on `Do` downbeats since the solid vertical grid line already marks the downbeat.

### 4. Timeline Resolution & Automatic Beat Advancement
The timeline engine automatically advances beats when:
1. An onset starts on **`Do`** (the downbeat).
2. A **`Dox`** prefix specifies one or more beat skips.
3. A subdivision offset is less than or equal to the preceding offset within the same beat (e.g. `[Fi, Fi]` or `[La, Me]` triggers beat advancement on the second token).

### 5. Rhythm Repetitions & Target Extension
- **Repeats (`X` and `X.Y`)**: Rhythmic patterns support integer repeats (e.g. `[Do, 3]`) and lookbacks (e.g. `[Do, Fi, 3.2]`).
- **Target Expansion**: If the melody has more onsets than the declared rhythm array, the final rhythm token is automatically sustained across the remaining melody onsets.

---

## Harmony Layer (`coil.harmony`)

Harmony chords are automatically voiced into tertian triads/sevenths and adapted to the active clef register.

### Supported Chord Qualities

| Token | Chord Name | Harmonic Formula | Example ($Do = \text{C}$) |
| :--- | :--- | :--- | :--- |
| `Do` | Major Triad | $1 - 3 - 5$ | C major (`C - E - G`) |
| `DoSo` | 5th Power Chord | $1 - 5$ (no 3rd) | C5 (`C - G`) |
| `DoMe` / `DoRi` | Minor Triad | $1 - \flat 3 - 5$ | C minor (`C - Eb - G`) |
| `DoTe` / `SoTe` | Dominant 7th | $1 - 3 - 5 - \flat 7$ | C7 (`C - E - G - Bb`) / G7 |
| `DoTi` / `FaTi` | Major 7th | $1 - 3 - 5 - 7$ | Cmaj7 (`C - E - G - B`) |
| `DoMeTe` / `DoRiLi` | Minor 7th | $1 - \flat 3 - 5 - \flat 7$ | C minor 7th (`C - Eb - G - Bb`) |
| `DoMeTi` | Minor-Major 7th | $1 - \flat 3 - 5 - 7$ | Cm(maj7) (`C - Eb - G - B`) |
| `DoFi` / `DoMeFi` | Diminished Triad | $1 - \flat 3 - \flat 5$ | C dim (`C - Eb - Gb`) |
| `TiMeFiLa` / `DoMeFiLa` | Diminished 7th | $1 - \flat 3 - \flat 5 - \flat\flat 7$ | Edim7 (`E - G - Bb - Db`) / Cdim7 |
| `DoMeFiTe` / `DoFiTe` | Half-Diminished 7th | $1 - \flat 3 - \flat 5 - \flat 7$ | Cm7b5 (`C - Eb - Gb - Bb` / Cø7) |
| `DoSi` / `DoLe` | Augmented Triad | $1 - 3 - \sharp 5$ | C aug (`C - E - G#`) |
| `DoFa` | Sus4 | $1 - 4 - 5$ | Csus4 (`C - F - G`) |
| `DoRe` | Sus2 | $1 - 2 - 5$ | Csus2 (`C - D - G`) |
| `DoFaTe` | 7sus4 | $1 - 4 - 5 - \flat 7$ | C7sus4 (`C - F - G - Bb`) |
| `DoLa` | Major 6th | $1 - 3 - 5 - 6$ | C6 (`C - E - G - A`) |
| `DoMeLa` | Minor 6th | $1 - \flat 3 - 5 - 6$ | Cm6 (`C - Eb - G - A`) |
| `DoTeRe` | Dominant 9th | $1 - 3 - 5 - \flat 7 - 9$ | C9 (`C - E - G - Bb - D`) |
| `DoTiRe` | Major 9th | $1 - 3 - 5 - 7 - 9$ | Cmaj9 (`C - E - G - B - D`) |
| `DoMeTeRe` | Minor 9th | $1 - \flat 3 - 5 - \flat 7 - 9$ | Cm9 (`C - Eb - G - Bb - D`) |
| `DoMiRe` | Add 9 | $1 - 3 - 5 - 9$ | Cadd9 (`C - E - G - D`) |
| `DoTeRa` | 7(b9) | $1 - 3 - 5 - \flat 7 - \flat 9$ | C7(b9) (`C - E - G - Bb - Db`) |
| `DoTeRi` | 7(#9) | $1 - 3 - 5 - \flat 7 - \sharp 9$ | C7(#9) (`C - E - G - Bb - D#`) |
| `DoTeFi` | 7(#11) / 7b5 | $1 - 3 - 5 - \flat 7 - \sharp 11$ | C7(#11) (`C - E - G - Bb - F#`) |
| `DoTiFi` | maj7(#11) | $1 - 3 - 5 - 7 - \sharp 11$ | Cmaj7(#11) (`C - E - G - B - F#`) |
| `DoTeLe` | 7(b13) / 7#5 | $1 - 3 - \sharp 5 - \flat 7$ | C7(b13) (`C - E - G# - Bb`) |
| `DoTeLa` | Dominant 13th | $1 - 3 - 5 - \flat 7 - 9 - 13$ | C13 (`C - E - G - Bb - D - A`) |
| `DoTiLa` | Major 13th | $1 - 3 - 5 - 7 - 9 - 13$ | Cmaj13 (`C - E - G - B - D - A`) |
| `DoMeTeLa` | Minor 13th | $1 - \flat 3 - 5 - \flat 7 - 9 - 13$ | Cm13 (`C - Eb - G - Bb - D - A`) |
| `Do^` / `Do_` | Octave Shift | Transposed $\pm 1$ Octave | `Do` shifted up or down |

---

### Bass Notes, Inversions, and Slash Chords (`${Bass}x${Root}${Modifiers}`)

Prepending an axis-marked Solfège syllable (e.g. `Sox`, `Miex`, `Mex`, `Rex`, `Fax`, `Lax`) explicitly dictates the bass note, enabling seamless chord inversions and slash chord harmonies:

#### 1. Chord Inversions (Chord Tone in Bass)
When the bass syllable is a constituent tone of the chord triad or seventh, the voicing engine automatically inverts the upper structure:
- **`MiexDo` / `MixDo`**: C major with E in the bass (**C/E** — 1st inversion major triad).
- **`MexDoMe`**: C minor with E♭ in the bass (**Cm/E♭** — 1st inversion minor triad).
- **`SoxDo`**: C major with G in the bass (**C/G** — 2nd inversion major triad).
- **`RexSo`**: G major with D in the bass (**G/D** — 2nd inversion major triad).
- **`TexDoTe`**: C dominant 7th with B♭ in the bass (**C7/B♭** — 3rd inversion dominant 7th).

#### 2. Slash Chords (Non-Chord Tone Bass)
When the bass syllable is outside the upper chord structure, the bass note is voiced underneath:
- **`FaxDo`**: C major over F bass (**C/F**).
- **`LaxDo`**: C major over A bass (**C/A** / Am7 sound).
- **`RexDo`**: C major over D bass (**C/D** / D9sus4 sound).

#### 3. Bass Octave Displacements
You can displace the bass pitch register using `_` or `^` before the axis `x`:
- **`So_xDo`**: C/G with the bass note dropped an extra octave.
- **`So^xDo`**: C/G with the bass note raised one octave.

---

### Voicing Styles (`knot.harmonyVoicing`)

Control how the harmony layer realizes chord tokens:

| Voicing Style | Description | Voicing Formula |
| :--- | :--- | :--- |
| `close` *(default)* | Standard compact tertian block chord with inversion/slash bass handling. | Root + 3rd + 5th (+ 7th) |
| `rootless` | Modern jazz piano comping without the root pitch. | 3rd + 5th + 7th + 9th |
| `rootFifth` | Power chords and acoustic dyads. | Root + 5th |
| `shell` | Essential jazz shell chords. | Root + 3rd + 7th |
| `open` | Open spread voicing (1-5-10 or drop-2). | Root + 5th + 10th (3rd + 8ve) |
| `smoothLead` | Parsimonious voice leading minimizing movement across chord changes. | Minimal voice distance search |
| `bassOnly` | Strips upper chord tones, outputting only the root or slash bass note. | Root / Bass pitch |
| `walkingBass` / `octaves` | Doubles root/bass in lower octaves for basslines. | Bass (octave lower) + Bass |

---

### Harmonic Augmentation & Arrangement Projections

- **`melodyAugmentation`**: Harmonizes melody lines automatically under the lead voice:
  - `none`: Single melody line.
  - `thirdsBelow` / `sixthsBelow`: Adds parallel 3rds or 6ths below matching the active harmony.
  - `triadClose`: Thickens melody into a 3-part close block chord.
  - `drop2`: 4-part jazz chord melody with the second voice from the top dropped an octave.
  - `guideToneDyad`: Accompanies melody with active 3rd/7th guide tones.
  - `octaves`: Doubles melody one octave below.
- **`projection`**: High-level arrangement presets combining voicings and augmentations:
  - `chordMelody`, `leadSheet`, `jazzComping`, `acousticFolk`, `bassAndLead`.

---

### Harmony Distribution & Repeats

1. **Integer Repeat Padding**:
   ```yaml
   harmony: [DoMe, 3, SoxDo, 2, Le]
   # DoMe held for 4 beats (1 + 3), SoxDo held for 3 beats (1 + 2), Le for 1 beat
   ```
2. **Lookback Window Repeats (`X.Y`)**:
   ```yaml
   harmony: [Do, SoxDo, 2.2] # Repeats [Do, SoxDo] twice -> [Do, SoxDo, Do, SoxDo, Do, SoxDo]
   ```
3. **Automatic Stretch Mode**: Unpadded chord lists are stretched evenly across the melody length:
   ```yaml
   melody: [Do, Re, Mi, Fa, So, La]  # 6 onsets
   harmony: [Do, SoxDo]             # Do spans onsets 1-3, SoxDo spans onsets 4-6
   ```

---

## Guitar Tablature & Voicings (`TabStaff`)

PPT Engraver features a full-featured guitar fretboard engine and grip solver that renders standard tablature staves directly underneath the traditional harmony staff.

### Enabling Guitar Tablature
Add `guitarTab` (or `tablature` / `tabStaff`) to `knot.engraving.show` or set `showGuitarTab: true`:

```yaml
knot:
  engraving:
    show:
      - melody
      - harmony
      - guitarTab
      - chordNames
    guitarVoicing: chordMelody # melodyOnly | root | triad | shell | chordMelody | auto
    maximumFretSpan: 4         # Hand stretch reach limit (e.g. 3 for smaller hands)
    tabStaffStyle: ppt         # ppt (geometric noteheads behind numbers) | numbersOnly
```

### PPT Shaped Fret Noteheads
In `tabStaffStyle: ppt` (or when `noteheadStyle: ppt`), fret numbers on the `TabStaff` are engraved with PPT chromatic geometric notehead shapes (Circle, Squares, Triangles, Crosses, Diamonds, Half-Circles) drawn behind the numbers with 8-directional contrast outlines and full chromatic coloring.

### Guitar Voicing Options (`guitarVoicing`)
- **`melodyOnly`**: Solves optimal single-note string/fret positions prioritizing lower frets and open strings.
- **`root`** (alias **`bassAndMelody`**): Automatically plays the harmonic bass root note on the beat/onset that the harmony changes, while intermediate melody notes during the sustained chord remain clean single notes.
- **`triad`** (alias **`rootChordTones`**): Adds chord root, 3rd, and 5th tones to form compact playable chord grips on chord changes under the melody.
- **`shell`** (alias **`guideTones`**): Voices melody along with 3rd and 7th guide tones on chord changes.
- **`chordMelody`**: Jazz chord melody projection that voices rich 3-to-4 note Drop-2 chord grips (with melody as the highest sounding note) on chord changes and strong beat downbeats, while keeping passing sub-beat notes single and fluid.
- **`auto`**: Dynamically chooses the richest chord voicing that fits within the configured `maximumFretSpan`.

### Hand Reach Constraints (`maximumFretSpan`)
The grip solver computes physical fret distance across active frets, excluding open strings ($f = 0$). Setting `maximumFretSpan: 3` ensures fingerings are tailored for younger students or smaller hands without requiring wide stretches.

Coils support modular composition through **Layer Injection**, **Priority Parent Inheritance**, and **Concat Composition**:

### 1. Explicit Layer Injection (`harmony: changes`, `rhythm: groove_1`, `from: ...`)
Inject specific layers from named coils directly into another coil, with optional local property overrides:

```yaml
coils:
  changes:
    harmony:
      chords: [ReMe, SoTe, DoTi, FaTi]
      rhythm: [Do, 8, Do, Fi]

  groove:
    rhythm: [Do, Fi, 3.2]

  # Shorthand injection:
  verse_a:
    melody: [Lax, Re, Ra, Fa]
    harmony: changes
    rhythm: groove

  # Structured injection with local overrides & rhythm pairing:
  verse_b:
    melody: [Mix, Me, Re, Do]
    harmony:
      chords: changes       # Or from: changes
      rhythm: [Do, 8, Do, Fi]
      harmonyOctave: -1
      harmonyVoicing: shell

  # Melody injection with dedicated rhythm pairing:
  verse_c:
    melody:
      pitches: motif_1      # Or from: motif_1
      rhythm: [Do, Fi, Do, Fi]

  # Cross-layer extraction:
  bassline:
    melody:
      from: changes.harmony  # Extracts chord roots as melody pitch tokens
```

### 2. Composite Concat Coils (`concat: [...]`)
Stitch sub-coils into a single continuous phrase while applying phrase-level harmony changes or parent templates across the entire concatenated onset stream (supports named string references, `- coil: name`, standard indented inline sub-coils, and raw inline coils):

```yaml
coils:
  verse:
    harmony: changes
    concat:
      - verse_1
      - verse_2
      - coil:
          melody: [Do, Re, Mi, Fa]
          rhythm: [Do, Fi, Do, Fi]
      - verse_4
```

### 3. Priority Parent Inheritance (`parents: [...]`)
1. **Explicit Local Layer**: Defined directly on the coil.
2. **`parents` Array**: Inherited from named coils in order of priority.
3. **`defaultCoil`**: Inherited from the enclosing weave scope.
4. **System Fallback**: Harmony defaults to `[Do]`, rhythm defaults to `[Do]`.

```yaml
tapestry:
  coils:
    verseBase:
      rhythm: [Do, Fi, 3.2]
      harmony: [DoMe, SoxDo]

  weave:
    id: song
    defaultCoil:
      rhythm: [Do, 3]
    stitch:
      - coil:
          id: motif1
          parents: [verseBase]
          melody: [Dox, Me, Re, Do] # Inherits harmony: [DoMe, SoxDo] & rhythm: [Do, Fi, 3.2]
```

### 4. Weave Stitches & Layout Modes (`layout: concatenate | parallel | parallelPeriod`)
Weaves organize musical structures through **`stitch: [...]`** entries containing referenced or inline coils and nested child weaves.

- **`layout: concatenate` (Default / Sequential)**:
  - Stitches are evaluated sequentially in time, one after another across the timeline.
- **`layout: parallel` (Concurrent / Simultaneous)**:
  - Stitches run simultaneously starting at $t = 0$.
  - **Multi-Layer Merging**: Define chord changes and melody in separate coils. The melody/rhythm onsets automatically receive the active chord progression at matching timestamps across the timeline.
  - **Multi-Voice Polyphony**: Stitch multiple melodic coils in parallel. Each voice is assigned an independent voice track (`\voiceOne`, `\voiceTwo`, `M1`, `M2`), producing clean polyphonic LilyPond notation and coil rows.
- **`layout: parallelPeriod` (Period-Matched Polyrhythms)**:
  - Stitches run concurrently and are automatically stretched/scaled to span the **same overall period duration** ($T = \max(D_s)$ or weave `pulse`/`meter`).
  - **Natural-Meter Polyrhythms**: Write each voice in its natural meter or rhythm (e.g. Voice 1 in 3 beats, Voice 2 in 4 beats, Voice 3 in 5 beats). The compiler calculates exact rational time scalings (emitting LilyPond duration fractions like `4*4/3`, `4*5/4`) and aligns polyphonic voices and harmony seamlessly.

```yaml
weaves:
  polyphonic_section:
    layout: parallel
    stitch:
      - coil:
          id: lead
          melody: [Do, Me, So, Do^]
          rhythm: [Do, Fi, Do, Fi, Do, Fi, Do, Fi]
      - coil:
          id: accompaniment
          pulse: Do
          harmony: [Do, Fa, So, Do]

  polyrhythm_section:
    layout: parallelPeriod
    stitch:
      - coil:
          id: triplet_voice
          melody: [Do, Mi, So]
          rhythm: [Do, Do, Do]      # 3 beats (stretched to 4 beats)
      - coil:
          id: four_voice
          melody: [Do, Re, Me, Fa]
          rhythm: [Do, Do, Do, Do]  # 4 beats
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

## PPT Studio Refactoring Tools & Shortcuts

PPT Studio includes a suite of musical transposition modals, structural AST helpers, and keyboard navigation shortcuts:

### Transposition Modals (Command Palette `Ctrl+Shift+P` / `F1`)
- **Transpose Tonic & Mode (Preserve Pitch)**:
  - Shifts the root "Do" anchor across modes non-destructively (e.g. Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian, or custom pitch).
  - Automatically transposes Solfège syllables across `melody:`, `harmony:`, and `pitches:` inversely while updating `knot.tonic` so sounding concert pitch remains invariant.
- **Transpose Rhythmic Period & Optimize Grammar**:
  - Scales beat period length ($2\times, 0.5\times, 4\times, 0.25\times, 1.5\times, 3\times$) to alter downbeat density.
  - **Downbeat & Harmony Phase Alignment**: Automatically detects chord change downbeats from `harmony.rhythm` and applies an optimal phase offset ($\phi$) so pickup bars land on offbeats while primary chord changes align with clean `Do` downbeats.
  - Features an automated **Grammar Optimization Suggester** that analyzes onset timestamps and recommends the period length that minimizes `Dox` delays and compound suffixes (`LeFi`, `MeFi`).
  - Optional tempo compensation to preserve real-time playback duration.

### Contextual MIDI Solfège Typing (`Ctrl+Shift+M`)
PPT Studio supports direct "typing" of Solfège tokens into the CodeMirror editor using connected MIDI keyboards and controllers. Entry is contextual and activates when the editor cursor is located on or inside a Solfège array:
- **Rhythm Layer (`rhythm: [...]`)**: Maps key strikes relative to a universal Rhythm Do reference pitch (default `C4`). Playing Do an octave down (e.g. `C3`) enters `Dox` (beat skip). Single keys enter chromatic rhythm degrees (`Do`, `Ra`, `Re`, `Me`, `Mi`, `Fa`, `Fi`, `So`, `Le`, `La`, `Te`, `Ti`).
- **Harmony Layer (`harmony: [...]` / `chords: [...]`)**: Realizes absolute chord voicings relative to the active knot tonic using an **octave-down confirmation key** ($N_{\min} - 12$). Holding chord tones and striking the root 1 octave down translates the chord against PPT harmonic grammar (e.g. `C4-E4-G4-B4` + `C3` $\to$ `DoTi`, `C4-B4` + `C3` $\to$ `DoTi`, `A4-C5-E5` + `A3` $\to$ `LaMe`, `G4-B4-D5-F5` + `G3` $\to$ `SoTe`, `D4-F4-A4-C5` + `D3` $\to$ `ReMeTe`).
- **Melody Layer (`melody: [...]` / `pitches: [...]`)**: Converts played notes into Solfège based on active Knot tonic. Automatically infers **Interval Mode** (when array starts with axis anchor `x`, e.g. `[Dox, ...]`) vs **Absolute Mode** (default). In interval mode, computes relative signed semitone intervals against the preceding note.
- **Additive & Progressive**: Tokens are inserted cleanly at or after the cursor position, and the cursor advances automatically to the newly added token for seamless continuous playing.
- **Hardware Selection & Toggle**: Toggle with `Ctrl+Shift+M`, the toolbar button, or Command Palette. Select individual MIDI devices or listen to all inputs simultaneously in Settings (⚙).

### Keyboard Shortcuts Reference

| Shortcut | Context | Action |
|---|---|---|
| `Ctrl+Alt+N` / `Alt+N` / `Cmd+Alt+N` | Global | **Create New Tapestry** starter score |
| `Ctrl+O` / `Cmd+O` | Global | **Open Tapestry Score** palette |
| `Ctrl+S` / `Cmd+S` | Global | **Save Tapestry Score** to disk |
| `Ctrl+Shift+E` / `Cmd+Shift+E` | Global | **Export Standalone PDF Score** (saves to `scores/` & downloads) |
| `Ctrl+Enter` / `Cmd+Enter` | Global | **Compile / Recompile** sheet music with LilyPond |
| `Ctrl+Shift+P` / `Cmd+Shift+P` / `F1` | Global | **Command Palette** (search actions, snippets & tools) |
| `Ctrl+G` / `Cmd+G` | Global | **Go to Named Reference / Symbol** palette (`w:`, `c:`, `k:`, `s:`) |
| `?` / Command Palette / ⚙ Settings | Global | **Keyboard Shortcuts Cheat Sheet Modal** |
| `Ctrl+Shift+M` / `Cmd+Shift+M` | Global | **Toggle MIDI Solfège Typing** On / Off |
| `Ctrl+Up` / `Ctrl+Down` | On Solfège note | Transpose active note chromatically (+1 / -1 semitone) |
| `Ctrl+Up` / `Ctrl+Down` | On property line | Navigate cursor to previous / next **property sibling** at same indentation |
| `Ctrl+Alt+Up` / `Ctrl+Alt+Down` | On Solfège note | Shift active note octave (+1 / -1 octave with `^` / `_`) |
| `Ctrl+Alt+Up` / `Ctrl+Alt+Down` | On property block | **Reorder property / array item** up/down within parent boundaries |
| `Ctrl+Left` / `Ctrl+Right` | On Solfège note | Navigate tokens; press `Ctrl+Right` at list end to duplicate syllable |
| `Ctrl+Alt+Enter` | Anywhere in block | **Duplicate property / array item** contextually with auto-incremented ID |
| `Ctrl+Alt+A` | In coil / melody line | Convert Melody between **Interval Mode** and **Absolute Mode** |
| `Ctrl+Alt+P` | In coil | Extract layer into Parent Coil |
| `Ctrl+Alt+C` | In child coil | Extract Inline Coil to Named Coil |
| `Ctrl+Alt+I` | In coil with parents | Inline Parent Coil Properties |
| `Ctrl+Alt+W` | In selection | Group Selection into Weave |
| `F2` | On declared ID | Rename Symbol / ID globally across score |
| `F12` / `Ctrl+Click` | On ID reference | Jump to Symbol Definition |
| `Ctrl+Space` | In editor | Trigger contextual autocomplete & YAML snippets |
| `Ctrl+Q` | On block | Fold / unfold current section |
| `Ctrl+/` | In editor | Toggle line / block comment |
| `Hold Shift` / 🔍 button | On preview | Circular magnifying glass (loupe) inspection tool |

---

## License

MIT © Midlife Muso
