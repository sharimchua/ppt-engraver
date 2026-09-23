# YuE2 Symbolic Audio Generation & ABC Compiler (Experimental)

> [!NOTE]
> **Status: Experimental Subsystem**  
> The audio generation pipeline in `ppt-engraver` is an active experimental integration connecting Prime Period Theory (PPT) symbolic compositions with the **YuE2** white-box symbolic music foundation model and **SheetSage2** ABC dialect. While functional and capable of producing full band arrangements and backing tracks, the underlying models, quantizations, and inference engines (`audio.cpp`) are undergoing rapid upstream development.

---

## Table of Contents

1. [Overview & Concept](#overview--concept)
2. [Architecture & Pipeline Workflow](#architecture--pipeline-workflow)
3. [The ABC Generation Approach](#the-abc-generation-approach)
   - [SheetSage2 Dialect Alignment](#sheetsage2-dialect-alignment)
   - [Lead Voice Routing: `V: InsLead` vs `V: Vocal`](#lead-voice-routing-v-inslead-vs-v-vocal)
   - [Accompaniment & Multi-Measure Rests (`Z4|`)](#accompaniment--multi-measure-rests-z4)
   - [Alternative Time Signatures & Solfège Pulse Grammar](#alternative-time-signatures--solfège-pulse-grammar)
   - [Lead-Sheet Harmony Spelling](#lead-sheet-harmony-spelling)
   - [Timed Section Tags & Score Runtime Bounding](#timed-section-tags--score-runtime-bounding)
4. [Models & LoRAs Used](#models--loras-used)
   - [YuE2-3B Foundation Model](#yue2-3b-foundation-model)
   - [Mothersuperior Section-Plan LoRA](#mothersuperior-section-plan-lora)
   - [Quantization Tiers (`audio.cpp` GGUF vs PyTorch)](#quantization-tiers-audiocpp-gguf-vs-pytorch)
   - [Neural Audio Decoders / VAE](#neural-audio-decoders--vae)
5. [Installation & Setup](#installation--setup)
   - [Prerequisites](#prerequisites)
   - [Step 1: Node.js Dependencies](#step-1-nodejs-dependencies)
   - [Step 2: Python Backend Environment](#step-2-python-backend-environment)
   - [Step 3: `audio.cpp` Native Binaries](#step-3-audiocpp-native-binaries)
   - [Step 4: Model Downloads](#step-4-model-downloads)
6. [Using Audio Generation in PPT Studio](#using-audio-generation-in-ppt-studio)
   - [Instrumental Templates & Fullness Categories](#instrumental-templates--fullness-categories)
   - [Quick Prompt Tag Chips](#quick-prompt-tag-chips)
   - [Interim Pipeline Artifacts & Diagnostics](#interim-pipeline-artifacts--diagnostics)
7. [CLI Compilation & Export](#cli-compilation--export)

---

## Overview & Concept

Traditional symbolic music software converts note streams into MIDI or sends them to mechanical soundfont synthesizers. While precise, soundfonts lack expressive human dynamics, authentic room acoustics, and rich band interaction.

**YuE2** ([multimodal-art-projection/YuE](https://github.com/multimodal-art-projection/YuE)) is a 3-billion-parameter foundation model trained to generate full-fidelity 48kHz audio from symbolic music notation (ABC notation) paired with natural language style descriptions and lyrics.

In `ppt-engraver`, this subsystem acts as an automated compiler and bridge:
1. **PPT AST & Geometry**: Authors write expressive geometric Solfège motifs, rhythms, and harmony coils in `.ppt.yaml`.
2. **Deterministic Translation**: The compiler resolves these into an onset stream, derives musical timing, maps Solfège chords to lead-sheet harmony, and formats an authentic **SheetSage2 ABC score**.
3. **Conditioned Synthesis**: The audio backend invokes a local GPU-accelerated language model and VAE vocoder to synthesize an acoustic performance matching the tempo, time signature, and chord progression.

```
┌─────────────────────────┐
│   Score (.ppt.yaml)     │  Tapestry, Knots, Weaves, Coils
└────────────┬────────────┘
             │ PPT Resolver (src/resolver/)
             ▼
┌─────────────────────────┐
│   OnsetStream & Knot    │  Deterministic beat offsets, pitches, chords
└────────────┬────────────┘
             │ ABC Compiler (src/abc/)
             ▼
┌─────────────────────────┐
│     SheetSage2 ABC      │  V: InsLead, V: Ins, M:3/4, inline chords
└────────────┬────────────┘
             │ + Timed tags ([intro 0:00-0:08]), prompt, tempo
             ▼
┌─────────────────────────┐
│  audio-backend (Python) │  FastAPI daemon (http://127.0.0.1:8000)
└────────────┬────────────┘
             │
             ├──► Tier 2: audio.cpp CLI (GGUF Q8_0 / Q4_0 + LoRA)
             ├──► Tier 1: PyTorch Native BF16
             └──► Tier 0: Mock Procedural Preview
             ▼
┌─────────────────────────┐
│   48kHz Stereo Audio    │  WAV playback, interim diagnostics, download
└─────────────────────────┘
```

---

## Architecture & Pipeline Workflow

The audio subsystem consists of three coordinated layers:

1. **Core TypeScript Library (`src/abc/`)**:
   - `pitch.ts`: Maps scientific pitches (`C4`, `Eb5`, `F#3`) and MIDI notes to standard ABC pitch tokens (`C`, `_e`, `^F,`, `z`).
   - `rhythm.ts`: Converts beat durations to ABC unit length fractions (`L:1/16`), parses time signatures, and resolves PPT Solfège metric pulse grammars.
   - `compiler.ts`: Assembles header metadata, handles voice interleaving (`V: InsLead`, `V: Ins`), places lead-sheet chords (`"Ebmaj7"`), and calculates score runtime (`calculateScoreTiming`).

2. **Web Studio Integration (`studio/`)**:
   - `studio/server.ts`: Node.js server exposing REST endpoints (`/api/compile`, `/api/export-abc`, `/api/audio/generate`, `/api/audio/jobs/:id`, `/api/audio/file/:filename`). Spawns and manages the Python daemon automatically when launched with `--with-audio`.
   - `studio/public/js/preview/audio-panel.js`: Interactive client panel managing style presets, prompt tag chips, timing synchronization, live terminal logging, audio playback, and interim pipeline diagnostics tabs.

3. **Python Audio Backend (`audio-backend/`)**:
   - `main.py`: Lightweight FastAPI daemon reporting GPU VRAM status, downloading model weights from Hugging Face with chunked streaming, and managing background generation queues.
   - `engines/gguf_engine.py`: Invokes the high-performance C++ `audio.cpp` binary (`audiocpp_cli.exe`), streaming real-time decoding metrics back to the web client.
   - `engines/pytorch_engine.py`: Native BF16 PyTorch inference fallback for workstations with 24GB+ VRAM.
   - `engines/mock_engine.py`: Instant development preview synthesizing procedural test audio without GPU requirements.

---

## The ABC Generation Approach

Generating ABC notation for modern generative models requires strict adherence to their training distribution. Naive ABC output often causes the model to hallucinate vocals, repeat motifs endlessly, or fail to follow chord progressions.

### SheetSage2 Dialect Alignment

The **SheetSage2** model (used to generate symbolic training datasets for YuE2) enforces specific syntax conventions. The PPT ABC compiler strictly follows this dialect:

1. **Unit Note Length `L:1/16`**:
   - Sixteenth-note base quantization ensures all common note values are whole positive integers (`""` = 1, `2` = eighth, `4` = quarter, `8` = half, `12` = dotted half, `16` = whole).
   - Fractions (`/2`, `/4`) are only used for 32nd notes or tuplets.
2. **Compact Barlines (No Internal Whitespace)**:
   - Tokens within a measure are concatenated without internal whitespace:
     ```abc
     "Ebmaj7"D_EG_Bd3c"F"G2c2c4|"Ebmaj7"D_EG_Bd3c"F"G2c2c4|
     ```
   - This ensures the BPE tokenizer treats the phrase as a continuous musical unit rather than broken fragments.
3. **Clean Lowercase Section Comments**:
   - Emits `% intro`, `% verse`, `% chorus`, `% bridge`, `% outro` preceding each system block.

### Lead Voice Routing: `V: InsLead` vs `V: Vocal`

YuE2's autoregressive architecture conditions on voice names:
- **`V: Vocal`**: Directly activates the model's vocal singing synthesis head. If `V: Vocal` is emitted on an instrumental track, the model attempts to synthesize singing or phonemic vocalizations over the melody.
- **`V: InsLead`**: In the SheetSage2 / Mothersuperior training corpus, instrumental lead lines are always designated as:
  ```abc
  V: InsLead clef=treble name="InsLead Melody" snm="Inst."
  ```
- **Automatic Discrimination (`isSectionPlanOnly`)**:
  - The compiler checks whether lyrics contain actual sung words or only bracketed structural tags (e.g. `[intro 0:00-0:08]\n[verse 0:08-0:12]`).
  - If no singing words are present, it guarantees `isInstrumental = true`, emitting `V: InsLead` and prepending negative prompt tags (`instrumental, no vocals, no singing`).
  - When actual lyrics are written, it emits `V: Vocal`.

### Accompaniment & Multi-Measure Rests (`Z4|`)

In dual-voice mode (`V: InsLead` + `V: Ins`):
- When no explicit accompaniment notes are present in `V: Ins`, the compiler emits authentic multi-measure rests:
  ```abc
  V: Ins
  Z4|
  ```
- Dummy rests with chord symbols (e.g. `"C"z8 "G"z8|`) confuse the autoregressive decoder. Chord symbols are instead embedded directly into the lead line (`V: InsLead`), while accompaniment rests cleanly as `Z4|` (or `Z2|`, `Z|`).

### Alternative Time Signatures & Solfège Pulse Grammar

Scores in Prime Period Theory define meter using **chromatic Solfège pulse grammar** or traditional meter signatures. The ABC compiler uses `deriveAbcMeter()` to translate Solfège pulses to exact time signatures and measure beat lengths:

| Pulse Specification | Derived Time Signature (`M:`) | Quarter Beats / Bar | 16th Units / Bar | Typical Genre / Usage |
|---|---|---|---|---|
| `DoRe` | `3/4` | 3.0 | 12 | Waltz, Ballad (e.g. *Itsumo Nandodemo*) |
| `DoSo` | `2/4` | 2.0 | 8 | March, Polka |
| `DoLa` | `4/4` | 4.0 | 16 | Common Time, Pop, Rock, Funk |
| `DoMi` | `5/4` | 5.0 | 20 | Asymmetric Odd Meter (*Take Five*) |
| `DoSi` / `DoReDiRe` | `6/8` | 3.0 | 12 | Compound Duple Swing, Irish Jig |
| `DoReDiSo` / `DoSoDiRe` | `5/4` (3+2 / 2+3) | 5.0 | 20 | Complex Asymmetric Pulse |
| `DoFi` | `7/4` | 7.0 | 28 | Progressive Rock, Complex Cadence |
| `[Dox, Re, So]` | `3/4` | 3.0 | 12 | Explicit Pulse Array |

Measures and barlines slice precisely at the derived measure duration (e.g. 12 sixteenth units for 3/4 time), ensuring accompaniment rests and melody lines never cross barline boundaries unintentionally.

### Lead-Sheet Harmony Spelling

PPT Solfège chord tokens are dynamically parsed and realized into standard lead-sheet chord annotations anchored to the knot's concert pitch root:
- `Do` $\to$ `C` (when Do is C4)
- `DoMe` $\to$ `Cm`
- `DoTe` $\to$ `C7`
- `DoTi` $\to$ `Cmaj7`
- `ReMeTe` $\to$ `Dm7`
- `SoTe` $\to$ `G7`
- `LaMeTe` $\to$ `Am7`
- `SoxDo` $\to$ `C/G` (Slash chord / Inversion with Axis Bass)
- Modulated weaves (`modulate: Fa`) transpose chords relative to the active harmonic center automatically.

### Timed Section Tags & Score Runtime Bounding

Autoregressive audio generation models often struggle with loop termination: if an unconstrained score is fed to the model, it may repeat the final phrase or vamp indefinitely.

To prevent this:
1. `calculateScoreTiming()` computes exact measure and section timestamps from the tapestry tempo (BPM) and beat values:
   ```
   [intro 0:00-0:08]
   [verse 0:08-0:16]
   [outro 0:16-0:18]
   ```
2. A 2-second outro buffer is appended to allow natural acoustic cymbal and reverb decay.
3. These timed tags are passed to the **text conditioning prompt** (`--text`), while `--duration-seconds` sets a hard runtime boundary for the generation loop.

---

## Models & LoRAs Used

### YuE2-3B Foundation Model
- **Developer**: Multimodal Art Projection (M-A-P).
- **Parameters**: ~3 Billion.
- **Capabilities**: Dual-track symbolic conditioning (melody + accompaniment), prompt style conditioning, 48kHz stereo generation via dual-stage autoregression and diffusion.

### Mothersuperior Section-Plan LoRA
- **Repository**: [`Mothersuperior/YuE2-instrumental-cot-full-loras`](https://huggingface.co/Mothersuperior/YuE2-instrumental-cot-full-loras)
- **File**: `ar_lora_inst_v3abc.bf16.safetensors` (Rank 64, 196 weight matrices across 28 attention layers).
- **Benefit**: Trained exclusively on SheetSage2 ABC notation for instrumental music. It significantly reduces vocal mumbling, enforces strict adherence to section boundaries, and allows the band's rhythm section to follow the written harmonic progression.
- **Model ID in PPT**: `yue2-3b-gguf-q8-instrumental`.

### Quantization Tiers (`audio.cpp` GGUF vs PyTorch)

| Model ID | Engine | Quantization | Size | VRAM Req. | Speed (RTF) | Description |
|---|---|---|---|---|---|---|
| `yue2-3b-gguf-q8-instrumental` *(Recommended)* | `gguf` (`audio.cpp`) | Q8_0 + LoRA | 4.26 GB | ~12 GB | ~0.3 - 0.6× | High-precision 8-bit quantization pre-merged with the Mothersuperior Instrumental LoRA. Best balance of rhythm fidelity and quality. |
| `yue2-3b-gguf-q8` | `gguf` (`audio.cpp`) | Q8_0 | 4.26 GB | ~12 GB | ~0.3 - 0.6× | Base foundation model in 8-bit precision. |
| `yue2-3b-gguf-q4` | `gguf` (`audio.cpp`) | Q4_0 | 2.66 GB | ~8 GB | ~0.2 - 0.4× | Lightweight 4-bit quantization running on consumer GPUs (RTX 3060/4060) or CPU. |
| `yue2-3b-pytorch` | `pytorch` | BF16 Full | 15.0 GB | ~24 GB | ~0.8 - 1.2× | Unquantized full precision model requiring RTX 3090 / 4090. |
| `mock` | `mock` | Procedural | 0 MB | None | Instant | Mock audio generator for development and testing without GPU hardware. |

### Neural Audio Decoders / VAE
- **GGUF Engine (`audio.cpp`)**: Requires `yue2-vae-f16.gguf` (265 MB), downloaded automatically to `~/.cache/ppt-engraver/models/yue2-vae-gguf/`.
- **PyTorch Engine**: Requires `m-a-p/xcodec_mini_infer` (2.1 GB).

---

## Installation & Setup

### Prerequisites
- **Operating System**: Windows 10/11, Linux (Ubuntu 22.04+), or macOS (Apple Silicon).
- **Node.js**: v18.0.0 or higher.
- **Python**: 3.10, 3.11, or 3.12 (with `pip` and `venv`).
- **NVIDIA GPU**: Recommended 8GB+ VRAM with CUDA 12.x drivers installed. (CPU execution is supported in GGUF mode but slower).

### Step 1: Node.js Dependencies

```bash
cd ppt-engraver
npm install
npm run build
```

### Step 2: Python Backend Environment

Create a virtual environment for the audio subsystem and install dependencies:

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1

# Linux / macOS:
source .venv/bin/activate

# Install requirements
pip install -r audio-backend/requirements.txt
```

### Step 3: `audio.cpp` Native Binaries

For Tier 2 GGUF execution, obtain the latest `audio.cpp` binary build supporting YuE2:
1. Download the latest automated release from the **`dev`** branch:  
   [GitHub Actions `audio.cpp` Releases (dev branch)](https://github.com/0xShug0/audio.cpp/actions/workflows/release.yml?query=branch%3Adev)
2. Extract the archive and place the files into `audio-backend/bin/`:
   ```
   audio-backend/bin/
   ├── audiocpp_cli.exe
   ├── cublas64_12.dll
   ├── cublasLt64_12.dll
   └── ...
   ```

### Step 4: Model Downloads

You can download models directly inside the PPT Studio interface:
1. Start Studio with the audio backend:
   ```bash
   npm run studio:audio
   ```
2. In PPT Studio, open **Settings (⚙) -> Audio Generation (YuE)**.
3. Click **⬇ Download** next to `yue2-3b-gguf-q8-instrumental` and `yue2-vae-gguf`.
4. Progress and download speeds stream in real time. Model files are saved in `~/.cache/ppt-engraver/models/`.

---

## Using Audio Generation in PPT Studio

1. Open **PPT Studio** (`http://localhost:3333`) and load any score (e.g. `scores/itsumo_nandodemo.ppt.yaml` or `scores/strive.ppt.yaml`).
2. Switch to the **Audio Preview** tab in the right-hand panel.
3. The **Active Knot** indicator shows the selected projection (e.g. `perform`, `base`, `leadSheet`).

### Instrumental Templates & Fullness Categories

The **Template** dropdown offers ready-to-use arrangements designed to back up the melody motif with a complete band rhythm section:

* **Full Band Rhythm Section Backing**:
  * **Funk Fusion**: Punchy slap bass, synchronized drums, comping Rhodes piano, expressive synth lead (`cot="full"`).
  * **Rock Band**: Driving modern rock rhythm section, punchy drum kit, driving electric bassline, comping rhythm guitars, singing lead guitar.
  * **Neo-Soul Groove**: Pocket drums, deep fingerstyle electric bass, warm Rhodes chords, melodic guitar lead.
  * **Jazz Quartet**: Driving acoustic drums, walking upright bass, comping piano, tenor saxophone lead.
  * **Latin Jazz**: Congas, timbales percussion, dynamic drums, salsa bassline, montuno piano, trumpet lead.
  * **Acoustic Indie Ensemble**: Cajon/shakers, acoustic bass guitar, strummed acoustic guitars, expressive cello lead.
* **Acoustic & Chamber Timbres**:
  * **Piano Trio**: Singing grand piano lead, melodic upright acoustic bass, brushed jazz drums.
  * **Vibraphone & Rhythm**: Shimmering vibraphone lead, comping jazz guitar, walking upright bass, crisp brush swing.
  * **Cinematic Chamber**: Expressive cello lead, double bass, string quartet comping, subtle orchestral percussion.
  * **Solo Concert Piano**: Rich dynamic chords and singing melodic lead with full harmonic range.
* **Rhythm Section / Backing Tracks**:
  * **Band Backing Track**: Drums, bass, comping keys & rhythm guitar with **no lead soloist** (ideal for backing tracks or isolating the accompaniment).
  * **Bass & Drums Duo**: Punchy electric bassline locked in the pocket with an acoustic drum groove.
  * **Solo Electric Bass**: Warm fundamental tone, harmonics, chords, and melodic motifs.
* **Custom**:
  * **Free Style Prompt**: Allows full custom entry.

### Quick Prompt Tag Chips

Click chips below the prompt textarea to append specific descriptors:
* **Lead Timbre**: `#tenor-sax`, `#electric-guitar`, `#synth-lead`, `#grand-piano`, `#rhodes`, `#vibraphone`, `#cello`, `#trumpet`.
* **Rhythm Section**: `#rhythm-section`, `#slap-bass`, `#walking-bass`, `#punchy-drums`, `#brushed-drums`, `#comping-keys`, `#comping-guitar`.
* **Fullness & Timing**: `#full-band`, `#trio`, `#backing-track`, `#tight-groove`, `#strict-tempo`.

### Interim Pipeline Artifacts & Diagnostics

Clicking the **🔍 Interim Pipeline Artifacts & Diagnostics** card reveals subtabs for inspecting the raw data used for the synthesis job:
1. **🎼 Effective ABC Score**: The exact SheetSage2 ABC score sent to the audio engine.
2. **🎛️ Prompt & Conditioning**: View the conditioned style prompt, text/timed tags, and parameter flags.
3. **⚡ Timings & Metrics**: Granular latency measurements (planning time, token count, autoregressive decode duration, ODE diffusion steps, VAE decoding time, and Realtime Factor / RTF).
4. **🖥️ CLI Invocation**: The exact command line string to reproduce the synthesis run in your terminal.

---

## CLI Compilation & Export

You can export standalone `.abc` notation files directly from the terminal:

```bash
# Compile PPT score to standalone ABC notation
npm run compile -- scores/itsumo_nandodemo.ppt.yaml

# Explicit output path
node dist/compile-cli.js scores/strive.ppt.yaml -a scores/strive.abc

# Select specific knot projection
node dist/compile-cli.js scores/autumn_leaves_variants.ppt.yaml -k leadSheet -a scores/autumn_leaves.abc
```

The resulting `.abc` file can be opened in third-party ABC tools or passed directly to `audio.cpp` / YuE:

```bash
audio-backend/bin/audiocpp_cli.exe \
  --task gen \
  --family yue2 \
  --model ~/.cache/ppt-engraver/models/yue2-3b-gguf-q8-instrumental \
  --backend best \
  --text "[intro 0:00-0:08]\n[verse 0:08-0:16]\n[outro 0:16-0:18]" \
  --request-option "style=tight funk fusion band, punchy slap bass, synchronized drum kit groove, comping Rhodes electric piano, expressive synth lead, instrumental" \
  --request-option "cot=full" \
  --request-option "abc_file=scores/strive.abc" \
  --session-option "yue2.model_gguf=yue2-3b-q8_0.gguf" \
  --session-option "yue2.vae_gguf=yue2-vae-f16.gguf" \
  --output output.wav
```
