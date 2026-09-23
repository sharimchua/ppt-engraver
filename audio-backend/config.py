"""
Configuration and hardware detection for the PPT Audio Subsystem.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "ppt-engraver" / "models"
MODELS_CACHE_DIR = Path(os.environ.get("PPT_MODELS_DIR", DEFAULT_CACHE_DIR))
OUTPUTS_DIR = BASE_DIR / "outputs"

MODELS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Predefined Model Catalog
MODEL_CATALOG: Dict[str, Dict[str, Any]] = {
    # --- Music Planning / Generation Models ---
    "yue2-3b-gguf-q4": {
        "id": "yue2-3b-gguf-q4",
        "name": "Yue2-3B-GGUF (Q4_0 Quantized)",
        "repo_id": "audio-cpp/Yue2-3B-GGUF",
        "filename": "yue2-3b-q4_0.gguf",
        "engine": "gguf",
        "category": "generation",
        "tier": "Tier 2 (~8-9GB VRAM / CPU)",
        "estimated_size": "2.66 GB",
        "min_vram_gb": 8,
        "requires_vae": "yue2-vae-gguf",
        "sidecars": [
            "sidecars/yue2-model-config.json",
            "sidecars/yue2-generation-config.json",
            "sidecars/yue2-qwen.tiktoken",
            "sidecars/yue2-vae-config.json",
        ],
        "description": "Quantized GGUF model via audio.cpp. Runs efficiently on consumer hardware with 8GB VRAM or CPU.",
    },
    "yue2-3b-gguf-q8": {
        "id": "yue2-3b-gguf-q8",
        "name": "Yue2-3B-GGUF (Q8_0 High-Precision)",
        "repo_id": "audio-cpp/Yue2-3B-GGUF",
        "filename": "yue2-3b-q8_0.gguf",
        "engine": "gguf",
        "category": "generation",
        "tier": "Tier 2 (~12GB VRAM / CPU)",
        "estimated_size": "4.26 GB",
        "min_vram_gb": 12,
        "requires_vae": "yue2-vae-gguf",
        "sidecars": [
            "sidecars/yue2-model-config.json",
            "sidecars/yue2-generation-config.json",
            "sidecars/yue2-qwen.tiktoken",
            "sidecars/yue2-vae-config.json",
        ],
        "description": "High-precision 8-bit quantized GGUF model balancing speed and perceptual quality.",
    },
    "yue2-3b-gguf-q8-instrumental": {
        "id": "yue2-3b-gguf-q8-instrumental",
        "name": "Yue2-3B-GGUF (Q8_0 Instrumental LoRA Merged)",
        "repo_id": "Mothersuperior/YuE2-instrumental-cot-full-loras",
        "filename": "yue2-3b-q8_0.gguf",
        "engine": "gguf",
        "category": "generation",
        "tier": "Tier 2 (~12GB VRAM / CPU)",
        "estimated_size": "4.26 GB",
        "min_vram_gb": 12,
        "requires_vae": "yue2-vae-gguf",
        "requires_lora": "yue2-lora-instrumental",
        "sidecars": [
            "sidecars/yue2-model-config.json",
            "sidecars/yue2-generation-config.json",
            "sidecars/yue2-qwen.tiktoken",
            "sidecars/yue2-vae-config.json",
        ],
        "description": "Q8_0 model pre-merged with Mothersuperior Section-Plan LoRA for strict instrumental synthesis without vocal ad-libs.",
    },
    "yue2-3b-pytorch": {
        "id": "yue2-3b-pytorch",
        "name": "YuE2-3B (Official PyTorch BF16)",
        "repo_id": "m-a-p/YuE2-3B",
        "engine": "pytorch",
        "category": "generation",
        "tier": "Tier 1 (24GB VRAM)",
        "estimated_size": "15.0 GB",
        "min_vram_gb": 24,
        "requires_vae": "xcodec-mini-infer",
        "description": "Full-precision official foundation model for high-end GPUs (e.g. RTX 3090/4090).",
    },

    # --- Neural Audio Decoders & VAE (Required for Audio Waveform Synthesis) ---
    "yue2-vae-gguf": {
        "id": "yue2-vae-gguf",
        "name": "YuE2 VAE / Audio Decoder (GGUF F16)",
        "repo_id": "audio-cpp/Yue2-3B-GGUF",
        "filename": "yue2-vae-f16.gguf",
        "engine": "gguf",
        "category": "vae",
        "tier": "Required for GGUF",
        "estimated_size": "265 MB",
        "sidecars": [
            "sidecars/yue2-vae-config.json",
        ],
        "description": "Neural audio decoder / VAE for audio.cpp. Synthesizes latent acoustic tokens into 48kHz audio.",
    },
    "xcodec-mini-infer": {
        "id": "xcodec-mini-infer",
        "name": "xcodec_mini_infer (PyTorch Tokenizer / VAE)",
        "repo_id": "m-a-p/xcodec_mini_infer",
        "engine": "pytorch",
        "category": "vae",
        "tier": "Required for PyTorch",
        "estimated_size": "2.1 GB",
        "description": "Official 44.1kHz neural audio tokenizer and vocoder used by PyTorch YuE / YuE2.",
    },

    # --- Fine-tuned LoRA Adapters ---
    "yue2-lora-instrumental": {
        "id": "yue2-lora-instrumental",
        "name": "YuE2 Instrumental Section-Plan LoRA (Mothersuperior)",
        "repo_id": "Mothersuperior/YuE2-instrumental-cot-full-loras",
        "filename": "ar_lora_inst_v3abc.bf16.safetensors",
        "engine": "pytorch",
        "category": "lora",
        "tier": "Adapter (~300MB)",
        "estimated_size": "301 MB",
        "description": "AR-branch LoRA trained on 2.7k instrumental tracks with SheetSage2 ABC scores. Eliminates vocal ad-libs and enforces section progression.",
    },
}

def detect_hardware() -> Dict[str, Any]:
    """Detects available GPU hardware, CUDA capability, and total VRAM."""
    hw_info = {
        "cuda_available": False,
        "device_count": 0,
        "devices": [],
        "recommended_engine": "mock",
    }
    try:
        import torch
        if torch.cuda.is_available():
            hw_info["cuda_available"] = True
            hw_info["device_count"] = torch.cuda.device_count()
            max_vram_gb = 0.0
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                vram_gb = round(props.total_memory / (1024 ** 3), 1)
                hw_info["devices"].append({
                    "id": i,
                    "name": props.name,
                    "vram_gb": vram_gb,
                    "major": props.major,
                    "minor": props.minor,
                })
                if vram_gb > max_vram_gb:
                    max_vram_gb = vram_gb

            if max_vram_gb >= 22.0:
                hw_info["recommended_engine"] = "pytorch"
            elif max_vram_gb >= 7.5:
                hw_info["recommended_engine"] = "gguf"
            else:
                hw_info["recommended_engine"] = "gguf"
    except ImportError:
        pass

    return hw_info
