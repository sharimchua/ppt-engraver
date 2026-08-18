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

---

## Interval Calculator Rules

- `semitoneIntervalToSolfege(diff)`:
  - Takes an integer semitone difference `(targetMidi - anchorMidi) mod 12`.
  - Maps `0` $\to$ `Do`, `1` $\to$ `Ra`, `2` $\to$ `Re`, `3` $\to$ `Me`, `4` $\to$ `Mi`, `5` $\to$ `Fa`, `6` $\to$ `Fi`, `7` $\to$ `So`, `8` $\to$ `Le`, `9` $\to$ `La`, `10` $\to$ `Te`, `11` $\to$ `Ti`.
  - In `melodyCoilInterval`, the first onset is the anchor formatted with axis (e.g. `Dox`), followed by relative interval tokens.
