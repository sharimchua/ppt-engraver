"""
FastAPI Server for PPT Audio Generation Subsystem.
"""

import uuid
import sys
import json
import threading
from pathlib import Path
from typing import Dict, Any, Optional

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from .config import detect_hardware, OUTPUTS_DIR
    from .models.manager import ModelManager
    from .engines.mock_engine import MockAudioEngine
    from .engines.pytorch_engine import PyTorchAudioEngine
    from .engines.gguf_engine import GGUFAudioEngine
except (ImportError, ValueError):
    from config import detect_hardware, OUTPUTS_DIR
    from models.manager import ModelManager
    from engines.mock_engine import MockAudioEngine
    from engines.pytorch_engine import PyTorchAudioEngine
    from engines.gguf_engine import GGUFAudioEngine

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="PPT Engraver Audio Subsystem",
    description="YuE2 Symbolic Audio Generation Server for Prime Period Theory",
    version="0.1.0",
)

# Enable CORS for Studio
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_manager = ModelManager()

# In-memory job tracker
jobs: Dict[str, Dict[str, Any]] = {}
jobs_lock = threading.Lock()

class GenerateRequest(BaseModel):
    abc: str = Field(..., description="ABC score content")
    prompt: str = Field(..., description="Genre and instrumentation prompt")
    lyrics: Optional[str] = Field(None, description="Optional structured lyrics")
    cot: str = Field("melody", description="Chain of thought mode: melody, full, or off")
    temperature: float = Field(1.0, description="Sampling temperature")
    seed: Optional[int] = Field(None, description="Random seed")
    duration: Optional[float] = Field(None, description="Max audio duration in seconds")
    tempo: Optional[int] = Field(None, description="Tempo in BPM")
    engine: Optional[str] = Field("mock", description="Engine: mock, pytorch, or gguf")
    model_id: Optional[str] = Field(None, description="Selected model catalog ID")

class DownloadRequest(BaseModel):
    model_id: Optional[str] = Field(None, description="Model ID to download from catalog")
    modelId: Optional[str] = Field(None, description="Model ID alias (camelCase)")

@app.get("/health")
def health():
    return {
        "status": "online",
        "service": "ppt-audio-subsystem",
        "version": "0.1.0",
        "cache_dir": str(model_manager.cache_dir),
        "hardware": detect_hardware(),
    }

@app.get("/models")
def list_models():
    return {
        "models": model_manager.list_models(),
        "cache_dir": str(model_manager.cache_dir),
        "hardware": detect_hardware(),
    }

@app.post("/models/download")
def download_model(req: DownloadRequest):
    try:
        mid = req.model_id or req.modelId
        if not mid:
            raise ValueError("model_id or modelId is required")
        task = model_manager.start_download(mid)
        return {"success": True, "task": task}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/models/{model_id}")
def delete_model(model_id: str):
    success = model_manager.delete_model(model_id)
    return {"success": success, "model_id": model_id}

def run_generation_job(job_id: str, req: GenerateRequest):
    model_id = req.model_id or "yue2-3b-gguf-q8"
    engine_name = (req.engine or "gguf").lower()

    if model_id == "mock":
        engine_name = "mock"
    elif "pytorch" in model_id:
        engine_name = "pytorch"
    elif "gguf" in model_id:
        engine_name = "gguf"

    if engine_name == "pytorch":
        engine = PyTorchAudioEngine()
    elif engine_name == "gguf":
        engine = GGUFAudioEngine(model_id=model_id)
    else:
        engine = MockAudioEngine()

    def progress_callback(stage: str, progress: float, desc: Optional[str] = None):
        with jobs_lock:
            if job_id in jobs:
                jobs[job_id]["stage"] = stage
                jobs[job_id]["progress"] = progress
                jobs[job_id]["message"] = desc or f"Processing {stage}..."

    def log_callback(line: str):
        with jobs_lock:
            if job_id in jobs:
                if "logs" not in jobs[job_id]:
                    jobs[job_id]["logs"] = []
                jobs[job_id]["logs"].append(line)
                if len(jobs[job_id]["logs"]) > 300:
                    jobs[job_id]["logs"] = jobs[job_id]["logs"][-300:]

    try:
        with jobs_lock:
            jobs[job_id]["status"] = "processing"
            jobs[job_id]["message"] = "Starting generation..."

        # Check if engine accepts log_callback
        import inspect
        gen_kwargs = {
            "job_id": job_id,
            "abc_text": req.abc,
            "prompt": req.prompt,
            "lyrics": req.lyrics,
            "cot": req.cot,
            "temperature": req.temperature,
            "seed": req.seed,
            "duration": req.duration,
            "progress_callback": progress_callback,
        }
        if "log_callback" in inspect.signature(engine.generate).parameters:
            gen_kwargs["log_callback"] = log_callback
        if "tempo" in inspect.signature(engine.generate).parameters and req.tempo is not None:
            gen_kwargs["tempo"] = req.tempo

        audio_file = engine.generate(**gen_kwargs)

        with jobs_lock:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 1.0
            jobs[job_id]["stage"] = "finished"
            jobs[job_id]["message"] = "Generation finished successfully"
            jobs[job_id]["audio_file"] = str(audio_file)
            jobs[job_id]["audio_url"] = f"/audio/{job_id}.wav"
    except Exception as e:
        with jobs_lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["message"] = str(e)

@app.post("/generate")
def generate_audio(req: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    with jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0.0,
            "stage": "queued",
            "message": "Job queued for synthesis",
            "audio_url": None,
            "logs": ["Job queued for synthesis..."],
        }

    background_tasks.add_task(run_generation_job, job_id, req)
    return {"job_id": job_id, "status": "queued"}

@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        # Attach interim pipeline metadata if available
        meta_file = OUTPUTS_DIR / f"{job_id}.meta.json"
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    job["pipeline"] = json.load(f)
            except Exception:
                pass
        abc_file = OUTPUTS_DIR / f"{job_id}.abc"
        if abc_file.exists():
            if "pipeline" not in job:
                job["pipeline"] = {}
            if "abc_text" not in job["pipeline"]:
                try:
                    job["pipeline"]["abc_text"] = abc_file.read_text(encoding="utf-8")
                except Exception:
                    pass
        return job

@app.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"job_id": job_id, "logs": job.get("logs", [])}


@app.get("/audio/{filename}")
def get_audio_file(filename: str):
    file_path = OUTPUTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = "audio/wav"
    if filename.endswith(".abc") or filename.endswith(".log"):
        media_type = "text/plain; charset=utf-8"
    elif filename.endswith(".json"):
        media_type = "application/json"
    return FileResponse(file_path, media_type=media_type)

if __name__ == "__main__":
    import uvicorn
    # Use reload=True so changes to engines/models reload seamlessly in development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
