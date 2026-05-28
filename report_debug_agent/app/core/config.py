import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Document Analysis Agent API"
    PROJECT_VERSION: str = "1.0"
    
    PROJECT_ROOT: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    UPLOAD_DIR: str = os.path.join(PROJECT_ROOT, "uploads")
    DB_PATH: str = os.path.join(PROJECT_ROOT, "memory.sqlite")
    PERSIST_DIR: str = os.path.join(PROJECT_ROOT, "chroma_db")
    
    # Database
    DATABASE_URL: str = "sqlite:///./app_v2.db"
    
    # LLM
    OLLAMA_BASE_URL: str = "http://192.168.1.240:11434"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text:latest"
    OLLAMA_CHAT_MODEL: str = "gemma4:e4b"
    GEMINI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None


    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)