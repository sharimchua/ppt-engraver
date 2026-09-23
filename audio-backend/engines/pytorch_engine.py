"""
PyTorch Native BF16 Engine for YuE2-3B.
Requires ~24GB VRAM (e.g. RTX 3090/4090).
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, Any, Callable, Optional
try:
    from .base import BaseAudioEngine
    from ..config import MODELS_CACHE_DIR, OUTPUTS_DIR
except (ImportError, ValueError):
    from engines.base import BaseAudioEngine
    from config import MODELS_CACHE_DIR, OUTPUTS_DIR

class PyTorchAudioEngine(BaseAudioEngine):
    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = model_dir or (MODELS_CACHE_DIR / "yue2-3b-pytorch")

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
    ) -> str:
        if not self.model_dir.exists():
            raise FileNotFoundError(
                f"YuE2-3B PyTorch model not found at {self.model_dir}. Please download it from Settings -> Audio Generation."
            )

        temp_dir = OUTPUTS_DIR / f"temp_{job_id}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        abc_file = temp_dir / "score.abc"
        abc_file.write_text(abc_text, encoding="utf-8")

        prompt_file = temp_dir / "genre.txt"
        prompt_file.write_text(prompt, encoding="utf-8")

        out_wav = OUTPUTS_DIR / f"{job_id}.wav"

        if progress_callback:
            progress_callback("planning", 0.1, "Starting PyTorch YuE2 inference...")

        cmd = [
            "python", "-m", "yue.generate",
            "--model-dir", str(self.model_dir),
            "--abc-file", str(abc_file),
            "--genre-file", str(prompt_file),
            "--cot", cot,
            "--temperature", str(temperature),
            "--output", str(out_wav),
        ]
        if seed is not None:
            cmd.extend(["--seed", str(seed)])

        # If native yue package isn't directly installed as CLI, check for local script
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            raise RuntimeError(
                f"Failed to execute PyTorch YuE2 inference: {e}. Ensure PyTorch dependencies are installed."
            )

        return str(out_wav)
