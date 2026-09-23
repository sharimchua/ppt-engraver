"""
Mock audio generation engine for development, verification, and non-GPU setups.
Synthesizes a clean 48kHz stereo audio preview while simulating multi-stage YuE2 progress.
"""

import time
import math
import wave
import struct
from pathlib import Path
from typing import Dict, Any, Callable, Optional
try:
    from .base import BaseAudioEngine
    from ..config import OUTPUTS_DIR
except (ImportError, ValueError):
    from engines.base import BaseAudioEngine
    from config import OUTPUTS_DIR

import json

class MockAudioEngine(BaseAudioEngine):
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
        dur = duration or 6.0
        # Write interim ABC and metadata
        try:
            effective_prompt = prompt
            if tempo and f"{tempo} bpm" not in effective_prompt.lower() and "bpm" not in effective_prompt.lower():
                effective_prompt = f"{effective_prompt}, {tempo} BPM"

            if lyrics and lyrics.strip():
                text_content = lyrics.strip()
            else:
                sections = []
                for line in abc_text.splitlines():
                    line_s = line.strip()
                    if line_s.startswith("%"):
                        sec_name = line_s.lstrip("%").strip().lower()
                        if sec_name in ["intro", "verse", "chorus", "pre-chorus", "bridge", "theme", "outro"]:
                            tag = "verse" if sec_name == "theme" else sec_name
                            if not sections or sections[-1] != f"[{tag}]":
                                sections.append(f"[{tag}]")
                text_content = "\n".join(sections) if sections else "[intro]\n[verse]\n[chorus]\n[outro]"

            meta_data = {
                "job_id": job_id,
                "model_id": "mock",
                "backend": "Mock / Procedural Preview",
                "device": "Mock Synthesizer (Host CPU)",
                "cot": cot,
                "temperature": temperature,
                "seed": seed,
                "duration": dur,
                "tempo": tempo,
                "prompt": prompt,
                "effective_prompt": effective_prompt,
                "text_conditioning": text_content,
                "command_str": f"mock_engine --job {job_id} --duration {dur}",
                "command": ["mock_engine", "--job", job_id, "--duration", str(dur)],
                "abc_file": f"{job_id}.abc",
                "meta_file": f"{job_id}.meta.json",
                "wav_file": f"{job_id}.wav",
                "log_file": f"{job_id}.log",
                "abc_text": abc_text,
                "metrics": {
                    "device": "Mock Synthesizer (Host CPU)",
                    "plan_ms": 0.8,
                    "abc_tokens": len(abc_text.split()),
                    "ar_tokens": 1200,
                    "ar_decode_ms": 1200.0,
                    "ode_steps": 32,
                    "nar_synthesize_ms": 800.0,
                    "vae_decode_ms": 250.0,
                    "output_frames": int(48000 * dur),
                    "audio_duration_seconds": dur,
                    "wall_ms": 1600.0,
                    "realtime_factor": round(1.6 / dur, 3),
                },
            }
            with open(OUTPUTS_DIR / f"{job_id}.meta.json", "w", encoding="utf-8") as mf:
                json.dump(meta_data, mf, indent=2)
        except Exception:
            pass

        stages = [
            ("planning", 0.2, "Symbolic Planning: Parsing ABC score and harmonic structure"),
            ("semantic", 0.5, "Semantic Encoding: Conditioned tokens aligned to style prompt"),
            ("synthesizing", 0.8, "Acoustic Synthesis: Generative track-decoupled diffusion"),
            ("decoding", 1.0, "Audio Decoding: 48kHz Stereo audio reconstruction"),
        ]

        for stage_name, progress, desc in stages:
            if progress_callback:
                progress_callback(stage_name, progress, desc)
            time.sleep(0.4)  # Smooth simulation delay

        out_path = OUTPUTS_DIR / f"{job_id}.wav"
        self._synthesize_sample_wav(out_path, dur)
        return str(out_path)

    def _synthesize_sample_wav(self, file_path: Path, duration_sec: float):
        """Generates a pleasant melodic chord progression in 48kHz 16-bit stereo WAV."""
        sample_rate = 48000
        num_samples = int(sample_rate * duration_sec)
        num_channels = 2
        sampwidth = 2

        # Chords: C (261.63, 329.63, 392.00) -> Am (220.00, 261.63, 329.63) -> F -> G
        chord_freqs = [
            [261.63, 329.63, 392.00, 523.25],  # C
            [220.00, 261.63, 329.63, 440.00],  # Am
            [174.61, 220.00, 261.63, 349.23],  # F
            [196.00, 246.94, 293.66, 392.00],  # G
        ]

        chord_duration = duration_sec / len(chord_freqs)

        with wave.open(str(file_path), "wb") as wf:
            wf.setnchannels(num_channels)
            wf.setsampwidth(sampwidth)
            wf.setframerate(sample_rate)

            frames = bytearray()
            for i in range(num_samples):
                t = i / sample_rate
                chord_idx = min(int(t / chord_duration), len(chord_freqs) - 1)
                active_chord = chord_freqs[chord_idx]

                # Synthesize gentle warm synth tones
                sample_val = 0.0
                for f in active_chord:
                    sample_val += math.sin(2 * math.pi * f * t) * 0.2

                # Apply envelope per chord
                local_t = t % chord_duration
                envelope = min(local_t * 5.0, 1.0) * max(0.0, 1.0 - (local_t / chord_duration) * 0.4)
                sample_val *= envelope

                # Soft clipping
                sample_val = max(-0.95, min(0.95, sample_val))
                int_sample = int(sample_val * 32767.0)

                # Stereo packing (L, R with subtle panning)
                frames.extend(struct.pack("<hh", int_sample, int_sample))

            wf.writeframes(frames)
