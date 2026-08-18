# AST Resolvers & Musical Alignment (`src/resolver/`)

## Purpose & Scope

The `src/resolver/` directory resolves high-level declarative PPT constructs into fully qualified, temporal musical events. It processes knots, weaves, coils, inheritance relationships (`parents`), and concat trees.

---

## Key Resolvers

1. **`resolveTapestry()`**:
   - Master orchestrator resolving knots and recursively descending through weave trees.
2. **`resolveCoil()`**:
   - Computes musical alignment across:
     - `melody`: Sequence of Solfège tokens (e.g. `[Do, Re, Mi, Fa, So]`), structured voice object (`{ pitches: [...], rhythm: [...] }`), named coil reference (`melody: motif_a` / `melody: { from: 'motif_a' }`), or polyphonic array of voices (`[ [...], [...] ]` / `[ { pitches: ... }, ... ]`). Supports integer repeats (`X`) and lookback repeat windows (`X.Y`).
     - `rhythm`: Rhythmic durations, subdivisions, metric block labels (`DoLa`, `DoSo`), named rhythm coil reference (`rhythm: groove_1` / `rhythm: { from: 'groove_1' }`), and `X.Y` lookback repeat tokens.
     - `harmony`: Chords applied across the coil, structured `{ chords: [...], rhythm: [...] }`, or named coil injection (`harmony: changes` / `harmony: { from: 'changes', harmonyOctave: -1, harmonyVoicing: 'shell' }`) with optional `X.Y` lookback repetitions.
3. **`resolveConcat()` (`resolveConcatCoil()`)**:
   - Combines multiple sub-coils into a single continuous weave structure, ensuring timing offsets and voice alignment remain continuous.
   - Fully inherits and resolves composite-level layers (such as phrase-wide harmony changes or augmentation) via `inheritCoilLayers()`, allowing `concat` coils to use `harmony: changes` or `parents: changes`.
4. **`resolveInheritance()` (`inheritCoilLayers()`) & Layer Injection**:
   - Explicit Layer Injection: Directly injects specific layers from other coils (`harmony: changes`, `rhythm: { from: 'groove_1' }`, cross-layer `melody: { from: 'changes.harmony' }`) with local property overrides.
   - Priority Parent Inheritance: Merges attributes from parent coils (`parents: [...]`) into child coils, allowing reusable templates (e.g. base rhythm templates inherited by melodic variations).

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
