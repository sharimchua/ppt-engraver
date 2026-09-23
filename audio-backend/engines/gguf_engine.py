"""
audio.cpp / GGUF Quantized Engine for Yue2-3B-GGUF.
Runs on consumer hardware with 8-9GB VRAM (e.g. RTX 3060/4060) or CPU.
"""

import os
import shutil
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Callable, Optional
try:
    from .base import BaseAudioEngine
    from ..config import MODELS_CACHE_DIR, OUTPUTS_DIR
except (ImportError, ValueError):
    from engines.base import BaseAudioEngine
    from config import MODELS_CACHE_DIR, OUTPUTS_DIR

class GGUFAudioEngine(BaseAudioEngine):
    def __init__(self, model_id: Optional[str] = None, model_file: Optional[Path] = None):
        self.model_id = model_id or "yue2-3b-gguf-q8"
        self.model_file = model_file or self._resolve_model_file(self.model_id)
        self.vae_file = MODELS_CACHE_DIR / "yue2-vae-gguf" / "yue2-vae-f16.gguf"

    def _resolve_model_file(self, model_id: str) -> Path:
        inst_file = MODELS_CACHE_DIR / "yue2-3b-gguf-q8-instrumental" / "yue2-3b-q8_0.gguf"
        q8_file = MODELS_CACHE_DIR / "yue2-3b-gguf-q8" / "yue2-3b-q8_0.gguf"
        q4_file = MODELS_CACHE_DIR / "yue2-3b-gguf-q4" / "yue2-3b-q4_0.gguf"

        # 1. Preferred target based on model_id
        if "inst" in model_id.lower() or "lora" in model_id.lower():
            if inst_file.exists():
                return inst_file
            if q8_file.exists():
                print(f"[audio] Requested instrumental model not found at {inst_file}, falling back to stock Q8.")
                return q8_file

        if "q8" in model_id.lower():
            if q8_file.exists():
                return q8_file
            # Fallback to Q4 if Q8 missing but Q4 exists
            if q4_file.exists():
                print(f"[audio] Requested Q8 not found, but found Q4 at {q4_file}. Using Q4.")
                return q4_file
            return q8_file

        if "q4" in model_id.lower():
            if q4_file.exists():
                return q4_file
            # Fallback to Q8 if Q4 missing but Q8 exists
            if q8_file.exists():
                print(f"[audio] Requested Q4 not found, but found Q8 at {q8_file}. Using Q8.")
                return q8_file
            return q4_file

        # Default fallback: whichever exists
        if q8_file.exists():
            return q8_file
        if q4_file.exists():
            return q4_file
        return q8_file

    def _find_audio_cpp_binary(self) -> Optional[str]:
        bin_dir = Path(__file__).resolve().parent.parent / "bin"
        candidates = [
            # Official release executables from audio.cpp
            str(bin_dir / "audiocpp_cli.exe"),
            str(bin_dir / "audiocpp_cli"),
            str(bin_dir / "audiocpp_server.exe"),
            str(bin_dir / "audiocpp_server"),
            str(bin_dir / "audio-cpp.exe"),
            str(bin_dir / "audio-cpp"),
            str(bin_dir / "audiocpp.exe"),
            str(bin_dir / "audiocpp"),
            # System PATH lookups
            shutil.which("audiocpp_cli"),
            shutil.which("audiocpp"),
            shutil.which("audio-cpp"),
            shutil.which("audio.cpp"),
        ]
        for c in candidates:
            if c and Path(c).exists():
                return c
        return None

    def generate(
        self,
        job_id: str,
        abc_text: str,
        prompt: str,
        lyrics: Optional[str] = None,
        cot: str = "melody",
        temperature: float = 1.0,
        seed: Optional[int] = None,
        duration: Optional[float] = None,
        progress_callback: Optional[Callable[[str, float, Optional[str]], None]] = None,
        log_callback: Optional[Callable[[str], None]] = None,
        tempo: Optional[int] = None,
    ) -> str:
        if not self.model_file.exists():
            raise FileNotFoundError(
                f"GGUF model not found at {self.model_file}.\n"
                f"Please download '{self.model_id}' in Studio Settings (⚙) -> Audio Generation."
            )

        if not self.vae_file.exists():
            raise FileNotFoundError(
                f"Required VAE decoder file not found at '{self.vae_file}'.\n"
                "Please download 'YuE2 VAE / Audio Decoder (GGUF F16)' from Studio Settings (⚙) -> Audio Generation."
            )

        binary = self._find_audio_cpp_binary()
        if not binary:
            raise FileNotFoundError(
                "audio.cpp executable not found in system PATH or 'audio-backend/bin/'.\n"
                "To run GGUF models locally, download 'audio-cpp.exe' from https://github.com/0xShug0/audio.cpp/releases and place it in 'audio-backend/bin/'.\n"
                "Alternatively, select 'Tier 0: Mock Preview' in the Model/Tier dropdown to test the workflow without a native binary."
            )

        temp_dir = OUTPUTS_DIR / f"temp_{job_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        abc_file = temp_dir / "score.abc"
        abc_file.write_text(abc_text, encoding="utf-8")

        out_wav = OUTPUTS_DIR / f"{job_id}.wav"

        if progress_callback:
            progress_callback("synthesizing", 0.3, "Invoking audio.cpp GGUF engine...")

        model_dir = self.model_file.parent
        model_filename = self.model_file.name
        vae_path = str(self.vae_file.resolve())

        # Ensure VAE config sidecar is present in model_dir / sidecars
        target_vae_cfg = model_dir / "sidecars" / "yue2-vae-config.json"
        source_vae_cfg = MODELS_CACHE_DIR / "yue2-vae-gguf" / "sidecars" / "yue2-vae-config.json"
        if not target_vae_cfg.exists() and source_vae_cfg.exists():
            try:
                target_vae_cfg.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_vae_cfg, target_vae_cfg)
            except Exception as e:
                print(f"[audio] Warning: could not copy {source_vae_cfg} to {target_vae_cfg}: {e}")
        elif target_vae_cfg.exists() and not source_vae_cfg.exists():
            try:
                source_vae_cfg.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target_vae_cfg, source_vae_cfg)
            except Exception:
                pass

        # Ensure VAE binary is linked / present in model_dir
        target_vae_file = model_dir / self.vae_file.name
        if not target_vae_file.exists() and self.vae_file.exists():
            try:
                os.link(self.vae_file, target_vae_file)
            except Exception:
                try:
                    target_vae_file.symlink_to(self.vae_file)
                except Exception:
                    try:
                        shutil.copy2(self.vae_file, target_vae_file)
                    except Exception as e:
                        print(f"[audio] Warning: could not mirror {self.vae_file} to {target_vae_file}: {e}")

        # audiocpp_cli requires yue2.vae_gguf to be relative to the Yue2 model root
        if target_vae_file.exists():
            vae_session_path = self.vae_file.name
        else:
            try:
                vae_session_path = os.path.relpath(self.vae_file, model_dir).replace("\\", "/")
            except Exception:
                vae_session_path = self.vae_file.name

        # Determine lyrics / instrumental conditioning
        import re
        def is_section_plan_only(text: str) -> bool:
            if not text or not text.strip():
                return True
            lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
            if not lines:
                return True
            return all(len(re.sub(r'\[[^\]]+\]', '', l).strip()) == 0 for l in lines)

        has_actual_lyrics = bool(lyrics and lyrics.strip() and not is_section_plan_only(lyrics))

        if has_actual_lyrics:
            text_content = lyrics.strip()
            if not text_content.startswith("["):
                text_content = f"[verse]\n{text_content}"
            effective_prompt = prompt.strip()
        else:
            if lyrics and lyrics.strip():
                text_content = lyrics.strip()
            else:
                # Extract section comments from ABC (e.g. % [intro 0:00-0:08], % [verse 0:08-0:12], % intro, % verse)
                # YuE2's autoregressive planner requires section tags in the lyrics parameter
                # to advance its cursor through the song structure, otherwise it stays on one chord.
                sections = []
                timed_pattern = re.compile(r'^%\s*\[?([a-zA-Z-]+)\s+(\d+:\d{2}\s*-\s*\d+:\d{2})\]?', re.IGNORECASE)
                untimed_pattern = re.compile(r'^%\s*\[?([a-zA-Z-]+)\]?$', re.IGNORECASE)

                for line in abc_text.splitlines():
                    line_s = line.strip()
                    if not line_s.startswith("%"):
                        continue
                    # Ignore metadata comments like "% Section Plan:"
                    if ":" in line_s and not any(c.isdigit() for c in line_s):
                        continue

                    m_timed = timed_pattern.match(line_s)
                    if m_timed:
                        tag_name = m_timed.group(1).lower()
                        timing = m_timed.group(2).strip()
                        tag = "verse" if tag_name == "theme" else tag_name
                        if tag in ["intro", "verse", "chorus", "pre-chorus", "bridge", "outro"]:
                            formatted = f"[{tag} {timing}]"
                            if not sections or sections[-1] != formatted:
                                sections.append(formatted)
                        continue

                    m_untimed = untimed_pattern.match(line_s)
                    if m_untimed:
                        tag_name = m_untimed.group(1).lower()
                        tag = "verse" if tag_name == "theme" else tag_name
                        if tag in ["intro", "verse", "chorus", "pre-chorus", "bridge", "outro"]:
                            formatted = f"[{tag}]"
                            if not sections or sections[-1] != formatted:
                                sections.append(formatted)

                if sections:
                    has_outro = any("outro" in s for s in sections)
                    if not has_outro:
                        last_s = sections[-1]
                        last_m = re.search(r'-\s*(\d+):(\d{2})\]', last_s)
                        if last_m:
                            last_sec = int(last_m.group(1)) * 60 + int(last_m.group(2))
                            outro_end = last_sec + 2
                            m1 = outro_end // 60
                            s1 = outro_end % 60
                            sections.append(f"[outro {last_m.group(1)}:{last_m.group(2)}-{m1}:{s1:02d}]")
                        else:
                            sections.append("[outro]")
                    text_content = "\n".join(sections)
                else:
                    text_content = "[intro 0:00-0:08]\n[verse 0:08-0:14]\n[outro 0:14-0:16]"

            effective_prompt = prompt.strip()
            negative_tags = []
            if "instrumental" not in effective_prompt.lower():
                negative_tags.append("instrumental")
            if "no vocals" not in effective_prompt.lower():
                negative_tags.append("no vocals")
            if "no singing" not in effective_prompt.lower():
                negative_tags.append("no singing")
            if negative_tags:
                prefix = ", ".join(negative_tags)
                effective_prompt = f"{prefix}, {effective_prompt}" if effective_prompt else prefix

        # If duration not explicitly provided, infer from the last timed tag in text_content
        if (duration is None or duration <= 0) and text_content:
            import re
            matches = list(re.finditer(r'-\s*(\d+):(\d{2})\]', text_content))
            if matches:
                last_m = matches[-1]
                inferred_duration = int(last_m.group(1)) * 60 + int(last_m.group(2))
                if inferred_duration > 0:
                    duration = float(inferred_duration)

        if tempo and f"{tempo} bpm" not in effective_prompt.lower() and "bpm" not in effective_prompt.lower():
            effective_prompt = f"{effective_prompt}, {tempo} BPM"

        cmd = [
            binary,
            "--task", "gen",
            "--family", "yue2",
            "--model", str(model_dir.resolve()),
            "--backend", "best",
            "--threads", "8",
            "--text", text_content,
            "--request-option", f"style={effective_prompt}",
            "--request-option", f"cot={cot or 'full'}",
            "--request-option", f"abc_file={str(abc_file.resolve())}",
            "--session-option", f"yue2.model_gguf={model_filename}",
            "--session-option", f"yue2.vae_gguf={vae_session_path}",
            "--out", str(out_wav.resolve()),
            "--log",
        ]

        if temperature is not None:
            cmd.extend(["--temperature", str(temperature)])
            cmd.extend(["--request-option", f"temperature={temperature}"])

        if seed is not None:
            cmd.extend(["--seed", str(seed)])
            cmd.extend(["--request-option", f"seed={seed}"])

        if duration is not None and duration > 0:
            dur_int = int(round(duration))
            cmd.extend(["--duration-seconds", str(dur_int)])
            calc_tokens = int(max(1000, min(9000, dur_int * 75 + 500)))
            cmd.extend(["--max-tokens", str(calc_tokens)])
            cmd.extend(["--request-option", f"max_tokens={calc_tokens}"])

        # Save interim ABC directly to outputs directory for inspection, download, and debugging
        interim_abc_file = OUTPUTS_DIR / f"{job_id}.abc"
        try:
            interim_abc_file.write_text(abc_text, encoding="utf-8")
        except Exception as e:
            print(f"[audio] Warning: could not write {interim_abc_file}: {e}")

        # Determine backend capability for user notice
        backend_notice = "CPU"
        device_name = "CPU"
        try:
            dev_check = subprocess.run([binary, "--list-devices"], capture_output=True, text=True, timeout=5)
            if "CUDA" in dev_check.stdout:
                backend_notice = "CUDA GPU"
                for l in dev_check.stdout.splitlines():
                    if "Device" in l:
                        device_name = l.strip()
                        break
            elif "CPU" in dev_check.stdout:
                backend_notice = "CPU (No CUDA binary detected)"
                device_name = "CPU"
        except Exception:
            pass

        meta_file = OUTPUTS_DIR / f"{job_id}.meta.json"
        metrics_dict: Dict[str, Any] = {"device": device_name}
        cmd_str = " ".join(f'"{c}"' if " " in str(c) else str(c) for c in cmd)

        def save_meta():
            try:
                out_frames = metrics_dict.get("yue2.vae_decode.output_frames")
                wall_ms = metrics_dict.get("session.wall_ms")
                audio_dur = round(out_frames / 48000.0, 2) if out_frames else None
                rtf = None
                if wall_ms and audio_dur and audio_dur > 0:
                    rtf = round((wall_ms / 1000.0) / audio_dur, 3)

                meta_data = {
                    "job_id": job_id,
                    "model_id": self.model_id,
                    "backend": backend_notice,
                    "device": metrics_dict.get("device", device_name),
                    "cot": cot,
                    "temperature": temperature,
                    "seed": seed,
                    "duration": duration,
                    "prompt": prompt,
                    "effective_prompt": effective_prompt,
                    "text_conditioning": text_content,
                    "command_str": cmd_str,
                    "command": cmd,
                    "abc_file": f"{job_id}.abc",
                    "meta_file": f"{job_id}.meta.json",
                    "wav_file": f"{job_id}.wav",
                    "log_file": f"{job_id}.log",
                    "abc_text": abc_text,
                    "metrics": {
                        "device": metrics_dict.get("device", device_name),
                        "plan_ms": metrics_dict.get("yue2.plan_ms"),
                        "abc_tokens": metrics_dict.get("yue2.plan.abc_tokens"),
                        "ar_tokens": metrics_dict.get("yue2.ar.generate.emitted_tokens"),
                        "ar_decode_ms": metrics_dict.get("yue2.ar.generate.decode_ms"),
                        "ode_steps": metrics_dict.get("yue2.nar.synthesize.ode_steps", 32),
                        "nar_synthesize_ms": metrics_dict.get("yue2.nar.synthesize.total_ms"),
                        "vae_decode_ms": metrics_dict.get("yue2.vae_decode_ms"),
                        "output_frames": out_frames,
                        "audio_duration_seconds": audio_dur,
                        "wall_ms": wall_ms,
                        "realtime_factor": rtf,
                    },
                }
                with open(meta_file, "w", encoding="utf-8") as mf:
                    json.dump(meta_data, mf, indent=2)
            except Exception as ex:
                print(f"[audio] Warning: could not write meta.json: {ex}")

        save_meta()

        log_file = OUTPUTS_DIR / f"{job_id}.log"
        log_lines = []

        def log(msg: str):
            clean = msg.strip()
            if not clean:
                return
            log_lines.append(clean)
            print(f"[audiocpp] {clean}", flush=True)
            try:
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(clean + "\n")
            except Exception:
                pass
            if log_callback:
                try:
                    log_callback(clean)
                except Exception:
                    pass

        log(f"Starting audio.cpp GGUF generation engine [{backend_notice}]...")
        if progress_callback:
            progress_callback("planning", 0.15, f"Initializing audio.cpp ({backend_notice})...")

        import re
        timing_pattern = re.compile(r'\[TIMING [^\]]+\]\s+([\w\.\_]+)\s+([\d\.]+)')

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            current_stage = "synthesizing"
            current_progress = 0.2

            for line in iter(proc.stdout.readline, ''):
                clean = line.strip()
                if not clean:
                    continue
                log(clean)

                # Parse device info if logged
                if "Device 0:" in clean or "ggml_cuda_init: found" in clean:
                    metrics_dict["device"] = clean

                # Parse any [TIMING ...] metrics
                tm = timing_pattern.search(clean)
                if tm:
                    k, v = tm.group(1), tm.group(2)
                    try:
                        metrics_dict[k] = int(v) if v.isdigit() else float(v)
                    except ValueError:
                        pass

                desc = None
                if "yue2.plan" in clean or "prefix_tokens" in clean:
                    current_stage = "planning"
                    current_progress = 0.18
                    desc = "Processing musical prompt & ABC tokens"
                elif "weights_upload" in clean or "init_total_ms" in clean or "generation_weights" in clean:
                    current_stage = "synthesizing"
                    current_progress = 0.25
                    desc = f"Model weights loaded into memory ({backend_notice})"
                elif "prefill" in clean:
                    current_stage = "synthesizing"
                    current_progress = 0.35
                    desc = f"Prefilling attention context ({backend_notice})"
                elif "start_decode" in clean or "batched_decode" in clean:
                    current_stage = "synthesizing"
                    current_progress = 0.45
                    desc = f"Synthesizing autoregressive plan ({backend_notice})"
                elif "ar.decode" in clean or "steps" in clean:
                    current_stage = "synthesizing"
                    current_progress = min(0.70, current_progress + 0.05)
                    desc = f"Generating musical plan ({backend_notice})"
                elif "nar." in clean or "ode" in clean.lower():
                    current_stage = "synthesizing"
                    current_progress = 0.82
                    desc = f"Refining acoustic flow via ODE diffusion ({backend_notice})"
                elif "vae" in clean.lower():
                    current_stage = "decoding"
                    current_progress = 0.93
                    desc = "Decoding acoustic tokens to 48kHz audio waveform via VAE"

                if progress_callback:
                    status_text = f"{desc} | {clean}" if desc else clean
                    progress_callback(current_stage, current_progress, status_text)

            proc.stdout.close()
            returncode = proc.wait()

            # Save final collected metrics
            save_meta()

            if returncode != 0:
                full_err = "\n".join(log_lines[-25:])
                if "unsupported model family hint: yue2" in full_err or "dit_weights" in full_err:
                    raise RuntimeError(
                        f"audio.cpp binary mismatch:\n{full_err}\n\n"
                        "The detected 'audiocpp_cli.exe' does not include YuE2 support yet.\n"
                        "Please download the latest Windows dev build from GitHub Actions:\n"
                        "https://github.com/0xShug0/audio.cpp/actions/workflows/release.yml?query=branch%3Adev"
                    )
                raise RuntimeError(f"audio.cpp generation failed (exit code {returncode}):\n{full_err}")

            log("Audio synthesis completed successfully.")
            if progress_callback:
                progress_callback("complete", 1.0, "Audio generation complete.")
            return str(out_wav)

        except Exception as e:
            if not isinstance(e, RuntimeError):
                raise RuntimeError(f"audio.cpp execution error: {e}") from e
            raise
