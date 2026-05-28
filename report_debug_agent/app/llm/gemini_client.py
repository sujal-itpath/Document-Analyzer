import os
import re
import time
import logging
from typing import List

# Import Gemini client
from langchain_google_genai import ChatGoogleGenerativeAI
# Import Ollama client for local fallback
try:
    from langchain_ollama import ChatOllama
except ImportError:
    ChatOllama = None  # Ollama support optional

from app.core.config import settings

logger = logging.getLogger(__name__)

def _get_gemini_api_key() -> str:
    """Retrieve Gemini API key from environment or settings."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        api_key = getattr(settings, "GEMINI_API_KEY", None) or getattr(settings, "GOOGLE_API_KEY", None)
    return api_key

def _init_gemini_llm(model_name: str, api_key: str):
    """Initialize a Gemini LLM instance for the given model."""
    return ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key, temperature=0.0)

def _init_ollama_llm(model_name: str):
    """Initialize an Ollama LLM instance if available."""
    if ChatOllama is None:
        raise RuntimeError("Ollama support is not installed. Install 'langchain-ollama' to use local models.")
    return ChatOllama(model=model_name, temperature=0.0)

def generate_text(prompt: str) -> str:
    """Generate text using Gemini with optional local Ollama fallback.

    The function first checks the environment variable ``USE_LOCAL_MODEL``. If set to ``true``,
    it uses the local Ollama model defined by ``OLLAMA_CHAT_MODEL`` (default ``gemma4:e4b``).
    If the Ollama request fails (e.g., the Ollama server is not running), the function
    gracefully falls back to the Gemini models. Otherwise, it attempts the primary Gemini
    model (default ``gemini-2.0-flash``) and a set of fallback Gemini models, handling
    rate‑limit (429 / RESOURCE_EXHAUSTED) errors with exponential back‑off and the
    ``retry in Xs`` hint when present.
    """
    # Determine if we should use a local model
    use_local = os.getenv("USE_LOCAL_MODEL", "false").lower() == "true"
    if use_local:
        ollama_model = os.getenv("OLLAMA_CHAT_MODEL", "gemma4:e4b")
        logger.info(f"Attempting local Ollama model: {ollama_model}")
        try:
            llm = _init_ollama_llm(ollama_model)
            response = llm.invoke(prompt)
            return str(response.content)
        except Exception as ollama_err:
            logger.error(f"Ollama model failed: {ollama_err}. Falling back to Gemini.")
            # Continue to Gemini fallback below

    # Gemini path
    api_key = _get_gemini_api_key()
    if not api_key:
        raise ValueError(
            "Gemini API key not found. Set GEMINI_API_KEY or GOOGLE_API_KEY in the environment or .env file."
        )

    # Primary and fallback Gemini models
    primary_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    fallback_models: List[str] = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"]
    models_to_try = [primary_model] + [m for m in fallback_models if m != primary_model]

    max_attempts_per_model = 3
    for model_name in models_to_try:
        logger.info(f"Attempting Gemini model: {model_name}")
        llm = _init_gemini_llm(model_name, api_key)
        for attempt in range(max_attempts_per_model):
            try:
                response = llm.invoke(prompt)
                return str(response.content)
            except Exception as e:
                err_str = str(e)
                is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                if is_rate_limit and attempt < max_attempts_per_model - 1:
                    match = re.search(r"retry in (\d+(?:\.\d+)?)s", err_str)
                    if match:
                        sleep_time = float(match.group(1)) + 1.0
                    else:
                        sleep_time = (2 ** attempt) * 5.0
                    logger.warning(
                        f"Rate limit hit on model {model_name} (attempt {attempt + 1}/{max_attempts_per_model}). "
                        f"Sleeping {sleep_time:.2f}s before retry."
                    )
                    time.sleep(sleep_time)
                    continue
                logger.error(f"Model {model_name} failed with error: {e}")
                break
    raise RuntimeError("All Gemini models exhausted or failed after retries. Consider checking your API key or enabling a working local model via USE_LOCAL_MODEL=true.")
