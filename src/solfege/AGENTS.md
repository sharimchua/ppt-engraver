# Solfège Pitch, Intervals, & Geometric Glyphs (`src/solfege/`)

## Purpose & Scope

The `src/solfege/` directory defines the mathematical and visual core of Prime Period Theory (PPT):
- Mapping between 12-TET chromatic pitch classes and Solfège syllables.
- Calculating pitch intervals and returning chromatic Solfège tokens.
- Providing geometric glyph specifications (Base, Sharp, Flat) and their rotational orientations.

---

## The 12 Chromatic Solfège Degrees

Each semitone has an assigned glyph geometry, rotation angle, and primary color:

| Semitone | Primary Syllables | Geometric Type | Rotation | Color Hex | Color Name |
|---|---|---|---|---|---|
| `0` | `Do` / `Dox` | `base` | 0° | `#E13610` | Red |
| `1` | `Ra` / `Di` | `sharp` | 0° | `#F98016` | Orange |
| `2` | `Re` / `Rex` | `flat` | 270° | `#F98016` | Orange |
| `3` | `Me` / `Ri` / `Mex` | `base` | 270° | `#F5D432` | Yellow |
| `4` | `Mi` | `sharp` | 270° | `#F5D432` | Yellow |
| `5` | `Fa` / `Se` | `flat` | 180° | `#43A440` | Green |
| `6` | `Fi` | `base` | 180° | `#141414` | Dark / Slate |
| `7` | `So` / `Si` | `sharp` | 180° | `#0032A4` | Blue |
| `8` | `Le` / `Si` | `flat` | 90° | `#5300A4` | Purple |
| `9` | `La` / `Li` | `base` | 90° | `#5300A4` | Indigo |
| `10` | `Te` / `Li` / `Tex` | `sharp` | 90° | `#F158A4` | Pink |
| `11` | `Ti` | `flat` | 0° | `#F158A4` | Pink |

---

## Geometric Glyph Types

- **`base` (Triangle-like symmetry)**:
  - Used for degrees 0 (`Do`), 3 (`Me`), 6 (`Fi`), 9 (`La`).
- **`sharp` (Asymmetric sharp slant)**:
  - Used for degrees 1 (`Ra`), 4 (`Mi`), 7 (`So`), 10 (`Te`).
- **`flat` (Asymmetric flat round)**:
  - Used for degrees 2 (`Re`), 5 (`Fa`), 8 (`Le`), 11 (`Ti`).
- **Axis Diacritic (`x`)**:
  - Appears as a horizontal stroke passing directly through the glyph centroid.
  - The stroke color must dynamically match the syllable's assigned color (e.g. Red for `Dox`, Orange for `Rex`, Yellow for `Mex`, Pink for `Tex`).
- **Octave Displacement Prefix Triangles (`^` / `_`)**:
  - Prefixed directional triangle (pointing UP `▲` for `^` / octave up, pointing DOWN `▼` for `_` / octave down) drawn in the syllable's own chromatic color.
  - Positioned to the left of the syllable glyph without shifting the syllable centroid $(0,0)$.
  - Multi-octave leaps (`^^`, `__`) stack vertically to maintain compact layout.

---

## Interval Calculator Rules

- `semitoneIntervalToSolfege(diff)`:
  - Takes an integer semitone difference `(targetMidi - anchorMidi) mod 12`.
  - Maps `0` $\to$ `Do`, `1` $\to$ `Ra`, `2` $\to$ `Re`, `3` $\to$ `Me`, `4` $\to$ `Mi`, `5` $\to$ `Fa`, `6` $\to$ `Fi`, `7` $\to$ `So`, `8` $\to$ `Le`, `9` $\to$ `La`, `10` $\to$ `Te`, `11` $\to$ `Ti`.
  - In `melodyCoilInterval`, the first onset is the anchor formatted with axis (e.g. `Dox`), followed by relative interval tokens.
- **Base Octave Semitone Mapping (`BASE_OCTAVE_SYLLABLES`)**:
  - Maps signed semitone coordinates in $[-5, +6]$ centered on Do (0): `{-5: 'So', -4: 'Le', -3: 'La', -2: 'Te', -1: 'Ti', 0: 'Do', 1: 'Ra', 2: 'Re', 3: 'Me', 4: 'Mi', 5: 'Fa', 6: 'Fi'}`.
- **Dual Melody Mode Conversions (`pitch.ts`)**:
  - `parseMelodyToken(token)`: Parses rests (`R`), repeats (`2.2`), octave modifiers (`^`, `_`), and axis markers (`x`).

---

## Guitar Fretboard & Grip Solver (`guitar.ts`)

- **Standard Guitar Tuning**: E4 (64, string 1), B3 (59, string 2), G3 (55, string 3), D3 (50, string 4), A2 (45, string 5), E2 (40, string 6).
- **Workable Grips & Fret Distance**:
  - Open strings ($f = 0$) do not add physical hand stretch distance.
  - Span calculation $\text{span} = \max(\text{frets}_{>0}) - \min(\text{frets}_{>0})$ is validated against `maximumFretSpan` (default `4`, customizable for younger students with smaller hands, e.g. `3`).
- **Voicing Modes (`guitarVoicing`)**:
  - `melodyOnly`: Optimal string/fret selection for single-line melody.
  - `root` / `bassAndMelody`: Plays the harmonic bass root note on chord change onsets under melody; single melody notes on intermediate onsets.
  - `triad` / `rootChordTones`: Melody note + root + 3rd/5th chord tones on chord changes.
  - `shell` / `guideTones`: Melody note + 3rd and 7th guide tones on chord changes.
  - `chordMelody`: Jazz chord-melody drop-2 grips on changes and downbeats; clean single melody notes on passing sub-beat notes.
  - `auto`: Richest playable chord grip satisfying hand reach constraints.

  - `semitonesToSolfege(semitones)`: Converts signed semitone offsets from Do into canonical Solfège tokens with octave shifts.
  - `convertIntervalToAbsoluteMelody(tokenList)`: Converts an Interval mode token list into chromatic scale degrees relative to Do.
  - `convertAbsoluteToIntervalMelody(tokenList)`: Converts an Absolute mode scale degree list into an Interval mode sequence anchored on the first pitch with axis `x`.

---

## Harmonic Grammar & Axis Bass Prefix (`${Bass}x${Root}${Modifiers}`)

- **Standard Chords**: Root syllable + optional modifiers:
  - Major Triad: `Do`, `Fa`, `So` ($1-3-5$)
  - Minor Triad: `DoMe`, `DoRi`, `FaMe` ($1-\flat 3-5$)
  - Dominant 7th: `DoTe`, `SoTe` ($1-3-5-\flat 7$)
  - Major 7th: `DoTi`, `FaTi` ($1-3-5-7$)
  - Minor 7th: `DoMeTe`, `DoRiLi` ($1-\flat 3-5-\flat 7$)
  - Minor-Major 7th: `DoMeTi` ($1-\flat 3-5-7$)
  - Diminished Triad: `DoFi`, `DoMeFi`, `TiFi` ($1-\flat 3-\flat 5$)
  - Fully Diminished 7th: `TiMeFiLa`, `TeMeFiLa`, `DoMeFiLa` ($1-\flat 3-\flat 5-\flat\flat 7$)
  - Half-Diminished 7th: `DoMeFiTe`, `DoFiTe`, `TiMeFiTe` ($1-\flat 3-\flat 5-\flat 7$)
  - Augmented Triad: `DoSi`, `DoLe` ($1-3-\sharp 5$)
  - Sus4 / Sus2: `DoFa` ($1-4-5$), `DoRe` ($1-2-5$)
  - 7sus4: `DoFaTe` ($1-4-5-\flat 7$)
  - Major 6th / Minor 6th: `DoLa` ($1-3-5-6$), `DoMeLa` ($1-\flat 3-5-6$)
- **Axis Bass Prefix**: Prepending an axis-marked Solfège syllable (e.g. `Sox`, `Miex`, `Mex`, `Rex`, `Dox`) defines an explicit bass note (inversion or slash chord):
  - `SoxDo`: C major triad with G in the bass (**C/G**).
  - `MiexDo` / `MixDo`: C major triad with E in the bass (**C/E** / 1st inversion).
  - `MexDoMe`: C minor triad with E♭ in the bass (**Cm/E♭** / 1st inversion).
  - `RexSo`: G major triad with D in the bass (**G/D**).
  - `DoxDo`: C major triad with C in the bass (**C/C**).
- **Visual Coil Representation**: In the visual Harmony Coil row, the Axis Bass syllable is rendered with its full geometric glyph and horizontal axis diacritic line preceding the root glyph.
- **Score Notation & Canonical Chord Names**: Lead sheet ChordNames are decoupled from harmony staff voicings, emitting canonical block chords with slash bass (e.g. `<c' e' g'>/g` -> `C/G`), while the 5-line staff reflects selected arrangement voicings.

---

## Arrangement Projections: Voicings & Augmentation

- **`src/solfege/voicings.ts` (`generateChordVoicing`)**:
  - `close`: Default compact tertian chord (major/minor triad, 7th, slash bass).
  - `rootless`: 3rd + 7th + 5th/9th without root (jazz comping).
  - `rootFifth`: Root + 5th power dyad.
  - `shell`: Root + 3rd + 7th or Root + 7th.
  - `open`: 1-5-10 or 1-5-7-10 open spread voicings.
  - `smoothLead`: Parsimonious voice leading minimizing voice distance across chord changes and boundaries.
  - `bassOnly` / `walkingBass`: Bass line projections.
- **`src/solfege/augmentation.ts` (`generateMelodyAugmentation`)**:
  - `none`: Author's original single melody line.
  - `thirdsBelow` / `sixthsBelow`: Harmonizes in 3rds or 6ths below matching active chord.
  - `triadClose`: 3-part close block chord under melody.
  - `drop2`: 4-part jazz chord melody with 2nd voice dropped an octave.
  - `guideToneDyad`: Accompanies melody note with active 3rd/7th guide tone.
  - `octaves`: Doubles melody an octave below.

---

## Pitch/Mode Transposition & Rhythmic Period Optimization

- **Pitch/Mode Transposition (`transposeSolfegeToken`, `transposeHarmonyToken`, `calculateTonicShift`)**:
  - Shifts the root "Do" anchor across modes non-destructively while preserving sounding concert pitches.
  - Correctly shifts absolute solfège tokens, interval anchors (`Dox` $\to$ `Mex`), compound harmony chords (`DoMe` $\to$ `MeMe`), and slash bass prefixes (`SoxDo` $\to$ `TexMe`).
- **Rhythmic Period Scaling & Optimizer (`transposeRhythmTokens`, `analyzeRhythmComplexity`, `suggestOptimalRhythmicPeriod`, `calculateHarmonyPhaseOffset`)**:
  - Scales onset timelines by rational factors ($2\times, 0.5\times, 4\times, 0.25\times, 1.5\times, 3\times$) to alter downbeat density.
  - Supports metric phase shifting (`phaseOffset`) and automatic harmonic downbeat alignment via `calculateHarmonyPhaseOffset` to ensure pickup notes land on offbeat subdivisions while chord changes align with macro downbeats.
  - Evaluates rhythmic grammar complexity (counts of `Dox` delays, compound subdivision suffixes, and sub-beat offbeats) to recommend the optimal beat period length minimizing `Dox` prefixes and complex suffixes.

---

## Metric Grammar Engine & Pulse Timelines (`resolveMetricGrammar`, `resolveMetricPulseTimeline`)

- **Macro Metric Shape / Pulse Layer**:
  - Parallels traditional time signatures by defining macro rhythmic pulse shapes and cadential blocks.
  - Defined exclusively using Solfège cadential chains or Solfège token arrays (e.g. `pulse: [Dox, Re, So]` or `pulse: "DoLa"`).
  - **Single Cadential Blocks**:
    - $N=1$: `Dox` (1 beat)
    - $N=2$ (`DoSo`): `Dox – So` (Circle $\to$ Half Circle Right)
    - $N=3$ (`DoRe`): `Dox – Re – So` (Circle $\to$ Square $\to$ Half Circle Right)
    - $N=4$ (`DoLa`): `Dox – La – Re – So` (Circle $\to$ Triangle Up $\to$ Square $\to$ Half Circle Right)
    - $N=5$ (`DoMi`): `Dox – Mi – La – Re – So`
    - $N=6$ (`DoSi`): `Dox – Si – Mi – La – Re – So`
    - $N=7$ (`DoFi`): `Dox – Fi – Si – Mi – La – Re – So`
    - $N=8$ (`DoRa`): `Dox – Ra – Fi – Si – Mi – La – Re – So`
  - **Compound Metric Chains**:
    - `DoLaDiLa` (4/4 compound): `Dox` (primary) – `La` (weak) – `Dix` (secondary) – `So` (weak)
    - `DoReDiRe` (6/8 compound): `Dox` (primary) – `Re` (weak) – `So` (weak) – `Dix` (secondary) – `Re` (weak) – `So` (weak)
    - `DoReDiSo` (5/8, $3+2$): `Dox` – `Re` – `So` – `Dix` – `So`
    - `DoSoDiRe` (5/8, $2+3$): `Dox` – `So` – `Dix` – `Re` – `So`
  - **Pulse Phase Continuation & Pickup Alignment**:
    - Initial non-full coils align to the tail beats of the pulse definition as pick-up measures.
    - Consecutive coils continue the pulse phase seamlessly.
    - Explicit mid-score pulse overrides reset downbeat tracking to `Dox` at the change point.
  - **Geometric Shape Mappings (`solfegeToGlyphShape`)**:
    - `Do` $\to$ `circle`, `Fi` / `Dix` $\to$ `cross`, `Re` $\to$ `square`, `Me` / `Le` $\to$ `triangleDown`, `Mi` / `La` $\to$ `triangleUp`, `So` $\to$ `halfCircleRight`, `Fa` $\to$ `halfCircleLeft`, `Te` / `Ti` $\to$ `diamond`.



