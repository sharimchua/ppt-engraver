# PPT Score Definitions & Fixtures (`scores/`)

## Purpose & Scope

The `scores/` directory contains declarative YAML score files (`*.ppt.yaml`) defining musical compositions using Prime Period Theory.

---

## PPT YAML Score Anatomy

```yaml
tapestry:
  knot:
    tonic: "C4"               # Base pitch reference
    tempo: 120                # Beats per minute
    engraving:
      title: "Score Title"
      composer: "Composer Name"
      show:                   # Visibility toggles
        - melody
        - melodyCoilInterval
        - melodyCoilAbsolute
        - rhythmCoil
        - harmonyCoil
        - rhythmGrid
  weaves:
    mainSong:
      stitch:
        - coil:
            id: introMotif
            melody: [Do, Re, Mi, Fa, So]
            harmony: [Do]
            rhythm: [Do, Fi, Do, Fi, Do]
```

---

## Key Reference Scores

- `scores/strive.ppt.yaml`: Comprehensive multi-section score demonstrating full PPT voice engraving, interval coils, absolute coils, and complex rhythm grids.
- `scores/cassandra.ppt.yaml`: Demonstrates weave-level tonic modulation (`modulate: Fa` and `modulate: So`) shifting the tonic between G (verse) and C (chorus) with dynamic mid-score key signature emission and re-anchored chord names.
- `scores/design-doc-example.ppt.yaml`: Clean reference score showcasing canonical Tapestry schema features.
