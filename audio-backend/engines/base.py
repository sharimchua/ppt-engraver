"""
Abstract base class for audio generation engines.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Callable, Optional

class BaseAudioEngine(ABC):
    @abstractmethod
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
        """
        Generates audio file from ABC score and prompt.
        
        Returns:
            Path to generated audio file (.wav or .mp3)
        """
        pass
