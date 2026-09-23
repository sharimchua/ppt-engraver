# ABC Music Notation Compiler (`src/abc/`)

## Purpose & Responsibilities

The `src/abc/` directory implements the **Tapestry-to-ABC translation layer** for Prime Period Theory. It translates resolved PPT `OnsetStream` data and Knot arrangements into the standard ABC music notation dialect expected by the **YuE2** white-box symbolic music foundation model ([multimodal-art-projection/YuE](https://github.com/multimodal-art-projection/YuE)).

> [!TIP]
> **Complete Technical Guide**: For an exhaustive overview of the audio architecture, SheetSage2 dialect rules, Mothersuperior LoRA pairing, and hardware instructions, see **[`docs/audio-generation.md`](../../docs/audio-generation.md)**.

---

## Subsystem Structure

```
src/abc/
├── pitch.ts      # Scientific pitch / MIDI note to ABC pitch tokens (C, c, ^F, _b, z)
├── rhythm.ts     # Beat duration calculations, deriveAbcMeter(), meter parsing, and unit-length fraction formatting
└── compiler.ts   # Top-level ABC compiler, lead-sheet chord mapping, V: Vocal / V: Ins interleaving
```

---

## Dialect Specifications for SheetSage2 & YuE2

1. **Header Structure (No Whitespace after Field Tags)**:
   ```abc
   X:1
   T:<Title>
   C:<Composer>
   M:4/4
   L:1/16
   Q:1/4=<Tempo>
   V: InsLead clef=treble name="InsLead Melody" snm="Inst."
   V: Ins clef=treble name="Ins Melody" snm="Inst."
   K:<KeySignature>
   ```
2. **Track Interleaving & SheetSage2 Voice Structure**:
   - **Instrumental Mode**: The lead voice is declared and invoked as `V: InsLead` (`InsLead Melody`), while accompaniment is `V: Ins` (`Ins Melody`). This directly matches the training distribution of the Mothersuperior SheetSage2 dataset and prevents the model from activating vocal singing heads.
   - **Vocal Mode**: If vocal lyrics are supplied (`isInstrumental === false`), the lead voice switches to `V: Vocal` (`Vocal Melody`).
   - **Multi-Measure Rests (`Z`, `Z4`, `Z2`)**: Accompaniment blocks without explicit notes emit standard multi-measure rests `Z${count}|` (e.g. `Z4|`), and whole-measure rests in the lead line emit `Z|`.
   - **Compact Barlines**: Notes and barlines are emitted contiguously without internal spaces (`f4f4f4f4|`, `m1|m2|m3|m4|`), matching SheetSage2 tokenization.
   - **Section Comments**: ABC score blocks are tagged with standard lowercase comments (`% intro`, `% verse`, `% chorus`, `% bridge`, `% outro`).
   - **Timed Tags in Conditioning**: Exact timestamps (`[intro 0:00-0:08]\n[verse 0:08-0:12]\n[outro 0:12-0:14]`) are calculated by `calculateScoreTiming` and passed to the text conditioning/prompt (`--text`), keeping the ABC score purely in the SheetSage2 symbolic dialect while strictly bounding the autoregressive runtime.
3. **Inline Chords**:
   - Harmony changes are embedded in double quotes directly preceding lead noteheads:
     `"Ebmaj7"D_EG_Bd3c"F"G2c2c4|`
   - PPT chromatic Solfège chord tokens (e.g. `Do`, `DoMe`, `DoTe`, `ReMeTe`, `SoxDo`) are automatically mapped to standard lead-sheet chord names (`C`, `Cm`, `C7`, `Dm7`, `C/G`).
4. **Duration & Unit Note Length**:
   - Standard unit note length is `L:1/16` (sixteenth note) for exact integer token durations without fractions.
   - Sixteenth note emits `""` (1 unit), eighth note emits `2`, dotted eighth emits `3`, quarter note emits `4`, half note emits `8`, whole note emits `16`.

---

## Testing & Verification

- Tested comprehensively in `test/abc/compiler.test.ts` covering pitch conversion, meter parsing, duration formatting, lead sheet chord spelling, `calculateScoreTiming`, SheetSage2 compact barlines, multi-measure rests (`Z4|`), and `V: InsLead` instrumental voice routing.
