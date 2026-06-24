import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def is_ollama_available() -> bool:
    """Check if the Ollama service is reachable."""
    try:
        response = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return response.status_code == 200
    except Exception:
        return False

def get_chat_model(temperature=0):
    """Returns ChatOllama if available, otherwise ChatGroq as fallback."""
    if is_ollama_available():
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_CHAT_MODEL,
            temperature=temperature
        )
    
    if settings.GROQ_API_KEY:
        logger.info("Ollama is down. Falling back to Groq for chat model.")
        from langchain_groq import ChatGroq
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=settings.GROQ_MODEL,
            temperature=temperature
        )
    
    raise RuntimeError("Ollama is unavailable and GROQ_API_KEY is not set.")

def get_llm(temperature=0):
    """Returns OllamaLLM if available, otherwise ChatGroq wrapper as fallback."""
    if is_ollama_available():
        from langchain_ollama import OllamaLLM
        return OllamaLLM(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_CHAT_MODEL,
            temperature=temperature
        )
    
    if settings.GROQ_API_KEY:
        logger.info("Ollama is down. Falling back to Groq for LLM.")
        from langchain_groq import ChatGroq
        chat_model = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=settings.GROQ_MODEL,
            temperature=temperature
        )
        
        # Wrapping ChatGroq to behave like an LLM (returning a string on invoke)
        class StringReturningGroq:
            def __init__(self, chat_model):
                self.chat_model = chat_model
            
            def invoke(self, prompt, **kwargs):
                res = self.chat_model.invoke(prompt, **kwargs)
                return res.content if hasattr(res, 'content') else str(res)
                
        return StringReturningGroq(chat_model)
    
    raise RuntimeError("Ollama is unavailable and GROQ_API_KEY is not set.")

def get_embeddings():
    """Returns OllamaEmbeddings if available, otherwise Hugging Face Inference API as fallback."""
    if is_ollama_available():
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBED_MODEL,
        )
    
    if settings.HUGGING_FACE_API_KEY:
        logger.info("Ollama is down. Falling back to local Hugging Face for embeddings.")
        from langchain_community.embeddings import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    
    raise RuntimeError("Ollama is unavailable and HUGGING_FACE_API_KEY is not set.")
