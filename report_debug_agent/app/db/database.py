from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import create_engine
import datetime
from sqlalchemy import inspect

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    
    documents = relationship("Document", back_populates="owner")
    sessions = relationship("ChatSession", back_populates="user")
    integrations = relationship("UserIntegration", back_populates="user")

class UserIntegration(Base):
    __tablename__ = "user_integrations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String, index=True) # e.g., 'google'
    access_token = Column(String)
    refresh_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="integrations")

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    file_path = Column(String)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    google_doc_id = Column(String, nullable=True, index=True)
    
    # Pre-analyzed data
    summary = Column(String, nullable=True)
    suggestions = Column(String, nullable=True) # JSON string of suggested questions
    
    owner = relationship("User", back_populates="documents")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String, primary_key=True) # UUID or string ID
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    document_ids = Column(String, nullable=False, default="[]")
    user_id = Column(Integer, ForeignKey("users.id"))
    
    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    role = Column(String) # 'user' or 'agent'
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")

def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_chat_session_columns()

def _ensure_chat_session_columns():
    inspector = inspect(engine)
    
    # Check chat_sessions
    chat_columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
    if "document_ids" not in chat_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN document_ids VARCHAR NOT NULL DEFAULT '[]'"))
            
    # Check documents
    doc_columns = {column["name"] for column in inspector.get_columns("documents")}
    if "google_doc_id" not in doc_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE documents ADD COLUMN google_doc_id VARCHAR"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
