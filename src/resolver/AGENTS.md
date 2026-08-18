# AST Resolvers & Musical Alignment (`src/resolver/`)

## Purpose & Scope

The `src/resolver/` directory resolves high-level declarative PPT constructs into fully qualified, temporal musical events. It processes knots, weaves, coils, inheritance relationships (`parents`), and concat trees.

---

## Key Resolvers

1. **`resolveTapestry()`**:
   - Master orchestrator resolving knots and recursively descending through weave trees.
2. **`resolveCoil()`**:
   - Computes musical alignment across:
     - `melody`: Sequence of Solfège tokens (e.g. `[Do, Re, Mi, Fa, So]`), integer repeats (`X`), and lookback repeat windows (`X.Y` repeating the last `Y` items `X` times).
     - `rhythm`: Rhythmic durations, subdivisions, and `X.Y` lookback repeat tokens.
     - `harmony`: Chords applied across the coil with optional `X.Y` lookback repetitions.
3. **`resolveConcat()`**:
   - Combines multiple sub-coils into a single continuous weave structure, ensuring timing offsets and voice alignment remain continuous.
4. **`resolveInheritance()`**:
   - Merges attributes from parent coils (`parents: [...]`) into child coils, allowing reusable templates (e.g. base rhythm templates inherited by melodic variations).

---

## Output Data Structure: `ResolvedOnset`

Each onset resolved by this subsystem contains:
- `onsetIndex`: 1-based index within the coil.
- `tag`: Tag string matching LilyPond `ppt_${coilId}_${voiceId}_${onsetIndex}`.
- `melodyMidi`: Absolute MIDI pitch number.
- `scaleDegree`: Solfège syllable (e.g. `Do`, `Rex`).
- `chordRoot` & `chordMidi`: Active harmony triad.
- `rhythmToken` & `duration`: Temporal duration value.
- `isRest`: Boolean flag indicating silence.
