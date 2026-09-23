# PPT Audio Subsystem (YuE / YuE2 Engine)

This subsystem serves as the local Python backend for generating high-fidelity music from Prime Period Theory scores via the **YuE2** white-box symbolic music foundation model.

> [!TIP]
> **Complete Guide & Technical Specification**: For an in-depth writeup on the ABC generation approach, SheetSage2 dialect alignment, pulse-to-meter mapping, instrumental templates, and hardware setup, see **[`docs/audio-generation.md`](../docs/audio-generation.md)**.

---

## Architecture & Hardware Tiers

- **Tier 1: PyTorch BF16 Full Engine** (`m-a-p/YuE2-3B`): Requires ~24GB VRAM (e.g. RTX 3090 / 4090).
- **Tier 2: GGUF Quantized Engine** (`audio-cpp/Yue2-3B-GGUF`): Requires ~8-12GB VRAM (e.g. RTX 3060/4060/4070) via `audio.cpp`.
  - **`yue2-3b-gguf-q8-instrumental` (Recommended)**: Q8_0 model pre-merged with the [Mothersuperior Section-Plan LoRA](https://huggingface.co/Mothersuperior/YuE2-instrumental-cot-full-loras) for strict instrumental synthesis without vocal ad-libs.
  - `yue2-3b-gguf-q4`: Lightweight 4-bit quantization for 8GB VRAM or CPU.
- **Tier 3: Mock Engine**: Integrated fallback synthesizing audio previews and multi-stage progress events for testing without a GPU.

---

## Quick Start

1. Install requirements:
   ```bash
   pip install -r audio-backend/requirements.txt
   ```
2. Launch alongside PPT Studio (recommended):
   ```bash
   npm run studio:audio
   # Or: npm run studio -- --with-audio
   ```
3. Or launch standalone daemon on `http://127.0.0.1:8000`:
   ```bash
   npm run audio:backend
   # Or: python audio-backend/main.py
   ```
4. In PPT Studio, open **Settings -> Audio Generation (YuE)** to view VRAM status, download models, and select your engine.

---

## Storage Location & Model Dependencies

- **Storage Location**: Model weights and VAE files are saved in `~/.cache/ppt-engraver/models/` (e.g. `C:\Users\<username>\.cache\ppt-engraver\models\`), configurable via the `PPT_MODELS_DIR` environment variable.
- **Neural Audio Decoders & VAE**:
  - Music synthesis requires both a **planning/generation model** and an **audio decoder / VAE vocoder**:
    - **For GGUF (`audio.cpp`)**: Requires `yue2-3b-q4_0.gguf` (or `q8_0`) PLUS `yue2-vae-gguf` (`yue2-vae-f16.gguf`, 265 MB).
    - **For PyTorch BF16**: Requires `m-a-p/YuE2-3B` PLUS `m-a-p/xcodec_mini_infer` (2.1 GB).
- **Zero-Dependency Streaming**: Single-file GGUF and VAE models download via direct chunked HTTP streaming with live progress, speed, and integrity verification. Multi-file PyTorch snapshots use `huggingface-hub`.

---

## audio.cpp Native Binaries (`audio-backend/bin/`)

For Tier 2 GGUF execution, `audio.cpp` native binaries should be placed in `audio-backend/bin/`:
- `audiocpp_cli.exe` (primary CLI executable)
- `audiocpp_server.exe` (optional server executable)
- Companion runtime DLLs (`cublas64_12.dll`, `cublasLt64_12.dll`, `msvcp140.dll`, etc.)

> [!IMPORTANT]
> **YuE2 Support**: YuE2 music generation support in `audio.cpp` is currently in active development on the **`dev`** branch. When downloading binaries from GitHub, ensure you obtain the dev branch build:
> [GitHub Actions `dev` Branch Releases](https://github.com/0xShug0/audio.cpp/actions/workflows/release.yml?query=branch%3Adev)

