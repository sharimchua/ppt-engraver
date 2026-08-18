# AST Resolvers & Musical Alignment (`src/resolver/`)

## Purpose & Scope

The `src/resolver/` directory resolves high-level declarative PPT constructs into fully qualified, temporal musical events. It processes knots, weaves, coils, inheritance relationships (`parents`), and concat trees.

---

## Key Resolvers

1. **`resolveTapestry()`**:
   - Master orchestrator resolving knots and recursively descending through weave trees.
2. **`resolveCoil()`**:
   - Computes musical alignment across:
     - `melody`: Sequence of Solfège tokens (e.g. `[Do, Re, Mi, Fa, So]`), structured voice object (`{ pitches: [...], rhythm: [...] }`), or polyphonic array of voices (`[ [...], [...] ]` / `[ { pitches: ... }, ... ]`). Supports integer repeats (`X`) and lookback repeat windows (`X.Y`).
     - `rhythm`: Rhythmic durations, subdivisions, and `X.Y` lookback repeat tokens.
     - `harmony`: Chords applied across the coil (or structured `{ chords: [...], rhythm: [...] }`) with optional `X.Y` lookback repetitions.
3. **`resolveConcat()`**:
   - Combines multiple sub-coils into a single continuous weave structure, ensuring timing offsets and voice alignment remain continuous.
4. **`resolveInheritance()`**:
   - Merges attributes from parent coils (`parents: [...]`) into child coils, allowing reusable templates (e.g. base rhythm templates inherited by melodic variations).

---

## Output Data Structure: `ResolvedOnset`

Each onset resolved by this subsystem contains:
- `onsetIndex`: 1-based index within the voice/coil.
- `voiceIndex`: 1-based voice index for polyphonic coils (1 for primary/single melody, 2+ for counter-voices).
- `tag`: Tag string matching LilyPond `ppt_${weaveId}_${coilId}_${layer}_${onsetIndex}` or `ppt_${weaveId}_${coilId}_${layer}_v${voiceIndex}_${onsetIndex}`.
- `melodyMidi`: Absolute MIDI pitch number.
- `scaleDegree`: Solfège syllable (e.g. `Do`, `Rex`).
- `chordRoot` & `chordMidi`: Active harmony triad.
- `rhythmToken` & `duration`: Temporal duration value.
- `isRest`: Boolean flag indicating silence.
