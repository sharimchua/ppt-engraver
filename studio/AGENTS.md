# PPT Studio Backend Server (`studio/`)

## Purpose & Architecture

The `studio/` directory houses the interactive web development environment for PPT.
- **Backend (`studio/server.ts`)**: Fast Node.js / Express server compiling YAML scores on-the-fly, invoking LilyPond natively with `-dpoint-and-click`, and streaming PDF/SVG/JSON outputs.
- **Frontend (`studio/public/`)**: Single-page web IDE with CodeMirror editor, PDF.js renderer, interactive annotation links, and settings.

---

## Server Endpoints (`server.ts`)

| Endpoint | Method | Payload / Query | Output | Description |
|---|---|---|---|---|
| `/api/scores` | `GET` | - | `{ scores: [{ name, path, displayName, title, composer, arranger, tonic, tempo }] }` | Lists all `.ppt.yaml` files with parsed score metadata |
| `/api/score` | `GET` | `?file=...` | `{ name, content }` | Reads score YAML text |
| `/api/save` | `POST` | `{ file, content }` | `{ success, file }` | Saves YAML score file |
| `/api/delete` | `POST` | `{ file }` | `{ success, file }` | Deletes YAML score file and associated export artifacts |
| `/api/rename` | `POST` | `{ oldFile, newFile }` | `{ success, oldFile, newFile }` | Renames score YAML file and all associated compiled artifacts |
| `/api/snippets` | `GET` | - | `{ snippets: [{ id, label, displayText, desc, category, icon, context, snippet, file }] }` | Reads and parses all snippet templates in `snippets/` |
| `/api/compile` | `POST` | `{ yaml, format, knotId }` | `{ success, format, pdfBase64, svg, lilypondSource, onsets, sidecarMap, availableKnots, selectedKnotId, abcSource, timing, metrics }` | Compiles YAML with LilyPond for selected knot and returns PDF/SVG, ABC notation, and deterministic score timing |
| `/api/export-pdf` | `POST` | `{ yaml, file, knotId }` | `{ success, pdfFile, pdfBase64 }` | Compiles & exports standalone PDF to `scores/` and streams base64 for browser download |
| `/api/export-abc` | `POST` | `{ yaml, file, knotId, customAbc }` | `{ success, abcFile, abcSource, timing }` | Exports standalone `.abc` notation file to `scores/` with timing metadata |
| `/api/audio/status` | `GET` | - | `{ available, modelsLoaded, activeJobs, gpu, vramTotalGb, vramFreeGb }` | Health and VRAM status of optional Python audio backend |
| `/api/audio/models` | `GET` | - | `{ models: [...] }` | Lists audio generation models with download status |
| `/api/audio/models/download` | `POST` | `{ modelId }` | `{ success, status }` | Triggers background HuggingFace / GGUF model download |
| `/api/audio/models/delete` | `POST` | `{ modelId }` | `{ success }` | Deletes local model weights |
| `/api/audio/generate` | `POST` | `{ abc, prompt, lyrics, isInstrumental, tags, knotId, modelId, tempo, duration, ... }` | `{ jobId, status, abcSource, timing }` | Submits an audio generation job with forwarded tempo and duration bounds |
| `/api/audio/jobs/:id` | `GET` | - | `{ jobId, status, progress, stage, audioUrl, logs, pipeline: { job_id, abc_text, prompt, effective_prompt, text_conditioning, command_str, metrics: { plan_ms, abc_tokens, ar_tokens, ar_decode_ms, ode_steps, nar_synthesize_ms, vae_decode_ms, wall_ms, audio_duration_seconds, realtime_factor, device } } }` | Polls audio generation job status and rich pipeline diagnostics |
| `/api/audio/file/:filename` | `GET` | - | File stream (`audio/wav`, `text/plain` for `.abc`/`.log`, `application/json` for `.json`) | Streams generated WAV audio, interim ABC scores, and pipeline metadata JSON |

---

## Child DOX Index

- [studio/public/AGENTS.md](file:///d:/Development/Midlife%20Muso/ppt-engraver/studio/public/AGENTS.md) — Frontend client, CodeMirror modes, PDF.js viewer, Point-and-Click navigation, loupe magnifier.

---

## LilyPond Invocation Contract

- When compiling PDF:
  ```bash
  lilypond.exe -dpoint-and-click -o <tempOutPrefix> <tempLyPath>
  ```
- Fast Cairo/PostScript rendering provides sub-2-second compile cycles matching native Frescobaldi performance.
- Both PDF and SVG modes must output point-and-click anchors for live editor synchronization.

---

## Audio Backend Subsystem Integration

- `studio/server.ts` checks `--with-audio`, `--audio`, or `WITH_AUDIO=1` upon startup.
- When enabled, `server.ts` checks if `http://127.0.0.1:8000/health` is responsive; if not, it automatically spawns `python audio-backend/main.py` as a managed child process with `[audio]` console streaming and clean teardown on exit (`SIGINT`/`SIGTERM`/`taskkill`).
- **NPM Scripts**:
  - `npm run studio`: Launches Web Studio alone (default).
  - `npm run studio:audio` (or `npm run studio -- --with-audio`): Launches Web Studio and Python YuE Audio Backend together.
  - `npm run audio:backend`: Launches Python Audio Backend standalone.
- **Instrumental Model & LoRA Pairing**:
  - The default generation model `yue2-3b-gguf-q8-instrumental` is pre-merged with the Mothersuperior Section-Plan LoRA (`ar_lora_inst_v3abc.bf16.safetensors`, rank 64, 196 matrices across 28 layers).
  - Merged directly into GGUF Q8_0 weights via fast Python NumPy dequant/requant bitshifting (`audio-backend/scripts/merge_lora_gguf.py`), producing a standalone 3.97 GB GGUF model that executes natively in `audio.cpp` without runtime LoRA overhead.
  - `ModelManager` pairs the instrumental LoRA as a core dependency: downloading `yue2-3b-gguf-q8` automatically fetches the LoRA and produces the merged instrumental model.
  - Dual-track ABC conditioning projects harmonic progression measures into `V: Ins` with explicit chords at beat intervals.
  - **Timed Section Tags & Runtime Bounding**:
    - Tapestry tempo and beat values are deterministically converted into section start/end timestamps (`calculateScoreTiming`).
    - The ABC score and Studio Audio panel automatically emit and populate timed tags (`[intro 0:00-0:08]\n[verse 0:08-0:12]\n[outro 0:12-0:14]`).
    - Exact score duration (plus a 2-second chord decay outro tail) automatically sets the duration slider and passes `--duration-seconds` to `audiocpp_cli`, completely preventing the autoregressive model from looping short musical motifs.

